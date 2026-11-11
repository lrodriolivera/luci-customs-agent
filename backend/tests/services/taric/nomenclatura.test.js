/**
 * Lectura de los ficheros oficiales del TARIC (CIRCABC) y de la respuesta del
 * servicio web de descripciones. Las filas de ejemplo son las reales de la
 * extraccion de noviembre de 2026.
 */
const { leerPrimeraHoja } = require('../../../src/services/taric/xlsxSimple');
const { leerNomenclatura, leerDeclarables, leerRutas, textoLegible, fechaDe } = require('../../../src/services/taric/nomenclaturaOficial');
const { descripcionDeRespuesta, descripcionOficial } = require('../../../src/services/taric/descripcionOficial');
const { xlsxDePrueba } = require('../../helpers/xlsxDePrueba');

const CAB_NOM = ['Goods code', 'Start date', 'End date', 'Language', 'Hier. Pos.', 'Indent', 'Description', 'Descr. start date'];
const CAB_DEC = ['Goods code', 'Start date', 'Decl. start date', 'IS_LEAF', 'End date'];
const NOMENCLATURA = [
  CAB_NOM,
  ['0100000000 80', '31-12-1971', '', 'EN', '2', '', 'LIVE ANIMALS', '31-12-1971'],
  ['0101210000 10', '01-01-2012', '', 'EN', '6', '- ', 'Horses', '01-01-2019'],
  ['0101210000 80', '01-01-2012', '', 'EN', '6', '- - ', 'Pure-bred breeding animals', '01-01-2019'],
  ['8544429010 80', '01-07-2014', '31-12-2026', 'EN', '10', '- - - - ', 'Data cable <br> & "connectors"', '01-07-2014']
];

describe('xlsxSimple', () => {
  test.each([[true], [false]])('lee las celdas de texto (cadenas compartidas: %s) y respeta las celdas vacias', (compartidas) => {
    const filas = leerPrimeraHoja(xlsxDePrueba(NOMENCLATURA, { compartidas }));

    expect(filas).toHaveLength(5);
    expect(filas[0]).toEqual(CAB_NOM);
    expect(filas[1][2]).toBe('');
    expect(filas[1][6]).toBe('LIVE ANIMALS');
    expect(filas[4][6]).toBe('Data cable <br> & "connectors"');
  });

  test('un fichero que no es un xlsx con hoja de datos da un error claro', () => {
    const { zipSync, strToU8 } = require('fflate');
    expect(() => leerPrimeraHoja(Buffer.from(zipSync({ 'otro.txt': strToU8('x') })))).toThrow('no contiene ninguna hoja');
    expect(() => leerPrimeraHoja(Buffer.from('esto no es un zip'))).toThrow();
  });
});

describe('leerNomenclatura', () => {
  test('se queda con las lineas declarables (sufijo 80) y sus datos', () => {
    const lineas = leerNomenclatura(leerPrimeraHoja(xlsxDePrueba(NOMENCLATURA)));

    expect([...lineas.keys()]).toEqual(['0100000000', '0101210000', '8544429010']);
    expect(lineas.get('0101210000')).toMatchObject({ nivel: 6, descripcion: 'Pure-bred breeding animals', idioma: 'en' });
    expect(lineas.get('8544429010')).toMatchObject({ nivel: 10, validoDesde: fechaDe('01-07-2014'), validoHasta: fechaDe('31-12-2026') });
    expect(lineas.get('0100000000').validoHasta).toBeNull();
  });

  test('si la Comision cambia las columnas se detiene diciendo cual falta', () => {
    const cambiada = [['Goods code', 'Start date', 'Language'], ['0100000000 80', '31-12-1971', 'EN']];
    expect(() => leerNomenclatura(cambiada)).toThrow('el formato del fichero oficial ha cambiado (se esperaba la columna «End date»');
  });

  test('un fichero sin lineas declarables no se acepta', () => {
    expect(() => leerNomenclatura([CAB_NOM, ['0101210000 10', '01-01-2012', '', 'EN', '6', '- ', 'Horses', '']])).toThrow('ninguna linea declarable');
  });
});

describe('textoLegible', () => {
  test.each([
    ['De cilindrada superior a 1|500|cm$3', 'De cilindrada superior a 1 500 cm³'],
    ['expresado en Fe@2O@3, superior al 70|% en peso', 'expresado en Fe₂O₃, superior al 70 % en peso'],
    ['inferior o igual a 5|!x!|10$-$6|por Kelvin', 'inferior o igual a 5 × 10⁻⁶ por Kelvin'],
    ['superior a 20!o! brix', 'superior a 20° brix'],
    ['pueda girar 360$o', 'pueda girar 360°'],
    ['Vitamina B@1|y sus derivados', 'Vitamina B₁ y sus derivados'],
    ['Copolímero con: \n-|una temperatura de 250|°C, \n \n-|un índice', 'Copolímero con:<br>- una temperatura de 250 °C,<br><br>- un índice'],
    ['  Los   demás \n', 'Los demás'],
    [undefined, '']
  ])('quita las marcas de composicion: %s', (oficial, legible) => {
    expect(textoLegible(oficial)).toBe(legible);
  });
});

