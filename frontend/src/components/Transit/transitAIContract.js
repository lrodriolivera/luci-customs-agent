/**
 * Normalizacion de las respuestas del panel "Analisis IA" de transitos.
 *
 * E2E 8/Ago/2026: el JSX de TransitAIPanel leia un contrato que el backend no
 * devuelve en ninguna de las cuatro pestanas. Cuatro discrepancias, todas
 * silenciosas (sin error de consola, sin toast: casillas vacias o datos falsos):
 *
 *  1. Validar Ruta      -> el veredicto viene en `routeValidation.isValid` y las
 *                          incidencias en `routeValidation.issues`; el JSX leia
 *                          `isValid` / `checkpoints` / `warnings` en la raiz.
 *  2. Predecir Incidencias -> `riskLevel` llega en MAYUSCULAS ('HIGH') y el JSX
 *                          comparaba con 'high'. Un riesgo alto caia al `else` y
 *                          se pintaba "Riesgo Bajo" sobre fondo verde. Ademas
 *                          `probability` es 0-100, no 0-1: multiplicar por 100
 *                          daba 4500%.
 *  3. Sugerir Garantia  -> el importe esta en `calculatedAmount.finalAmount`; el
 *                          JSX leia `amount`, asi que mostraba "0 EUR" para una
 *                          garantia obligatoria.
 *  4. Analisis Completo -> `summary` es un OBJETO
 *                          ({readinessScore, readinessLevel, factors, ...}) y el
 *                          JSX lo renderizaba como texto: React lanza
 *                          "Objects are not valid as a React child" y tumba el
 *                          modal entero.
 *
 * Se normaliza aqui, fuera del componente, para que los tests puedan fijar el
 * contrato sin montar el arbol de React y para no repetir los `??` por el JSX.
 */

/** Escala 0-100 a partir de un valor que puede venir 0-1 o 0-100. */
export function aPorcentaje(valor) {
  if (typeof valor !== 'number' || Number.isNaN(valor)) return null
  return valor <= 1 ? Math.round(valor * 100) : Math.round(valor)
}

const NIVELES_RIESGO = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'high'
}

/**
 * Homogeneiza el nivel de riesgo a minusculas. AEAT/LUCI lo emiten en
 * mayusculas y CRITICAL no tiene color propio en la UI: se trata como alto.
 */
export function nivelRiesgo(valor) {
  if (typeof valor !== 'string') return 'low'
  return NIVELES_RIESGO[valor.toUpperCase()] || valor.toLowerCase()
}

export const ETIQUETA_RIESGO = { high: 'Alto', medium: 'Medio', low: 'Bajo' }

const ETIQUETA_PREPARACION = {
  READY: 'Listo para presentar',
  ALMOST_READY: 'Casi listo',
  NEEDS_WORK: 'Requiere trabajo',
  NOT_READY: 'No preparado'
}

export const etiquetaPreparacion = (nivel) => ETIQUETA_PREPARACION[nivel] || nivel || ''

/** Formatea importes en euros sin inventar un 0 cuando el dato no existe. */
export function importeEUR(valor) {
  if (typeof valor !== 'number' || Number.isNaN(valor)) return null
  return `${valor.toLocaleString('es-ES')} EUR`
}

/**
 * Una incidencia de ruta segun el esquema del prompt es
 * {type, description, affectedSegment, recommendation}, pero el modelo devuelve
 * cadenas sueltas con cierta frecuencia. Leerlas como objeto las hacia
 * desaparecer: ruta "con problemas" y ni un problema en pantalla.
 */
function normalizarIncidenciaRuta(inc) {
  if (typeof inc === 'string') {
    return { tipo: 'warning', descripcion: inc, segmento: null, recomendacion: null }
  }
  if (!inc || typeof inc !== 'object') return null
  return {
    tipo: inc.type || 'info',
    descripcion: inc.description || '',
    segmento: inc.affectedSegment || null,
    recomendacion: inc.recommendation || null
  }
}

/**
 * Validar Ruta: `validateTransitRoute` anida el veredicto un nivel y llama
 * `issues` a lo que la UI presentaba como warnings + recommendations.
 */
