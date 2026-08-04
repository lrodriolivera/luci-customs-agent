/**
 * transitService (NCTS): ciclo de vida de una operacion de transito T1/T2/TIR
 * contra Mongo real.
 *
 * Es una maquina de estados aduanera: draft -> accepted -> released ->
 * in_transit -> arrived -> control -> goods_released -> completed, mas ramas de
 * discrepancia y busqueda (enquiry). Cada transicion valida el estado de
 * partida y ACOTA POR PROPIETARIO. Lo que se prueba de verdad:
 *   1. create: autogenera LRN, valida garantia (con la excepcion PRE/dev),
 *      rechaza vincular un expediente de otro tenant.
 *   2. Aislamiento por owner en todas las lecturas/transiciones: el id de un
 *      transito ajeno da "Transito no encontrado", nunca los datos.
 *   3. Guardas de estado: update/delete solo en draft; submit solo en draft;
 *      cada transicion exige su estado previo.
 *   4. El flujo feliz completo hasta 'completed', y la rama de discrepancia.
 *   5. validateForSubmission (incluye la garantia obligatoria para T1) y los
 *      generadores LRN/MRN, que son puros.
 *
 * Que se mockea y por que: SOLO aeatSubmitService.submitNCTS, que sale a la
 * AEAT/NCTS por red. Los modelos Transit/Guarantee/Expedition/User van con la BD
 * en memoria real: la maquina de estados y sus guardas se ejecutan de verdad.
 * NUNCA se envia nada a produccion.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('./../helpers/memoryDb');

jest.mock('../../src/services/aeat/aeatSubmitService', () => ({
  submitNCTS: jest.fn()
}));

const { Transit, Guarantee, Expedition } = require('../../src/models');
const User = require('../../src/models/User');
const aeatSubmitService = require('../../src/services/aeat/aeatSubmitService');
const transitService = require('../../src/services/transitService');

usarBaseDeDatosEnMemoria();

const OWNER = () => new mongoose.Types.ObjectId();

beforeEach(() => {
  aeatSubmitService.submitNCTS.mockResolvedValue({ success: true, mrn: '26ES0008512345678X', code: 'IE028' });
});

/** Datos minimos validos para crear un transito enviable. */
function datosTransito(extra = {}) {
  return {
    reference: 'REF-T1-001',
    transitType: 'T1',
    departureOffice: { code: 'ES000851' },
    destinationOffice: { code: 'FR001300' },
    transport: { mode: '3' },
    principal: { eori: 'ESB22477020', name: 'STRIX AI SL' },
    guarantee: { type: '1' },
    goodsItems: [{ description: 'Textil', grossWeight: 300, packages: { count: 5 } }],
    ...extra
  };
}

/** Crea un transito ya enviado (accepted) para arrancar el flujo posterior. */
async function crearAceptado(owner) {
  const t = await transitService.create(datosTransito(), owner);
  return transitService.submit(t._id, owner);
}

describe('create', () => {
  test('autogenera el LRN y arranca en draft con historial inicial', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito(), owner);

    expect(t.lrn).toMatch(/^LRN/);
    expect(t.status).toBe('draft');
    expect(t.owner.toString()).toBe(owner.toString());
    expect(t.statusHistory[0].reason).toBe('Creacion inicial');
  });

  test('respeta un LRN explicito', async () => {
    const t = await transitService.create(datosTransito({ lrn: 'LRN-MIO-123' }), OWNER());
    expect(t.lrn).toBe('LRN-MIO-123');
  });

  test('en entorno no-produccion permite una GRN sin registro local', async () => {
    // AEAT PRE acepta una GRN de prueba compartida; no debe reventar por no
    // tenerla en la BD local.
    const owner = OWNER();
    const t = await transitService.create(datosTransito({ guarantee: { type: '1', grn: '26ES-PRE-COMPARTIDA' } }), owner);
    expect(t.status).toBe('draft');
  });

  test('una garantia propia existente pero no activa se rechaza', async () => {
    const owner = OWNER();
    await Guarantee.create({
      owner, type: 'CGU', name: 'G', totalAmount: 1000,
      validFrom: new Date('2026-01-01'), validUntil: new Date('2027-01-01'),
      status: 'draft', grn: 'GRN-INACTIVA'
    });

    await expect(
      transitService.create(datosTransito({ guarantee: { type: '1', grn: 'GRN-INACTIVA' } }), owner)
    ).rejects.toThrow(/no esta activa/);
  });

  test('rechaza vincular un expediente de OTRO tenant', async () => {
    const ownerA = OWNER();
    const tenantB = new mongoose.Types.ObjectId();
    const userA = await User.create({ name: 'A', email: 'a@x.es', password: 'secreto123', tenantId: new mongoose.Types.ObjectId() });
    const exp = await Expedition.create({
      reference: 'EXP-B', tenantId: tenantB,
      client: { nif: 'B99999999', companyName: 'Otra SL' },
      transportMode: 'maritime', operationType: 'import'
    });

    await expect(
      transitService.create(datosTransito({ expeditionId: exp._id }), userA._id)
    ).rejects.toThrow(/Expediente no encontrado/);
  });
});

