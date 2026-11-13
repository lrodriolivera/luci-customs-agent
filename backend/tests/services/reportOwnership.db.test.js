/**
 * Los informes de analytics solo son accesibles para el tenant que los genero.
 *
 * reportsService guardaba los informes en un `new Map()` global, compartido por
 * todos los tenants del proceso, y se perdian en cada reinicio del contenedor.
 * El aislamiento dependia de comparar `generatedBy` (el usuario, no el tenant)
 * en codigo de aplicacion:
 *
 *     GET    /api/analytics/reports/:id
 *     GET    /api/analytics/reports/:id/download
 *     DELETE /api/analytics/reports/:id
 *
 * Ahora los informes persisten en Mongo (modelo Report, tenantId obligatorio)
 * y listar/ver/exportar/borrar filtran SIEMPRE por el tenant del usuario
 * autenticado (filtroTenantOPlataforma). El limite es el TENANT, no el
 * usuario individual que genero el informe: dos usuarios del mismo tenant ven
 * los mismos informes (es el comportamiento correcto para un equipo que
 * comparte cliente). super_admin de plataforma sin tenant ve todos.
 *
 * Los informes se alimentan de metricas reales del ambito, asi que la fuga
 * expondria operativa real: volumenes, aranceles liquidados e incidencias
 * del cliente.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

// Los informes leen metricas reales (Mongo): aqui solo importa el aislamiento
// por tenant, asi que las fuentes devuelven vacio.
jest.mock('../../src/services/analytics/realMetricsService', () => {
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

const reportsService = require('../../src/services/analytics/reportsService');

usarBaseDeDatosEnMemoria();

const nuevoId = () => new mongoose.Types.ObjectId();

/** Dos usuarios del mismo tenant (equipo que comparte cliente). */
function tenantConDosUsuarios() {
  const tenantId = String(nuevoId());
  return {
    tenantId,
    ana: { id: String(nuevoId()), tenantId, role: 'agent' },
    bruno: { id: String(nuevoId()), tenantId, role: 'agent' }
  };
}

function actorDeOtroTenant(role = 'agent') {
  return { id: String(nuevoId()), tenantId: String(nuevoId()), role };
}

function superAdminDePlataforma() {
  // Sin tenantId: filtroTenantOPlataforma no acota la consulta.
  return { id: String(nuevoId()), role: 'super_admin' };
}

/** Genera un informe atribuido a ese actor y devuelve su id. */
async function informeDe(actor) {
  const r = await reportsService.generateReport('executive_summary', {
    period: 'last_30_days',
    format: 'json',
    includeLuciAnalysis: false,
    userId: actor.id,
    tenantId: actor.tenantId
  });
  expect(r.success).toBe(true);
  return r.report.id;
}

describe('acceso a un informe de otro tenant', () => {
  let equipo;
  let idDeAna;

  beforeEach(async () => {
    equipo = tenantConDosUsuarios();
    idDeAna = await informeDe(equipo.ana);
  });

  test('su autora si puede leerlo', async () => {
    const r = await reportsService.getReport(idDeAna, equipo.ana);
    expect(r.success).toBe(true);
  });

  test('otro usuario DEL MISMO TENANT tambien puede leerlo (el limite es el tenant)', async () => {
    const r = await reportsService.getReport(idDeAna, equipo.bruno);
    expect(r.success).toBe(true);
    expect(r.report.id).toBe(idDeAna);
  });

  test('un usuario de OTRO tenant NO puede leerlo', async () => {
    const intruso = actorDeOtroTenant();
    const r = await reportsService.getReport(idDeAna, intruso);
    expect(r.success).toBe(false);
  });

  test('un usuario de otro tenant NO puede borrarlo', async () => {
    const intruso = actorDeOtroTenant();
    const r = await reportsService.deleteReport(idDeAna, intruso);

    expect(r.success).toBe(false);
    // Y sigue existiendo para su tenant.
    expect((await reportsService.getReport(idDeAna, equipo.ana)).success).toBe(true);
  });

  test('un usuario de otro tenant NO puede descargarlo', async () => {
    const intruso = actorDeOtroTenant();
    const r = await reportsService.exportReport(idDeAna, 'json', intruso);
    expect(r.success).toBe(false);
  });

  test('el mensaje no revela que el informe existe', async () => {
    // Distinguir "no existe" de "no es tuyo" confirmaria ids ajenos por sondeo.
    const intruso = actorDeOtroTenant();
    const ajeno = await reportsService.getReport(idDeAna, intruso);
    const inexistente = await reportsService.getReport(String(nuevoId()), intruso);

    expect(ajeno.error).toBe(inexistente.error);
  });

  test('un usuario del mismo tenant si puede borrarlo', async () => {
    const r = await reportsService.deleteReport(idDeAna, equipo.bruno);

    expect(r.success).toBe(true);
    expect((await reportsService.getReport(idDeAna, equipo.ana)).success).toBe(false);
  });
});

describe('listado de informes', () => {
  test('cada tenant ve solo los suyos', async () => {
    const equipoA = tenantConDosUsuarios();
    const equipoB = tenantConDosUsuarios();

    const deA = await informeDe(equipoA.ana);
    await informeDe(equipoB.ana);

    const lista = await reportsService.listReports({}, equipoA.bruno);
    const ids = (lista.reports || []).map(r => r.id);

    expect(ids).toContain(deA);
    expect(lista.reports.every(r => r.id !== undefined)).toBe(true);
    // Ningun informe de equipoB se filtra en la lista de equipoA.
    const listaB = await reportsService.listReports({}, equipoB.ana);
    expect(listaB.reports.map(r => r.id)).not.toContain(deA);
  });
});

describe('super_admin de plataforma', () => {
  test('ve informes de cualquier tenant (filtroTenantOPlataforma sin acotar)', async () => {
    const equipo = tenantConDosUsuarios();
    const id = await informeDe(equipo.ana);

    const admin = superAdminDePlataforma();
    const r = await reportsService.getReport(id, admin);
    expect(r.success).toBe(true);
  });

  test('el listado de super_admin incluye informes de distintos tenants', async () => {
    const equipoA = tenantConDosUsuarios();
    const equipoB = tenantConDosUsuarios();
    const idA = await informeDe(equipoA.ana);
    const idB = await informeDe(equipoB.ana);

    const admin = superAdminDePlataforma();
    const lista = await reportsService.listReports({}, admin);
    const ids = lista.reports.map(r => r.id);
    expect(ids).toContain(idA);
    expect(ids).toContain(idB);
  });

  test('un super_admin que SI tiene tenant propio queda acotado a ese tenant', async () => {
    const equipo = tenantConDosUsuarios();
    const idDeAna = await informeDe(equipo.ana);
    const otroEquipo = tenantConDosUsuarios();

    const adminConTenant = { id: String(nuevoId()), tenantId: otroEquipo.tenantId, role: 'super_admin' };
    const r = await reportsService.getReport(idDeAna, adminConTenant);
    expect(r.success).toBe(false);
  });
});

describe('generar un informe sin tenant concreto', () => {
  test('no genera (no hay donde guardarlo de forma acotada)', async () => {
    const r = await reportsService.generateReport('executive_summary', {
      period: 'last_30_days', format: 'json', includeLuciAnalysis: false,
      userId: String(nuevoId())
      // sin tenantId
    });
    expect(r.success).toBe(false);
  });
});