export function normalizarValidacionRuta(data) {
  if (!data) return null
  const veredicto = data.routeValidation || {}
  const analisis = data.routeAnalysis || {}
  const incidencias = (Array.isArray(veredicto.issues) ? veredicto.issues : []).map(normalizarIncidenciaRuta)

  return {
    // Tercer estado. `esValida: false` significa "la aduana rechazaria esta
    // ruta"; cuando el analisis no se ha podido hacer eso es una afirmacion que
    // nadie ha calculado. Medido en vivo: 1 de cada 4 validaciones se cortaba
    // por limite de tokens y salia como ruta invalida; al reintentar, sin
    // cambiar un dato, salia valida.
    fallo: data.analysisFailed === true || veredicto.isValid === null,
    esValida: veredicto.isValid === true,
    incidencias: incidencias.filter(Boolean),
    analisis: {
      distancia: analisis.totalDistance || null,
      dias: analisis.estimatedTransitDays ?? null,
      fronteras: Array.isArray(analisis.borderCrossings) ? analisis.borderCrossings : [],
      restricciones: Array.isArray(analisis.restrictions) ? analisis.restrictions : []
    },
    aduanasSugeridas: Array.isArray(data.transitOfficesSuggestion) ? data.transitOfficesSuggestion : [],
    plazos: data.deadlineCalculation || null,
    recomendaciones: Array.isArray(data.recommendations) ? data.recommendations : [],
    riesgo: nivelRiesgo(data.riskLevel)
  }
}

/**
 * Predecir Incidencias: mayusculas en riskLevel/impact y probabilidades 0-100.
 */
export function normalizarPrediccionIncidencias(data) {
  if (!data) return null
  const predicciones = Array.isArray(data.incidentPredictions) ? data.incidentPredictions : []

  return {
    riesgo: nivelRiesgo(data.riskLevel),
    score: typeof data.overallRiskScore === 'number' ? data.overallRiskScore : null,
    incidencias: predicciones.map(i => ({
      tipo: i.type || '',
      gravedad: nivelRiesgo(i.impact),
      probabilidad: aPorcentaje(i.probability),
      descripcion: i.description || '',
      etapa: i.stage || '',
      retraso: i.potentialDelay || '',
      medidas: Array.isArray(i.preventiveMeasures) ? i.preventiveMeasures : []
    })),
    // El backend da la probabilidad de control por etapa, no una tasa historica.
    probabilidadControl: data.controlProbability || null,
    riesgoBusqueda: data.enquiryRisk || null,
    // `recommendations` aqui son objetos {priority, action, reason}, no cadenas.
    recomendaciones: (Array.isArray(data.recommendations) ? data.recommendations : []).map(r =>
      typeof r === 'string'
        ? { prioridad: 'medium', accion: r, motivo: '' }
        : { prioridad: nivelRiesgo(r.priority), accion: r.action || '', motivo: r.reason || '' }
    )
  }
}

/**
 * Sugerir Garantia: el importe vive en calculatedAmount.finalAmount y las
 * alternativas usan `name`/`estimatedCost`, no `type`/`amount`.
 */
export function normalizarSugerenciaGarantia(data) {
  if (!data) return null
  const calculo = data.calculatedAmount || {}
  const global = data.globalGuaranteeAnalysis || null

  return {
    tipo: data.recommendedType?.name || null,
    codigoTipo: data.recommendedType?.code || null,
    motivo: data.recommendedType?.reason || null,
    requisitos: Array.isArray(data.recommendedType?.requirements) ? data.recommendedType.requirements : [],
    importe: typeof calculo.finalAmount === 'number' ? calculo.finalAmount : null,
    calculo: {
      base: typeof calculo.baseAmount === 'number' ? calculo.baseAmount : null,
      reduccion: typeof calculo.reductionPercentage === 'number' ? calculo.reductionPercentage : null,
      motivoReduccion: calculo.reductionReason || null,
      desglose: calculo.breakdown || null
    },
    alternativas: (Array.isArray(data.alternatives) ? data.alternatives : []).map(a => ({
      nombre: a.name || a.code || '',
      idoneidad: typeof a.suitability === 'number' ? a.suitability : null,
      coste: typeof a.estimatedCost === 'number' ? a.estimatedCost : null,
      plazo: a.processingTime || '',
      notas: a.notes || ''
    })),
    garantiaGlobal: global && {
      puedeUsarla: global.canUseExisting === true,
      disponible: global.availableAmount,
      consumiria: global.wouldBeConsumed,
      restaria: global.remainingAfter,
      recomendacion: global.recommendation || ''
    },
    recomendaciones: Array.isArray(data.recommendations) ? data.recommendations : [],
    avisos: Array.isArray(data.warnings) ? data.warnings : []
  }
}

