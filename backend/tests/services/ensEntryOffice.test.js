/**
 * ensService: validacion de la aduana de entrada contra el catalogo unico.
 *
 * Por que existe: `preValidate` buscaba la aduana en su propia lista interna
 * (ENS_CONFIG.entryOffices, 10 codigos) mientras el desplegable del formulario
 * ofrecia otra (15 codigos, con ES009999/ES009998 que el backend no conocia).
 * Cuando el codigo no estaba en la lista del backend, `office` salia undefined
 * y la validacion de coherencia modo/aduana se saltaba EN SILENCIO. Las 8 ENS
 * que AEAT PRE acepto se presentaron por ese hueco.
 *
 * Ahora los dos lados leen config/entryOffices.js, y un codigo desconocido se
 * senala en lugar de ignorarse.
 */

const ens = require('../../src/services/ensService');

const enHoras = (h) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString();

// Datos minimos validos: aqui solo interesan las senales de la aduana.
const datos = (over = {}) => ({
  transportMode: 'SEA',
  carrier: { eori: 'ESB12345678', name: 'Naviera SL' },
  consignment: { referenceNumber: 'MBL-1', grossMass: 1000, numberOfPackages: 10, goodsDescription: 'Mercancia' },
  goods: [{ sequenceNumber: 1, description: 'Camisetas', commodityCode: '610910', grossMass: 500, numberOfPackages: 10 }],
  ...over
});

const avisoAduana = (r) => (r.suggestions || []).find(s => s.field === 'entryOffice.code');
const errorAduana = (r) => (r.errors || []).find(e => e.field === 'entryOffice.code');

describe('validacion de la aduana de entrada', () => {

  test('una aduana maritima con transporte SEA no genera aviso', async () => {
    const r = await ens.preValidate(datos({
      transportMode: 'SEA',
      entryOffice: { code: 'ES002801', expectedArrival: enHoras(48) }
    }));
    expect(avisoAduana(r)).toBeUndefined();
    expect(errorAduana(r)).toBeUndefined();
  });

  test('una aduana aerea con transporte SEA genera aviso de coherencia', async () => {
    const r = await ens.preValidate(datos({
      transportMode: 'SEA',
      entryOffice: { code: 'ES002101', expectedArrival: enHoras(48) }
    }));
    expect(avisoAduana(r)).toBeDefined();
    expect(avisoAduana(r).message).toMatch(/ES002101|Barajas/i);
  });

  /**
   * El hueco que dejo pasar las 8 ENS: un codigo que el backend no conoce debe
   * senalarse, no ignorarse.
   */
  test('una aduana que no existe en el catalogo se senala como error', async () => {
    const r = await ens.preValidate(datos({
      entryOffice: { code: 'ES999999', expectedArrival: enHoras(48) }
    }));
    expect(errorAduana(r)).toBeDefined();
    expect(errorAduana(r).code).toBe('ENS_UNKNOWN_ENTRY_OFFICE');
  });

  test('la aduana de pruebas de PRE se acepta con cualquier modo', async () => {
    for (const modo of ['ROAD', 'RAIL', 'AIR', 'SEA']) {
      const r = await ens.preValidate(datos({
        transportMode: modo,
        entryOffice: { code: 'ES009999', expectedArrival: enHoras(48) }
      }));
      expect(errorAduana(r)).toBeUndefined();
      expect(avisoAduana(r)).toBeUndefined();
    }
  });

  test('una aduana terrestre admite RAIL sin avisar', async () => {
    const r = await ens.preValidate(datos({
      transportMode: 'RAIL',
      entryOffice: { code: 'ES001701', expectedArrival: enHoras(48) }
    }));
    expect(avisoAduana(r)).toBeUndefined();
  });

  test('un puerto NO admite RAIL: avisa de la incoherencia', async () => {
    const r = await ens.preValidate(datos({
      transportMode: 'RAIL',
      entryOffice: { code: 'ES003501', expectedArrival: enHoras(48) }
    }));
    expect(avisoAduana(r)).toBeDefined();
  });

  test('sin aduana declarada no se inventa ni error ni aviso de aduana', async () => {
    const r = await ens.preValidate(datos());
    expect(errorAduana(r)).toBeUndefined();
    expect(avisoAduana(r)).toBeUndefined();
  });
});

describe('getEntryOffices', () => {

  test('devuelve el catalogo completo sin filtro', () => {
    const l = ens.getEntryOffices();
    expect(l.length).toBeGreaterThan(10);
    expect(l.every(o => /^ES\d{6}$/.test(o.code))).toBe(true);
  });

  test('filtra por modo y todas las devueltas lo admiten', () => {
    const aereas = ens.getEntryOffices('AIR');
    expect(aereas.length).toBeGreaterThan(0);
    expect(aereas.every(o => o.modes.includes('AIR'))).toBe(true);
  });

  /**
   * Es el codigo con el que AEAT ha aceptado nuestras 8 ENS: si el endpoint no
   * lo ofrece, el entorno de pruebas deja de ser operable desde la UI.
   */
  test('incluye la aduana de pruebas de PRE en los cuatro modos', () => {
    for (const modo of ['ROAD', 'RAIL', 'AIR', 'SEA']) {
      expect(ens.getEntryOffices(modo).some(o => o.code === 'ES009999')).toBe(true);
    }
  });

  test('un modo desconocido devuelve lista vacia', () => {
    expect(ens.getEntryOffices('TELEPORTE')).toEqual([]);
  });
});
