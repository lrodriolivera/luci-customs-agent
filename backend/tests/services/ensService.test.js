/**
 * ensService — nucleo ICS2 de Declaraciones Sumarias de Entrada (ENS): pre-
 * validacion aduanera, analisis de riesgo, alta/envio/rectificacion/anulacion y
 * notificacion de llegada. Es logica de negocio critica (plazos AEAT, mercancia
 * sensible, paises de riesgo), justo lo que el mandato manda cubrir antes que
 * utilidades triviales.
 *
 * Fronteras y sustituciones (NO se mockea el codigo bajo prueba):
 *  - Mongo REAL en memoria: ENSDeclaration/User/Expedition se usan de verdad, de
 *    modo que save(), los hooks pre('save') (reference/LRN/statusHistory), los
 *    metodos de instancia (validateForSubmission/calculateTotals) y las
 *    agregaciones (getStats) se ejecutan de verdad.
 *  - `ensGenerator` NO se mockea: es un singleton puro que devuelve XML string
 *    sin salir a la red, asi que su ejecucion real es segura y suma cobertura de
 *    integracion.
 *  - La UNICA frontera que se mockea es `aeatSubmitService.submitENS` (red a
 *    AEAT): enviar de verdad presentaria una ENS real. El mandato lo prohibe
 *    ("No pruebes escrituras contra produccion"). Se sustituye SOLO esa funcion.
 *  - `Math.random` en simulateRiskAssessment se fija para hacer deterministas
 *    las ramas de score.
 *
 * jest.config tiene resetMocks:true; los fakes se reinstalan en beforeEach.
 */

const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const ens = require('../../src/services/ensService');
const { ENSDeclaration } = require('../../src/models');
const User = require('../../src/models/User');
const aeatSubmitService = require('../../src/services/aeat/aeatSubmitService');

usarBaseDeDatosEnMemoria();

// Fecha de llegada futura y su fecha "valida" (dentro de plazo para SEA/24h).
const enHoras = (h) => new Date(Date.now() + h * 60 * 60 * 1000);

/**
 * Datos minimos de una ENS que pasa preValidate y validateForSubmission.
 * Llegada dentro de plazo (SEA exige 24h de antelacion -> 48h basta).
 */
function datosENSValidos(overrides = {}) {
  return {
    transportMode: 'SEA',
    entryOffice: { code: 'ES002801', name: 'Algeciras', expectedArrival: enHoras(48) },
    carrier: { eori: 'ESB12345678', name: 'Naviera SL' },
    transportMeans: { identification: 'IMO9999999', identificationType: 'VESSEL_IMO', modeAtBorder: '1' },
    consignment: {
      referenceNumber: 'MBL-001', referenceType: 'MBL', grossMass: 1000,
      numberOfPackages: 10, goodsDescription: 'Mercancia general', countryOfDispatch: 'CN'
    },
    goods: [{ sequenceNumber: 1, description: 'Camisetas', commodityCode: '610910', grossMass: 500, numberOfPackages: 10 }],
    ...overrides
  };
}

// ==================== preValidate (100% puro) ====================

