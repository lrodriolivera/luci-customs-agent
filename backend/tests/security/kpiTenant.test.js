/**
 * Ataque (barrido C2): kpiService guardaba activeAlerts y kpiHistory en variables
 * globales, así que un tenant leía, reconocía y descartaba las alertas de otro y
 * veía su histórico. Ahora el estado va por tenant. Ámbito: undefined = super admin
 * de plataforma (ve todo); null = sin tenant (no ve nada); string = ese tenant.
 */
jest.mock('../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../src/services/aiService', () => ({
  analyzeWithLuci: jest.fn().mockResolvedValue({ summary: '', recommendations: [], warnings: [] }),
  analyzeKPIDeviations: jest.fn()
}));

const kpiService = require('../../src/services/analytics/kpiService');

const A = 'tenant-a';
const B = 'tenant-b';

// error_rate=9 supera critical_high (5): crea alerta crítica
const provocarAlerta = async (tenantId) => {
  await kpiService.calculateKPI('error_rate', { errorRate: 9 }, tenantId);
  return kpiService.getActiveAlerts({ kpiId: 'error_rate' }, tenantId).alerts[0];
};

describe('kpiService: alertas e histórico acotados por tenant', () => {
  let alertaA;
  beforeEach(async () => {
    // limpia estado entre tests: descarta todo lo visible por plataforma
    for (const a of kpiService.getActiveAlerts({}, undefined).alerts) kpiService.dismissAlert(a.id, undefined);
    alertaA = await provocarAlerta(A);
  });

  test('el tenant B no ve las alertas de A', () => {
    expect(kpiService.getActiveAlerts({}, B).alerts).toEqual([]);
    expect(kpiService.getActiveAlerts({}, B).counts.total).toBe(0);
    expect(kpiService.getActiveAlerts({}, A).alerts.map(a => a.id)).toContain(alertaA.id);
  });

  test('el tenant B no puede reconocer la alerta de A', () => {
    expect(kpiService.acknowledgeAlert(alertaA.id, 'userB', B)).toEqual({ success: false, error: 'Alert not found' });
    expect(kpiService.getActiveAlerts({}, A).alerts[0].acknowledged).toBe(false);
  });

  test('el tenant B no puede descartar la alerta de A', () => {
    expect(kpiService.dismissAlert(alertaA.id, B)).toEqual({ success: false, error: 'Alert not found' });
    expect(kpiService.getActiveAlerts({}, A).alerts).toHaveLength(1);
  });

  test('A sí puede reconocer y descartar la suya', () => {
    expect(kpiService.acknowledgeAlert(alertaA.id, 'userA', A).success).toBe(true);
    expect(kpiService.dismissAlert(alertaA.id, A).success).toBe(true);
    expect(kpiService.getActiveAlerts({}, A).alerts).toEqual([]);
  });

  test('el histórico de A no es visible para B', () => {
    expect(kpiService.getKPIHistory('error_rate', 'last_30_days', A).history.length).toBeGreaterThan(0);
    expect(kpiService.getKPIHistory('error_rate', 'last_30_days', B).history).toEqual([]);
  });

  test('la alerta de B no pisa ni borra la de A', async () => {
    await provocarAlerta(B);
    await kpiService.calculateKPI('error_rate', { errorRate: 0.5 }, B); // B se recupera
    expect(kpiService.getActiveAlerts({}, B).alerts).toEqual([]);
    expect(kpiService.getActiveAlerts({}, A).alerts).toHaveLength(1);
  });

  test('el super admin de plataforma (undefined) ve las de todos y puede actuar sobre ellas', async () => {
    await provocarAlerta(B);
    expect(kpiService.getActiveAlerts({}, undefined).alerts).toHaveLength(2);
    expect(kpiService.getKPIHistory('error_rate', 'last_30_days', undefined).history.length).toBeGreaterThanOrEqual(2);
    expect(kpiService.acknowledgeAlert(alertaA.id, 'root', undefined).success).toBe(true);
    expect(kpiService.dismissAlert(alertaA.id, undefined).success).toBe(true);
  });

  test('sin tenant (null) no ve nada, ni siquiera lo de otros', () => {
    expect(kpiService.getActiveAlerts({}, null).alerts).toEqual([]);
    expect(kpiService.getKPIHistory('error_rate', 'last_30_days', null).history).toEqual([]);
    expect(kpiService.acknowledgeAlert(alertaA.id, 'x', null).success).toBe(false);
    expect(kpiService.dismissAlert(alertaA.id, null).success).toBe(false);
  });

  test('el dashboard de B no incluye alertas de A', async () => {
    const d = await kpiService.getKPIDashboard(B);
    expect(d.data.alerts.find(a => a.id === alertaA.id)).toBeUndefined();
  });
});
