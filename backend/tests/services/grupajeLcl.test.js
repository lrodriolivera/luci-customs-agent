/**
 * Regla del grupaje maritimo (LCL) antes del H1.
 *
 * UAT 10/Nov/2026: «cuando la naviera de de alta la declaracion sumaria por el
 * contenedor completo siendo un LCL no debe bajo ningun concepto proceder con
 * el H1 con esa declaracion sumaria».
 */
const { bloqueoPorGrupaje, exigirSumariaDeGrupaje, esGrupaje, CODIGO_ERROR } = require('../../src/services/forms/grupajeLcl');
const { ErrorValidacion } = require('../../src/services/forms/identificadorAduanero');

const expediente = (transport, resumen = { totalPackages: 12, totalGrossWeight: 1050.5 }) => ({
  expeditionId: 'EXP-2026-LCL',
  goodsSummary: resumen,
  transport
});

const sumariaPropia = { number: '46112600012345', item: '3', packages: 12, grossWeight: 1050.5 };

describe('grupajeLcl', () => {
  describe('cuando no aplica', () => {
    test('un expediente sin tipo de carga no se bloquea', () => {
      expect(bloqueoPorGrupaje(expediente({}))).toBeNull();
      expect(bloqueoPorGrupaje(expediente(undefined))).toBeNull();
      expect(bloqueoPorGrupaje(null)).toBeNull();
    });

    test('un contenedor completo (FCL) no se bloquea aunque no tenga sumaria', () => {
      expect(bloqueoPorGrupaje(expediente({ loadType: 'FCL' }))).toBeNull();
      expect(esGrupaje(expediente({ loadType: 'FCL' }))).toBe(false);
    });
  });

  describe('grupaje sin la sumaria de la desconsolidacion', () => {
    test('sin sumaria registrada bloquea y explica que hay que esperar al vaciado', () => {
      const motivo = bloqueoPorGrupaje(expediente({ loadType: 'LCL' }));

      expect(motivo).toContain('EXP-2026-LCL');
      expect(motivo).toContain('falta la declaracion sumaria de la desconsolidacion');
      expect(motivo).toContain('contenedor completo no sirve');
    });

    test('un numero en blanco cuenta como sumaria ausente', () => {
      expect(bloqueoPorGrupaje(expediente({ loadType: 'LCL', summaryDeclaration: { number: '   ' } })))
        .toContain('falta la declaracion sumaria');
    });

    test('con numero pero sin bultos o sin peso pide registrarlos', () => {
      const sinBultos = bloqueoPorGrupaje(expediente({ loadType: 'LCL', summaryDeclaration: { number: 'S1', grossWeight: 1050.5 } }));
      const sinPeso = bloqueoPorGrupaje(expediente({ loadType: 'LCL', summaryDeclaration: { number: 'S1', packages: 12 } }));

      expect(sinBultos).toContain('registra los bultos y el peso bruto');
      expect(sinPeso).toContain('registra los bultos y el peso bruto');
    });
  });

  describe('grupaje con sumaria registrada', () => {
    test('la sumaria del contenedor completo no cuadra y bloquea, con las dos cifras a la vista', () => {
      const motivo = bloqueoPorGrupaje(expediente({
        loadType: 'LCL',
        summaryDeclaration: { number: 'S-CONTENEDOR', packages: 820, grossWeight: 14200 }
      }));

      expect(motivo).toContain('no corresponde a esta partida');
      expect(motivo).toContain('820 bultos y 14200 kg');
      expect(motivo).toContain('12 bultos y 1050.5 kg');
    });

    test('mismos kilos pero distintos bultos tambien bloquea', () => {
      expect(bloqueoPorGrupaje(expediente({
        loadType: 'LCL', summaryDeclaration: { ...sumariaPropia, packages: 13 }
      }))).toContain('no corresponde a esta partida');
    });

    test('la sumaria de la desconsolidacion, con nuestros bultos y kilos, deja seguir', () => {
      expect(bloqueoPorGrupaje(expediente({ loadType: 'LCL', summaryDeclaration: sumariaPropia }))).toBeNull();
    });

    test('admite la diferencia de redondeo del peso (hasta 1 kg o el 1 %)', () => {
      const con = (grossWeight) => bloqueoPorGrupaje(expediente({
        loadType: 'LCL', summaryDeclaration: { ...sumariaPropia, grossWeight }
      }));

      expect(con(1051)).toBeNull();
      expect(con(1060)).toBeNull();        // 9,5 kg sobre 1.050,5 kg: dentro del 1 %
      expect(con(1062)).toContain('no corresponde');
      expect(con(1039)).toContain('no corresponde');
    });

    test('en partidas pequenas la tolerancia es de 1 kg, no del 1 %', () => {
      const pequeno = (grossWeight) => bloqueoPorGrupaje(expediente(
        { loadType: 'LCL', summaryDeclaration: { number: 'S1', packages: 2, grossWeight } },
        { totalPackages: 2, totalGrossWeight: 10 }
      ));

      expect(pequeno(10.9)).toBeNull();
      expect(pequeno(11.5)).toContain('no corresponde');
    });

    test('los valores llegan como texto desde un formulario y se comparan como numeros', () => {
      expect(bloqueoPorGrupaje(expediente({
        loadType: 'LCL', summaryDeclaration: { number: 'S1', packages: '12', grossWeight: '1050.5' }
      }))).toBeNull();
    });

    test('un expediente sin totales calculados no cuadra con ninguna sumaria', () => {
      expect(bloqueoPorGrupaje(expediente({ loadType: 'LCL', summaryDeclaration: sumariaPropia }, null)))
        .not.toBeNull();
      expect(bloqueoPorGrupaje({ transport: { loadType: 'LCL', summaryDeclaration: sumariaPropia } }))
        .toContain('0 bultos y 0 kg');
    });
  });

  describe('exigirSumariaDeGrupaje', () => {
    test('lanza un ErrorValidacion 422 con codigo propio', () => {
      expect.assertions(4);
      try {
        exigirSumariaDeGrupaje(expediente({ loadType: 'LCL' }));
      } catch (error) {
        expect(error).toBeInstanceOf(ErrorValidacion);
        expect(error.status).toBe(422);
        expect(error.code).toBe(CODIGO_ERROR);
        expect(error.message).toContain('grupaje maritimo (LCL)');
      }
    });

    test('no lanza si la sumaria es la de la partida o si no es grupaje', () => {
      expect(() => exigirSumariaDeGrupaje(expediente({ loadType: 'LCL', summaryDeclaration: sumariaPropia }))).not.toThrow();
      expect(() => exigirSumariaDeGrupaje(expediente({}))).not.toThrow();
    });
  });
});