describe('preValidate', () => {
  test('unos datos completos y en plazo pasan sin errores', () => {
    const r = ens.preValidate(datosENSValidos());
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test('sin modo de transporte -> error obligatorio', () => {
    const r = ens.preValidate(datosENSValidos({ transportMode: undefined }));
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.code === 'ENS_TRANSPORT_MODE_REQUIRED')).toBe(true);
  });

  test('EORI de carrier con formato invalido -> error', () => {
    const r = ens.preValidate(datosENSValidos({ carrier: { eori: 'invalido!!' } }));
    expect(r.errors.some(e => e.code === 'ENS_INVALID_EORI')).toBe(true);
  });

  test('aduana de tipo distinto al transporte -> sugerencia (no error)', () => {
    // ES004600 es AIR; transporte SEA -> sugerencia de incoherencia.
    const r = ens.preValidate(datosENSValidos({
      entryOffice: { code: 'ES004600', expectedArrival: enHoras(48) }
    }));
    expect(r.valid).toBe(true); // sugerencia, no error
    expect(r.suggestions.some(s => /es tipo AIR/i.test(s.message))).toBe(true);
  });

  test('presentacion fuera de plazo (llegada demasiado cercana) -> error de deadline', () => {
    // SEA exige 24h de antelacion; llegada en 1h -> ya no da tiempo.
    const r = ens.preValidate(datosENSValidos({
      entryOffice: { code: 'ES002801', expectedArrival: enHoras(1) }
    }));
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.code === 'ENS_DEADLINE_PASSED')).toBe(true);
  });

  test('pais de expedicion de alto riesgo -> sugerencia de control adicional', () => {
    const r = ens.preValidate(datosENSValidos({
      consignment: { ...datosENSValidos().consignment, countryOfDispatch: 'SY' } // Siria
    }));
    expect(r.suggestions.some(s => /riesgo elevado/i.test(s.message))).toBe(true);
  });

  test('mercancia sensible (tabaco 2402) -> sugerencia de control', () => {
    const r = ens.preValidate(datosENSValidos({
      goods: [{ commodityCode: '240220', description: 'Cigarrillos' }]
    }));
    expect(r.suggestions.some(s => /Tabaco/i.test(s.message))).toBe(true);
  });

  test('sin expectedArrival no evalua plazo (no revienta)', () => {
    const r = ens.preValidate({ transportMode: 'ROAD', carrier: { eori: 'ESB12345678' } });
    expect(r.valid).toBe(true);
  });
});

// ==================== simulateRiskAssessment (Math.random fijado) ====================

describe('simulateRiskAssessment', () => {
  let randomSpy;
  afterEach(() => randomSpy && randomSpy.mockRestore());

  test('riesgo bajo -> ACK', () => {
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.9); // no suma el +15
    const r = ens.simulateRiskAssessment({ consignment: { countryOfDispatch: 'DE', grossMass: 100 }, goods: [] });
    expect(r.status).toBe('ACK');
    expect(r.score).toBe(0);
    expect(r.dnl).toBe(false);
  });

  test('pais alto riesgo (40) + peso elevado (10) = 50 -> HOLD', () => {
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.9);
    const r = ens.simulateRiskAssessment({
      consignment: { countryOfDispatch: 'IR', grossMass: 30000 }, goods: []
    });
    expect(r.score).toBe(50);
    expect(r.status).toBe('HOLD');
  });

  test('pais riesgo (40) + 2 mercancias sensibles (40) = 80 -> DNL', () => {
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.9);
    const r = ens.simulateRiskAssessment({
      consignment: { countryOfDispatch: 'KP', grossMass: 100 },
      goods: [{ commodityCode: '930200' }, { commodityCode: '240300' }] // armas + tabaco
    });
    expect(r.score).toBe(80);
    expect(r.status).toBe('DNL');
    expect(r.dnl).toBe(true);
    expect(r.dnlReason).toMatch(/Alto riesgo/i);
  });

  test('nuevo transportista simulado (Math.random<0.1) suma 15', () => {
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.05); // dispara el +15
    const r = ens.simulateRiskAssessment({ consignment: { countryOfDispatch: 'DE', grossMass: 100 }, goods: [] });
    expect(r.score).toBe(15);
    expect(r.status).toBe('ACK');
  });

  test('score se topa en 100', () => {
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.05);
    const r = ens.simulateRiskAssessment({
      consignment: { countryOfDispatch: 'AF', grossMass: 30000 },
      goods: [{ commodityCode: '930200' }, { commodityCode: '930300' }, { commodityCode: '240200' }]
    }); // 40 + 60 + 10 + 15 = 125 -> topado a 100
    expect(r.score).toBe(100);
  });
});

// ==================== helpers puros ====================

describe('helpers de configuracion', () => {
  test('getEntryOffices sin filtro devuelve todas con su codigo', () => {
    const all = ens.getEntryOffices();
    expect(all.length).toBe(10);
    expect(all[0]).toHaveProperty('code');
    expect(all[0]).toHaveProperty('type');
  });

  test('getEntryOffices filtra por modo de transporte', () => {
    const sea = ens.getEntryOffices('SEA');
    expect(sea.length).toBe(4);
    expect(sea.every(o => o.type === 'SEA')).toBe(true);
  });

  test('getSubmissionDeadlines devuelve los plazos por modo', () => {
    expect(ens.getSubmissionDeadlines()).toEqual({ ROAD: 1, RAIL: 2, AIR: 4, SEA: 24 });
  });

  test('generateMRN produce un MRN con el formato AAES...XX', () => {
    const mrn = ens.generateMRN('ENS');
    expect(mrn).toMatch(/^\d{2}ES\d{14}EN$/);
  });
});

