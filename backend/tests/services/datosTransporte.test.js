/**
 * Validacion en codigo de lo que lee la IA en un documento de transporte.
 *
 * Origen: lectura en produccion (13/Nov/2026) de un BL de T.S. Lines
 * (Haiphong -> Manila) y de un AWB de OIA Global (Cleveland -> Ciudad de
 * Mexico). Los valores de las pruebas son los de esos documentos.
 */
const {
  digitoControlIso6346,
  matriculaIso6346,
  separarContenedoresYPrecintos,
  deducirTipoCarga,
  ciudadSinEstado,
  vueloPrincipal
} = require('../../src/services/documentos/datosTransporte');

// Casilla «Container No. / Seal No.» del BL, tal como la leyo la IA.
const CASILLA_BL = [
  'MAGU5810422/40HQ', 'TSB2716891',
  'MAGU5599236/40HQ', 'TSB2716818',
  'TXGU7359270/40HQ', 'TSB2716718'
];

describe('datosTransporte', () => {
  describe('digito de control ISO 6346', () => {
    test('calcula el digito de control del ejemplo de la norma y de los contenedores del BL', () => {
      expect(digitoControlIso6346('CSQU305438')).toBe(3);
      expect(digitoControlIso6346('MAGU559923')).toBe(6);
      expect(digitoControlIso6346('TXGU735927')).toBe(0);
    });

    test('una matricula con formato ISO se reconoce aunque venga con espacios, guiones o el tipo', () => {
      expect(matriculaIso6346('MAGU5599236/40HQ')).toEqual({ numero: 'MAGU5599236', digitoCorrecto: true });
      expect(matriculaIso6346('tghu 884221-7')).toEqual({ numero: 'TGHU8842217', digitoCorrecto: false });
      expect(matriculaIso6346('Container MSCU1150584 / seal 99')).toMatchObject({ numero: 'MSCU1150584' });
    });

    test('sin cuatro letras (la cuarta U, J o Z) y siete cifras no es una matricula de contenedor', () => {
      expect(matriculaIso6346('TSB2716891')).toBeNull();
      expect(matriculaIso6346('MSCA1150584')).toBeNull();
      expect(matriculaIso6346('SL264686400')).toBeNull();
      expect(matriculaIso6346(null)).toBeNull();
    });
  });

  describe('separarContenedoresYPrecintos', () => {
    test('la casilla del BL da los tres contenedores y los tres precintos por separado', () => {
      const r = separarContenedoresYPrecintos(CASILLA_BL);

      expect(r.contenedores).toEqual(['MAGU5810422', 'MAGU5599236', 'TXGU7359270']);
      expect(r.precintos).toEqual(['TSB2716891', 'TSB2716818', 'TSB2716718']);
    });

    test('un contenedor con el digito de control que no cuadra se queda como contenedor, pero se señala', () => {
      const r = separarContenedoresYPrecintos(CASILLA_BL);

      // MAGU5810422 es lo que pone el BL; segun la norma su digito seria 0.
      expect(r.digitoIncorrecto).toEqual(['MAGU5810422']);
    });

    test('los precintos que la IA ya separa se suman, sin repetir; si traen una matricula, es un contenedor', () => {
      const r = separarContenedoresYPrecintos(['MAGU5599236'], ['TSB2716818', 'tsb 2716818', 'TXGU7359270']);

      expect(r.contenedores).toEqual(['MAGU5599236', 'TXGU7359270']);
      expect(r.precintos).toEqual(['TSB2716818']);
    });

    test('lo que no lleva ninguna cifra no es ni contenedor ni precinto', () => {
      const r = separarContenedoresYPrecintos(['sin numero', null, '', 'N/A', { x: 1 }], 'no es lista');

      expect(r).toEqual({ contenedores: [], precintos: [], digitoIncorrecto: [], cifrasDeMas: [] });
    });

    // UAT 16/Nov/2026 (EXP-2026-74AEEBBC): el BL traia «MSCU1150584400 40HC /
    // Seal SL264686400» y el contenedor acabo entre los precintos.
    test('una matricula con cifras de mas se toma por sus 11 primeros caracteres y se señala', () => {
      const r = separarContenedoresYPrecintos([], ['MSCU1150584400', 'SL264686400', '40HC']);

      expect(r.contenedores).toEqual(['MSCU1150584']);
      // El tamaño del contenedor no es un precinto.
      expect(r.precintos).toEqual(['SL264686400']);
      expect(r.cifrasDeMas).toEqual([{ leido: 'MSCU1150584400', numero: 'MSCU1150584', digitoCorrecto: false }]);
      // Su digito se avisa en la nota de cifras de mas, no por duplicado.
      expect(r.digitoIncorrecto).toEqual([]);
    });

    test('con cifras de mas y el digito de control correcto tambien se señala', () => {
      expect(matriculaIso6346('MAGU5599236400 40HC')).toEqual({ numero: 'MAGU5599236', digitoCorrecto: true, cifrasDeMas: 'MAGU5599236400' });
      // El tipo pegado tras un espacio no son cifras de mas.
      expect(matriculaIso6346('MAGU5599236 40HC')).toEqual({ numero: 'MAGU5599236', digitoCorrecto: true });
    });
  });

  describe('deducirTipoCarga', () => {
    const BL = { tipo: 'bill_of_lading', contenedores: ['MSCU1150584'] };

    test('lo que el documento dice literalmente manda', () => {
      expect(deducirTipoCarga({ literal: 'fcl/fcl' })).toEqual({ tipoCarga: 'FCL', nota: null });
      expect(deducirTipoCarga({ literal: 'CFS/CFS' })).toEqual({ tipoCarga: 'LCL', nota: null });
      expect(deducirTipoCarga({ ...BL, literal: 'LCL', indicaciones: ['40HC'] }).tipoCarga).toBe('LCL');
    });

    test('CY/CY, FCL y «Shipper\'s load, count and seal» son contenedor completo', () => {
      expect(deducirTipoCarga({ indicaciones: ['CY/CY'] }).tipoCarga).toBe('FCL');
      expect(deducirTipoCarga({ indicaciones: ["SHIPPER'S LOAD, COUNT AND SEAL"] })).toEqual({
        tipoCarga: 'FCL', nota: "Tipo de carga FCL deducido de: SHIPPER'S LOAD, COUNT AND SEAL."
      });
    });

    test('CFS, consolidated o groupage son grupaje, aunque el contenedor lleve tamaño', () => {
      expect(deducirTipoCarga({ indicaciones: ['CFS/CFS'] }).tipoCarga).toBe('LCL');
      expect(deducirTipoCarga({ ...BL, indicaciones: ['Consolidated cargo', '40HC'] }).tipoCarga).toBe('LCL');
      expect(deducirTipoCarga({ indicaciones: ['GROUPAGE'] }).tipoCarga).toBe('LCL');
    });

    // Regla de las agentes (Jenifer, 17/11/2026): «si pone contenedor da lo mismo
    // el tamaño, es FCL; el grupaje estará descrito como cajas (ctn) o unidades».
    test('en un BL, si trae contenedor es FCL aunque no diga el tamaño, y se explica', () => {
      const r = deducirTipoCarga({ ...BL, indicaciones: [] });
      expect(r.tipoCarga).toBe('FCL');
      expect(r.nota).toContain('MSCU1150584');
      expect(deducirTipoCarga({ ...BL, indicaciones: [], leidosContenedor: ['MSCU1150584400 40HC'] }).tipoCarga).toBe('FCL');
    });

    test('en un BL sin contenedor, la mercancía en cajas o unidades es LCL', () => {
      const sinContenedor = { tipo: 'bill_of_lading', contenedores: [] };
      expect(deducirTipoCarga({ ...sinContenedor, embalajes: ['CT'] }).tipoCarga).toBe('LCL');
      expect(deducirTipoCarga({ ...sinContenedor, indicaciones: ['10 CARTONS'] }).tipoCarga).toBe('LCL');
      expect(deducirTipoCarga({ ...sinContenedor, embalajes: ['PCS'] }).nota).toMatch(/cajas o unidades/);
    });

    test('sin señales, o con señales contradictorias, no se decide', () => {
      expect(deducirTipoCarga({})).toEqual({ tipoCarga: null, nota: null });
      // Un tamaño sin contenedor, o fuera de un BL, no basta.
      expect(deducirTipoCarga({ tipo: 'bill_of_lading', contenedores: [], indicaciones: ['40HC'] }).tipoCarga).toBeNull();
      expect(deducirTipoCarga({ tipo: 'packing_list', contenedores: ['MSCU1150584'], indicaciones: ['40HC'] }).tipoCarga).toBeNull();
      const contradictorio = deducirTipoCarga({ indicaciones: ['CY/CY', 'CONSOLIDATED'] });
      expect(contradictorio.tipoCarga).toBeNull();
      expect(contradictorio.nota).toContain('elige el tipo de carga');
      expect(deducirTipoCarga({ literal: 'contenedor completo' }).tipoCarga).toBeNull();
    });
  });

  describe('ciudadSinEstado', () => {
    test('quita el codigo de estado que acompaña a la ciudad en EE. UU., Mexico y Canada', () => {
      expect(ciudadSinEstado('SOLON OH', 'US')).toBe('SOLON');
      expect(ciudadSinEstado('Solon, OH', 'US')).toBe('Solon');
      expect(ciudadSinEstado('MADERO CMX', 'MX')).toBe('MADERO');
      expect(ciudadSinEstado('Toronto ON', 'CA')).toBe('Toronto');
    });

    test('«CMX» solo es el estado de Ciudad de Mexico, que es tambien la ciudad', () => {
      expect(ciudadSinEstado('CMX', 'MX')).toBe('CIUDAD DE MEXICO');
      expect(ciudadSinEstado('CDMX', 'MX')).toBe('CIUDAD DE MEXICO');
    });

    test('un codigo de estado solo, que no es una ciudad, se descarta', () => {
      expect(ciudadSinEstado('OH', 'US')).toBeNull();
      expect(ciudadSinEstado('JAL', 'MX')).toBeNull();
    });

    test('fuera de esos paises, o si la ultima palabra no es un codigo de estado, no se toca', () => {
      expect(ciudadSinEstado('Paterna (Valencia)', 'ES')).toBe('Paterna (Valencia)');
      expect(ciudadSinEstado('SAN ON', 'ES')).toBe('SAN ON');
      expect(ciudadSinEstado('SOLON OH', null)).toBe('SOLON OH');
      expect(ciudadSinEstado('NEW YORK', 'US')).toBe('NEW YORK');
      // En minusculas no es un codigo de estado, es parte del nombre.
      expect(ciudadSinEstado('Lake Oswego Or', 'US')).toBe('Lake Oswego Or');
      expect(ciudadSinEstado(null, 'US')).toBeNull();
    });
  });

  describe('vueloPrincipal', () => {
    test('el numero de vuelo va sin el dia del mes que lo acompaña en el AWB', () => {
      expect(vueloPrincipal('5X 1441/23')).toEqual({ vuelo: '5X 1441', otros: [] });
    });

    test('con varios vuelos, el primero es el medio y el resto se devuelven aparte', () => {
      expect(vueloPrincipal('5X 1441/23, 5X 320/24')).toEqual({ vuelo: '5X 1441', otros: ['5X 320'] });
      expect(vueloPrincipal('IB6251 / IB3110')).toEqual({ vuelo: 'IB6251', otros: ['IB3110'] });
    });

    test('lo que no tiene forma de vuelo se deja como se leyo', () => {
      expect(vueloPrincipal('TS HAKATA')).toEqual({ vuelo: 'TS HAKATA', otros: [] });
      expect(vueloPrincipal(null)).toEqual({ vuelo: null, otros: [] });
    });
  });
});

