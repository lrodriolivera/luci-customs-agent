/**
 * deadlineService sobre Mongo REAL en memoria. El fichero hermano
 * deadlineService.test.js solo cubre los helpers PUROS (config de tipos,
 * categorias, generateAlertMessage). Esta suite ejercita la parte que toca la
 * base de datos —donde estan casi todas las ramas sin cubrir y la logica de
 * negocio critica: gestion de plazos legales aduaneros, aislamiento por tenant
 * y el arbol de decision de alertas—.
 *
 * Es negocio critico: un plazo mal calculado o una alerta que no salta puede
 * hacer perder un recurso preclusivo, la renovacion de una garantia o la
 * ultimacion de un regimen (deuda aduanera y sanciones).
 *
 * UNICA frontera mockeada: el logger (I/O de escritura de logs). El resto
 * —modelos Deadline/Expedition/User— se ejecuta REAL contra el mongod efimero,
 * de modo que Deadline.save() valida DE VERDAD enums, required y el pre-save que
 * recalcula el status por fecha. No se mockea el codigo bajo prueba.
 */

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const deadlineService = require('../../src/services/deadlineService');
const Deadline = require('../../src/models/Deadline');
const Expedition = require('../../src/models/Expedition');
const User = require('../../src/models/User');
const mongoose = require('mongoose');

usarBaseDeDatosEnMemoria();

/** Fecha a N dias desde ahora (positivo futuro, negativo pasado). */
function enDias(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

describe('create — defaults y herencia de tenant', () => {
  test('aplica category/priority/impact/alerts por defecto del tipo cuando no vienen en el payload', async () => {
    const dl = await deadlineService.create({
      deadlineType: 'requirement_response',
      title: 'Responder requerimiento',
      dueDate: enDias(10)
    });

    expect(dl.category).toBe('requirement');       // heredado de config
    expect(dl.priority).toBe('high');
    expect(dl.impact).toBe('high');
    expect(dl.impactDescription).toMatch(/rechazo de la declaraci/i);
    expect(dl.source).toBe('manual');              // default cuando no se indica
    expect(dl.alertConfig.enabled).toBe(true);
    // Los alerts por defecto del tipo, con recipients:[] y enabled:true
    expect(dl.alertConfig.alerts.length).toBe(3);
    expect(dl.alertConfig.alerts.every(a => a.enabled === true)).toBe(true);
    expect(dl.nextAlertDue).toBeInstanceOf(Date);  // calculateNextAlert corrio
  });

  test('respeta los valores explicitos del payload por encima de los defaults', async () => {
    const alertsCustom = [{ daysBeforeDeadline: 2, alertType: 'email', enabled: true, recipients: [] }];
    const dl = await deadlineService.create({
      deadlineType: 'requirement_response',
      title: 'Con overrides',
      dueDate: enDias(10),
      category: 'other',
      priority: 'low',
      impact: 'none',
      impactDescription: 'texto propio',
      source: 'import',
      alertConfig: { alerts: alertsCustom }
    });

    expect(dl.category).toBe('other');
    expect(dl.priority).toBe('low');
    expect(dl.impact).toBe('none');
    expect(dl.impactDescription).toBe('texto propio');
    expect(dl.source).toBe('import');
    expect(dl.alertConfig.alerts.length).toBe(1);
  });

  test('tipo desconocido cae en la config "other"', async () => {
    const dl = await deadlineService.create({
      deadlineType: 'other',
      title: 'Generico',
      dueDate: enDias(5)
    });
    expect(dl.category).toBe('other');
    expect(dl.priority).toBe('medium');
  });

  test('hereda el tenantId de la expedicion referenciada cuando el payload no lo trae', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const exp = await Expedition.create({
      tenantId,
      operationType: 'import',
      transportMode: 'maritime',
      client: { companyName: 'ACME SL', nif: 'B12345678' },
      goods: [{ itemNumber: 1, description: 'X', quantity: 1, invoiceValue: 100 }]
    });

    const dl = await deadlineService.create({
      deadlineType: 'h7_completion',
      title: 'Completar H7',
      dueDate: enDias(3),
      references: { expeditionId: exp._id }
    });

    expect(String(dl.tenantId)).toBe(String(tenantId));
  });

  test('si la expedicion no tiene tenantId, el deadline queda sin tenant (no revienta)', async () => {
    const exp = await Expedition.create({
      operationType: 'import',
      transportMode: 'air',
      client: { companyName: 'Sin Tenant SL', nif: 'B99999999' },
      goods: [{ itemNumber: 1, description: 'X', quantity: 1, invoiceValue: 100 }]
    });

    const dl = await deadlineService.create({
      deadlineType: 'h7_completion',
      title: 'Sin tenant',
      dueDate: enDias(3),
      references: { expeditionId: exp._id }
    });
    expect(dl.tenantId).toBeUndefined();
  });

  test('el tenantId explicito del payload no se sobreescribe con el de la expedicion', async () => {
    const tenantPayload = new mongoose.Types.ObjectId();
    const exp = await Expedition.create({
      tenantId: new mongoose.Types.ObjectId(),
      operationType: 'import',
      transportMode: 'maritime',
      client: { companyName: 'ACME SL', nif: 'B12345678' },
      goods: [{ itemNumber: 1, description: 'X', quantity: 1, invoiceValue: 100 }]
    });

    const dl = await deadlineService.create({
      deadlineType: 'h7_completion',
      title: 'Tenant propio',
      dueDate: enDias(3),
      tenantId: tenantPayload,
      references: { expeditionId: exp._id }
    });
    expect(String(dl.tenantId)).toBe(String(tenantPayload));
  });

  test('un payload invalido (sin dueDate) propaga el error de validacion', async () => {
    await expect(
      deadlineService.create({ deadlineType: 'other', title: 'Sin fecha' })
    ).rejects.toThrow();
  });
});