// ==================== validateDeclaration (combina ambas validaciones) ====================

describe('validateDeclaration', () => {
  test('datos validos -> valid=true', async () => {
    const r = await ens.validateDeclaration(datosENSValidos());
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test('datos incompletos -> agrega errores de schema y de pre-validacion', async () => {
    const r = await ens.validateDeclaration({ transportMode: 'ROAD' });
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

// ==================== createDeclaration (Mongo real) ====================

describe('createDeclaration', () => {
  let userId;
  beforeEach(async () => {
    const u = await User.create({ email: 'op@luci.es', name: 'Operador', password: 'x'.repeat(60) });
    userId = u._id;
  });

  test('crea una ENS valida, autocompleta transportMeans/LRN y persiste', async () => {
    const data = datosENSValidos();
    delete data.transportMeans; // el servicio debe completarlo
    // identification se autocompleta desde carrier.vehicleId (rama del servicio);
    // sin el, validateForSubmission exigiria transportMeans.identification.
    data.carrier.vehicleId = 'IMO9999999';
    delete data.goods[0].commodityCode; // se completa desde taricCode/000000
    data.goods[0].taricCode = '850760';

    const r = await ens.createDeclaration(data, userId);

    expect(r.success).toBe(true);
    expect(r.data.lrn).toMatch(/^LUCI/);
    expect(r.data.transportMeans.modeAtBorder).toBe('1');          // SEA -> '1'
    expect(r.data.transportMeans.identificationType).toBe('VESSEL_IMO');
    expect(r.data.transportMeans.identification).toBe('IMO9999999'); // desde vehicleId
    expect(r.data.goods[0].commodityCode).toBe('850760');          // desde taricCode
    expect(r.data.reference).toMatch(/^ENS-\d{4}-\d{6}$/);          // hook pre-save
    // realmente guardada
    expect(await ENSDeclaration.countDocuments()).toBe(1);
  });

  test('datos que no pasan preValidate -> success:false con errores, sin guardar', async () => {
    const r = await ens.createDeclaration({ carrier: { eori: 'malo!!' } }, userId);
    expect(r.success).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(await ENSDeclaration.countDocuments()).toBe(0);
  });

  test('valida para envio y rechaza si falta info y no se permite draft', async () => {
    // pasa preValidate pero le falta consignment completo -> validateForSubmission falla
    const data = {
      transportMode: 'ROAD',
      entryOffice: { code: 'ES003001', expectedArrival: enHoras(48) },
      carrier: { eori: 'ESB12345678', name: 'Trans SL' },
      // sin consignment ni goods
    };
    const r = await ens.createDeclaration(data, userId);
    expect(r.success).toBe(false);
    expect(r.errors.some(e => e.code === 'ENS_GOODS_REQUIRED')).toBe(true);
  });

  test('allowDraft permite guardar aunque validateForSubmission falle', async () => {
    const data = {
      transportMode: 'ROAD',
      entryOffice: { code: 'ES003001', expectedArrival: enHoras(48) },
      carrier: { eori: 'ESB12345678', name: 'Trans SL' },
      transportMeans: { identification: 'CAM-1234', identificationType: 'VEHICLE_REGISTRATION', modeAtBorder: '3' },
      consignment: {
        referenceNumber: 'CMR-1', grossMass: 500, numberOfPackages: 5,
        goodsDescription: 'Palets'
      },
      goods: [{ sequenceNumber: 1, description: 'Cajas', commodityCode: '440320', grossMass: 500 }],
      allowDraft: true
    };
    const r = await ens.createDeclaration(data, userId);
    expect(r.success).toBe(true);
    expect(r.data.status).toBe('draft');
  });
});

// ==================== submitToAEAT (mock SOLO submitENS) ====================

describe('submitToAEAT', () => {
  let userId, declId;
  beforeEach(async () => {
    const u = await User.create({ email: 'op2@luci.es', name: 'Op', password: 'x'.repeat(60) });
    userId = u._id;
    const created = await ens.createDeclaration(datosENSValidos(), userId);
    declId = created.data._id;
    // Reinstalar el fake de la frontera (resetMocks lo borra entre tests).
    aeatSubmitService.submitENS = jest.fn();
  });

  test('AEAT acepta -> estado accepted, MRN, riskAssessment ACK', async () => {
    aeatSubmitService.submitENS.mockResolvedValue({
      success: true, mrn: '26ES00112233445566EN', code: 'AC', estado: 'ACEPTADA', csv: 'CSV123'
    });
    const r = await ens.submitToAEAT(declId, userId);
    expect(r.success).toBe(true);
    expect(r.data.mrn).toBe('26ES00112233445566EN');
    expect(r.data.status).toBe('accepted');
    expect(r.data.riskAssessment.status).toBe('ACK');
    // persistido
    const doc = await ENSDeclaration.findById(declId);
    expect(doc.status).toBe('accepted');
  });

  test('AEAT rechaza -> success:false, no cambia a submitted', async () => {
    aeatSubmitService.submitENS.mockResolvedValue({ success: false, code: 'RC', error: 'Datos incorrectos' });
    const r = await ens.submitToAEAT(declId, userId);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Datos incorrectos/);
    const doc = await ENSDeclaration.findById(declId);
    expect(doc.status).toBe('draft'); // no avanzo
  });

  test('otro usuario no puede enviar la declaracion ajena (owner check)', async () => {
    const otro = await User.create({ email: 'ajeno@luci.es', name: 'Ajeno', password: 'x'.repeat(60) });
    await expect(ens.submitToAEAT(declId, otro._id)).rejects.toThrow(/no encontrada/i);
    expect(aeatSubmitService.submitENS).not.toHaveBeenCalled();
  });

  test('no se puede enviar una declaracion ya enviada', async () => {
    await ENSDeclaration.findByIdAndUpdate(declId, { status: 'submitted' });
    await expect(ens.submitToAEAT(declId, userId)).rejects.toThrow(/No se puede enviar/i);
  });
});

// ==================== amend / cancel / notifyArrival / processRiskResponse ====================

describe('ciclo de vida sobre Mongo real', () => {
  let userId;
  beforeEach(async () => {
    const u = await User.create({ email: 'ciclo@luci.es', name: 'Ciclo', password: 'x'.repeat(60) });
    userId = u._id;
  });

  async function crearAceptada() {
    const created = await ens.createDeclaration(datosENSValidos(), userId);
    const doc = await ENSDeclaration.findById(created.data._id);
    doc.status = 'accepted';
    doc.mrn = '26ES00000000000001EN';
    doc.riskAssessment = { status: 'ACK' };
    await doc.save();
    return doc._id;
  }

  test('amendDeclaration rectifica una aceptada, genera XML y queda amended', async () => {
    const id = await crearAceptada();
    const r = await ens.amendDeclaration(id, {
      reason: 'Correccion peso', details: 'grossMass corregido',
      consignment: { referenceNumber: 'MBL-001', grossMass: 1200, numberOfPackages: 12, goodsDescription: 'Mercancia' }
    }, userId);
    expect(r.success).toBe(true);
    expect(r.data.status).toBe('amended');
    expect(r.data.amendment.originalMRN).toBe('26ES00000000000001EN');
    expect(r.data.generatedXML).toBeTruthy();
  });

  test('amendDeclaration rechaza estados no rectificables', async () => {
    const created = await ens.createDeclaration(datosENSValidos(), userId); // draft
    await expect(
      ens.amendDeclaration(created.data._id, { reason: 'x' }, userId)
    ).rejects.toThrow(/No se puede rectificar/i);
  });

  test('cancelDeclaration anula un draft (sin MRN, sin XML de anulacion)', async () => {
    const created = await ens.createDeclaration(datosENSValidos(), userId);
    const r = await ens.cancelDeclaration(created.data._id, 'Cliente cancelo', userId);
    expect(r.success).toBe(true);
    expect(r.data.status).toBe('cancelled');
  });

  test('cancelDeclaration de una con MRN genera XML de anulacion', async () => {
    const id = await crearAceptada();
    const r = await ens.cancelDeclaration(id, 'Error', userId);
    expect(r.data.status).toBe('cancelled');
    expect(r.data.generatedXML).toBeTruthy(); // XML de anulacion
  });

  test('cancelDeclaration rechaza estados no anulables', async () => {
    const id = await crearAceptada();
    await ENSDeclaration.findByIdAndUpdate(id, { status: 'cancelled' });
    await expect(ens.cancelDeclaration(id, 'x', userId)).rejects.toThrow(/No se puede anular/i);
  });

  test('notifyArrival sobre una ACK dispara levante automatico (released)', async () => {
    const id = await crearAceptada();
    const r = await ens.notifyArrival(id, { unloadingPlace: 'Muelle 3' }, userId);
    expect(r.data.status).toBe('released'); // riskAssessment ACK -> levante auto
    expect(r.data.arrival.unloadingPlace).toBe('Muelle 3');
  });

  test('notifyArrival rechaza estados que no admiten llegada', async () => {
    const created = await ens.createDeclaration(datosENSValidos(), userId); // draft
    await expect(
      ens.notifyArrival(created.data._id, {}, userId)
    ).rejects.toThrow(/No se puede notificar llegada/i);
  });

  test('processRiskResponse DNL marca la declaracion como dnl', async () => {
    const id = await crearAceptada();
    const mrn = (await ENSDeclaration.findById(id)).mrn;
    const r = await ens.processRiskResponse(mrn, {
      status: 'DNL', riskScore: 85, dnl: true, dnlReason: 'Alto riesgo',
      controlDecisions: [{ code: 'X10', description: 'Inspeccion fisica', deadline: enHoras(24) }]
    });
    expect(r.success).toBe(true);
    expect(r.data.status).toBe('dnl');
    expect(r.data.riskAssessment.doNotLoadList).toBe(true);
    expect(r.data.riskAssessment.controlDecisions).toHaveLength(1);
  });

  test('processRiskResponse con MRN inexistente devuelve error controlado', async () => {
    const r = await ens.processRiskResponse('NO-EXISTE', { status: 'ACK' });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });
});

// ==================== busquedas y estadisticas ====================

describe('busquedas y stats', () => {
  let userId;
  beforeEach(async () => {
    const u = await User.create({ email: 'busq@luci.es', name: 'Busq', password: 'x'.repeat(60) });
    userId = u._id;
    const data = datosENSValidos({
      consignment: { ...datosENSValidos().consignment, containerNumber: 'MSKU1234567', referenceNumber: 'MBL-ABC-99' }
    });
    await ens.createDeclaration(data, userId);
  });

  test('getByContainer encuentra por numero de contenedor (parcial)', async () => {
    const r = await ens.getByContainer('MSKU', userId);
    expect(r.success).toBe(true);
    expect(r.count).toBe(1);
  });

  test('getByBillOfLading encuentra por referencia del envio', async () => {
    const r = await ens.getByBillOfLading('ABC-99', userId);
    expect(r.count).toBe(1);
  });

  test('getStats agrega por estado y totales', async () => {
    const r = await ens.getStats();
    expect(r.totals.declarations).toBe(1);
    expect(r.byStatus.length).toBeGreaterThan(0);
  });
});

// ==================== processBatch ====================

describe('processBatch', () => {
  let userId;
  beforeEach(async () => {
    const u = await User.create({ email: 'batch@luci.es', name: 'Batch', password: 'x'.repeat(60) });
    userId = u._id;
  });

  test('procesa un lote: cuenta exitos y fallos por linea', async () => {
    const declaraciones = [
      datosENSValidos(),                                  // OK
      { transportMode: 'ROAD', carrier: { eori: 'malo!!' } } // falla preValidate
    ];
    const r = await ens.processBatch(declaraciones, userId);
    expect(r.total).toBe(2);
    expect(r.successful).toBe(1);
    expect(r.failed).toBe(1);
    expect(r.batchId).toMatch(/^ENSBATCH-/);
    expect(r.declarations[1].status).toBe('failed');
  });

  test('autoSubmit envia las creadas y anota el MRN', async () => {
    aeatSubmitService.submitENS = jest.fn().mockResolvedValue({
      success: true, mrn: '26ES99999999999999EN', code: 'AC'
    });
    const r = await ens.processBatch([datosENSValidos()], userId, { autoSubmit: true });
    expect(r.successful).toBe(1);
    expect(r.declarations[0].mrn).toBe('26ES99999999999999EN');
    expect(r.declarations[0].status).toBe('submitted');
  });
});
