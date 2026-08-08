/**
 * El fix de `Transit.messages.exchanged` usa `default: true` para no reetiquetar
 * como falsos los mensajes historicos, que en su mayoria son intercambios
 * reales. El efecto secundario es que los transitos YA GUARDADOS siguen
 * presentando su IE029/IE143/IE118 fabricado como recibido de AEAT: verificado
 * en produccion sobre el transito 6a773812c42a3f3ec6f54b30, cuyo IE029 sigue
 * saliendo "intercambiado (inbound)" despues del deploy.
 *
 * Estos tests fijan el criterio del backfill. Es seguro identificar los mensajes
 * locales por su tipo porque en `transitService` no hay mas de un sitio que
 * empuje cada uno de los tres: los unicos IE029/IE143/IE118 existentes son los
 * que fabricaban `releaseAtDeparture`, `recordControlResult` e
 * `initiateEnquiry`.
 */
const {
  TIPOS_LOCALES,
  esMensajeLocalHistorico,
  planificarMensajes
} = require('../../scripts/backfillMensajesNCTSLocales');

describe('backfill de mensajes NCTS locales: criterio', () => {
  test('los tres tipos fabricados en local estan cubiertos', () => {
    expect(TIPOS_LOCALES).toEqual(expect.arrayContaining(['IE029', 'IE143', 'IE118']));
  });

  test('un IE029 sin marca es un mensaje fabricado en local', () => {
    expect(esMensajeLocalHistorico({ type: 'IE029', direction: 'inbound' })).toBe(true);
  });

  test('los mensajes que si se intercambian con AEAT no se tocan', () => {
    // IE015/IE028 salen y entran de verdad; IE160/IE044 solo se anotan cuando
    // AEAT acepta el CC007/CC044.
    for (const type of ['IE015', 'IE028', 'IE160', 'IE044']) {
      expect(esMensajeLocalHistorico({ type, direction: 'outbound' })).toBe(false);
    }
  });

  test('un mensaje ya marcado no se vuelve a tocar (idempotencia)', () => {
    expect(esMensajeLocalHistorico({ type: 'IE029', exchanged: false })).toBe(false);
    // Y si alguien lo marco explicitamente como intercambiado, se respeta:
    // el backfill corrige ausencias, no decisiones.
    expect(esMensajeLocalHistorico({ type: 'IE029', exchanged: true })).toBe(false);
  });

  test('un mensaje nulo o sin tipo no rompe el recorrido', () => {
    expect(esMensajeLocalHistorico(null)).toBe(false);
    expect(esMensajeLocalHistorico({})).toBe(false);
  });
});

describe('backfill de mensajes NCTS locales: plan por transito', () => {
  test('marca los locales y limpia el direction enganyoso del IE029', () => {
    const plan = planificarMensajes([
      { type: 'IE015', direction: 'outbound' },
      { type: 'IE028', direction: 'inbound' },
      { type: 'IE029', direction: 'inbound' }
    ]);

    expect(plan.cambios).toBe(1);
    expect(plan.mensajes[0]).toEqual({ type: 'IE015', direction: 'outbound' });
    expect(plan.mensajes[1]).toEqual({ type: 'IE028', direction: 'inbound' });
    expect(plan.mensajes[2].exchanged).toBe(false);
    // `direction` solo tiene sentido si hubo intercambio.
    expect(plan.mensajes[2].direction).toBeUndefined();
  });

  test('un transito ya migrado no genera cambios', () => {
    const plan = planificarMensajes([
      { type: 'IE015', direction: 'outbound' },
      { type: 'IE029', exchanged: false }
    ]);
    expect(plan.cambios).toBe(0);
  });

  test('cuenta varios locales del mismo transito', () => {
    const plan = planificarMensajes([
      { type: 'IE015', direction: 'outbound' },
      { type: 'IE029', direction: 'inbound' },
      { type: 'IE143', direction: 'outbound' },
      { type: 'IE118', direction: 'outbound' }
    ]);
    expect(plan.cambios).toBe(3);
    expect(plan.mensajes.filter(m => m.exchanged === false)).toHaveLength(3);
  });

  test('el IE143 y el IE118 conservan su direction outbound', () => {
    // Salen del operador hacia la aduana conceptualmente, aunque el envio no
    // este implementado: la marca `exchanged: false` ya dice que no salio.
    const plan = planificarMensajes([{ type: 'IE143', direction: 'outbound' }]);
    expect(plan.mensajes[0].direction).toBe('outbound');
    expect(plan.mensajes[0].exchanged).toBe(false);
  });

  test('una lista vacia o ausente no genera cambios', () => {
    expect(planificarMensajes([]).cambios).toBe(0);
    expect(planificarMensajes(undefined).cambios).toBe(0);
    expect(planificarMensajes(undefined).mensajes).toEqual([]);
  });

  test('no muta la lista original', () => {
    const original = [{ type: 'IE029', direction: 'inbound' }];
    planificarMensajes(original);
    expect(original[0]).toEqual({ type: 'IE029', direction: 'inbound' });
  });
});
