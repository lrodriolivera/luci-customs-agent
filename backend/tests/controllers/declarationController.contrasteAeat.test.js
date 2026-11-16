/**
 * Antes de presentar el H1 se contrastan arancel e IVA con el Arancel Integrado
 * de la AEAT (UAT 16/Nov/2026). Montaje copiado de declarationController.cau.test.js.
 *
 * Presentación del H1 por el servicio CAU (CC415AV1) desde el controlador:
 * el mensaje se guarda antes de enviarlo, se reenvía igual si la respuesta no
 * llega, y se guarda lo que responde la AEAT (circuito, liquidación,
 * certificados). Se simula el envío; el resto es el controlador real.
 */
const express = require('express');
const request = require('supertest');

const mockExpedition = { findById: jest.fn() };
const mockTenant = { findById: jest.fn() };
const mockPreparar = jest.fn();
const mockEnviar = jest.fn();
const mockSubmitH1 = jest.fn();
const mockProcesarCanal = jest.fn();
const mockAnularCau = jest.fn();
const mockCancelH1 = jest.fn();
const mockActivarCau = jest.fn();

jest.mock('../../src/models', () => ({ Expedition: mockExpedition, ChatMessage: { find: jest.fn() } }));
jest.mock('../../src/models/Tenant', () => mockTenant);
jest.mock('../../src/services/aeat/aeatSubmitService', () => ({
  servicioH1: (tenant) => (tenant?.customsConfig?.h1Service === 'cau' ? 'cau' : 'precau'),
  prepararH1Cau: (...a) => mockPreparar(...a),
  enviarH1Cau: (...a) => mockEnviar(...a),
  submitH1: (...a) => mockSubmitH1(...a),
  anularH1Cau: (...a) => mockAnularCau(...a),
  activarH1Cau: (...a) => mockActivarCau(...a),
  cancelH1: (...a) => mockCancelH1(...a)
}));
jest.mock('../../src/services/aiService', () => ({}));
jest.mock('../../src/services/channelService', () => ({ processChannelAssignment: (...a) => mockProcesarCanal(...a) }));
jest.mock('../../src/services/emailService', () => ({
  sendDeclarationRejected: jest.fn().mockResolvedValue(true),
  sendDeclarationAccepted: jest.fn().mockResolvedValue(true),
  sendChannelAssigned: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../src/services/customs', () => ({ CustomsServiceFactory: { getServiceForTenant: jest.fn() } }));
const mockConsultar = jest.fn();
jest.mock('../../src/services/aeat/arancelIntegrado', () => ({ consultarArancelIntegrado: (...a) => mockConsultar(...a) }));

const declarationController = require('../../src/controllers/declarationController');
const { ErrorValidacion } = require('../../src/services/forms/identificadorAduanero');

const USER = { _id: 'u1', name: 'Tester', email: 'tester@strixai.ai', tenantId: 't1' };
const PREPARADO = { messageId: 'LUCI2611121000000001234', lrn: 'LUCI261112100000000', requestXML: '<soap>mensaje</soap>', preparedAt: new Date() };
const ADMITIDA = {
  success: true, tipo: 'admitida', mrn: '26ES002801I01BMDR0', lrn: 'LUCI261112100000000', csv: 'CSV123', channel: 'yellow', circuito: 'A',
  operacionRegistrada: '64', fechaAdmision: '2026-11-12T10:57:04',
  liquidacion: { totalAPagar: 3552, totalAGarantizar: 3552, partidas: [] },
  certificados: { requeridos: 'S', partidas: [{ numero: 1, organismos: [{ organismo: 'SIF01' }] }] }
};

function expediente(declaration = {}) {
  return {
    _id: 'e1', expeditionId: 'EXP-2026-0100', tenantId: 't1', status: 'documents_validated', timeline: [],
    declaration: { type: 'H1', xmlContent: '<xml/>', status: 'draft', ...declaration },
    save: jest.fn().mockResolvedValue(true), markModified: jest.fn()
  };
}
function app() {
  const a = express();
  a.use(express.json());
  const usuario = (req, _res, next) => { req.user = USER; req.tenantId = USER.tenantId; next(); };
  a.post('/api/declarations/:expeditionId/submit', usuario, declarationController.submitDeclaration);
  a.post('/api/declarations/:expeditionId/cancel', usuario, declarationController.cancelDeclaration);
  a.post('/api/declarations/:expeditionId/h1/activar', usuario, declarationController.activateH1);
  return a;
}
const enviar = () => request(app()).post('/api/declarations/e1/submit');

beforeEach(() => {
  jest.clearAllMocks();
  mockTenant.findById.mockResolvedValue({ customsConfig: { country: 'ES', h1Service: 'cau' } });
  mockPreparar.mockResolvedValue({ ...PREPARADO });
  mockEnviar.mockResolvedValue({ ...ADMITIDA });
});


const medida = (codigo, derecho) => ({ codigo, tipo: /^IVA/.test(codigo) ? 'iva' : 'ue', areaGeografica: 'TODOS ERGA OMNES', derecho, documentos: [] });
const AEAT = { existe: true, areaGeografica: 'CN', medidas: [medida('103-APPL', '12,000%'), medida('IVA-IVA', '21,000%')] };
const conPartidas = (goods) => ({ ...expediente(), goods });

describe('H1: contraste con el Arancel Integrado antes de presentar', () => {
  test('si el arancel o el IVA no coinciden pide confirmación (409) y no envía', async () => {
    mockExpedition.findById.mockResolvedValue(conPartidas([{ itemNumber: 1, taricCode: '6302210089', originCountry: 'CN', dutyRate: 8, vatRate: 21 }]));
    mockConsultar.mockResolvedValue(AEAT);

    const res = await enviar();

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ARANCEL_AEAT_DISTINTO');
    expect(res.body.diferencias).toEqual([{ partida: 1, taricCode: '6302210089', campo: 'arancel', expediente: 8, aeat: 12 }]);
    expect(mockEnviar).not.toHaveBeenCalled();
  });

  test('con la confirmación de la agente se presenta igualmente', async () => {
    mockExpedition.findById.mockResolvedValue(conPartidas([{ itemNumber: 1, taricCode: '6302210089', originCountry: 'CN', dutyRate: 8, vatRate: 21 }]));
    mockConsultar.mockResolvedValue(AEAT);

    const res = await request(app()).post('/api/declarations/e1/submit').send({ confirmarDiferenciasAeat: true });

    expect(res.status).toBe(200);
    expect(mockEnviar).toHaveBeenCalled();
    expect(mockConsultar).not.toHaveBeenCalled();
  });

  test('si coinciden se presenta sin preguntar', async () => {
    mockExpedition.findById.mockResolvedValue(conPartidas([{ itemNumber: 1, taricCode: '6302210089', originCountry: 'CN', dutyRate: 12, vatRate: 21 }]));
    mockConsultar.mockResolvedValue(AEAT);

    expect((await enviar()).status).toBe(200);
    expect(mockEnviar).toHaveBeenCalled();
  });

  test('si la AEAT no responde no se bloquea la presentación', async () => {
    mockExpedition.findById.mockResolvedValue(conPartidas([{ itemNumber: 1, taricCode: '6302210089', originCountry: 'CN', dutyRate: 8, vatRate: 21 }]));
    mockConsultar.mockRejectedValue(new Error('timeout'));

    expect((await enviar()).status).toBe(200);
    expect(mockEnviar).toHaveBeenCalled();
  });
});
