/**
 * Consulta de declaraciones sumarias de deposito temporal (DSDT) en la AEAT.
 *
 * Servicio DSDTCons, guia tecnica v1.1 (07/03/2022):
 *   https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/Aduanas/adu_electronica/info/guias_tecnicas/DS_DSDTConsulta.pdf
 * Esquemas: DSDTConsV1Ent.xsd (peticion), DSDTConsV1Sal.xsd (respuesta).
 * Endpoint: /wlpl/ADDS-JDIT/ws/DSDTConsV1SOAP
 *
 * De las cinco formas de busqueda del servicio solo se usan las dos que
 * identifican una partida concreta: MRN + partida y clave + partida. Son las
 * unicas sin limite de 90 dias y las que necesita el H1.
 */

const { xml } = require('./xmlTemplate');
const { escapeRegex } = require('../../utils/escapeRegex');

const NS_ENT = 'https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adds/jdit/ws/DSDTConsV1Ent.xsd';
const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';
const ENDPOINT = '/wlpl/ADDS-JDIT/ws/DSDTConsV1SOAP';

// Clave de la DSDT: recinto (4) + ultimo digito del año (1) + numero (6).
const FORMATO_CLAVE = /^\d{4}\d\d{6}$/;
// MRN de la DSDT: AAES00RRRR8NNNNNNC (18 caracteres).
const FORMATO_MRN = /^\d{2}ES[0-9A-Z]{14}$/;
const FORMATO_PARTIDA = /^\d{1,5}$/;
const FORMATO_NIF = /^[0-9A-Z]{9}$/;

// Guia tecnica, tabla TS4: partidas master (carga agrupada, sin desconsolidar
// o ya desconsolidada) frente a partidas normales.
const ESTADOS_PARTIDA = {
  AC: 'Activa',
  DA: 'Datada',
  SA: 'Saldada',
  RE: 'Retenida',
  MD: 'Máster desconsolidado',
  MA: 'Máster activo',
  MT: 'Máster datado',
  MS: 'Máster saldado',
  ZZ: 'No informado'
};
const ESTADOS_PARTIDA_MASTER = ['MD', 'MA', 'MT', 'MS'];

// Guia tecnica, tabla TS9: la centena 400 significa «no encontrada».
const esErrorNoEncontrada = (codigo) => /^4\d\d$/.test(String(codigo || ''));

/**
 * Separa lo que teclea el agente en la referencia que entiende el servicio.
 * Admite la clave (RRRRANNNNNN) o el MRN, con espacios, puntos o guiones.
 *
 * @param {string} numero
 * @returns {{ clave: string } | { mrn: string } | null} null si no es ninguno de los dos formatos
 */
function referenciaDeSumaria(numero) {
  const limpio = String(numero || '').toUpperCase().replace(/[\s.\-/]/g, '');
  if (FORMATO_CLAVE.test(limpio)) return { clave: limpio };
  if (FORMATO_MRN.test(limpio)) return { mrn: limpio };
  return null;
}

function fechaHora14(fecha = new Date()) {
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${fecha.getFullYear()}${p(fecha.getMonth() + 1)}${p(fecha.getDate())}` +
    `${p(fecha.getHours())}${p(fecha.getMinutes())}${p(fecha.getSeconds())}`;
}

/**
 * Construye la peticion de consulta de una partida de DSDT.
 *
 * @param {object} datos
 * @param {string} datos.sender    NIF del remitente; debe ser el del certificado (error 211 si no)
 * @param {string} [datos.clave]   clave de la DSDT (RRRRANNNNNN)
 * @param {string} [datos.mrn]     MRN de la DSDT, alternativa a la clave
 * @param {string|number} datos.partida
 * @param {string} [datos.ubicacion] codigo de ubicacion (ADT), opcional
 * @param {string} [datos.id]      identificador unico del mensaje
 * @param {Date}   [datos.fecha]
 * @returns {string} sobre SOAP
 */
function buildDSDTConsXML(datos = {}) {
  const sender = String(datos.sender || '').toUpperCase().replace(/^ES/, '');
  if (!FORMATO_NIF.test(sender)) throw new Error('Consulta DSDT: NIF del remitente no valido');

  const partida = String(datos.partida ?? '').trim();
  if (!FORMATO_PARTIDA.test(partida)) throw new Error('Consulta DSDT: numero de partida no valido');

  const tieneClave = FORMATO_CLAVE.test(String(datos.clave || ''));
  const tieneMrn = FORMATO_MRN.test(String(datos.mrn || ''));
  if (!tieneClave && !tieneMrn) throw new Error('Consulta DSDT: hace falta la clave o el MRN de la sumaria');

  const fecha = datos.fecha || new Date();
  const preparacion = fechaHora14(fecha);
  const id = datos.id || `LUCI_${preparacion}_${Math.floor(Math.random() * 1e9)}`;

  const referencia = tieneClave
    ? xml`<dsd:Clave>${datos.clave}</dsd:Clave>`
    : xml`<dsd:MRN>${datos.mrn}</dsd:MRN>`;

  return xml`<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}" xmlns:dsd="${NS_ENT}">
  <soapenv:Header/>
  <soapenv:Body>
    <dsd:DSDTConsV1Ent>
      <dsd:Message>
        <dsd:Sender>${sender}</dsd:Sender>
        <dsd:Id>${id}</dsd:Id>
        <dsd:PreparationDate>${preparacion}</dsd:PreparationDate>
      </dsd:Message>
      <dsd:Peticion>
        ${referencia}
        <dsd:Partida>${Number(partida)}</dsd:Partida>${datos.ubicacion ? xml`
        <dsd:Ubicacion>${datos.ubicacion}</dsd:Ubicacion>` : ''}
      </dsd:Peticion>
    </dsd:DSDTConsV1Ent>
  </soapenv:Body>