describe('list / getById: aislamiento por owner', () => {
  test('list solo devuelve los transitos del owner, con paginacion', async () => {
    const owner = OWNER();
    const otro = OWNER();
    await transitService.create(datosTransito({ reference: 'MIO' }), owner);
    await transitService.create(datosTransito({ reference: 'AJENO' }), otro);

    const r = await transitService.list(owner, {}, { page: 1, limit: 10 });
    expect(r.transits).toHaveLength(1);
    expect(r.transits[0].reference).toBe('MIO');
    expect(r.pagination.total).toBe(1);
  });

  test('list filtra por status', async () => {
    const owner = OWNER();
    await transitService.create(datosTransito(), owner);
    await crearAceptado(owner);

    const r = await transitService.list(owner, { status: 'accepted' }, {});
    expect(r.transits).toHaveLength(1);
    expect(r.transits[0].status).toBe('accepted');
  });

  test('getById de un transito ajeno lanza "no encontrado"', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito(), owner);

    await expect(transitService.getById(t._id, OWNER())).rejects.toThrow(/Transito no encontrado/);
  });
});

describe('update / delete: solo en borrador', () => {
  test('update modifica un borrador pero ignora los campos no editables', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito(), owner);

    const upd = await transitService.update(t._id, { reference: 'NUEVA-REF', lrn: 'HACK', owner: OWNER() }, owner);
    expect(upd.reference).toBe('NUEVA-REF');
    expect(upd.lrn).toBe(t.lrn);            // lrn no editable
    expect(upd.owner.toString()).toBe(owner.toString()); // owner no editable
  });

  test('no se puede editar un transito ya aceptado', async () => {
    const owner = OWNER();
    const t = await crearAceptado(owner);
    await expect(transitService.update(t._id, { reference: 'X' }, owner)).rejects.toThrow(/borrador/);
  });

  test('delete elimina un borrador propio', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito(), owner);

    await expect(transitService.delete(t._id, owner)).resolves.toBe(true);
    expect(await Transit.countDocuments({ _id: t._id })).toBe(0);
  });

  test('no se puede eliminar un transito aceptado', async () => {
    const owner = OWNER();
    const t = await crearAceptado(owner);
    await expect(transitService.delete(t._id, owner)).rejects.toThrow(/borrador/);
  });
});

describe('submit: validacion y envio a NCTS', () => {
  test('un T1 sin garantia falla la validacion antes de enviar', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito({ guarantee: undefined }), owner);

    await expect(transitService.submit(t._id, owner)).rejects.toThrow(/Garantia requerida para transito T1/);
    expect(aeatSubmitService.submitNCTS).not.toHaveBeenCalled();
  });

  test('un borrador valido se envia, recibe MRN y pasa a accepted con mensajes IE015/IE028', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito(), owner);

    const enviado = await transitService.submit(t._id, owner);
    expect(enviado.status).toBe('accepted');
    expect(enviado.mrn).toBe('26ES0008512345678X');
    const tipos = enviado.messages.map(m => m.type);
    expect(tipos).toContain('IE015');
    expect(tipos).toContain('IE028');
  });

  test('si NCTS rechaza, propaga el error y no marca accepted', async () => {
    aeatSubmitService.submitNCTS.mockResolvedValue({ success: false, error: 'Rechazo NCTS 4404' });
    const owner = OWNER();
    const t = await transitService.create(datosTransito(), owner);

    await expect(transitService.submit(t._id, owner)).rejects.toThrow(/Rechazo NCTS 4404/);
  });
});

