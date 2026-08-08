/**
 * El CC044 declaraba la mercancia conforme aunque el control hubiese anotado
 * discrepancias.
 *
 * Hermano del bug de los precintos (transitService.precintosCC044.test.js), que
 * quedo a medias: alli se corrigio `sealsOk` y se dejo intacto
 *
 *     goodsConform: data.goodsConform !== false,
 *
 * El boton "Notificar Descarga" llama sin datos, asi que sale `true` sin que
 * nadie lo compruebe. Antes esto era latente; ahora es alcanzable: el formulario
 * de resultado de control (`recordControlResult`) deja el transito en
 * `control_requested` cuando el resultado es A1/A2/A3, y `notifyUnloading`
 * acepta ese estado. Un control A3 con una falta de 50 kg anotada en
 * `controlResult.discrepancies` seguido de "Notificar Descarga" declaraba a la
 * aduana que la mercancia llego conforme.
 *
 * La conformidad de la mercancia en el CC044 es la declaracion con la que el
 * destinatario autorizado responde de lo que ha recibido: sobre ella se decide
 * si hay deuda aduanera. No se afirma por defecto.
 *
 * Reglas implementadas:
 *   - Si el control anoto discrepancias, `goodsConform` sale `false`.
 *   - Si el control se califico de A3/A4/B*, `goodsConform` sale `false`.
 *   - Un `goodsConform: true` explicito contra esa evidencia se rechaza,
 *     nombrando el motivo (igual que con los precintos).
 *   - Sin control registrado se mantiene el comportamiento anterior: conforme
 *     salvo indicacion contraria. No hay nada que contradiga.
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

/**
 * Transito en un estado que permite notificar la descarga, con el resultado de
 * control que se le pase.
 */
async function transitoConControl(owner, controlResult, status = 'control_requested') {
  return Transit.create({
    owner,
    reference: 'REF-CONF-001',
    lrn: 'LRNCONF00001',
    transitType: 'T1',
    status,
    mrn: '26ES0028015010C0N1',
    departureOffice: { code: 'ES002801' },
    destinationOffice: { code: 'ES002901' },
    transport: { mode: '3' },
    principal: { eori: 'ESB22477020', name: 'STRIX AI SL' },
    guarantee: { type: '1' },
    goodsItems: [{ itemNumber: 1, description: 'Tuberias', taricCode: '73041100', grossWeight: 450 }],
    ...(controlResult ? { controlResult } : {})
  });
}

/** Lo que se envio a AEAT en el CC044. */
const mensajeEnviado = () => aeatSubmitService.submitNCTSUnloading.mock.calls[0][0];

const CON_FALTA = {
  performed: true,
  type: 'A3',
  discrepancies: [{ itemNumber: 1, type: 'shortage', declared: '450', found: '400' }]
};

describe('CC044: la conformidad de la mercancia no se afirma sin comprobarla', () => {
  it('con discrepancias en el control, el CC044 sale con goodsConform false', async () => {
    const owner = OWNER();
    const t = await transitoConControl(owner, CON_FALTA);

    // Sin datos: exactamente lo que hace el boton "Notificar Descarga".
    await transitService.notifyUnloading(t._id, {}, owner);

    expect(mensajeEnviado().goodsConform).toBe(false);
  });

  it('un resultado A4 basta, aunque no se detallen las discrepancias', async () => {
    const owner = OWNER();
    const t = await transitoConControl(owner, { performed: true, type: 'A4' });
    await transitService.notifyUnloading(t._id, {}, owner);
    expect(mensajeEnviado().goodsConform).toBe(false);
  });

  it('un resultado B (robo/perdida/destruccion) tampoco es conformidad', async () => {
    const owner = OWNER();
    const t = await transitoConControl(owner, { performed: true, type: 'B2' });
    await transitService.notifyUnloading(t._id, {}, owner);
    expect(mensajeEnviado().goodsConform).toBe(false);
  });

  it('no se puede declarar conformidad explicita contra las discrepancias anotadas', async () => {
    const owner = OWNER();
    const t = await transitoConControl(owner, CON_FALTA);

    await expect(transitService.notifyUnloading(t._id, { goodsConform: true }, owner))
      .rejects.toThrow(/mercancia/i);
    expect(aeatSubmitService.submitNCTSUnloading).not.toHaveBeenCalled();
  });

  it('el error dice cual es la discrepancia, no solo que hay una', async () => {
    const owner = OWNER();
    const t = await transitoConControl(owner, CON_FALTA);

    await expect(transitService.notifyUnloading(t._id, { goodsConform: true }, owner))
      .rejects.toThrow(/A3/);
  });

  it('un control satisfactorio A1 sin discrepancias si es conforme', async () => {
    const owner = OWNER();
    const t = await transitoConControl(owner, { performed: true, type: 'A1' });
    await transitService.notifyUnloading(t._id, {}, owner);
    expect(mensajeEnviado().goodsConform).toBe(true);
  });

  it('un A2 (conforme con observaciones) sigue siendo conforme', async () => {
    // A2 no es discrepancia: son observaciones sobre mercancia conforme.
    const owner = OWNER();
    const t = await transitoConControl(owner, { performed: true, type: 'A2' });
    await transitService.notifyUnloading(t._id, {}, owner);
    expect(mensajeEnviado().goodsConform).toBe(true);
  });

  it('sin control registrado se mantiene el comportamiento anterior', async () => {
    // Nada que contradecir: no hay evidencia en un sentido ni en otro.
    const owner = OWNER();
    const t = await transitoConControl(owner, null, 'arrived');
    await transitService.notifyUnloading(t._id, {}, owner);
    expect(mensajeEnviado().goodsConform).toBe(true);
  });

  it('un goodsConform false explicito se respeta siempre', async () => {
    const owner = OWNER();
    const t = await transitoConControl(owner, { performed: true, type: 'A1' });
    await transitService.notifyUnloading(t._id, { goodsConform: false }, owner);
    expect(mensajeEnviado().goodsConform).toBe(false);
  });

  it('el IE044 guardado dice lo mismo que se envio a AEAT', async () => {
    // Si el mensaje guardado y el enviado difieren, el expediente miente sobre
    // lo que se declaro.
    const owner = OWNER();
    const t = await transitoConControl(owner, CON_FALTA);
    const res = await transitService.notifyUnloading(t._id, {}, owner);

    const ie044 = res.messages.filter((m) => m.type === 'IE044').pop();
    expect(ie044.content.goodsConform).toBe(mensajeEnviado().goodsConform);
    expect(ie044.content.goodsConform).toBe(false);
  });

  it('las discrepancias del control viajan en el CC044, no se pierden', async () => {
    // Declarar `goodsConform: false` sin decir en que consiste la discrepancia
    // deja a la aduana sin lo que necesita para resolver.
    const owner = OWNER();
    const t = await transitoConControl(owner, CON_FALTA);
    await transitService.notifyUnloading(t._id, {}, owner);

    const enviado = mensajeEnviado();
    expect(enviado.goodsDiscrepancies).toHaveLength(1);
    expect(enviado.goodsDiscrepancies[0]).toMatchObject({ itemNumber: 1, type: 'shortage' });
  });

  it('las discrepancias pasadas en la llamada prevalecen sobre las del control', async () => {
    const owner = OWNER();
    const t = await transitoConControl(owner, CON_FALTA);
    const propias = [{ itemNumber: 2, type: 'excess', declared: '10', found: '12' }];
    await transitService.notifyUnloading(t._id, { discrepancies: propias }, owner);

    expect(mensajeEnviado().goodsDiscrepancies).toEqual(propias);
  });
});
