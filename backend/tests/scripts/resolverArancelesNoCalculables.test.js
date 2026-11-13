/**
 * El guion de resolucion de los «no calculables» toma los dos ficheros
 * oficiales del mismo mes, el mas reciente que los traiga.
 */
const { ficherosDelMes } = require('../../src/scripts/resolverArancelesNoCalculables');

const fichero = (id, name) => ({ id, name, carpeta: false });
const circabc = (arbol) => ({
  mesesPublicados: async () => [{ id: 'm11', anio: 2026, mes: 11 }, { id: 'm10', anio: 2026, mes: 10 }],
  hijos: async (id) => arbol[id] || [],
  descargar: async (id) => Buffer.from(id)
});

describe('ficherosDelMes', () => {
  test('salta el mes al que le falta uno de los dos ficheros', async () => {
    const f = await ficherosDelMes(circabc({
      m11: [fichero('d11', 'Duties Import 01-99.xlsx')],
      m10: [fichero('d10', 'Duties Import 01-99.xlsx'), fichero('a10', 'Additional codes descriptions.xlsx')]
    }));
    expect(f.mes.mes).toBe(10);
    expect(f.derechos.toString()).toBe('d10');
    expect(f.adicionales.toString()).toBe('a10');
  });

  test('sin ningun mes completo, error claro', async () => {
    await expect(ficherosDelMes(circabc({}))).rejects.toThrow('ningun mes trae');
  });
});
