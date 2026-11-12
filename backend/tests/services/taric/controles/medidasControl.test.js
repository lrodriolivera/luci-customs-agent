const {
  esMedidaDeControl, interpretarCondiciones, leerMedidasControl, leerExclusiones, leerAreas, leerDescripciones,
  medidasPara, prefijoDe, prefijosDe
} = require('../../../../src/services/taric/controles/medidasControl');

const CABECERA = ['Goods code', 'Add code', 'Order No.', 'Start date', 'End date', 'RED_IND', 'Origin', ' Measure type', 'Legal base', 'Duty', 'Origin code', ' Meas. type code'];
const fila = (codigo, origen, tipo, condiciones = '', extra = {}) => [
  codigo, extra.adicional || '', '', extra.desde || '01-01-2020', extra.hasta || '', '', extra.origenNombre || origen,
  extra.tipoNombre || 'Veterinary control', extra.base || 'Regulation 0632/21', condiciones, origen, tipo
];
const HOY = new Date('2026-11-12T10:00:00Z');

describe('medidas de control: qué es un control', () => {
  test('los controles, restricciones y prohibiciones lo son; los derechos y precios no', () => {
    expect(['277', '410', '415', '465', '710', '755', '775'].every(esMedidaDeControl)).toBe(true);
    expect(['103', '142', '552', '488', '490', '109', ''].some(esMedidaDeControl)).toBe(false);
  });
});

describe('medidas de control: condiciones', () => {
  test('un grupo con certificados alternativos', () => {
    expect(interpretarCondiciones('Cond:  B cert: C-640 (29):; B cert: Y-072 (29):; B (09):')).toEqual([
      { grupo: 'B', certificados: ['C640', 'Y072'], exenciones: [], impideSinCertificado: true }
    ]);
  });

  test('varios grupos se leen por separado', () => {
    const grupos = interpretarCondiciones('Cond:  Y cert: Y-152 (29):; Y (09):; YA cert: Y-123 (29):; YA cert: Y-160 (29):; YA (09):');
    expect(grupos.map((g) => [g.grupo, g.certificados])).toEqual([['Y', ['Y152']], ['YA', ['Y123', 'Y160']]]);
  });

  test('una exención por cantidad queda anotada en su grupo', () => {
    const [grupo] = interpretarCondiciones('Cond:  E cert: C-672 (29):; E 20.000/KGM(29):; E (09):');
    expect(grupo.certificados).toEqual(['C672']);
    expect(grupo.exenciones).toEqual([{ cantidad: 20, unidad: 'KGM' }]);
  });

  test('las condiciones de precio, sin certificado, no dan grupos', () => {
    expect(interpretarCondiciones('Cond:  R 160.001/KGM(10):; R 80.001/KGM(28):; R 0.000/KGM(10):')).toEqual([]);
    expect(interpretarCondiciones('Cond:  M 0.301 EUR/KGM(10):; M 0.000 EUR/KGM(28):')).toEqual([]);
  });

  test('sin texto, o con un derecho, no hay condiciones', () => {
    expect(interpretarCondiciones('')).toEqual([]);
    expect(interpretarCondiciones('12.000 % ')).toEqual([]);
  });
});

describe('medidas de control: lectura del fichero', () => {
  const filas = [
    CABECERA,
    fila('0201000000', '1008', '410', 'Cond:  B cert: N-853 (29):; B (09):'),
    fila('0201000000', '1011', '103', '12.800 % + 176.800 EUR DTN '),
    fila('0201000000', '1011', '410', '', { hasta: '31-12-2025' }),
    fila('0201000000', '1011', '750', '', { desde: '01-01-2027' }),
    fila('6302100000', 'KP', '277', '', { tipoNombre: 'Import prohibition', base: 'Regulation 0936/15' })
  ];

  test('se queda con los controles vigentes y descarta derechos, caducados y futuros', () => {
    const medidas = leerMedidasControl(filas, { fecha: HOY });
    expect(medidas.map((m) => [m.codigo, m.origen, m.tipo])).toEqual([['0201000000', '1008', '410'], ['6302100000', 'KP', '277']]);
    expect(medidas[0]).toMatchObject({ prefijo: '0201', baseLegal: 'Regulation 0632/21', tipoNombre: 'Veterinary control' });
    expect(medidas[0].condiciones[0].certificados).toEqual(['N853']);
  });

  test('rechaza un fichero sin las columnas esperadas', () => {
    expect(() => leerMedidasControl([['a', 'b']])).toThrow('columnas');
  });
});

