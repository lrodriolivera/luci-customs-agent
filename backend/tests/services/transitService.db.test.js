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
  submitNCTS: jest.fn(),
  submitNCTSArrival: jest.fn(),
  submitNCTSUnloading: jest.fn()
}));

const { Transit, Guarantee, Expedition } = require('../../src/models');
const User = require('../../src/models/User');
const aeatSubmitService = require('../../src/services/aeat/aeatSubmitService');
const transitService = require('../../src/services/transitService');

usarBaseDeDatosEnMemoria();

const OWNER = () => new mongoose.Types.ObjectId();

beforeEach(() => {
  aeatSubmitService.submitNCTS.mockResolvedValue({ success: true, mrn: '26ES0008512345678X', code: 'IE028' });
  aeatSubmitService.submitNCTSArrival.mockResolvedValue({ success: true, code: 'CC007' });
  aeatSubmitService.submitNCTSUnloading.mockResolvedValue({ success: true, code: 'CC044' });
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
    // taricCode real (tubos de acero sin soldadura). La fixture no lo llevaba y
    // por eso `submit` pasaba en los tests mientras AEAT rechazaba en produccion.
    goodsItems: [{ description: 'Textil', taricCode: '73043100', grossWeight: 300, packages: { count: 5 } }],
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
      goodsItems: [{ description: 'Tubos de acero', taricCode: '73043100', grossWeight: 300 }]
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

/**
 * E2E 8/Ago: "Enviar a NCTS" devolvia 400 de AEAT con el mensaje ininteligible
 * "El elemento no cumple con el formato exigido. Patron: ([1-9]\d*(\.\d+)?)|(0\.\d*[1-9]\d*)"
 * porque el formulario de la UI no pide las partidas de mercancia y `goodsItems`
 * viajaba con `description:''`, `taricCode:''` y `grossWeight:0`. El patron es el
 * de <ent:grossMass>: AEAT no admite 0.000. `validateForSubmission` solo miraba
 * que el array tuviese longitud, asi que dejaba pasar una partida vacia y el
 * rechazo aparecia a mitad del flujo, con un texto que no nombra ningun campo.
 */
describe('validateForSubmission: partidas de mercancia con contenido', () => {
  test('rechaza una partida con peso bruto 0 nombrando el campo', () => {
    const t = {
      transitType: 'T1',
      departureOffice: { code: 'ES000851' },
      destinationOffice: { code: 'FR001300' },
      principal: { eori: 'ESB22477020' },
      transport: { mode: '3' },
      guarantee: { type: '1' },
      goodsItems: [{ description: 'Textil', taricCode: '73181500', grossWeight: 0 }]
    };
    expect(() => transitService.validateForSubmission(t)).toThrow(/peso bruto/i);
  });

  test('rechaza una partida sin descripcion ni codigo TARIC', () => {
    const base = {
      transitType: 'T1',
      departureOffice: { code: 'ES000851' },
      destinationOffice: { code: 'FR001300' },
      principal: { eori: 'ESB22477020' },
      transport: { mode: '3' },
      guarantee: { type: '1' }
    };
    expect(() => transitService.validateForSubmission({
      ...base, goodsItems: [{ description: '', taricCode: '73181500', grossWeight: 100 }]
    })).toThrow(/descripcion/i);
    expect(() => transitService.validateForSubmission({
      ...base, goodsItems: [{ description: 'Textil', taricCode: '', grossWeight: 100 }]
    })).toThrow(/TARIC/i);
  });

  test('acepta una partida completa', () => {
    const t = {
      transitType: 'T1',
      departureOffice: { code: 'ES000851' },
      destinationOffice: { code: 'FR001300' },
      principal: { eori: 'ESB22477020' },
      transport: { mode: '3' },
      guarantee: { type: '1' },
      goodsItems: [{ description: 'Tubos de acero', taricCode: '73181500', grossWeight: 300 }]
    };
    expect(transitService.validateForSubmission(t)).toBe(true);
  });

  test('el numero de partida indica cual falla cuando hay varias', () => {
    const t = {
      transitType: 'T1',
      departureOffice: { code: 'ES000851' },
      destinationOffice: { code: 'FR001300' },
      principal: { eori: 'ESB22477020' },
      transport: { mode: '3' },
      guarantee: { type: '1' },
      goodsItems: [
        { description: 'Tubos', taricCode: '73181500', grossWeight: 300 },
        { description: 'Bridas', taricCode: '73072100', grossWeight: 0 }
      ]
    };
    expect(() => transitService.validateForSubmission(t)).toThrow(/2/);
  });

  test('submit no llama a AEAT cuando la partida esta vacia', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito({
      goodsItems: [{ description: '', taricCode: '', grossWeight: 0 }]
    }), owner);
    await expect(transitService.submit(t._id, owner)).rejects.toThrow(/Validacion fallida/);
    expect(aeatSubmitService.submitNCTS).not.toHaveBeenCalled();
  });
});

