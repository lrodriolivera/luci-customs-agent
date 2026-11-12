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
      datos: { invoiceNumber: '', vehicleNationality: '', dispatchAuthorizationScope: 'OSRE' }
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
      .send({ invoiceNumber: ' FAC-2026-118 ', vehicleNationality: 'pa', dispatchAuthorizationScope: 'global' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ invoiceNumber: 'FAC-2026-118', vehicleNationality: 'PA', dispatchAuthorizationScope: 'global' });
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
