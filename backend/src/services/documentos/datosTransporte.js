/**
 * Comprobaciones en codigo de lo que la IA lee en un documento de transporte
 * (BL, AWB, CMR). Funciones puras: no dependen de la IA ni de la base de datos.
 *
 * Origen: lectura en produccion (13/Nov/2026) de un BL de T.S. Lines y de un
 * AWB de OIA Global. En el BL la casilla «Container No. / Seal No.» mezcla
 * contenedores y precintos y la IA dio los seis por contenedores; en el AWB
 * la ciudad llego con el codigo del estado («SOLON OH», «CMX») y el vuelo con
 * el dia del mes («5X 1441/23»).
 */

const MAX_ELEMENTOS = 99;
const MAX_TEXTO = 100;

// ---- Contenedores ISO 6346 ------------------------------------------------------

// Valor de cada letra en el calculo del digito de control: de 10 a 38,
// saltando los multiplos de 11 (11, 22 y 33).
const VALOR_LETRA = (() => {
  const valores = {};
  let valor = 10;
  for (const letra of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (valor % 11 === 0) valor += 1;
    valores[letra] = valor;
    valor += 1;
  }
  return valores;
})();

/**
 * Digito de control de una matricula ISO 6346 a partir de sus diez primeros
 * caracteres (prefijo de cuatro letras y numero de serie de seis cifras).
 *
 * @param {string} diezCaracteres p. ej. «CSQU305438»
 * @returns {number} digito de 0 a 9
 */
function digitoControlIso6346(diezCaracteres) {
  const suma = [...String(diezCaracteres).toUpperCase()].reduce((total, caracter, i) => {
    const valor = /\d/.test(caracter) ? Number(caracter) : VALOR_LETRA[caracter] || 0;
    return total + valor * 2 ** i;
  }, 0);
  return (suma % 11) % 10;
}

// Cuatro letras (la cuarta es la categoria: U contenedor, J equipo
// desmontable, Z remolque) y siete cifras, la ultima el digito de control.
const MATRICULA_ISO = /[A-Z]{3}[UJZ]\d{7}(?!\d)/;
const MATRICULA_EXACTA = /^[A-Z]{3}[UJZ]\d{7}(?!\d)/;
// Matricula seguida de cifras de mas («MSCU1150584400»): el documento pega
// otra cifra (o el precinto) al numero del contenedor.
const MATRICULA_CON_CIFRAS_DE_MAS = /^([A-Z]{3}[UJZ]\d{7})\d+/;

const conDigito = (numero, extra = {}) => ({
  numero,
  digitoCorrecto: digitoControlIso6346(numero.slice(0, 10)) === Number(numero[10]),
  ...extra
});

/**
 * Matricula de contenedor contenida en un texto leido («MAGU5599236/40HQ»,
 * «tghu 884221-7», «MSCU1234567 40HC»), o null si no hay ninguna con el
 * formato ISO 6346.
 *
 * Si una palabra empieza por una matricula y sigue con mas cifras
 * («MSCU1150584400»), se toman los 11 primeros caracteres y se marca
 * `cifrasDeMas` con lo leido, para avisar al agente (UAT 16/Nov/2026: el BL
 * traia «MSCU1150584400» y acabo entre los precintos).
 *
 * @param {*} valor
 * @returns {{ numero: string, digitoCorrecto: boolean, cifrasDeMas?: string } | null}
 */
function matriculaIso6346(valor) {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null;
  const mayusculas = String(valor).toUpperCase();
  const hallada = MATRICULA_ISO.exec(mayusculas.replace(/[\s-]/g, ''));
  if (hallada) return conDigito(hallada[0]);
  // Palabra a palabra: el tipo o el precinto pueden ir pegados tras un espacio.
  const palabras = mayusculas.split(/[\s/,;()]+/).map(p => p.replace(/-/g, '')).filter(Boolean);
  const exacta = palabras.map(p => MATRICULA_EXACTA.exec(p)).find(Boolean);
  if (exacta) return conDigito(exacta[0]);
  const larga = [...palabras, mayusculas.replace(/[\s-]/g, '')].map(p => MATRICULA_CON_CIFRAS_DE_MAS.exec(p)).find(Boolean);
  return larga ? conDigito(larga[1], { cifrasDeMas: larga[0] }) : null;
}

