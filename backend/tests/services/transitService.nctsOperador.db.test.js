/**
 * Predeclaración de tránsito y mensajes del operador en la aduana de partida:
 * presentación (CC170C), modificación (CC013C) e invalidación (CC014C).
 *
 * Estados permitidos (guía «Servicios Web de Tránsito NCTS6» v1.21, tabla de
 * 4.3): CC170C y CC013C solo en PA; CC014C en PA o PG. En LUCI, PA es el estado
 * `prelodged` y PG un `accepted` cuyo estado NCTS guardado es PG.
 *
 * Solo se simula aeatSubmitService (la red). Mongo en memoria.
 */
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('./../helpers/memoryDb');

jest.mock('../../src/services/aeat/aeatSubmitService', () => ({
  submitNCTS: jest.fn(),
  submitNCTSAmendment: jest.fn(),
  submitNCTSInvalidation: jest.fn(),
  submitNCTSPresentation: jest.fn()
}));

const { Transit } = require('../../src/models');
const User = require('../../src/models/User');
const Tenant = require('../../src/models/Tenant');
const aeat = require('../../src/services/aeat/aeatSubmitService');
const transitService = require('../../src/services/transitService');

usarBaseDeDatosEnMemoria();

const MRN = '26ES002801501441J7';
let owner;
let tenant;

function datos(extra = {}) {
  return {
    reference: 'REF-PRE-1',
    transitType: 'T1',
    additionalDeclarationType: 'D',
    departureOffice: { code: 'ES002801' },
    destinationOffice: { code: 'ES002901' },
    transport: { mode: '3' },
    principal: { eori: 'ESB22477020', name: 'STRIX AI SL' },
    guarantee: { type: '1' },
    locationAuthorisationNumber: '2801AAAAAA',
    goodsItems: [{ description: 'Ropa de cama', taricCode: '6302100000', grossWeight: 25, netWeight: 20, packages: { count: 2 } }],
    ...extra
  };
}

beforeEach(async () => {
  tenant = await Tenant.create({ name: 'STRIX AI SL', slug: `strix-${Date.now()}-${Math.random()}`, businessInfo: { type: 'customs_agent', eori: 'ESB22477020' } });
  const user = await User.create({ name: 'Agente', email: `a${Date.now()}${Math.random()}@x.es`, password: 'secreto123', tenantId: tenant._id });
  owner = user._id;
  aeat.submitNCTS.mockResolvedValue({ success: true, mrn: MRN, code: 'OK', estadoNcts: 'PA' });
});

async function predeclarado() {
  const t = await transitService.create(datos(), owner);
  return transitService.submit(t._id, owner);
}

describe('submit de una predeclaración (CC015C con D)', () => {
  test('queda en prelodged (PA), no en aceptada', async () => {
    const t = await predeclarado();
    expect(t.status).toBe('prelodged');
    expect(t.mrn).toBe(MRN);
    expect(t.ncts.estado).toBe('PA');
    expect(t.dates.acceptance).toBeUndefined();
  });

  test('una declaración normal sigue en accepted y guarda el estado NCTS', async () => {
    aeat.submitNCTS.mockResolvedValue({ success: true, mrn: MRN, code: 'OK', estadoNcts: 'DE', circuitoNcts: 'V', fechaLimiteLlegada: '2026-11-22' });
    const t0 = await transitService.create(datos({ additionalDeclarationType: 'A' }), owner);
    const t = await transitService.submit(t0._id, owner);
    expect(t.status).toBe('accepted');
    expect(t.ncts).toMatchObject({ estado: 'DE', circuito: 'V' });
    expect(t.deadlines.arrivalDeadline.toISOString()).toMatch(/^2026-11-22/);
  });
});

