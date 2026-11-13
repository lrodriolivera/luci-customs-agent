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
      expect(matriculaIso6346('MSCU1150584400')).toBeNull();
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

      expect(r).toEqual({ contenedores: [], precintos: [], digitoIncorrecto: [] });
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
