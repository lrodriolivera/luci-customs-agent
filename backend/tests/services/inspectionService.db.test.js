/**
 * inspectionService — ciclo de vida completo con Mongo EN MEMORIA (reales).
 *
 * El test estático existente (inspectionService.test.js) sólo cubre los
 * catálogos síncronos (tipos/ubicaciones/checklist) → 20%B. Aquí ejercitamos la
 * lógica async de verdad: create (herencia de tenant desde la expedición),
 * ciclo schedule→confirm→start→complete, findings/samples/evidence/participants,
 * cancel/reschedule, list/calendar/stats/dashboard, y el guard cross-tenant de
 * _loadOwnedInspection.
 *
 * Frontera mockeada: `deadlineService` (ya cubierto en su propia campaña; sólo
 * es un efecto lateral que crea/actualiza Deadlines). Los modelos
 * Inspection/User/Expedition/Deadline se usan REALES contra Mongo en memoria
 * para verificar las escrituras.
 *
 * NO se usa isolateModules ni fake timers (trampas conocidas: duplican modelos /
 * cuelgan a Mongoose con BD real).
 *
 * jest.config: resetMocks:true → implementaciones fijadas en beforeEach.
 */

const mongoose = require('mongoose');

jest.mock('../../src/services/deadlineService', () => ({
  createFromInspection: jest.fn()
}));

const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const deadlineService = require('../../src/services/deadlineService');
const svc = require('../../src/services/inspectionService');
const Inspection = require('../../src/models/Inspection');
const User = require('../../src/models/User');
const Expedition = require('../../src/models/Expedition');
const Deadline = require('../../src/models/Deadline');

usarBaseDeDatosEnMemoria({ limpiarEntreTests: true });

beforeEach(() => {
  deadlineService.createFromInspection.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
});

const TENANT_A = new mongoose.Types.ObjectId();
const TENANT_B = new mongoose.Types.ObjectId();

/** Ubicación mínima válida (type y name son requeridos por el schema). */
function loc() {
  return { type: 'port', name: 'Puerto de Barcelona', city: 'Barcelona' };
}

/** Crea una expedición con tenant, para heredarlo en la inspección. */
async function crearExpedicion(tenantId = TENANT_A) {
  return Expedition.create({
    expeditionId: 'EXP-' + new mongoose.Types.ObjectId().toString().slice(-6),
    tenantId,
    transportMode: 'maritime',
    operationType: 'import',
    client: { nif: 'B12345678', companyName: 'ACME' },
    goods: [{ itemNumber: 1, description: 'x', taricCode: '95030070', quantity: 1, invoiceValue: 10 }]
  });
}

/** Crea una inspección vía el servicio, heredando tenant de una expedición. */
async function crearInspeccion(overrides = {}, userId = null) {
  const exp = await crearExpedicion(overrides.tenantId || TENANT_A);
  return svc.create({
    inspectionType: 'physical',
    expeditionId: exp._id,
    location: loc(),
    ...overrides
  }, userId);
}

// ==================== create ====================
describe('create', () => {
  test('crea inspección con número autogenerado y hereda tenant de la expedición', async () => {
    const exp = await crearExpedicion(TENANT_A);
    const insp = await svc.create({
      inspectionType: 'physical',
      expeditionId: exp._id,
      location: loc()
    }, new mongoose.Types.ObjectId());

    expect(insp.inspectionNumber).toMatch(/^INS-PHY-\d{4}-\d{5}$/);
    expect(String(insp.tenantId)).toBe(String(TENANT_A));
    // Defaults derivados del typeConfig.
    expect(insp.scheduling.estimatedDuration).toBe(120);
    expect(insp.authority.type).toBe('AEAT');
  });

  test('respeta duración y autoridad explícitas del payload', async () => {
    const exp = await crearExpedicion();
    const insp = await svc.create({
      inspectionType: 'soivre',
      expeditionId: exp._id,
      location: loc(),
      scheduling: { estimatedDuration: 999 },
      authority: { type: 'SOIVRE' }
    });
    expect(insp.scheduling.estimatedDuration).toBe(999);
    expect(insp.authority.type).toBe('SOIVRE');
  });

  test('crea deadline si hay fecha programada', async () => {
    const exp = await crearExpedicion();
    await svc.create({
      inspectionType: 'physical',
      expeditionId: exp._id,
      location: loc(),
      scheduling: { scheduledDate: new Date(Date.now() + 86400000) }
    });
    expect(deadlineService.createFromInspection).toHaveBeenCalled();
  });

  test('no crea deadline si no hay fecha programada', async () => {
    await crearInspeccion();
    expect(deadlineService.createFromInspection).not.toHaveBeenCalled();
  });

  test('tenant explícito en el payload prevalece (no consulta la expedición)', async () => {
    const insp = await svc.create({
      inspectionType: 'documentary',
      tenantId: TENANT_B,
      location: loc()
    });
    expect(String(insp.tenantId)).toBe(String(TENANT_B));
  });

  test('propaga el error si falla la validación (location requerida)', async () => {
    await expect(svc.create({ inspectionType: 'physical' })).rejects.toThrow();
  });
});

