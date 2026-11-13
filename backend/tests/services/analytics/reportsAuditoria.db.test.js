/**
 * El informe "Trazabilidad de Auditoria" (_getAuditLogs) devolvia siempre
 * { actions: [], users: [], changes: [] }: relleno fijo, nunca datos reales.
 * Ahora lee auditService.query (que respalda el modelo AuditLog real),
 * acotado al tenant y al periodo del informe, con un limite y sin campos
 * sensibles (ip, user-agent, cabeceras...).
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../../helpers/memoryDb');

jest.mock('../../../src/services/analytics/realMetricsService', () => {
  const vacio = {
    simulated: false,
    generadoEn: new Date().toISOString(),
    declaraciones: { total: 0, porTipo: {}, porEstado: {} },
    derechos: { total: 0 },
    tiempos: { muestra: 0, mediaHoras: null },
    cumplimiento: { inspecciones: 0 },
    recaudacion: { disponible: false }
  };
  return {
    NO_DISPONIBLE: {},
    cuadroDeMando: () => Promise.resolve(vacio),
    expedientesActivos: () => Promise.resolve(0),
    volumenDeclaraciones: () => Promise.resolve({ total: 0, porTipo: {}, porEstado: {} }),
    repartoPorCanal: () => Promise.resolve({ conCanalAsignado: 0, porcentajes: {} }),
    derechosLiquidados: () => Promise.resolve({ total: 0 }),
    valorMercancia: () => Promise.resolve({ disponible: false })
  };
});
jest.mock('../../../src/services/aiService', () => ({ generateExecutiveReport: jest.fn().mockResolvedValue({ summary: 'ok' }) }));

const { AuditLog } = require('../../../src/models');
const reportsService = require('../../../src/services/analytics/reportsService');

usarBaseDeDatosEnMemoria();

const nuevoId = () => new mongoose.Types.ObjectId();

/** Genera el informe audit_trail de ese tenant y devuelve la seccion de auditoria. */
async function generarInformeAuditoria(actor, extra = {}) {
  const r = await reportsService.generateReport('audit_trail', {
    userId: actor.id,
    tenantId: actor.tenantId,
    period: 'last_30_days',
    includeLuciAnalysis: false,
    ...extra
  });
  expect(r.success).toBe(true);
  const leido = await reportsService.getReport(r.report.id, actor);
  return leido.report.sections;
}

describe('informe de auditoria: datos reales del tenant y periodo', () => {
  test('sin entradas de auditoria, las secciones dicen "Sin datos" (no inventan)', async () => {
    const actor = { id: String(nuevoId()), tenantId: String(nuevoId()) };
    const secciones = await generarInformeAuditoria(actor);
    expect(secciones.actions).toEqual({ estado: 'Sin datos' });
    expect(secciones.users).toEqual({ estado: 'Sin datos' });
    expect(secciones.changes).toEqual({ estado: 'Sin datos' });
  });

  test('refleja entradas reales del tenant, sin campos sensibles', async () => {
    const tenantId = nuevoId();
    const actor = { id: String(nuevoId()), tenantId: String(tenantId) };

    await AuditLog.create({
      tenantId,
      userId: new mongoose.Types.ObjectId(),
      userEmail: 'ana@cliente.com',
      action: 'update',
      resource: 'Expedition',
      resourceId: 'EXP-1',
      method: 'PUT',
      url: '/api/v1/expeditions/EXP-1',
      ip: '10.0.0.1',
      userAgent: 'Mozilla/5.0 agente-secreto',
      changes: { antes: { estado: 'abierto' }, despues: { estado: 'cerrado' } },
      success: true,
      timestamp: new Date()
    });

    const secciones = await generarInformeAuditoria(actor);

    expect(Array.isArray(secciones.actions)).toBe(true);
    expect(secciones.actions).toHaveLength(1);
    expect(secciones.actions[0]).toMatchObject({
      accion: 'update',
      recurso: 'Expedition',
      recursoId: 'EXP-1',
      usuario: 'ana@cliente.com',
      exito: true
    });
    // Nunca ip, user-agent, metodo o url: no son necesarios para un informe de
    // lectura y son datos sensibles de la peticion.
    const planoJson = JSON.stringify(secciones.actions[0]);
    expect(planoJson).not.toMatch(/10\.0\.0\.1|agente-secreto|PUT|expeditions/);

    expect(secciones.users).toEqual([{ usuario: 'ana@cliente.com', total: 1 }]);

    expect(secciones.changes).toHaveLength(1);
    expect(secciones.changes[0].cambios).toEqual({ antes: { estado: 'abierto' }, despues: { estado: 'cerrado' } });
  });

  test('NO mezcla auditoria de otro tenant', async () => {
    const tenantId = nuevoId();
    const otroTenant = nuevoId();
    const actor = { id: String(nuevoId()), tenantId: String(tenantId) };

    await AuditLog.create({
      tenantId: otroTenant,
      action: 'delete',
      resource: 'H7Declaration',
      timestamp: new Date()
    });

    const secciones = await generarInformeAuditoria(actor);
    expect(secciones.actions).toEqual({ estado: 'Sin datos' });
  });

  test('NO incluye entradas fuera del periodo del informe', async () => {
    const tenantId = nuevoId();
    const actor = { id: String(nuevoId()), tenantId: String(tenantId) };
    const haceSesentaDias = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    await AuditLog.create({
      tenantId,
      action: 'login',
      resource: 'User',
      timestamp: haceSesentaDias
    });

    const secciones = await generarInformeAuditoria(actor); // period: last_30_days
    expect(secciones.actions).toEqual({ estado: 'Sin datos' });
  });

  test('respeta un limite de entradas (no vuelca la auditoria entera en el informe)', async () => {
    const tenantId = nuevoId();
    const actor = { id: String(nuevoId()), tenantId: String(tenantId) };

    const entradas = Array.from({ length: 510 }, (_, i) => ({
      tenantId,
      action: 'read',
      resource: 'TaricCode',
      resourceId: `T-${i}`,
      timestamp: new Date()
    }));
    await AuditLog.insertMany(entradas);

    const secciones = await generarInformeAuditoria(actor);
    expect(secciones.actions.length).toBeLessThanOrEqual(500);
  });
});
