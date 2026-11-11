/**
 * Derechos por unidad, mixtos y con minimo y maximo, liquidados con el arancel
 * del catalogo (Mongo en memoria). Antes del 11/Nov/2026 el calculo dividia
 * entre 1.000 cualquier unidad con «kg», daba 0 EUR si la unidad estaba rota y
 * tomaba el mayor de los dos en un derecho «% + importe».
 */
const { usarBaseDeDatosEnMemoria } = require('../../helpers/memoryDb');
const { unidadCanonica, importeEspecifico } = require('../../../src/services/taric/unidadesDerecho');
const TaricCode = require('../../../src/models/TaricCode');
const servicio = require('../../../src/services/dutyCalculationService');

usarBaseDeDatosEnMemoria();

describe('unidadesDerecho', () => {
  test('reconoce la misma unidad escrita de varias formas', () => {
    expect(unidadCanonica('EUR/100 kg')).toBe('EUR/100 kg');
    expect(unidadCanonica('EUR / 100 KG')).toBe('EUR/100 kg');
    expect(unidadCanonica('EUR/tonne')).toBe('EUR/1000 kg');
    expect(unidadCanonica('EUR/1000 kg')).toBe('EUR/1000 kg');
    expect(unidadCanonica('EUR/hl')).toBe('EUR/hl');
    expect(unidadCanonica('EUR/p/st')).toBe('EUR/p/st');
  });

  test('las unidades rotas de la carga antigua no se adivinan', () => {
    for (const rota of ['100', 'tonne', 'hl', '1000', '%', 'kg/lactic', '', undefined]) expect(unidadCanonica(rota)).toBeNull();
  });

  test('importe segun la unidad', () => {
    expect(importeEspecifico({ amount: 38, unit: 'EUR/100 kg' }, { netWeight: 500 })).toBe(190);
    expect(importeEspecifico({ amount: 320, unit: 'EUR/1000 kg' }, { netWeight: 500 })).toBe(160);
    expect(importeEspecifico({ amount: 1.5, unit: 'EUR/kg' }, { netWeight: 500 })).toBe(750);
    expect(importeEspecifico({ amount: 32, unit: 'EUR/hl' }, { quantity: 750 })).toBe(240);       // 750 litros
    expect(importeEspecifico({ amount: 52, unit: 'EUR/1000 p/st' }, { quantity: 5000 })).toBe(260);
    expect(importeEspecifico({ amount: 0.3, unit: 'EUR/p/st' }, { quantity: 40 })).toBe(12);
  });

  test('sin el dato de la mercancia o con una unidad desconocida devuelve null, no 0', () => {
    expect(importeEspecifico({ amount: 38, unit: 'EUR/100 kg' }, {})).toBeNull();
    expect(importeEspecifico({ amount: 38, unit: 'EUR/100 kg' }, { quantity: 10 })).toBeNull();
    expect(importeEspecifico({ amount: 38, unit: '100' }, { netWeight: 500 })).toBeNull();
    expect(importeEspecifico(null, { netWeight: 500 })).toBeNull();
  });
});

