const { normalizarDocumentosC44, separarDocumentosC44, ErrorDocumentosC44 } = require('../../../src/services/aeat/documentosC44');

describe('normalizarDocumentosC44', () => {
  test('normaliza código en mayúsculas y recorta la referencia', () => {
    expect(normalizarDocumentosC44([{ tipo: 'n003', referencia: ' CAL-1 ', medida: 'COM-COMER' }, { tipo: 'Y081' }]))
      .toEqual([{ tipo: 'N003', referencia: 'CAL-1', medida: 'COM-COMER' }, { tipo: 'Y081' }]);
  });

  test.each([
    [[{ tipo: 'C99' }], /4 letras o cifras/],
    [[{ tipo: 'N003' }], /falta el número/],
    [[{ tipo: 'N003', referencia: 'x'.repeat(71) }], /70 caracteres/],
    [[{ tipo: 'N003', referencia: 'A' }, { tipo: 'n003', referencia: 'A' }], /repetido/],
    ['no', /lista/],
    [[{ tipo: 'C990', referencia: 'X' }], /es una autorización/],
    [[{ tipo: '1235', referencia: 'X' }], /V o Z/],
    [Array.from({ length: 21 }, (_, i) => ({ tipo: 'N003', referencia: `R${i}` })), /Como máximo 20/]
  ])('rechaza %#', (entrada, mensaje) => {
    expect(() => normalizarDocumentosC44(entrada)).toThrow(ErrorDocumentosC44);
    expect(() => normalizarDocumentosC44(entrada)).toThrow(mensaje);
  });

  test('un código Y no necesita número', () => {
    expect(normalizarDocumentosC44([{ tipo: 'Y126' }])).toEqual([{ tipo: 'Y126' }]);
  });
});

describe('separarDocumentosC44', () => {
  test('los Y van como referencia adicional y el resto como documento justificativo', () => {
    expect(separarDocumentosC44([{ tipo: 'N003', referencia: 'CAL-1', medida: 'COM-COMER' }, { tipo: 'Y081' }, { tipo: 'Y126', referencia: 'nota' }])).toEqual({
      justificativos: [{ tipo: 'N003', referencia: 'CAL-1' }],
      referencias: [{ tipo: 'Y081' }, { tipo: 'Y126', referencia: 'nota' }]
    });
  });
  test('sin documentos, listas vacías', () => {
    expect(separarDocumentosC44(undefined)).toEqual({ justificativos: [], referencias: [] });
  });
});
