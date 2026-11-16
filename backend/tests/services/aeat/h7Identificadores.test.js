/**
 * Reglas de la AEAT para las partidas del H7 (AltaH7V1, guía v3.23):
 *  - commodityCode: exactamente 8 cifras (código NC; XSD alfaNum8Td). Error 2101 si no.
 *  - R23 nota [4] / R232 / C321: con F48, F49 o F53, cada partida lleva al menos
 *    un C127 y un C128 (SupportingDocument) y un C129 (SupportingDocument) o un
 *    Y081 (AdditionalReference). Error 1353 si faltan.
 */
const {
  codigoNC8,
  codigoAdicionalH7,
  exigeIdentificadoresDeProducto,
  validarPartidasH7ParaAeat,
  Y081_REF_NUM
} = require('../../../src/services/aeat/h7Identificadores');

const partida = (extra = {}) => ({
  description: 'Libro',
  taricCode: '4901990000',
  commercialId: 'SKU-LIBRO-1',
  manufacturerRef: 'EDT-REF-77',
  ...extra
});

describe('codigoNC8', () => {
  test('recorta un TARIC de 10 cifras a las 8 primeras (NC)', () => {
    expect(codigoNC8('4901990000')).toBe('49019900');
  });
  test('deja tal cual un código de 8 cifras', () => {
    expect(codigoNC8('49019900')).toBe('49019900');
  });
  test('ignora espacios y puntos de formato', () => {
    expect(codigoNC8(' 4901.99.00 ')).toBe('49019900');
  });
  test('solo admite 8 (NC) o 10 (TARIC) cifras', () => {
    expect(codigoNC8('490199000')).toBeNull();
    expect(codigoNC8('49019900001')).toBeNull();
  });
  test('devuelve null si hay menos de 8 cifras', () => {
    expect(codigoNC8('490199')).toBeNull();
    expect(codigoNC8('')).toBeNull();
    expect(codigoNC8(undefined)).toBeNull();
  });
});

describe('codigoAdicionalH7', () => {
  test('F48 (IOSS) solo con IVA prepagado e IOSS válido', () => {
    expect(codigoAdicionalH7({ vatPrepaid: true, iossNumber: 'IM1234567890' })).toBe('F48');
  });
  test('F53 en el resto (IVA a la importación)', () => {
    expect(codigoAdicionalH7({ vatPrepaid: true, iossNumber: 'X' })).toBe('F53');
    expect(codigoAdicionalH7({})).toBe('F53');
  });
  test('respeta el código explícito de la declaración', () => {
    expect(codigoAdicionalH7({ additionalProcedureCode: 'C08' })).toBe('C08');
  });
});

describe('exigeIdentificadoresDeProducto', () => {
  test.each(['F48', 'F49', 'F53'])('%s los exige', (c) => {
    expect(exigeIdentificadoresDeProducto(c)).toBe(true);
  });
  test('C08 (entre particulares) no los exige', () => {
    expect(exigeIdentificadoresDeProducto('C08')).toBe(false);
  });
});

describe('validarPartidasH7ParaAeat', () => {
  test('partida completa sin C129: sin errores (irá Y081)', () => {
    expect(validarPartidasH7ParaAeat([partida()], 'F53')).toEqual([]);
  });

  test('partida completa con GTIN válido: sin errores', () => {
    expect(validarPartidasH7ParaAeat([partida({ gtin: '9788420412146' })], 'F53')).toEqual([]);
  });

  test('sin partidas: error', () => {
    const e = validarPartidasH7ParaAeat([], 'F53');
    expect(e).toHaveLength(1);
    expect(e[0].code).toBe('H7_SIN_PARTIDAS');
  });

  test('TARIC de 6 cifras: dice la partida y que hacen falta 8', () => {
    const e = validarPartidasH7ParaAeat([partida(), partida({ taricCode: '490199' })], 'F53');
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ partida: 2, field: 'items.1.taricCode', code: 'H7_NC_8_CIFRAS' });
    expect(e[0].message).toMatch(/Partida 2/);
    expect(e[0].message).toMatch(/8 cifras/);
    expect(e[0].message).toMatch(/490199/);
  });

  test('falta C127: dice partida y el identificador comercial', () => {
    const e = validarPartidasH7ParaAeat([partida({ commercialId: '  ' })], 'F48');
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ partida: 1, field: 'items.0.commercialId', code: 'H7_FALTA_C127' });
    expect(e[0].message).toMatch(/Partida 1/);
    expect(e[0].message).toMatch(/identificador comercial/i);
  });

  test('falta C128: dice partida y la referencia del fabricante', () => {
    const e = validarPartidasH7ParaAeat([partida({ manufacturerRef: '' })], 'F49');
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ partida: 1, field: 'items.0.manufacturerRef', code: 'H7_FALTA_C128' });
    expect(e[0].message).toMatch(/referencia del fabricante/i);
  });

  test('GTIN con formato inválido: error de C129', () => {
    const e = validarPartidasH7ParaAeat([partida({ gtin: 'ABC123' })], 'F53');
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ code: 'H7_C129_FORMATO', field: 'items.0.gtin' });
  });

  test('identificador de más de 70 caracteres: error', () => {
    const e = validarPartidasH7ParaAeat([partida({ commercialId: 'x'.repeat(71) })], 'F53');
    expect(e[0]).toMatchObject({ code: 'H7_IDENTIFICADOR_LARGO', field: 'items.0.commercialId' });
  });

  test('código de relleno (9999..., 0000...) no se envía a la AEAT', () => {
    expect(validarPartidasH7ParaAeat([partida({ taricCode: '9999000000' })], 'F53')[0].code).toBe('H7_NC_FICTICIO');
    expect(validarPartidasH7ParaAeat([partida({ taricCode: '00000000' })], 'F53')[0].code).toBe('H7_NC_FICTICIO');
  });

  test('con C08 no se exigen C127/C128 (sí el código NC)', () => {
    expect(validarPartidasH7ParaAeat([partida({ commercialId: '', manufacturerRef: '' })], 'C08')).toEqual([]);
    expect(validarPartidasH7ParaAeat([partida({ taricCode: '4901' })], 'C08')).toHaveLength(1);
  });

  test('acumula los errores de varias partidas', () => {
    const e = validarPartidasH7ParaAeat([
      partida({ commercialId: '' }),
      partida({ manufacturerRef: '', taricCode: '490199' })
    ], 'F53');
    expect(e.map(x => x.code)).toEqual(['H7_FALTA_C127', 'H7_NC_8_CIFRAS', 'H7_FALTA_C128']);
  });
});

test('Y081 lleva un addRefNum (la guía lo exige en la partida) de máx. 70', () => {
  expect(typeof Y081_REF_NUM).toBe('string');
  expect(Y081_REF_NUM.length).toBeGreaterThan(0);
  expect(Y081_REF_NUM.length).toBeLessThanOrEqual(70);
});
