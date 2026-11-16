/**
 * Datos del expediente que solo se usan para presentar el H1 y comprobación de
 * lo que falta antes de enviarlo.
 */
const express = require('express');
const request = require('supertest');

const mockExpedition = { findById: jest.fn() };
const mockTenant = { findById: jest.fn() };
const mockPreparar = jest.fn();

jest.mock('../../src/models', () => ({ Expedition: mockExpedition, ChatMessage: { find: jest.fn() } }));
jest.mock('../../src/models/Tenant', () => mockTenant);
jest.mock('../../src/services/aeat/aeatSubmitService', () => ({
  servicioH1: (tenant) => (tenant?.customsConfig?.h1Service === 'cau' ? 'cau' : 'precau'),
  prepararH1Cau: (...a) => mockPreparar(...a)
}));
jest.mock('../../src/services/aiService', () => ({}));
const mockTipoOficial = jest.fn();
const tipoSoloUsd = async (d) => (d === 'USD' ? { divisa: 'USD', tipo: 1.1234 } : null);
jest.mock('../../src/services/divisas/tiposCambioOficiales', () => ({
  tipoOficial: (...a) => mockTipoOficial(...a),
  aEuros: jest.requireActual('../../src/services/divisas/tipoCambioAduanero').aEuros
}));
jest.mock('../../src/services/channelService', () => ({}));
jest.mock('../../src/services/emailService', () => ({}));
jest.mock('../../src/services/customs', () => ({ CustomsServiceFactory: {} }));

const declarationController = require('../../src/controllers/declarationController');
const { ErrorValidacion } = require('../../src/services/forms/identificadorAduanero');

const USER = { _id: 'u1', name: 'Tester', tenantId: 't1' };

function expediente(extra = {}) {
  const exp = {
    _id: 'e1', tenantId: 't1', transport: { vehicleId: 'MSC AURORA', summaryDeclaration: { number: '28016000001' } },
    representative: { representationType: 'indirect' },
    save: jest.fn().mockResolvedValue(true),
    ...extra
  };
  // Como Mongoose: asigna por ruta sin tocar el resto del subdocumento.
  exp.set = jest.fn((ruta, valor) => {
    const partes = ruta.split('.');
    const ultimo = partes.pop();
    partes.reduce((o, p) => (o[p] = o[p] || {}), exp)[ultimo] = valor;
  });
  return exp;
}
function app() {
  const a = express();
  a.use(express.json());
  const usuario = (req, _res, next) => { req.user = USER; req.tenantId = USER.tenantId; next(); };
  a.get('/api/declarations/:expeditionId/h1/requisitos', usuario, declarationController.getH1Requirements);
  a.put('/api/declarations/:expeditionId/h1/datos', usuario, declarationController.updateH1Data);
  return a;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTipoOficial.mockImplementation(tipoSoloUsd);
  mockTenant.findById.mockReturnValue({ lean: async () => ({ customsConfig: { h1Service: 'cau' } }) });
});