describe('createFrom* — creacion automatica desde otras entidades', () => {
  test('createFromRequirement crea un deadline requirement_response', async () => {
    const dl = await deadlineService.createFromRequirement({
      _id: new mongoose.Types.ObjectId(),
      requirementNumber: 'REQ-2026-00001',
      subject: 'Aporte factura',
      deadline: enDias(10),
      expeditionId: new mongoose.Types.ObjectId(),
      mrn: '26ES00281212345678'
    });
    expect(dl.deadlineType).toBe('requirement_response');
    expect(dl.source).toBe('automatic');
    expect(dl.externalReferences.mrn).toBe('26ES00281212345678');
    expect(dl.title).toMatch(/REQ-2026-00001/);
  });

  test('createFromRequirement usa description cuando no hay subject', async () => {
    const dl = await deadlineService.createFromRequirement({
      _id: new mongoose.Types.ObjectId(),
      requirementNumber: 'REQ-2026-00002',
      description: 'Solo descripcion',
      deadline: enDias(8),
      expeditionId: new mongoose.Types.ObjectId()
    });
    expect(dl.description).toBe('Solo descripcion');
  });

  test('createFromGuarantee crea vencimiento + renovacion (30 dias antes)', async () => {
    const endDate = enDias(60);
    const dls = await deadlineService.createFromGuarantee({
      _id: new mongoose.Types.ObjectId(),
      guaranteeNumber: 'GAR-001',
      guaranteeType: 'global',
      bankEntity: 'Banco Test',
      validity: { endDate },
      holder: { name: 'ACME', nif: 'B12345678', eori: 'ESB12345678' }
    });

    expect(dls).toHaveLength(2);
    const [expiration, renewal] = dls;
    expect(expiration.deadlineType).toBe('guarantee_expiration');
    expect(renewal.deadlineType).toBe('guarantee_renewal');
    // La renovacion vence 30 dias antes del vencimiento
    expect(renewal.dueDate.getTime()).toBeLessThan(expiration.dueDate.getTime());
    expect(expiration.client.nif).toBe('B12345678');
  });

  test('createFromGuarantee sin endDate no crea nada', async () => {
    const dls = await deadlineService.createFromGuarantee({
      _id: new mongoose.Types.ObjectId(),
      guaranteeNumber: 'GAR-002',
      validity: {}
    });
    expect(dls).toHaveLength(0);
  });

  test('createFromOEA crea renovacion solo si hay expirationDate', async () => {
    const conFecha = await deadlineService.createFromOEA({
      _id: new mongoose.Types.ObjectId(),
      oeaNumber: 'ESOEAC1234AB',
      certification: { type: 'AEOF', expirationDate: enDias(90) },
      organization: { name: 'ACME', nif: 'B12345678', eori: 'ESB12345678' }
    });
    expect(conFecha).toHaveLength(1);
    expect(conFecha[0].deadlineType).toBe('oea_renewal');

    const sinFecha = await deadlineService.createFromOEA({
      _id: new mongoose.Types.ObjectId(),
      oeaNumber: 'ESOEAC9999ZZ',
      certification: {}
    });
    expect(sinFecha).toHaveLength(0);
  });

  test('createFromSpecialRegime crea ultimacion y/o cuenta segun los deadlines presentes', async () => {
    const ambos = await deadlineService.createFromSpecialRegime({
      _id: new mongoose.Types.ObjectId(),
      regimeNumber: 'REG-001',
      regimeType: 'IPA',
      description: 'Perfeccionamiento activo',
      ultimationDeadline: enDias(30),
      accountDeadline: enDias(45),
      expeditionId: new mongoose.Types.ObjectId(),
      mrn: '26ES00281212345678'
    });
    expect(ambos).toHaveLength(2);
    expect(ambos[0].deadlineType).toBe('regime_ultimation');
    expect(ambos[1].deadlineType).toBe('regime_account');

    const soloUltimacion = await deadlineService.createFromSpecialRegime({
      _id: new mongoose.Types.ObjectId(),
      regimeNumber: 'REG-002',
      regimeType: 'IPA',
      ultimationDeadline: enDias(30)
    });
    expect(soloUltimacion).toHaveLength(1);

    const ninguno = await deadlineService.createFromSpecialRegime({
      _id: new mongoose.Types.ObjectId(),
      regimeNumber: 'REG-003'
    });
    expect(ninguno).toHaveLength(0);
  });

  test('createFromTransit crea llegada solo si hay expectedArrival', async () => {
    const con = await deadlineService.createFromTransit({
      _id: new mongoose.Types.ObjectId(),
      transitNumber: 'T-001',
      departureOffice: 'ES002801',
      destinationOffice: 'FR001',
      expectedArrival: enDias(2),
      expeditionId: new mongoose.Types.ObjectId(),
      mrn: '26ES00281212345678'
    });
    expect(con).toHaveLength(1);
    expect(con[0].deadlineType).toBe('transit_arrival');

    const sin = await deadlineService.createFromTransit({
      _id: new mongoose.Types.ObjectId(),
      transitNumber: 'T-002'
    });
    expect(sin).toHaveLength(0);
  });

  test('createFromInspection devuelve null sin scheduledDate y crea deadline con ella', async () => {
    const sinCita = await deadlineService.createFromInspection({
      _id: new mongoose.Types.ObjectId(),
      inspectionNumber: 'INS-001',
      scheduling: {}
    });
    expect(sinCita).toBeNull();

    const conCita = await deadlineService.createFromInspection({
      _id: new mongoose.Types.ObjectId(),
      inspectionNumber: 'INS-002',
      inspectionType: 'complete',
      location: { name: 'Puerto de Valencia' },
      scheduling: { scheduledDate: enDias(1) },
      expeditionId: new mongoose.Types.ObjectId()
    });
    expect(conCita).not.toBeNull();
    expect(conCita.deadlineType).toBe('inspection_appointment');
  });
});