describe('leerRutas', () => {
  // Fragmento real de la partida 8544 (extraccion de julio de 2026).
  const ARBOL = [
    CAB_NOM,
    ['8500000000 80', '', '', 'ES', '2', '', 'MÁQUINAS, APARATOS Y MATERIAL ELÉCTRICO', ''],
    ['8544000000 80', '', '', 'ES', '4', '', 'Hilos, cables y demás conductores aislados para electricidad', ''],
    ['8544300000 80', '', '', 'ES', '6', '- ', 'Juegos de cables para bujías de encendido', ''],
    ['8544300089 80', '', '', 'ES', '10', '- - - ', 'Los demás', ''],
    ['8544420000 10', '', '', 'ES', '6', '- ', 'Los demás conductores eléctricos para una tensión inferior o igual a 1|000|V', ''],
    ['8544420000 80', '', '', 'ES', '6', '- - ', 'Provistos de piezas de conexión', ''],
    ['8544421000 80', '', '', 'ES', '8', '- - - ', 'De los tipos utilizados en telecomunicación', ''],
    ['8544429000 80', '', '', 'ES', '8', '- - - ', 'Los demás', ''],
    ['8544429010 80', '', '', 'ES', '10', '- - - - ', 'Cable de transmisión de datos', ''],
    ['8600000000 80', '', '', 'ES', '2', '', 'VEHÍCULOS Y MATERIAL PARA VÍAS FÉRREAS', '']
  ];

  test('cada codigo lleva las descripciones de todo lo que tiene por encima, rotulos intermedios incluidos', () => {
    const rutas = leerRutas(ARBOL);

    expect(rutas.get('8544429010')).toEqual([
      'MÁQUINAS, APARATOS Y MATERIAL ELÉCTRICO',
      'Hilos, cables y demás conductores aislados para electricidad',
      'Los demás conductores eléctricos para una tensión inferior o igual a 1 000 V',
      'Provistos de piezas de conexión',
      'Los demás',
      'Cable de transmisión de datos'
    ]);
    expect(rutas.get('8544421000')).toHaveLength(5);
    expect(rutas.get('8544300089')).toEqual(['MÁQUINAS, APARATOS Y MATERIAL ELÉCTRICO', 'Hilos, cables y demás conductores aislados para electricidad', 'Juegos de cables para bujías de encendido', 'Los demás']);
  });

  test('un capitulo nuevo no arrastra la ruta del anterior, y los rotulos intermedios no tienen ruta propia', () => {
    const rutas = leerRutas(ARBOL);

    expect(rutas.get('8600000000')).toEqual(['VEHÍCULOS Y MATERIAL PARA VÍAS FÉRREAS']);
    expect(rutas.size).toBe(9);
  });
});

describe('leerDeclarables', () => {
  test('solo los codigos con IS_LEAF = 1 y sufijo 80', () => {
    const declarables = leerDeclarables([
      CAB_DEC,
      ['0100000000 80', '31-12-1971', '01-01-1972', '0', ''],
      ['0101210000 10', '01-01-2012', '01-01-2012', '1', ''],
      ['0101210000 80', '01-01-2012', '01-01-2012', '1', ''],
      ['8544429010 80', '01-07-2014', '01-07-2014', '1', '']
    ]);

    expect([...declarables]).toEqual(['0101210000', '8544429010']);
  });

  test('cabecera distinta o ningun declarable: error', () => {
    expect(() => leerDeclarables([['Goods code', 'IS_LEAF']])).toThrow('el formato del fichero oficial ha cambiado');
    expect(() => leerDeclarables([CAB_DEC, ['0100000000 80', '', '', '0', '']])).toThrow('no marca ningun codigo como declarable');
  });
});

describe('descripcion oficial por el servicio web', () => {
  const sobre = (texto) => `<S:Envelope><S:Body><ns2:goodsDescrForWsResponse><return><result><data><description>${texto}</description></data></result></return></ns2:goodsDescrForWsResponse></S:Body></S:Envelope>`;

  test('devuelve la descripcion en el idioma pedido', () => {
    expect(descripcionDeRespuesta(sobre('De pato de Pekin'), 'es')).toBe('De pato de Pekin');
    expect(descripcionDeRespuesta(sobre('Cable &lt;br&gt; de datos &amp; conectores'), 'es')).toBe('Cable <br> de datos & conectores');
  });

  test('el texto ingles con prefijo [EN] no es una descripcion en español', () => {
    expect(descripcionDeRespuesta(sobre('[EN] Of Pekin Duck'), 'es')).toBeNull();
    expect(descripcionDeRespuesta(sobre('[EN] Of Pekin Duck'), 'en')).toBe('Of Pekin Duck');
  });

  test('sin descripcion devuelve null', () => {
    expect(descripcionDeRespuesta('<S:Envelope><S:Body/></S:Envelope>', 'es')).toBeNull();
    expect(descripcionDeRespuesta(sobre('  '), 'es')).toBeNull();
    expect(descripcionDeRespuesta(undefined, 'es')).toBeNull();
  });

  test('pide el codigo, el idioma y la fecha de referencia, y rechaza codigos mal formados', async () => {
    const cliente = { post: jest.fn().mockResolvedValue({ data: sobre('Los demás') }) };

    const texto = await descripcionOficial('0207412090', { cliente, fecha: new Date('2026-11-11T10:00:00Z') });

    expect(texto).toBe('Los demás');
    const [url, cuerpo] = cliente.post.mock.calls[0];
    expect(url).toContain('/dds2/taric/services/goods');
    expect(cuerpo).toContain('<tns:goodsCode>0207412090</tns:goodsCode>');
    expect(cuerpo).toContain('<tns:languageCode>es</tns:languageCode>');
    expect(cuerpo).toContain('<tns:referenceDate>2026-11-11</tns:referenceDate>');
    await expect(descripcionOficial('0207<x>', { cliente })).rejects.toThrow('Codigo TARIC invalido');
  });
});
