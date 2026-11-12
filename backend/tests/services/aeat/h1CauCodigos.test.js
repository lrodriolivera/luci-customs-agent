const { OPERACION_REGISTRADA, ESTADO_DESPACHO, ESTADO_CONTABLE, PENDENCIAS, ADUANA_RESPONSABLE, describir } = require('../../../src/services/aeat/h1CauCodigos');

describe('códigos de estado de la AEAT (H1 CAU)', () => {
  test('los que devolvió la AEAT en preproducción tienen su texto de la guía', () => {
    expect(describir(OPERACION_REGISTRADA, '64')).toBe('Declaración completa activada');
    expect(describir(ESTADO_DESPACHO, 'P')).toBe('Pendiente de despacho');
    expect(describir(ESTADO_CONTABLE, 'PL')).toBe('Pendiente de contracción');
    expect(describir(PENDENCIAS, 'N')).toBe('No tiene pendencias');
  });

  test('levante, anulación y control', () => {
    expect(describir(OPERACION_REGISTRADA, '96')).toBe('Declaración levantada');
    expect(describir(ESTADO_DESPACHO, 'L')).toBe('Despachado con levante');
    expect(describir(ESTADO_CONTABLE, 'IT')).toBe('Ingresado totalmente');
    expect(describir(ADUANA_RESPONSABLE, '2')).toBe('Aduana de presentación');
  });

  test('un código desconocido o ausente no se inventa', () => {
    expect(describir(OPERACION_REGISTRADA, '77')).toBeNull();
    expect(describir(ESTADO_DESPACHO, null)).toBeNull();
    expect(describir(ESTADO_CONTABLE, undefined)).toBeNull();
  });
});