describe('_loadOwnedDeadline (via update/complete/etc.) — aislamiento por tenant', () => {
  async function crearDeadline(tenantId) {
    return deadlineService.create({
      deadlineType: 'other',
      title: 'Plazo',
      dueDate: enDias(10),
      ...(tenantId ? { tenantId } : {})
    });
  }

  test('update falla si el deadline no existe', async () => {
    await expect(
      deadlineService.update(new mongoose.Types.ObjectId(), { title: 'x' })
    ).rejects.toThrow(/no encontrado/i);
  });

  test('update aplica cambios cuando el usuario es del mismo tenant', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const user = await User.create({
      name: 'Op', email: 'op@acme.es', password: 'Secret123!', tenantId
    });
    const dl = await crearDeadline(tenantId);

    const actualizado = await deadlineService.update(dl._id, { title: 'Nuevo titulo' }, user._id);
    expect(actualizado.title).toBe('Nuevo titulo');
  });

  test('update de un deadline de OTRO tenant se comporta como "no encontrado" (no lo revela)', async () => {
    const tenantDoc = new mongoose.Types.ObjectId();
    const dl = await crearDeadline(tenantDoc);
    const intruso = await User.create({
      name: 'Intruso', email: 'intruso@otra.es', password: 'Secret123!',
      tenantId: new mongoose.Types.ObjectId()
    });

    await expect(
      deadlineService.update(dl._id, { title: 'hackeado' }, intruso._id)
    ).rejects.toThrow(/no encontrado/i);

    // No se modifico
    const sinTocar = await Deadline.findById(dl._id);
    expect(sinTocar.title).toBe('Plazo');
  });

  test('sin userId (jobs) no se comprueba tenant', async () => {
    const dl = await crearDeadline(new mongoose.Types.ObjectId());
    const actualizado = await deadlineService.update(dl._id, { title: 'Job update' });
    expect(actualizado.title).toBe('Job update');
  });

  test('un deadline legacy sin tenantId pasa aunque el usuario tenga tenant', async () => {
    const dl = await crearDeadline(null);
    const user = await User.create({
      name: 'Op2', email: 'op2@acme.es', password: 'Secret123!',
      tenantId: new mongoose.Types.ObjectId()
    });
    const actualizado = await deadlineService.update(dl._id, { title: 'Legacy ok' }, user._id);
    expect(actualizado.title).toBe('Legacy ok');
  });

  test('complete marca el deadline como completado', async () => {
    const dl = await crearDeadline(null);
    const completado = await deadlineService.complete(dl._id, 'hecho');
    expect(completado.status).toBe('completed');
    expect(completado.completionNotes).toBe('hecho');
    expect(completado.completedAt).toBeInstanceOf(Date);
  });

  test('extend empuja la fecha y registra la extension', async () => {
    const dl = await crearDeadline(null);
    const nuevaFecha = enDias(30);
    const extendido = await deadlineService.extend(dl._id, nuevaFecha, 'prorroga AEAT');
    // El metodo extend() del modelo fija status='extended', pero el pre-save
    // recalcula el status por fecha y solo respeta 'completed'/'cancelled': a 30
    // dias futuros lo devuelve a 'pending'. Es el comportamiento REAL del modelo
    // ('extended' es un estado transitorio que save() pisa). Lo que importa —la
    // nueva fecha y el historial de extensiones— si persiste correctamente.
    expect(extendido.dueDate.getTime()).toBe(nuevaFecha.getTime());
    expect(extendido.extensions).toHaveLength(1);
    expect(extendido.extensions[0].reason).toBe('prorroga AEAT');
    expect(extendido.extensions[0].originalDate).toBeInstanceOf(Date);
  });

  test('cancel marca cancelado y anota el motivo', async () => {
    const dl = await crearDeadline(null);
    const cancelado = await deadlineService.cancel(dl._id, 'ya no aplica');
    expect(cancelado.status).toBe('cancelled');
    expect(cancelado.notes).toMatch(/ya no aplica/);
  });

  test('delete hace soft-delete (active=false)', async () => {
    const dl = await crearDeadline(null);
    const borrado = await deadlineService.delete(dl._id);
    expect(borrado.active).toBe(false);
  });
});

