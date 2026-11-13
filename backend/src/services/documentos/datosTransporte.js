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

/**
 * Matricula de contenedor contenida en un texto leido («MAGU5599236/40HQ»,
 * «tghu 884221-7»), o null si no hay ninguna con el formato ISO 6346.
 *
 * @param {*} valor
 * @returns {{ numero: string, digitoCorrecto: boolean } | null}
 */
function matriculaIso6346(valor) {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null;
  const compacto = String(valor).toUpperCase().replace(/[\s-]/g, '');
  const hallada = MATRICULA_ISO.exec(compacto);
  if (!hallada) return null;
  const numero = hallada[0];
  return { numero, digitoCorrecto: digitoControlIso6346(numero.slice(0, 10)) === Number(numero[10]) };
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
 * @returns {{ contenedores: string[], precintos: string[], digitoIncorrecto: string[] }}
 */
function separarContenedoresYPrecintos(contenedoresLeidos, precintosLeidos = []) {
  const todos = [
    ...(Array.isArray(contenedoresLeidos) ? contenedoresLeidos : []),
    ...(Array.isArray(precintosLeidos) ? precintosLeidos : [])
  ];
  const matriculas = todos.map(valor => ({ valor, matricula: matriculaIso6346(valor) }));
  const contenedores = matriculas.filter(m => m.matricula).map(m => m.matricula);
  const precintos = matriculas.filter(m => !m.matricula).map(m => numeroPrecinto(m.valor)).filter(Boolean);

  return {
    contenedores: sinRepetir(contenedores.map(c => c.numero)).slice(0, MAX_ELEMENTOS),
    precintos: sinRepetir(precintos).slice(0, MAX_ELEMENTOS),
    digitoIncorrecto: sinRepetir(contenedores.filter(c => !c.digitoCorrecto).map(c => c.numero))
  };
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

module.exports = {
  digitoControlIso6346,
  matriculaIso6346,
  separarContenedoresYPrecintos,
  ciudadSinEstado,
  vueloPrincipal
};