/**
 * E2E 8/Ago: el formulario de "Nuevo Transito" manda los precintos en la raiz
 * (`seals`) y el modelo los guarda en `transport.seals`. `create` hace `...data`,
 * asi que Mongoose descartaba la clave desconocida en silencio: el precinto
 * escrito por el usuario desaparecia y el transito se enviaba a AEAT sin
 * precintos declarados. El fix normaliza la clave en el servicio para no depender
 * de que todos los clientes de la API acierten con la forma anidada.
 */
describe('create: normaliza los precintos de la raiz a transport.seals', () => {
  test('mueve seals de la raiz a transport.seals', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito({
      seals: [{ number: 'PRE-001', sealType: 'customs', affixedBy: 'Aduana ES004801' }]
    }), owner);
    expect(t.transport.seals).toHaveLength(1);
    expect(t.transport.seals[0].number).toBe('PRE-001');
    expect(t.transport.sealCount).toBe(1);
  });

  test('descarta los precintos con el numero vacio (fila en blanco del formulario)', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito({
      seals: [{ number: '', sealType: 'customs', affixedBy: '' }]
    }), owner);
    expect(t.transport.seals).toHaveLength(0);
    expect(t.transport.sealCount).toBe(0);
  });

  test('no pisa los precintos que ya vienen en transport.seals', async () => {
    const owner = OWNER();
    const t = await transitService.create(datosTransito({
      transport: { mode: '3', seals: [{ number: 'ANIDADO-1' }] },
      seals: [{ number: 'RAIZ-1' }]
    }), owner);
    expect(t.transport.seals.map(s => s.number)).toEqual(['ANIDADO-1']);
  });
});

/**
 * E2E 8/Ago (bug #5 de /transit): "Notificar Llegada" decia OK en la UI y el
 * transito se quedaba en `in_transit`. Habia DOS definiciones de
 * `notifyArrival` en el controller: la buena (que llama a este servicio, empuja
 * el IE160 y escribe en statusHistory) quedaba pisada por una asignacion
 * posterior que enviaba el CC007 a AEAT y respondia `{success:true}` incluso
 * cuando AEAT rechazaba. Consecuencia: el ciclo se cortaba ahi y "Liberar
 * Mercancias"/"Completar" nunca aparecian.
 *
 * El servicio pasa a ser el unico dueno de la transicion y ademas envia el
 * CC007/CC044 de verdad: si AEAT rechaza, no hay cambio de estado.
 */
