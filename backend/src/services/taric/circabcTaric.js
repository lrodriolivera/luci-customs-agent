/**
 * Descarga de los ficheros del TARIC que la Comision Europea publica en
 * CIRCABC, grupo publico «TARIC and Quota Data & Information». Se lee como
 * invitado, sin cuenta: la reutilizacion esta permitida citando la fuente
 * (Decision 2011/833/UE).
 *
 * Estructura: carpeta «TARIC data» > año > «11 - November» > ficheros del mes
 * (extraccion proyectada al dia 1). «Nomenclature ES.xlsx» solo se publica en
 * enero y julio; el resto de meses salen EN, FR y DE.
 */
const axios = require('axios');

const BASE = 'https://circabc.europa.eu';
const CARPETA_TARIC = '64db9d0f-e7c9-4084-afe9-f47e70e53c10';
const USER_AGENT = 'Mozilla/5.0 (compatible; LUCI-TARIC-sync; +https://aduanas.strixai.ai)';
const TIMEOUT_MS = 120000;
const FUENTE = 'Comision Europea - TARIC (CIRCABC)';

const esCarpeta = (nodo) => String(nodo.type || '').endsWith('}folder');

async function hijos(id, { cliente = axios } = {}) {
  const { data } = await cliente.get(`${BASE}/service/circabc/spaces/${id}/children`, {
    params: { language: 'en', guest: true, limit: 200, page: 1 },
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    timeout: TIMEOUT_MS
  });
  const lista = Array.isArray(data) ? data : data?.data;
  if (!Array.isArray(lista)) throw new Error('CIRCABC: respuesta inesperada al listar una carpeta');
  return lista.map((n) => ({ id: n.id, name: String(n.name || ''), carpeta: esCarpeta(n), modificado: n.properties?.modified || null }));
}

/** Carpetas de mes, de la mas reciente a la mas antigua: [{ id, anio, mes, name }]. */
async function mesesPublicados(opciones = {}) {
  const anios = (await hijos(CARPETA_TARIC, opciones))
    .filter((n) => n.carpeta && /^\d{4}$/.test(n.name)).sort((a, b) => b.name.localeCompare(a.name));
  const meses = [];
  for (const anio of anios.slice(0, 2)) {
    for (const n of await hijos(anio.id, opciones)) {
      const m = /^(\d{2})\s*-/.exec(n.name);
      if (n.carpeta && m) meses.push({ id: n.id, anio: Number(anio.name), mes: Number(m[1]), name: n.name });
    }
  }
  return meses.sort((a, b) => (b.anio - a.anio) || (b.mes - a.mes));
}

async function descargar(id, { cliente = axios } = {}) {
  const { data } = await cliente.get(`${BASE}/rest/download/${id}`, {
    responseType: 'arraybuffer', headers: { 'User-Agent': USER_AGENT }, timeout: TIMEOUT_MS, maxContentLength: 100 * 1024 * 1024
  });
  return Buffer.from(data);
}

/**
 * Ficheros necesarios para sincronizar la nomenclatura: del mes mas reciente,
 * los codigos declarables y la nomenclatura en ingles; y la nomenclatura en
 * español mas reciente que exista (enero o julio).
 *
 * @returns {Promise<{ mes: object, mesEs: object|null, declarables: Buffer, nomenclaturaEn: Buffer, nomenclaturaEs: Buffer|null, derechosImport: Buffer|null, codigosAdicionales: Buffer|null }>}
 */
async function ficherosDeNomenclatura(opciones = {}) {
  const meses = await mesesPublicados(opciones);
  let reciente = null;
  let es = null;
  for (const mes of meses) {
    const ficheros = await hijos(mes.id, opciones);
    const buscar = (nombre) => ficheros.find((f) => !f.carpeta && f.name.toLowerCase() === nombre);
    if (!reciente) {
      const declarables = buscar('declarable codes.xlsx');
      const en = buscar('nomenclature en.xlsx');
      if (declarables && en) {
        reciente = { mes, declarables, en, derechos: buscar('duties import 01-99.xlsx') || null, adicionales: buscar('additional codes descriptions.xlsx') || null };
      }
    }
    if (!es) {
      const fichero = buscar('nomenclature es.xlsx');
      if (fichero) es = { mes, fichero };
    }
    if (reciente && es) break;
  }
  if (!reciente) throw new Error('CIRCABC: no se encontro ningun mes con «Declarable codes.xlsx» y «Nomenclature EN.xlsx»');

  return {
    mes: reciente.mes,
    mesEs: es ? es.mes : null,
    declarables: await descargar(reciente.declarables.id, opciones),
    nomenclaturaEn: await descargar(reciente.en.id, opciones),
    nomenclaturaEs: es ? await descargar(es.fichero.id, opciones) : null,
    // Derechos de importacion del mismo mes; puede faltar si la Comision aun no lo ha subido.
    derechosImport: reciente.derechos ? await descargar(reciente.derechos.id, opciones) : null,
    // Descripcion de los codigos adicionales, para las variantes del derecho; tambien puede faltar.
    codigosAdicionales: reciente.adicionales ? await descargar(reciente.adicionales.id, opciones) : null
  };
}

module.exports = { ficherosDeNomenclatura, mesesPublicados, hijos, descargar, FUENTE, CARPETA_TARIC };
