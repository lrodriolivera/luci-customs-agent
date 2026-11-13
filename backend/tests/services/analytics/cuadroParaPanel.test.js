const { adaptarCuadro } = require('../../../src/services/analytics/cuadroParaPanel');

const cuadro = (over = {}) => ({
  simulated: false,
  generadoEn: '2026-11-09T10:00:00.000Z',
  declaraciones: { total: 40, porTipo: { H7: 30, NCTS: 10 }, porEstado: { rejected: 3, accepted: 20 }, aceptadas: 20, pendientes: 5 },
  canales: {},
  derechos: { declaraciones: 30, arancel: 100, iva: 200, total: 300, valorEnAduana: 1000, medioPorDeclaracion: 10 },
  tiempos: { muestra: 4, mediaHoras: 12.5, minimoHoras: 1, maximoHoras: 30 },
  cumplimiento: { inspecciones: 4, requerimientos: 2, requerimientosPendientes: 1, garantias: 3 },
  recaudacion: { disponible: false, motivo: 'sin pagos' },
  valorMercancia: { disponible: false },
  ...over
});

describe('adaptarCuadro', () => {
  it('mapea el cuadro real a operations/financial/compliance', () => {
    const r = adaptarCuadro(cuadro(), cuadro(), { activeExpeditions: 7 });
    expect(r.simulated).toBe(false);
    expect(r.generadoEn).toBe('2026-11-09T10:00:00.000Z');
    expect(r.operations).toEqual({
      totalDeclarations: 40,
      declarationsByType: { H7: 30, NCTS: 10 },
      averageProcessingTime: 12.5,
      activeExpeditions: 7
    });
    expect(r.financial).toEqual({
      totalDutiesCalculated: 300,
      totalDutiesPaid: null,
      potentialSavings: null,
      guaranteesUtilization: null
    });
    expect(r.compliance.rejectionRate).toBe(10);
    expect(r.compliance.inspectionRate).toBe(10);
    expect(r.compliance.documentCompleteness).toBeNull();
    expect(r.compliance.errorRate).toBeNull();
    expect(r.compliance.onTimeSubmissions).toBeNull();
  });

  it('totalDutiesPaid solo si la recaudacion esta disponible', () => {
    const r = adaptarCuadro(cuadro({ recaudacion: { disponible: true, total: 250, pagos: 2 } }), null, {});
    expect(r.financial.totalDutiesPaid).toBe(250);
  });

  it('nulls cuando falta la fuente (sin muestra, sin H7, sin declaraciones)', () => {
    const vacio = cuadro({
      declaraciones: { total: 0, porTipo: { H7: 0, NCTS: 0 }, porEstado: {} },
      tiempos: { muestra: 0, mediaHoras: null },
      cumplimiento: { inspecciones: 0 }
    });
    const r = adaptarCuadro(vacio, null, {});
    expect(r.operations.averageProcessingTime).toBeNull();
    expect(r.operations.activeExpeditions).toBeNull();
    expect(r.compliance.rejectionRate).toBeNull();
    expect(r.compliance.inspectionRate).toBeNull();
    expect(r.operations.totalDeclarations).toBe(0);
  });

  it('tendencias: direccion y porcentaje contra el periodo anterior', () => {
    const anterior = cuadro({
      declaraciones: { total: 20, porTipo: {}, porEstado: {} },
      derechos: { total: 600 }
    });
    const r = adaptarCuadro(cuadro(), anterior, {});
    expect(r.trends.operations).toEqual({ direction: 'up', percentage: 100 });
    expect(r.trends.financial).toEqual({ direction: 'down', percentage: 50 });
    expect(r.trends.compliance).toBeNull();
  });

  it('tendencias: periodo anterior a 0 -> percentage null', () => {
    const anterior = cuadro({ declaraciones: { total: 0, porTipo: {}, porEstado: {} }, derechos: { total: 0 } });
    const r = adaptarCuadro(cuadro(), anterior, {});
    expect(r.trends.operations.percentage).toBeNull();
    expect(r.trends.financial.percentage).toBeNull();
  });

  it('tendencias: sin cuadro anterior -> percentage null; igual -> stable 0', () => {
    expect(adaptarCuadro(cuadro(), null, {}).trends.operations.percentage).toBeNull();
    const r = adaptarCuadro(cuadro(), cuadro(), {});
    expect(r.trends.operations).toEqual({ direction: 'stable', percentage: 0 });
  });
});

