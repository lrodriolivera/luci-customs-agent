/**
 * «Usar los datos de la AEAT» en una partida y recálculo del arancel al cambiar
 * el TARIC (UAT 16/Nov/2026). Modelo Expedition real sobre Mongo en memoria;
 * la consulta a la AEAT y el catálogo TARIC se simulan.
 */
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

const mockConsultar = jest.fn();
jest.mock('../../src/services/aeat/arancelIntegrado', () => ({ consultarArancelIntegrado: (...a) => mockConsultar(...a) }));
jest.mock('../../src/services/emailService', () => ({}));
jest.mock('../../src/services/aiService', () => ({}));

const { Expedition, TaricCode } = require('../../src/models');
const ctrl = require('../../src/controllers/expeditionController');

usarBaseDeDatosEnMemoria();

const usuario = () => ({ _id: new mongoose.Types.ObjectId(), tenantId: new mongoose.Types.ObjectId(), role: 'operator', name: 'Patricia' });
const crearRes = () => {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};

const medida = (codigo, derecho, area = 'TODOS ERGA OMNES') => ({ codigo, tipo: /^IVA/.test(codigo) ? 'iva' : 'ue', areaGeografica: area, derecho, documentos: [] });
const AEAT_CN = { existe: true, codigo: '6302210089', areaGeografica: 'CN', fechaConsulta: '16-11-2026', medidas: [medida('103-APPL', '12,000%'), medida('IVA-IVA', '21,000%')] };
const AEAT_VN = { ...AEAT_CN, areaGeografica: 'VN', medidas: [...AEAT_CN.medidas, medida('142-PREF', '0%', 'VN Vietnam')] };

async function crearExpediente(user, partida = {}) {
  return Expedition.create({
    tenantId: user.tenantId, createdBy: user._id, assignedTo: user._id,
    operationType: 'import', transportMode: 'maritime', status: 'draft',
    client: { companyName: 'Cliente SL', nif: 'B99999999' },
    goods: [{ itemNumber: 1, description: 'Sábanas', quantity: 10, invoiceValue: 1000, taricCode: '6302210089', originCountry: 'CN', dutyRate: 8, vatRate: 10, ...partida }]
  });
}

const aplicar = (user, exp, body = {}, goodId = String(exp.goods[0]._id)) => {
  const res = crearRes();
  return ctrl.applyAeatRates({ params: { id: String(exp._id), goodId }, body, user, tenantId: user.tenantId }, res).then(() => res);
};

beforeEach(() => jest.clearAllMocks());

describe('applyAeatRates', () => {
  test('guarda el arancel general y el IVA de la AEAT y lo deja en el historial', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);
    mockConsultar.mockResolvedValue(AEAT_CN);

    const res = await aplicar(user, exp);

    expect(res.statusCode).toBe(200);
    expect(mockConsultar).toHaveBeenCalledWith({ codigo: '6302210089', origen: 'CN' });
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.goods[0]).toMatchObject({ dutyRate: 12, vatRate: 21 });
    expect(guardado.goods[0].aeatTariff).toMatchObject({ medidaArancel: '103-APPL', dutyRate: 12, vatRate: 21, areaGeografica: 'CN', appliedBy: 'Patricia' });
    const entrada = guardado.timeline.find((t) => t.action === 'aeat_rates_applied');
    expect(entrada.description).toContain('arancel 8 % → 12 %');
    expect(entrada.description).toContain('IVA 10 % → 21 %');
  });

  test('la agente puede elegir la preferencia del origen', async () => {
    const user = usuario();
    const exp = await crearExpediente(user, { originCountry: 'VN' });
    mockConsultar.mockResolvedValue(AEAT_VN);

    const res = await aplicar(user, exp, { medida: '142-PREF' });

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.goods[0]).toMatchObject({ dutyRate: 0, vatRate: 21 });
    expect(guardado.goods[0].aeatTariff.medidaArancel).toBe('142-PREF');
  });

  test('una preferencia que no es del origen se rechaza sin tocar la partida', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);
    mockConsultar.mockResolvedValue(AEAT_CN);

    const res = await aplicar(user, exp, { medida: '142-PREF' });

    expect(res.statusCode).toBe(422);
    expect((await Expedition.findById(exp._id)).goods[0].dutyRate).toBe(8);
  });

  test('si la AEAT no responde no se cambia nada (502)', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);
    mockConsultar.mockRejectedValue(new Error('timeout'));

    const res = await aplicar(user, exp);

    expect(res.statusCode).toBe(502);
    expect((await Expedition.findById(exp._id)).goods[0].dutyRate).toBe(8);
  });

  test('un código que la AEAT no tiene da 422', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);
    mockConsultar.mockResolvedValue({ ...AEAT_CN, existe: false, medidas: [] });
    expect((await aplicar(user, exp)).statusCode).toBe(422);
  });

  test('partida inexistente o identificador no válido', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);
    expect((await aplicar(user, exp, {}, String(new mongoose.Types.ObjectId()))).statusCode).toBe(404);
    expect((await aplicar(user, exp, {}, 'x')).statusCode).toBe(400);
    expect(mockConsultar).not.toHaveBeenCalled();
  });

  test('el expediente de otro tenant no se toca', async () => {
    const exp = await crearExpediente(usuario());
    const res = await aplicar(usuario(), exp);
    expect(res.statusCode).toBe(404);
    expect(mockConsultar).not.toHaveBeenCalled();
  });
});