describe('notifyArrival / notifyUnloading: envio real a AEAT + transicion de estado', () => {
  async function enTransito(owner) {
    let t = await crearAceptado(owner);
    t = await transitService.releaseAtDeparture(t._id, owner);
    return transitService.startTransit(t._id, owner);
  }

  test('notifyArrival envia el CC007 a AEAT con el MRN y la aduana de destino', async () => {
    const owner = OWNER();
    const t = await enTransito(owner);

    const actualizado = await transitService.notifyArrival(t._id, { notes: 'Llegada OK' }, owner);

    expect(aeatSubmitService.submitNCTSArrival).toHaveBeenCalledWith(expect.objectContaining({
      mrn: '26ES0008512345678X',
      officeOfDestination: 'FR001300'
    }));
    expect(actualizado.status).toBe('arrived');
    expect(actualizado.messages.some(m => m.type === 'IE160')).toBe(true);
    expect(actualizado.statusHistory.some(h => h.status === 'arrived')).toBe(true);
  });

  test('si AEAT rechaza el CC007 el transito NO pasa a arrived', async () => {
    const owner = OWNER();
    const t = await enTransito(owner);
    aeatSubmitService.submitNCTSArrival.mockResolvedValue({ success: false, error: 'Rechazo CC007 4404' });

    await expect(transitService.notifyArrival(t._id, {}, owner)).rejects.toThrow(/4404/);

    const guardado = await Transit.findById(t._id);
    expect(guardado.status).toBe('in_transit');
    expect(guardado.messages.some(m => m.type === 'IE160')).toBe(false);
  });

  /**
   * El CC007 espanol necesita tres datos de recepcion que no son del tránsito
   * sino del recinto donde llega: la ubicacion autorizada, la autorizacion ACE de
   * destinatario autorizado y la sumaria de recepcion previa. El servicio los
   * propaga si el tránsito los trae —quien decide los defaults de PRE es
   * aeatSubmitService, no este servicio, que no debe saber de entornos.
   */
  test('propaga los datos de recepcion del transito al CC007', async () => {
    const owner = OWNER();
    const t = await enTransito(owner);
    const guardado = await Transit.findById(t._id);
    guardado.locationAuthorisationNumber = '2901MLG005';
    guardado.authorisationNumber = 'ESACE02026000008';
    guardado.numeroSumariaRecepcion = '29016000001';
    await guardado.save();

    await transitService.notifyArrival(t._id, {}, owner);

    expect(aeatSubmitService.submitNCTSArrival).toHaveBeenCalledWith(expect.objectContaining({
      authorisationNumber: '2901MLG005',
      authorisationReference: 'ESACE02026000008',
      numeroSumariaRecepcion: '29016000001'
    }));
  });

  /**
   * El rechazo 856 de AEAT llega como "ADDS_No existe ninguna partida no anulada
   * con el transito asociado", jerga que no dice al usuario que hacer. Significa
   * que en el recinto de destino no hay ninguna declaracion sumaria (G4/DSDT) que
   * referencie el transito, y eso NO se arregla desde LUCI: lo declara el
   * almacen de deposito temporal cuando recibe la mercancia.
   */
  test('traduce el rechazo 856 de AEAT a algo que el usuario pueda accionar', async () => {
    const owner = OWNER();
    const t = await enTransito(owner);
    aeatSubmitService.submitNCTSArrival.mockResolvedValue({
      success: false,
      error: '/CC007C/Indicadores007/numeroSumariaRecepcion: ADDS_No existe ninguna partida no anulada con el tránsito asociado: 26ES0008512345678X en el recinto 001300'
    });

    await expect(transitService.notifyArrival(t._id, {}, owner))
      .rejects.toThrow(/sumaria|dep[oó]sito temporal/i);
    // El texto crudo de AEAT se conserva, para no perder trazabilidad.
    await expect(transitService.notifyArrival(t._id, {}, owner)).rejects.toThrow(/001300/);
  });

  test('notifyArrival exige MRN: sin el no se llama a AEAT', async () => {
    const owner = OWNER();
    // Transito forzado a in_transit sin pasar por submit -> sin MRN.
    const t = await transitService.create(datosTransito(), owner);
    t.status = 'in_transit';
    await t.save();

    await expect(transitService.notifyArrival(t._id, {}, owner)).rejects.toThrow(/MRN/);
    expect(aeatSubmitService.submitNCTSArrival).not.toHaveBeenCalled();
  });

  test('notifyUnloading envia el CC044, pasa a unloaded y deja rastro', async () => {
    const owner = OWNER();
    let t = await enTransito(owner);
    t = await transitService.notifyArrival(t._id, {}, owner);

    const actualizado = await transitService.notifyUnloading(t._id, { sealsOk: true, goodsConform: true }, owner);

    expect(aeatSubmitService.submitNCTSUnloading).toHaveBeenCalledWith(expect.objectContaining({
      mrn: '26ES0008512345678X'
    }));
    expect(actualizado.status).toBe('unloaded');
    expect(actualizado.messages.some(m => m.type === 'IE044')).toBe(true);
    expect(actualizado.statusHistory.some(h => h.status === 'unloaded')).toBe(true);
    expect(actualizado.dates.unloadingNotification).toBeDefined();
  });

  test('notifyUnloading exige que el transito haya llegado', async () => {
    const owner = OWNER();
    const t = await enTransito(owner);
    await expect(transitService.notifyUnloading(t._id, {}, owner)).rejects.toThrow(/llegado/);
    expect(aeatSubmitService.submitNCTSUnloading).not.toHaveBeenCalled();
  });

  test('si AEAT rechaza el CC044 el transito sigue en arrived', async () => {
    const owner = OWNER();
    let t = await enTransito(owner);
    t = await transitService.notifyArrival(t._id, {}, owner);
    aeatSubmitService.submitNCTSUnloading.mockResolvedValue({ success: false, error: 'Rechazo CC044' });

    await expect(transitService.notifyUnloading(t._id, {}, owner)).rejects.toThrow(/CC044/);
    const guardado = await Transit.findById(t._id);
    expect(guardado.status).toBe('arrived');
  });

  test('un transito ajeno no se puede notificar', async () => {
    const t = await enTransito(OWNER());
    await expect(transitService.notifyArrival(t._id, {}, OWNER())).rejects.toThrow(/no encontrado/);
    await expect(transitService.notifyUnloading(t._id, {}, OWNER())).rejects.toThrow(/no encontrado/);
    expect(aeatSubmitService.submitNCTSArrival).not.toHaveBeenCalled();
  });

  test('unloaded sigue permitiendo liberar mercancias (el ciclo no se corta)', async () => {
    const owner = OWNER();
    let t = await enTransito(owner);
    t = await transitService.notifyArrival(t._id, {}, owner);
    t = await transitService.notifyUnloading(t._id, {}, owner);

    t = await transitService.releaseGoods(t._id, owner);
    expect(t.status).toBe('goods_released');

    t = await transitService.complete(t._id, owner);
    expect(t.status).toBe('completed');
  });
});
