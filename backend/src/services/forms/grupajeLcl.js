/**
 * Regla del grupaje maritimo (LCL) antes de generar o presentar el H1.
 *
 * En un grupaje el contenedor lleva mercancia de varios importadores. La
 * naviera da de alta una declaracion sumaria por el contenedor completo; solo
 * despues de vaciarlo en el almacen de deposito temporal (ADT) existe la
 * sumaria de la desconsolidacion, con los bultos y los kilos de cada partida.
 * El H1 tiene que apoyarse en esa, nunca en la del contenedor completo, y no
 * hay excepcion aunque lo valide el agente (criterio de la agente de aduanas
 * en la UAT del 10/Nov/2026).
 *
 * LUCI no puede consultar la sumaria en la AEAT: lo que comprueba es que el
 * agente ha registrado una sumaria y que sus bultos y kilos son los del
 * expediente. Una sumaria con los totales del contenedor no cuadra y bloquea.
 *
 * Solo aplica si el expediente esta marcado como LCL: sin marca no se afirma
 * ni se bloquea nada.
 */
const { ErrorValidacion } = require('./identificadorAduanero');

const TIPO_CARGA_GRUPAJE = 'LCL';
// La sumaria y el expediente pueden diferir en el redondeo del peso, no en mas.
const TOLERANCIA_PESO_KG = 1;
const TOLERANCIA_PESO_RELATIVA = 0.01;

const CODIGO_ERROR = 'GRUPAJE_SUMARIA';

const esGrupaje = (expedition) => expedition?.transport?.loadType === TIPO_CARGA_GRUPAJE;

const numero = (valor) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
};

const pesoCuadra = (pesoSumaria, pesoExpediente) => {
  const diferencia = Math.abs(pesoSumaria - pesoExpediente);
  return diferencia <= Math.max(TOLERANCIA_PESO_KG, pesoExpediente * TOLERANCIA_PESO_RELATIVA);
};

/**
 * Motivo por el que el H1 no puede seguir, o null si puede.
 *
 * @param {object} expedition
 * @returns {string|null}
 */
const bloqueoPorGrupaje = (expedition) => {
  if (!esGrupaje(expedition)) return null;

  const sumaria = expedition.transport.summaryDeclaration || {};
  const ref = expedition.expeditionId || expedition._id || 'sin identificar';
  const prefijo = `El expediente ${ref} es un grupaje maritimo (LCL)`;

  if (!String(sumaria.number || '').trim()) {
    return `${prefijo}: falta la declaracion sumaria de la desconsolidacion. ` +
      'Hay que esperar a que el contenedor se vacie en el almacen de deposito temporal y a recibir ' +
      'la sumaria con los bultos y los kilos de esta partida. La sumaria del contenedor completo no sirve para el H1.';
  }

  const bultosSumaria = numero(sumaria.packages);
  const pesoSumaria = numero(sumaria.grossWeight);
  if (!(bultosSumaria > 0) || !(pesoSumaria > 0)) {
    return `${prefijo}: registra los bultos y el peso bruto que figuran en la declaracion sumaria ` +
      `${sumaria.number} para comprobar que es la de esta partida y no la del contenedor completo.`;
  }

  const bultosExpediente = numero(expedition.goodsSummary?.totalPackages) || 0;
  const pesoExpediente = numero(expedition.goodsSummary?.totalGrossWeight) || 0;

  if (bultosSumaria !== bultosExpediente || !pesoCuadra(pesoSumaria, pesoExpediente)) {
    return `${prefijo} y la declaracion sumaria ${sumaria.number} no corresponde a esta partida: ` +
      `declara ${bultosSumaria} bultos y ${pesoSumaria} kg, y el expediente ${bultosExpediente} bultos y ${pesoExpediente} kg. ` +
      'Si es la sumaria del contenedor completo no se puede usar: hace falta la de la desconsolidacion.';
  }

  return null;
};

/** Lanza ErrorValidacion (422) si el grupaje impide seguir con el H1. */
const exigirSumariaDeGrupaje = (expedition) => {
  const motivo = bloqueoPorGrupaje(expedition);
  if (!motivo) return;
  throw new ErrorValidacion(motivo, { code: CODIGO_ERROR });
};

// ---- Contraste con la AEAT ---------------------------------------------------

const { referenciaDeSumaria } = require('../aeat/dsdtConsXmlBuilder');

