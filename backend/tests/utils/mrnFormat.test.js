/**
 * Formato del MRN: AEAT lo valida con el patron [0-9]{2}[A-Z]{2}[A-Z0-9]{14}
 * (18 caracteres, anyo de DOS digitos).
 *
 * Hallado en el E2E de 8/Ago/2026: los 14 MRN de la base de datos venian del
 * seed con anyo de cuatro digitos (`2026ES00782741`, 14 caracteres). La llamada
 * real a `POST /api/transit/:id/unloading` devolvia
 *
 *   400 "El elemento no cumple con el formato exigido.
 *        Patron: [0-9]{2}[A-Z]{2}[A-Z0-9]{14}"
 *
 * un rechazo que no nombra el campo, sobre un MRN que la propia aplicacion se
 * habia inventado. Los MRN reales tienen esta forma: `26ESH7A000067965R5` (H7),
 * `26ES009999Z0000685` (ENS), `26ES002801501092J0` (transito).
 */

const { generarMRN, esMRNValido, PATRON_MRN } = require('../../src/utils/mrnFormat');

describe('esMRNValido', () => {
  it('acepta los MRN reales devueltos por AEAT PRE', () => {
    expect(esMRNValido('26ESH7A000067965R5')).toBe(true);
    expect(esMRNValido('26ES009999Z0000685')).toBe(true);
    expect(esMRNValido('26ES002801501092J0')).toBe(true);
  });

  it('rechaza el MRN que generaba el seed (anyo de 4 digitos, 14 caracteres)', () => {
    expect(esMRNValido('2026ES00782741')).toBe(false);
  });

  it('rechaza minusculas, longitud corta o larga y valores vacios', () => {
    expect(esMRNValido('26es002801501092j0')).toBe(false);
    expect(esMRNValido('26ES00280150109')).toBe(false);
    expect(esMRNValido('26ES002801501092J0X')).toBe(false);
    expect(esMRNValido('')).toBe(false);
    expect(esMRNValido(null)).toBe(false);
    expect(esMRNValido(undefined)).toBe(false);
  });

  it('exige que los dos primeros caracteres sean digitos y el pais letras', () => {
    expect(esMRNValido('ABES002801501092J0')).toBe(false);
    expect(esMRNValido('2600002801501092J0')).toBe(false);
  });
});

describe('generarMRN', () => {
  it('genera siempre un MRN que cumple el patron de AEAT', () => {
    for (let i = 0; i < 200; i++) {
      const mrn = generarMRN();
      expect(esMRNValido(mrn)).toBe(true);
      expect(mrn).toHaveLength(18);
    }
  });

  it('usa el anyo en curso con dos digitos', () => {
    const dosDigitos = String(new Date().getFullYear()).slice(-2);
    expect(generarMRN().slice(0, 2)).toBe(dosDigitos);
  });

  it('respeta el pais indicado', () => {
    expect(generarMRN({ pais: 'DE' }).slice(2, 4)).toBe('DE');
  });

  it('coloca el prefijo pedido justo tras el pais, sin romper la longitud', () => {
    const mrn = generarMRN({ prefijo: 'H7A' });
    expect(mrn.slice(4, 7)).toBe('H7A');
    expect(esMRNValido(mrn)).toBe(true);
  });

  it('no repite MRN en tiradas seguidas (el seed crea decenas de golpe)', () => {
    const generados = new Set(Array.from({ length: 500 }, () => generarMRN()));
    expect(generados.size).toBe(500);
  });

  it('un prefijo demasiado largo se recorta antes de invalidar el MRN', () => {
    const mrn = generarMRN({ prefijo: 'DEMASIADOLARGOPARAENTRAR' });
    expect(esMRNValido(mrn)).toBe(true);
  });

  it('PATRON_MRN es el mismo que exige AEAT, anclado', () => {
    expect(PATRON_MRN.source).toBe('^[0-9]{2}[A-Z]{2}[A-Z0-9]{14}$');
  });
});
