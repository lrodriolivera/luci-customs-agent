/**
 * Metricas de analytics calculadas contra la base de datos.
 *
 * Sustituye a _generateMetricValue(min, max) de analyticsService, que devolvia
 * numeros aleatorios que la UI presentaba como analitica real: en produccion
 * decia 150-300 declaraciones cuando en la base de datos habia 35, y la cifra
 * cambiaba en cada recarga.
 *
 * Todo lo que este fichero devuelve sale de una agregacion. Lo que NO se puede
 * calcular hoy no se inventa ni se aproxima: se declara no disponible con un
 * motivo legible, y el controlador responde 501. Decision de Luis, 3/Ago/2026.
 *
 * Estado de los datos al escribirlo:
 *   35 h7declarations   con duties.totalDue e importes reales
 *   25 expeditions      con status y canal, pero goodsSummary.totalValue = 0
 *   15 transits, 20 inspections, 30 deadlines, 14 requirements, 12 guarantees
 *    0 payments         <- por eso no hay recaudacion cobrada
 *
 * Toda funcion acepta tenantId y acota por el. Sin tenantId no filtra, que es
 * lo que necesitan los informes de plataforma; los controladores siempre lo
 * pasan desde el token.
 */

const mongoose = require('mongoose');
const { H7Declaration, Expedition, Transit, Inspection, Requirement, Guarantee, Payment, User } = require('../../models');
const logger = require('../../config/logger');

/** Milisegundos en una hora, para los calculos de duracion. */
const MS_POR_HORA = 3600000;

/**
 * Motivos por los que una metrica no se puede calcular.
 * El controlador los devuelve tal cual en el 501: han de leerse sin contexto.
 */
const NO_DISPONIBLE = Object.freeze({
  SIN_PAGOS: 'No hay pagos registrados en el sistema: la recaudacion cobrada no se puede calcular',
  SIN_VALOR_MERCANCIA: 'Los expedientes no tienen valor de mercancia informado (goodsSummary.totalValue = 0)',
  SIN_HISTORICO: 'No hay suficiente historico para proyectar: se necesitan al menos 90 dias de datos',
  SIN_MODELO: 'No hay modelo entrenado: las predicciones requieren un historico del que aun no se dispone'
});

/**
 * Filtro base: acota por tenant y descarta borrados logicos.
 *
 * OJO con el tipo de tenantId. countDocuments() y find() castean la cadena a
 * ObjectId usando el esquema, pero aggregate() NO: su $match va contra el
 * documento crudo, de modo que un tenantId en cadena no casa con el ObjectId
 * almacenado y la agregacion devuelve vacio.
 *
 * Medido: countDocuments({tenantId: '6a57...'}) -> 35
 *         aggregate([{$match:{tenantId: '6a57...'}}]) -> 0
 *
 * Es un fallo especialmente traicionero aqui, porque un panel a cero se lee
 * como "no hay actividad" en vez de como un error. Se castea explicitamente.
 */
function _filtro(tenantId, extra = {}) {
  const f = { ...extra };
  if (tenantId) f.tenantId = _comoObjectId(tenantId);
  return f;
}

/** Convierte a ObjectId si la cadena lo es; si no, la deja tal cual. */
function _comoObjectId(valor) {
  if (valor instanceof mongoose.Types.ObjectId) return valor;
  const s = String(valor);
  return mongoose.Types.ObjectId.isValid(s) ? new mongoose.Types.ObjectId(s) : valor;
}

/** Filtro por rango de fechas sobre createdAt, si se indica. */
function _conRango(filtro, desde, hasta) {
  if (!desde && !hasta) return filtro;
  const r = {};
  if (desde) r.$gte = new Date(desde);
  if (hasta) r.$lte = new Date(hasta);
  return { ...filtro, createdAt: r };
}

/**
 * Volumen de declaraciones por tipo y estado.
 *
 * Solo cuenta los tipos que tienen coleccion propia. H1 y AES se generan desde
 * el expediente y no se persisten como declaracion aparte, asi que no aparecen:
 * mejor omitirlos que devolver un cero que se lea como "ninguna".
 */
async function volumenDeclaraciones(tenantId, { desde, hasta } = {}) {
  const filtro = _conRango(_filtro(tenantId, { deletedAt: null }), desde, hasta);

  const [h7, porEstado, transitos] = await Promise.all([
    H7Declaration.countDocuments(filtro),
    H7Declaration.aggregate([
      { $match: filtro },
      { $group: { _id: '$status', n: { $sum: 1 } } }
    ]),
    Transit.countDocuments(_conRango(_filtro(tenantId), desde, hasta))
  ]);

  const estados = Object.fromEntries(porEstado.map(e => [e._id || 'sin_estado', e.n]));

  return {
    total: h7 + transitos,
    porTipo: { H7: h7, NCTS: transitos },
    porEstado: estados,
    // Lo que se presenta como "aceptadas" en la UI: los estados terminales
    // favorables del ciclo AEAT.
    aceptadas: (estados.accepted || 0) + (estados.released || 0),
    pendientes: (estados.pending || 0) + (estados.validating || 0) + (estados.draft || 0)
  };
}