describe('update: el arancel sigue al TARIC', () => {
  const guardar = async (user, exp, goods) => {
    const res = crearRes();
    await ctrl.update({ params: { id: String(exp._id) }, body: { goods }, user, tenantId: user.tenantId }, res);
    return res;
  };

  test('al cambiar el TARIC se toma el arancel del catálogo y se borra el de la AEAT', async () => {
    jest.spyOn(TaricCode, 'findOne').mockReturnValue({ lean: async () => ({ code: '6302100000', duties: { thirdCountry: 12 } }) });
    const user = usuario();
    const exp = await crearExpediente(user, { aeatTariff: { medidaArancel: '103-APPL', dutyRate: 8 } });
    const partida = exp.goods[0].toObject();

    const res = await guardar(user, exp, [{ ...partida, taricCode: '6302100000' }]);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.goods[0]).toMatchObject({ taricCode: '6302100000', dutyRate: 12 });
    expect(guardado.goods[0].aeatTariff?.medidaArancel).toBeUndefined();
    TaricCode.findOne.mockRestore();
  });

  test('sin cambiar TARIC ni origen se respeta el arancel guardado', async () => {
    const spy = jest.spyOn(TaricCode, 'findOne');
    const user = usuario();
    const exp = await crearExpediente(user);
    const partida = exp.goods[0].toObject();

    await guardar(user, exp, [{ ...partida, description: 'Sábanas de algodón' }]);

    expect((await Expedition.findById(exp._id)).goods[0].dutyRate).toBe(8);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('al cambiar el origen se borra la marca de la AEAT pero no el arancel', async () => {
    const user = usuario();
    const exp = await crearExpediente(user, { originCountry: 'VN', aeatTariff: { medidaArancel: '142-PREF', dutyRate: 0 }, dutyRate: 0 });
    const partida = exp.goods[0].toObject();

    await guardar(user, exp, [{ ...partida, originCountry: 'CN' }]);

    const guardado = await Expedition.findById(exp._id);
    expect(guardado.goods[0].dutyRate).toBe(0);
    expect(guardado.goods[0].aeatTariff?.medidaArancel).toBeUndefined();
  });
});

describe('setDocumentosC44', () => {
  const guardarDocs = (user, exp, documentos, goodId = String(exp.goods[0]._id)) => {
    const res = crearRes();
    return ctrl.setDocumentosC44({ params: { id: String(exp._id), goodId }, body: { documentos }, user, tenantId: user.tenantId }, res).then(() => res);
  };

  test('guarda los documentos de la partida y lo deja en el historial', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);

    const res = await guardarDocs(user, exp, [{ tipo: 'n003', referencia: 'CAL-1', medida: 'COM-COMER' }, { tipo: 'Y081' }]);

    expect(res.statusCode).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.goods[0].documentosC44.map((d) => ({ tipo: d.tipo, referencia: d.referencia }))).toEqual([
      { tipo: 'N003', referencia: 'CAL-1' }, { tipo: 'Y081', referencia: undefined }
    ]);
    expect(guardado.timeline.find((t) => t.action === 'c44_documents_updated').description)
      .toBe('Partida 1: documentos de la casilla 44 ninguno → N003, Y081');
  });

  test('400 si un documento no es válido, sin tocar la partida', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);
    const res = await guardarDocs(user, exp, [{ tipo: 'N003' }]);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/falta el número/);
    expect((await Expedition.findById(exp._id)).goods[0].documentosC44).toHaveLength(0);
  });

  test('una lista vacía borra los documentos', async () => {
    const user = usuario();
    const exp = await crearExpediente(user, { documentosC44: [{ tipo: 'N003', referencia: 'CAL-1' }] });
    await guardarDocs(user, exp, []);
    expect((await Expedition.findById(exp._id)).goods[0].documentosC44).toHaveLength(0);
  });

  test('partida inexistente, identificador no válido y otro tenant', async () => {
    const user = usuario();
    const exp = await crearExpediente(user);
    expect((await guardarDocs(user, exp, [], String(new mongoose.Types.ObjectId()))).statusCode).toBe(404);
    expect((await guardarDocs(user, exp, [], 'x')).statusCode).toBe(400);
    expect((await guardarDocs(usuario(), exp, [])).statusCode).toBe(404);
  });
});

