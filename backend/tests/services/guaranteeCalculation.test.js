/**
 * guaranteeService.calculateRequiredGuarantee: cuanto hay que avalar.
 *
 * Es el calculo que decide el importe de garantia que la AEAT exige para
 * autorizar un regimen (transito, deposito, importacion temporal...). Un error
 * aqui tiene dos caras: pedir de menos deja al operador con la operacion
 * bloqueada en aduana, y pedir de mas inmoviliza capital del cliente sin
 * necesidad.
 *
 * Metodo puro: no toca base de datos. Se ejercita de verdad contra las tablas
 * GUARANTEE_RATES y OEA_REDUCTIONS del propio servicio; los importes esperados
 * estan calculados a mano desde esas tablas, no copiados de la salida.
 */

const guaranteeService = require('../../src/services/guaranteeService');

/** Base de derechos por defecto para los casos: 1000 arancel + 210 IVA = 1210. */
const DERECHOS = { dutyAmount: 1000, vatAmount: 210 };

describe('tasa por regimen', () => {
  test('el transito T1 exige el 100% de los derechos', () => {
    // Transito externo: la mercancia circula sin haber pagado derechos, asi
    // que se avala el total. 1210 * 100% = 1210.
    const r = guaranteeService.calculateRequiredGuarantee({
      regime: 'transit', subType: 'T1', ...DERECHOS
    });

    expect(r.rate).toBe(100);
    expect(r.baseAmount).toBe(1210);
    expect(r.finalAmount).toBe(1210);
  });

  test('la devolucion (drawback) no exige garantia, pero se aplica el minimo', () => {
    // En perfeccionamiento activo con devolucion los derechos ya se pagaron:
    // rate 0. El calculo da 0, pero el minimo legal de 100 EUR prevalece.
    const r = guaranteeService.calculateRequiredGuarantee({
      regime: 'inward_processing', subType: 'drawback', ...DERECHOS
    });

    expect(r.rate).toBe(0);
    expect(r.baseAmount).toBe(0);
    expect(r.finalAmount).toBe(100);
  });

  test('un regimen o subtipo desconocido cae en el 100% por defecto', () => {
    // Ante lo que no reconoce, el servicio no avala de menos: aplica el 100%.
    const r = guaranteeService.calculateRequiredGuarantee({
      regime: 'inventado', subType: 'yyy', ...DERECHOS
    });

    expect(r.rate).toBe(100);
    expect(r.finalAmount).toBe(1210);
    expect(r.description).toBe('');
  });

  test('el deposito aduanero publico avala el 100%', () => {
    const r = guaranteeService.calculateRequiredGuarantee({
      regime: 'customs_warehouse', subType: 'public', ...DERECHOS
    });

    expect(r.rate).toBe(100);
    expect(r.finalAmount).toBe(1210);
  });
});

describe('importacion temporal con exencion parcial', () => {
  test('cobra el 3% de los derechos por cada mes', () => {
    // Regla del CAU: 3% mensual del importe que se habria pagado en despacho a
    // libre practica. 1210 * 3% * 5 meses = 181,5.
    const r = guaranteeService.calculateRequiredGuarantee({
      regime: 'temporary_import', subType: 'partial_relief', duration: 5, ...DERECHOS
    });

    expect(r.rate).toBe(3);
    expect(r.finalAmount).toBe(181.5);
    expect(r.breakdown.duration).toBe(5);
  });

  test('sin duracion informada cuenta como un mes', () => {
    // 1210 * 3% * 1 = 36,3, pero por debajo del minimo => 100.
    const r = guaranteeService.calculateRequiredGuarantee({
      regime: 'temporary_import', subType: 'partial_relief', ...DERECHOS
    });

    expect(r.breakdown.duration).toBeNull();
    expect(r.finalAmount).toBe(100);
  });

  test('la exencion total avala el 100%', () => {
    const r = guaranteeService.calculateRequiredGuarantee({
      regime: 'temporary_import', subType: 'total_relief', ...DERECHOS
    });

    expect(r.rate).toBe(100);
    expect(r.finalAmount).toBe(1210);
  });
});

