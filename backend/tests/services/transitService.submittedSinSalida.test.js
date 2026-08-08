/**
 * El estado `submitted` era un callejon sin salida.
 *
 * Hallado en el E2E de 8/Ago/2026 probando las seis transiciones contra un
 * transito real en `submitted`: TODAS lo rechazan (`submit` exige draft,
 * `release-departure` exige accepted, `start` exige released...), la UI no
 * ofrece ningun boton para ese estado, y ninguna transicion de `transitService`
 * lo asigna: solo los seeds. Un transito que llegue ahi no puede moverse ni
 * borrarse (el borrado exige draft).
 *
 * `submitted` significa "el IE015 salio y aun no ha llegado el IE028 con el
 * MRN": un estado real de NCTS, no un error. La salida correcta es reintentar
 * el envio, no obligar al operador a crear el expediente otra vez.
 *
 * Lo que se prueba:
 *   1. `submit` acepta reintentar desde `submitted` mientras no haya MRN.
 *   2. Un `submitted` CON mrn es incoherente (si AEAT dio MRN, esta accepted):
 *      no se reenvia, se corrige el estado sin volver a molestar a AEAT.
 *   3. El resto de guardas siguen intactas (accepted no se reenvia).
 *   4. Un `submitted` se puede anular, para no dejar expedientes zombis.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('./../helpers/memoryDb');

jest.mock('../../src/services/aeat/aeatSubmitService', () => ({
  submitNCTS: jest.fn(),
  submitNCTSArrival: jest.fn(),
  submitNCTSUnloading: jest.fn()
}));

const { Transit } = require('../../src/models');
const aeatSubmitService = require('../../src/services/aeat/aeatSubmitService');
const transitService = require('../../src/services/transitService');

usarBaseDeDatosEnMemoria();

const OWNER = () => new mongoose.Types.ObjectId();

beforeEach(() => {
  aeatSubmitService.submitNCTS.mockResolvedValue({
    success: true, mrn: '26ES0028015010A1B2', code: 'IE028'
  });
});

/** Transito enviado sin respuesta de AEAT: IE015 fuera, IE028 sin llegar. */
async function transitoEnviadoSinMRN(owner, extra = {}) {
  return Transit.create({
    owner,
    reference: 'REF-SUB-001',
    lrn: 'LRNSUBMITTED01',
    transitType: 'T1',
    status: 'submitted',
    departureOffice: { code: 'ES002801' },
    destinationOffice: { code: 'ES002901' },
    transport: { mode: '3' },
    principal: { eori: 'ESB22477020', name: 'STRIX AI SL' },
    guarantee: { type: '1' },
    goodsItems: [{ itemNumber: 1, description: 'Tuberias', taricCode: '73041100', grossWeight: 450 }],
    ...extra
  });
}

describe('submit: reintento desde `submitted`', () => {
  it('reenvia el IE015 y pasa a accepted con el MRN que devuelve AEAT', async () => {
    const owner = OWNER();
    const t = await transitoEnviadoSinMRN(owner);

    const res = await transitService.submit(t._id, owner);

    expect(aeatSubmitService.submitNCTS).toHaveBeenCalled();
    expect(res.status).toBe('accepted');
    expect(res.mrn).toBe('26ES0028015010A1B2');
  });

  it('un transito draft sigue enviandose igual que antes', async () => {
    const owner = OWNER();
    const t = await transitoEnviadoSinMRN(owner, { status: 'draft', lrn: 'LRNDRAFT0001' });

    const res = await transitService.submit(t._id, owner);
    expect(res.status).toBe('accepted');
  });

  it('un transito ya aceptado NO se reenvia (duplicaria la declaracion)', async () => {
    const owner = OWNER();
    const t = await transitoEnviadoSinMRN(owner, {
      status: 'accepted', mrn: '26ES0028015010Z9Y8', lrn: 'LRNACCEPTED001'
    });

    await expect(transitService.submit(t._id, owner)).rejects.toThrow(/borrador|enviad/i);
    expect(aeatSubmitService.submitNCTS).not.toHaveBeenCalled();
  });

  it('si el reintento vuelve a fallar el transito se queda en submitted, no en draft', async () => {
    aeatSubmitService.submitNCTS.mockResolvedValue({ success: false, error: 'Timeout NCTS' });
    const owner = OWNER();
    const t = await transitoEnviadoSinMRN(owner);

    await expect(transitService.submit(t._id, owner)).rejects.toThrow(/Timeout NCTS/);

    const recargado = await Transit.findById(t._id);
    expect(recargado.status).toBe('submitted');
  });
});

describe('submitted con MRN: estado incoherente', () => {
  it('no reenvia a AEAT un transito que ya tiene MRN: corrige el estado a accepted', async () => {
    // Los seeds creaban exactamente esto: `submitted` con MRN asignado. Si AEAT
    // dio MRN, la declaracion esta aceptada; reenviarla la duplicaria.
    const owner = OWNER();
    const t = await transitoEnviadoSinMRN(owner, { mrn: '26ES0028015010C3D4' });

    const res = await transitService.submit(t._id, owner);

    expect(aeatSubmitService.submitNCTS).not.toHaveBeenCalled();
    expect(res.status).toBe('accepted');
    expect(res.mrn).toBe('26ES0028015010C3D4');
  });

  it('deja constancia en el historial de por que cambio de estado', async () => {
    const owner = OWNER();
    const t = await transitoEnviadoSinMRN(owner, { mrn: '26ES0028015010C3D4' });

    const res = await transitService.submit(t._id, owner);
    const ultimo = res.statusHistory[res.statusHistory.length - 1];
    expect(ultimo.status).toBe('accepted');
    expect(ultimo.reason).toMatch(/MRN/);
  });

  it('marca `$locals.declaracionEnviada` a false para que el aviso no mienta', async () => {
    // El controlador respondia "Declaracion enviada. MRN asignado: X" tambien
    // en este camino, en el que NO se envia nada: el operador leia que su
    // declaracion habia salido cuando solo se corrigio el estado.
    const owner = OWNER();
    const t = await transitoEnviadoSinMRN(owner, { mrn: '26ES0028015010C3D4' });

    const res = await transitService.submit(t._id, owner);
    expect(res.$locals.declaracionEnviada).toBe(false);
  });

  it('marca `$locals.declaracionEnviada` a true cuando el IE015 si sale', async () => {
    const owner = OWNER();
    const t = await transitoEnviadoSinMRN(owner);

    const res = await transitService.submit(t._id, owner);
    expect(res.$locals.declaracionEnviada).toBe(true);
  });
});

describe('borrado: un submitted no se borra en local', () => {
  it('no se puede eliminar un transito cuyo IE015 ya salio', async () => {
    // Puede que AEAT lo haya recibido: borrarlo aqui perderia el rastro de una
    // declaracion que existe en NCTS. La salida es reintentar el envio.
    // (El enum del modelo tiene 'cancelled' pero NINGUNA transicion lo asigna:
    // anular un transito no esta implementado. Hallazgo aparte.)
    const owner = OWNER();
    const t = await transitoEnviadoSinMRN(owner);

    await expect(transitService.delete(t._id, owner)).rejects.toThrow();
    expect(await Transit.findById(t._id)).not.toBeNull();
  });
});