const totalesDe = (expedition) => ({
  bultos: numero(expedition?.goodsSummary?.totalPackages) || 0,
  peso: numero(expedition?.goodsSummary?.totalGrossWeight) || 0
});

// En el entorno de pruebas de la AEAT no existen las sumarias reales de los
// operadores: una sumaria de verdad sale siempre como no encontrada.
const ENTORNO_PREPRODUCCION = 'PRE.AEAT';
const avisoPreproduccion = (respuesta) => (respuesta.entorno === ENTORNO_PREPRODUCCION
  ? ' LUCI esta consultando el entorno de pruebas de la AEAT, donde no existen las sumarias reales: usa una sumaria de prueba.'
  : '');

/** Lo que se guarda en el expediente de la respuesta de la AEAT. */
const instantaneaDe = (respuesta, partida) => ({
  consultedAt: new Date(),
  verified: true,
  environment: respuesta.entorno || null,
  clave: respuesta.dsdt?.clave || null,
  mrn: respuesta.dsdt?.mrn || null,
  activated: respuesta.dsdt ? respuesta.dsdt.activada : null,
  itemStatus: partida?.estado || null,
  itemStatusText: partida?.estadoDescripcion || null,
  isMaster: partida ? partida.esMaster : null,
  packages: partida?.bultosDeclarados ?? null,
  grossWeight: partida?.pesoBrutoDeclarado ?? null,
  packagesBalance: partida?.bultosSaldo ?? null,
  grossWeightBalance: partida?.pesoBrutoSaldo ?? null,
  billOfLading: partida?.conocimiento || null,
  location: partida?.ubicaciones?.[0]?.ubicacion || null,
  error: null
});

/**
 * Decide con la respuesta de la AEAT si la sumaria sirve para el H1 de un
 * grupaje. A diferencia del contraste manual, aqui mandan los datos de la
 * AEAT: estado de la partida (una partida master es la de la carga agrupada,
 * no la de la desconsolidacion), bultos, peso y saldo.
 *
 * @returns {{ bloqueo: string|null, consulta: object }}
 */
const evaluarConsultaAeat = (expedition, respuesta) => {
  const sumaria = expedition.transport.summaryDeclaration;
  const ref = expedition.expeditionId || expedition._id || 'sin identificar';
  const prefijo = `El expediente ${ref} es un grupaje maritimo (LCL)`;
  const numeroPartida = Number(sumaria.item);

  if (respuesta.noEncontrada) {
    const detalle = respuesta.errores.map(e => e.descripcion).filter(Boolean).join('; ');
    return {
      bloqueo: `${prefijo} y la AEAT no encuentra la partida ${sumaria.item} de la declaracion sumaria ${sumaria.number}` +
        `${detalle ? ` (${detalle})` : ''}. Comprueba el numero y la partida.${avisoPreproduccion(respuesta)}`,
      consulta: { ...instantaneaDe(respuesta, null), error: detalle || 'Partida de DSDT no encontrada' }
    };
  }

  const partida = respuesta.dsdt.partidas.find(p => p.partida === numeroPartida) || respuesta.dsdt.partidas[0];
  const consulta = instantaneaDe(respuesta, partida);
  const bloquear = (motivo) => ({ bloqueo: `${prefijo} y ${motivo}`, consulta });

  if (!partida) return bloquear(`la AEAT no devuelve la partida ${sumaria.item} de la declaracion sumaria ${sumaria.number}.`);

  if (partida.esMaster) {
    return bloquear(`la partida ${sumaria.item} de la declaracion sumaria ${sumaria.number} es una partida master ` +
      `(${partida.estadoDescripcion}): corresponde a la carga agrupada, no a esta mercancia. ` +
      'Hace falta la partida de la desconsolidacion.');
  }
  if (!respuesta.dsdt.activada) {
    return bloquear(`la declaracion sumaria ${sumaria.number} todavia no esta activada en la AEAT: ` +
      'el medio de transporte no consta como llegado.');
  }
  if (['RE', 'SA'].includes(partida.estado)) {
    return bloquear(`la partida ${sumaria.item} de la declaracion sumaria ${sumaria.number} esta ` +
      `${partida.estadoDescripcion.toLowerCase()} en la AEAT y no admite el H1.`);
  }

  const totales = totalesDe(expedition);
  const bultosAeat = partida.bultosDeclarados;
  const pesoAeat = partida.pesoBrutoDeclarado;
  if (bultosAeat !== totales.bultos || pesoAeat === null || !pesoCuadra(pesoAeat, totales.peso)) {
    return bloquear(`la partida ${sumaria.item} de la declaracion sumaria ${sumaria.number} no corresponde a esta mercancia: ` +
      `en la AEAT figura con ${bultosAeat} bultos y ${pesoAeat} kg, y el expediente declara ${totales.bultos} bultos y ${totales.peso} kg.`);
  }
  if (partida.bultosSaldo !== null && partida.bultosSaldo < totales.bultos) {
    return bloquear(`la partida ${sumaria.item} de la declaracion sumaria ${sumaria.number} solo tiene ` +
      `${partida.bultosSaldo} bultos de saldo en la AEAT y el expediente declara ${totales.bultos}.`);
  }

  return { bloqueo: null, consulta };
};

