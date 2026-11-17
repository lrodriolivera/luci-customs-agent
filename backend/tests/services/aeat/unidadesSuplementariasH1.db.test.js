const { usarBaseDeDatosEnMemoria } = require('../../helpers/memoryDb');
const TaricCode = require('../../../src/models/TaricCode');
const { exigenciasDeUnidades } = require('../../../src/services/aeat/unidadesSuplementariasH1');

usarBaseDeDatosEnMemoria();

test('lee del catálogo qué códigos exigen unidades suplementarias', async () => {
  await TaricCode.collection.insertMany([
    { code: '8471300000', supplementaryUnit: { required: true, type: 'p/st', description: 'Numero de articulos' } },
    { code: '6302100000', supplementaryUnit: { required: false } }
  ]);
  const r = await exigenciasDeUnidades([{ taricCode: '8471 30 00 00' }, { taricCode: '6302100000' }]);
  expect(r).toEqual({ '8471300000': { tipo: 'p/st', descripcion: 'Numero de articulos' } });
});