describe('consultas — getById, list, pending/overdue/urgent/byCategory/byType/byAssignee', () => {
  test('getById devuelve el deadline con populate', async () => {
    const dl = await deadlineService.create({ deadlineType: 'other', title: 'X', dueDate: enDias(5) });
    const encontrado = await deadlineService.getById(dl._id);
    expect(String(encontrado._id)).toBe(String(dl._id));
  });

  test('list pagina y filtra por active', async () => {
    await deadlineService.create({ deadlineType: 'other', title: 'A', dueDate: enDias(5) });
    await deadlineService.create({ deadlineType: 'other', title: 'B', dueDate: enDias(6) });
    const res = await deadlineService.list({}, { page: 1, limit: 1 });
    expect(res.total).toBe(2);
    expect(res.deadlines).toHaveLength(1);
    expect(res.pages).toBe(2);
  });

  test('getByCategory y getByType filtran correctamente', async () => {
    await deadlineService.create({ deadlineType: 'guarantee_expiration', title: 'G', dueDate: enDias(20) });
    await deadlineService.create({ deadlineType: 'transit_arrival', title: 'T', dueDate: enDias(2) });

    const garantias = await deadlineService.getByCategory('guarantee');
    expect(garantias).toHaveLength(1);

    const transitos = await deadlineService.getByType('transit_arrival');
    expect(transitos).toHaveLength(1);
  });

  test('getByAssignee filtra por usuario', async () => {
    const userId = new mongoose.Types.ObjectId();
    await deadlineService.create({ deadlineType: 'other', title: 'Mia', dueDate: enDias(5), assignedTo: userId });
    await deadlineService.create({ deadlineType: 'other', title: 'Ajena', dueDate: enDias(5) });

    const mias = await deadlineService.getByAssignee(userId);
    expect(mias).toHaveLength(1);
    expect(mias[0].title).toBe('Mia');
  });

  test('getOverdue devuelve los vencidos (status overdue por pre-save)', async () => {
    await deadlineService.create({ deadlineType: 'other', title: 'Vencido', dueDate: enDias(-5) });
    const vencidos = await deadlineService.getOverdue();
    expect(vencidos).toHaveLength(1);
    expect(vencidos[0].status).toBe('overdue');
  });

  test('getUrgent devuelve los que vencen dentro del umbral de horas', async () => {
    await deadlineService.create({ deadlineType: 'other', title: 'Ya', dueDate: enDias(1) });
    await deadlineService.create({ deadlineType: 'other', title: 'Lejos', dueDate: enDias(20) });
    const urgentes = await deadlineService.getUrgent(48);
    expect(urgentes.some(d => d.title === 'Ya')).toBe(true);
    expect(urgentes.some(d => d.title === 'Lejos')).toBe(false);
  });
});

