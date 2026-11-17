const { unidadesDeLaPartida } = require('../../../src/services/aeat/unidadesSuplementariasH1');

const PIEZAS = { tipo: 'p/st', descripcion: 'Numero de articulos' };

describe('unidadesDeLaPartida (error 50928 de la AEAT, 17/11/2026)', () => {
  test('lo escrito en la partida manda', () => {
    const faltan = [];
    expect(unidadesDeLaPartida({ supplementaryUnits: 10, quantity: 480, unit: 'PCS' }, PIEZAS, 1, faltan)).toBe(10);
    expect(faltan).toEqual([]);
  });

  test('si el código pide número de artículos y la cantidad va en piezas, se usa la cantidad', () => {
    const faltan = [];
    expect(unidadesDeLaPartida({ taricCode: '8471300000', quantity: 480, unit: 'PCS' }, PIEZAS, 1, faltan)).toBe(480);
    expect(unidadesDeLaPartida({ taricCode: '8471300000', quantity: 5, unit: 'u' }, PIEZAS, 1, faltan)).toBe(5);
    expect(faltan).toEqual([]);
  });

  test('si no se puede deducir, la pide en lo que falta', () => {
    const faltan = [];
    expect(unidadesDeLaPartida({ taricCode: '8471300000', quantity: 864, unit: 'KG' }, PIEZAS, 2, faltan)).toBeNull();
    expect(unidadesDeLaPartida({ taricCode: '2204210000', quantity: 100, unit: 'PCS' }, { tipo: 'l', descripcion: 'Litros' }, 3, faltan)).toBeNull();
    expect(faltan[0]).toMatch(/unidades suplementarias de la partida 2 \(8471300000 las exige: Numero de articulos\)/);
    expect(faltan[1]).toMatch(/partida 3/);
  });

  test('si el código no las exige, no se declaran', () => {
    const faltan = [];
    expect(unidadesDeLaPartida({ quantity: 480, unit: 'PCS' }, undefined, 1, faltan)).toBeNull();
    expect(faltan).toEqual([]);
  });
});

describe('exigenciasDeUnidades', () => {
  const { exigenciasDeUnidades } = require('../../../src/services/aeat/unidadesSuplementariasH1');
  test('sin conexión a la base de datos no espera y no exige nada', async () => {
    await expect(exigenciasDeUnidades([{ taricCode: '8471300000' }])).resolves.toEqual({});
  });
});
