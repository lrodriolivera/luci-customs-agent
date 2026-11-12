const { PAISES_SIN_CODIGO_POSTAL, sinCodigoPostal } = require('../../../src/services/aeat/paisesSinCodigoPostal');

describe('lista CL505 (países sin código postal)', () => {
  test('es la extracción oficial: 54 países de dos letras', () => {
    expect(PAISES_SIN_CODIGO_POSTAL.size).toBe(54);
    expect([...PAISES_SIN_CODIGO_POSTAL].every((p) => /^[A-Z]{2}$/.test(p))).toBe(true);
  });

  test('dice si un país está en la lista', () => {
    expect(sinCodigoPostal('hk')).toBe(true);
    expect(sinCodigoPostal('AE')).toBe(true);
    expect(sinCodigoPostal('CN')).toBe(false);
    expect(sinCodigoPostal(undefined)).toBe(false);
  });
});
