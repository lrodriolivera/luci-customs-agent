/**
 * Tipos de cambio oficiales de la aduana, por mes: los busca en Mongo y, si el
 * mes aun no esta guardado, los descarga del BCE y los guarda.
 */
const axios = require('axios');
const logger = require('../../config/logger');
const { mesDe, tiposDelMes, parsearBce, aEuros } = require('./tipoCambioAduanero');

const URL_90_DIAS = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml';
const URL_HISTORICO = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml';
const FUENTE = 'BCE';

// Los tipos de un mes no cambian: se pueden recordar mientras viva el proceso.
const memoria = new Map();

async function descargarSerie(url) {
  const respuesta = await axios.get(url, { timeout: 20000, responseType: 'text', transformResponse: (d) => d });
  return parsearBce(respuesta.data);
}

// Sin conexion a Mongo no se guarda ni se lee (los tipos se siguen pudiendo
// descargar): una consulta sin conexion se quedaria esperando 10 segundos.
const SIN_ALMACEN = { findOne: () => ({ lean: async () => null }), updateOne: async () => null };

function modeloPorDefecto() {
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) return SIN_ALMACEN;
  return require('../../models/CustomsExchangeRate');
}

function aObjeto(doc) {
  const tipos = doc.tipos instanceof Map ? Object.fromEntries(doc.tipos) : { ...doc.tipos };
  return {
    mes: doc.mes,
    fechaReferencia: doc.fechaReferencia,
    fechaPublicacion: doc.fechaPublicacion,
    tipos,
    fuente: doc.fuente || FUENTE
  };
}

/**
 * Tipos que rigen en un mes («AAAA-MM»). Lanza si no estan guardados y el BCE
 * no responde o no publica ese periodo.
 */
async function tiposDelMesOficial(mes, { modelo = modeloPorDefecto(), descargar = descargarSerie } = {}) {
  if (memoria.has(mes)) return memoria.get(mes);

  const guardado = await modelo.findOne({ mes }).lean();
  if (guardado) {
    const tipos = aObjeto(guardado);
    memoria.set(mes, tipos);
    return tipos;
  }

  let calculado = tiposDelMes(mes, await descargar(URL_90_DIAS));
  // Un mes antiguo no cabe en la serie de 90 dias.
  if (!calculado) calculado = tiposDelMes(mes, await descargar(URL_HISTORICO));
  if (!calculado) throw new Error(`El BCE no publica tipos de cambio para ${mes}`);

  const tipos = { ...calculado, fuente: FUENTE };
  await modelo.updateOne({ mes }, { $setOnInsert: tipos }, { upsert: true });
  memoria.set(mes, tipos);
  logger.info(`[Divisas] Tipos oficiales de ${mes} guardados (BCE del ${tipos.fechaPublicacion}, ${Object.keys(tipos.tipos).length} divisas)`);
  return tipos;
}

/**
 * Tipo oficial de una divisa en una fecha (la de admision de la declaracion).
 * Devuelve { divisa, tipo, mes, fechaReferencia, fechaPublicacion, fuente },
 * o null si el BCE no cotiza esa divisa. Para EUR el tipo es 1.
 */
async function tipoOficial(divisa, { fecha = new Date(), ...opciones } = {}) {
  const codigo = String(divisa || 'EUR').trim().toUpperCase();
  const mes = mesDe(fecha);
  if (codigo === 'EUR') return { divisa: 'EUR', tipo: 1, mes, fuente: FUENTE };
  const delMes = await tiposDelMesOficial(mes, opciones);
  const tipo = delMes.tipos[codigo];
  if (!(tipo > 0)) return null;
  return {
    divisa: codigo,
    tipo,
    mes,
    fechaReferencia: delMes.fechaReferencia,
    fechaPublicacion: delMes.fechaPublicacion,
    fuente: delMes.fuente
  };
}

/** Divisas con tipo oficial en una fecha, con EUR la primera. */
async function divisasOficiales({ fecha = new Date(), ...opciones } = {}) {
  const delMes = await tiposDelMesOficial(mesDe(fecha), opciones);
  const divisas = Object.keys(delMes.tipos).sort().map((codigo) => ({ codigo, tipo: delMes.tipos[codigo] }));
  return {
    mes: delMes.mes,
    fechaReferencia: delMes.fechaReferencia,
    fechaPublicacion: delMes.fechaPublicacion,
    fuente: delMes.fuente,
    divisas: [{ codigo: 'EUR', tipo: 1 }, ...divisas]
  };
}

function olvidarMemoria() {
  memoria.clear();
}

module.exports = { tipoOficial, tiposDelMesOficial, divisasOficiales, aEuros, olvidarMemoria, URL_90_DIAS, URL_HISTORICO };
