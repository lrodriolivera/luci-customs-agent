/**
 * Consulta del Arancel Integrado de la AEAT (sede electronica, "ARANCEL
 * INTEGRADO" de inwinvoc) con el certificado de la empresa.
 *
 * El catalogo TARIC de LUCI tiene los codigos de 10 digitos comunes a la UE,
 * pero no la capa nacional espanola: IVA, impuestos especiales y controles e
 * inspecciones (SOIVRE, sanidad, seguridad de los productos...). Esa capa solo
 * la publica la AEAT en esta consulta, que exige certificado (sin el, redirige a
 * erro4033). Lo pidieron las agentes en la UAT del 16/Nov/2026.
 *
 * No es un servicio web: son paginas HTML pensadas para personas. Hacen falta
 * tres peticiones (buscar el codigo, abrir su ficha y pedir las medidas para un
 * area geografica) y se interpreta el HTML. Si la AEAT cambia la pagina, la
 * consulta falla con un error explicito; nunca se inventan datos.
 *
 * Es informacion publica y de solo lectura, asi que se consulta siempre la sede
 * real (www1), tambien cuando LUCI presenta declaraciones contra PRE.
 */

const https = require('https');
const axios = require('axios');
const querystring = require('querystring');

const logger = require('../../config/logger');
const { loadCertificate } = require('./aeatTransport');
const { getCache } = require('../cacheService');

const BASE = 'https://www1.agenciatributaria.gob.es/wlpl/inwinvoc/es.aeat.dit.adu.adta.trans.bdm';
const URL_BUSQUEDA = `${BASE}.TtCodNomIntQuery`;
const URL_FICHA = `${BASE}.TtCodNomAcc`;
const URL_CONSULTA_WEB = `${BASE}.TtCodNomIntQue`;

// "Todos los terceros paises" (erga omnes) cuando no se conoce el origen.
const AREA_ERGA_OMNES = '1011';
const TIMEOUT_MS = 20000;
// Las medidas cambian con el BOE/DOUE, no a diario: un dia de cache basta y
// evita repetir tres peticiones a la sede por cada clic.
const CACHE_TTL_SEGUNDOS = 24 * 60 * 60;
const CACHE_PREFIJO = 'aeat_arancel_v1';

class ArancelIntegradoError extends Error {
  constructor(message, codigo) {
    super(message);
    this.name = 'ArancelIntegradoError';
    this.codigo = codigo;
  }
}

/**
 * La sede declara ISO-8859-1. Se decodifica como UTF-8 solo si los bytes lo
 * son de verdad; si no, como latin-1.
 * @param {Buffer|string} cuerpo
 * @returns {string}
 */
function decodificar(cuerpo) {
  if (typeof cuerpo === 'string') return cuerpo;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(cuerpo);
  } catch {
    return Buffer.from(cuerpo).toString('latin1');
  }
}

const ENTIDADES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', oacute: 'ó', aacute: 'á', eacute: 'é', iacute: 'í', uacute: 'ú', ntilde: 'ñ' };

/** Quita etiquetas y entidades y colapsa espacios. */
function texto(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') return String.fromCharCode(Number(e.slice(1)));
      return ENTIDADES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** 6302.21.00.89 -> 6302210089 */
const soloDigitos = (codigo) => String(codigo || '').replace(/\D/g, '');

/**
 * En la pagina de resultados de la busqueda, localiza el enlace a la ficha del
 * codigo exacto. Si no esta, el codigo no existe en la fecha consultada.
 * @returns {{ url: string } | null}
 */
function extraerEnlaceFicha(html, codigo) {
  const patron = /<a href='([^']*TtCodNomAcc\?ACCION=DetalleInt[^']*)'[^>]*>([\d.]+)<\/a>/g;
  let m;
  while ((m = patron.exec(html)) !== null) {
    if (soloDigitos(m[2]) === codigo) {
      return { url: m[1].replace(/&amp;/g, '&') };
    }
  }
  return null;
}

/** Campos ocultos de la ficha que exige la consulta de medidas. */
function extraerCamposFicha(html) {
  const ocultos = {};
  for (const m of html.matchAll(/name='([A-Za-z_]+)' value='([^']*)'/g)) {
    if (!(m[1] in ocultos)) ocultos[m[1]] = m[2];
  }
  const oculto = (nombre) => ocultos[nombre] ?? null;
  const descripcion = html.match(/Descripci(?:ó|&oacute;)n Larga:<\/strong>([\s\S]*?)<\/li>/);
  const campos = {
    SIDNMC: oculto('SIDNMC'),
    SIDGUI: oculto('SIDGUI'),
    SIDDSC: oculto('SIDDSC'),
    fecha: oculto('fecha')
  };
  if (!campos.SIDNMC || !campos.fecha) {
    throw new ArancelIntegradoError('La ficha del codigo en la AEAT no tiene el formato esperado', 'FORMATO');
  }
  return { ...campos, descripcion: descripcion ? texto(descripcion[1]) : '' };
}

