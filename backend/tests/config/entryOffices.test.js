/**
 * Aduanas de entrada: fuente unica.
 *
 * Por que existe: habia TRES listas de aduanas y se contradecian entre si en
 * los MISMOS codigos, no solo en la cantidad:
 *
 *   codigo     ensService.ENS_CONFIG   frontend           aeatConfig
 *   ES002801   Algeciras               Algeciras          Barcelona - Puerto
 *   ES003001   Irun                    Vigo               Algeciras - Puerto
 *   ES002101   -                       Bilbao             Madrid - Barajas
 *   ES001501   -                       Madrid-Barajas     Cadiz - Puerto
 *
 * Consecuencia real: el desplegable del formulario ofrecia ES009999, que el
 * backend no tenia en su lista, asi que su validacion de coherencia
 * modo/aduana no se disparaba NUNCA (buscaba la aduana, no la encontraba y
 * pasaba de largo). Las 8 ENS aceptadas por AEAT PRE se presentaron asi.
 *
 * Desde el 16/11/2026 los codigos salen de la lista oficial de aduanas
 * (config/aduanasOficiales.js); ver tests/config/aduanasOficiales.test.js.
 */

const {
  ENTRY_OFFICES,
  getEntryOffice,
  listEntryOffices,
  isValidEntryOffice
} = require('../../src/config/entryOffices');

const MODOS = ['ROAD', 'RAIL', 'AIR', 'SEA'];

describe('catalogo de aduanas de entrada', () => {

  test('no hay codigos repetidos', () => {
    const codigos = ENTRY_OFFICES.map(o => o.code);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  test('cada aduana declara codigo, nombre y al menos un modo valido', () => {
    for (const o of ENTRY_OFFICES) {
      expect(o.code).toMatch(/^ES\d{6}$/);
      expect(typeof o.name).toBe('string');
      expect(o.name.length).toBeGreaterThan(0);
      expect(o.modes.length).toBeGreaterThan(0);
      expect(o.modes.every(m => MODOS.includes(m))).toBe(true);
    }
  });

  /**
   * ES009999 es la aduana de pruebas de PRE y es el unico codigo con respaldo
   * empirico: las 8 ENS con MRN real de AEAT se presentaron con ella. Si
   * desaparece del catalogo, el entorno de pruebas deja de ser usable.
   */
  test('la aduana de pruebas de PRE esta en el catalogo y marcada como tal', () => {
    const pre = getEntryOffice('ES009999');
    expect(pre).toBeDefined();
    expect(pre.test).toBe(true);
    expect(pre.modes).toEqual(expect.arrayContaining(MODOS));
  });

  test('las aduanas reales no van marcadas como de pruebas', () => {
    expect(getEntryOffice('ES002801').test).toBeFalsy();
  });

  test('todos los modos de transporte tienen al menos una aduana real', () => {
    for (const modo of MODOS) {
      const reales = listEntryOffices(modo).filter(o => !o.test);
      expect(reales.length).toBeGreaterThan(0);
    }
  });
});

describe('getEntryOffice', () => {
  test('devuelve la aduana por su codigo', () => {
    expect(getEntryOffice('ES004601').name).toMatch(/valencia/i);
  });

  test('un codigo que no existe devuelve undefined, no un objeto vacio', () => {
    expect(getEntryOffice('ES999999')).toBeUndefined();
  });

  test.each([[null], [undefined], [''], [42]])('entrada invalida (%p) devuelve undefined', (v) => {
    expect(getEntryOffice(v)).toBeUndefined();
  });
});

describe('listEntryOffices', () => {
  test('sin modo devuelve el catalogo completo', () => {
    expect(listEntryOffices()).toHaveLength(ENTRY_OFFICES.length);
  });

  test('filtra por modo de transporte', () => {
    const aereas = listEntryOffices('AIR');
    expect(aereas.length).toBeGreaterThan(0);
    expect(aereas.every(o => o.modes.includes('AIR'))).toBe(true);
  });

  test('un modo desconocido devuelve lista vacia, no el catalogo entero', () => {
    expect(listEntryOffices('TELEPORTE')).toEqual([]);
  });

  test('devuelve copias: mutar el resultado no corrompe el catalogo', () => {
    const l = listEntryOffices();
    l[0].name = 'MANIPULADO';
    expect(getEntryOffice(l[0].code).name).not.toBe('MANIPULADO');
  });
});

describe('isValidEntryOffice', () => {
  test('acepta un codigo del catalogo', () => {
    expect(isValidEntryOffice('ES009999')).toBe(true);
  });

  test('rechaza un codigo que no existe', () => {
    expect(isValidEntryOffice('ES123456')).toBe(false);
  });

  /**
   * El desplegable ofrecia ES009999 y el backend no lo conocia: la validacion
   * de coherencia se saltaba en silencio. Frontend y backend han de compartir
   * este catalogo para que eso no vuelva a pasar.
   */
  test('todos los codigos del catalogo se validan a si mismos', () => {
    expect(ENTRY_OFFICES.every(o => isValidEntryOffice(o.code))).toBe(true);
  });
});

describe('codigos cotejados con la lista oficial', () => {
  const { getAduanaOficial } = require('../../src/config/aduanasOficiales');

  test('toda aduana real del catalogo esta en la lista oficial', () => {
    for (const o of ENTRY_OFFICES.filter(x => !x.test)) {
      expect(getAduanaOficial(o.code)).toBeDefined();
    }
  });

  test.each([
    ['ES002801', /madrid.*aeropuerto/i, ['AIR']],
    ['ES004601', /valencia.*aeropuerto/i, ['AIR']],
    ['ES004611', /valencia.*mar/i, ['SEA']],
    ['ES001131', /algeciras.*mar/i, ['SEA']],
    ['ES000811', /barcelona.*mar/i, ['SEA']],
    ['ES000801', /barcelona.*aeropuerto/i, ['AIR']]
  ])('%s es la aduana correcta', (code, nombre, modos) => {
    const o = getEntryOffice(code);
    expect(o.name).toMatch(nombre);
    expect(o.modes).toEqual(expect.arrayContaining(modos));
  });

  test('los codigos equivocados del catalogo anterior ya no existen', () => {
    for (const code of ['ES003001', 'ES002101', 'ES002805', 'ES001501', 'ES003501', 'ES003801']) {
      expect(isValidEntryOffice(code)).toBe(false);
    }
  });

  test('la maritima de solo exportacion no es aduana de entrada', () => {
    expect(isValidEntryOffice('ES000812')).toBe(false);
  });
});
