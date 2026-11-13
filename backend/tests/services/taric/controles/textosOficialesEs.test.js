/**
 * Textos oficiales en español para las medidas de control del TARIC:
 * encabezados de las categorías de doble uso (anexo I del Reglamento (UE)
 * 2021/821, versión consolidada de la Oficina de Publicaciones) y nombres de
 * los países y grupos de países del TARIC («Geographical areas description»).
 */
const fs = require('fs');
const path = require('path');
const {
  leerAnexoIDobleUso, referenciaDeConsolidado, leerAreasEnEspanol,
  descripcionDeCategoria, articuloDeCategoria, nombreDeOrigen, textosDobleUso, nombresDeAreas
} = require('../../../../src/services/taric/controles/textosOficialesEs');

const EXTRACTO = fs.readFileSync(path.join(__dirname, '../../../fixtures/taric/anexoI-2021-821-extracto.html'), 'utf8');

describe('anexo I del Reglamento (UE) 2021/821 en español', () => {
  test('lee el encabezado de cada entrada, tal cual, en los dos formatos del documento', () => {
    const categorias = leerAnexoIDobleUso(EXTRACTO);

    expect(categorias['5A002']).toBe('Sistemas, equipos y componentes destinados a la "seguridad de la información", según se indica:');
    expect(categorias['1C226']).toBe('Wolframio, carburo de wolframio y aleaciones con más del 90 % de wolframio en peso, diferentes de las especificadas en el artículo 1C117, que posean las dos características siguientes:');
    // El superíndice del isótopo se une a su símbolo.
    expect(categorias['1C225']).toMatch(/^Boro enriquecido en el isótopo boro-10 \(10B\) hasta más de su abundancia isotópica natural/);
  });

  test('no lee entradas de otros anexos', () => {
    expect(leerAnexoIDobleUso(EXTRACTO)['9Z999']).toBeUndefined();
    expect(Object.keys(leerAnexoIDobleUso(EXTRACTO)).sort()).toEqual(['1C225', '1C226', '5A002']);
  });

  test('un documento sin anexo I es un error, no una lista vacía', () => {
    expect(() => leerAnexoIDobleUso('<html><body><p>otra cosa</p></body></html>')).toThrow('anexo I');
  });

  test('saca la referencia de la versión consolidada', () => {
    expect(referenciaDeConsolidado(EXTRACTO)).toEqual({ celex: '02021R0821', idioma: 'ES', fecha: '2026-09-21', version: '008.001' });
    expect(referenciaDeConsolidado('<p>nada</p>')).toBeNull();
  });

  test('la categoría de la tabla de correlación se lleva a su artículo del anexo', () => {
    expect(articuloDeCategoria('5A002')).toBe('5A002');
    expect(articuloDeCategoria('0A001a')).toBe('0A001');
    expect(articuloDeCategoria('1C350 12')).toBe('1C350');
    expect(articuloDeCategoria('9A108a-b')).toBe('9A108');
    expect(articuloDeCategoria('sin código')).toBeNull();
  });

  test('descripción de una categoría con los datos versionados del repositorio', () => {
    expect(descripcionDeCategoria('5A002')).toMatch(/^Sistemas, equipos y componentes destinados a la "seguridad de la información"/);
    expect(descripcionDeCategoria('0A001a')).toMatch(/^"Reactores nucleares"/);
    expect(descripcionDeCategoria('9Z999')).toBeNull();
    expect(descripcionDeCategoria('5A002', { categorias: {} })).toBeNull();
  });

  test('los datos versionados citan la fuente y cubren todas las categorías de la tabla de correlación', () => {
    const datos = textosDobleUso();
    expect(datos.fuente).toMatchObject({ celex: '02021R0821', idioma: 'ES', fecha: '2026-09-21' });
    expect(datos.fuente.enlace).toBe('https://publications.europa.eu/resource/celex/02021R0821-20260921');
    expect(Object.keys(datos.categorias).length).toBeGreaterThan(350);
    // Artículos que cita la tabla de correlación de enero de 2026.
    for (const c of ['0A001', '0C001', '1A001', '1C350', '1C450', '3A001', '4A001', '5A002', '6A003', '9A108']) {
      expect(datos.categorias[c]).toEqual(expect.any(String));
    }
  });
});

describe('nombres en español de los países y grupos del TARIC', () => {
  const CABECERA = ['Or./Dest.', 'Language', 'Abbrev.', 'Description', 'Start date', 'Descr. start date', 'End date'];
  const FILAS = [
    CABECERA,
    ['1008', 'EN', 'ALLTC', 'All third countries', '01-01-2007', '01-01-2007', ''],
    ['1008', 'ES', 'ALLTC', 'Todos los terceros países', '01-01-2007', '01-01-2007', ''],
    ['2005', 'ES', 'EBA', 'GSP-EBA (un régimen especial\r\n a favor de los países menos desarrollados)', '01-01-1997', '01-05-2021', ''],
    ['2005', 'ES', 'EBA', 'Descripción anterior', '01-01-1997', '01-01-1997', ''],
    ['XK', 'ES', 'XK', 'Descripción futura', '01-01-2000', '01-01-2030', ''],
    ['XK', 'ES', 'XK', 'Kosovo', '01-01-2000', '01-01-2000', '']
  ];

  test('toma la descripción en español vigente de cada código', () => {
    expect(leerAreasEnEspanol(FILAS, { fecha: new Date('2026-11-13') })).toEqual({
      1008: 'Todos los terceros países',
      2005: 'GSP-EBA (un régimen especial a favor de los países menos desarrollados)',
      XK: 'Kosovo'
    });
  });

  test('un fichero sin las columnas esperadas es un error', () => {
    expect(() => leerAreasEnEspanol([['a', 'b']])).toThrow('columnas');
  });

  test('el origen de una medida sale en español con los datos versionados; si falta, el nombre original', () => {
    expect(nombreDeOrigen('1008', 'All third countries')).toBe('Todos los terceros países');
    expect(nombreDeOrigen('US', 'United States')).toBe('Estados Unidos');
    expect(nombreDeOrigen('ZZ99', 'Unknown group')).toBe('Unknown group');
    expect(nombreDeOrigen('ZZ99', '')).toBeNull();
  });

  test('los datos versionados citan el fichero oficial y su mes', () => {
    const datos = nombresDeAreas();
    expect(datos.fuente).toMatchObject({ fichero: 'Geographical areas description.xlsx', mes: '2026-11' });
    expect(datos.areas['1011']).toBe('ERGA OMNES');
    expect(Object.keys(datos.areas).length).toBeGreaterThan(300);
  });
});