// ==================== createFromRequirement ====================
describe('createFromRequirement', () => {
  test('deriva los campos del requerimiento', async () => {
    const exp = await crearExpedicion(TENANT_A);
    const requirement = {
      _id: new mongoose.Types.ObjectId(),
      expeditionId: exp._id,
      mrn: '25ES00110000000ABC',
      lrn: 'LRN-1',
      physicalInspection: { location: loc(), scheduledDate: new Date(Date.now() + 172800000) },
      issuingAuthority: 'MAPA',
      priority: 'high'
    };
    const insp = await svc.createFromRequirement(requirement, 'mapa');
    expect(insp.inspectionType).toBe('mapa');
    expect(insp.mrn).toBe('25ES00110000000ABC');
    expect(insp.priority).toBe('high');
    expect(String(insp.requirementId)).toBe(String(requirement._id));
    expect(insp.authority.type).toBe('MAPA');
  });

  test('usa location vacía y prioridad normal por defecto', async () => {
    const exp = await crearExpedicion();
    // Sin location válida el save fallaría; el requirement no la aporta →
    // createFromRequirement pasa {} y el schema exige type/name → error.
    const requirement = { _id: new mongoose.Types.ObjectId(), expeditionId: exp._id };
    await expect(svc.createFromRequirement(requirement)).rejects.toThrow();
  });
});

// ==================== getById / getByNumber ====================
describe('lectura por id/número', () => {
  test('getById devuelve la inspección', async () => {
    const insp = await crearInspeccion();
    const encontrada = await svc.getById(insp._id);
    expect(String(encontrada._id)).toBe(String(insp._id));
  });

  test('getByNumber busca por inspectionNumber', async () => {
    const insp = await crearInspeccion();
    const encontrada = await svc.getByNumber(insp.inspectionNumber);
    expect(String(encontrada._id)).toBe(String(insp._id));
  });
});

// ==================== list ====================
describe('list', () => {
  test('pagina y filtra', async () => {
    await crearInspeccion({ inspectionType: 'physical' });
    await crearInspeccion({ inspectionType: 'scanner' });
    const r = await svc.list({ inspectionType: 'physical' }, { limit: 10 });
    expect(r.total).toBe(1);
    expect(r.inspections[0].inspectionType).toBe('physical');
    expect(r.pages).toBe(1);
  });

  test('sin filtros devuelve todo con paginación por defecto', async () => {
    await crearInspeccion();
    await crearInspeccion();
    const r = await svc.list();
    expect(r.total).toBe(2);
    expect(r.page).toBe(1);
    expect(r.limit).toBe(20);
  });

  test('sortOrder desc no lanza', async () => {
    await crearInspeccion();
    const r = await svc.list({}, { sortOrder: 'desc', sortBy: 'createdAt' });
    expect(r.inspections.length).toBe(1);
  });
});