/**
 * Comprobacion completa de la sumaria de un expediente antes del H1.
 *
 * 1. Si no es grupaje y no hay sumaria registrada, no hay nada que comprobar.
 * 2. Si hay sumaria con una referencia valida, se consulta en la AEAT. En un
 *    grupaje el resultado bloquea; en el resto solo se guarda como informacion.
 * 3. Si la AEAT no se puede consultar (servicio caido, no habilitado, error
 *    del remitente...), en un grupaje se aplica el contraste manual de bultos y
 *    kilos y la consulta queda marcada como no verificada, con el motivo.
 *
 * @param {object} expedition
 * @param {{ consultar: (referencia: { clave?: string, mrn?: string, partida: string }) => Promise<object> }} deps
 * @returns {Promise<{ bloqueo: string|null, aviso: string|null, consulta: object|null }>}
 */
const verificarSumariaConAeat = async (expedition, { consultar }) => {
  const grupaje = esGrupaje(expedition);
  const sumaria = expedition?.transport?.summaryDeclaration || {};
  const numeroSumaria = String(sumaria.number || '').trim();

  if (!numeroSumaria) return { bloqueo: bloqueoPorGrupaje(expedition), aviso: null, consulta: null };

  const referencia = referenciaDeSumaria(numeroSumaria);
  const partida = String(sumaria.item ?? '').trim();
  if (!referencia || !/^\d{1,5}$/.test(partida)) {
    const motivo = 'El numero de la declaracion sumaria debe ser la clave (recinto, año y numero: 11 digitos) ' +
      'o el MRN (18 caracteres), con su numero de partida, para poder consultarla en la AEAT.';
    return { bloqueo: grupaje ? motivo : null, aviso: grupaje ? null : motivo, consulta: null };
  }

  let respuesta;
  try {
    respuesta = await consultar({ ...referencia, partida });
    if (!respuesta.aceptada && !respuesta.noEncontrada) {
      const detalle = respuesta.errores.map(e => `${e.codigo} ${e.descripcion}`.trim()).join('; ');
      throw new Error(detalle || 'respuesta de rechazo sin motivo');
    }
  } catch (error) {
    const aviso = `No se pudo comprobar la declaracion sumaria ${numeroSumaria} en la AEAT (${error.message}). ` +
      'Se han contrastado solo los bultos y el peso registrados a mano.';
    return {
      bloqueo: bloqueoPorGrupaje(expedition),
      aviso,
      consulta: { consultedAt: new Date(), verified: false, error: String(error.message).slice(0, 500) }
    };
  }

  if (!grupaje) {
    const partidaAeat = respuesta.dsdt?.partidas.find(p => p.partida === Number(partida)) || respuesta.dsdt?.partidas[0] || null;
    const consulta = instantaneaDe(respuesta, partidaAeat);
    return respuesta.noEncontrada
      ? { bloqueo: null, aviso: `La AEAT no encuentra la partida ${partida} de la declaracion sumaria ${numeroSumaria}.${avisoPreproduccion(respuesta)}`, consulta: { ...consulta, error: 'Partida de DSDT no encontrada' } }
      : { bloqueo: null, aviso: null, consulta };
  }

  return { ...evaluarConsultaAeat(expedition, respuesta), aviso: null };
};

module.exports = {
  bloqueoPorGrupaje,
  exigirSumariaDeGrupaje,
  verificarSumariaConAeat,
  evaluarConsultaAeat,
  esGrupaje,
  CODIGO_ERROR
};
