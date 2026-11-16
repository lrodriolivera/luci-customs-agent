/**
 * Documentos de la casilla 44 de cada partida del H1 que añade la agente a
 * partir de lo que exige el Arancel Integrado de la AEAT (certificados,
 * licencias, declaraciones). UAT 16/Nov/2026.
 *
 * Donde va cada uno en el CC415A (XSD ES_ctypes, GoodsShipmentItem):
 * - SupportingDocument (documento justificativo): referenceNumber OBLIGATORIO.
 *   Codigos C, N, L, numericos nacionales...: certificados y documentos que
 *   tienen un numero.
 * - AdditionalReference (referencia adicional): referenceNumber opcional.
 *   Codigos Y: declaraciones de que no aplica un requisito (p. ej. Y081 "no
 *   existe identificador normalizado"), que no tienen numero.
 * Comprobado en preproduccion el 16/11/2026 (modo prueba):
 * - N003 como SupportingDocument + Y081 como AdditionalReference: admitido
 *   (MRN 26ES002801I01BQKR2).
 * - Y081 como SupportingDocument: error 50612 ("los Type que empiezan por Y se
 *   deben declarar en additional.Reference").
 * - C990 como SupportingDocument: error 50610 (es un tipo de autorizacion,
 *   tabla CSRDC605, no un documento).
 * - 1235 (SOIVRE PUE): error 14206, solo en declaraciones V o Z.
 * - 1310 (SOIVRE): el numero se valida contra la VUA/PUE (error 14611 con uno
 *   inventado): hace falta el numero real del certificado.
 */

const TIPO = /^[A-Z0-9]{4}$/;
const MAX_REFERENCIA = 70; // DocumentRefNumberContentType: .{1,70}
const MAX_DOCUMENTOS = 20;

class ErrorDocumentosC44 extends Error {
  constructor(message) {
    super(message);
    this.name = 'ErrorDocumentosC44';
  }
}

// Tipos de autorizacion (guia CAU, separata 4): no son documentos de la partida.
const AUTORIZACIONES = new Set(['C990', 'N990', 'D019']);
// Solo en declaraciones complementarias V o Z (error 14206); LUCI no las presenta.
const SOLO_V_Z = new Set(['1230', '1235']);

/** Los codigos Y son declaraciones sin numero: van como referencia adicional. */
const esReferenciaAdicional = (tipo) => /^Y/.test(tipo);

/**
 * Valida y normaliza la lista que llega del cliente.
 * @param {unknown} documentos
 * @returns {{ tipo: string, referencia?: string, medida?: string }[]}
 * @throws {ErrorDocumentosC44}
 */
function normalizarDocumentosC44(documentos) {
  if (!Array.isArray(documentos)) throw new ErrorDocumentosC44('Los documentos deben ser una lista');
  if (documentos.length > MAX_DOCUMENTOS) throw new ErrorDocumentosC44(`Como máximo ${MAX_DOCUMENTOS} documentos por partida`);
  const vistos = new Set();
  return documentos.map((d, i) => {
    const tipo = String(d?.tipo || '').trim().toUpperCase();
    const referencia = String(d?.referencia || '').trim();
    const medida = String(d?.medida || '').trim().slice(0, 20);
    if (!TIPO.test(tipo)) throw new ErrorDocumentosC44(`Documento ${i + 1}: el código debe tener 4 letras o cifras (p. ej. N003, 1310, Y081)`);
    if (AUTORIZACIONES.has(tipo)) throw new ErrorDocumentosC44(`Documento ${i + 1} (${tipo}): es una autorización, no un documento de la partida; la AEAT lo rechaza en la casilla 44 (error 50610)`);
    if (SOLO_V_Z.has(tipo)) throw new ErrorDocumentosC44(`Documento ${i + 1} (${tipo}): la AEAT solo lo admite en declaraciones complementarias V o Z (error 14206)`);
    if (referencia.length > MAX_REFERENCIA) throw new ErrorDocumentosC44(`Documento ${i + 1} (${tipo}): el número no puede superar ${MAX_REFERENCIA} caracteres`);
    if (!referencia && !esReferenciaAdicional(tipo)) throw new ErrorDocumentosC44(`Documento ${i + 1} (${tipo}): falta el número del documento`);
    const clave = `${tipo}|${referencia}`;
    if (vistos.has(clave)) throw new ErrorDocumentosC44(`Documento ${i + 1} (${tipo}): está repetido`);
    vistos.add(clave);
    return { tipo, ...(referencia ? { referencia } : {}), ...(medida ? { medida } : {}) };
  });
}

/**
 * Reparte los documentos de la partida entre justificativos y referencias
 * adicionales, con la forma que espera el constructor del XML.
 */
function separarDocumentosC44(documentos) {
  const lista = documentos || [];
  return {
    justificativos: lista.filter((d) => !esReferenciaAdicional(d.tipo)).map((d) => ({ tipo: d.tipo, referencia: d.referencia })),
    referencias: lista.filter((d) => esReferenciaAdicional(d.tipo)).map((d) => ({ tipo: d.tipo, ...(d.referencia ? { referencia: d.referencia } : {}) }))
  };
}

module.exports = { normalizarDocumentosC44, separarDocumentosC44, esReferenciaAdicional, ErrorDocumentosC44, MAX_DOCUMENTOS };
