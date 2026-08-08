/**
 * NCTS: la llegada de un transito solo se notifica a la aduana del pais DONDE
 * TERMINA el transito, y LUCI solo habla con AEAT.
 *
 * Hallado en el E2E de 8/Ago/2026 sobre datos vivos: 13 de los 15 transitos
 * tenian aduana de destino extranjera (DE004600, FR001000, IT001001, NL000500,
 * BE000100) y LUCI ofrecia igualmente "Notificar Llegada" y "Notificar Descarga".
 * Ambas envian el CC007/CC044 a AEAT, que no es la aduana de destino de ese
 * transito: el mensaje no puede prosperar, y el rechazo que llegaba
 *
 *   "CC007: falta el numero de autorizacion del lugar de la mercancia"
 *
 * culpa a un campo del formulario, cuando el problema real es que la llegada en
 * Hamburgo la notifica el destinatario ANTE EL ZOLL, por su propio sistema NCTS.
 * El operador rellenaria la autorizacion una y otra vez sin que funcione nunca.
 *
 * Lo que se prueba:
 *   1. notifyArrival / notifyUnloading rechazan un destino no espanol nombrando
 *      el pais y la razon, ANTES de construir el XML y salir a la red.
 *   2. Con destino espanol el flujo sigue intacto (no se rompe el ciclo que ya
 *      funcionaba contra PRE).
 *   3. El aviso no depende de `destinationOffice.country`, que en los datos
 *      reales viene vacio: se deduce del prefijo ISO del codigo NCTS.
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
  aeatSubmitService.submitNCTSArrival.mockResolvedValue({ success: true, code: 'CC007' });
  aeatSubmitService.submitNCTSUnloading.mockResolvedValue({ success: true, code: 'CC044' });
});

/** Transito ya en camino, listo para notificar llegada. */
async function transitoEnCamino(owner, destino, extra = {}) {
  return Transit.create({
    owner,
    reference: 'REF-DEST-001',
    lrn: 'LRNDESTINO0001',
    mrn: '26ES0008512345678X',
    transitType: 'T1',
    status: 'in_transit',
    departureOffice: { code: 'ES002801' },
    destinationOffice: destino,
    transport: { mode: '3' },
    principal: { eori: 'ESB22477020', name: 'STRIX AI SL' },
    guarantee: { type: '1' },
    goodsItems: [{ itemNumber: 1, description: 'Tuberias', taricCode: '73041100', grossWeight: 450 }],
    ...extra
  });
}

describe('notifyArrival: la llegada en una aduana extranjera no se notifica a AEAT', () => {
  it('rechaza el destino aleman nombrando el pais, sin llamar a AEAT', async () => {
    const owner = OWNER();
    // Tal como llega de la API real: sin `country`, solo el codigo.
    const t = await transitoEnCamino(owner, { code: 'DE004600' });

    await expect(transitService.notifyArrival(t._id, {}, owner)).rejects.toThrow(/DE/);
    expect(aeatSubmitService.submitNCTSArrival).not.toHaveBeenCalled();
  });

  it('el mensaje explica que la notifica el destinatario ante la aduana de destino', async () => {
    const owner = OWNER();
    const t = await transitoEnCamino(owner, { code: 'NL000500' });

    await expect(transitService.notifyArrival(t._id, {}, owner))
      .rejects.toThrow(/aduana de destino|autoridad aduanera de destino/i);
  });

  it('no deja el transito en "arrived" cuando el destino es extranjero', async () => {
    const owner = OWNER();
    const t = await transitoEnCamino(owner, { code: 'FR001000' });

    await expect(transitService.notifyArrival(t._id, {}, owner)).rejects.toThrow();

    const recargado = await Transit.findById(t._id);
    expect(recargado.status).toBe('in_transit');
  });

  it('usa el `country` declarado cuando existe y contradice al codigo', async () => {
    const owner = OWNER();
    // Codigo raro pero pais declarado extranjero: manda el declarado.
    const t = await transitoEnCamino(owner, { code: '12345678', country: 'IT' });

    await expect(transitService.notifyArrival(t._id, {}, owner)).rejects.toThrow(/IT/);
    expect(aeatSubmitService.submitNCTSArrival).not.toHaveBeenCalled();
  });

  it('con destino espanol sigue enviando el CC007 y avanza a "arrived"', async () => {
    const owner = OWNER();
    const t = await transitoEnCamino(owner, { code: 'ES002901' });

    const res = await transitService.notifyArrival(t._id, {}, owner);

    expect(aeatSubmitService.submitNCTSArrival).toHaveBeenCalled();
    expect(res.status).toBe('arrived');
  });
});

describe('notifyUnloading: misma regla para el CC044', () => {
  it('rechaza la descarga de un transito con destino extranjero', async () => {
    const owner = OWNER();
    const t = await transitoEnCamino(owner, { code: 'BE000100' }, { status: 'arrived' });

    await expect(transitService.notifyUnloading(t._id, {}, owner)).rejects.toThrow(/BE/);
    expect(aeatSubmitService.submitNCTSUnloading).not.toHaveBeenCalled();
  });

  it('con destino espanol notifica la descarga y avanza a "unloaded"', async () => {
    const owner = OWNER();
    const t = await transitoEnCamino(owner, { code: 'ES002901' }, { status: 'arrived' });

    const res = await transitService.notifyUnloading(t._id, {}, owner);

    expect(aeatSubmitService.submitNCTSUnloading).toHaveBeenCalled();
    expect(res.status).toBe('unloaded');
  });
});