describe('requisitos del H1', () => {
  test('dice qué falta sin enviar nada', async () => {
    const error = new ErrorValidacion('Faltan datos', { code: 'DATOS_H1_FALTANTES' });
    error.faltan = ['número de la factura comercial', 'nacionalidad del medio de transporte en frontera'];
    mockPreparar.mockRejectedValue(error);
    mockExpedition.findById.mockResolvedValue(expediente());

    const res = await request(app()).get('/api/declarations/e1/h1/requisitos');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      servicio: 'cau', listo: false, faltan: error.faltan,
      datos: {
        invoiceNumber: '', exporterPostalCode: '', vehicleNationality: '', dispatchAuthorizationScope: 'global', paymentMethod: '',
        incoterm: '', gastosASumar: null,
        freightAmount: null, freightCurrency: 'EUR', insuranceAmount: null, insuranceCurrency: 'EUR',
        transporteTrasLaEntrada: null, freightAfterEntryAmount: null, freightAfterEntryCurrency: 'EUR',
        otherAdjustments: [], codigosDeAjuste: expect.objectContaining({ AB: expect.any(String), AI: expect.any(String), BF: expect.any(String) }),
        vatAdditions: [], conceptosBaseIva: expect.objectContaining({ THC: expect.any(String), T3: expect.any(String) }),
        invoiceCurrency: 'EUR', invoiceCurrencyWithoutBce: false, appliedExchangeRate: null,
        procedure: '4000', additionalProcedure: ''
      },
      anulacion: { presentada: false, anulable: false },
      liquidacionAeat: null,
      predeclaracion: null,
      avisos: []
    });
  });

  test('avisa si la aduana elegida no es la del recinto aunque falten datos', async () => {
    const error = new ErrorValidacion('Faltan datos', { code: 'DATOS_H1_FALTANTES' });
    error.faltan = ['número de la factura comercial'];
    mockPreparar.mockRejectedValue(error);
    mockExpedition.findById.mockResolvedValue(expediente({ declaration: { goodsLocation: 'ES00280123AAAA', customsOffice: 'ES003001' } }));

    const res = await request(app()).get('/api/declarations/e1/h1/requisitos');

    expect(res.status).toBe(200);
    expect(res.body.data.listo).toBe(false);
    expect(res.body.data.avisos).toEqual([expect.objectContaining({
      codigo: 'ADUANA_DISTINTA_DEL_RECINTO', elegida: 'ES003001', recinto: 'ES002801',
      texto: expect.stringContaining('el H1 se presentará en ES002801')
    })]);
  });

  test('con todo completo está listo', async () => {
    mockPreparar.mockResolvedValue({ requestXML: '<x/>' });
    mockExpedition.findById.mockResolvedValue(expediente({ invoiceNumber: 'FAC-1' }));

    const res = await request(app()).get('/api/declarations/e1/h1/requisitos');

    expect(res.body.data).toMatchObject({ listo: true, faltan: [], datos: { invoiceNumber: 'FAC-1' } });
  });

  test('otro fallo (EORI, divisa) también se devuelve como pendiente', async () => {
    mockPreparar.mockRejectedValue(new ErrorValidacion('Falta el EORI del representante: configúralo en Ajustes > Aduanas'));
    mockExpedition.findById.mockResolvedValue(expediente());

    const res = await request(app()).get('/api/declarations/e1/h1/requisitos');

    expect(res.body.data.faltan).toEqual(['Falta el EORI del representante: configúralo en Ajustes > Aduanas']);
  });
});

