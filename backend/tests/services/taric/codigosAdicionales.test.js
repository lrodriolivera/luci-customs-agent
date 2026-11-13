/**
 * Descripcion oficial de los codigos adicionales TARIC («Additional codes
 * descriptions.xlsx», CIRCABC, noviembre de 2026). Filas reales.
 */
const { leerDescripcionesCodigosAdicionales } = require('../../../src/services/taric/codigosAdicionales');

const CAB = ['Add code', 'Language', 'Description', 'Start date', 'Descr. start date', 'End date'];
const FILAS = [
  CAB,
  ['2500', 'EN', 'Annex I "Combined Nomenclature", Part Three, Section II (pharmaceutical products), Tariff Annexes 3 to 6 – 2025/1926', '01-01-1995', '01-01-2026', ''],
  ['2500', 'ES', 'Anexo I "Nomenclatura Combinada", Tercera Parte, Sección II (sustancias farmaceúticas), Anexos Arancelario 3 a 6 – R 2024/2522', '01-01-1995', '01-01-2025', ''],
  ['2500', 'ES', 'Anexo I "Nomenclatura Combinada", Tercera Parte, Sección II (sustancias farmaceúticas), Anexos Arancelario 3 a 6 -  R 2025/1926', '01-01-1995', '01-01-2026', ''],
  ['2501', 'ES', 'Las demás', '01-01-1995', '01-01-1995', ''],
  ['2501', 'EN', 'Other', '01-01-1995', '01-01-1995', ''],
  ['2600', 'EN', 'Only in English', '01-01-1995', '01-01-1995', ''],
  ['2700', 'ES', 'De baja', '01-01-1995', '01-01-1995', '31-12-2020'],
  ['2800', 'ES', 'Futura', '01-01-2030', '01-01-2030', '']
];

describe('leerDescripcionesCodigosAdicionales', () => {
  const descripciones = leerDescripcionesCodigosAdicionales(FILAS, { fecha: new Date('2026-11-13') });

  test('en español, la descripcion vigente mas reciente', () => {
    expect(descripciones.get('2500')).toBe('Anexo I "Nomenclatura Combinada", Tercera Parte, Sección II (sustancias farmaceúticas), Anexos Arancelario 3 a 6 - R 2025/1926');
    expect(descripciones.get('2501')).toBe('Las demás');
  });

  test('si no hay español, la inglesa; los de baja o futuros no constan', () => {
    expect(descripciones.get('2600')).toBe('Only in English');
    expect(descripciones.has('2700')).toBe(false);
    expect(descripciones.has('2800')).toBe(false);
  });

  test('si el formato cambia, falla en vez de leer columnas equivocadas', () => {
    expect(() => leerDescripcionesCodigosAdicionales([['Code', 'Lang']])).toThrow(/formato/);
  });
});
