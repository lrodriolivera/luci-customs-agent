/**
 * TaricCode.search — las comillas de la descripcion comercial no vacian la busqueda
 *
 * Medido el 17/Nov/2026 contra el catalogo de preproduccion (solo lectura) con
 * las 60 descripciones de tests/fixtures/clasificacion/para-validar-patricia.csv:
 * cuatro devolvian CERO candidatos, todas con comillas («pantalla 14"»,
 * «modelo "ProBook X14"», «"impresora multifuncion"»). En $text de MongoDB un
 * texto entre comillas es una frase OBLIGATORIA y un termino con guion delante
 * se EXCLUYE: una pulgada o un nombre comercial dejaban al modelo sin ancla y
 * clasificando de memoria. BD en memoria, nunca produccion.
 */
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const TaricCode = require('../../src/models/TaricCode');

const linea = (code, es, keywords = []) => ({ code, level: 10, isLeaf: true, isActive: true, description: { es }, keywords });

describe('TaricCode.search con comillas y guiones', () => {
  usarBaseDeDatosEnMemoria();

  beforeEach(async () => {
    await TaricCode.init();
    await TaricCode.insertMany([
      linea('8471300000', 'Máquinas automáticas para tratamiento o procesamiento de datos, portátiles', ['ordenadores', 'portatiles']),
      linea('8443310000', 'Máquinas que efectúan dos o más de las siguientes funciones: impresión, copia o fax', ['impresora', 'multifuncion']),
      linea('8507600090', 'Acumuladores de iones de litio, los demás', ['litio', 'baterias'])
    ]);
  });

  it('caso real P38: «pantalla 14", modelo "ProBook X14"» encuentra los ordenadores portatiles', async () => {
    const r = await TaricCode.search('Ordenadores portatiles, pantalla 14", 16GB RAM / 512GB SSD, modelo comercial "ProBook X14"');
    expect(r.map(c => c.code)).toContain('8471300000');
  });

  it('caso real P49: «comercializado como "impresora multifuncion"» encuentra la multifuncion', async () => {
    const r = await TaricCode.search('Equipo de oficina, impresora laser, fax, comercializado como "impresora multifuncion"');
    expect(r.map(c => c.code)).toContain('8443310000');
  });

  it('un termino con guion delante no excluye resultados', async () => {
    const r = await TaricCode.search('Baterias -litio recargables');
    expect(r.map(c => c.code)).toContain('8507600090');
  });

  it('una consulta solo de signos no lanza y devuelve vacio', async () => {
    await expect(TaricCode.search('"" -')).resolves.toEqual([]);
  });
});