/**
 * Clasifica la medida por su codigo: IVA, medida nacional espanola (codigos
 * alfabeticos: controles COM, SOIVRE, sanidad, impuestos especiales...) o
 * medida de la Union (codigos numericos del TARIC).
 */
function tipoDeMedida(codigo) {
  if (/^IVA/.test(codigo)) return 'iva';
  if (/^IG[IC]/.test(codigo)) return 'igic';
  if (/^\d/.test(codigo)) return 'ue';
  return 'nacional';
}

/**
 * Interpreta la tabla "Medidas asociadas a una nomenclatura".
 * Cada medida empieza por una celda con su codigo, el area geografica y el
 * reglamento; lo que sigue hasta la siguiente es su informacion.
 */
function extraerMedidas(html) {
  const inicio = html.indexOf('Medidas asociadas a una nomenclatura');
  if (inicio < 0) {
    throw new ArancelIntegradoError('La AEAT no devolvio la tabla de medidas', 'FORMATO');
  }
  const finRemisiones = html.indexOf('<caption><B>Remisiones', inicio);
  const tabla = html.slice(inicio, finRemisiones > 0 ? finRemisiones : undefined);

  const cabecera = /<span class='notraducir'>\s*([0-9A-Z]{3}-[^<\s]*)\s*<\/br>\s*A\.GEO\.:([\s\S]*?)<\/br>\s*Reglamento:\s*([^<\s]*)\s*<\/span>/g;
  const encontradas = [];
  let m;
  while ((m = cabecera.exec(tabla)) !== null) {
    encontradas.push({ codigo: m[1], area: texto(m[2]), reglamento: m[3], desde: cabecera.lastIndex, empieza: m.index });
  }

  return encontradas.map((medida, i) => {
    const fin = i + 1 < encontradas.length ? encontradas[i + 1].empieza : tabla.length;
    const cuerpo = tabla.slice(medida.desde, fin);

    const descripcion = texto((cuerpo.match(/<td class=texto_izq>([\s\S]*?)(?:<br>|<td|$)/) || [])[1]);
    const derecho = texto((cuerpo.match(/<B>Derechos:<\/B>([\s\S]*?)(?:<br>|<td|<\/td>|\n)/) || [])[1]);
    const exclusiones = texto((cuerpo.match(/<B>Exclusiones:<\/B>([\s\S]*?)(?:<br>|<td|<\/td>)/) || [])[1]);

    const documentos = [];
    const indicaciones = cuerpo.split('Indicaciones especiales')[1] || '';
    const docPatron = /<B>([A-Z0-9]{4})<\/B>&nbsp;([^<]*)/g;
    let d;
    while ((d = docPatron.exec(indicaciones)) !== null) {
      documentos.push({ codigo: d[1], descripcion: texto(d[2]).replace(/,$/, '') });
    }

    return {
      codigo: medida.codigo,
      tipo: tipoDeMedida(medida.codigo),
      areaGeografica: medida.area,
      reglamento: medida.reglamento,
      descripcion,
      ...(derecho ? { derecho } : {}),
      ...(exclusiones ? { exclusiones } : {}),
      documentos
    };
  });
}