describe('medidas de control: a qué código y origen alcanzan', () => {
  const medidas = leerMedidasControl([
    CABECERA,
    fila('0201000000', '1008', '410', 'Cond:  B cert: N-853 (29):; B (09):'),
    fila('0200000000', '1011', '750', 'Cond:  B cert: C-644 (29):; B cert: Y-929 (29):; B (09):', { tipoNombre: 'Import control of organic products' }),
    fila('0201100000', 'BR', '465', '', { tipoNombre: 'Restriction on entry into free circulation' }),
    fila('0202000000', '1008', '410', 'Cond:  B cert: N-853 (29):; B (09):'),
    fila('0201000000', 'EU', '410', 'Cond:  B cert: N-853 (29):; B cert: Y-072 (29):; B (09):')
  ], { fecha: HOY });
  const areas = { 1011: ['BR', 'CH', 'CN'], 1008: ['BR', 'CN', 'CH'] };

  test('los prefijos siguen los niveles del código', () => {
    expect(prefijoDe('0201000000')).toBe('0201');
    expect(prefijoDe('0208402000')).toBe('02084020');
    expect(prefijoDe('0100000000')).toBe('01');
    expect(prefijosDe('0201100000')).toEqual(['02', '0201', '020110', '02011000', '0201100000']);
  });

  test('reúne las medidas del código y de sus niveles superiores para ese origen', () => {
    const tipos = medidasPara('0201100000', 'BR', medidas, { areas }).map((m) => m.tipo).sort();
    expect(tipos).toEqual(['410', '465', '750']);
  });

  test('no arrastra las de otra partida ni las de otro origen', () => {
    const tipos = medidasPara('0201100000', 'CN', medidas, { areas }).map((m) => m.tipo).sort();
    expect(tipos).toEqual(['410', '750']);
  });

  test('un país excluido de la medida no la recibe', () => {
    const exclusiones = { '0200000000||1011|750': ['CH'] };
    expect(medidasPara('0201100000', 'CH', medidas, { areas, exclusiones }).map((m) => m.tipo)).toEqual(['410']);
  });

  test('un país fuera de todo grupo solo recibe las dirigidas a él', () => {
    expect(medidasPara('0201100000', 'ZZ', medidas, { areas })).toEqual([]);
  });
});

describe('medidas de control: ficheros de apoyo', () => {
  test('lee las exclusiones solo de las medidas de control', () => {
    const exclusiones = leerExclusiones([
      ['Goods code', 'Add code', 'Order No.', 'Start date', 'End date', 'Origin', 'Measure type', 'Excluded country code', 'Origin code', 'Meas. type code', 'Excluded country'],
      ['0100000000', '', '', '01-01-2022', '', 'ERGA OMNES', 'Import control of organic products', 'Switzerland', '1011', '750', 'CH'],
      ['0100000000', '', '', '01-01-2022', '', 'ERGA OMNES', 'Import control of organic products', 'Iceland', '1011', '750', 'IS'],
      ['0100000000', '', '', '01-01-2022', '', 'ERGA OMNES', 'Tariff preference', 'Iceland', '1011', '142', 'IS']
    ]);
    expect(exclusiones).toEqual({ '0100000000||1011|750': ['CH', 'IS'] });
  });

  test('lee los miembros vigentes de cada grupo de países', () => {
    const areas = leerAreas([
      ['Country group', 'Start date', 'Language', 'Abbrev.', 'Country group descr.', 'Member country', 'Abbrev.', 'Description', 'Mbship start date', 'Mbship end date', 'End date'],
      ['1008', '01-01-2005', 'EN', 'TP', 'All third countries', 'CN', 'CN', 'China', '01-01-2005', '', ''],
      ['1008', '01-01-2005', 'EN', 'TP', 'All third countries', 'GB', 'GB', 'United Kingdom', '01-01-2005', '31-12-2010', '']
    ]);
    expect(areas).toEqual({ 1008: ['CN'] });
  });

  test('lee las descripciones vigentes en español', () => {
    const descripciones = leerDescripciones([
      ['Certificate code', 'Language', 'Description', 'Start date', 'Description start date', 'End date'],
      ['N853', 'EN', 'Common Health Entry Document', '01-01-2020', '01-01-2020', ''],
      ['N853', 'ES', 'Documento sanitario común de entrada  (DSCE-P)', '01-01-2020', '01-01-2020', ''],
      ['X001', 'ES', 'Caducado', '01-01-2000', '01-01-2000', '31-12-2010']
    ]);
    expect(descripciones).toEqual({ N853: 'Documento sanitario común de entrada (DSCE-P)' });
  });
});
