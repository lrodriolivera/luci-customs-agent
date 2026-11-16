/**
 * La agente envia al cliente el H1 admitido con los datos del modelo 031
 * (decision de Luis del 17/Nov/2026: con boton, no automatico).
 */
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/services/emailService', () => ({ sendPago031: jest.fn() }));

const emailService = require('../../src/services/emailService');
const { Expedition } = require('../../src/models');
const { enviarPago031 } = require('../../src/controllers/pago031Controller');

usarBaseDeDatosEnMemoria();

const MRN = '26ES00280110000011';
const tenantId = new mongoose.Types.ObjectId();
const user = { _id: new mongoose.Types.ObjectId(), tenantId, role: 'agent', name: 'Patricia' };

function crearRes() {
  const res = { statusCode: 200 };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  return res;
}

function sembrar(declaration = {}) {
  return Expedition.create({
    tenantId,
    operationType: 'import',
    transportMode: 'maritime',
    client: { companyName: 'Cliente <SL>', nif: 'B12345678', contact: { email: 'pagos@cliente.es' } },
    goods: [{ itemNumber: 1, description: 'Bicicletas', taricCode: '8711601000', quantity: 1, unit: 'u', invoiceValue: 1000 }],
    status: 'green_channel',
    declaration: { type: 'H1', mrn: MRN, paymentMethod: 'A', aeatResponse: { liquidacion: { totalAPagar: 1704.96, partidas: [] } }, ...declaration }
  });
}

const enviar = async (exp, body = {}) => {
  const res = crearRes();
  await enviarPago031({ params: { id: String(exp._id) }, body, user, tenantId }, res);
  return res;
};

beforeEach(() => emailService.sendPago031.mockReset().mockResolvedValue({ success: true }));

describe('enviarPago031', () => {
  test('envía al contacto del cliente el MRN, el importe de la AEAT y el enlace al portal, y lo registra', async () => {
    const exp = await sembrar();

    const res = await enviar(exp);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.sentTo).toBe('pagos@cliente.es');
    const [destino, datos] = emailService.sendPago031.mock.calls[0];
    expect(destino).toBe('pagos@cliente.es');
    expect(datos).toMatchObject({ mrn: MRN, importe: 1704.96, expeditionId: exp.expeditionId });
    expect(datos.portalUrl).toContain(exp.clientPortal.token);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.timeline.map((t) => t.action)).toContain('payment_031_sent');
    expect(guardado.communications.at(-1)).toMatchObject({ sentTo: 'pagos@cliente.es' });
  });

  test('con pago aplazado (R) o sin H1 admitido no se envía (409)', async () => {
    expect((await enviar(await sembrar({ paymentMethod: 'R' }))).statusCode).toBe(409);
    expect((await enviar(await sembrar({ mrn: undefined }))).statusCode).toBe(409);
    expect(emailService.sendPago031).not.toHaveBeenCalled();
  });

  test('correo no válido: 400', async () => {
    expect((await enviar(await sembrar(), { email: 'no-es-un-correo' })).statusCode).toBe(400);
  });

  test('si el correo no sale no se registra como enviado (502)', async () => {
    emailService.sendPago031.mockResolvedValue({ success: false, reason: 'sin SMTP' });
    const exp = await sembrar();
    expect((await enviar(exp)).statusCode).toBe(502);
    expect((await Expedition.findById(exp._id)).timeline.map((t) => t.action)).not.toContain('payment_031_sent');
  });

  test('otro tenant no puede enviarlo', async () => {
    const exp = await sembrar();
    const res = crearRes();
    await enviarPago031({ params: { id: String(exp._id) }, body: {}, user: { ...user, tenantId: new mongoose.Types.ObjectId() }, tenantId: new mongoose.Types.ObjectId() }, res);
    expect(res.statusCode).not.toBe(200);
    expect(emailService.sendPago031).not.toHaveBeenCalled();
  });
});
