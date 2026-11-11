/**
 * Fecha del propio documento al subirlo. La autorizacion de despacho vale
 * cuatro años desde su fecha, no desde el dia en que se sube (11/Nov/2026).
 */
const { fechaDeDocumento } = require('../../src/services/documentos/fechaDocumento');

const AHORA = new Date('2026-11-11T12:00:00Z');
const con = (valor, tipo = 'dispatch_authorization') => fechaDeDocumento(valor, tipo, { ahora: AHORA });

describe('fechaDeDocumento', () => {
  test('acepta una fecha AAAA-MM-DD pasada o de hoy', () => {
    expect(con('2024-03-15')).toEqual({ fecha: new Date('2024-03-15T12:00:00Z'), error: null });
    expect(con(' 2026-11-11 ').error).toBeNull();
  });

  test('la autorizacion de despacho la exige; el resto de documentos no', () => {
    expect(con('').error).toBe('Indica la fecha de la autorizacion de despacho');
    expect(con(undefined).error).toBe('Indica la fecha de la autorizacion de despacho');
    expect(con('', 'commercial_invoice')).toEqual({ fecha: null, error: null });
    expect(con(undefined, 'packing_list')).toEqual({ fecha: null, error: null });
  });

  test('rechaza una fecha futura (con un dia de margen por el huso horario)', () => {
    expect(con('2026-11-12').error).toBeNull();
    expect(con('2026-11-13').error).toBe('La fecha del documento no puede ser futura');
    expect(con('2030-01-01', 'commercial_invoice').error).toBe('La fecha del documento no puede ser futura');
  });

  test('rechaza lo que no es una fecha real', () => {
    for (const valor of ['15/03/2024', '2024-02-30', '2024-13-01', 'ayer', '1899-01-01', { $gt: '' }, ['2024-03-15']]) {
      const r = con(valor);
      expect(r.fecha).toBeNull();
      expect(r.error).not.toBeNull();
    }
  });
});
