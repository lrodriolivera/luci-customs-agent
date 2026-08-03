/**
 * Elegibilidad para el regimen H7 (importacion de bajo valor).
 *
 * H7 es el despacho simplificado para envios de hasta 150 EUR, el que usa el
 * e-commerce. Decidir mal aqui tiene consecuencia directa:
 *   - declarar por H7 algo que no lo admite -> la AEAT rechaza la declaracion
 *   - descartar H7 cuando si aplica -> se presenta un H1 completo, con mas
 *     documentacion y coste para el importador
 *
 * El limite de 150 EUR es el de la franquicia de derechos. Ojo con el
 * Reglamento (UE) 2026/382, en vigor desde el 1/Jul/2026: suprime esa
 * franquicia e introduce un derecho fijo de 3 EUR por articulo. El builder ya
 * lo contempla con el flag aplicarDerechoFijo2026, hoy desactivado.
 */

const h7Generator = require('../../src/services/forms/h7Generator');

/** Expedicion de bajo valor con una unica mercancia. */
function envio(valor, taricCode = '6109100010', extra = {}) {
  return {
    expeditionId: 'EXP-2026-0100',
    operationType: 'import',
    goods: [{ description: 'Camiseta', taricCode, invoiceValue: valor }],
    ...extra
  };
}

describe('h7Generator.isEligibleForH7: limite de valor', () => {
  test('un envio de 45 EUR es apto', () => {
    expect(h7Generator.isEligibleForH7(envio(45)).eligible).toBe(true);
  });

  test('exactamente 150 EUR sigue siendo apto', () => {
    // El limite es "hasta 150", no "menos de 150": el borde importa porque es
    // el caso mas frecuente en e-commerce.
    expect(h7Generator.isEligibleForH7(envio(150)).eligible).toBe(true);
  });

  test('150,01 EUR ya no es apto', () => {
    const r = h7Generator.isEligibleForH7(envio(150.01));

    expect(r.eligible).toBe(false);
    expect(r.reason).toContain('150');
  });

  test('el motivo del rechazo indica el valor real del envio', () => {
    // Quien lo lee necesita saber por cuanto se ha pasado.
    const r = h7Generator.isEligibleForH7(envio(230));

    expect(r.reason).toContain('230');
  });

  test('suma el valor de todas las mercancias, no solo la primera', () => {
    const r = h7Generator.isEligibleForH7({
      goods: [
        { description: 'A', taricCode: '6109100010', invoiceValue: 100 },
        { description: 'B', taricCode: '6109100010', invoiceValue: 80 }
      ]
    });

    expect(r.eligible).toBe(false);
    expect(r.reason).toContain('180');
  });

  test('goodsSummary tiene prioridad sobre la suma de las mercancias', () => {
    const r = h7Generator.isEligibleForH7({
      goodsSummary: { totalValue: 500 },
      goods: [{ description: 'A', taricCode: '6109100010', invoiceValue: 10 }]
    });

    expect(r.eligible).toBe(false);
  });

  test('un envio sin mercancias vale 0 y es apto', () => {
    expect(h7Generator.isEligibleForH7({ goods: [] }).eligible).toBe(true);
  });

  test('mercancias sin importe cuentan como 0', () => {
    const r = h7Generator.isEligibleForH7({
      goods: [{ description: 'Sin valorar', taricCode: '6109100010' }]
    });

    expect(r.eligible).toBe(true);
  });
});

describe('h7Generator.isEligibleForH7: bienes excluidos', () => {
  test('el alcohol (cap. 22) no es apto ni por debajo del limite', () => {
    // 2204: vino. Excluido del H7 por los impuestos especiales.
    const r = h7Generator.isEligibleForH7(envio(30, '2204100000'));

    expect(r.eligible).toBe(false);
    expect(r.reason).toContain('22');
  });

  test('el tabaco (cap. 24) tampoco', () => {
    const r = h7Generator.isEligibleForH7(envio(20, '2402200000'));

    expect(r.eligible).toBe(false);
  });

  test('el motivo identifica la mercancia concreta', () => {
    // Con varias lineas hay que saber cual bloquea el H7.
    const r = h7Generator.isEligibleForH7({
      goods: [
        { description: 'Camiseta', taricCode: '6109100010', invoiceValue: 20 },
        { description: 'Vino tinto', taricCode: '2204210000', invoiceValue: 25 }
      ]
    });

    expect(r.eligible).toBe(false);
    expect(r.reason).toContain('Vino tinto');
    expect(r.reason).toContain('Item 2');
  });

  test('usa el hsCode cuando falta el TARIC', () => {
    const r = h7Generator.isEligibleForH7({
      goods: [{ description: 'Ron', hsCode: '220840', invoiceValue: 30 }]
    });

    expect(r.eligible).toBe(false);
  });

  test('el resto de capitulos si son aptos', () => {
    for (const taric of ['6109100010', '8471300000', '9503007000', '3004900000']) {
      expect(h7Generator.isEligibleForH7(envio(50, taric)).eligible).toBe(true);
    }
  });
});

describe('h7Generator.checkRestrictedGoods', () => {
  test('devuelve lista vacia si no hay bienes excluidos', () => {
    expect(h7Generator.checkRestrictedGoods([
      { description: 'Camiseta', taricCode: '6109100010' }
    ])).toEqual([]);
  });

  test('tolera una lista de mercancias ausente', () => {
    // Llega asi en expedientes recien creados.
    expect(h7Generator.checkRestrictedGoods(undefined)).toEqual([]);
  });

  test('tolera mercancias sin ningun codigo', () => {
    expect(h7Generator.checkRestrictedGoods([{ description: 'Sin clasificar' }])).toEqual([]);
  });
});
