/**
 * Formas del derecho de terceros paises que el catalogo tenia como «no
 * calculables» (volcado de produccion del 13/Nov/2026: 552 codigos). Los textos
 * son literales de la celda «Duty» de «Duties Import 01-99.xlsx» de noviembre
 * de 2026 (CIRCABC).
 */
const { interpretarFormula, clasificarDerecho } = require('../../../src/services/taric/formasDerecho');
const { liquidarFormula, importeDeDerecho, elegirVariante, codigoAdicionalDe } = require('../../../src/services/taric/liquidacionDerecho');

describe('interpretarFormula: sumandos con minimo y maximo', () => {
  test('porcentaje mas importe por 100 kg con maximo en porcentaje (1704101000, chicle)', () => {
    expect(interpretarFormula('6.200 % + 27.100 EUR DTN MAX 17.900 % ')).toEqual({
      texto: '6.200 % + 27.100 EUR DTN MAX 17.900 %',
      sumandos: [{ adValorem: 6.2 }, { amount: 27.1, unit: 'EUR/100 kg' }],
      minimo: [],
      maximo: [{ adValorem: 17.9 }]
    });
  });

  test('maximo compuesto de porcentaje e importe (1704903000, chocolate blanco)', () => {
    expect(interpretarFormula('9.100 % + 45.100 EUR DTN MAX 18.900 % + 16.500 EUR DTN')).toMatchObject({
      sumandos: [{ adValorem: 9.1 }, { amount: 45.1, unit: 'EUR/100 kg' }],
      maximo: [{ adValorem: 18.9 }, { amount: 16.5, unit: 'EUR/100 kg' }]
    });
  });

  test('importe por pieza con minimo y maximo en porcentaje (9111000000, cajas de reloj)', () => {
    expect(interpretarFormula('0.500 EUR NAR MIN 2.700 % MAX 4.600 %')).toMatchObject({
      sumandos: [{ amount: 0.5, unit: 'EUR/p/st' }], minimo: [{ adValorem: 2.7 }], maximo: [{ adValorem: 4.6 }]
    });
  });

  test('tres sumandos: porcentaje, por hl y por 100 kg (2009691100, zumo de uva)', () => {
    expect(interpretarFormula('40.000 % + 121.000 EUR HLT + 20.600 EUR DTN').sumandos).toEqual([
      { adValorem: 40 }, { amount: 121, unit: 'EUR/hl' }, { amount: 20.6, unit: 'EUR/100 kg' }
    ]);
  });

  test('minimo por 100 kg de peso bruto (0705110000, lechugas)', () => {
    expect(interpretarFormula('12.000 % MIN 2.000 EUR DTN G')).toMatchObject({
      sumandos: [{ adValorem: 12 }], minimo: [{ amount: 2, unit: 'EUR/100 kg brutos' }], maximo: []
    });
  });

  test('lo que exige datos que LUCI no tiene no se interpreta', () => {
    for (const texto of [
      '9.000 % + EA MAX 18.700 % +ADSZ', '7.600 % + EA', '1.190 EUR KGM P + 27.500 EUR DTN', '5.100 % + 9.400 EUR DTN E',
      '1.750 EUR ASV X', '0.400 EUR DTN Z', '6.500 % MAX 5.000 EUR HMT', '1.620 EUR KGM A', '16.100 EUR DTN M',
      'Cond: V 62.600 EUR/DTN(01):8.800 % ; V 0.000 EUR/DTN(01):8.800 % + 29.800 EUR DTN', '', null
    ]) expect(interpretarFormula(texto)).toBeNull();
  });
});

