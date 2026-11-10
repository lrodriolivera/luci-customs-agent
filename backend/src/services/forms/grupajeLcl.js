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

module.exports = { bloqueoPorGrupaje, exigirSumariaDeGrupaje, esGrupaje, CODIGO_ERROR };
