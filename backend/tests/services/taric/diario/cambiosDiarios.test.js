const { leerNomenclaturaDiaria, leerMedidasDiarias, fechaOrdenable, enVigor } = require('../../../../src/services/taric/diario/cambiosDiarios');
const { leerLista } = require('../../../../src/services/taric/diario/publicacionesDiarias');

const NOMENCLATURA = [
  ['GOODS CODE', 'START_DATE', 'END_DATE', 'LANG_COD', 'HIER_POS', 'INDENTS', 'DESCR_TEXT', 'PUBLISH', 'DESCR_START_DATE', 'REC_SEQ_NUM'],
  ['392410004080', '18/11/2026 00:00', '', 'EN', '10', '--', 'Of poly(ethylene terephthalate)', 'INSERT', '18/11/2026 00:00', '1'],
  ['392410004080', '18/11/2026 00:00', '', 'ES', '10', '--', 'De poli(tereftalato de etileno),  con contenido reciclado', 'INSERT', '18/11/2026 00:00', '2'],
  ['392410004010', '18/11/2026 00:00', '', 'ES', '10', '-', 'Línea intermedia, no declarable', 'INSERT', '18/11/2026 00:00', '3'],
  ['392410009080', '01/01/2020 00:00', '17/11/2026 00:00', 'ES', '10', '--', 'Los demás', 'UPDATE', '01/01/2020 00:00', '4'],
  ['850760009080', '01/01/2020 00:00', '', 'ES', '10', '--', 'Los demás acumuladores', 'UPDATE', '15/11/2026 00:00', '5']
];
const MEDIDAS = [
  ['GOODS CODE', 'ADD_CODE', 'ORD_NUMB', 'START_DATE', 'DESCR_START_DATE', 'END_DATE', 'RED_IND', 'REGULATION', 'DUTY', 'GEOGR_AREA', 'MEAS_TYP_ID', 'PUBLISH', 'REC_SEQ_NUM'],
  ['0701901000', '', '', '01/01/2027 00:00', '', '31/12/2027 00:00', '', 'DECISION D0183/26', '3.400 % ', '5500', '145', 'INSERT', '1'],
  ['3924100040', '', '', '18/11/2026 00:00', '', '', '', 'REGULATION R2658/87', '6.500 % ', '1011', '103', 'INSERT', '2'],
  ['8471300000', '', '', '15/11/2026 00:00', '', '', '', 'REGULATION R0833/14', '', 'RU', '762', 'UPDATE', '3'],
  ['1511909100', '', '', '01/01/2020 00:00', '', '14/11/2026 00:00', '', 'REGULATION R2658/87', '5.100 % ', '1011', '105', 'DELETE', '4'],
  ['0201100000', '', '', '15/11/2026 00:00', '', '', '', 'REGULATION R2658/87', '12.800 % ', 'BR', '103', 'INSERT', '5']
];

describe('fichero diario: nomenclatura', () => {
  const cambios = leerNomenclaturaDiaria(NOMENCLATURA);

  test('se queda con las líneas declarables en español', () => {
    expect(cambios.map((c) => c.code)).toEqual(['3924100040', '3924100090', '8507600090']);
  });

  test('distingue alta, baja y cambio de descripción, con sus fechas', () => {
    expect(cambios[0]).toEqual({ clase: 'codigo', code: '3924100040', accion: 'alta', desde: '20261118', hasta: '', detalle: 'De poli(tereftalato de etileno), con contenido reciclado' });
    expect(cambios[1]).toMatchObject({ accion: 'baja', hasta: '20261117' });
    expect(cambios[2]).toMatchObject({ accion: 'cambio', detalle: 'Los demás acumuladores' });
  });

  test('un fichero vacío no da cambios; uno con otras columnas se rechaza', () => {
    expect(leerNomenclaturaDiaria([NOMENCLATURA[0]])).toEqual([]);
    expect(leerNomenclaturaDiaria([])).toEqual([]);
    expect(() => leerNomenclaturaDiaria([['a', 'b'], ['1', '2']])).toThrow('columnas');
  });
});

describe('fichero diario: medidas', () => {
  const { cambios, otras } = leerMedidasDiarias(MEDIDAS);

  test('detalla el derecho de terceros países y de destino final y las medidas de control; el resto solo se cuenta', () => {
    expect(cambios.map((c) => [c.clase, c.code, c.tipo, c.accion])).toEqual([
      ['derecho', '3924100040', '103', 'alta'],
      ['control', '8471300000', '762', 'cambio'],
      ['derecho', '1511909100', '105', 'baja']
    ]);
    // La preferencia y el derecho dirigido a un solo país no son el derecho general.
    expect(otras).toBe(2);
  });

  test('guarda el texto del derecho, la norma y las fechas', () => {
    expect(cambios[0]).toMatchObject({ detalle: '6.500 %', norma: 'REGULATION R2658/87', desde: '20261118', hasta: '', origen: '1011' });
    expect(cambios[2].hasta).toBe('20261114');
  });
});

describe('fichero diario: fechas y lista de publicaciones', () => {
  test('fechas ordenables y vigencia', () => {
    expect(fechaOrdenable('18/11/2026 00:00')).toBe('20261118');
    expect(fechaOrdenable('')).toBe('');
    expect(enVigor({ desde: '20261118', hasta: '' }, '20261112')).toBe(false);
    expect(enVigor({ desde: '20261118', hasta: '' }, '20261118')).toBe(true);
    expect(enVigor({ desde: '20200101', hasta: '20261117' }, '20261118')).toBe(false);
    expect(enVigor({ desde: '', hasta: '' }, '20261118')).toBe(true);
  });

  test('lee la lista de publicaciones de la página, de la más reciente a la más antigua', () => {
    const html = `<tr><td data-ecl-table-header="Publication date"> 2026-11-09 19:14 </td> <td data-ecl-table-header="Publication file"> TARIC_20261109_1914.zip </td></tr>
      <tr><td data-ecl-table-header="Publication date"> 2026-11-10 19:14 </td> <td data-ecl-table-header="Publication file"> TARIC_20261110_1914.zip </td></tr>`;
    expect(leerLista(html)).toEqual([{ nombre: 'TARIC_20261110_1914', fecha: '2026-11-10 19:14' }, { nombre: 'TARIC_20261109_1914', fecha: '2026-11-09 19:14' }]);
    expect(leerLista('<html></html>')).toEqual([]);
  });
});