describe('clasificarDerecho: forma y dato que falta', () => {
  test.each([
    ['9.000 % + EA MAX 18.700 % +ADSZ', 'elemento_agricola'],
    ['7.600 % + EA', 'elemento_agricola'],
    ['8.300 % + EA MAX 24.200 % +ADFM', 'elemento_agricola'],
    ['Cond: V 62.600 EUR/DTN(01):8.800 % ; V 61.300 EUR/DTN(01):8.800 % + 1.300 EUR DTN', 'precio_entrada'],
    ['Cond: V 85.500 EUR/HLT(01):17.600 % ; V 83.800 EUR/HLT(01):17.600 % + 1.700 EUR HLT', 'precio_entrada'],
    ['1.190 EUR KGM P + 27.500 EUR DTN', 'materia_lactea'],
    ['0.950 EUR KGM T', 'materia_lactea'],
    ['5.100 % + 9.400 EUR DTN E', 'peso_escurrido'],
    ['1.750 EUR ASV X', 'grado_alcoholico'],
    ['0.900 EUR ASV X + 6.400 EUR HLT', 'grado_alcoholico'],
    ['0.400 EUR DTN Z', 'contenido_azucar'],
    ['16.100 EUR DTN M', 'materia_seca'],
    ['41.900 EUR DTN R', 'calidad_tipo_azucar'],
    ['1.620 EUR KGM A', 'alcohol_total'],
    ['6.500 % MAX 5.000 EUR HMT', 'unidad_no_soportada'],
    ['8.000 % MAX 0.300 EUR MTK', 'unidad_no_soportada'],
    ['Cond: B cert: Y-155 (01):94.000 EUR TNE ; B (01):0.000 EUR TNE ; H cert: N-990 (28):; H (08):', 'condicionado_certificado'],
    ['6.200 % + 27.100 EUR DTN MAX 17.900 %', 'compuesto']
  ])('«%s» -> %s', (texto, forma) => {
    const r = clasificarDerecho(texto);
    expect(r.forma).toBe(forma);
    expect(r.calculable).toBe(forma === 'compuesto');
    if (forma !== 'compuesto') expect(r.faltan.length).toBeGreaterThan(0);
  });

  test('el dato que falta se dice en claro', () => {
    expect(clasificarDerecho('1.750 EUR ASV X').faltan.join(' ')).toMatch(/grado alcoholico/);
    expect(clasificarDerecho('7.600 % + EA').faltan.join(' ')).toMatch(/elemento agricola/);
    expect(clasificarDerecho('Cond: V 62.600 EUR/DTN(01):8.800 %').faltan.join(' ')).toMatch(/precio de entrada/);
  });
});

describe('liquidarFormula', () => {
  const chicle = interpretarFormula('6.200 % + 27.100 EUR DTN MAX 17.900 %');

  test('suma los sumandos', () => {
    // 1.000 EUR y 500 kg: 62 + 135,5 = 197,5 -> por debajo del maximo (179): queda en 179
    const r = liquidarFormula(chicle, { customsValue: 1000, netWeight: 500 });
    expect(r.adValoremDuty).toBeCloseTo(62);
    expect(r.specificDuty).toBeCloseTo(135.5);
    expect(r.totalDuty).toBeCloseTo(179);
    expect(r.avisos).toEqual([]);
  });

  test('sin llegar al maximo', () => {
    // 10.000 EUR y 100 kg: 620 + 27,1 = 647,1 < 1.790
    expect(liquidarFormula(chicle, { customsValue: 10000, netWeight: 100 }).totalDuty).toBeCloseTo(647.1);
  });

  test('maximo compuesto', () => {
    const f = interpretarFormula('9.100 % + 45.100 EUR DTN MAX 18.900 % + 16.500 EUR DTN');
    // 1.000 EUR y 1.000 kg: 91 + 451 = 542; maximo 189 + 165 = 354
    expect(liquidarFormula(f, { customsValue: 1000, netWeight: 1000 }).totalDuty).toBeCloseTo(354);
  });

  test('minimo y maximo sobre un importe por pieza', () => {
    const f = interpretarFormula('0.500 EUR NAR MIN 2.700 % MAX 4.600 %');
    expect(liquidarFormula(f, { customsValue: 1000, quantity: 10 }).totalDuty).toBeCloseTo(27);     // 5 < minimo 27
    expect(liquidarFormula(f, { customsValue: 1000, quantity: 70 }).totalDuty).toBeCloseTo(35);     // entre los dos
    expect(liquidarFormula(f, { customsValue: 1000, quantity: 200 }).totalDuty).toBeCloseTo(46);    // 100 > maximo 46
  });

  test('peso bruto para el minimo', () => {
    const f = interpretarFormula('12.000 % MIN 2.000 EUR DTN G');
    expect(liquidarFormula(f, { customsValue: 100, netWeight: 900, grossWeight: 1000 }).totalDuty).toBeCloseTo(20);
  });

  test('si falta un dato no se inventa: se avisa y no cuenta', () => {
    const f = interpretarFormula('12.000 % MIN 2.000 EUR DTN G');
    const r = liquidarFormula(f, { customsValue: 100, netWeight: 900 });
    expect(r.totalDuty).toBeCloseTo(12);
    expect(r.avisos.join(' ')).toMatch(/minimo/);
    expect(r.avisos.join(' ')).toMatch(/peso bruto/);

    const zumo = liquidarFormula(interpretarFormula('40.000 % + 121.000 EUR HLT + 20.600 EUR DTN'), { customsValue: 1000, netWeight: 100 });
    expect(zumo.totalDuty).toBeCloseTo(420.6);
    expect(zumo.avisos.join(' ')).toMatch(/121 EUR\/hl/);
  });
});

