/**
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

jest.mock('../../src/models', () => ({ Expedition: mockExpedition, ChatMessage: { find: jest.fn() } }));
jest.mock('../../src/models/Tenant', () => mockTenant);
jest.mock('../../src/services/aeat/aeatSubmitService', () => ({
  servicioH1: (tenant) => (tenant?.customsConfig?.h1Service === 'cau' ? 'cau' : 'precau'),
  prepararH1Cau: (...a) => mockPreparar(...a),
  enviarH1Cau: (...a) => mockEnviar(...a),
  submitH1: (...a) => mockSubmitH1(...a)
}));
jest.mock('../../src/services/aiService', () => ({}));
jest.mock('../../src/services/channelService', () => ({ processChannelAssignment: (...a) => mockProcesarCanal(...a) }));
jest.mock('../../src/services/emailService', () => ({
  sendDeclarationRejected: jest.fn().mockResolvedValue(true),
  sendDeclarationAccepted: jest.fn().mockResolvedValue(true),
  sendChannelAssigned: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../src/services/customs', () => ({ CustomsServiceFactory: { getServiceForTenant: jest.fn() } }));

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
  a.post('/api/declarations/:expeditionId/submit', (req, _res, next) => { req.user = USER; req.tenantId = USER.tenantId; next(); }, declarationController.submitDeclaration);
  return a;
}
const enviar = () => request(app()).post('/api/declarations/e1/submit');

beforeEach(() => {
  jest.clearAllMocks();
  mockTenant.findById.mockResolvedValue({ customsConfig: { country: 'ES', h1Service: 'cau' } });
  mockPreparar.mockResolvedValue({ ...PREPARADO });
  mockEnviar.mockResolvedValue({ ...ADMITIDA });
});

describe('H1 por el servicio CAU: envío', () => {
  test('guarda el mensaje antes de enviarlo', async () => {
    const exp = expediente();
    let guardadoAntes = null;
    mockEnviar.mockImplementation(async () => { guardadoAntes = exp.save.mock.calls.length; return { ...ADMITIDA }; });
    mockExpedition.findById.mockResolvedValue(exp);

    await enviar();

    expect(guardadoAntes).toBe(1);
    expect(mockEnviar).toHaveBeenCalledWith('<soap>mensaje</soap>');
    expect(mockSubmitH1).not.toHaveBeenCalled();
  });

  test('con la admisión guarda MRN, LRN, fecha de admisión, circuito, liquidación y certificados', async () => {
    const exp = expediente();
    mockExpedition.findById.mockResolvedValue(exp);

    const res = await enviar();

    expect(res.status).toBe(200);
    expect(exp.declaration).toMatchObject({ status: 'submitted', mrn: '26ES002801I01BMDR0', lrn: 'LUCI261112100000000', channel: 'yellow' });
    expect(exp.declaration.acceptanceDate).toEqual(new Date('2026-11-12T10:57:04'));
    expect(exp.declaration.aeatResponse).toMatchObject({
      servicio: 'CC415AV1', responseCode: '64', csv: 'CSV123', circuito: 'A',
      liquidacion: { totalAPagar: 3552 }, certificados: { requeridos: 'S' }
    });
    expect(exp.declaration.cauEnvio).toMatchObject({ respondido: true, resultado: 'admitida', messageId: PREPARADO.messageId });
    expect(res.body.data.liquidacion.totalAPagar).toBe(3552);
    expect(res.body.data.channelDescription).toContain('AMARILLO');
  });

  test('el circuito amarillo del H1 no pasa por el tratamiento amarillo del H7', async () => {
    mockExpedition.findById.mockResolvedValue(expediente());

    await enviar();

    expect(mockProcesarCanal).not.toHaveBeenCalled();
  });

  test('sin circuito asignado no se supone verde', async () => {
    const exp = expediente();
    mockEnviar.mockResolvedValue({ ...ADMITIDA, channel: null, circuito: null });
    mockExpedition.findById.mockResolvedValue(exp);

    await enviar();

    expect(exp.declaration.channel).toBeUndefined();
    expect(exp.status).toBe('declaration_submitted');
    expect(mockProcesarCanal).not.toHaveBeenCalled();
  });

  test('un circuito naranja sí se procesa como hasta ahora', async () => {
    const exp = expediente();
    mockEnviar.mockResolvedValue({ ...ADMITIDA, channel: 'orange', circuito: 'N' });
    mockProcesarCanal.mockResolvedValue({ channel: 'orange', actions: [] });
    mockExpedition.findById.mockResolvedValue(exp);

    await enviar();

    expect(exp.status).toBe('orange_channel');
    expect(mockProcesarCanal).toHaveBeenCalledWith('e1', 'orange', expect.any(Object), USER);
  });
});

describe('H1 por el servicio CAU: reenvío y rechazos', () => {
  test('si el envío anterior quedó sin respuesta, reenvía el mismo mensaje sin preparar otro', async () => {
    const exp = expediente({ cauEnvio: { ...PREPARADO, requestXML: '<soap>anterior</soap>', respondido: false } });
    mockExpedition.findById.mockResolvedValue(exp);

    await enviar();

    expect(mockPreparar).not.toHaveBeenCalled();
    expect(mockEnviar).toHaveBeenCalledWith('<soap>anterior</soap>');
  });

  test('un mensaje ya respondido o caducado no se reutiliza', async () => {
    for (const cauEnvio of [
      { ...PREPARADO, respondido: true },
      { ...PREPARADO, respondido: false, preparedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) }
    ]) {
      jest.clearAllMocks();
      mockTenant.findById.mockResolvedValue({ customsConfig: { country: 'ES', h1Service: 'cau' } });
      mockPreparar.mockResolvedValue({ ...PREPARADO });
      mockEnviar.mockResolvedValue({ ...ADMITIDA });
      mockExpedition.findById.mockResolvedValue(expediente({ cauEnvio }));

      await enviar();

      expect(mockPreparar).toHaveBeenCalledTimes(1);
    }
  });

  test('un rechazo responde 400 con el motivo, cierra el mensaje y no marca la declaración como enviada', async () => {
    const exp = expediente();
    mockEnviar.mockResolvedValue({ success: false, tipo: 'error_funcional', error: '21151 691 LOS BULTOS A DATAR EXCEDEN EL SALDO', errores: [{ codigo: '99' }] });
    mockExpedition.findById.mockResolvedValue(exp);

    const res = await enviar();

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('EXCEDEN EL SALDO');
    expect(exp.declaration.status).toBe('draft');
    expect(exp.declaration.cauEnvio).toMatchObject({ respondido: true, resultado: 'error_funcional' });
    expect(exp.save).toHaveBeenCalledTimes(2);
  });

  test('un fallo del servidor de la AEAT deja el mensaje pendiente para reenviarlo', async () => {
    const exp = expediente();
    mockEnviar.mockResolvedValue({ success: false, tipo: 'fault', reintentable: true, error: 'Servicio no disponible' });
    mockExpedition.findById.mockResolvedValue(exp);

    const res = await enviar();

    expect(res.status).toBe(400);
    expect(exp.declaration.cauEnvio.respondido).toBe(false);
  });

  test('si faltan datos responde 422 con la lista y no envía nada', async () => {
    const error = new ErrorValidacion('Faltan datos para presentar el H1: número de la factura comercial', { code: 'DATOS_H1_FALTANTES' });
    error.faltan = ['número de la factura comercial'];
    mockPreparar.mockRejectedValue(error);
    mockExpedition.findById.mockResolvedValue(expediente());

    const res = await enviar();

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: 'DATOS_H1_FALTANTES', faltan: ['número de la factura comercial'] });
    expect(mockEnviar).not.toHaveBeenCalled();
  });

  test('un tenant sin el servicio CAU activado sigue por el DUA anterior', async () => {
    mockTenant.findById.mockResolvedValue({ customsConfig: { country: 'ES' } });
    mockSubmitH1.mockResolvedValue({ success: true, mrn: 'M', channel: 'green', code: '0' });
    mockProcesarCanal.mockResolvedValue({ channel: 'green', actions: [] });
    const exp = expediente();
    mockExpedition.findById.mockResolvedValue(exp);

    await enviar();

    expect(mockSubmitH1).toHaveBeenCalled();
    expect(mockPreparar).not.toHaveBeenCalled();
    expect(exp.declaration.channel).toBe('green');
  });
});