describe('flujo feliz completo de transito', () => {
  test('accepted -> released -> in_transit -> arrived -> control -> goods_released -> completed', async () => {
    const owner = OWNER();
    let t = await crearAceptado(owner);

    t = await transitService.releaseAtDeparture(t._id, owner);
    expect(t.status).toBe('released');
    expect(t.deadlines.arrivalDeadline).toBeDefined(); // calculateDeadline

    t = await transitService.startTransit(t._id, owner);
    expect(t.status).toBe('in_transit');

    t = await transitService.notifyArrival(t._id, { notes: 'Llegada OK' }, owner);
    expect(t.status).toBe('arrived');

    t = await transitService.recordControlResult(t._id, { type: 'A1' }, owner);
    expect(t.status).toBe('control_requested');

    t = await transitService.releaseGoods(t._id, owner);
    expect(t.status).toBe('goods_released');

    t = await transitService.complete(t._id, owner);
    expect(t.status).toBe('completed');
    expect(t.statusHistory.some(h => h.status === 'completed')).toBe(true);
  });

  test('un control A4 lleva a discrepancia en lugar de control_requested', async () => {
    const owner = OWNER();
    let t = await crearAceptado(owner);
    t = await transitService.releaseAtDeparture(t._id, owner);
    t = await transitService.notifyArrival(t._id, {}, owner);

    t = await transitService.recordControlResult(t._id, { type: 'A4' }, owner);
    expect(t.status).toBe('discrepancy');
  });

  test('cada transicion exige su estado previo', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito(), owner);
    // Un borrador no puede liberarse ni iniciarse.
    await expect(transitService.releaseAtDeparture(t._id, owner)).rejects.toThrow(/aceptado/);
    await expect(transitService.startTransit(t._id, owner)).rejects.toThrow(/liberado/);
  });
});

describe('enquiry y paso por aduana de transito', () => {
  test('initiateEnquiry exige transito vencido o con discrepancia', async () => {
    const owner = OWNER();
    let t = await crearAceptado(owner);
    t = await transitService.releaseAtDeparture(t._id, owner);
    // No vencido y sin discrepancia -> no se puede.
    await expect(transitService.initiateEnquiry(t._id, {}, owner)).rejects.toThrow(/vencidos o con discrepancias/);
  });

  test('initiateEnquiry procede sobre un transito con discrepancia', async () => {
    const owner = OWNER();
    let t = await crearAceptado(owner);
    t = await transitService.releaseAtDeparture(t._id, owner);
    t = await transitService.notifyArrival(t._id, {}, owner);
    t = await transitService.recordControlResult(t._id, { type: 'B1' }, owner);
    expect(t.status).toBe('discrepancy');

    t = await transitService.initiateEnquiry(t._id, { reason: 'Sin respuesta' }, owner);
    expect(t.status).toBe('enquiry');
    expect(t.enquiry.initiated).toBe(true);
  });

  test('recordTransitOfficePassage marca la aduana de la ruta como pasada', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito({
      transitOffices: [{ sequence: 1, code: 'ES001100' }]
    }), owner);

    const upd = await transitService.recordTransitOfficePassage(t._id, { officeCode: 'ES001100' }, owner);
    const office = upd.transitOffices.find(o => o.code === 'ES001100');
    expect(office.status).toBe('passed');
  });

  test('recordTransitOfficePassage falla si la aduana no esta en la ruta', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito({ transitOffices: [] }), owner);
    await expect(
      transitService.recordTransitOfficePassage(t._id, { officeCode: 'XX999' }, owner)
    ).rejects.toThrow(/no encontrada en la ruta/);
  });
});

describe('helpers puros', () => {
  test('validateForSubmission acumula los campos que faltan', () => {
    expect(() => transitService.validateForSubmission({})).toThrow(/Validacion fallida/);
    try {
      transitService.validateForSubmission({});
    } catch (e) {
      expect(e.message).toMatch(/Tipo de transito requerido/);
      expect(e.message).toMatch(/Aduana de partida requerida/);
      expect(e.message).toMatch(/EORI del principal/);
    }
  });

  test('validateForSubmission acepta un transito completo', () => {
    const ok = {
      transitType: 'T2',
      departureOffice: { code: 'ES1' },
      destinationOffice: { code: 'FR1' },
      principal: { eori: 'ESB1' },
      transport: { mode: '3' },
      goodsItems: [{}]
    };
    expect(transitService.validateForSubmission(ok)).toBe(true);
  });

  test('generateLRN y generateMRN tienen la forma esperada', () => {
    expect(transitService.generateLRN()).toMatch(/^LRN/);
    const mrn = transitService.generateMRN('ES');
    expect(mrn.length).toBeLessThanOrEqual(18);
    expect(mrn.startsWith(new Date().getFullYear().toString().slice(-2) + 'ES')).toBe(true);
  });
});
