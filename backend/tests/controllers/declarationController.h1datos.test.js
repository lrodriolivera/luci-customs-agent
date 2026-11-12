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
        invoiceNumber: '', exporterPostalCode: '', vehicleNationality: '', dispatchAuthorizationScope: 'OSRE',
        incoterm: '', gastosASumar: null,
        freightAmount: null, freightCurrency: 'EUR', insuranceAmount: null, insuranceCurrency: 'EUR',
        invoiceCurrency: 'EUR', invoiceCurrencyWithoutBce: false, appliedExchangeRate: null
      },
      anulacion: { presentada: false, anulable: false }
    });
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