describe('panelDelAmbito', () => {
  const realMetrics = require('../../../src/services/analytics/realMetricsService');
  const { panelDelAmbito, periodoAnterior } = require('../../../src/services/analytics/cuadroParaPanel');

  afterEach(() => jest.restoreAllMocks());

  it('periodoAnterior: mismo largo, inmediatamente antes', () => {
    const r = periodoAnterior(new Date('2026-10-11T00:00:00Z'), new Date('2026-11-10T00:00:00Z'));
    expect(r.hasta.toISOString()).toBe('2026-10-11T00:00:00.000Z');
    expect(r.desde.toISOString()).toBe('2026-09-11T00:00:00.000Z');
  });

  it('pide el periodo actual completo y los expedientes activos', async () => {
    const cm = jest.spyOn(realMetrics, 'cuadroDeMando').mockResolvedValue(cuadro());
    jest.spyOn(realMetrics, 'volumenDeclaraciones').mockResolvedValue({ total: 5 });
    jest.spyOn(realMetrics, 'derechosLiquidados').mockResolvedValue({ total: 50 });
    jest.spyOn(realMetrics, 'expedientesActivos').mockResolvedValue(9);
    const r = await panelDelAmbito('t1', { desde: '2026-10-11T00:00:00Z', hasta: '2026-11-10T00:00:00Z' });
    // El cuadro completo (7 agregaciones) solo se pide una vez, para el periodo
    // actual. El anterior ya no lo pide: ver el test de abajo.
    expect(cm).toHaveBeenCalledTimes(1);
    expect(cm.mock.calls[0][0]).toBe('t1');
    expect(cm.mock.calls[0][1].hasta.toISOString()).toBe('2026-11-10T00:00:00.000Z');
    expect(r.operations.activeExpeditions).toBe(9);
    expect(r.simulated).toBe(false);
  });

  it('el periodo anterior solo pide los dos totales que usa la tendencia, no el cuadro completo', async () => {
    jest.spyOn(realMetrics, 'cuadroDeMando').mockResolvedValue(cuadro());
    const vd = jest.spyOn(realMetrics, 'volumenDeclaraciones').mockResolvedValue({ total: 5 });
    const dl = jest.spyOn(realMetrics, 'derechosLiquidados').mockResolvedValue({ total: 50 });
    const repCanal = jest.spyOn(realMetrics, 'repartoPorCanal');
    const tiempos = jest.spyOn(realMetrics, 'tiemposDeDespacho');
    const valorMerc = jest.spyOn(realMetrics, 'valorMercancia');
    jest.spyOn(realMetrics, 'expedientesActivos').mockResolvedValue(0);

    const r = await panelDelAmbito('t1', { desde: '2026-10-11T00:00:00Z', hasta: '2026-11-10T00:00:00Z' });

    expect(vd).toHaveBeenCalledTimes(1);
    expect(dl).toHaveBeenCalledTimes(1);
    expect(vd.mock.calls[0][1].hasta.toISOString()).toBe('2026-10-11T00:00:00.000Z');
    expect(dl.mock.calls[0][1].hasta.toISOString()).toBe('2026-10-11T00:00:00.000Z');
    // Lo que el cuadro completo del periodo anterior calculaba de mas y que
    // adaptarCuadro nunca usaba: ya no se pide.
    expect(repCanal).not.toHaveBeenCalled();
    expect(tiempos).not.toHaveBeenCalled();
    expect(valorMerc).not.toHaveBeenCalled();
    expect(r.trends).toBeDefined();
  });

  it('sin fechas usa los ultimos 30 dias', async () => {
    const cm = jest.spyOn(realMetrics, 'cuadroDeMando').mockResolvedValue(cuadro());
    jest.spyOn(realMetrics, 'volumenDeclaraciones').mockResolvedValue({ total: 0 });
    jest.spyOn(realMetrics, 'derechosLiquidados').mockResolvedValue({ total: 0 });
    jest.spyOn(realMetrics, 'expedientesActivos').mockResolvedValue(0);
    await panelDelAmbito(undefined, {});
    const { desde, hasta } = cm.mock.calls[0][1];
    expect(Math.round((hasta - desde) / 86400000)).toBe(30);
  });

  it('ambito null (sin tenant): no consulta nada y no ve datos', async () => {
    const cm = jest.spyOn(realMetrics, 'cuadroDeMando');
    const r = await panelDelAmbito(null, {});
    expect(cm).not.toHaveBeenCalled();
    expect(r.operations.totalDeclarations).toBe(0);
    expect(r.operations.averageProcessingTime).toBeNull();
    expect(r.trends.operations.percentage).toBeNull();
  });
});