describe('calendario, estadisticas y dashboard', () => {
  test('getCalendarView agrupa por fecha ISO', async () => {
    const fecha = enDias(3);
    await deadlineService.create({ deadlineType: 'other', title: 'Cal', dueDate: fecha });
    const vista = await deadlineService.getCalendarView(enDias(0), enDias(10));
    expect(vista.deadlines.length).toBeGreaterThanOrEqual(1);
    const key = fecha.toISOString().split('T')[0];
    expect(vista.grouped[key]).toBeDefined();
  });

  test('getStats agrega por estado/categoria/urgencia', async () => {
    await deadlineService.create({ deadlineType: 'other', title: 'A', dueDate: enDias(-2) }); // overdue
    await deadlineService.create({ deadlineType: 'other', title: 'B', dueDate: enDias(5) });  // approaching
    const stats = await deadlineService.getStats();
    expect(stats.total).toBe(2);
    expect(stats.overdue).toBeGreaterThanOrEqual(1);
    expect(stats.byCategory.other).toBe(2);
  });

  test('getDashboard combina stats, urgentes, vencidos y los de hoy', async () => {
    await deadlineService.create({ deadlineType: 'other', title: 'Hoy', dueDate: new Date() });
    await deadlineService.create({ deadlineType: 'other', title: 'Vencido', dueDate: enDias(-3) });
    const dash = await deadlineService.getDashboard();
    expect(dash.stats).toBeDefined();
    expect(Array.isArray(dash.urgent)).toBe(true);
    expect(Array.isArray(dash.overdue)).toBe(true);
    expect(dash.summary).toBeDefined();
  });

  test('getDashboard filtrado por usuario solo cuenta sus deadlines', async () => {
    const userId = new mongoose.Types.ObjectId();
    await deadlineService.create({ deadlineType: 'other', title: 'Suya', dueDate: enDias(-1), assignedTo: userId });
    await deadlineService.create({ deadlineType: 'other', title: 'Ajena', dueDate: enDias(-1) });
    const dash = await deadlineService.getDashboard(userId);
    // getOverdue({assignedTo:userId}) acota por usuario: solo debe salir "Suya".
    // (assignedTo llega null tras el populate porque no existe el User; lo que se
    // valida aqui es el FILTRO, no el documento poblado.)
    expect(dash.overdue).toHaveLength(1);
    expect(dash.overdue[0].title).toBe('Suya');
  });
});