</soapenv:Envelope>`.toString();
}

// ---- Lectura de la respuesta ------------------------------------------------

const desescapar = (texto) => texto
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** Texto del primer elemento con ese nombre local (con o sin prefijo), o null. */
function texto(fragmento, nombre) {
  const m = new RegExp(`<(?:[\\w.-]+:)?${escapeRegex(nombre)}(?:\\s[^>]*)?>([^<]*)</(?:[\\w.-]+:)?${escapeRegex(nombre)}>`).exec(fragmento);
  return m ? desescapar(m[1].trim()) : null;
}

/** Contenido de todos los bloques con ese nombre local. */
function bloques(fragmento, nombre) {
  const patron = new RegExp(`<(?:[\\w.-]+:)?${escapeRegex(nombre)}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${escapeRegex(nombre)}>`, 'g');
  const encontrados = [];
  let m;
  while ((m = patron.exec(fragmento)) !== null) encontrados.push(m[1]);
  return encontrados;
}

const numero = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
};

function leerPartida(par) {
  // Los bloques UBIC y CONT repiten nombres de la partida; se leen aparte y se
  // quitan antes de leer los datos propios de la partida.
  const propio = par.replace(/<(?:[\w.-]+:)?(UBIC|CONT)(?:\s[^>]*)?>[\s\S]*?<\/(?:[\w.-]+:)?\1>/g, '');
  const estado = texto(propio, 'EstadoPar');
  return {
    partida: numero(texto(propio, 'Partida')),
    estado,
    estadoDescripcion: ESTADOS_PARTIDA[estado] || null,
    esMaster: ESTADOS_PARTIDA_MASTER.includes(estado),
    tipo: texto(propio, 'TipoPar'),
    bultosDeclarados: numero(texto(propio, 'BultosDecPar')),
    pesoBrutoDeclarado: numero(texto(propio, 'PesoBrutoDecPar')),
    bultosSaldo: numero(texto(propio, 'BultosSaldoPar')),
    pesoBrutoSaldo: numero(texto(propio, 'PesoBrutoSaldoPar')),
    conocimiento: texto(propio, 'Conocimiento'),
    codigoMercancia: texto(propio, 'CodMerPar'),
    ubicaciones: bloques(par, 'UBIC').map(u => ({
      ubicacion: texto(u, 'Ubicacion'),
      estado: texto(u, 'EstadoUbic'),
      bultosSaldo: numero(texto(u, 'BultosSaldoUbic')),
      pesoBrutoSaldo: numero(texto(u, 'PesoBrutoSaldoUbic'))
    })),
    contenedores: bloques(par, 'CONT').map(c => ({
      contenedor: texto(c, 'Contenedor'),
      bultos: numero(texto(c, 'BultosDecCont'))
    }))
  };
}

/**
 * Interpreta la respuesta del servicio.
 *
 * @param {string} respuestaXml
 * @returns {{
 *   aceptada: boolean,
 *   noEncontrada: boolean,
 *   entorno: string|null,
 *   errores: Array<{ codigo: string, descripcion: string }>,
 *   dsdt: object|null
 * }}
 * @throws {Error} si la respuesta no es un DSDTConsV1Sal (fallo SOAP, HTML de error, etc.)
 */
function parseDSDTConsResponse(respuestaXml) {
  const cuerpo = String(respuestaXml || '');
  const raiz = bloques(cuerpo, 'DSDTConsV1Sal')[0];
  if (raiz === undefined) {
    const fallo = texto(cuerpo, 'faultstring');
    throw new Error(fallo
      ? `La AEAT rechazo la consulta de la sumaria: ${fallo}`
      : 'La AEAT no devolvio una respuesta reconocible a la consulta de la sumaria');
  }

  const mensaje = bloques(raiz, 'Message')[0] || '';
  const codRespuesta = texto(raiz.replace(/<(?:[\w.-]+:)?Message[\s\S]*?<\/(?:[\w.-]+:)?Message>/, ''), 'CodRespuesta');
  const errores = bloques(raiz, 'Error').map(e => ({
    codigo: texto(e, 'CodError') || '',
    descripcion: texto(e, 'DescError') || ''
  }));

  const info = bloques(raiz, 'DSDTInfo')[0];
  let dsdt = null;
  if (codRespuesta === 'AC' && info !== undefined) {
    const cabecera = info.replace(/<(?:[\w.-]+:)?PAR(?:\s[^>]*)?>[\s\S]*?<\/(?:[\w.-]+:)?PAR>/g, '');
    dsdt = {
      mrn: texto(cabecera, 'MRN'),
      clave: texto(cabecera, 'Clave'),
      recinto: texto(cabecera, 'Recinto'),
      idTransporte: texto(cabecera, 'IdTransporte'),
      estado: texto(cabecera, 'EstadoCab'),
      activada: texto(cabecera, 'Activada') === 'S',
      fechaActivacion: texto(cabecera, 'FecActivacion'),
      partidas: bloques(info, 'PAR').map(leerPartida)
    };
  }

  return {
    aceptada: codRespuesta === 'AC' && dsdt !== null,
    noEncontrada: errores.some(e => esErrorNoEncontrada(e.codigo)),
    entorno: texto(mensaje, 'Sender'),
    errores,
    dsdt
  };
}

module.exports = {
  buildDSDTConsXML,
  parseDSDTConsResponse,
  referenciaDeSumaria,
  ENDPOINT,
  ESTADOS_PARTIDA,
  ESTADOS_PARTIDA_MASTER
};
