/**
 * guaranteeService — parte COMPLEMENTARIA a guaranteeService.db.test.js.
 *
 * El suite .db.test.js cubre create/activate/consume/release y la lectura
 * getActiveGuarantees. Aqui se ejercita el resto de la superficie del servicio
 * contra Mongo real (SIN mockear el service ni el modelo Guarantee):
 *
 *   calculateRequiredGuarantee (todas las tasas + reduccion OEA + minimo 100),
 *   findSuitableGuarantee, linkToExpedition / releaseFromExpedition (con
 *   Expedition real), getStats, getPendingAlerts / acknowledgeAlert,
 *   renewGuarantee, suspendGuarantee, cancelGuarantee, checkExpiringGuarantees,
 *   generateReport, y la integracion OEA (getOEAReductionForOperator,
 *   calculateRequiredGuaranteeWithOEA, linkGuaranteeToOEA).
 *
 * FRONTERA mockeada SOLO la externa: oeaService (otro modulo/red). Guarantee y
 * Expedition son REALES contra BD efimera. Es logica de garantias aduaneras
 * critica (cobertura de la deuda suspendida ante la AEAT). NUNCA produccion.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

// oeaService es la unica frontera: lo mockeamos para no depender del modulo OEA.
jest.mock('../../src/services/oeaService', () => ({
  findByEORI: jest.fn(),
  findByNIF: jest.fn(),
  getById: jest.fn()
}));

const guaranteeService = require('../../src/services/guaranteeService');
const oeaService = require('../../src/services/oeaService');
const Guarantee = require('../../src/models/Guarantee');
const Expedition = require('../../src/models/Expedition');

usarBaseDeDatosEnMemoria();

const HOY = Date.now();
let seq = 0;

function datosGarantia(extra = {}) {
  return {
    reference: `GAR-X-${++seq}`,
    name: 'Aval para pruebas',
    type: 'bank_guarantee',
    totalAmount: 10000,
    currency: 'EUR',
    validFrom: new Date(HOY - 86400000),
    validUntil: new Date(HOY + 30 * 86400000),
    ...extra
  };
}

async function garantiaActiva(owner, extra = {}) {
  const { data } = await guaranteeService.createGuarantee(datosGarantia(extra), owner);
  await guaranteeService.activateGuarantee(
    data._id, `GRN-${seq}`, { authNumber: 'A1', customsOffice: 'ES002801' }, owner
  );
  return data._id;
}

beforeEach(() => {
  oeaService.findByEORI.mockResolvedValue(null);
  oeaService.findByNIF.mockResolvedValue(null);
  oeaService.getById.mockResolvedValue(null);
});

// ===================== calculateRequiredGuarantee (puro) =====================

describe('calculateRequiredGuarantee', () => {
  test('transito T1: 100% de derechos + IVA', () => {
    const r = guaranteeService.calculateRequiredGuarantee({
      regime: 'transit', subType: 'T1', dutyAmount: 800, vatAmount: 200
    });
    expect(r.rate).toBe(100);
    expect(r.baseAmount).toBe(1000); // (800+200)*100%
    expect(r.finalAmount).toBe(1000);
    expect(r.oeaReduction).toBe(0);
  });

  test('importacion temporal partial_relief: 3% por mes de duracion', () => {
    const r = guaranteeService.calculateRequiredGuarantee({
      regime: 'temporary_import', subType: 'partial_relief',
      dutyAmount: 10000, vatAmount: 0, duration: 6
    });
    // 10000 * 3% * 6 meses = 1800
    expect(r.rate).toBe(3);
    expect(r.baseAmount).toBe(1800);
  });

  test('reduccion OEAF (factor 0.50) se aplica sobre la base', () => {
    const r = guaranteeService.calculateRequiredGuarantee({
      regime: 'transit', subType: 'T1', dutyAmount: 10000, vatAmount: 0,
      oeaStatus: 'OEAF'
    });
    expect(r.finalAmount).toBe(5000);      // 10000 * 0.50
    expect(r.oeaReduction).toBe(5000);     // la mitad reducida
    expect(r.oeaStatus).toBe('OEAF');
  });

  test('minimo 100 EUR aunque la base sea menor', () => {
    const r = guaranteeService.calculateRequiredGuarantee({
      regime: 'transit', subType: 'T1', dutyAmount: 10, vatAmount: 0
    });
    expect(r.finalAmount).toBe(100);
  });

  test('regimen desconocido: cae a rate 100 por defecto', () => {
    const r = guaranteeService.calculateRequiredGuarantee({
      regime: 'inexistente', subType: 'nada', dutyAmount: 500, vatAmount: 0
    });
    expect(r.rate).toBe(100);
    expect(r.baseAmount).toBe(500);
  });
});

// ===================== findSuitableGuarantee =====================

describe('findSuitableGuarantee', () => {
  test('devuelve la garantia activa mas ajustada que cubre el importe', async () => {
    const owner = new mongoose.Types.ObjectId();
    await garantiaActiva(owner, { totalAmount: 5000, usage: 'general' });
    await garantiaActiva(owner, { totalAmount: 20000, usage: 'general' });

    const g = await guaranteeService.findSuitableGuarantee(owner, 3000, 'general');
    expect(g).not.toBeNull();
    // la mas ajustada (sort availableAmount asc) es la de 5000.
    expect(g.availableAmount).toBe(5000);
  });

  test('null si ninguna cubre el importe', async () => {
    const owner = new mongoose.Types.ObjectId();
    await garantiaActiva(owner, { totalAmount: 1000 });

    const g = await guaranteeService.findSuitableGuarantee(owner, 999999, 'general');
    expect(g).toBeNull();
  });
});

// ===================== linkToExpedition / releaseFromExpedition =====================

describe('linkToExpedition / releaseFromExpedition', () => {
  async function crearExpediente(owner) {
    return Expedition.create({
      owner,
      reference: `EXP-${++seq}`,
      status: 'draft',
      operationType: 'transit',
      transportMode: 'road',
      client: { companyName: 'ACME SL', nif: 'B12345678' }
    });
  }

  test('vincular consume el importe y refleja el vinculo en la garantia y el expediente', async () => {
    const owner = new mongoose.Types.ObjectId();
    const id = await garantiaActiva(owner);
    const exp = await crearExpediente(owner);

    const r = await guaranteeService.linkToExpedition(id, exp._id, 2500, owner);

    expect(r.data.consumedAmount).toBe(2500);
    expect(r.data.availableAmount).toBe(7500);
    expect(r.data.linkedExpeditions.some(le => String(le.expedition) === String(exp._id) && le.status === 'active')).toBe(true);

    const expActualizado = await Expedition.findById(exp._id);
    expect(expActualizado.guarantee.status).toBe('active');
    expect(expActualizado.guarantee.amount).toBe(2500);
  });

  test('vincular por encima del disponible lanza', async () => {
    const owner = new mongoose.Types.ObjectId();
    const id = await garantiaActiva(owner, { totalAmount: 1000 });
    const exp = await crearExpediente(owner);

    await expect(guaranteeService.linkToExpedition(id, exp._id, 5000, owner))
      .rejects.toThrow(/excede disponible/i);
  });

  test('liberar de expediente devuelve el importe y marca el vinculo como released', async () => {
    const owner = new mongoose.Types.ObjectId();
    const id = await garantiaActiva(owner);
    const exp = await crearExpediente(owner);
    await guaranteeService.linkToExpedition(id, exp._id, 2500, owner);

    const r = await guaranteeService.releaseFromExpedition(id, exp._id, owner);

    expect(r.data.consumedAmount).toBe(0);
    expect(r.data.availableAmount).toBe(10000);
    expect(r.data.linkedExpeditions.find(le => String(le.expedition) === String(exp._id)).status).toBe('released');

    const expActualizado = await Expedition.findById(exp._id);
    expect(expActualizado.guarantee.status).toBe('released');
  });

  test('liberar un expediente no vinculado lanza', async () => {
    const owner = new mongoose.Types.ObjectId();
    const id = await garantiaActiva(owner);
    const exp = await crearExpediente(owner);

    await expect(guaranteeService.releaseFromExpedition(id, exp._id, owner))
      .rejects.toThrow(/no vinculado/i);
  });
});

// ===================== getStats =====================

describe('getStats', () => {
  test('agrega SOLO las garantias del owner por estado, tipo e importes', async () => {
    const owner = new mongoose.Types.ObjectId();
    const otro = new mongoose.Types.ObjectId();
    const id = await garantiaActiva(owner, { totalAmount: 10000, type: 'bank_guarantee' });
    await guaranteeService.consumeGuarantee(id, 4000, 'EXP', 'x', owner);
    await garantiaActiva(otro); // ajena, no cuenta

    const stats = await guaranteeService.getStats(owner);

    expect(stats.total).toBe(1);
    expect(stats.active).toBe(1);
    expect(stats.totalAmount).toBe(10000);
    expect(stats.consumedAmount).toBe(4000);
    expect(stats.availableAmount).toBe(6000);
    expect(stats.byType.bank_guarantee).toBe(1);
  });
});

// ===================== alertas: getPendingAlerts / acknowledgeAlert =====================

describe('alertas', () => {
  test('getPendingAlerts lista las no reconocidas y acknowledgeAlert las cierra', async () => {
    const owner = new mongoose.Types.ObjectId();
    const id = await garantiaActiva(owner);
    const g = await Guarantee.findById(id);
    g.alerts.push({ type: 'low_balance', message: 'saldo bajo' });
    await g.save();
    const nuestra = (await Guarantee.findById(id)).alerts.find(a => a.type === 'low_balance');

    // Puede haber ademas una alerta 'expiring' generada por el pre-save
    // (checkAlerts) segun la ventana; solo exigimos que la nuestra este.
    const pendientes = await guaranteeService.getPendingAlerts(owner);
    expect(pendientes.length).toBeGreaterThanOrEqual(1);
    expect(pendientes.some(a => a.type === 'low_balance')).toBe(true);
    expect(pendientes.every(a => a.guaranteeId.toString() === String(id))).toBe(true);

    await guaranteeService.acknowledgeAlert(id, nuestra._id, owner);

    const tras = await guaranteeService.getPendingAlerts(owner);
    expect(tras.some(a => a.type === 'low_balance')).toBe(false);
  });

  test('acknowledgeAlert con alerta inexistente lanza', async () => {
    const owner = new mongoose.Types.ObjectId();
    const id = await garantiaActiva(owner);
    await expect(guaranteeService.acknowledgeAlert(id, new mongoose.Types.ObjectId(), owner))
      .rejects.toThrow(/no encontrada/i);
  });
});

// ===================== renewGuarantee =====================

describe('renewGuarantee', () => {
  test('extiende la vigencia y ajusta el importe registrando el movimiento', async () => {
    const owner = new mongoose.Types.ObjectId();
    const id = await garantiaActiva(owner, { totalAmount: 10000 });
    const nuevaFecha = new Date(HOY + 90 * 86400000);

    const r = await guaranteeService.renewGuarantee(id, nuevaFecha, 15000, owner);

    expect(r.data.totalAmount).toBe(15000);
    expect(r.data.availableAmount).toBe(15000); // sin consumo previo
    expect(new Date(r.data.validUntil).getTime()).toBeCloseTo(nuevaFecha.getTime(), -3);
    expect(r.data.movements.some(m => m.type === 'adjustment' && m.amount === 5000)).toBe(true);
  });

  test('reactiva una garantia expirada al renovarla', async () => {
    const owner = new mongoose.Types.ObjectId();
    const id = await garantiaActiva(owner);
    const g = await Guarantee.findById(id);
    g.status = 'expired';
    await g.save();

    const r = await guaranteeService.renewGuarantee(id, new Date(HOY + 60 * 86400000), null, owner);
    expect(r.data.status).toBe('active');
  });
});

// ===================== suspend / cancel =====================

describe('suspendGuarantee / cancelGuarantee', () => {
  test('suspender pasa a suspended y deja rastro en el historial', async () => {
    const owner = new mongoose.Types.ObjectId();
    const id = await garantiaActiva(owner);

    const r = await guaranteeService.suspendGuarantee(id, 'revision AEAT', owner);
    expect(r.data.status).toBe('suspended');
    expect(r.data.statusHistory.some(h => h.reason === 'revision AEAT')).toBe(true);
  });

  test('cancelar una garantia sin consumos la marca cancelled', async () => {
    const owner = new mongoose.Types.ObjectId();
    const id = await garantiaActiva(owner);

    const r = await guaranteeService.cancelGuarantee(id, 'ya no se usa', owner);
    expect(r.data.status).toBe('cancelled');
  });

  test('no se puede cancelar una garantia con saldo consumido', async () => {
    const owner = new mongoose.Types.ObjectId();
    const id = await garantiaActiva(owner);
    await guaranteeService.consumeGuarantee(id, 1000, 'EXP', 'x', owner);

    await expect(guaranteeService.cancelGuarantee(id, 'x', owner))
      .rejects.toThrow(/consumidos/i);
  });
});

// ===================== checkExpiringGuarantees (cron) =====================

describe('checkExpiringGuarantees', () => {
  test('marca como expiradas las active con validUntil vencido', async () => {
    // Nota: el pre-save (checkAlerts) auto-expira una garantia active recien
    // guardada con validUntil pasado. Para probar la rama de expiracion del
    // cron hay que inyectar el estado vencido SIN pasar por el pre-save
    // (updateOne salta el hook), simulando una garantia que caduco despues de
    // guardarse. Es exactamente el escenario que el cron existe para atrapar.
    const owner = new mongoose.Types.ObjectId();
    const id = await garantiaActiva(owner);
    await Guarantee.updateOne(
      { _id: id },
      { $set: { validUntil: new Date(HOY - 86400000), status: 'active' } }
    );

    const r = await guaranteeService.checkExpiringGuarantees();

    expect(r.expired).toBeGreaterThanOrEqual(1);
    const venc = await Guarantee.findById(id);
    expect(venc.status).toBe('expired');
  });

  test('genera alerta de expiracion a las que expiran en <30 dias', async () => {
    const owner = new mongoose.Types.ObjectId();
    const id = await garantiaActiva(owner);
    // Vence dentro de 10 dias (sin auto-expirar: sigue vigente).
    await Guarantee.updateOne(
      { _id: id },
      { $set: { validUntil: new Date(HOY + 10 * 86400000) } }
    );

    const r = await guaranteeService.checkExpiringGuarantees();
    expect(r.expiring).toBeGreaterThanOrEqual(1);
    const g = await Guarantee.findById(id);
    expect(g.alerts.some(a => a.type === 'expiring')).toBe(true);
  });
});

// ===================== generateReport =====================

describe('generateReport', () => {
  test('agrega totales por tipo y estado, filtrando por owner y estado', async () => {
    const owner = new mongoose.Types.ObjectId();
    const id = await garantiaActiva(owner, { totalAmount: 8000, type: 'bank_guarantee' });
    await guaranteeService.consumeGuarantee(id, 2000, 'EXP', 'transito', owner);
    await guaranteeService.releaseGuarantee(id, 500, 'EXP', 'fin', owner);

    const report = await guaranteeService.generateReport(owner, { status: 'active' });

    expect(report.totals.count).toBe(1);
    expect(report.totals.totalAmount).toBe(8000);
    expect(report.totals.byStatus.active).toBe(1);
    expect(report.totals.byType.bank_guarantee).toBe(1);
    expect(report.totals.movements.consumptions).toBe(2000);
    expect(report.totals.movements.releases).toBe(500);
    expect(report.generatedAt).toBeInstanceOf(Date);
  });
});

// ===================== integracion OEA =====================

describe('getOEAReductionForOperator', () => {
  test('operador sin OEA: no aplicable', async () => {
    const r = await guaranteeService.getOEAReductionForOperator('ESB12345678');
    expect(r.applicable).toBe(false);
    expect(r.reason).toMatch(/no tiene certificacion/i);
  });

  test('OEA aprobada y vigente: devuelve el factor de reduccion', async () => {
    oeaService.findByEORI.mockResolvedValue({
      certification: {
        status: 'approved', type: 'OEAF', number: 'ESOEAF001',
        expirationDate: new Date(HOY + 365 * 86400000)
      },
      organization: { name: 'ACME SL' },
      guaranteeReduction: { level: 'high' }
    });

    const r = await guaranteeService.getOEAReductionForOperator('ES12345678');
    expect(r.applicable).toBe(true);
    expect(r.oeaType).toBe('OEAF');
    expect(r.reductionFactor).toBe(0.50);
    expect(r.reductionPercentage).toBe(50);
  });

  test('OEA expirada: no aplicable', async () => {
    oeaService.findByEORI.mockResolvedValue({
      certification: {
        status: 'approved', type: 'OEAC', number: 'ESOEAC001',
        expirationDate: new Date(HOY - 86400000)
      },
      organization: { name: 'X' }
    });
    const r = await guaranteeService.getOEAReductionForOperator('ES1');
    expect(r.applicable).toBe(false);
    expect(r.reason).toMatch(/expirada/i);
  });

  test('OEA no aprobada: no aplicable con el estado', async () => {
    oeaService.findByEORI.mockResolvedValue({
      certification: { status: 'pending', type: 'OEAC', number: 'N1' },
      organization: { name: 'X' }
    });
    const r = await guaranteeService.getOEAReductionForOperator('ES1');
    expect(r.applicable).toBe(false);
    expect(r.reason).toMatch(/estado/i);
  });
});

describe('calculateRequiredGuaranteeWithOEA', () => {
  test('sin identificador de operador: devuelve el calculo base', async () => {
    const r = await guaranteeService.calculateRequiredGuaranteeWithOEA({
      regime: 'transit', subType: 'T1', dutyAmount: 1000, vatAmount: 0
    });
    expect(r.finalAmount).toBe(1000);
    expect(r.oeaInfo).toBeUndefined();
  });

  test('con OEA aplicable: reduce el importe final', async () => {
    oeaService.findByEORI.mockResolvedValue({
      certification: {
        status: 'approved', type: 'OEAF', number: 'ESOEAF001',
        expirationDate: new Date(HOY + 365 * 86400000)
      },
      organization: { name: 'ACME' }
    });

    const r = await guaranteeService.calculateRequiredGuaranteeWithOEA({
      regime: 'transit', subType: 'T1', dutyAmount: 10000, vatAmount: 0,
      operatorEori: 'ES12345678'
    });
    expect(r.oeaInfo.applicable).toBe(true);
    expect(r.finalAmount).toBe(5000); // 10000 * 0.50
  });

  test('con OEA no aplicable: base + motivo', async () => {
    const r = await guaranteeService.calculateRequiredGuaranteeWithOEA({
      regime: 'transit', subType: 'T1', dutyAmount: 1000, vatAmount: 0,
      operatorNif: 'B12345678'
    });
    expect(r.oeaInfo.applicable).toBe(false);
    expect(r.finalAmount).toBe(1000);
  });
});

describe('linkGuaranteeToOEA', () => {
  test('vincula la OEA propia y aplica la reduccion al importe', async () => {
    const owner = new mongoose.Types.ObjectId();
    const id = await garantiaActiva(owner, { totalAmount: 10000 });
    const oeaId = new mongoose.Types.ObjectId();
    oeaService.getById.mockResolvedValue({
      _id: oeaId,
      createdBy: owner,
      certification: { number: 'ESOEAF001', type: 'OEAF', status: 'approved' }
    });

    const r = await guaranteeService.linkGuaranteeToOEA(id, oeaId, owner);

    expect(r.data.oeaCertification.oeaNumber).toBe('ESOEAF001');
    expect(r.data.oeaCertification.reductionApplied).toBe(true);
    expect(r.data.oeaCertification.reducedAmount).toBe(5000);
  });

  test('no se puede vincular la OEA de otro operador', async () => {
    const owner = new mongoose.Types.ObjectId();
    const id = await garantiaActiva(owner);
    const oeaId = new mongoose.Types.ObjectId();
    oeaService.getById.mockResolvedValue({
      _id: oeaId,
      createdBy: new mongoose.Types.ObjectId(), // ajena
      certification: { number: 'N1', type: 'OEAC', status: 'approved' }
    });

    await expect(guaranteeService.linkGuaranteeToOEA(id, oeaId, owner))
      .rejects.toThrow(/no encontrada/i);
  });
});
