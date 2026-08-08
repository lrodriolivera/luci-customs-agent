/**
 * El CC044 declaraba a AEAT precintos conformes sin que nadie los comprobase.
 *
 * Hallado en el E2E de 8/Ago/2026 revisando la fila expandida de /transit, que
 * pinta cada precinto en rojo con la etiqueta "ROTO" cuando
 * `transport.seals[].intactOnArrival === false`.
 *
 * `notifyUnloading` construia el mensaje con:
 *
 *     sealsOk: data.sealsOk !== false,
 *     goodsConform: data.goodsConform !== false,
 *
 * es decir, conforme salvo que el llamante diga explicitamente lo contrario. Y
 * el boton "Notificar Descarga" de la UI llama `handleAction(transit._id,
 * action.key)` SIN datos: `data` llega `{}`, asi que ambos campos salian a AEAT
 * como `true` sin intervencion humana.
 *
 * Un tránsito con precintos ya marcados como rotos en la propia base de datos
 * declaraba "precintos conformes" ante la aduana. El resultado de la descarga
 * es la declaracion con la que el destinatario autorizado responde de la
 * integridad de la mercancia: afirmar conformidad sin comprobarla es
 * exactamente lo que el CC044 existe para evitar, y el modelo YA tenia el
 * metodo `checkSeals()` para detectarlo... sin ningun punto de llamada en todo
 * el codigo.
 *
 * Lo que se prueba:
 *   1. Con un precinto roto en la BD, el CC044 sale con `sealsOk: false`
 *      aunque el llamante no diga nada.
 *   2. El llamante NO puede afirmar conformidad contra la evidencia registrada.
 *   3. Sin datos de integridad (`intactOnArrival` undefined) se mantiene el
 *      comportamiento anterior: conforme salvo indicacion contraria.
 *   4. Un `sealsOk: false` explicito se respeta siempre.
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
  aeatSubmitService.submitNCTSUnloading.mockResolvedValue({ success: true, code: 'CC044' });
});

/** Transito llegado a una aduana espanola, con MRN valido y precintos. */
async function transitoLlegado(owner, seals) {
  return Transit.create({
    owner,
    reference: 'REF-SEAL-001',
    lrn: 'LRNSEALS00001',
    transitType: 'T1',
    status: 'arrived',
    mrn: '26ES0028015010A1B2',
    departureOffice: { code: 'ES002801' },
    destinationOffice: { code: 'ES002901' },
    transport: { mode: '3', seals, sealCount: seals.length },
    principal: { eori: 'ESB22477020', name: 'STRIX AI SL' },
    guarantee: { type: '1' },
    goodsItems: [{ itemNumber: 1, description: 'Tuberias', taricCode: '73041100', grossWeight: 450 }]
  });
}

/** Lo que se envio a AEAT en el CC044. */
const mensajeEnviado = () => aeatSubmitService.submitNCTSUnloading.mock.calls[0][0];

describe('CC044: la conformidad de precintos no se afirma sin comprobarla', () => {
  it('con un precinto roto en la BD el CC044 sale con sealsOk false', async () => {
    const owner = OWNER();
    const t = await transitoLlegado(owner, [
      { number: 'ES12345', sealType: 'customs', intactOnArrival: true },
      { number: 'ES12346', sealType: 'customs', intactOnArrival: false }
    ]);

    // El boton de la UI llama sin datos: es el caso real.
    await transitService.notifyUnloading(t._id, {}, owner);

    expect(mensajeEnviado().sealsOk).toBe(false);
  });

  it('no permite afirmar sealsOk true contra un precinto roto registrado', async () => {
    const owner = OWNER();
    const t = await transitoLlegado(owner, [
      { number: 'ES12346', sealType: 'customs', intactOnArrival: false }
    ]);

    await expect(transitService.notifyUnloading(t._id, { sealsOk: true }, owner))
      .rejects.toThrow(/precinto/i);
    expect(aeatSubmitService.submitNCTSUnloading).not.toHaveBeenCalled();
  });

  it('nombra el precinto roto en el error, para que se pueda corregir', async () => {
    const owner = OWNER();
    const t = await transitoLlegado(owner, [
      { number: 'ES99887', sealType: 'customs', intactOnArrival: false }
    ]);

    await expect(transitService.notifyUnloading(t._id, { sealsOk: true }, owner))
      .rejects.toThrow(/ES99887/);
  });

  it('con todos los precintos intactos el CC044 sale con sealsOk true', async () => {
    const owner = OWNER();
    const t = await transitoLlegado(owner, [
      { number: 'ES12345', sealType: 'customs', intactOnArrival: true }
    ]);

    await transitService.notifyUnloading(t._id, {}, owner);
    expect(mensajeEnviado().sealsOk).toBe(true);
  });

  it('sin datos de integridad se mantiene el comportamiento anterior', async () => {
    // `intactOnArrival` undefined: nadie ha comprobado nada, y el CC044 sigue
    // siendo opcional. No se inventa un incumplimiento tampoco.
    const owner = OWNER();
    const t = await transitoLlegado(owner, [{ number: 'ES12345', sealType: 'customs' }]);

    await transitService.notifyUnloading(t._id, {}, owner);
    expect(mensajeEnviado().sealsOk).toBe(true);
  });

  it('un sealsOk false explicito se respeta aunque la BD no sepa nada', async () => {
    const owner = OWNER();
    const t = await transitoLlegado(owner, [{ number: 'ES12345', sealType: 'customs' }]);

    await transitService.notifyUnloading(t._id, { sealsOk: false }, owner);
    expect(mensajeEnviado().sealsOk).toBe(false);
  });

  it('un transito sin precintos declarados no cambia de comportamiento', async () => {
    const owner = OWNER();
    const t = await transitoLlegado(owner, []);

    await transitService.notifyUnloading(t._id, {}, owner);
    expect(mensajeEnviado().sealsOk).toBe(true);
  });

  it('deja constancia en el IE044 guardado de la conformidad realmente enviada', async () => {
    const owner = OWNER();
    const t = await transitoLlegado(owner, [
      { number: 'ES12346', sealType: 'customs', intactOnArrival: false }
    ]);

    const res = await transitService.notifyUnloading(t._id, {}, owner);
    const ie044 = res.messages.filter(m => m.type === 'IE044').pop();
    expect(ie044.content.sealsOk).toBe(false);
  });
});
