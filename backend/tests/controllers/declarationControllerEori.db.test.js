/**
 * declarationController + generadores REALES: el declarante sale del tenant del
 * expediente; sin EORI de declarante o de cliente la respuesta es 422 con un
 * mensaje que dice donde completarlo, y no se genera XML ni se gasta la IA.
 * BD en memoria efimera, NUNCA produccion.
 */
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/services/aiService', () => ({
  generateH1Declaration: jest.fn(), generateAESDeclaration: jest.fn()
}));
jest.mock('../../src/services/aeat/aeatSubmitService', () => ({}));
jest.mock('../../src/services/channelService', () => ({}));

const { Expedition, Tenant } = require('../../src/models');
const aiService = require('../../src/services/aiService');
const ctrl = require('../../src/controllers/declarationController');

usarBaseDeDatosEnMemoria();

const usuario = () => ({
  _id: new mongoose.Types.ObjectId(), tenantId: new mongoose.Types.ObjectId(),
  role: 'operator', name: 'Operario', email: 'op@ejemplo.es'
});
function crearRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const doc = (type) => ({ type, status: 'validated', fileName: `${type}.pdf`, uploadedBy: new mongoose.Types.ObjectId() });
const mercancia = {
  itemNumber: 1, description: 'Cafe', quantity: 10, invoiceValue: 1000, taricCode: '0901210000',
  grossWeight: 12, netWeight: 10, packages: { quantity: 2 }, dutyAmount: 75, vatAmount: 220
};
const expediente = (user, extra = {}) => Expedition.create({
  tenantId: user.tenantId, createdBy: user._id, assignedTo: user._id,
  operationType: 'import', transportMode: 'maritime',
  client: { companyName: 'Importadora SL', nif: 'B12345678' },
  goods: [mercancia],
  documents: [doc('commercial_invoice'), doc('packing_list'), doc('bill_of_lading')],
  ...extra
});
const crearTenant = (user, extra = {}) => Tenant.create({
  _id: user.tenantId, name: 'Agencia Uno SL', slug: `agencia-${user.tenantId}`,
  customsConfig: { country: 'ES', eoriNumbers: { ES: 'ESA11111111' } },
  primaryContact: { name: 'Ana', email: 'ana@agencia.es' },
  ...extra
});

beforeEach(() => {
  aiService.generateH1Declaration.mockResolvedValue({ declarationType: 'A', customsOffice: 'ES002801', warnings: [] });
  aiService.generateAESDeclaration.mockResolvedValue({ declarationType: 'EX', customsOffice: 'ES002801', warnings: [] });
});

describe('generateH1: declarante', () => {
  test('sin representante ni EORI en el tenant: 422, sin XML y sin llamar a la IA', async () => {
    const user = usuario();
    await crearTenant(user, { customsConfig: { country: 'ES', eoriNumbers: {} } });
    const exp = await expediente(user);
    const res = crearRes();

    await ctrl.generateH1({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('Falta el EORI del representante: configúralo en Ajustes > Aduanas');
    expect(res.body.quien).toBe('representante');
    expect(aiService.generateH1Declaration).not.toHaveBeenCalled();
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.declaration?.xmlContent).toBeUndefined();
  });

  test('sin tenant tambien es 422 (no ESundefined)', async () => {
    const user = usuario();
    const exp = await expediente(user);
    const res = crearRes();

    await ctrl.generateH1({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(422);
  });

  test('con el EORI en el tenant genera el XML con ese declarante', async () => {
    const user = usuario();
    await crearTenant(user);
    const exp = await expediente(user);
    const res = crearRes();

    await ctrl.generateH1({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.declaration.xmlContent).toContain('ESA11111111');
    expect(guardado.declaration.xmlContent).toContain('Agencia Uno SL');
    expect(guardado.declaration.xmlContent).not.toMatch(/ESundefined|STRIX AI SL|Departamento Aduanas/);
  });

  test('usa el tenant del expediente, no el de otra empresa', async () => {
    const user = usuario();
    await crearTenant(user);
    const otro = usuario();
    await crearTenant(otro, { name: 'Otra Agencia', customsConfig: { country: 'ES', eoriNumbers: { ES: 'ESZ99999999' } } });
    const exp = await expediente(user);
    const res = crearRes();

    await ctrl.generateH1({ body: { expeditionId: exp._id }, user }, res);

    const guardado = await Expedition.findById(exp._id);
    expect(guardado.declaration.xmlContent).toContain('ESA11111111');
    expect(guardado.declaration.xmlContent).not.toContain('ESZ99999999');
  });

  test('cliente sin EORI ni NIF: 422 "del cliente"', async () => {
    const user = usuario();
    await crearTenant(user);
    const exp = await expediente(user);
    // El schema exige nif; un dato antiguo o importado puede no tenerlo.
    await Expedition.collection.updateOne({ _id: exp._id }, { $unset: { 'client.nif': '' } });
    const res = crearRes();

    await ctrl.generateH1({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('Falta el EORI del cliente: complétalo en la ficha del cliente');
  });
});

describe('generateAES y generateH7: declarante', () => {
  test('AES sin EORI de declarante: 422', async () => {
    const user = usuario();
    const exp = await expediente(user, { operationType: 'export', documents: [doc('commercial_invoice'), doc('packing_list'), doc('cmr')], transportMode: 'road' });
    const res = crearRes();

    await ctrl.generateAES({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(422);
    expect(res.body.error).toMatch(/Falta el EORI del representante/);
  });

  test('AES con tenant genera con su EORI', async () => {
    const user = usuario();
    await crearTenant(user);
    const exp = await expediente(user, { operationType: 'export', documents: [doc('commercial_invoice'), doc('packing_list'), doc('cmr')], transportMode: 'road' });
    const res = crearRes();

    await ctrl.generateAES({ body: { expeditionId: exp._id }, user }, res);

    expect(res.statusCode).toBe(200);
    expect((await Expedition.findById(exp._id)).declaration.xmlContent).toContain('ESA11111111');
  });

  test('H7 sin EORI de declarante: 422; con tenant, 200', async () => {
    const user = usuario();
    const exp = await expediente(user, { goodsSummary: { totalValue: 100 }, goods: [{ ...mercancia, invoiceValue: 100 }] });
    const sin = crearRes();
    await ctrl.generateH7({ body: { expeditionId: exp._id }, user }, sin);
    expect(sin.statusCode).toBe(422);

    await crearTenant(user);
    const con = crearRes();
    await ctrl.generateH7({ body: { expeditionId: exp._id }, user }, con);
    expect(con.statusCode).toBe(200);
    expect(con.body.data.xml).toContain('ESA11111111');
  });
});
