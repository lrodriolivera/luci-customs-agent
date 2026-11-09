/**
 * detectarDeclaracionesSinEori: lista (solo lectura) las declaraciones con
 * "ESundefined" o un NIF de respaldo. BD en memoria efimera, NUNCA produccion.
 */
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const { Expedition } = require('../../src/models');
const { falsoEn, motivosDeclaracion, detectar } = require('../../src/scripts/detectarDeclaracionesSinEori');

usarBaseDeDatosEnMemoria();

describe('motivosDeclaracion (pura)', () => {
  test('XML con ESundefined', () => {
    expect(motivosDeclaracion({ xmlContent: '<IdentificationID>ESundefined</IdentificationID>' }))
      .toEqual([{ donde: 'xmlContent', valor: 'ESundefined' }]);
  });
  test('declarant.identificationNumber con NIF de respaldo, en H1 y en H7', () => {
    const m = motivosDeclaracion({
      h1Data: { declarationHeader: { declarant: { identificationNumber: 'ESB22477020' } } },
      h7Data: { declarationHeader: { declarant: { identificationNumber: 'ESB12345678' } } }
    });
    expect(m.map((x) => x.donde)).toEqual([
      'h1Data.declarationHeader.declarant.identificationNumber',
      'h7Data.declarationHeader.declarant.identificationNumber'
    ]);
  });
  test('declaraciones correctas o vacias no se marcan', () => {
    expect(motivosDeclaracion({ xmlContent: '<ID>ESA11111111</ID>' })).toEqual([]);
    expect(motivosDeclaracion(undefined)).toEqual([]);
    expect(falsoEn(undefined)).toBeNull();
  });
});

describe('detectar (solo lectura)', () => {
  const base = (extra) => ({
    tenantId: new mongoose.Types.ObjectId(), createdBy: new mongoose.Types.ObjectId(),
    operationType: 'import', transportMode: 'maritime',
    client: { companyName: 'C SL', nif: 'B12345678' }, ...extra
  });

  test('lista solo los expedientes afectados y no modifica nada', async () => {
    const mala = await Expedition.create(base({ declaration: { type: 'H1', status: 'draft', xmlContent: '<I>ESundefined</I>' } }));
    await Expedition.create(base({ declaration: { type: 'H1', status: 'draft', xmlContent: '<I>ESA11111111</I>' } }));
    await Expedition.create(base({}));
    const antes = await Expedition.find().lean();

    const afectados = await detectar(Expedition);

    expect(afectados).toHaveLength(1);
    expect(afectados[0]).toMatchObject({ expeditionId: mala.expeditionId, tipo: 'H1', estado: 'draft' });
    expect(afectados[0].motivos[0]).toEqual({ donde: 'xmlContent', valor: 'ESundefined' });
    expect(await Expedition.find().lean()).toEqual(antes);
  });
});
