/**
 * Adapta el cuadro de mando real (realMetricsService.cuadroDeMando) al contrato
 * que lee el panel de Analitica: { operations, financial, compliance, trends }.
 *
 * Funcion pura. Criterio de producto: lo que no tiene fuente es null (el
 * frontend lo pinta "Sin datos"), nunca 0 ni una cifra inventada.
 */

const { tasaRechazoH7, redondear1 } = require('./kpiDatos');
const realMetrics = require('./realMetricsService');

const MS_POR_DIA = 86400000;
const DIAS_POR_DEFECTO = 30;

const esNumero = (x) => typeof x === 'number' && Number.isFinite(x);

/** { direction, percentage } contra el periodo anterior; percentage null sin base. */
function _tendencia(actual, anterior) {
  if (!esNumero(actual) || !esNumero(anterior) || anterior === 0) {
    return { direction: 'stable', percentage: null };
  }
  const variacion = ((actual - anterior) / anterior) * 100;
  return {
    direction: variacion > 0 ? 'up' : variacion < 0 ? 'down' : 'stable',
    percentage: Math.abs(redondear1(variacion))
  };
}

/**
 * @param {object} cuadro cuadroDeMando del periodo
 * @param {object|null} cuadroAnterior cuadroDeMando del periodo anterior de la misma longitud
 * @param {{ activeExpeditions?: number|null }} [extra] expedientes activos (no dependen del periodo)
 */
function adaptarCuadro(cuadro, cuadroAnterior, { activeExpeditions = null } = {}) {
  const { declaraciones, derechos, tiempos, cumplimiento, recaudacion } = cuadro;
  const total = declaraciones?.total;

  return {
    operations: {
      totalDeclarations: total ?? null,
      declarationsByType: declaraciones?.porTipo ?? null,
      averageProcessingTime: tiempos?.muestra > 0 ? tiempos.mediaHoras : null,
      activeExpeditions
    },
    financial: {
      totalDutiesCalculated: derechos?.total ?? null,
      totalDutiesPaid: recaudacion?.disponible ? recaudacion.total : null,
      potentialSavings: null,
      guaranteesUtilization: null
    },
    compliance: {
      rejectionRate: tasaRechazoH7(declaraciones),
      inspectionRate: total > 0 && esNumero(cumplimiento?.inspecciones)
        ? redondear1((cumplimiento.inspecciones / total) * 100)
        : null,
      documentCompleteness: null,
      errorRate: null,
      onTimeSubmissions: null
    },
    trends: {
      operations: _tendencia(total, cuadroAnterior?.declaraciones?.total),
      financial: _tendencia(derechos?.total, cuadroAnterior?.derechos?.total),
      compliance: null
    },
    simulated: false,
    generadoEn: cuadro.generadoEn
  };
}

/** Periodo inmediatamente anterior, de la misma longitud. */
function periodoAnterior(desde, hasta) {
  const largo = hasta.getTime() - desde.getTime();
  return { desde: new Date(desde.getTime() - largo), hasta: new Date(desde.getTime()) };
}

const CUADRO_VACIO = Object.freeze({
  declaraciones: { total: 0, porTipo: { H7: 0, NCTS: 0, H1: 0, AES: 0 }, porEstado: {} },
  derechos: { total: 0 },
  tiempos: { muestra: 0, mediaHoras: null },
  cumplimiento: { inspecciones: 0 },
  recaudacion: { disponible: false }
});

/**
 * Panel de un ambito (ambitoTenant): undefined = plataforma, null = sin tenant
 * (no ve nada; realMetrics no filtra con null), string = ese tenant.
 * Sin fechas: ultimos 30 dias (la tendencia necesita un periodo acotado).
 */
async function panelDelAmbito(tenantId, { desde, hasta } = {}) {
  if (tenantId === null) {
    return adaptarCuadro({ ...CUADRO_VACIO, generadoEn: new Date().toISOString() }, null, {});
  }
  const fin = hasta ? new Date(hasta) : new Date();
  const ini = desde ? new Date(desde) : new Date(fin.getTime() - DIAS_POR_DEFECTO * MS_POR_DIA);
  const rango = { desde: ini, hasta: fin };

  const [cuadro, anterior, activos] = await Promise.all([
    realMetrics.cuadroDeMando(tenantId, rango),
    realMetrics.cuadroDeMando(tenantId, periodoAnterior(ini, fin)),
    realMetrics.expedientesActivos(tenantId)
  ]);
  return adaptarCuadro(cuadro, anterior, { activeExpeditions: activos });
}

module.exports = { adaptarCuadro, panelDelAmbito, periodoAnterior };