/**
 * Autocompletar con IA (POST /api/transit/ai/auto-complete).
 *
 * El JSX del formulario leia `summary` y `suggestions`, dos campos que este
 * endpoint no devuelve: media pantalla del panel quedaba en blanco. Los campos
 * reales son `fieldsCompleted` (lo que la IA dio por bueno) y
 * `fieldsRequiringConfirmation` (lo que rellena a ojo y hay que revisar); el
 * segundo no se pintaba en ningun sitio, asi que "Aplicar Sugerencias" metia
 * valores sin confirmar en el formulario como si estuvieran verificados.
 */
export function normalizarAutocompletado(data) {
  if (!data) return null
  const sugeridos = data.suggestedData && typeof data.suggestedData === 'object' ? data.suggestedData : {}

  return {
    datos: sugeridos,
    completados: Array.isArray(data.fieldsCompleted) ? data.fieldsCompleted.filter(Boolean) : [],
    porConfirmar: (Array.isArray(data.fieldsRequiringConfirmation) ? data.fieldsRequiringConfirmation : [])
      .filter(c => c && typeof c === 'object')
      .map(c => ({ campo: c.field || '', valor: c.suggestedValue ?? null, motivo: c.reason || '' })),
    avisos: Array.isArray(data.warnings) ? data.warnings : [],
    // Este endpoint documenta la confianza en 0-100, no 0-1: aqui no se
    // reescala (un 1 es un 1%, no un 100%), solo se acota.
    confianza: typeof data.confidence === 'number' && !Number.isNaN(data.confidence)
      ? Math.min(100, Math.max(0, Math.round(data.confidence)))
      : null,
    modelo: data.model || null
  }
}

/**
 * Aplica la sugerencia sobre los datos del formulario descartando lo que la IA
 * no pudo inferir.
 *
 * `applySuggestion` hacia un spread plano de `suggestedData`, y el backend
 * devuelve `null` en cada campo que no deduce y `[]` en las listas vacias. Dos
 * danos: `principal.eori: null` dejaba un input controlado sin `value` (React
 * avisa y el campo requerido se quedaba en blanco), y `goodsItems: []` borraba
 * las partidas que el usuario ya habia escrito a mano — sin partidas AEAT
 * rechaza el IE015 con el patron de <ent:grossMass>.
 */
export function mezclarSugerencia(actual, sugerido) {
  if (!sugerido || typeof sugerido !== 'object' || Array.isArray(sugerido)) return actual
  const base = actual && typeof actual === 'object' && !Array.isArray(actual) ? actual : {}

  return Object.entries(sugerido).reduce((acc, [clave, valor]) => {
    if (valor === null || valor === undefined || valor === '') return acc
    if (Array.isArray(valor)) return valor.length ? { ...acc, [clave]: valor } : acc
    if (typeof valor === 'object') return { ...acc, [clave]: mezclarSugerencia(acc[clave], valor) }
    return { ...acc, [clave]: valor }
  }, { ...base })
}

/**
 * Analisis Completo: `summary` es un objeto, no un texto, y los proximos pasos
 * se llaman `nextSteps` (con `priority` numerico 1..n, no 'high'/'low').
 */
export function normalizarAnalisisCompleto(data) {
  if (!data) return null
  const resumen = data.summary || {}

  return {
    puntuacion: typeof resumen.readinessScore === 'number' ? resumen.readinessScore : null,
    nivel: resumen.readinessLevel || null,
    factores: Array.isArray(resumen.factors) ? resumen.factors : [],
    riesgoGlobal: nivelRiesgo(resumen.overallRiskLevel),
    diasEstimados: resumen.estimatedTransitDays ?? null,
    garantiaRequerida: typeof resumen.guaranteeRequired === 'number' ? resumen.guaranteeRequired : null,
    validacionRuta: normalizarValidacionRuta(data.routeValidation),
    prediccionIncidencias: normalizarPrediccionIncidencias(data.incidentPrediction),
    sugerenciaGarantia: normalizarSugerenciaGarantia(data.guaranteeSuggestion),
    proximosPasos: (Array.isArray(data.nextSteps) ? data.nextSteps : []).map(p => ({
      prioridad: p.priority ?? null,
      accion: p.action || '',
      detalle: p.details || '',
      categoria: p.category || ''
    })),
    analizadoEn: data.analyzedAt || null
  }
}