// Un precinto se guarda como se leyo, en mayusculas y sin espacios ni lo que
// lo acompañe entre parentesis o tras una barra. Sin ninguna cifra no es un
// numero de precinto («sin numero», «N/A»).
const numeroPrecinto = (valor) => {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null;
  const limpio = String(valor).toUpperCase().split(/[(/]/)[0].replace(/[\s-]/g, '').slice(0, MAX_TEXTO);
  return /\d/.test(limpio) ? limpio : null;
};

const sinRepetir = (lista) => [...new Set(lista)];

/**
 * Separa lo leido en la casilla de contenedores (y, si la IA ya los aparto,
 * en la de precintos): lo que tiene formato de matricula ISO 6346 es un
 * contenedor; el resto con alguna cifra, un precinto.
 *
 * Un contenedor cuyo digito de control no cuadra sigue siendo contenedor (el
 * numero puede estar mal impreso o mal leido, pero es el del documento); se
 * devuelve tambien en `digitoIncorrecto` para avisar al agente.
 *
 * @param {Array<*>} contenedoresLeidos
 * @param {Array<*>} [precintosLeidos]
 * @returns {{ contenedores: string[], precintos: string[], digitoIncorrecto: string[],
 *   cifrasDeMas: Array<{ leido: string, numero: string, digitoCorrecto: boolean }> }}
 */
function separarContenedoresYPrecintos(contenedoresLeidos, precintosLeidos = []) {
  const todos = [
    ...(Array.isArray(contenedoresLeidos) ? contenedoresLeidos : []),
    ...(Array.isArray(precintosLeidos) ? precintosLeidos : [])
  ];
  const matriculas = todos.map(valor => ({ valor, matricula: matriculaIso6346(valor) }));
  const contenedores = matriculas.filter(m => m.matricula).map(m => m.matricula);
  // El tamaño del contenedor (40HC) tiene cifras pero no es un precinto.
  const precintos = matriculas.filter(m => !m.matricula).map(m => numeroPrecinto(m.valor))
    .filter(p => p && !TAMANO_CONTENEDOR.test(p.replace(/['’]/g, '')));

  const largas = contenedores.filter(c => c.cifrasDeMas);
  return {
    contenedores: sinRepetir(contenedores.map(c => c.numero)).slice(0, MAX_ELEMENTOS),
    precintos: sinRepetir(precintos).slice(0, MAX_ELEMENTOS),
    // Los de cifras de mas ya avisan del digito en su propia nota.
    digitoIncorrecto: sinRepetir(contenedores.filter(c => !c.digitoCorrecto && !c.cifrasDeMas).map(c => c.numero)),
    cifrasDeMas: largas.filter((c, i) => largas.findIndex(o => o.cifrasDeMas === c.cifrasDeMas) === i)
      .map(c => ({ leido: c.cifrasDeMas, numero: c.numero, digitoCorrecto: c.digitoCorrecto }))
  };
}

// ---- Tipo de carga (FCL / LCL) ----------------------------------------------------

// Expresiones de grupaje y de contenedor completo que se leen en un BL. La IA
// las transcribe tal cual en `indicacionesCarga`; la decision se toma aqui,
// en codigo, para que sea siempre la misma y se pueda probar.
const SENALES_LCL = /\bLCL\b|\bCFS\b|CONSOLIDAT|GROUPAGE|GRUPAJE|PART\s+OF\s+(?:A\s+)?CONTAINER|PARTE\s+DEL?\s+CONTENEDOR/;
const SENALES_FCL = /\bFCL\b|\bCY\s*\/\s*CY\b|SHIPPER['’]?S?\s+LOAD\b|\bSLA?C\b|\bSLCS\b/;
// Tipo y tamaño de un contenedor: 20GP, 40HC, 40'HQ, 1X40HC o el codigo ISO 6346 (22G1, 45G1, L5G1).
const TAMANO_CONTENEDOR = /^(?:\d{1,2}X)?(?:(?:20|40|45)(?:GP|HC|HQ|DV|DC|ST|SD|RF|RH|OT|FR|NOR|PW|TK)|[24L][025][GRUPTHB]\d)$/;
// Embalajes de grupaje (cajas o unidades) en un BL sin contenedor: codigos de
// tipo de bulto (Rec. 21 CEPE) y palabras habituales del BL.
const EMBALAJES_DE_GRUPAJE = new Set(['CT', 'CTN', 'CS', 'BX', 'PK', 'PCE', 'PCS', 'NAR', 'C62']);
const BULTOS_DE_GRUPAJE = /\b\d*\s*(?:CTNS?|CARTONS?|CAJAS?|BOX(?:ES)?|PCS|PIECES|UNITS?|UNIDADES)\b/;
const TIPOS_CARGA_LITERALES = { FCL: 'FCL', 'FCL/FCL': 'FCL', 'CY/CY': 'FCL', LCL: 'LCL', 'LCL/LCL': 'LCL', 'CFS/CFS': 'LCL' };

const textosLeidos = (lista) => (Array.isArray(lista) ? lista : [])
  .filter(v => typeof v === 'string' || typeof v === 'number')
  .map(v => String(v).toUpperCase().trim().slice(0, MAX_TEXTO))
  .filter(Boolean);

/** Tamaños de contenedor que aparecen en los textos leidos («MAGU5599236/40HQ» -> 40HQ). */
const tamanosDeContenedor = (textos) => sinRepetir(textos
  .flatMap(t => t.split(/[\s/,;()]+/))
  .map(p => p.replace(/['’-]/g, ''))
  .filter(p => TAMANO_CONTENEDOR.test(p)));

/**
 * Tipo de carga de un documento de transporte. Por orden:
 *  1. Lo que el documento dice literalmente (FCL, LCL, CY/CY, CFS/CFS).
 *  2. Expresiones de grupaje (CFS, LCL, consolidated, groupage, part of
 *     container) -> LCL; de contenedor completo (FCL, CY/CY, «Shipper's load,
 *     count and seal») -> FCL. Si hay de las dos, no se decide.
 *  3. En un BL, un contenedor con su matricula y su tamaño (40HC) y sin
 *     ninguna señal de grupaje -> FCL.
 * Sin señales, null: lo elige el agente. Si se deduce, se explica en una nota.
 *
 * @param {{ literal?: *, indicaciones?: Array<*>, leidosContenedor?: Array<*>, contenedores?: string[], tipo?: string }} datos
 * @returns {{ tipoCarga: 'FCL'|'LCL'|null, nota: string|null }}
 */
function deducirTipoCarga({ literal, indicaciones, leidosContenedor, contenedores = [], tipo, embalajes } = {}) {
  const directo = TIPOS_CARGA_LITERALES[String(literal ?? '').toUpperCase().replace(/\s/g, '')];
  if (directo) return { tipoCarga: directo, nota: null };

  const textos = textosLeidos(indicaciones);
  const lcl = textos.filter(t => SENALES_LCL.test(t));
  const fcl = textos.filter(t => SENALES_FCL.test(t));
  if (lcl.length > 0 && fcl.length > 0) {
    return {
      tipoCarga: null,
      nota: `El documento trae señales de grupaje (${lcl.join(', ')}) y de contenedor completo (${fcl.join(', ')}): elige el tipo de carga.`
    };
  }
  if (lcl.length > 0) return { tipoCarga: 'LCL', nota: `Tipo de carga LCL deducido de: ${lcl.join(', ')}.` };
  if (fcl.length > 0) return { tipoCarga: 'FCL', nota: `Tipo de carga FCL deducido de: ${fcl.join(', ')}.` };

  if (tipo !== 'bill_of_lading') return { tipoCarga: null, nota: null };
  // Sin FCL/LCL escrito, el tipo de carga NO se rellena: lo confirma la agente
  // con operaciones (Patricia, 17/11/2026). Solo se sugiere con la regla de las
  // agentes (Jenifer, 17/11/2026): contenedor -> FCL, da igual el tamaño; cajas
  // o unidades sin contenedor -> LCL.
  const confirmar = 'El BL no indica FCL ni LCL: confírmalo con operaciones.';
  if (contenedores.length > 0) {
    const tamanos = tamanosDeContenedor([...textos, ...textosLeidos(leidosContenedor)]);
    return {
      tipoCarga: null,
      sugerencia: 'FCL',
      nota: `${confirmar} Parece FCL: trae contenedor (${contenedores.join(', ')}${tamanos.length > 0 ? ` ${tamanos.join(', ')}` : ''}).`
    };
  }
  const enCajas = [...textosLeidos(embalajes).filter(e => EMBALAJES_DE_GRUPAJE.has(e)), ...textos.filter(t => BULTOS_DE_GRUPAJE.test(t))];
  if (enCajas.length > 0) {
    return { tipoCarga: null, sugerencia: 'LCL', nota: `${confirmar} Parece LCL: no trae contenedor y la mercancía va en cajas o unidades (${sinRepetir(enCajas).join(', ')}).` };
  }
  return { tipoCarga: null, nota: null };
}

// ---- Ciudad sin el codigo de estado ------------------------------------------------

// En las direcciones de EE. UU., Canada y Mexico la ciudad va seguida del
// codigo del estado o la provincia («SOLON OH 44139», «MADERO CMX 07918»).
const CODIGOS_DE_ESTADO = {
  US: ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY',
    'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND',
    'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'PR'],
  CA: ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'],
  // ISO 3166-2:MX, mas las abreviaturas habituales de Ciudad de Mexico.
  MX: ['AGU', 'BCN', 'BCS', 'CAM', 'CHP', 'CHH', 'CMX', 'CDMX', 'DF', 'COA', 'COL', 'DUR', 'GUA', 'GRO',
    'HID', 'JAL', 'MEX', 'MIC', 'MOR', 'NAY', 'NLE', 'OAX', 'PUE', 'QUE', 'ROO', 'SLP', 'SIN', 'SON',
    'TAB', 'TAM', 'TLA', 'VER', 'YUC', 'ZAC']
};
// Ciudad de Mexico es a la vez estado y ciudad: su codigo solo si es una ciudad.
const ESTADO_QUE_ES_CIUDAD = { MX: { CMX: 'CIUDAD DE MEXICO', CDMX: 'CIUDAD DE MEXICO', DF: 'CIUDAD DE MEXICO' } };

/**
 * Ciudad sin el codigo de estado o provincia que la acompaña. Solo se quita
 * si el pais es EE. UU., Canada o Mexico y el codigo va en mayusculas al
 * final; un codigo de estado solo no es una ciudad (salvo el de Ciudad de
 * Mexico) y se descarta.
 *
 * @param {string|null} ciudad
 * @param {string|null} pais codigo ISO de dos letras
 * @returns {string|null}
 */
function ciudadSinEstado(ciudad, pais) {
  if (!ciudad) return null;
  const codigos = CODIGOS_DE_ESTADO[pais];
  if (!codigos) return ciudad;
  const hallado = /^(.*?)[\s,]*\b([A-Z]{2,4})\.?$/.exec(ciudad.trim());
  if (!hallado || !codigos.includes(hallado[2])) return ciudad;
  const resto = hallado[1].replace(/[\s,;-]+$/, '').trim();
  if (resto) return resto;
  return ESTADO_QUE_ES_CIUDAD[pais]?.[hallado[2]] || null;
}

// ---- Vuelo ------------------------------------------------------------------------

// Codigo de compañia (dos caracteres, al menos una letra) y numero de vuelo,
// con el dia del mes que el AWB pone detras («5X 1441/23»). Despues, un
// separador antes del siguiente vuelo.
const VUELO = /^\s*((?:[A-Z][A-Z0-9]|\d[A-Z])\s?\d{1,4}[A-Z]?)(?:\/\d{1,2}(?=\s*(?:[,;/]|$)))?\s*(?:[,;/]|$)/;

/**
 * Vuelo que va como medio de transporte: el primero del AWB, sin el dia.
 * Si lo leido no son numeros de vuelo, se deja tal cual.
 *
 * @param {string|null} medio
 * @returns {{ vuelo: string|null, otros: string[] }}
 */
function vueloPrincipal(medio) {
  if (!medio) return { vuelo: null, otros: [] };
  const vuelos = [];
  let resto = String(medio).toUpperCase();
  while (resto.trim() !== '') {
    const hallado = VUELO.exec(resto);
    if (!hallado || hallado[0] === '') return { vuelo: medio, otros: [] };
    vuelos.push(hallado[1]);
    resto = resto.slice(hallado[0].length);
  }
  return vuelos.length > 0 ? { vuelo: vuelos[0], otros: vuelos.slice(1) } : { vuelo: medio, otros: [] };
}

// ---- Nacionalidad del medio de transporte -----------------------------------------

// Signos distintivos de los vehiculos en circulacion internacional que no
// coinciden con el codigo ISO 3166-1 alfa-2 del pais (Convencion sobre la
// circulacion vial, Viena, 8/Nov/1968, art. 37 y anexo 3; lista de signos
// notificados al Secretario General de la ONU, publicada por la CEPE). Son los
// que lleva la matricula de un camion en un CMR («E», «D», «PL»). Solo se
// recogen los de paises europeos y ribereños del Mediterraneo; los signos de
// dos letras que coinciden con el codigo ISO (PL, NL, TR, MA…) no necesitan
// conversion.
const SIGNO_DISTINTIVO_A_ISO = {
  A: 'AT', B: 'BE', D: 'DE', E: 'ES', F: 'FR', H: 'HU', I: 'IT', L: 'LU', M: 'MT', N: 'NO', P: 'PT', S: 'SE',
  UK: 'GB', FL: 'LI', EST: 'EE', FIN: 'FI', IRL: 'IE', SLO: 'SI', SRB: 'RS', BIH: 'BA', MNE: 'ME', NMK: 'MK',
  RUS: 'RU', AND: 'AD'
};

/**
 * Nacionalidad del medio de transporte en codigo ISO de dos letras, a partir
 * de lo que transcribe la IA: un codigo ISO («PA», «tr») o el signo
 * distintivo de la matricula («E», «UK», «SLO»). Nunca se deduce de otra
 * cosa (nombre del buque, naviera, IMO): lo que no es ninguno de los dos da
 * null.
 *
 * @param {*} valor
 * @returns {{ pais: string|null, signo: string|null }} `signo` es lo leido
 *   cuando ha habido que convertirlo
 */
function nacionalidadDelMedio(valor) {
  if (typeof valor !== 'string') return { pais: null, signo: null };
  const limpio = valor.trim().toUpperCase().replace(/\.$/, '');
  if (SIGNO_DISTINTIVO_A_ISO[limpio]) return { pais: SIGNO_DISTINTIVO_A_ISO[limpio], signo: limpio };
  return { pais: /^[A-Z]{2}$/.test(limpio) ? limpio : null, signo: null };
}

// ---- Numero IMO del buque -----------------------------------------------------------

/**
 * Numero IMO de identificacion del buque: siete cifras, la ultima de control
 * (suma de las seis primeras por 7, 6, 5, 4, 3 y 2, modulo 10). Resolucion
 * OMI A.1117(30), «Sistema de asignacion de un numero OMI de identificacion
 * del buque». Admite el prefijo «IMO».
 *
 * @param {*} valor
 * @returns {{ numero: string, digitoCorrecto: boolean } | null}
 */
function numeroImo(valor) {
  if (valor === null || valor === undefined || typeof valor === 'object') return null;
  const limpio = String(valor).toUpperCase().replace(/^\s*IMO[\s.:#-]*/, '').replace(/\s/g, '');
  if (!/^\d{7}$/.test(limpio)) return null;
  const suma = [...limpio.slice(0, 6)].reduce((total, cifra, i) => total + Number(cifra) * (7 - i), 0);
  return { numero: limpio, digitoCorrecto: suma % 10 === Number(limpio[6]) };
}

// ---- MRN ---------------------------------------------------------------------------

// MRN: año (2), pais (2), identificador (12), procedimiento (1) y digito de
// control (1). Reglamento de Ejecucion (UE) 2015/2447, anexo B, titulo II; el
// digito de control se calcula como el de ISO 6346 (comprobado con MRN reales
// de la AEAT: 26ES002801501092J0, 26ESH7A000067965R5).
const FORMATO_MRN = /^\d{2}[A-Z]{2}[A-Z0-9]{14}$/;

/**
 * MRN leido en un documento (con espacios o guiones), o null si no tiene la
 * forma de un MRN.
 *
 * @param {*} valor
 * @returns {{ numero: string, digitoCorrecto: boolean } | null}
 */
function mrnLeido(valor) {
  if (valor === null || valor === undefined || typeof valor === 'object') return null;
  const limpio = String(valor).toUpperCase().replace(/[\s.\-/]/g, '');
  if (!FORMATO_MRN.test(limpio)) return null;
  return { numero: limpio, digitoCorrecto: String(digitoControlIso6346(limpio.slice(0, 17))) === limpio[17] };
}

module.exports = {
  digitoControlIso6346,
  matriculaIso6346,
  separarContenedoresYPrecintos,
  deducirTipoCarga,
  ciudadSinEstado,
  vueloPrincipal,
  nacionalidadDelMedio,
  numeroImo,
  mrnLeido
};
