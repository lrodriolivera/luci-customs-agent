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

  test('el LRN con el que se presentó pasa a la vista previa', async () => {
    const exp = expediente({ h1Data: { servicio: 'CC415AV1', lrn: null, valuation: { customsValue: 1 } } });
    mockExpedition.findById.mockResolvedValue(exp);

    await enviar();

    expect(exp.declaration.h1Data).toEqual({ servicio: 'CC415AV1', lrn: 'LUCI261112100000000', valuation: { customsValue: 1 } });
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

describe('H1 por el servicio CAU: anulación', () => {
  const anular = (cuerpo) => request(app()).post('/api/declarations/e1/cancel').send(cuerpo);
  const presentada = (aeatResponse) => expediente({ status: 'submitted', mrn: '26ES002801I01BMDR0', lrn: 'LUCI261112100000000', aeatResponse });

  test('una declaración ya activada no se anula por servicio web: 409 y no se envía nada', async () => {
    const exp = presentada({ servicio: 'CC415AV1', responseCode: '64' });
    mockExpedition.findById.mockResolvedValue(exp);

    const res = await anular({ reason: 'Pedido cancelado por el cliente' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ANULACION_POR_LA_ADUANA');
    expect(res.body.error).toContain('solicitar la anulación a la aduana');
    expect(mockAnularCau).not.toHaveBeenCalled();
    // Y nunca la anulación del DUA anterior, que no sirve para un MRN del servicio CAU.
    expect(mockCancelH1).not.toHaveBeenCalled();
    expect(exp.save).not.toHaveBeenCalled();
  });

  test('una predeclaración pendiente de activar sí: se anula y queda registrado', async () => {
    const exp = presentada({ servicio: 'CC415AV1', responseCode: '63' });
    mockExpedition.findById.mockResolvedValue(exp);
    mockAnularCau.mockResolvedValue({ success: true, tipo: 'anulada', fechaDecision: '2026-11-12T10:31:00', csv: 'CSV1', rawResponse: '<xml/>', requestXML: '<soap/>' });

    const res = await anular({ reason: 'Pedido cancelado por el cliente' });

    expect(res.status).toBe(200);
    expect(mockAnularCau).toHaveBeenCalledWith(exp, { motivo: 'Pedido cancelado por el cliente' });
    expect(exp.status).toBe('cancelled');
    expect(exp.declaration.cancelledAt).toEqual(new Date('2026-11-12T10:31:00'));
    expect(exp.timeline[0]).toMatchObject({ action: 'declaration_cancelled', metadata: { aeatResponse: { tipo: 'anulada', csv: 'CSV1' } } });
    expect(res.body.data.rawResponse).toBeUndefined();
  });

  test('manda el estado más reciente: si la consulta dice que ya se activó, no se anula', async () => {
    mockExpedition.findById.mockResolvedValue(presentada({ servicio: 'CC415AV1', responseCode: '63', consulta: { estado: { operacionRegistrada: '64' } } }));

    expect((await anular({ reason: 'Pedido cancelado por el cliente' })).status).toBe(409);
  });

  test('sin motivo no se envía; un rechazo de la AEAT responde 400 con su motivo', async () => {
    const exp = presentada({ servicio: 'CC415AV1', responseCode: '63' });
    mockExpedition.findById.mockResolvedValue(exp);

    expect((await anular({ reason: '1' })).status).toBe(400);
    expect(mockAnularCau).not.toHaveBeenCalled();

    mockAnularCau.mockResolvedValue({ success: false, tipo: 'error_funcional', error: '21200 Notificada la intención de control' });
    const res = await anular({ reason: 'Pedido cancelado por el cliente' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('intención de control');
    expect(exp.status).not.toBe('cancelled');
  });

  test('una declaración del DUA anterior sigue por su anulación de siempre', async () => {
    mockExpedition.findById.mockResolvedValue(presentada({ responseCode: '0' }));
    mockCancelH1.mockResolvedValue({ success: true, code: '0' });

    const res = await anular({ reason: '1' });

    expect(res.status).toBe(200);
    expect(mockCancelH1).toHaveBeenCalled();
    expect(mockAnularCau).not.toHaveBeenCalled();
  });
});


describe('predeclaraciones (tipo D)', () => {
  const PENDIENTE = {
    ...ADMITIDA, mrn: null, numeroRegistro: '26ES009999I00270R1', operacionRegistrada: '63', channel: null, circuito: null,
    fechaAdmision: null, liquidacion: null, certificados: { requeridos: 'Z', partidas: [] }
  };
  const ACTIVADA = { ...ADMITIDA, mrn: '26ES009999I00270R1', operacionRegistrada: '90', channel: 'yellow', circuito: 'A', fechaAdmision: '2026-11-13T07:57:09' };
  const presentarComo = (cuerpo) => request(app()).post('/api/declarations/e1/submit').send(cuerpo);
  const activar = () => request(app()).post('/api/declarations/e1/h1/activar');
  const pendiente = () => expediente({
    status: 'submitted', mrn: '26ES009999I00270R1', lrn: 'LUCI261113000000001',
    predeclaracion: { modo: 'Operador', numeroRegistro: '26ES009999I00270R1', registradaEn: new Date('2026-11-13T07:56:10') },
    cauEnvio: { requestXML: '<soap>mensaje</soap>', respondido: true },
    aeatResponse: { servicio: 'CC415AV1', responseCode: '63', liquidacion: null, certificados: null }
  });

  test('presenta en el modo pedido y guarda el número de registro, sin circuito', async () => {
    const exp = expediente();
    mockEnviar.mockResolvedValue({ ...PENDIENTE });
    mockExpedition.findById.mockResolvedValue(exp);

    const res = await presentarComo({ predeclaracion: 'Operador' });

    expect(res.status).toBe(200);
    expect(mockPreparar).toHaveBeenCalledWith(exp, { predeclaracion: 'Operador' });
    expect(exp.declaration).toMatchObject({ status: 'submitted', mrn: '26ES009999I00270R1' });
    expect(exp.declaration.channel).toBeUndefined();
    expect(exp.declaration.predeclaracion).toMatchObject({ modo: 'Operador', numeroRegistro: '26ES009999I00270R1' });
    expect(exp.declaration.aeatResponse.responseCode).toBe('63');
    expect(res.body.data.message).toContain('pendiente de activar');
    expect(mockProcesarCanal).not.toHaveBeenCalled();
  });

  test('un modo que no existe, o predeclarar sin el servicio CAU, no envía nada', async () => {
    mockExpedition.findById.mockResolvedValue(expediente());
    expect((await presentarComo({ predeclaracion: 'Mañana' })).status).toBe(400);

    mockTenant.findById.mockResolvedValue({ customsConfig: { country: 'ES' } });
    const res = await presentarComo({ predeclaracion: 'Aduanas' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('servicio');
    expect(mockEnviar).not.toHaveBeenCalled();
    expect(mockSubmitH1).not.toHaveBeenCalled();
  });

  test('un mensaje pendiente de reenviar con otro modo no se reutiliza', async () => {
    const exp = expediente({ cauEnvio: { ...PREPARADO, respondido: false, predeclaracion: null } });
    mockEnviar.mockResolvedValue({ ...PENDIENTE });
    mockExpedition.findById.mockResolvedValue(exp);

    await presentarComo({ predeclaracion: 'Operador' });

    expect(mockPreparar).toHaveBeenCalledWith(exp, { predeclaracion: 'Operador' });
    expect(exp.declaration.cauEnvio.predeclaracion).toBe('Operador');
  });

  test('activar: guarda el MRN, el circuito, la liquidación y la fecha de admisión que da la AEAT', async () => {
    const exp = pendiente();
    mockActivarCau.mockResolvedValue({ ...ACTIVADA });
    mockExpedition.findById.mockResolvedValue(exp);

    const res = await activar();

    expect(res.status).toBe(200);
    expect(mockActivarCau).toHaveBeenCalledWith(exp);
    expect(exp.declaration).toMatchObject({ mrn: '26ES009999I00270R1', channel: 'yellow' });
    expect(exp.declaration.acceptanceDate).toEqual(new Date('2026-11-13T07:57:09'));
    expect(exp.declaration.aeatResponse).toMatchObject({ servicio: 'CC415AV1', responseCode: '90', circuito: 'A', liquidacion: { totalAPagar: 3552 } });
    expect(exp.declaration.predeclaracion.activadaEn).toBeInstanceOf(Date);
    expect(exp.timeline.at(-1).action).toBe('declaration_activated');
    expect(res.body.data).toMatchObject({ mrn: '26ES009999I00270R1', channel: 'yellow' });
  });

  test('si la AEAT rechaza la activación lo dice y la predeclaración queda como estaba', async () => {
    const exp = pendiente();
    mockActivarCau.mockResolvedValue({ success: false, tipo: 'error_funcional', error: '80118 No se permite declarar ContactPerson' });
    mockExpedition.findById.mockResolvedValue(exp);

    const res = await activar();

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('80118');
    expect(exp.declaration.aeatResponse.responseCode).toBe('63');
    expect(exp.declaration.predeclaracion.activadaEn).toBeUndefined();
  });

  test('solo se activa una predeclaración pendiente de activar', async () => {
    mockExpedition.findById.mockResolvedValue(expediente({ status: 'submitted', mrn: 'M1', aeatResponse: { servicio: 'CC415AV1', responseCode: '64' } }));
    const res = await activar();
    expect(res.status).toBe(409);
    expect(mockActivarCau).not.toHaveBeenCalled();
  });
});