describe('importeDeDerecho: el derecho de siempre (porcentaje, especifico, suma, minimo y maximo)', () => {
  test('ad valorem', () => {
    expect(importeDeDerecho({ dutyRate: 5.5, dutyType: 'ad_valorem' }, { customsValue: 1000 }))
      .toEqual({ adValoremDuty: 55, specificDuty: 0, totalDuty: 55, avisos: [] });
  });

  test('suma con minimo', () => {
    const r = importeDeDerecho({ dutyRate: 10, dutyType: 'compound', specificDuty: { amount: 10, unit: 'EUR/100 kg' }, minimumDuty: { amount: 50, unit: 'EUR/100 kg' } }, { customsValue: 100, netWeight: 100 });
    expect(r.totalDuty).toBe(50);
  });
});

describe('codigo adicional', () => {
  test('se toma del parametro o de las cifras 11 a 14 del codigo', () => {
    expect(codigoAdicionalDe(' 2500 ', '2818300090')).toBe('2500');
    expect(codigoAdicionalDe(null, '28183000902501')).toBe('2501');
    expect(codigoAdicionalDe(undefined, '2818 30 00 90 2501')).toBe('2501');
    expect(codigoAdicionalDe(null, '2818300090')).toBeNull();
    expect(codigoAdicionalDe('abc', '2818300090')).toBeNull();
  });

  const variantes = [
    { codigoAdicional: '2500', descripcion: 'Anexo I "Nomenclatura Combinada", Tercera Parte, Sección II (sustancias farmaceúticas)', texto: '0.000 %', thirdCountry: 0 },
    { codigoAdicional: '2501', descripcion: 'Las demás', texto: '5.500 %', thirdCountry: 5.5 }
  ];

  test('con el codigo adicional declarado se usa su variante', () => {
    const r = elegirVariante(variantes, '2500', { customsValue: 1000 });
    expect(r.variante.codigoAdicional).toBe('2500');
    expect(r.avisos.join(' ')).toMatch(/2500/);
  });

  test('sin codigo adicional se liquida con la variante de mayor importe y se pide el codigo', () => {
    const r = elegirVariante(variantes, null, { customsValue: 1000 });
    expect(r.variante.codigoAdicional).toBe('2501');
    expect(r.faltaCodigoAdicional).toBe(true);
    const aviso = r.avisos.join(' ');
    expect(aviso).toMatch(/codigo adicional/);
    expect(aviso).toMatch(/2500.*0 %/);
    expect(aviso).toMatch(/2501.*Las demás.*5,5 %/);
  });

  test('un codigo adicional que no es de este codigo tampoco se adivina', () => {
    const r = elegirVariante(variantes, '2550', { customsValue: 1000 });
    expect(r.variante.codigoAdicional).toBe('2501');
    expect(r.faltaCodigoAdicional).toBe(true);
    expect(r.avisos.join(' ')).toMatch(/2550 no es uno de los codigos adicionales/);
  });
});
