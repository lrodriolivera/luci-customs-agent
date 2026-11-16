/**
 * ¿Se puede declarar este codigo TARIC de 10 digitos?
 *
 * En el DUA (casilla 33 / dato 6/14-6/17 del CAU) solo cabe una linea del
 * ultimo nivel de la nomenclatura TARIC vigente: una linea que tiene
 * subdivisiones no es declarable. Fuente: Reglamento (CEE) 2658/87, art. 3
 * (estructura NC/TARIC, EUR-Lex CELEX 31987R2658) y la consulta del TARIC
 * de la Comision Europea, que solo marca como declarables las hojas.
 *
 * Caso real de preproduccion (17/Nov/2026): la IA propuso 8518300000 para
 * unos auriculares Bluetooth y se aplico al expediente; la linea tiene las
 * subdivisiones 8518300010 (aeronaves civiles) y 8518300090 (los demas).
 *
 * Una linea con subdivisiones se reconoce por el prefijo: en la numeracion
 * NC/TARIC sus descendientes empiezan por el codigo sin los pares de ceros
 * finales (8518300000 -> 851830). No se fia de `isLeaf`: hay fichas del
 * catalogo marcadas como no hoja cuyas subdivisiones cuelgan de otro prefijo
 * de 8 digitos (8542390000 -> 8542391100…), y fichas sin el campo.
 *
 * Sin base de datos o con el catalogo vacio no se comprueba nada
 * (`comprobado: false`): no se puede afirmar ni que vale ni que no.
 */
const mongoose = require('mongoose');
const { escapeRegex } = require('../../utils/escapeRegex');

const MAX_ALTERNATIVAS = 20;
const LONGITUDES_ALTERNATIVAS = [8, 6];

const normalizar = (codigo) => (typeof codigo === 'string' || typeof codigo === 'number'
  ? String(codigo).replace(/[\s.]/g, '')
  : '');

/** Prefijo comun a todas las subdivisiones de una linea: quita los pares de ceros finales. */
function prefijoDeSubdivisiones(codigo) {
  let prefijo = codigo;
  while (prefijo.length > 2 && prefijo.endsWith('00')) prefijo = prefijo.slice(0, -2);
  return prefijo;
}

const resumen = (c) => ({
  code: c.code,
  description: String(c.description?.es || c.description?.en || '').slice(0, 300)
});

async function subdivisiones(TaricCode, codigo) {
  const prefijo = prefijoDeSubdivisiones(codigo);
  if (prefijo === codigo) return [];
  return TaricCode.find({
    code: { $regex: `^${escapeRegex(prefijo)}`, $ne: codigo },
    isActive: { $ne: false }
  }).sort({ code: 1 }).lean();
}

/** Hojas activas bajo la misma subpartida NC (8) o, si no hay, SA (6). */
async function alternativasDeclarables(TaricCode, codigo) {
  for (const longitud of LONGITUDES_ALTERNATIVAS) {
    const candidatas = await TaricCode.find({
      code: { $regex: `^${escapeRegex(codigo.slice(0, longitud))}`, $ne: codigo },
      isActive: { $ne: false }
    }).sort({ code: 1 }).lean();
    const esHoja = (c) => {
      const prefijo = prefijoDeSubdivisiones(c.code);
      return prefijo === c.code || !candidatas.some(o => o.code !== c.code && o.code.startsWith(prefijo));
    };
    const hojas = candidatas.filter(esHoja);
    if (hojas.length > 0) return hojas.slice(0, MAX_ALTERNATIVAS).map(resumen);
  }
  return [];
}

/**
 * @param {string} codigoEntrada codigo TARIC (admite espacios y puntos)
 * @returns {Promise<{comprobado: boolean, codigo: string, declarable?: boolean,
 *   motivo?: string, alternativas?: Array<{code: string, description: string}>}>}
 */
async function comprobarDeclarable(codigoEntrada) {
  const codigo = normalizar(codigoEntrada);
  if (!/^\d{10}$/.test(codigo) || mongoose.connection.readyState !== 1) {
    return { comprobado: false, codigo };
  }

  const TaricCode = require('../../models/TaricCode');
  if (await TaricCode.estimatedDocumentCount() === 0) return { comprobado: false, codigo };

  const ficha = await TaricCode.findOne({ code: codigo }).lean();
  if (!ficha) {
    return {
      comprobado: true,
      codigo,
      declarable: false,
      motivo: `El código ${codigo} no existe en el catálogo TARIC vigente`,
      alternativas: await alternativasDeclarables(TaricCode, codigo)
    };
  }
  if (ficha.isActive === false) {
    return {
      comprobado: true,
      codigo,
      declarable: false,
      motivo: `El código ${codigo} está dado de baja en el TARIC`,
      alternativas: await alternativasDeclarables(TaricCode, codigo)
    };
  }

  const hijas = await subdivisiones(TaricCode, codigo);
  if (hijas.length > 0) {
    return {
      comprobado: true,
      codigo,
      declarable: false,
      motivo: `El código ${codigo} no es declarable: tiene subdivisiones TARIC; elija una de ellas`,
      alternativas: await alternativasDeclarables(TaricCode, codigo)
    };
  }

  return { comprobado: true, codigo, declarable: true };
}

/**
 * Para los endpoints que escriben el TARIC en el expediente: si el codigo no
 * es declarable responde 422 con las alternativas y devuelve true (el
 * controlador debe parar). Si no se pudo comprobar, deja pasar.
 */
async function rechazarNoDeclarable(codigo, res) {
  const r = await comprobarDeclarable(codigo);
  if (!r.comprobado || r.declarable) return false;
  res.status(422).json({
    success: false,
    error: r.motivo,
    data: { taricCode: r.codigo, alternatives: r.alternativas }
  });
  return true;
}

module.exports = { comprobarDeclarable, rechazarNoDeclarable, prefijoDeSubdivisiones };
