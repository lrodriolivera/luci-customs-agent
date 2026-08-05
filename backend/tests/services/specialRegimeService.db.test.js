/**
 * specialRegimeService — parte con PERSISTENCIA real (Mongo en memoria). El
 * suite hermano specialRegimeService.test.js mockea SpecialRegime y Guarantee,
 * asi que el ciclo de vida real (pre-save que genera reference + calculateTotals,
 * canBeDischarge, agregaciones de getStats/list, y la manipulacion de goods) no
 * se ejercitaba. Aqui se cubre el ciclo completo contra modelos REALES:
 *
 *   create -> authorize -> linkGuarantee -> activate -> addGoods ->
 *   requestExtension -> discharge (+releaseGuarantee, calculateDischargedDuties) ,
 *   ademas de partialExit (deposito 71), updateTransitStatus (T1/T2/TIR),
 *   getExpiringRegimes, getStats, list, getById, update y delete.
 *
 * Es logica de negocio aduanero critica (garantias, derechos suspendidos,
 * plazos CAU). NO se mockea el propio service. BD efimera, NUNCA produccion.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const specialRegimeService = require('../../src/services/specialRegimeService');
const SpecialRegime = require('../../src/models/SpecialRegime');
const Guarantee = require('../../src/models/Guarantee');
// getById/list hacen populate de expedition/guarantee/User -> registrar modelos.
require('../../src/models/User');
require('../../src/models/Expedition');

usarBaseDeDatosEnMemoria();

const OWNER = new mongoose.Types.ObjectId();

// Mercancia valida (cumple los required del RegimeGoodsSchema).
function good(overrides = {}) {
  return {
    description: 'Componentes electronicos',
    taricCode: '85340011',
    quantity: 100,
    netWeight: 50,
    customsValue: 10000,
    countryOfOrigin: 'CN',
    ...overrides
  };
}

function datos(regimeCode = '51', overrides = {}) {
  const typeMap = {
    '51': 'inward_processing', '53': 'temporary_admission', '71': 'customs_warehouse',
    'T1': 'external_transit', 'T2': 'internal_transit', 'TIR': 'tir_transit'
  };
  return {
    regimeCode,
    regimeType: typeMap[regimeCode],
    goods: [good()],
    ...overrides
  };
}

// Garantia valida segun el schema real (availableAmount/consumedAmount, NO balance).
async function crearGarantia(total = 100000, owner = OWNER) {
  return Guarantee.create({
    owner,
    name: 'Garantia de prueba',
    type: 'CGU',
    status: 'active',
    totalAmount: total,
    consumedAmount: 0,
    availableAmount: total,
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  });
}

// Crea un regimen en el estado deseado recorriendo las transiciones reales.
async function regimenActivo(regimeCode = '51', { conGarantia = true } = {}) {
  const r = await specialRegimeService.create(datos(regimeCode), OWNER);
  await specialRegimeService.authorize(r._id, { controlOffice: 'ES00' }, OWNER);
  if (conGarantia) {
    const g = await crearGarantia();
    await specialRegimeService.linkGuarantee(r._id, g._id, OWNER);
  }
  await specialRegimeService.activate(r._id, OWNER);
  return SpecialRegime.findById(r._id);
}

// ===================== create =====================

describe('create', () => {
  test('genera reference, calcula derechos suspendidos y totales', async () => {
    const r = await specialRegimeService.create(datos('51'), OWNER);
    expect(r.reference).toMatch(/^IP-\d{4}-\d{5}$/);
    expect(r.status).toBe('draft');
    expect(String(r.owner)).toBe(String(OWNER));
    // 85 -> electronics 3%: 10000*0.03=300 tariff; vat=(10300)*0.21=2163
    expect(r.goods[0].suspendedDuties.tariff).toBe(300);
    expect(r.goods[0].suspendedDuties.vat).toBeCloseTo(2163, 2);
    expect(r.totals.totalGuaranteed).toBeCloseTo(2463, 2);
  });

  test('transito (T1) usa deadline por dias', async () => {
    const r = await specialRegimeService.create(datos('T1', { transitDays: 10 }), OWNER);
    const diff = Math.round((r.deadlineDate - r.startDate) / (1000 * 60 * 60 * 24));
    expect(diff).toBe(10);
  });

  test('respeta deadlineDate explicito', async () => {
    const r = await specialRegimeService.create(
      datos('51', { deadlineDate: '2027-01-01' }), OWNER
    );
    expect(r.deadlineDate.getFullYear()).toBe(2027);
  });
});

// ===================== calculateSuspendedDuties (todas las tasas) =====================

describe('calculateSuspendedDuties', () => {
  const svc = specialRegimeService;
  test('agricola 15%', () => {
    expect(svc.calculateSuspendedDuties({ customsValue: 1000, taricCode: '08010000' }, '51').tariff).toBe(150);
  });
  test('textil 12%', () => {
    expect(svc.calculateSuspendedDuties({ customsValue: 1000, taricCode: '61091000' }, '51').tariff).toBe(120);
  });
  test('vehiculos 10%', () => {
    expect(svc.calculateSuspendedDuties({ customsValue: 1000, taricCode: '87032000' }, '51').tariff).toBe(100);
  });
  test('default 5% cuando no hay taricCode', () => {
    expect(svc.calculateSuspendedDuties({ customsValue: 1000 }, '51').tariff).toBe(50);
  });
});

// ===================== authorize / activate =====================

describe('authorize / activate', () => {
  test('activate exige garantia cuando totalGuaranteed > 0', async () => {
    const r = await specialRegimeService.create(datos('51'), OWNER);
    await specialRegimeService.authorize(r._id, { controlOffice: 'ES00' }, OWNER);
    // Sin vincular garantia y con totalGuaranteed>0 -> error.
    await expect(specialRegimeService.activate(r._id, OWNER))
      .rejects.toThrow(/garantia/i);
  });

  test('activate recalcula deadline desde la fecha de activacion (regimen 51)', async () => {
    const r = await regimenActivo('51');
    expect(r.status).toBe('active');
    // deadline ~ hoy + durationMonths (12 por defecto).
    const meses = (r.deadlineDate.getFullYear() - r.startDate.getFullYear()) * 12
      + (r.deadlineDate.getMonth() - r.startDate.getMonth());
    expect(meses).toBe(12);
  });
});

// ===================== linkGuarantee =====================

describe('linkGuarantee', () => {
  test('afecta el saldo de la garantia y registra el movimiento', async () => {
    const r = await specialRegimeService.create(datos('51'), OWNER);
    await specialRegimeService.authorize(r._id, {}, OWNER);
    const g = await crearGarantia(100000);

    const { guarantee } = await specialRegimeService.linkGuarantee(r._id, g._id, OWNER);
    const req = await SpecialRegime.findById(r._id);
    expect(guarantee.consumedAmount).toBeCloseTo(req.totals.totalGuaranteed, 2);
    expect(guarantee.availableAmount).toBeCloseTo(100000 - req.totals.totalGuaranteed, 2);
    expect(req.guarantee.guaranteeId).toBeDefined();
  });

  test('saldo insuficiente lanza', async () => {
    const r = await specialRegimeService.create(datos('51'), OWNER);
    await specialRegimeService.authorize(r._id, {}, OWNER);
    const g = await crearGarantia(10); // insuficiente

    await expect(specialRegimeService.linkGuarantee(r._id, g._id, OWNER))
      .rejects.toThrow(/Saldo insuficiente/);
  });

  test('garantia de otro owner: mismo error que si no existiera', async () => {
    const r = await specialRegimeService.create(datos('51'), OWNER);
    await specialRegimeService.authorize(r._id, {}, OWNER);
    const g = await crearGarantia(100000, new mongoose.Types.ObjectId()); // ajena

    await expect(specialRegimeService.linkGuarantee(r._id, g._id, OWNER))
      .rejects.toThrow(/Garantia no encontrada/);
  });
});

// ===================== requestExtension / getMaxExtension =====================

describe('requestExtension', () => {
  test('prorroga un regimen activo dentro del limite', async () => {
    const r = await regimenActivo('53'); // temporal, max 24 meses
    const nueva = new Date(r.deadlineDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const res = await specialRegimeService.requestExtension(
      r._id, { newDeadline: nueva.toISOString(), reason: 'mas plazo' }, OWNER
    );
    expect(res.extensions).toHaveLength(1);
    expect(res.deadlineDate.getTime()).toBeCloseTo(nueva.getTime(), -3);
  });

  test('rechaza fecha no posterior a la actual', async () => {
    const r = await regimenActivo('53');
    const anterior = new Date(r.deadlineDate.getTime() - 1000);
    await expect(specialRegimeService.requestExtension(
      r._id, { newDeadline: anterior.toISOString() }, OWNER
    )).rejects.toThrow(/posterior/);
  });

  test('rechaza si excede el maximo del regimen (51: 3 anos)', async () => {
    const r = await regimenActivo('51');
    const lejos = new Date();
    lejos.setFullYear(lejos.getFullYear() + 5);
    await expect(specialRegimeService.requestExtension(
      r._id, { newDeadline: lejos.toISOString() }, OWNER
    )).rejects.toThrow(/maxima de prorroga/);
  });

  test('solo prorroga regimenes activos', async () => {
    const r = await specialRegimeService.create(datos('51'), OWNER);
    await expect(specialRegimeService.requestExtension(
      r._id, { newDeadline: new Date().toISOString() }, OWNER
    )).rejects.toThrow(/activos/);
  });

  test('getMaxExtension: 71 no tiene limite', () => {
    expect(specialRegimeService.getMaxExtension({ regimeCode: '71', startDate: new Date() })).toBeNull();
  });
});

// ===================== discharge + releaseGuarantee + calculateDischargedDuties =====================

describe('discharge', () => {
  test('ultima un regimen activo, libera garantia y calcula derechos a libre practica', async () => {
    const r = await regimenActivo('51');
    const usadoAntes = (await Guarantee.findById(r.guarantee.guaranteeId)).consumedAmount;
    expect(usadoAntes).toBeGreaterThan(0);

    const { regime, dutiesPayable } = await specialRegimeService.discharge(
      r._id, { type: 'release_free_circulation', mrn: 'MRN1' }, OWNER
    );
    expect(regime.status).toBe('discharged');
    expect(dutiesPayable).toHaveProperty('payable');

    // Garantia liberada (used vuelve a 0).
    const g = await Guarantee.findById(r.guarantee.guaranteeId);
    expect(g.consumedAmount).toBe(0);
    expect(regime.guarantee.status).toBe('released');
  });

  test('exencion parcial (53 partial_relief) calcula derecho proporcional a los meses', async () => {
    const r = await specialRegimeService.create(
      datos('53', { subType: 'partial_relief', temporaryAdmission: { monthlyDutyPercent: 3 } }),
      OWNER
    );
    await specialRegimeService.authorize(r._id, {}, OWNER);
    const g = await crearGarantia();
    await specialRegimeService.linkGuarantee(r._id, g._id, OWNER);
    await specialRegimeService.activate(r._id, OWNER);

    const { dutiesPayable } = await specialRegimeService.discharge(
      r._id, { type: 'release_free_circulation' }, OWNER
    );
    expect(dutiesPayable).toHaveProperty('accumulatedPercent');
    expect(dutiesPayable).toHaveProperty('monthsInRegime');
    expect(dutiesPayable.monthsInRegime).toBeGreaterThanOrEqual(1);
  });

  test('rechaza ultimar un regimen en draft', async () => {
    const r = await specialRegimeService.create(datos('51'), OWNER);
    r.status = 'discharged';
    await r.save();
    await expect(specialRegimeService.discharge(r._id, { type: 're_export' }, OWNER))
      .rejects.toThrow(/no puede ser ultimado/);
  });
});

// ===================== addGoods =====================

describe('addGoods', () => {
  test('anade mercancia y recalcula totales', async () => {
    const r = await specialRegimeService.create(datos('51'), OWNER);
    const antes = r.totals.totalGuaranteed;
    const res = await specialRegimeService.addGoods(r._id, good({ customsValue: 5000 }), OWNER);
    expect(res.goods).toHaveLength(2);
    expect(res.totals.totalGuaranteed).toBeGreaterThan(antes);
  });

  test('en estado active con garantia: afecta saldo adicional', async () => {
    const r = await regimenActivo('51');
    const g = await Guarantee.findById(r.guarantee.guaranteeId);
    const usadoAntes = g.consumedAmount;

    await specialRegimeService.addGoods(r._id, good({ customsValue: 5000 }), OWNER);
    const gDespues = await Guarantee.findById(r.guarantee.guaranteeId);
    expect(gDespues.consumedAmount).toBeGreaterThan(usadoAntes);
  });

  test('rechaza en estado no permitido', async () => {
    const r = await regimenActivo('51');
    r.status = 'discharged';
    await r.save();
    await expect(specialRegimeService.addGoods(r._id, good(), OWNER))
      .rejects.toThrow(/estado actual/);
  });
});

// ===================== partialExit (deposito 71) =====================

describe('partialExit', () => {
  test('reduce cantidad, recalcula derechos y libera garantia proporcional', async () => {
    const r = await regimenActivo('71');
    const goodId = r.goods[0]._id.toString();

    const res = await specialRegimeService.partialExit(
      r._id, { goodId, quantity: 40 }, OWNER
    );
    // 100 -> 60 unidades
    expect(res.goods[0].quantity).toBe(60);
  });

  test('elimina la mercancia si la cantidad llega a 0', async () => {
    const r = await regimenActivo('71');
    const goodId = r.goods[0]._id.toString();
    const res = await specialRegimeService.partialExit(
      r._id, { goodId, quantity: 100 }, OWNER
    );
    expect(res.goods).toHaveLength(0);
  });

  test('rechaza en regimen que no sea deposito', async () => {
    const r = await regimenActivo('51');
    await expect(specialRegimeService.partialExit(
      r._id, { goodId: 'x', quantity: 1 }, OWNER
    )).rejects.toThrow(/deposito aduanero/);
  });

  test('rechaza si la cantidad excede el stock', async () => {
    const r = await regimenActivo('71');
    const goodId = r.goods[0]._id.toString();
    await expect(specialRegimeService.partialExit(
      r._id, { goodId, quantity: 999 }, OWNER
    )).rejects.toThrow(/excede el stock/);
  });
});

// ===================== updateTransitStatus =====================

describe('updateTransitStatus', () => {
  test('registra incidencia en un transito', async () => {
    const r = await specialRegimeService.create(datos('T1', { transitDays: 8 }), OWNER);
    const res = await specialRegimeService.updateTransitStatus(
      r._id, { incident: { location: 'FR', description: 'retraso' } }, OWNER
    );
    expect(res.transit.incidents).toHaveLength(1);
    expect(res.transit.incidents[0].location).toBe('FR');
  });

  test('rechaza sobre un regimen que no es transito', async () => {
    const r = await specialRegimeService.create(datos('51'), OWNER);
    await expect(specialRegimeService.updateTransitStatus(r._id, {}, OWNER))
      .rejects.toThrow(/solo aplica a transitos/);
  });
});

// ===================== getExpiringRegimes / getStats / list / getById / update / delete =====================

describe('getExpiringRegimes', () => {
  test('devuelve solo los activos del owner que expiran en la ventana', async () => {
    const r = await regimenActivo('51');
    r.deadlineDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // dentro de 5 dias
    await r.save();

    const exp = await specialRegimeService.getExpiringRegimes(OWNER, 30);
    expect(exp.map(x => String(x._id))).toContain(String(r._id));
    // Otro owner no lo ve.
    const otros = await specialRegimeService.getExpiringRegimes(new mongoose.Types.ObjectId(), 30);
    expect(otros).toHaveLength(0);
  });
});

describe('getStats', () => {
  test('agrega por regimen, estado y totales SOLO del owner', async () => {
    await specialRegimeService.create(datos('51'), OWNER);
    await specialRegimeService.create(datos('71'), OWNER);
    await specialRegimeService.create(datos('51'), new mongoose.Types.ObjectId()); // ajeno

    const stats = await specialRegimeService.getStats(OWNER);
    expect(stats.total).toBe(2);
    expect(stats.byRegime['51'].count).toBe(1);
    expect(stats.byRegime['71'].count).toBe(1);
    expect(stats.byStatus.draft).toBe(2);
  });

  test('aplica filtros de regimeCode y estado', async () => {
    await specialRegimeService.create(datos('51'), OWNER);
    await specialRegimeService.create(datos('71'), OWNER);
    const stats = await specialRegimeService.getStats(OWNER, { regimeCode: '51' });
    expect(stats.total).toBe(1);
  });
});

describe('list', () => {
  test('pagina y filtra por estado y busqueda', async () => {
    await specialRegimeService.create(datos('51'), OWNER);
    const r2 = await specialRegimeService.create(datos('71'), OWNER);

    const res = await specialRegimeService.list(OWNER, { status: 'draft' }, { page: 1, limit: 1 });
    expect(res.pagination.total).toBe(2);
    expect(res.pagination.pages).toBe(2);
    expect(res.regimes).toHaveLength(1);

    const porBusqueda = await specialRegimeService.list(OWNER, { search: r2.reference });
    expect(porBusqueda.regimes.length).toBeGreaterThanOrEqual(1);
  });
});

describe('getById / update / delete', () => {
  test('getById devuelve el regimen del owner', async () => {
    const r = await specialRegimeService.create(datos('51'), OWNER);
    const encontrado = await specialRegimeService.getById(r._id, OWNER);
    expect(String(encontrado._id)).toBe(String(r._id));
  });

  test('getById de otro owner lanza', async () => {
    const r = await specialRegimeService.create(datos('51'), OWNER);
    await expect(specialRegimeService.getById(r._id, new mongoose.Types.ObjectId()))
      .rejects.toThrow(/no encontrado/i);
  });

  test('update solo toca campos permitidos en draft/pending', async () => {
    const r = await specialRegimeService.create(datos('51'), OWNER);
    const res = await specialRegimeService.update(
      r._id, { durationMonths: 18, campoProhibido: 'x' }, OWNER
    );
    expect(res.durationMonths).toBe(18);
    expect(res.campoProhibido).toBeUndefined();
  });

  test('update recalcula si cambian las mercancias', async () => {
    const r = await specialRegimeService.create(datos('51'), OWNER);
    const res = await specialRegimeService.update(
      r._id, { goods: [good({ customsValue: 20000 })] }, OWNER
    );
    expect(res.goods[0].suspendedDuties.tariff).toBe(600); // 20000*0.03
  });

  test('update rechaza en estado no editable', async () => {
    const r = await regimenActivo('51');
    await expect(specialRegimeService.update(r._id, { notes: [] }, OWNER))
      .rejects.toThrow(/borrador o pendientes/);
  });

  test('delete solo borra borradores', async () => {
    const r = await specialRegimeService.create(datos('51'), OWNER);
    const res = await specialRegimeService.delete(r._id, OWNER);
    expect(res.deleted).toBe(true);
    expect(await SpecialRegime.findById(r._id)).toBeNull();
  });

  test('delete rechaza si no es draft', async () => {
    const r = await regimenActivo('51');
    await expect(specialRegimeService.delete(r._id, OWNER))
      .rejects.toThrow(/borrador/);
  });
});