// ==================== calendario / hoy / pendientes / programadas ====================
describe('calendario y consultas por fecha', () => {
  test('getScheduledForDate devuelve las de esa fecha', async () => {
    const fecha = new Date();
    fecha.setHours(10, 0, 0, 0);
    await crearInspeccion({ scheduling: { scheduledDate: fecha }, status: 'scheduled' });
    const r = await svc.getScheduledForDate(fecha);
    expect(r.length).toBe(1);
  });

  test('getToday delega en getScheduledForDate con la fecha actual', async () => {
    const hoy = new Date();
    hoy.setHours(9, 0, 0, 0);
    await crearInspeccion({ scheduling: { scheduledDate: hoy }, status: 'confirmed' });
    const r = await svc.getToday();
    expect(r.length).toBe(1);
  });

  test('getPending filtra estados abiertos y opcionalmente por usuario', async () => {
    const user = new mongoose.Types.ObjectId();
    await crearInspeccion({ status: 'requested', assignedTo: user });
    await crearInspeccion({ status: 'completed' });
    const todas = await svc.getPending();
    expect(todas.length).toBe(1);
    const mias = await svc.getPending(user);
    expect(mias.length).toBe(1);
  });

  test('getCalendar agrupa por fecha ISO', async () => {
    const fecha = new Date(Date.now() + 86400000);
    fecha.setHours(12, 0, 0, 0);
    await crearInspeccion({ scheduling: { scheduledDate: fecha }, status: 'scheduled' });
    const inicio = new Date(Date.now() - 86400000);
    const fin = new Date(Date.now() + 172800000);
    const r = await svc.getCalendar(inicio, fin);
    const clave = fecha.toISOString().split('T')[0];
    expect(r.grouped[clave]).toHaveLength(1);
    expect(r.inspections.length).toBe(1);
  });
});

// ==================== ciclo de vida ====================
describe('ciclo de vida schedule→confirm→start→complete', () => {
  test('schedule programa y crea deadline', async () => {
    const insp = await crearInspeccion();
    const fecha = new Date(Date.now() + 86400000);
    const r = await svc.schedule(insp._id, { scheduledDate: fecha }, null);
    expect(r.status).toBe('scheduled');
    expect(deadlineService.createFromInspection).toHaveBeenCalled();
  });

  test('confirm marca confirmado con número de confirmación', async () => {
    const insp = await crearInspeccion();
    const r = await svc.confirm(insp._id, 'CONF-123', null);
    expect(r.status).toBe('confirmed');
    expect(r.scheduling.confirmationNumber).toBe('CONF-123');
  });

  test('start marca en curso y sella startedAt', async () => {
    const insp = await crearInspeccion();
    const r = await svc.start(insp._id, null);
    expect(r.status).toBe('in_progress');
    expect(r.execution.startedAt).toBeInstanceOf(Date);
  });

  test('complete marca completado, fija resultado y completa el deadline asociado', async () => {
    const insp = await crearInspeccion();
    await svc.start(insp._id, null);
    // Sembramos un deadline asociado abierto para cubrir la rama que lo completa.
    const dl = await Deadline.create({
      deadlineType: 'inspection_appointment',
      category: 'inspection',
      title: 'Inspección',
      status: 'pending',
      dueDate: new Date(Date.now() + 86400000),
      references: { inspectionId: insp._id }
    });
    const r = await svc.complete(insp._id, { result: 'approved' }, null);
    expect(r.status).toBe('completed');
    expect(r.result).toBe('approved');
    const dlRecargado = await Deadline.findById(dl._id);
    expect(dlRecargado.status).toBe('completed');
  });

  test('complete sin deadline asociado no lanza', async () => {
    const insp = await crearInspeccion();
    const r = await svc.complete(insp._id, { result: 'rejected' }, null);
    expect(r.status).toBe('completed');
  });
});