describe('nacionalidad, IMO y MRN leidos (UAT 17/Nov/2026)', () => {
  const { nacionalidadDelMedio, numeroImo, mrnLeido } = require('../../src/services/documentos/datosTransporte');

  test('nacionalidadDelMedio admite codigo ISO o signo distintivo y nada mas', () => {
    expect(nacionalidadDelMedio('pa')).toEqual({ pais: 'PA', signo: null });
    expect(nacionalidadDelMedio(' E ')).toEqual({ pais: 'ES', signo: 'E' });
    expect(nacionalidadDelMedio('IRL')).toEqual({ pais: 'IE', signo: 'IRL' });
    expect(nacionalidadDelMedio('Panama')).toEqual({ pais: null, signo: null });
    expect(nacionalidadDelMedio(null)).toEqual({ pais: null, signo: null });
  });

  test('numeroImo comprueba las siete cifras y el digito de control', () => {
    expect(numeroImo('IMO 9074729')).toEqual({ numero: '9074729', digitoCorrecto: true });
    expect(numeroImo('9074720')).toEqual({ numero: '9074720', digitoCorrecto: false });
    expect(numeroImo('IMO 907472')).toBeNull();
    expect(numeroImo({})).toBeNull();
  });

  test('mrnLeido valida la forma y el digito de control con MRN reales de la AEAT', () => {
    expect(mrnLeido('26ES002801501092J0')).toEqual({ numero: '26ES002801501092J0', digitoCorrecto: true });
    expect(mrnLeido('26esh7a000067965r5')).toEqual({ numero: '26ESH7A000067965R5', digitoCorrecto: true });
    expect(mrnLeido('26ES002801501092J1').digitoCorrecto).toBe(false);
    expect(mrnLeido('2026ES00782741')).toBeNull();
    expect(mrnLeido(undefined)).toBeNull();
  });
});