/**
 * Reparto de expedientes por canal aduanero.
 *
 * El canal vive en el status del expediente (green_channel, orange_channel,
 * red_channel). 'levante' implica que ya paso el canal y se despacho.
 */
async function repartoPorCanal(tenantId, { desde, hasta } = {}) {
  const filas = await Expedition.aggregate([
    { $match: _conRango(_filtro(tenantId, { deletedAt: null }), desde, hasta) },
    { $group: { _id: '$status', n: { $sum: 1 } } }
  ]);

  const porEstado = Object.fromEntries(filas.map(f => [f._id || 'sin_estado', f.n]));
  const canales = {
    green: porEstado.green_channel || 0,
    orange: porEstado.orange_channel || 0,
    red: porEstado.red_channel || 0,
    yellow: porEstado.yellow_channel || 0
  };
  const conCanal = Object.values(canales).reduce((a, b) => a + b, 0);

  return {
    canales,
    conCanalAsignado: conCanal,
    // El porcentaje se calcula sobre los que TIENEN canal, no sobre el total de
    // expedientes: incluir los que aun no han llegado a canal lo falsearia.
    porcentajes: conCanal === 0
      ? { green: 0, orange: 0, red: 0, yellow: 0 }
      : Object.fromEntries(
          Object.entries(canales).map(([k, v]) => [k, Math.round((v / conCanal) * 1000) / 10])
        )
  };
}

/**
 * Aranceles e IVA liquidados, sumados de las declaraciones H7.
 *
 * Es lo LIQUIDADO (calculado en la declaracion), no lo COBRADO: para saber lo
 * cobrado harian falta pagos, y no hay ninguno. Ver recaudacionCobrada().
 */
async function derechosLiquidados(tenantId, { desde, hasta } = {}) {
  const [r] = await H7Declaration.aggregate([
    { $match: _conRango(_filtro(tenantId, { deletedAt: null }), desde, hasta) },
    {
      $group: {
        _id: null,
        arancel: { $sum: '$duties.tariff.amount' },
        iva: { $sum: '$duties.vat.amount' },
        total: { $sum: '$duties.totalDue' },
        valorEnAduana: { $sum: '$totals.customsValue' },
        n: { $sum: 1 }
      }
    }
  ]);

  if (!r || r.n === 0) {
    return { declaraciones: 0, arancel: 0, iva: 0, total: 0, valorEnAduana: 0, medioPorDeclaracion: 0 };
  }

  const redondear = (x) => Math.round((x || 0) * 100) / 100;

  return {
    declaraciones: r.n,
    arancel: redondear(r.arancel),
    iva: redondear(r.iva),
    total: redondear(r.total),
    valorEnAduana: redondear(r.valorEnAduana),
    medioPorDeclaracion: redondear(r.total / r.n)
  };
}

/**
 * Tiempo medio de despacho: de la presentacion al levante.
 *
 * Solo entran las declaraciones con las dos marcas de tiempo. Devolver una
 * media sobre las que aun no tienen levante daria un numero optimista.
 */
async function tiemposDeDespacho(tenantId, { desde, hasta } = {}) {
  const filtro = _conRango(
    _filtro(tenantId, { deletedAt: null, submittedAt: { $ne: null }, releasedAt: { $ne: null } }),
    desde, hasta
  );

  const [r] = await H7Declaration.aggregate([
    { $match: filtro },
    { $project: { horas: { $divide: [{ $subtract: ['$releasedAt', '$submittedAt'] }, MS_POR_HORA] } } },
    {
      $group: {
        _id: null,
        media: { $avg: '$horas' },
        minimo: { $min: '$horas' },
        maximo: { $max: '$horas' },
        n: { $sum: 1 }
      }
    }
  ]);

  if (!r || r.n === 0) {
    return { muestra: 0, mediaHoras: null, minimoHoras: null, maximoHoras: null };
  }

  const h = (x) => Math.round(x * 10) / 10;

  return { muestra: r.n, mediaHoras: h(r.media), minimoHoras: h(r.minimo), maximoHoras: h(r.maximo) };
}

/**
 * Cumplimiento: inspecciones, requerimientos y garantias.
 */