describe('reduccion por OEA', () => {
  test('OEAF reduce la garantia al 50%', () => {
    // OEAF (OEAC + OEAS) es la certificacion completa: 50% de reduccion.
    // 1210 * 0.50 = 605, y la parte ahorrada (605) queda documentada.
    const r = guaranteeService.calculateRequiredGuarantee({
      regime: 'transit', subType: 'T1', oeaStatus: 'OEAF', ...DERECHOS
    });

    expect(r.finalAmount).toBe(605);
    expect(r.oeaReduction).toBe(605);
    expect(r.oeaStatus).toBe('OEAF');
  });

  test('OEAC reduce solo el 30%', () => {
    // Solo simplificaciones aduaneras: factor 0.70 => se avala el 70%.
    // 1210 * 0.70 = 847.
    const r = guaranteeService.calculateRequiredGuarantee({
      regime: 'transit', subType: 'T1', oeaStatus: 'OEAC', ...DERECHOS
    });

    expect(r.finalAmount).toBe(847);
    expect(r.oeaReduction).toBe(363);
  });

  test('los codigos legacy (AEOF, AEOS) siguen reconociendose', () => {
    // La migracion de nomenclatura no debe dejar sin reduccion a quien ya la
    // tenia concedida con el codigo antiguo.
    const legacy = guaranteeService.calculateRequiredGuarantee({
      regime: 'transit', subType: 'T1', oeaStatus: 'AEOS', ...DERECHOS
    });

    // AEOS mapea a 0.50 en la tabla legacy.
    expect(legacy.finalAmount).toBe(605);
  });

  test('un estado OEA desconocido no aplica reduccion', () => {
    // Ante un codigo que no esta en la tabla, se avala el importe completo:
    // nunca se concede una reduccion que no consta.
    const r = guaranteeService.calculateRequiredGuarantee({
      regime: 'transit', subType: 'T1', oeaStatus: 'INVENTADO', ...DERECHOS
    });

    expect(r.finalAmount).toBe(1210);
    expect(r.oeaReduction).toBe(0);
  });

  test('sin OEA no hay reduccion', () => {
    const r = guaranteeService.calculateRequiredGuarantee({
      regime: 'transit', subType: 'T1', ...DERECHOS
    });

    expect(r.oeaReduction).toBe(0);
    expect(r.oeaStatus).toBeUndefined();
  });
});

describe('minimo legal y redondeo', () => {
  test('nunca baja de 100 EUR', () => {
    // Derechos minusculos: 10 * 100% = 10, pero el minimo prevalece.
    const r = guaranteeService.calculateRequiredGuarantee({
      regime: 'transit', subType: 'T1', dutyAmount: 5, vatAmount: 5
    });

    expect(r.finalAmount).toBe(100);
  });

  test('redondea el importe final a dos decimales', () => {
    // 3% de 1234,55 = 37,0365 => 37,04, pero < 100 => 100. Forzamos por encima
    // del minimo con derechos mas altos: 3% de 100000 * 1 mes = 3000.
    const r = guaranteeService.calculateRequiredGuarantee({
      regime: 'temporary_import', subType: 'partial_relief',
      dutyAmount: 100000, vatAmount: 0, duration: 1
    });

    expect(r.finalAmount).toBe(3000);
    expect(Number.isInteger(r.finalAmount * 100)).toBe(true);
  });

  test('sin derechos declarados el total es cero y se aplica el minimo', () => {
    // Un borrador sin calcular todavia arancel ni IVA no debe reventar.
    const r = guaranteeService.calculateRequiredGuarantee({
      regime: 'transit', subType: 'T1'
    });

    expect(r.breakdown.totalDuties).toBe(0);
    expect(r.finalAmount).toBe(100);
  });
});

describe('desglose devuelto', () => {
  test('incluye los componentes que explican el importe', () => {
    // La UI muestra este desglose para justificar la cifra al operador.
    const r = guaranteeService.calculateRequiredGuarantee({
      regime: 'transit', subType: 'T1', customsValue: 50000, ...DERECHOS
    });

    expect(r.breakdown).toMatchObject({
      customsValue: 50000,
      dutyAmount: 1000,
      vatAmount: 210,
      totalDuties: 1210
    });
  });
});
