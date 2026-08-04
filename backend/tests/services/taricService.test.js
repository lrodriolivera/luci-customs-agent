/**
 * taricService: normalizacion de codigos, preferencias arancelarias y avisos.
 *
 * Estaba al 0% de cobertura. Es el servicio que decide con que arancel se
 * liquida una mercancia: equivocarse en la preferencia significa pagar de mas,
 * o de menos y arrastrar una liquidacion complementaria de la AEAT.
 *
 * Se prueban los metodos sincronos y puros, que son los que contienen la
 * decision aduanera. Los que salen a la API de la Comision Europea o a Mongo
 * quedan fuera a proposito: mockear axios probaria el mock, no el servicio.
 *
 * NADA esta mockeado aqui. El servicio se instancia de verdad.
 */

const taric = require('../../src/services/taricService');

describe('_normalizeCode: los codigos llegan escritos de mil formas', () => {
  test.each([
    ['6109 10 00 10', '6109100010'],
    ['6109.10.00.10', '6109100010'],
    ['  6109100010  ', '6109100010'],
    ['6109100010', '6109100010']
  ])('%s -> %s', (entrada, esperado) => {
    // La UI, los ficheros del cliente y la AEAT usan formatos distintos.
    expect(taric._normalizeCode(entrada)).toBe(esperado);
  });

  test('completa con ceros hasta 10 digitos', () => {
    // Una clasificacion a nivel de partida (4 digitos) se extiende al TARIC
    // completo: 6109 -> 6109000000.
    expect(taric._normalizeCode('6109')).toBe('6109000000');
  });

  test('trunca lo que exceda de 10 digitos', () => {
    expect(taric._normalizeCode('61091000101234')).toBe('6109100010');
  });

  // LIMITACION CONOCIDA, no corregida: solo se eliminan espacios y puntos, no
  // guiones ni barras. '6109-10-00-10' produce '6109-10-00' -- un codigo con
  // guiones truncado a 10 caracteres, que no casara con nada en el catalogo.
  //
  // No se toca la logica porque no consta que lleguen codigos asi: la UI envia
  // digitos y taricsearchhistories esta vacia, sin un solo caso real. Si algun
  // dia aparece, el arreglo es cambiar /[\s.]/g por /[^0-9]/g -- pero eso
  // tambien silenciaria entradas basura en vez de rechazarlas, y esa es una
  // decision de producto.
  test('los guiones NO se eliminan (comportamiento actual)', () => {
    expect(taric._normalizeCode('6109-10-00-10')).toBe('6109-10-00');
  });
});

describe('_parseCodeBreakdown: jerarquia del codigo', () => {
  // Un TARIC de 10 digitos contiene la jerarquia completa: capitulo (2),
  // partida (4), subpartida (6), codigo CN (8) y TARIC (10). Cada nivel decide
  // cosas distintas: el capitulo, si hay controles; el CN, el arancel base.
  test('descompone un codigo de 10 digitos', () => {
    expect(taric._parseCodeBreakdown('6109100010')).toEqual({
      chapter: '61',
      heading: '6109',
      subheading: '610910',
      cnCode: '61091000',
      taricCode: '6109100010'
    });
  });

  test('el capitulo son los dos primeros digitos', () => {
    // 22 = bebidas, 24 = tabaco: los excluidos del H7.
    expect(taric._parseCodeBreakdown('2204100000').chapter).toBe('22');
    expect(taric._parseCodeBreakdown('2402200000').chapter).toBe('24');
  });

  test('tolera un codigo mas corto de lo normal', () => {
    // Llegan asi de clasificaciones a nivel de partida.
    const r = taric._parseCodeBreakdown('6109');

    expect(r.chapter).toBe('61');
    expect(r.heading).toBe('6109');
  });
});

describe('getAvailablePreferences: que acuerdos aplican a un origen', () => {
  test('siempre incluye el arancel de terceros paises', () => {
    // Es la opcion por defecto: sin acuerdo, se paga la tarifa general.
    const prefs = taric.getAvailablePreferences('US');

    expect(prefs.some(p => p.code === '100')).toBe(true);
  });

  test('un pais con acuerdo tiene mas de una opcion', () => {
    // Marruecos tiene EUR-MED con la UE.
    const prefs = taric.getAvailablePreferences('MA');

    expect(prefs.length).toBeGreaterThan(1);
  });

  test('cada preferencia dice si exige certificado', () => {
    // Sin el certificado de origen, la preferencia no se puede invocar en el
    // DUA: es el documento que la justifica ante Aduanas.
    for (const p of taric.getAvailablePreferences('MA')) {
      expect(p).toHaveProperty('certificate');
      expect(p).toHaveProperty('name');
    }
  });

  test('un pais sin acuerdo solo tiene el arancel general', () => {
    const prefs = taric.getAvailablePreferences('XX');

    expect(prefs.map(p => p.code)).toEqual(['100']);
  });
});

