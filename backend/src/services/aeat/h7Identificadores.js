/**
 * Reglas de la AEAT para las partidas del H7 (servicio AltaH7V1).
 * Fuente: «Servicio de presentación de declaraciones H7» v3.23 (15/10/2026) y
 * XSD TiposDatosH7.xsd (tipo goodsItemTd2).
 *
 *  - commodityCode es alfaNum8Td: exactamente 8 caracteres (código NC). Si se
 *    envía el TARIC de 10 cifras la AEAT rechaza con 2101 «La longitud máxima
 *    debe ser 8». Se envían las 8 primeras cifras; con menos de 8 no se envía.
 *  - R23 nota [4], R232 y C321: con F48, F49 o F53 (sin F15) cada partida lleva
 *    al menos un C127 (identificador del producto comercial) y un C128
 *    (identificador no normalizado del fabricante) como SupportingDocument, y
 *    un C129 (identificador normalizado, p. ej. GTIN/EAN) como SupportingDocument
 *    o, si no existe, un Y081 como AdditionalReference. Error 1353 si faltan.
 *    Desde el 15/03/2027 no se admiten en cabecera: LUCI los pone solo en la partida.
 *
 * Funciones puras (sin BD ni red).
 */

const CODIGOS_CON_IDENTIFICADORES = ['F48', 'F49', 'F53'];

/**
 * addRefNum del Y081. La guía (10.1.1, AdditionalReference de la partida) dice
 * «Es obligatorio declararla» aunque el XSD lo marque opcional, y no fija valor:
 * se envía un texto que repite el significado del código.
 */
const Y081_REF_NUM = 'NO EXISTE IDENTIFICADOR NORMALIZADO DEL FABRICANTE';

const MAX_IDENTIFICADOR = 70; // alfaNumMax70Td
const GTIN_RE = /^(\d{8}|\d{12}|\d{13}|\d{14})$/; // GTIN-8/12/13/14 (EAN, UPC, ISBN-13)

/** Las 8 cifras de la NC a partir de un NC (8) o TARIC (10), o null si no lo es. */
function codigoNC8(taricCode) {
  const cifras = String(taricCode == null ? '' : taricCode).replace(/[\s.]/g, '');
  if (!/^\d{8}(\d{2})?$/.test(cifras)) return null;
  return cifras.substring(0, 8);
}

// Codigos de relleno que LUCI ponia por defecto ('9999000000') o vacios ('0000...'):
// tienen formato valido pero no son una NC; no se envian a la AEAT.
const NC_FICTICIO_RE = /^(9999|0000)/;

/**
 * EAN/GTIN de una carga masiva: solo cifras (Excel mete guiones o espacios) y,
 * si no queda un GTIN valido, undefined (se declarara Y081) en vez de romper el alta.
 */
function normalizarGtin(valor) {
  const cifras = String(valor == null ? '' : valor).replace(/\D/g, '');
  return GTIN_RE.test(cifras) ? cifras : undefined;
}

/**
 * Código adicional de procedimiento del H7 (Guía H7, apdo. 12):
 * F48 = IOSS | F49 = acuerdos especiales | F53 = IVA a la importación | C08 = entre particulares.
 */
function codigoAdicionalH7(h7) {
  if (h7 && h7.additionalProcedureCode) return h7.additionalProcedureCode;
  return h7 && h7.vatPrepaid && /^IM\d{10}$/.test(h7.iossNumber || '') ? 'F48' : 'F53';
}

function exigeIdentificadoresDeProducto(codigoAdicional) {
  return CODIGOS_CON_IDENTIFICADORES.includes(codigoAdicional);
}

const _texto = (v) => (typeof v === 'string' ? v.trim() : (v == null ? '' : String(v).trim()));

function _error(i, campo, code, message) {
  return { partida: i + 1, field: `items.${i}.${campo}`, code, message: `Partida ${i + 1}: ${message}` };
}

function _erroresDePartida(item, i, conIdentificadores) {
  const errores = [];
  const taric = _texto(item && item.taricCode);
  const nc = codigoNC8(taric);
  if (!nc) {
    errores.push(_error(i, 'taricCode', 'H7_NC_8_CIFRAS',
      `el código "${taric}" no vale para la AEAT; el H7 exige el código NC de 8 cifras (o el TARIC de 10).`));
  } else if (NC_FICTICIO_RE.test(nc)) {
    errores.push(_error(i, 'taricCode', 'H7_NC_FICTICIO',
      `el código "${taric}" es un valor de relleno, no una NC real; clasifica la mercancía antes de presentar.`));
  }
  if (!conIdentificadores) return errores;

  const comercial = _texto(item && item.commercialId);
  const fabricante = _texto(item && item.manufacturerRef);
  const gtin = _texto(item && item.gtin);
  if (!comercial) {
    errores.push(_error(i, 'commercialId', 'H7_FALTA_C127',
      'falta el identificador comercial del producto (C127, p. ej. la referencia o SKU del vendedor).'));
  }
  if (!fabricante) {
    errores.push(_error(i, 'manufacturerRef', 'H7_FALTA_C128',
      'falta la referencia del fabricante (C128, identificador no normalizado del fabricante).'));
  }
  [['commercialId', comercial, 'C127'], ['manufacturerRef', fabricante, 'C128'], ['gtin', gtin, 'C129']]
    .filter(([, valor]) => valor.length > MAX_IDENTIFICADOR)
    .forEach(([campo, , doc]) => errores.push(_error(i, campo, 'H7_IDENTIFICADOR_LARGO',
      `el identificador ${doc} supera los ${MAX_IDENTIFICADOR} caracteres que admite la AEAT.`)));
  if (gtin && !GTIN_RE.test(gtin)) {
    errores.push(_error(i, 'gtin', 'H7_C129_FORMATO',
      `el código EAN/GTIN "${gtin}" debe tener 8, 12, 13 o 14 cifras (déjalo vacío si el producto no tiene).`));
  }
  return errores;
}

/**
 * Errores que impedirían a la AEAT aceptar las partidas del H7.
 * @param {Array<object>} items partidas del modelo H7Declaration
 * @param {string} codigoAdicional F48 | F49 | F53 | C08 ...
 * @returns {Array<{partida?:number, field:string, code:string, message:string}>}
 */
function validarPartidasH7ParaAeat(items, codigoAdicional) {
  if (!Array.isArray(items) || items.length === 0) {
    return [{ field: 'items', code: 'H7_SIN_PARTIDAS', message: 'El H7 no tiene partidas: la AEAT exige al menos una.' }];
  }
  const conIdentificadores = exigeIdentificadoresDeProducto(codigoAdicional);
  return items.flatMap((item, i) => _erroresDePartida(item, i, conIdentificadores));
}

module.exports = {
  CODIGOS_CON_IDENTIFICADORES,
  Y081_REF_NUM,
  codigoNC8,
  normalizarGtin,
  codigoAdicionalH7,
  exigeIdentificadoresDeProducto,
  validarPartidasH7ParaAeat
};