describe('presentGoods (CC170C)', () => {
  test('presenta con la ubicación indicada y pasa a accepted con el estado de la AEAT', async () => {
    const t = await predeclarado();
    aeat.submitNCTSPresentation.mockResolvedValue({ success: true, mrn: MRN, estado: 'DE', circuito: 'V', csvDat: 'CSVDAT', fechas: { admision: '2026-11-16', limiteLlegada: '2026-11-22' } });

    const r = await transitService.presentGoods(t._id, { locationAuthorisationNumber: '2801AAAAAC' }, owner);

    const [enviado, opciones, ctx] = aeat.submitNCTSPresentation.mock.calls[0];
    expect(enviado.lrn).toBe(t.lrn);
    expect(opciones).toEqual({ locationAuthorisationNumber: '2801AAAAAC' });
    expect(String(ctx.tenant._id)).toBe(String(tenant._id));
    expect(r.status).toBe('accepted');
    expect(r.additionalDeclarationType).toBe('A');
    expect(r.locationAuthorisationNumber).toBe('2801AAAAAC');
    expect(r.ncts.estado).toBe('DE');
    expect(r.dates.acceptance).toBeDefined();
    expect(r.messages.map((m) => m.type)).toContain('IE170');
  });

  test('un rechazo de la AEAT no toca el estado', async () => {
    const t = await predeclarado();
    aeat.submitNCTSPresentation.mockResolvedValue({ success: false, error: 'Ubicación incorrecta' });
    await expect(transitService.presentGoods(t._id, {}, owner)).rejects.toThrow('Ubicación incorrecta');
    expect((await Transit.findById(t._id)).status).toBe('prelodged');
  });

  test('solo en predeclaración (PA)', async () => {
    aeat.submitNCTS.mockResolvedValue({ success: true, mrn: MRN, estadoNcts: 'DE' });
    const t0 = await transitService.create(datos({ additionalDeclarationType: 'A' }), owner);
    const t = await transitService.submit(t0._id, owner);
    await expect(transitService.presentGoods(t._id, {}, owner)).rejects.toThrow(/predeclaraci/);
    expect(aeat.submitNCTSPresentation).not.toHaveBeenCalled();
  });
});

describe('amend (CC013C)', () => {
  test('manda la declaración entera con el cambio y solo lo guarda si la AEAT lo admite', async () => {
    const t = await predeclarado();
    aeat.submitNCTSAmendment.mockResolvedValue({ success: true, mrn: MRN, estado: 'PA', csv: 'CSV013' });

    const cambios = { goodsItems: [{ description: 'Ropa de cama modificada', taricCode: '6302100000', grossWeight: 24, netWeight: 20, packages: { count: 2 } }] };
    const r = await transitService.amend(t._id, cambios, owner);

    const [enviado] = aeat.submitNCTSAmendment.mock.calls[0];
    expect(enviado.mrn).toBe(MRN);
    expect(enviado.goodsItems[0].description).toBe('Ropa de cama modificada');
    expect(enviado.principal.eori).toBe('ESB22477020');
    expect(r.goodsItems[0].description).toBe('Ropa de cama modificada');
    expect(r.totals.grossWeight).toBe(24);
    expect(r.status).toBe('prelodged');
    expect(r.messages.map((m) => m.type)).toContain('IE013');
  });

  test('si la AEAT rechaza, el expediente conserva los datos admitidos', async () => {
    const t = await predeclarado();
    aeat.submitNCTSAmendment.mockResolvedValue({ success: false, error: 'TARIC inexistente' });
    await expect(transitService.amend(t._id, { goodsItems: [{ description: 'Otra', taricCode: '6302100000', grossWeight: 5 }] }, owner))
      .rejects.toThrow('TARIC inexistente');
    expect((await Transit.findById(t._id)).goodsItems[0].description).toBe('Ropa de cama');
  });

  test.each([
    ['la aduana de partida', { departureOffice: { code: 'ES004601' } }],
    ['el titular', { principal: { eori: 'ESA00000001', name: 'Otro' } }],
    ['el tipo de declaración adicional', { additionalDeclarationType: 'A' }]
  ])('no deja cambiar %s (guía 11.1)', async (_que, cambio) => {
    const t = await predeclarado();
    await expect(transitService.amend(t._id, cambio, owner)).rejects.toThrow(/no se puede modificar/i);
    expect(aeat.submitNCTSAmendment).not.toHaveBeenCalled();
  });

  test('valida la declaración modificada antes de enviarla', async () => {
    const t = await predeclarado();
    await expect(transitService.amend(t._id, { goodsItems: [{ description: '', taricCode: '6302100000', grossWeight: 5 }] }, owner))
      .rejects.toThrow(/descripcion/);
    expect(aeat.submitNCTSAmendment).not.toHaveBeenCalled();
  });

  test('un dato que el modelo no admite no sale a la AEAT', async () => {
    const t = await predeclarado();
    await expect(transitService.amend(t._id, { guarantee: { type: 'Z' } }, owner)).rejects.toThrow(/no es válida/);
    expect(aeat.submitNCTSAmendment).not.toHaveBeenCalled();
    expect((await Transit.findById(t._id)).guarantee.type).toBe('1');
  });

  test('una GRN ajena o inactiva no se cuela por la modificación', async () => {
    const { Guarantee } = require('../../src/models');
    await Guarantee.create({
      owner, type: 'CGU', name: 'G', totalAmount: 1000,
      validFrom: new Date('2026-01-01'), validUntil: new Date('2027-01-01'), status: 'draft', grn: 'GRN-INACTIVA'
    });
    const t = await predeclarado();
    await expect(transitService.amend(t._id, { guarantee: { type: '1', grn: 'GRN-INACTIVA' } }, owner)).rejects.toThrow(/no esta activa/);
    expect(aeat.submitNCTSAmendment).not.toHaveBeenCalled();
  });

  test('sin cambios no hay nada que enviar', async () => {
    const t = await predeclarado();
    await expect(transitService.amend(t._id, {}, owner)).rejects.toThrow(/cambio/i);
  });

  test('solo en predeclaración', async () => {
    aeat.submitNCTS.mockResolvedValue({ success: true, mrn: MRN, estadoNcts: 'DE' });
    const t0 = await transitService.create(datos({ additionalDeclarationType: 'A' }), owner);
    const t = await transitService.submit(t0._id, owner);
    await expect(transitService.amend(t._id, { notes: 'x' }, owner)).rejects.toThrow(/predeclaraci/);
  });
});

