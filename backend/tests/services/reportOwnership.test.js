/**
 * Los informes de analytics solo son accesibles para quien los genero.
 *
 * reportsService guarda los informes en un `new Map()` global, compartido por
 * todos los tenants del proceso. listReports SI filtraba por generatedBy, pero
 * los tres accesos por id no comprobaban nada:
 *
 *     GET    /api/analytics/reports/:id
 *     GET    /api/analytics/reports/:id/download
 *     DELETE /api/analytics/reports/:id
 *
 * Es la asimetria clasica: el listado esta acotado, de modo que un cliente solo
 * ve los suyos, pero conociendo el id -- que es un identificador secuencial con
 * marca de tiempo, no un secreto -- podia leer, descargar o BORRAR el informe
 * de cualquier otro.
 *
 * Hoy los informes se alimentan del dashboard, cuyas metricas son simuladas
 * (ver el flag `simulated` de 7a084e4), asi que la fuga no expone operativa
 * real todavia. Cuando esas agregaciones sean reales, estos informes llevaran
 * volumenes, aranceles liquidados e incidencias del cliente.
 */

const reportsService = require('../../src/services/analytics/reportsService');

const ANA = 'usuario-ana';
const BRUNO = 'usuario-bruno';

/** Genera un informe atribuido a ese usuario y devuelve su id. */
async function informeDe(userId) {
  const r = await reportsService.generateReport('executive_summary', {
    period: 'month',
    format: 'json',
    includeLuciAnalysis: false,
    userId
  });
  return r.report?.id || r.reportId;
}

describe('acceso a un informe ajeno', () => {
  let idDeAna;

  beforeAll(async () => {
    idDeAna = await informeDe(ANA);
    expect(idDeAna).toBeTruthy();
  });

  test('su autor si puede leerlo', () => {
    const r = reportsService.getReport(idDeAna, ANA);

    expect(r.success).toBe(true);
  });

  test('otro usuario NO puede leerlo', () => {
    const r = reportsService.getReport(idDeAna, BRUNO);

    expect(r.success).toBe(false);
  });

  test('otro usuario NO puede borrarlo', () => {
    const r = reportsService.deleteReport(idDeAna, BRUNO);

    expect(r.success).toBe(false);
    // Y sigue existiendo para su dueno.
    expect(reportsService.getReport(idDeAna, ANA).success).toBe(true);
  });

  test('el mensaje no revela que el informe existe', () => {
    // Distinguir "no existe" de "no es tuyo" confirma ids ajenos por sondeo.
    const ajeno = reportsService.getReport(idDeAna, BRUNO);
    const inexistente = reportsService.getReport('report-que-no-existe', BRUNO);

    expect(ajeno.error).toBe(inexistente.error);
  });

  test('su autor si puede borrarlo', () => {
    const r = reportsService.deleteReport(idDeAna, ANA);

    expect(r.success).toBe(true);
    expect(reportsService.getReport(idDeAna, ANA).success).toBe(false);
  });
});

describe('listado de informes', () => {
  test('cada usuario ve solo los suyos', async () => {
    const deAna = await informeDe(ANA);
    await informeDe(BRUNO);

    const lista = reportsService.listReports({ userId: ANA });
    const ids = (lista.reports || []).map(r => r.id);

    expect(ids).toContain(deAna);
    expect(lista.reports.every(r => r.generatedBy === ANA)).toBe(true);
  });
});

describe('llamadas sin userId', () => {
  test('no rompen el acceso a informes del sistema', async () => {
    // Los informes programados se generan con generatedBy 'system'. Un userId
    // ausente no debe bloquearlos ni, al reves, abrir los de todos.
    const id = await reportsService.generateReport('executive_summary', {
      period: 'month', format: 'json', includeLuciAnalysis: false
    }).then(r => r.report?.id || r.reportId);

    expect(reportsService.getReport(id).success).toBe(true);
  });
});