describe('_checkPreferenceEligibility: derecho a la preferencia', () => {
  const acuerdo = { countries: ['MA', 'TN', 'EG'], reduction: 100 };

  test('un pais de la lista tiene derecho', () => {
    expect(taric._checkPreferenceEligibility('MA', acuerdo)).toBe(true);
  });

  test('un pais fuera de la lista NO tiene derecho', () => {
    // Aplicarsela igualmente seria liquidar de menos: la AEAT lo detecta en
    // control documental y gira una complementaria con recargo.
    expect(taric._checkPreferenceEligibility('US', acuerdo)).toBe(false);
  });

  test('un acuerdo sin lista de paises no da derecho a cualquiera', () => {
    expect(taric._checkPreferenceEligibility('US', {})).toBeFalsy();
  });
});

describe('_generateDutyWarnings: avisos al declarante', () => {
  test('sin nada que advertir devuelve lista vacia', () => {
    expect(taric._generateDutyWarnings({}, 'CN', '100')).toEqual([]);
  });

  test('avisa si el codigo exige unidades suplementarias', () => {
    // Sin la unidad suplementaria (pares, litros de alcohol puro...) la AEAT
    // rechaza la declaracion.
    const avisos = taric._generateDutyWarnings(
      { supplementaryUnit: { required: true, description: 'Numero de pares', type: 'NPR' } },
      'CN', '100'
    );

    expect(avisos.join(' ')).toMatch(/unidades suplementarias/i);
    expect(avisos.join(' ')).toMatch(/NPR/);
  });

  test('avisa de los impuestos especiales', () => {
    const avisos = taric._generateDutyWarnings(
      { specialTaxes: [{ type: 'ALCOHOL' }, { type: 'IVA_ESPECIAL' }] },
      'ES', '100'
    );

    expect(avisos.join(' ')).toMatch(/impuestos especiales/i);
    expect(avisos.join(' ')).toMatch(/ALCOHOL/);
  });

  test('avisa si el origen no tiene derecho a la preferencia invocada', () => {
    // El caso que cuesta dinero: se declara una preferencia a la que no se
    // tiene derecho y la liquidacion sale corta.
    const avisos = taric._generateDutyWarnings({}, 'US', '300');

    expect(avisos.join(' ')).toMatch(/no tiene derecho/i);
    expect(avisos.join(' ')).toMatch(/US/);
  });

  test('NO avisa cuando el origen si tiene derecho', () => {
    // Un aviso falso es tan malo como su ausencia: se aprende a ignorarlos.
    expect(taric._generateDutyWarnings({}, 'MA', '300')).toEqual([]);
  });

  test('el arancel general (100) nunca genera aviso de preferencia', () => {
    expect(taric._generateDutyWarnings({}, 'US', '100')).toEqual([]);
  });

  test('acumula varios avisos a la vez', () => {
    const avisos = taric._generateDutyWarnings(
      {
        supplementaryUnit: { required: true, description: 'Litros', type: 'LTR' },
        specialTaxes: [{ type: 'ALCOHOL' }]
      },
      'US', '300'
    );

    expect(avisos.length).toBe(3);
  });
});

describe('_extractKeywords: terminos utiles de una descripcion', () => {
  test('quita las palabras vacias', () => {
    expect(taric._extractKeywords('camiseta de algodon para hombre'))
      .toEqual(['camiseta', 'algodon', 'hombre']);
  });

  test('descarta las palabras de dos letras o menos', () => {
    // 'de', 'la', 'y'... no ayudan a encontrar un codigo arancelario.
    expect(taric._extractKeywords('ropa de la mujer y el hombre'))
      .not.toContain('el');
  });

  test('normaliza a minusculas', () => {
    expect(taric._extractKeywords('CAMISETA Algodon')).toEqual(['camiseta', 'algodon']);
  });

  test('una descripcion vacia no revienta', () => {
    expect(taric._extractKeywords('')).toEqual([]);
  });
});

describe('_searchCommonCodes: busqueda en el catalogo local', () => {
  test('encuentra un textil por su descripcion', () => {
    const r = taric._searchCommonCodes('camiseta', 5);

    expect(r.length).toBeGreaterThan(0);
    expect(r[0].code).toMatch(/^\d{8,10}$/);
  });

  test('respeta el limite pedido', () => {
    expect(taric._searchCommonCodes('a', 2).length).toBeLessThanOrEqual(2);
  });

  test('cada resultado trae descripcion en dos idiomas', () => {
    // La UI de LUCI es multiidioma y el DUA se presenta en castellano.
    const [primero] = taric._searchCommonCodes('camiseta', 1);

    expect(primero.description).toHaveProperty('es');
    expect(primero.description).toHaveProperty('en');
  });

  test('una busqueda sin resultados devuelve lista vacia, no error', () => {
    expect(taric._searchCommonCodes('zzzzqqqxxx', 5)).toEqual([]);
  });
});