describe('liquidacion con el arancel del catalogo', () => {
  const codigo = (code, duties) => ({
    code, breakdown: { chapter: code.slice(0, 2) }, description: { es: 'Mercancia de prueba' }, level: 10, isLeaf: true, isActive: true, duties
  });
  const oficial = { fuente: 'taric_oficial' };
  const calcular = (taricCode, extra = {}) => servicio.calculateDutiesWithAI({ taricCode, customsValue: 1000, origin: 'BR', ...extra });

  // Cada caso usa un codigo distinto: el arancel se guarda en una cache entre llamadas.

  test('solo importe por unidad: 38 EUR por 100 kg sobre 500 kg son 190 EUR', async () => {
    await TaricCode.collection.insertOne(codigo('0207412010', { thirdCountry: 0, specific: { amount: 38, unit: 'EUR/100 kg' }, origen: oficial }));

    const r = await calcular('0207412010', { netWeight: 500 });

    expect(r.duties).toMatchObject({ dutyType: 'specific', adValoremDuty: 0, specificDuty: 190, totalDuty: 190 });
  });

  test('porcentaje mas importe por unidad: se suman', async () => {
    await TaricCode.collection.insertOne(codigo('0102291010', { thirdCountry: 10.2, specific: { amount: 93.1, unit: 'EUR/100 kg' }, combinacion: 'suma', origen: oficial }));

    const r = await calcular('0102291010', { netWeight: 200 });

    expect(r.duties).toMatchObject({ dutyType: 'compound', adValoremDuty: 102, specificDuty: 186.2, totalDuty: 288.2 });
  });

  test('porcentaje con minimo y maximo: el derecho se queda dentro de los limites', async () => {
    await TaricCode.collection.insertOne(codigo('2401103520', {
      thirdCountry: 18.4, minimo: { amount: 22, unit: 'EUR/100 kg' }, maximo: { amount: 24, unit: 'EUR/100 kg' }, origen: oficial
    }));

    // 18,4 % de 1.000 = 184. Con 1.000 kg, el minimo es 220 y el maximo 240.
    expect((await calcular('2401103520', { netWeight: 1000 })).duties.totalDuty).toBe(220);
    // Con 500 kg, minimo 110 y maximo 120: 184 se queda en 120.
    expect((await calcular('2401103520', { netWeight: 500 })).duties.totalDuty).toBe(120);
    // Con 800 kg, entre 176 y 192: 184 esta dentro.
    expect((await calcular('2401103520', { netWeight: 800 })).duties.totalDuty).toBe(184);
  });

  test('sin peso neto no se puede aplicar el minimo: se avisa y no se inventa', async () => {
    await TaricCode.collection.insertOne(codigo('2401103510', { thirdCountry: 18.4, minimo: { amount: 22, unit: 'EUR/100 kg' }, origen: oficial }));

    const r = await calcular('2401103510');

    expect(r.duties.totalDuty).toBe(184);
    expect(r.warnings.some((w) => /No se ha podido calcular el derecho minimo/.test(w))).toBe(true);
  });

  test('el par antiguo sin contrastar sigue liquidandose por el mayor, con aviso', async () => {
    await TaricCode.collection.insertOne(codigo('1704905100', { thirdCountry: 9, specific: { amount: 35.15, unit: 'EUR/100 kg' } }));

    const r = await calcular('1704905100', { netWeight: 1000 });

    expect(r.duties).toMatchObject({ dutyType: 'mixed', totalDuty: 351.5 });
  });

  test('derecho oficial que LUCI no sabe liquidar: avisa con el texto oficial', async () => {
    const evidencia = 'Derecho oficial «9.000 % + EA MAX 18.700 % +ADSZ»: derecho con elemento agricola, grado alcoholico, precio de entrada o varios sumandos. LUCI no lo liquida automaticamente.';
    await TaricCode.collection.insertOne(codigo('1704905500', { thirdCountry: 9, origen: { fuente: 'no_calculable', evidencia } }));

    const r = await calcular('1704905500', { netWeight: 1000 });

    expect(r.warnings.some((w) => w.includes('«9.000 % + EA MAX 18.700 % +ADSZ»') && w.includes('orientativo'))).toBe(true);
    expect(r.warnings.some((w) => /sin contrastar contra el TARIC/.test(w))).toBe(false);
  });

  test('codigo de destino final: avisa de que el tipo exige la autorizacion', async () => {
    await TaricCode.collection.insertOne(codigo('0101291000', { thirdCountry: 0, origen: { fuente: 'taric_oficial', soloDestinoFinal: true } }));

    const r = await calcular('0101291000');

    expect(r.duties.totalDuty).toBe(0);
    expect(r.warnings.some((w) => /solo se aplica con autorizacion de destino final/.test(w))).toBe(true);
  });

  test('codigo especial sin derecho oficial (capitulo 98): 0 EUR de derechos, con aviso y sin acudir a la IA', async () => {
    await TaricCode.collection.insertOne(codigo('9880010000', { thirdCountry: null, origen: { fuente: 'sin_derecho_oficial' } }));

    const info = await servicio.getDutyInfo('9880010000');
    const r = await calcular('9880010000');

    expect(info).toMatchObject({ source: 'local_db', dutyRate: 0 });
    expect(r.duties.totalDuty).toBe(0);
    expect(r.warnings.some((w) => /El TARIC no asigna derecho de terceros paises/.test(w))).toBe(true);
  });
});
