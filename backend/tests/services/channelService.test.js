/**
 * channelService — asignacion de circuito de inspeccion AEAT (verde/amarillo/
 * naranja/rojo) sobre Mongo REAL en memoria. Es logica de negocio critica: el
 * canal decide si la mercancia se levanta automaticamente, si se retiene, y si
 * se crea un requerimiento oficial (naranja/rojo) con plazo legal.
 *
 * La version ANTERIOR de este fichero mockeaba `Expedition` con un objeto vacio
 * y no llamaba nunca al servicio: todos sus expects operaban sobre objetos
 * literales inventados en el propio test. Por eso channelService.js figuraba al
 * 0% de cobertura pese a "tener tests" — es justo el antipatron que hay que
 * evitar (tests que pasan sin ejecutar la logica bajo prueba). Se sustituye por
 * esta suite, que ejercita el flujo completo con los modelos Expedition/
 * Requirement REALES: processChannelAssignment corre entero y Requirement.save()
 * valida DE VERDAD los enums del modelo (ahi es donde saldria un valor fuera de
 * enum que tumba el canal en produccion con ValidationError).
 *
 * UNICA frontera mockeada: emailService.sendEmail (red de correo). Todo lo demas
 * se ejecuta real. No se mockea el codigo bajo prueba.
 */

const emailService = require('../../src/services/emailService');
jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ messageId: 'test' })
}));

const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const channelService = require('../../src/services/channelService');
const { Expedition, Requirement } = require('../../src/models');
const mongoose = require('mongoose');

usarBaseDeDatosEnMemoria();

beforeEach(() => {
  // resetMocks:true limpia la implementacion; se reinstala en cada test.
  emailService.sendEmail.mockResolvedValue({ messageId: 'test' });
});

const usuario = { _id: new mongoose.Types.ObjectId(), name: 'Operador Test' };

/** Crea y persiste un expediente valido con la mercancia/documentos indicados. */
async function crearExpediente(overrides = {}) {
  // Un good valido: itemNumber/description/quantity/invoiceValue son required.
  const goodBase = { itemNumber: 1, description: 'Portatil', taricCode: '8471300000', originCountry: 'CN', grossWeight: 10, quantity: 1, invoiceValue: 500 };
  const base = {
    operationType: 'import',
    transportMode: 'maritime',
    client: {
      companyName: 'ACME Importaciones SL',
      nif: 'B12345678',
      eori: 'ESB12345678',
      contact: { email: 'cliente@acme.es', name: 'Juan Perez' }
    },
    declaration: {
      type: 'H1',
      mrn: '26ES00281212345678',
      customsOffice: 'ES002801',
      preference: '100'
    },
    goods: [goodBase],
    documents: [],
    ...overrides
  };
  // Rellenar los required de cada good si el override los omitio.
  base.goods = base.goods.map((g, i) => ({ itemNumber: i + 1, quantity: 1, invoiceValue: 500, ...g }));
  return Expedition.create(base);
}

describe('processChannelAssignment — validaciones de entrada', () => {
  test('expediente inexistente lanza error', async () => {
    await expect(
      channelService.processChannelAssignment(new mongoose.Types.ObjectId(), 'green', {}, usuario)
    ).rejects.toThrow(/no encontrado/i);
  });

  test('canal no reconocido lanza error', async () => {
    const exp = await crearExpediente();
    await expect(
      channelService.processChannelAssignment(exp._id, 'purple', {}, usuario)
    ).rejects.toThrow(/Canal no reconocido/i);
  });
});

describe('Canal Verde — levante automatico', () => {
  test('genera levante, fija estado green_channel y notifica al cliente', async () => {
    const exp = await crearExpediente();
    const r = await channelService.processChannelAssignment(exp._id, 'green', {}, usuario);

    expect(r.channel).toBe('green');
    expect(r.success).toBe(true);
    expect(r.levanteNumber).toMatch(/^LEV\d{4}[A-Z0-9]{6}$/);
    expect(r.levanteDocument.mrn).toBe('26ES00281212345678');
    expect(r.actions).toContain('Levante generado');

    // Persistio el estado y el canal
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.status).toBe('green_channel');
    expect(guardado.declaration.channel).toBe('green');
    expect(guardado.declaration.channelAssignedAt).toBeInstanceOf(Date);
    expect(guardado.timeline.some(t => t.action === 'channel_assigned')).toBe(true);

    // Notifico al cliente
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendEmail.mock.calls[0][0].to).toBe('cliente@acme.es');
  });
});