// ==================== guard cross-tenant (_loadOwnedInspection) ====================
describe('_loadOwnedInspection (guard cross-tenant)', () => {
  test('un usuario de OTRO tenant no puede operar la inspección', async () => {
    const insp = await crearInspeccion({ tenantId: TENANT_A });
    const userAjeno = await User.create({
      name: 'Ajeno', email: 'ajeno@x.com', password: 'secret123', tenantId: TENANT_B
    });
    await expect(svc.confirm(insp._id, 'C', userAjeno._id))
      .rejects.toThrow('Inspección no encontrada');
  });

  test('un usuario del MISMO tenant sí puede operar', async () => {
    const insp = await crearInspeccion({ tenantId: TENANT_A });
    const userMismo = await User.create({
      name: 'Mismo', email: 'mismo@x.com', password: 'secret123', tenantId: TENANT_A
    });
    const r = await svc.confirm(insp._id, 'C', userMismo._id);
    expect(r.status).toBe('confirmed');
  });

  test('sin userId (jobs) no se comprueba el tenant', async () => {
    const insp = await crearInspeccion({ tenantId: TENANT_A });
    const r = await svc.start(insp._id, null);
    expect(r.status).toBe('in_progress');
  });

  test('lanza "no encontrada" si el id no existe', async () => {
    await expect(svc.start(new mongoose.Types.ObjectId(), null))
      .rejects.toThrow('Inspección no encontrada');
  });

  test('inspección legacy sin tenantId pasa aunque el usuario tenga tenant', async () => {
    // create con tenant explícito null y sin expedición → sin tenantId.
    const insp = await svc.create({ inspectionType: 'documentary', location: loc() });
    expect(insp.tenantId).toBeUndefined();
    const user = await User.create({ name: 'U', email: 'u2@x.com', password: 'secret123', tenantId: TENANT_A });
    const r = await svc.start(insp._id, user._id);
    expect(r.status).toBe('in_progress');
  });
});

// ==================== participantes / evidencia / items / findings ====================
describe('sub-documentos', () => {
  test('addParticipant añade un participante', async () => {
    const insp = await crearInspeccion();
    const r = await svc.addParticipant(insp._id, { role: 'inspector', name: 'Inspector J' }, null);
    expect(r.participants).toHaveLength(1);
    expect(r.participants[0].name).toBe('Inspector J');
  });

  test('addEvidence añade evidencia con capturedAt por defecto', async () => {
    const insp = await crearInspeccion();
    const r = await svc.addEvidence(insp._id, { type: 'photo', fileName: 'f.jpg' }, null);
    expect(r.evidence).toHaveLength(1);
    expect(r.evidence[0].capturedAt).toBeInstanceOf(Date);
  });

  test('addInspectedItem numera automáticamente', async () => {
    const insp = await crearInspeccion();
    await svc.addInspectedItem(insp._id, { description: 'A' }, null);
    const r = await svc.addInspectedItem(insp._id, { description: 'B' }, null);
    expect(r.inspectedItems).toHaveLength(2);
    expect(r.inspectedItems[1].itemNumber).toBe(2);
  });

  test('registerFinding marca discrepancias y añade timeline', async () => {
    const insp = await crearInspeccion();
    const r = await svc.registerFinding(insp._id, { discrepancySummary: 'peso no coincide', quantityDiscrepancy: true }, null);
    expect(r.findings.discrepanciesFound).toBe(true);
    expect(r.findings.quantityDiscrepancy).toBe(true);
    expect(r.timeline.some(t => t.action === 'finding_registered')).toBe(true);
  });
});

// ==================== muestras ====================
describe('muestras', () => {
  test('addSample añade muestra con sentAt por defecto', async () => {
    const insp = await crearInspeccion();
    const r = await svc.addSample(insp._id, { sampleId: 'S1', purpose: 'lab' }, null);
    expect(r.samples).toHaveLength(1);
    expect(r.samples[0].sentAt).toBeInstanceOf(Date);
  });

  test('updateSampleResult actualiza la muestra por su _id', async () => {
    const insp = await crearInspeccion();
    const conMuestra = await svc.addSample(insp._id, { sampleId: 'S1', purpose: 'lab' }, null);
    const sampleId = conMuestra.samples[0]._id;
    const r = await svc.updateSampleResult(insp._id, sampleId, { result: 'conforme' }, null);
    const muestra = r.samples.id(sampleId);
    expect(muestra.result).toBe('conforme');
    expect(muestra.resultReceivedAt).toBeInstanceOf(Date);
  });

  test('updateSampleResult lanza si la muestra no existe', async () => {
    const insp = await crearInspeccion();
    await expect(svc.updateSampleResult(insp._id, new mongoose.Types.ObjectId(), {}, null))
      .rejects.toThrow('Muestra no encontrada');
  });
});

