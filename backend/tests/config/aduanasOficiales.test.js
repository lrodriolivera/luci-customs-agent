/**
 * Lista oficial de aduanas (config/aduanasOficiales.js) y deduccion de la
 * aduana a partir del puerto/aeropuerto del expediente.
 *
 * Los codigos salen de la lista "Aduanas mas utilizadas" que nos paso una
 * agente de aduanas; la guia CAU de la AEAT confirma ES001131 (Algeciras
 * maritima) y ES004611 (Valencia maritima).
 */

const {
  ADUANAS_OFICIALES,
  getAduanaOficial,
  nombresPorCodigo,
  aduanaPorLugar
} = require('../../src/config/aduanasOficiales');
const { getCustomsOfficeInfo, CUSTOMS_OFFICES } = require('../../src/services/aeat/aeatConfig');

describe('lista oficial', () => {
  test('codigos ES00 + 4 cifras, sin repetir, con region', () => {
    const codigos = ADUANAS_OFICIALES.map(a => a.code);
    expect(new Set(codigos).size).toBe(codigos.length);
    for (const a of ADUANAS_OFICIALES) {
      expect(a.code).toMatch(/^ES00\d{4}$/);
      expect(a.code.slice(4)).toBe(a.recinto);
      expect(a.region).toBeTruthy();
    }
  });

  test.each([
    ['ES002801', 'Madrid - Aeropuerto'],
    ['ES002841', 'Madrid - Carretera'],
    ['ES000801', 'Barcelona - Aeropuerto'],
    ['ES000811', 'Barcelona - Marítima Importación'],
    ['ES000812', 'Barcelona - Marítima Exportación'],
    ['ES004601', 'Valencia - Aeropuerto'],
    ['ES004611', 'Valencia - Marítima'],
    ['ES001131', 'Algeciras - Marítima (Tránsito)'],
    ['ES004811', 'Bilbao - Marítima'],
    ['ES003611', 'Vigo - Marítima'],
    ['ES004111', 'Sevilla - Marítima'],
    ['ES002911', 'Málaga - Marítima'],
    ['ES001111', 'Cádiz - Marítima'],
    ['ES001211', 'Castellón - Marítima'],
    ['ES002011', 'Pasajes - Marítima'],
    ['ES002001', 'Irún - Aeropuerto']
  ])('%s -> %s', (code, nombre) => {
    expect(getAduanaOficial(code).name).toBe(nombre);
    expect(nombresPorCodigo()[code]).toBe(nombre);
  });

  test('ES009999 (pruebas PRE) no es una aduana real de la lista', () => {
    expect(getAduanaOficial('ES009999')).toBeUndefined();
  });

  test('entradas no validas devuelven undefined', () => {
    expect(getAduanaOficial(null)).toBeUndefined();
    expect(getAduanaOficial('ES003001')).toBeUndefined();
  });
});

describe('aeatConfig.CUSTOMS_OFFICES sale de la lista oficial', () => {
  test('mismo numero de aduanas y mismos nombres', () => {
    expect(Object.keys(CUSTOMS_OFFICES)).toHaveLength(ADUANAS_OFICIALES.length);
    expect(getCustomsOfficeInfo('ES002801')).toEqual({
      name: 'Madrid - Aeropuerto', region: 'Madrid', type: 'air', code: '2801'
    });
    expect(getCustomsOfficeInfo('ES001131').type).toBe('maritime');
    expect(getCustomsOfficeInfo('ES002841').type).toBe('land');
  });

  test('los codigos inventados del catalogo anterior ya no existen', () => {
    for (const code of ['ES003001', 'ES002101', 'ES002805', 'ES001501', 'ES004301', 'ES000401']) {
      expect(getCustomsOfficeInfo(code)).toBeNull();
    }
  });
});

describe('aduanaPorLugar', () => {
  test.each([
    ['Puerto de Algeciras', 'ES001131'],
    ['Puerto de Algeciras (Cádiz)', 'ES001131'],
    ['ALGECIRAS', 'ES001131'],
    ['ESALG', 'ES001131'],
    ['Puerto de Barcelona', 'ES000811'],
    ['BCN', 'ES000811'],
    ['ESBCN', 'ES000811'],
    ['Aeropuerto de Barcelona-El Prat', 'ES000801'],
    ['Puerto de Valencia', 'ES004611'],
    ['ESVLC', 'ES004611'],
    ['Aeropuerto de Valencia', 'ES004601'],
    ['Madrid', 'ES002801'],
    ['MAD-BARAJAS', 'ES002801'],
    ['Puerto de Bilbao', 'ES004811'],
    ['Puerto de Sagunto (Valencia)', 'ES004621'],
    ['Vigo', 'ES003611'],
    ['Sevilla', 'ES004111'],
    ['Málaga', 'ES002911'],
    ['Cádiz', 'ES001111'],
    ['Castellón', 'ES001211'],
    ['Pasajes', 'ES002011']
  ])('%s -> %s', (lugar, code) => {
    expect(aduanaPorLugar(lugar)).toBe(code);
  });

  test('el modo de transporte elige el recinto de la plaza', () => {
    expect(aduanaPorLugar('Valencia', { modo: 'AIR' })).toBe('ES004601');
    expect(aduanaPorLugar('Valencia', { modo: 'air' })).toBe('ES004601');
    expect(aduanaPorLugar('Valencia', { modo: 'ROAD' })).toBe('ES004641');
    expect(aduanaPorLugar('Barcelona', { modo: 'RAIL' })).toBe('ES000881');
    // Algeciras solo tiene maritima en la lista: el modo no la cambia.
    expect(aduanaPorLugar('Algeciras', { modo: 'AIR' })).toBe('ES001131');
  });

  test('exportacion por Barcelona maritima usa su recinto de exportacion', () => {
    expect(aduanaPorLugar('Puerto de Barcelona', { sentido: 'export' })).toBe('ES000812');
    expect(aduanaPorLugar('Puerto de Valencia', { sentido: 'export' })).toBe('ES004611');
  });

  test('un codigo oficial se devuelve tal cual', () => {
    expect(aduanaPorLugar('es001131')).toBe('ES001131');
  });

  test('plazas fuera de la lista oficial o texto vacio -> null (no se adivina)', () => {
    for (const lugar of ['Las Palmas', 'Tenerife', 'Alicante', 'Tarragona', 'MALLORCA', 'XXX', '', null, undefined]) {
      expect(aduanaPorLugar(lugar)).toBeNull();
    }
  });
});