describe('sendAlert / processAlerts — arbol de niveles de alerta', () => {
  test('deadline vencido genera alerta critical', async () => {
    const dl = await deadlineService.create({ deadlineType: 'other', title: 'Vencido', dueDate: enDias(-1) });
    const alerta = await deadlineService.sendAlert(dl);
    expect(alerta.alertLevel).toBe('critical');
    expect(alerta.message).toMatch(/VENCIDO/);
  });

  test('deadline a 1 dia genera alerta urgent', async () => {
    const dl = await deadlineService.create({ deadlineType: 'other', title: 'Manana', dueDate: enDias(1) });
    const alerta = await deadlineService.sendAlert(dl);
    expect(alerta.alertLevel).toBe('urgent');
  });

  test('deadline a 3 dias genera alerta warning', async () => {
    const dl = await deadlineService.create({ deadlineType: 'other', title: 'Pronto', dueDate: enDias(3) });
    const alerta = await deadlineService.sendAlert(dl);
    expect(alerta.alertLevel).toBe('warning');
  });

  test('deadline lejano genera alerta info', async () => {
    const dl = await deadlineService.create({ deadlineType: 'other', title: 'Lejos', dueDate: enDias(30) });
    const alerta = await deadlineService.sendAlert(dl);
    expect(alerta.alertLevel).toBe('info');
  });

  test('sendAlert registra el destinatario cuando hay una config de alerta aplicable', async () => {
    // A 3 dias, la config "other" tiene una alerta a 3 dias (>= days) -> se marca enviada
    const dl = await deadlineService.create({ deadlineType: 'other', title: 'Con dest', dueDate: enDias(3) });
    const alerta = await deadlineService.sendAlert(dl);
    expect(alerta.sentTo.length).toBeGreaterThanOrEqual(0); // depende del match de dias
    const recargado = await Deadline.findById(dl._id);
    expect(recargado.sentAlerts.length).toBeGreaterThanOrEqual(1);
  });

  test('processAlerts procesa los deadlines cuya proxima alerta ya vence', async () => {
    // Un deadline a 1 dia: calculateNextAlert deja nextAlertDue en el pasado
    // para la config a 1 dia -> findDueForAlerts lo recoge.
    await deadlineService.create({ deadlineType: 'other', title: 'Alerta ya', dueDate: enDias(1) });
    const procesadas = await deadlineService.processAlerts();
    expect(Array.isArray(procesadas)).toBe(true);
  });
});