// ==================== acta / acciones ====================
describe('acta y acciones', () => {
  test('generateReport genera acta con número y timeline', async () => {
    const insp = await crearInspeccion();
    const r = await svc.generateReport(insp._id, { conclusions: 'todo ok' }, null);
    expect(r.report.reportNumber).toMatch(/^ACT-/);
    expect(r.timeline.some(t => t.action === 'report_generated')).toBe(true);
  });

  test('addResultingAction añade acción en estado pending', async () => {
    const insp = await crearInspeccion();
    const r = await svc.addResultingAction(insp._id, { actionType: 'levante', description: 'levante ok' }, null);
    expect(r.resultingActions).toHaveLength(1);
    expect(r.resultingActions[0].status).toBe('pending');
  });
});

// ==================== cancel / reschedule ====================
describe('cancel y reschedule', () => {
  test('cancel marca cancelado y cancela el deadline asociado', async () => {
    const insp = await crearInspeccion();
    const dl = await Deadline.create({
      deadlineType: 'inspection_appointment', category: 'inspection', title: 'x', status: 'pending',
      dueDate: new Date(Date.now() + 86400000), references: { inspectionId: insp._id }
    });
    const r = await svc.cancel(insp._id, 'cliente desistió', null);
    expect(r.status).toBe('cancelled');
    expect(r.internalNotes).toMatch(/Cancelada/);
    const dlRecargado = await Deadline.findById(dl._id);
    expect(dlRecargado.status).toBe('cancelled');
  });

  test('cancel sin deadline asociado no lanza', async () => {
    const insp = await crearInspeccion();
    const r = await svc.cancel(insp._id, 'motivo', null);
    expect(r.status).toBe('cancelled');
  });

  test('reschedule cambia la fecha, vuelve a scheduled y actualiza el deadline', async () => {
    const insp = await crearInspeccion({ scheduling: { scheduledDate: new Date(Date.now() + 86400000) } });
    const nuevaFecha = new Date(Date.now() + 172800000);
    const r = await svc.reschedule(insp._id, { scheduledDate: nuevaFecha }, 'inspector no disponible', null);
    expect(r.status).toBe('scheduled');
    expect(r.timeline.some(t => t.action === 'rescheduled')).toBe(true);
    expect(deadlineService.createFromInspection).toHaveBeenCalled();
  });
});

// ==================== estadísticas / dashboard ====================
describe('estadísticas y dashboard', () => {
  test('getStats agrega por estado/tipo/resultado', async () => {
    await crearInspeccion({ status: 'requested' });
    await crearInspeccion({ status: 'completed', result: 'approved' });
    const stats = await svc.getStats();
    expect(stats.total).toBe(2);
    expect(stats.byStatus.requested).toBe(1);
    expect(stats.byResult.approved).toBe(1);
  });

  test('getDashboard combina stats, hoy, pendientes y recientes', async () => {
    await crearInspeccion({ status: 'requested' });
    const completadaReciente = await crearInspeccion({ status: 'completed' });
    // Fijamos completedAt dentro de la ventana de 7 días.
    await Inspection.findByIdAndUpdate(completadaReciente._id, {
      'execution.completedAt': new Date()
    });
    const dash = await svc.getDashboard();
    expect(dash.stats).toBeDefined();
    expect(dash.summary.totalPending).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(dash.recentCompleted)).toBe(true);
  });

  test('getDashboard con userId filtra por assignedTo', async () => {
    const user = new mongoose.Types.ObjectId();
    await crearInspeccion({ status: 'requested', assignedTo: user });
    const dash = await svc.getDashboard(user);
    expect(dash.summary.totalPending).toBe(1);
  });
});

// ==================== catálogos con salida no cubierta ====================
describe('catálogos residuales', () => {
  test('getInspectionChecklist devuelve [] para tipo desconocido', () => {
    expect(svc.getInspectionChecklist('inexistente')).toEqual([]);
  });

  test('getSpecificChecklistItems devuelve [] para tipo sin items', () => {
    expect(svc.getSpecificChecklistItems('post_clearance')).toEqual([]);
  });
});
