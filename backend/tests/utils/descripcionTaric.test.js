const { textoDescripcion } = require('../../src/utils/descripcionTaric');

describe('textoDescripcion', () => {
  test('devuelve el string si ya lo es', () => {
    expect(textoDescripcion('Melones')).toBe('Melones');
  });

  test('prefiere es, luego en', () => {
    expect(textoDescripcion({ es: 'Melones', en: 'Melons' })).toBe('Melones');
    expect(textoDescripcion({ en: 'Melons', fr: 'Melons FR' })).toBe('Melons');
  });

  test('sin es ni en usa el primer valor string del objeto', () => {
    expect(textoDescripcion({ fr: 'Melons FR', de: 'Melonen' })).toBe('Melons FR');
    expect(textoDescripcion({ n: 3, fr: 'Melons FR' })).toBe('Melons FR');
  });

  test('es vacío cae a en y luego al primer string no vacío', () => {
    expect(textoDescripcion({ es: '', en: 'Melons' })).toBe('Melons');
    expect(textoDescripcion({ es: '', fr: 'Melons FR' })).toBe('Melons FR');
  });

  test.each([[{}], [null], [undefined], [{ fr: '' }], [{ n: 3 }], [42], [[]]])(
    'devuelve "" cuando no hay texto (%j)', (d) => {
      expect(textoDescripcion(d)).toBe('');
    });
});
