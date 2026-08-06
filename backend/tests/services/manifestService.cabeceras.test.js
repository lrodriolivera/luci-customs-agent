/**
 * manifestService — reconocer las cabeceras del CSV escritas en camelCase
 *
 * El parser pasa las cabeceras a minusculas, de modo que `recipientName` llega
 * como `recipientname`. El diccionario de sinonimos solo contemplaba la
 * variante con separador (`recipient_name`), asi que nunca casaban y cada linea
 * fallaba con "Falta nombre destinatario" aunque el dato estuviera ahi.
 *
 * Medido en las pruebas E2E del 6/Ago/2026 con el mismo contenido:
 *   recipient_name -> 4 H7 generadas, 0 errores
 *   recipientName  -> 0 H7 generadas, 4 errores
 *
 * La plantilla que ofrece la aplicacion usa snake_case, asi que esto solo afecta
 * a quien trae su propio fichero — que es el caso de cualquier transitario con
 * un sistema previo.
 */

const manifestService = require('../../src/services/manifestService');

/** Cabeceras equivalentes que un cliente puede traer para lo mismo. */
const VARIANTES = [
  ['snake_case', 'tracking,description,value,currency,weight,sender_country,recipient_name'],
  ['camelCase', 'tracking,description,value,currency,weight,senderCountry,recipientName'],
  ['con espacios', 'tracking,description,value,currency,weight,sender country,recipient name'],
  ['con guiones', 'tracking,description,value,currency,weight,sender-country,recipient-name']
];

const FILA = 'TRK001,Camiseta algodon hombre talla M,18,EUR,0.3,CN,Ana Lopez';

describe('manifestService — variantes de cabecera del CSV', () => {
  describe.each(VARIANTES)('cabeceras en %s', (_nombre, cabecera) => {
    it('reconoce el nombre del destinatario', () => {
      const csv = Buffer.from(`${cabecera}\n${FILA}`, 'utf8');

      const { rows } = manifestService.parseCSV(csv, ',');

      expect(rows[0].recipientName).toBe('Ana Lopez');
    });

    it('reconoce el pais de origen', () => {
      const csv = Buffer.from(`${cabecera}\n${FILA}`, 'utf8');

      const { rows } = manifestService.parseCSV(csv, ',');

      expect(rows[0].senderCountry).toBe('CN');
    });
  });

  it('no confunde columnas distintas que empiezan igual', () => {
    // recipient_name y recipient_id son campos diferentes.
    const csv = Buffer.from(
      'tracking,description,value,recipientName,recipientId\n' +
      'TRK009,Cable USB,7,Marta Ruiz,12345678A',
      'utf8'
    );

    const { rows } = manifestService.parseCSV(csv, ',');

    expect(rows[0].recipientName).toBe('Marta Ruiz');
    expect(rows[0].recipientId).toBe('12345678A');
  });
});
