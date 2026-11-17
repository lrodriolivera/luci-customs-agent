/**
 * Catálogo oficial del régimen (D.E. 1/10) y del régimen adicional (D.E. 1/11)
 * para el H1 CAU.
 */
const {
  COMBINACIONES, ADICIONALES, combinacionH1, adicionalH1, normalizarRegimen,
  regimenDelExpediente, regimenComoTexto, catalogoH1
} = require('../../src/config/regimenesH1');

describe('combinaciones de régimen solicitado + precedente', () => {
  test('incluye todos los códigos de la columna H1 del anexo B con precedente 00', () => {
    const conCero = COMBINACIONES.filter((c) => c.precedente === '00').map((c) => c.solicitado);
    expect(conCero).toEqual(expect.arrayContaining(['01', '07', '40', '42', '43', '44', '45', '46', '48', '61', '63', '68']));
  });

  test('40.00 lleva la descripción oficial y su fuente', () => {
    const c = combinacionH1('4000');
    expect(c).toMatchObject({ solicitado: '40', precedente: '00', descripcion: 'Despacho a libre práctica con despacho simultáneo a consumo de mercancías' });
    expect(c.fuente).toMatch(/2015\/2447/);
  });

  test('admite combinaciones con precedente respaldadas por la AEAT (40.71, 40.51, 40.53)', () => {
    expect(combinacionH1('40.71').descripcion).toMatch(/procedente de depósito aduanero$/);
    expect(combinacionH1('4051').descripcion).toMatch(/perfeccionamiento activo$/);
    expect(combinacionH1('40 53')).not.toBeNull();
  });

  test('rechaza lo que no está en el catálogo', () => {
    expect(combinacionH1('4099')).toBeNull();
    expect(combinacionH1('40')).toBeNull();
    expect(combinacionH1('1000')).toBeNull();
    expect(combinacionH1(undefined)).toBeNull();
  });

  test('cada combinación tiene descripción, grupo y fuente, sin códigos repetidos', () => {
    const codigos = COMBINACIONES.map((c) => c.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    for (const c of COMBINACIONES) {
      expect(c.descripcion).toBeTruthy();
      expect(c.grupo).toBeTruthy();
      expect(c.fuente).toBeTruthy();
    }
  });

  test('normaliza el código con punto o espacios', () => {
    expect(normalizarRegimen('40.71')).toBe('4071');
    expect(normalizarRegimen('4071')).toBe('4071');
    expect(normalizarRegimen('40,71')).toBeNull();
  });
});

describe('régimen adicional', () => {
  test('códigos de la Unión de importación con su texto oficial', () => {
    expect(adicionalH1('c08').descripcion).toBe('Envíos de particular a particular.');
    expect(adicionalH1('F48')).not.toBeNull();
    expect(adicionalH1('D12').grupo).toMatch(/Importación temporal/);
  });

  test('los de exportación no están (B51, C71, E51, F61)', () => {
    for (const codigo of ['B51', 'C71', 'E51', 'F61', 'F75']) expect(adicionalH1(codigo)).toBeNull();
  });

  test('códigos nacionales de la AEAT (132, 404, 9OR, 5GI)', () => {
    expect(adicionalH1('132').fuente).toMatch(/separata 13/);
    expect(adicionalH1('9OR').descripcion).toMatch(/certificado de origen/);
    expect(adicionalH1('5GI').grupo).toMatch(/Gibraltar/);
    expect(adicionalH1('404')).not.toBeNull();
  });

  test('los del plástico no se eligen aquí: los pone cada partida', () => {
    expect(adicionalH1('1P1')).toBeNull();
  });

  test('sin códigos repetidos y todos de tres caracteres', () => {
    const codigos = ADICIONALES.map((a) => a.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    expect(codigos.every((c) => /^[A-Z0-9]{3}$/.test(c))).toBe(true);
  });
});

describe('régimen del expediente', () => {
  test('lo guardado antes (solo «40») sigue siendo 40.00', () => {
    expect(regimenDelExpediente({ regime: '40' })).toBe('4000');
    expect(regimenDelExpediente({})).toBe('4000');
    expect(regimenDelExpediente(undefined)).toBe('4000');
  });

  test('con precedente guardado', () => {
    expect(regimenDelExpediente({ regime: '40', previousRegime: '71' })).toBe('4071');
  });

  test('texto para la vista previa: «40.00 – Despacho…»', () => {
    expect(regimenComoTexto('40', '00')).toBe('40.00 – Despacho a libre práctica con despacho simultáneo a consumo de mercancías');
    expect(regimenComoTexto('99', '00')).toBe('99.00');
  });

  test('el catálogo para la interfaz trae combinaciones, adicionales y fuentes', () => {
    const c = catalogoH1();
    expect(c.combinaciones.length).toBe(COMBINACIONES.length);
    expect(c.adicionales.length).toBe(ADICIONALES.length);
    expect(c.fuentes.regimen).toMatch(/11 09 000 000/);
  });
});
