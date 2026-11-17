/**
 * Preferencia arancelaria de la AEAT en la calculadora de derechos.
 *
 * Jenifer (UAT 17/11/2026): cerezas 0809290000 de Chile salian al 12 % (NMF)
 * aunque Chile tiene preferencia al 0 %. La calculadora solo miraba su catalogo
 * y arrancaba en «NMF (sin preferencia)». Ahora consulta el Arancel Integrado
 * de la AEAT (derecho general 103 y preferencias 1xx del origen) y:
 *  - con NMF, informa de la preferencia disponible (la pantalla ofrece aplicarla);
 *  - con una preferencia elegida, aplica el tipo preferencial de la AEAT.
 * La preferencia exige prueba de origen; por eso no se aplica sola.
 */
const { consultarArancelIntegrado } = require('./arancelIntegrado');
const { tiposAeat } = require('./contrasteArancel');
const logger = require('../../config/logger');

const SIN_PREFERENCIA = '100';
const redondear = (n) => Math.round(n * 100) / 100;

/**
 * Tipos de la AEAT (derecho general, mejor preferencia del origen e IVA) para
 * el codigo y el origen, o null si no se puede saber.
 * @returns {Promise<{ general: number, preferencial: number|null, medida: string|null, iva: number|null }|null>}
 */
async function tiposAeatPara(codigo, origen) {
  const cod = String(codigo || '').replace(/\D/g, '');
  const pais = String(origen || '').trim().toUpperCase();
  if (cod.length !== 10 || !/^[A-Z]{2}$/.test(pais)) return null;
  try {
    const resultado = await consultarArancelIntegrado({ codigo: cod, origen: pais });
    if (!resultado?.existe) return null;
    const { general, preferencias, iva } = tiposAeat(resultado);
    if (general === null) return null;
    const mejor = preferencias.reduce((min, p) => (min === null || p.tipo < min.tipo ? p : min), null);
    return { general, preferencial: mejor ? mejor.tipo : null, medida: mejor ? mejor.codigo : null, iva };
  } catch (error) {
    logger.warn(`[Calculadora] Arancel Integrado AEAT no disponible para ${cod}/${pais}: ${error.message}`);
    return null;
  }
}

/** Lo que usa la calculadora: derecho general y preferencia (sin el IVA). */
async function preferenciaAeatPara(codigo, origen) {
  const tipos = await tiposAeatPara(codigo, origen);
  return tipos ? { general: tipos.general, preferencial: tipos.preferencial, medida: tipos.medida } : null;
}

/**
 * Con una preferencia elegida y un tipo preferencial de la AEAT menor, recalcula
 * derecho, base del IVA, IVA y totales (solo derechos ad valorem: con derechos
 * especificos no se toca el calculo). Devuelve un objeto nuevo.
 *
 * @param {object} datos - respuesta de la calculadora (data)
 * @param {{ general: number, preferencial: number|null, medida: string|null }|null} pref
 * @param {string} preferencia - codigo elegido ('100' = sin preferencia)
 */
function aplicarPreferenciaAeat(datos, pref, preferencia) {
  if (!pref || pref.preferencial === null || preferencia === SIN_PREFERENCIA) return datos;
  if (Number(datos.specificDuty) > 0 || !(Number(datos.customsValue) > 0)) return datos;
  if (!(pref.preferencial < Number(datos.dutyRate))) return datos;

  const valor = Number(datos.customsValue);
  const derechoAntes = Number(datos.dutyAmount) || 0;
  const ivaAntes = Number(datos.vatAmount) || 0;
  const derecho = redondear(valor * pref.preferencial / 100);
  const baseIva = redondear((Number(datos.vatBase) || valor + derechoAntes) - derechoAntes + derecho);
  const iva = redondear(baseIva * (Number(datos.vatRate) || 0) / 100);
  const delta = (derecho - derechoAntes) + (iva - ivaAntes);
  return {
    ...datos,
    dutyRate: pref.preferencial,
    dutyAmount: derecho,
    adValoremDuty: derecho,
    vatBase: baseIva,
    vatAmount: iva,
    totalTaxes: redondear((Number(datos.totalTaxes) || 0) + delta),
    totalToPay: redondear((Number(datos.totalToPay) || 0) + delta),
    preferenceApplied: {
      agreement: `Preferencia arancelaria de la AEAT (medida ${pref.medida})`,
      certificate: 'Prueba de origen del acuerdo',
      reduction: redondear(Number(datos.dutyRate) - pref.preferencial)
    }
  };
}

module.exports = { tiposAeatPara, preferenciaAeatPara, aplicarPreferenciaAeat };