describe('datos del H1 en el expediente', () => {
  test('guarda solo esos campos y deja intacto el resto del transporte y del representante', async () => {
    const exp = expediente();
    mockExpedition.findById.mockResolvedValue(exp);

    const res = await request(app()).put('/api/declarations/e1/h1/datos')
      .send({ invoiceNumber: ' FAC-2026-118 ', exporterPostalCode: ' 200000 ', vehicleNationality: 'pa', dispatchAuthorizationScope: 'global' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ invoiceNumber: 'FAC-2026-118', exporterPostalCode: '200000', vehicleNationality: 'PA', dispatchAuthorizationScope: 'global' });
    expect(exp.exporter).toEqual({ postalCode: '200000' });
    expect(exp.transport).toEqual({ vehicleId: 'MSC AURORA', summaryDeclaration: { number: '28016000001' }, vehicleNationality: 'PA' });
    expect(exp.representative).toEqual({ representationType: 'indirect', dispatchAuthorizationScope: 'global' });
    expect(exp.save).toHaveBeenCalled();
  });

  test('rechaza valores no válidos sin guardar', async () => {
    const exp = expediente();
    mockExpedition.findById.mockResolvedValue(exp);

    const res = await request(app()).put('/api/declarations/e1/h1/datos')
      .send({ vehicleNationality: 'ESP', dispatchAuthorizationScope: 'G' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('dos letras');
    expect(res.body.error).toContain('autorización de despacho');
    expect(exp.save).not.toHaveBeenCalled();
  });
});

describe('régimen y régimen adicional del H1 (catálogo oficial)', () => {
  test('guarda una combinación con precedente: 40.71 queda como 40 + 71', async () => {
    const exp = expediente({ declaration: { regime: '40', additionalProcedure: '000' } });
    mockExpedition.findById.mockResolvedValue(exp);

    const res = await request(app()).put('/api/declarations/e1/h1/datos').send({ procedure: '40.71' });

    expect(res.status).toBe(200);
    expect(exp.declaration).toMatchObject({ regime: '40', previousRegime: '71' });
    expect(res.body.data).toMatchObject({ procedure: '4071', additionalProcedure: '' });
  });

  test('lo guardado antes (solo «40») se lee como 40.00', async () => {
    mockPreparar.mockResolvedValue({ requestXML: '<x/>' });
    mockExpedition.findById.mockResolvedValue(expediente({ declaration: { regime: '40', additionalProcedure: '000' } }));

    const res = await request(app()).get('/api/declarations/e1/h1/requisitos');

    expect(res.body.data.datos).toMatchObject({ procedure: '4000', additionalProcedure: '' });
  });

  test('guarda un régimen adicional del catálogo en mayúsculas; vacío lo quita', async () => {
    const exp = expediente({ declaration: { regime: '40' } });
    mockExpedition.findById.mockResolvedValue(exp);

    const res = await request(app()).put('/api/declarations/e1/h1/datos').send({ additionalProcedure: 'c08' });
    expect(res.status).toBe(200);
    expect(exp.declaration.additionalProcedure).toBe('C08');
    expect(res.body.data.additionalProcedure).toBe('C08');

    await request(app()).put('/api/declarations/e1/h1/datos').send({ additionalProcedure: '' });
    expect(exp.declaration.additionalProcedure).toBe('000');
  });

  test('rechaza con 400 un régimen o un adicional que no está en el catálogo, sin guardar', async () => {
    const exp = expediente({ declaration: { regime: '40' } });
    mockExpedition.findById.mockResolvedValue(exp);

    const res = await request(app()).put('/api/declarations/e1/h1/datos').send({ procedure: '4099', additionalProcedure: 'ZZZ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/40\.99 no está entre las combinaciones admitidas en el H1/);
    expect(res.body.error).toMatch(/ZZZ no está en la lista oficial/);
    expect(exp.save).not.toHaveBeenCalled();
    expect(exp.declaration).toEqual({ regime: '40' });
  });

  test('rechaza un régimen que no es texto', async () => {
    mockExpedition.findById.mockResolvedValue(expediente());
    const res = await request(app()).put('/api/declarations/e1/h1/datos').send({ procedure: { $gt: '' } });
    expect(res.status).toBe(400);
  });
});

describe('catálogo del régimen para el H1 (solo lectura)', () => {
  test('devuelve combinaciones, adicionales y fuentes', async () => {
    const a = express();
    a.get('/api/declarations/h1/catalogo-regimenes', declarationController.getH1RegimeCatalog);

    const res = await request(a).get('/api/declarations/h1/catalogo-regimenes');

    expect(res.status).toBe(200);
    expect(res.body.data.combinaciones).toEqual(expect.arrayContaining([
      expect.objectContaining({ codigo: '4000', descripcion: 'Despacho a libre práctica con despacho simultáneo a consumo de mercancías' })
    ]));
    expect(res.body.data.adicionales.length).toBeGreaterThan(100);
  });
});

describe('forma de pago del expediente', () => {
  test('guarda A o R en el expediente; vacío vuelve a la de Ajustes', async () => {
    const exp = expediente();
    mockExpedition.findById.mockResolvedValue(exp);
    const res = await request(app()).put('/api/declarations/e1/h1/datos').send({ paymentMethod: 'R' });
    expect(res.status).toBe(200);
    expect(exp.declaration.paymentMethod).toBe('R');
    expect(res.body.data.paymentMethod).toBe('R');
  });

  test('rechaza una forma de pago que no es A ni R', async () => {
    const exp = expediente();
    mockExpedition.findById.mockResolvedValue(exp);
    const res = await request(app()).put('/api/declarations/e1/h1/datos').send({ paymentMethod: 'Z' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Forma de pago no válida');
    expect(exp.save).not.toHaveBeenCalled();
  });
});

describe('flete y seguro hasta la entrada en la UE', () => {
  test('guarda importe y divisa de cada uno y dice qué hay que sumar según el incoterm', async () => {
    const exp = expediente({ incoterm: { code: 'FOB', place: 'Shanghai' } });
    mockExpedition.findById.mockResolvedValue(exp);

    const res = await request(app()).put('/api/declarations/e1/h1/datos')
      .send({ freightAmount: '1123.40', freightCurrency: 'usd', insuranceAmount: 0, insuranceCurrency: 'EUR' });

    expect(res.status).toBe(200);
    expect(exp.costs).toEqual({ freight: { amount: 1123.4, currency: 'USD' }, insurance: { amount: 0, currency: 'EUR' } });
    expect(res.body.data).toMatchObject({
      incoterm: 'FOB', gastosASumar: { flete: true, seguro: true },
      freightAmount: 1123.4, freightCurrency: 'USD', insuranceAmount: 0, insuranceCurrency: 'EUR'
    });
  });

  test('vaciar el importe lo borra (no es lo mismo que 0)', async () => {
    const exp = expediente({ costs: { freight: { amount: 500, currency: 'EUR' } } });
    mockExpedition.findById.mockResolvedValue(exp);

    const res = await request(app()).put('/api/declarations/e1/h1/datos').send({ freightAmount: '' });

    expect(res.status).toBe(200);
    expect(exp.costs.freight).toEqual({ amount: null, currency: 'EUR' });
    expect(res.body.data.freightAmount).toBeNull();
  });

  test('rechaza importes negativos o no numéricos y divisas mal escritas', async () => {
    const exp = expediente();
    mockExpedition.findById.mockResolvedValue(exp);

    const res = await request(app()).put('/api/declarations/e1/h1/datos')
      .send({ freightAmount: -5, insuranceAmount: 'mucho', freightCurrency: 'DOLAR' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('flete');
    expect(res.body.error).toContain('seguro');
    expect(res.body.error).toContain('divisa');
    expect(exp.save).not.toHaveBeenCalled();
  });
});

describe('transporte después de la entrada en la UE (BA) y otros ajustes', () => {
  test('DAP: guarda el transporte interior y dice que es obligatorio', async () => {
    const exp = expediente({ incoterm: { code: 'DAP', place: 'Madrid' } });
    mockExpedition.findById.mockResolvedValue(exp);

    const res = await request(app()).put('/api/declarations/e1/h1/datos').send({ freightAfterEntryAmount: '350,5', freightAfterEntryCurrency: 'usd' });

    expect(res.status).toBe(200);
    expect(exp.costs).toEqual({ freightAfterEntry: { amount: 350.5, currency: 'USD' } });
    expect(res.body.data).toMatchObject({ incoterm: 'DAP', transporteTrasLaEntrada: 'exigir', freightAfterEntryAmount: 350.5, freightAfterEntryCurrency: 'USD' });
  });

  test('un importe sin divisa se guarda en euros', async () => {
    const exp = expediente({ incoterm: { code: 'CPT' } });
    mockExpedition.findById.mockResolvedValue(exp);

    const res = await request(app()).put('/api/declarations/e1/h1/datos').send({ freightAfterEntryAmount: 0 });

    expect(res.status).toBe(200);
    expect(exp.costs.freightAfterEntry).toEqual({ amount: 0, currency: 'EUR' });
    expect(res.body.data.transporteTrasLaEntrada).toBe('admitir');
  });

  test('guarda los ajustes opcionales (código, importe y divisa) y los devuelve', async () => {
    const exp = expediente();
    mockExpedition.findById.mockResolvedValue(exp);

    const res = await request(app()).put('/api/declarations/e1/h1/datos')
      .send({ otherAdjustments: [{ code: 'ai', amount: '1200', currency: 'usd' }, { code: 'BF', amount: 50 }] });

    expect(res.status).toBe(200);
    expect(exp.costs.otherAdjustments).toEqual([{ code: 'AI', amount: 1200, currency: 'USD' }, { code: 'BF', amount: 50, currency: 'EUR' }]);
    expect(res.body.data.otherAdjustments).toEqual([{ code: 'AI', amount: 1200, currency: 'USD' }, { code: 'BF', amount: 50, currency: 'EUR' }]);
  });

  test('rechaza códigos que LUCI calcula o que no existen, importes malos y listas enormes', async () => {
    const exp = expediente();
    mockExpedition.findById.mockResolvedValue(exp);

    const malos = [
      { otherAdjustments: [{ code: 'BA', amount: 1 }] },
      { otherAdjustments: [{ code: 'ZZ', amount: 1 }] },
      { otherAdjustments: [{ code: 'AB', amount: -1 }] },
      { otherAdjustments: [{ code: 'AB', amount: 1, currency: 'DOLAR' }] },
      { otherAdjustments: 'AB' },
      { otherAdjustments: Array.from({ length: 100 }, () => ({ code: 'AB', amount: 1 })) },
      { freightAfterEntryAmount: 'mucho' }
    ];
    for (const body of malos) {
      const res = await request(app()).put('/api/declarations/e1/h1/datos').send(body);
      expect(res.status).toBe(400);
    }
    expect(exp.save).not.toHaveBeenCalled();
  });
});

describe('cambio aplicado de una divisa que el BCE no cotiza', () => {
  const enDirhams = (extra = {}) => expediente({ goods: [{ currency: 'MAD', invoiceValue: 100000 }], ...extra });

  test('los requisitos dicen que la divisa no tiene tipo del BCE y el cambio guardado', async () => {
    mockPreparar.mockResolvedValue({ requestXML: '<x/>' });
    mockExpedition.findById.mockResolvedValue(enDirhams({ appliedExchangeRate: { currency: 'MAD', rate: 10.8 } }));

    const res = await request(app()).get('/api/declarations/e1/h1/requisitos');

    expect(res.body.data.datos).toMatchObject({ invoiceCurrency: 'MAD', invoiceCurrencyWithoutBce: true, appliedExchangeRate: 10.8 });
  });

  test('con una divisa del BCE no se pide cambio aplicado', async () => {
    mockPreparar.mockResolvedValue({ requestXML: '<x/>' });
    mockExpedition.findById.mockResolvedValue(expediente({ goods: [{ currency: 'USD' }] }));

    const res = await request(app()).get('/api/declarations/e1/h1/requisitos');

    expect(res.body.data.datos).toMatchObject({ invoiceCurrency: 'USD', invoiceCurrencyWithoutBce: false, appliedExchangeRate: null });
  });

  test('guarda el cambio aplicado con la divisa de la factura', async () => {
    const exp = enDirhams();
    mockExpedition.findById.mockResolvedValue(exp);

    const res = await request(app()).put('/api/declarations/e1/h1/datos').send({ appliedExchangeRate: '10,8' });

    expect(res.status).toBe(200);
    expect(exp.appliedExchangeRate).toEqual({ currency: 'MAD', rate: 10.8 });
    expect(res.body.data).toMatchObject({ invoiceCurrencyWithoutBce: true, appliedExchangeRate: 10.8 });
  });

  test('vaciarlo lo borra; cero, negativo o texto se rechaza', async () => {
    const exp = enDirhams({ appliedExchangeRate: { currency: 'MAD', rate: 10.8 } });
    mockExpedition.findById.mockResolvedValue(exp);
    expect((await request(app()).put('/api/declarations/e1/h1/datos').send({ appliedExchangeRate: '' })).status).toBe(200);
    expect(exp.appliedExchangeRate).toBeNull();

    for (const malo of [0, -3, 'mucho']) {
      const res = await request(app()).put('/api/declarations/e1/h1/datos').send({ appliedExchangeRate: malo });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('cambio aplicado');
    }
  });
});

describe('predeclaración en los requisitos', () => {
  test('dice el modo, el número de registro y que está pendiente de activar', async () => {
    mockPreparar.mockResolvedValue({ requestXML: '<x/>' });
    mockExpedition.findById.mockResolvedValue(expediente({ declaration: {
      mrn: '26ES009999I00270R1', predeclaracion: { modo: 'Operador', numeroRegistro: '26ES009999I00270R1' },
      aeatResponse: { servicio: 'CC415AV1', responseCode: '63' }
    } }));

    const res = await request(app()).get('/api/declarations/e1/h1/requisitos');

    expect(res.body.data.predeclaracion).toEqual({ modo: 'Operador', numeroRegistro: '26ES009999I00270R1', pendiente: true, activadaEn: null });
    // Pendiente de activar también se puede anular por servicio.
    expect(res.body.data.anulacion).toEqual({ presentada: true, anulable: true });
  });
});

describe('si la declaración presentada se puede anular por servicio', () => {
  const presentada = (aeatResponse) => expediente({ declaration: { mrn: '26ES002801I01BMVR2', aeatResponse } });

  test('una declaración activada (64) no: la anula la aduana', async () => {
    mockPreparar.mockResolvedValue({ requestXML: '<x/>' });
    mockExpedition.findById.mockResolvedValue(presentada({ servicio: 'CC415AV1', responseCode: '64' }));

    const res = await request(app()).get('/api/declarations/e1/h1/requisitos');

    expect(res.body.data.anulacion).toEqual({ presentada: true, anulable: false });
  });

  test('una predeclaración (60) sí; manda el estado de la última consulta', async () => {
    mockPreparar.mockResolvedValue({ requestXML: '<x/>' });
    mockExpedition.findById.mockResolvedValue(presentada({ servicio: 'CC415AV1', responseCode: '64', consulta: { estado: { operacionRegistrada: '60' } } }));

    const res = await request(app()).get('/api/declarations/e1/h1/requisitos');

    expect(res.body.data.anulacion).toEqual({ presentada: true, anulable: true });
  });

  test('sin presentar por el servicio CAU no hay nada que anular', async () => {
    mockPreparar.mockResolvedValue({ requestXML: '<x/>' });
    mockExpedition.findById.mockResolvedValue(expediente());

    const res = await request(app()).get('/api/declarations/e1/h1/requisitos');

    expect(res.body.data.anulacion).toEqual({ presentada: false, anulable: false });
  });
});

describe('liquidación de la AEAT frente a la de LUCI', () => {
  const XML = '<x:Env xmlns:x="s"><GoodsShipment><GoodsShipmentItem><sequenceNumber>1</sequenceNumber><Commodity><CalculationOfTaxes>'
    + '<DutiesAndTaxes><taxType>A00</taxType><TaxBase><amount>9951.55</amount><taxAmount>1194.19</taxAmount></TaxBase></DutiesAndTaxes>'
    + '<DutiesAndTaxes><taxType>B00</taxType><TaxBase><amount>11145.74</amount><taxAmount>2340.61</taxAmount></TaxBase></DutiesAndTaxes>'
    + '</CalculationOfTaxes></Commodity></GoodsShipmentItem></GoodsShipment></x:Env>';
  const LIQ = (a00) => ({ totalAPagar: a00 + 2340.61, partidas: [{ numero: 1, tributos: [
    { tipo: 'A00', bases: [{ importe: 9951.55, cuota: a00 }] }, { tipo: 'B00', bases: [{ importe: 11145.74, cuota: 2340.61 }] }
  ] }] });
  const CERT = { requeridos: 'S', partidas: [{ numero: 1, organismos: [{ organismo: 'SIF01', nombre: 'SOIVRE Mº Comercio', medidas: [{ medida: 'COM', documentos: ['1310'] }] }] }] };
  const presentada = (aeatResponse) => expediente({ declaration: { mrn: 'M1', cauEnvio: { requestXML: XML }, aeatResponse: { servicio: 'CC415AV1', responseCode: '64', ...aeatResponse } } });

  test('compara lo declarado con lo que liquidó la AEAT al presentar y da sus certificados', async () => {
    mockPreparar.mockResolvedValue({ requestXML: '<x/>' });
    mockExpedition.findById.mockResolvedValue(presentada({ liquidacion: LIQ(1194.19), certificados: CERT }));

    const res = await request(app()).get('/api/declarations/e1/h1/requisitos');

    expect(res.body.data.liquidacionAeat).toMatchObject({
      fuente: 'presentacion', certificados: CERT,
      comparacion: { cuadra: true, totalLuci: 3534.8, totalAeat: 3534.8, diferencia: 0 }
    });
  });

  test('si hay una consulta con liquidación por partida, manda la consulta', async () => {
    mockPreparar.mockResolvedValue({ requestXML: '<x/>' });
    mockExpedition.findById.mockResolvedValue(presentada({ liquidacion: LIQ(1194.19), certificados: CERT, consulta: { liquidacion: LIQ(1200), certificados: { requeridos: 'N', partidas: [] }, consultadoEn: '2026-11-13T09:00:00Z' } }));

    const res = await request(app()).get('/api/declarations/e1/h1/requisitos');

    expect(res.body.data.liquidacionAeat).toMatchObject({ fuente: 'consulta', comparacion: { cuadra: false, diferencia: 5.81 }, certificados: { requeridos: 'N' } });
  });

  test('sin presentar por el servicio CAU no hay liquidación de la AEAT', async () => {
    mockPreparar.mockResolvedValue({ requestXML: '<x/>' });
    mockExpedition.findById.mockResolvedValue(expediente());

    const res = await request(app()).get('/api/declarations/e1/h1/requisitos');

    expect(res.body.data.liquidacionAeat).toBeNull();
  });
});

describe('estado del H1 en la AEAT', () => {
  const mockConsultar = jest.fn();
  const aeatSubmitService = require('../../src/services/aeat/aeatSubmitService');
  const conEstado = () => {
    const a = express();
    a.get('/api/declarations/:expeditionId/h1/estado', (req, _res, next) => { req.user = USER; req.tenantId = USER.tenantId; next(); }, declarationController.getH1Status);
    return a;
  };
  const presentado = (extra = {}) => ({
    ...expediente(), markModified: jest.fn(),
    declaration: { mrn: '26ES002801I01BMDR0', channel: 'yellow', aeatResponse: { servicio: 'CC415AV1', csv: 'C1' }, ...extra }
  });

  beforeEach(() => {
    mockConsultar.mockReset();
    aeatSubmitService.consultarH1Cau = (...a) => mockConsultar(...a);
  });

  test('guarda lo que responde la AEAT y actualiza circuito y levante', async () => {
    const exp = presentado();
    mockExpedition.findById.mockResolvedValue(exp);
    mockConsultar.mockResolvedValue({
      success: true, tipo: 'encontrada', mrn: exp.declaration.mrn, rawResponse: '<xml/>',
      estado: { operacionRegistrada: '96', channel: 'green', circuito: 'V', fechaLevante: '2026-11-13T09:00:00' }
    });

    const res = await request(conEstado()).get('/api/declarations/e1/h1/estado');

    expect(res.status).toBe(200);
    expect(res.body.data.estado.operacionRegistrada).toBe('96');
    expect(res.body.data.rawResponse).toBeUndefined();
    expect(mockConsultar).toHaveBeenCalledWith('26ES002801I01BMDR0');
    expect(exp.declaration.channel).toBe('green');
    expect(exp.declaration.levanteDate).toEqual(new Date('2026-11-13T09:00:00'));
    expect(exp.declaration.aeatResponse).toMatchObject({ servicio: 'CC415AV1', csv: 'C1', consulta: { estado: { circuito: 'V' } } });
    // Sin XML enviado ni liquidación por partida no hay comparación, pero el campo está.
    expect(res.body.data.liquidacionAeat).toMatchObject({ fuente: null, comparacion: null });
    expect(exp.save).toHaveBeenCalled();
  });

  test('si la AEAT no encuentra la declaración responde 404 con su motivo y no toca el expediente', async () => {
    const exp = presentado();
    mockExpedition.findById.mockResolvedValue(exp);
    mockConsultar.mockResolvedValue({ success: false, tipo: 'error_funcional', error: '99999 No existe declaración de importación con MRN 26ES002801I01BMDR0' });

    const res = await request(conEstado()).get('/api/declarations/e1/h1/estado');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('No existe declaración');
    expect(exp.save).not.toHaveBeenCalled();
  });

  test('sin MRN, o presentada por el DUA anterior, no consulta', async () => {
    mockExpedition.findById.mockResolvedValue(presentado({ mrn: undefined }));
    expect((await request(conEstado()).get('/api/declarations/e1/h1/estado')).status).toBe(400);
    mockExpedition.findById.mockResolvedValue(presentado({ aeatResponse: { responseCode: '0' } }));
    expect((await request(conEstado()).get('/api/declarations/e1/h1/estado')).status).toBe(400);
    expect(mockConsultar).not.toHaveBeenCalled();
  });
});

describe('gastos a añadir a la base del IVA (THC, T3)', () => {
  test('guarda la lista y la devuelve con los conceptos admitidos', async () => {
    const exp = expediente();
    mockExpedition.findById.mockResolvedValue(exp);
    const res = await request(app()).put('/api/declarations/e1/h1/datos')
      .send({ vatAdditions: [{ concept: 'thc', amount: '200.5', currency: 'eur' }, { concept: 'T3', amount: 100 }] });
    expect(res.status).toBe(200);
    expect(exp.costs.vatAdditions).toEqual([{ concept: 'THC', amount: 200.5, currency: 'EUR' }, { concept: 'T3', amount: 100, currency: 'EUR' }]);
    expect(Object.keys(res.body.data.conceptosBaseIva)).toEqual(['THC', 'T3', 'OTHER']);
  });

  test('concepto o importe no válidos: 400 y no guarda', async () => {
    const exp = expediente();
    mockExpedition.findById.mockResolvedValue(exp);
    const res = await request(app()).put('/api/declarations/e1/h1/datos').send({ vatAdditions: [{ concept: 'ZZ', amount: -1 }] });
    expect(res.status).toBe(400);
    expect(exp.save).not.toHaveBeenCalled();
  });
});