describe('Canal Amarillo — certificados pendientes', () => {
  test('identifica certificados pendientes segun el TARIC (electronica cap 85)', async () => {
    // El portatil (8471...) es cap 84, no dispara certificados. Usamos un cap 85.
    const exp = await crearExpediente({
      goods: [{ description: 'Telefono', taricCode: '8517120000', originCountry: 'CN', grossWeight: 2 }]
    });
    const r = await channelService.processChannelAssignment(exp._id, 'yellow', {}, usuario);

    expect(r.channel).toBe('yellow');
    expect(r.success).toBe(true);
    // Cap 85 -> declaracion CE de conformidad pendiente
    expect(r.pendingCertificates.some(c => c.code === 'C057')).toBe(true);
    expect(r.message).toMatch(/CANAL AMARILLO/);

    const guardado = await Expedition.findById(exp._id);
    expect(guardado.status).toBe('yellow_channel');
  });

  test('producto sanitario (cap 02) marca certificado sanitario obligatorio pendiente', async () => {
    const exp = await crearExpediente({
      goods: [{ description: 'Carne', taricCode: '0201100000', originCountry: 'AR', grossWeight: 500 }]
    });
    const r = await channelService.processChannelAssignment(exp._id, 'yellow', {}, usuario);
    const sanitario = r.pendingCertificates.find(c => c.code === 'C620');
    expect(sanitario).toBeDefined();
    expect(sanitario.mandatory).toBe(true);
    expect(sanitario.authority).toBe('MAPA');
  });

  test('con preferencia distinta de 100 exige certificado de origen pendiente', async () => {
    const exp = await crearExpediente({
      declaration: { type: 'H1', mrn: '26ES00281299999999', customsOffice: 'ES002801', preference: '300' },
      goods: [{ description: 'Portatil', taricCode: '8471300000', originCountry: 'JP', grossWeight: 10 }]
    });
    const r = await channelService.processChannelAssignment(exp._id, 'yellow', {}, usuario);
    expect(r.pendingCertificates.some(c => c.code === 'U069')).toBe(true);
  });
});

describe('Canal Naranja — requerimiento documental', () => {
  test('crea un Requirement documentary persistido con plazo de 10 dias habiles', async () => {
    const exp = await crearExpediente();
    const aeatResponse = { aeatResponse: { description: 'Aporte factura y origen' } };
    const r = await channelService.processChannelAssignment(exp._id, 'orange', aeatResponse, usuario);

    expect(r.channel).toBe('orange');
    expect(r.success).toBe(true);
    expect(r.requirementId).toBeDefined();

    // El Requirement se guardo DE VERDAD (valida los enums del modelo)
    const req = await Requirement.findById(r.requirementId);
    expect(req).not.toBeNull();
    expect(req.requirementType).toBe('documentary');
    expect(req.channel).toBe('orange');
    expect(req.status).toBe('pending');
    expect(req.requirementNumber).toBeTruthy();
    // Plazo estrictamente en el futuro (10 dias habiles)
    expect(req.deadline.getTime()).toBeGreaterThan(Date.now());
    // Items base: factura, packing list, transporte
    const codes = req.requestedItems.map(i => i.code);
    expect(codes).toEqual(expect.arrayContaining(['N380', 'N714', 'N785']));

    const guardado = await Expedition.findById(exp._id);
    expect(guardado.status).toBe('orange_channel');
  });

  test('usa la descripcion por defecto si AEAT no envia una', async () => {
    const exp = await crearExpediente();
    const r = await channelService.processChannelAssignment(exp._id, 'orange', {}, usuario);
    const req = await Requirement.findById(r.requirementId);
    expect(req.description).toMatch(/revision de la documentacion/i);
  });
});

describe('Canal Rojo — inspeccion fisica', () => {
  test('crea un Requirement physical persistido, retiene la mercancia y programa inspeccion', async () => {
    const exp = await crearExpediente();
    const r = await channelService.processChannelAssignment(exp._id, 'red', { inspectionType: 'partial' }, usuario);

    expect(r.channel).toBe('red');
    expect(r.success).toBe(true);
    expect(r.schedulingRequired).toBe(true);
    expect(r.inspectionType).toBe('physical');

    // El Requirement rojo se guardo DE VERDAD: enums de priority/itemType validos
    const req = await Requirement.findById(r.requirementId);
    expect(req).not.toBeNull();
    expect(req.requirementType).toBe('physical');
    expect(req.channel).toBe('red');
    expect(req.physicalInspection.scheduled).toBe(false);
    expect(req.physicalInspection.inspectionType).toBe('partial');

    const guardado = await Expedition.findById(exp._id);
    expect(guardado.status).toBe('red_channel');
  });
});