async function cumplimiento(tenantId, { desde, hasta } = {}) {
  const rango = (extra) => _conRango(_filtro(tenantId, extra), desde, hasta);

  // Las garantias NO se aislan por tenantId sino por `owner` (un usuario):
  // conviven dos criterios de aislamiento en el producto segun el modulo.
  // Filtrarlas por tenantId devolveria 0 con 12 documentos en la base, que se
  // leeria como "este cliente no tiene garantias".
  const garantiasDeUsuarios = tenantId
    ? { owner: { $in: await _usuariosDelTenant(tenantId) } }
    : {};

  const [inspecciones, requerimientos, garantias, reqPendientes] = await Promise.all([
    Inspection.countDocuments(rango({})),
    Requirement.countDocuments(rango({})),
    Guarantee.countDocuments(_conRango(garantiasDeUsuarios, desde, hasta)),
    Requirement.countDocuments(rango({ status: { $in: ['pending', 'in_progress'] } }))
  ]);

  return {
    inspecciones,
    requerimientos,
    requerimientosPendientes: reqPendientes,
    garantias
  };
}

/** _ids de los usuarios de un tenant, para los modelos que aislan por `owner`. */
async function _usuariosDelTenant(tenantId) {
  const usuarios = await User.find({ tenantId: _comoObjectId(tenantId) }).select('_id').lean();
  return usuarios.map(u => u._id);
}

/**
 * Recaudacion efectivamente cobrada.
 *
 * NO CALCULABLE mientras no haya pagos. Se comprueba en tiempo de ejecucion en
 * vez de asumirlo: en cuanto se registre el primer pago, esto empieza a
 * devolver una cifra real sin tocar el codigo.
 */
async function recaudacionCobrada(tenantId, { desde, hasta } = {}) {
  const filtro = _conRango(_filtro(tenantId, { status: 'completed' }), desde, hasta);
  const n = await Payment.countDocuments(filtro);

  if (n === 0) {
    return { disponible: false, motivo: NO_DISPONIBLE.SIN_PAGOS };
  }

  const [r] = await Payment.aggregate([
    { $match: filtro },
    { $group: { _id: null, total: { $sum: '$amount' }, n: { $sum: 1 } } }
  ]);

  return {
    disponible: true,
    pagos: r.n,
    total: Math.round((r.total || 0) * 100) / 100
  };
}

/**
 * Valor total de la mercancia declarada en expedientes.
 *
 * NO CALCULABLE hoy: goodsSummary.totalValue esta a 0 en los 25 expedientes.
 * Igual que arriba, se comprueba en ejecucion y se activara solo.
 */
async function valorMercancia(tenantId, { desde, hasta } = {}) {
  const filtro = _conRango(
    _filtro(tenantId, { deletedAt: null, 'goodsSummary.totalValue': { $gt: 0 } }),
    desde, hasta
  );
  const n = await Expedition.countDocuments(filtro);

  if (n === 0) {
    return { disponible: false, motivo: NO_DISPONIBLE.SIN_VALOR_MERCANCIA };
  }

  const [r] = await Expedition.aggregate([
    { $match: filtro },
    { $group: { _id: null, total: { $sum: '$goodsSummary.totalValue' }, n: { $sum: 1 } } }
  ]);

  return { disponible: true, expedientes: r.n, total: Math.round((r.total || 0) * 100) / 100 };
}

/**
 * Cuadro de mando completo, solo con lo calculable.
 *
 * Las secciones no disponibles vienen con { disponible: false, motivo } en vez
 * de un numero: quien lo consuma no puede confundirlas con un dato.
 */
async function cuadroDeMando(tenantId, opciones = {}) {
  try {
    const [declaraciones, canales, derechos, tiempos, compl, recaudacion, valor] = await Promise.all([
      volumenDeclaraciones(tenantId, opciones),
      repartoPorCanal(tenantId, opciones),
      derechosLiquidados(tenantId, opciones),
      tiemposDeDespacho(tenantId, opciones),
      cumplimiento(tenantId, opciones),
      recaudacionCobrada(tenantId, opciones),
      valorMercancia(tenantId, opciones)
    ]);

    return {
      simulated: false,   // <- lo que este fichero existe para poder decir
      generadoEn: new Date().toISOString(),
      declaraciones,
      canales,
      derechos,
      tiempos,
      cumplimiento: compl,
      recaudacion,
      valorMercancia: valor
    };
  } catch (error) {
    logger.error(`[RealMetrics] Error calculando el cuadro de mando: ${error.message}`);
    throw error;
  }
}

module.exports = {
  NO_DISPONIBLE,
  volumenDeclaraciones,
  repartoPorCanal,
  derechosLiquidados,
  tiemposDeDespacho,
  cumplimiento,
  recaudacionCobrada,
  valorMercancia,
  cuadroDeMando
};