describe('invalidate (CC014C)', () => {
  test('anula la predeclaración: estado CA y tránsito cancelado', async () => {
    const t = await predeclarado();
    aeat.submitNCTSInvalidation.mockResolvedValue({ success: true, mrn: MRN, estado: 'CA', csv: 'CSV014', fechas: { invalidacion: '2026-11-16' } });

    const r = await transitService.invalidate(t._id, { motivo: 'Mercancía no sale' }, owner);

    expect(aeat.submitNCTSInvalidation.mock.calls[0][1]).toEqual({ motivo: 'Mercancía no sale' });
    expect(r.status).toBe('cancelled');
    expect(r.ncts.estado).toBe('CA');
    expect(r.messages.map((m) => m.type)).toContain('IE014');
    expect(r.statusHistory.at(-1).reason).toContain('Mercancía no sale');
  });

  test('también con garantía extranjera pendiente (PG)', async () => {
    aeat.submitNCTS.mockResolvedValue({ success: true, mrn: MRN, estadoNcts: 'PG' });
    const t0 = await transitService.create(datos({ additionalDeclarationType: 'A' }), owner);
    const t = await transitService.submit(t0._id, owner);
    aeat.submitNCTSInvalidation.mockResolvedValue({ success: true, mrn: MRN, estado: 'IV' });
    const r = await transitService.invalidate(t._id, { motivo: 'La garantía extranjera no responde' }, owner);
    expect(r.status).toBe('cancelled');
    expect(r.ncts.estado).toBe('IV');
  });

  test('despachado (DE) no se anula por servicio web: se dice dónde pedirlo', async () => {
    aeat.submitNCTS.mockResolvedValue({ success: true, mrn: MRN, estadoNcts: 'DE' });
    const t0 = await transitService.create(datos({ additionalDeclarationType: 'A' }), owner);
    const t = await transitService.submit(t0._id, owner);
    await expect(transitService.invalidate(t._id, { motivo: 'x' }, owner)).rejects.toThrow(/aduana de partida.*registro/);
    expect(aeat.submitNCTSInvalidation).not.toHaveBeenCalled();
  });

  test('sin motivo no se pide', async () => {
    const t = await predeclarado();
    await expect(transitService.invalidate(t._id, { motivo: ' ' }, owner)).rejects.toThrow(/motivo/);
    expect(aeat.submitNCTSInvalidation).not.toHaveBeenCalled();
  });

  test('un rechazo deja el tránsito como estaba', async () => {
    const t = await predeclarado();
    aeat.submitNCTSInvalidation.mockResolvedValue({ success: false, error: 'Estado incorrecto' });
    await expect(transitService.invalidate(t._id, { motivo: 'x' }, owner)).rejects.toThrow('Estado incorrecto');
    expect((await Transit.findById(t._id)).status).toBe('prelodged');
  });
});

describe('aislamiento: el tránsito de otro usuario no existe para mí', () => {
  test.each([
    ['presentGoods', (id, u) => transitService.presentGoods(id, {}, u)],
    ['amend', (id, u) => transitService.amend(id, { notes: 'x' }, u)],
    ['invalidate', (id, u) => transitService.invalidate(id, { motivo: 'x' }, u)]
  ])('%s', async (_n, accion) => {
    const t = await predeclarado();
    await expect(accion(t._id, new mongoose.Types.ObjectId())).rejects.toThrow('Transito no encontrado');
    expect(aeat.submitNCTSPresentation).not.toHaveBeenCalled();
    expect(aeat.submitNCTSAmendment).not.toHaveBeenCalled();
    expect(aeat.submitNCTSInvalidation).not.toHaveBeenCalled();
  });
});
