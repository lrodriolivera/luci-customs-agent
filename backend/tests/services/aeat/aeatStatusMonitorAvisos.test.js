/**
 * Avisos de la bandeja AES sobre el seguimiento del monitor: el estado que
 * trae el aviso pasa al seguimiento del tenant y, con la salida confirmada
 * (SA) o parada (ST), el seguimiento queda final y la consulta automática
 * deja de preguntar por él.
 */
jest.mock('../../../src/services/cacheService', () => ({ getRedisClient: jest.fn().mockReturnValue(null) }));
jest.mock('../../../src/services/analytics/predictionsService', () => ({ predictChannel: jest.fn() }));
jest.mock('../../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../../src/services/aiService', () => ({ analyzeWithLuci: jest.fn().mockResolvedValue({}) }));
jest.mock('../../../src/services/aeat/aeatRealService', () => ({
  puedeConsultarEstado: jest.fn(() => true),
  queryDeclarationStatus: jest.fn().mockResolvedValue({ success: false, error: 'no debe consultarse' })
}));

const monitor = require('../../../src/services/aeat/aeatStatusMonitorService');
const aeatRealService = require('../../../src/services/aeat/aeatRealService');

const MRN = '26ES002801100319B6';
const TENANT = '65a000000000000000000001';

beforeEach(async () => {
  // resetMocks (jest.config) borra las implementaciones de los mocks.
  aeatRealService.puedeConsultarEstado.mockReturnValue(true);
  aeatRealService.queryDeclarationStatus.mockResolvedValue({ success: false, error: 'consulta' });
  await monitor.trackedDeclarations.clear();
  monitor._delay = () => Promise.resolve();
});

describe('aplicarAvisoBandeja', () => {
  test('salida efectiva (SA): seguimiento RELEASED y final; la consulta automática lo omite', async () => {
    await monitor.trackDeclaration(MRN, { declarationType: 'AES', tenantId: TENANT });
    const ok = await monitor.aplicarAvisoBandeja({ mrn: MRN, tenantId: TENANT, tipo: 'CSALID', estado: 'SA', fecha: '2026-11-16' });
    expect(ok).toBe(true);
    const t = await monitor.getTrackedDeclaration(MRN, TENANT);
    expect(t.currentStatus).toBe('RELEASED');
    expect(t.aeat).toMatchObject({ estado: 'SA', final: true, fuente: 'bandeja' });
    expect(t.statusHistory.at(-1).messages[0]).toContain('Resultado de la salida');

    const r = await monitor.pollOnce({ limite: 10 });
    expect(r).toMatchObject({ consultadas: 0, omitidas: 1 });
    expect(aeatRealService.queryDeclarationStatus).not.toHaveBeenCalled();
  });

  test('levante en salida (PS) no es final: sigue consultándose', async () => {
    await monitor.trackDeclaration(MRN, { declarationType: 'AES', tenantId: TENANT });
    await monitor.aplicarAvisoBandeja({ mrn: MRN, tenantId: TENANT, tipo: 'CLEVSA', estado: 'PS' });
    const t = await monitor.getTrackedDeclaration(MRN, TENANT);
    expect(t.aeat).toMatchObject({ estado: 'PS', final: false });
    expect((await monitor.pollOnce({ limite: 10 })).consultadas).toBe(1);
  });

  test('un aviso no final no deshace un estado final', async () => {
    await monitor.trackDeclaration(MRN, { declarationType: 'AES', tenantId: TENANT });
    await monitor.aplicarAvisoBandeja({ mrn: MRN, tenantId: TENANT, tipo: 'CSALID', estado: 'SA' });
    await monitor.aplicarAvisoBandeja({ mrn: MRN, tenantId: TENANT, tipo: 'CLEVSA', estado: 'PS' });
    expect((await monitor.getTrackedDeclaration(MRN, TENANT)).aeat).toMatchObject({ estado: 'SA', final: true });
  });

  test('solo toca el seguimiento del tenant del aviso', async () => {
    await monitor.trackDeclaration(MRN, { declarationType: 'AES', tenantId: 'otro-tenant' });
    expect(await monitor.aplicarAvisoBandeja({ mrn: MRN, tenantId: TENANT, tipo: 'CSALID', estado: 'SA' })).toBe(false);
    expect((await monitor.getTrackedDeclaration(MRN, 'otro-tenant')).aeat).toBeUndefined();
  });
});