describe('reevaluateYellowChannel', () => {
  test('sin certificados pendientes, sube a verde y autoriza levante', async () => {
    // Portatil cap 84 de origen UE (FR): no dispara certificados por TARIC ni
    // exige certificado de origen (origen comunitario). Sin pendientes -> verde.
    const exp = await crearExpediente({
      goods: [{ description: 'Portatil', taricCode: '8471300000', originCountry: 'FR', grossWeight: 10, itemNumber: 1, quantity: 1, invoiceValue: 500 }]
    });
    // Dejar el expediente en canal amarillo
    exp.declaration.channel = 'yellow';
    exp.status = 'yellow_channel';
    await exp.save();

    const r = await channelService.reevaluateYellowChannel(exp._id, usuario);
    expect(r.success).toBe(true);
    expect(r.newChannel).toBe('green');

    const guardado = await Expedition.findById(exp._id);
    expect(guardado.declaration.channel).toBe('green');
    expect(guardado.status).toBe('green_channel');
    expect(guardado.declaration.levanteNumber).toMatch(/^LEV/);
    expect(guardado.timeline.some(t => t.action === 'channel_upgraded')).toBe(true);
  });

  test('con certificados aun pendientes, se mantiene en amarillo', async () => {
    const exp = await crearExpediente({
      goods: [{ description: 'Telefono', taricCode: '8517120000', originCountry: 'CN', grossWeight: 2 }]
    });
    exp.declaration.channel = 'yellow';
    exp.status = 'yellow_channel';
    await exp.save();

    const r = await channelService.reevaluateYellowChannel(exp._id, usuario);
    expect(r.success).toBe(false);
    expect(r.stillPending.length).toBeGreaterThan(0);
    expect(r.message).toMatch(/Aun faltan/i);
  });

  test('un expediente que no esta en canal amarillo lanza error', async () => {
    const exp = await crearExpediente();
    await expect(channelService.reevaluateYellowChannel(exp._id, usuario))
      .rejects.toThrow(/no esta en canal amarillo/i);
  });
});

describe('notificacion al cliente — robustez', () => {
  test('sin email de cliente no lanza (no interrumpe el flujo del canal)', async () => {
    const exp = await crearExpediente({
      client: { companyName: 'Sin Email SL', nif: 'B00000001', contact: {} }
    });
    // El canal verde debe completar aunque no haya a quien notificar
    const r = await channelService.processChannelAssignment(exp._id, 'green', {}, usuario);
    expect(r.success).toBe(true);
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  test('si el envio de email falla, el canal igualmente se procesa (error tragado a proposito)', async () => {
    emailService.sendEmail.mockRejectedValueOnce(new Error('SMTP caido'));
    const exp = await crearExpediente();
    const r = await channelService.processChannelAssignment(exp._id, 'green', {}, usuario);
    expect(r.success).toBe(true);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.status).toBe('green_channel');
  });
});

describe('helpers de configuracion y documentos', () => {
  test('getChannelConfig devuelve la config del canal o null', () => {
    expect(channelService.getChannelConfig('red').label).toBe('Canal Rojo');
    expect(channelService.getChannelConfig('inexistente')).toBeNull();
  });

  test('getAllChannels devuelve los cuatro circuitos', () => {
    const all = channelService.getAllChannels();
    expect(Object.keys(all).sort()).toEqual(['green', 'orange', 'red', 'yellow']);
  });

  test('_calculateDeadline salta fines de semana (dia habil, nunca sabado/domingo)', () => {
    const d = channelService._calculateDeadline(1);
    expect(d.getDay()).not.toBe(0);
    expect(d.getDay()).not.toBe(6);
  });

  test('_requiresOriginCertificate detecta origen extracomunitario', () => {
    const expExtra = { declaration: {}, goods: [{ originCountry: 'CN' }] };
    const expUE = { declaration: {}, goods: [{ originCountry: 'FR' }] };
    expect(channelService._requiresOriginCertificate(expExtra)).toBe(true);
    expect(channelService._requiresOriginCertificate(expUE)).toBe(false);
  });

  test('_getTaricSpecificDocuments: textil (cap 61) exige composicion', () => {
    const items = channelService._getTaricSpecificDocuments({ goods: [{ taricCode: '6109100000' }] });
    expect(items.some(i => i.code === 'Y923')).toBe(true);
  });

  test('_hasDocument reconoce un documento validado', () => {
    const exp = { documents: [{ type: 'commercial_invoice', status: 'validated' }] };
    expect(channelService._hasDocument(exp, 'commercial_invoice')).toBe(true);
    expect(channelService._hasDocument(exp, 'packing_list')).toBe(false);
    expect(channelService._hasDocument({ documents: [] }, 'commercial_invoice')).toBe(false);
  });
});