/** Fecha de hoy como dd-mm-aaaa (formulario de busqueda). */
function fechaFormulario(fecha) {
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${fecha.getFullYear()}`;
}

function clienteHttpPorDefecto() {
  let agente = null;
  const obtenerAgente = () => {
    if (!agente) {
      const { cert, key } = loadCertificate();
      agente = new https.Agent({ cert, key, rejectUnauthorized: true });
    }
    return agente;
  };
  return async ({ metodo, url, datos }) => {
    const respuesta = await axios({
      method: metodo,
      url,
      data: datos ? querystring.stringify(datos) : undefined,
      headers: datos ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {},
      httpsAgent: obtenerAgente(),
      responseType: 'arraybuffer',
      timeout: TIMEOUT_MS,
      maxRedirects: 0,
      validateStatus: () => true
    });
    if (respuesta.status !== 200) {
      throw new ArancelIntegradoError(`La AEAT respondio HTTP ${respuesta.status}`, 'HTTP');
    }
    return decodificar(Buffer.from(respuesta.data));
  };
}

/**
 * Consulta el codigo en el Arancel Integrado de la AEAT.
 *
 * @param {object} p
 * @param {string} p.codigo  - TARIC de 10 digitos
 * @param {string} [p.origen] - pais de origen ISO-2; sin el, erga omnes
 * @param {Date}   [p.fecha]
 * @param {Function} [p.http]  - cliente inyectable (tests)
 * @param {object}   [p.cache] - cache inyectable (tests)
 * @returns {Promise<object>} { existe, codigo, descripcion, areaGeografica, fechaConsulta, medidas, fuente, url }
 */
async function consultarArancelIntegrado({ codigo, origen, fecha = new Date(), http, cache } = {}) {
  const cod = soloDigitos(codigo);
  if (cod.length !== 10) {
    throw new ArancelIntegradoError('El codigo TARIC debe tener 10 digitos', 'VALIDACION');
  }
  const area = /^[A-Z]{2}$/.test(String(origen || '').toUpperCase()) ? String(origen).toUpperCase() : AREA_ERGA_OMNES;
  const fechaTexto = fechaFormulario(fecha);

  const almacen = cache || getCache();
  const clave = `${CACHE_PREFIJO}:${cod}:${area}:${fechaTexto}`;
  const cacheada = await almacen.get(clave).catch(() => null);
  if (cacheada) return cacheada;

  const pedir = http || clienteHttpPorDefecto();
  const base = { codigo: cod, areaGeografica: area, fechaConsulta: fechaTexto, fuente: 'AEAT · Arancel Integrado', url: URL_CONSULTA_WEB };

  const busqueda = await pedir({
    metodo: 'post',
    url: URL_BUSQUEDA,
    datos: { FFecha: fechaTexto, FCdnmc: cod, CLASGTE: '20/0/', TOTALES: '', 'QUE-MODO': 'NORMAL', QUE_MODO: 'NORMAL', ESTADO_COLS: '', NUM_RESULTADOS_RS: '0', VEZ: '' }
  });
  const enlace = extraerEnlaceFicha(busqueda, cod);
  if (!enlace) {
    const resultado = { ...base, existe: false, descripcion: '', medidas: [] };
    await almacen.set(clave, resultado, CACHE_TTL_SEGUNDOS).catch(() => {});
    return resultado;
  }

  const ficha = extraerCamposFicha(await pedir({ metodo: 'get', url: enlace.url }));
  const medidasHtml = await pedir({
    metodo: 'post',
    url: URL_FICHA,
    datos: {
      ACCION: 'DetalleInt', SIDNMC: ficha.SIDNMC, SIDGUI: ficha.SIDGUI || '', SIDDSC: ficha.SIDDSC || '',
      ageo: area, nomen: cod, fecha: ficha.fecha, accion: 'formu'
    }
  });

  const resultado = { ...base, existe: true, descripcion: ficha.descripcion, medidas: extraerMedidas(medidasHtml) };
  await almacen.set(clave, resultado, CACHE_TTL_SEGUNDOS).catch(() => {});
  logger.info(`[ARANCEL-AEAT] ${cod} (${area}): ${resultado.medidas.length} medidas`);
  return resultado;
}

module.exports = {
  consultarArancelIntegrado,
  ArancelIntegradoError,
  // Expuestas para los tests de interpretacion del HTML.
  decodificar,
  extraerEnlaceFicha,
  extraerCamposFicha,
  extraerMedidas,
  AREA_ERGA_OMNES
};
