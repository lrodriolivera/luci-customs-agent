/**
 * Documentos subidos en el alta, antes de que exista el expediente.
 *
 * UAT 10/Nov/2026: el agente pidio empezar el alta subiendo la documentacion
 * para que LUCI rellenase el formulario y que esos documentos quedasen ya
 * adjuntos al expediente. Un borrador es de quien lo sube: nadie mas puede
 * adjuntarlo ni borrarlo.
 */

const mongoose = require('mongoose');
const logger = require('../../config/logger');
const { DocumentDraft } = require('../../models');
const aiService = require('../aiService');
const { fileUtils } = require('../../middleware/upload');

const HORAS_DE_VIDA = 24;
const MAX_BORRADORES_POR_ALTA = 10;

// Tipos que el lector sabe distinguir; coinciden con los del expediente.
const TIPOS_DETECTABLES = [
  'commercial_invoice', 'proforma_invoice', 'packing_list', 'bill_of_lading',
  'air_waybill', 'cmr', 'certificate_origin'
];

const esId = (valor) => typeof valor === 'string' && mongoose.Types.ObjectId.isValid(valor);

/** Lo que la pantalla necesita de un borrador (sin rutas del servidor). */
const resumen = (borrador) => ({
  id: String(borrador._id),
  type: borrador.type,
  originalName: borrador.originalName,
  fileSize: borrador.fileSize
});

/**
 * Borra los borradores con mas de 24 horas y sus archivos. Se llama al subir
 * uno nuevo: no hace falta un proceso programado.
 *
 * @param {Date} [ahora]
 * @returns {Promise<number>} borradores eliminados
 */
async function limpiarCaducados(ahora = new Date()) {
  const limite = new Date(ahora.getTime() - HORAS_DE_VIDA * 60 * 60 * 1000);
  const caducados = await DocumentDraft.find({ createdAt: { $lt: limite } }).select('fileName').lean();
  for (const borrador of caducados) fileUtils.deleteFile(borrador.fileName);
  if (caducados.length > 0) {
    await DocumentDraft.deleteMany({ _id: { $in: caducados.map(b => b._id) } });
    logger.info(`Borradores de documento caducados eliminados: ${caducados.length}`);
  }
  return caducados.length;
}

/**
 * Guarda el archivo recien subido como borrador y lo lee con la IA.
 *
 * Si el agente no indico el tipo («other») y el lector lo reconoce, el borrador
 * toma el tipo detectado.
 *
 * @param {{ user: object, file: object, tipo: string }} datos `file` es el de multer
 * @returns {Promise<{ draft: object, extraction: object }>}
 */
async function crearBorrador({ user, file, tipo }) {
  await limpiarCaducados().catch(err => logger.warn(`No se pudieron limpiar borradores caducados: ${err.message}`));

  const base = {
    type: tipo,
    fileName: file.filename,
    originalName: file.originalname,
    filePath: file.path,
    fileSize: file.size,
    mimeType: file.mimetype
  };

  let lectura;
  try {
    lectura = await aiService.extractDocumentData(base);
  } catch (error) {
    // Sin lectura no hay borrador: el archivo no debe quedar huerfano.
    fileUtils.deleteFile(file.filename);
    throw error;
  }
  const { leido, modelo, ...datos } = lectura;
  const extraction = { ...datos, leido, modelo: modelo || null, leidoEn: new Date() };
  const detectado = leido && datos.legible && TIPOS_DETECTABLES.includes(datos.tipoDetectado) ? datos.tipoDetectado : null;

  const borrador = await DocumentDraft.create({
    ...base,
    type: tipo === 'other' && detectado ? detectado : tipo,
    tenantId: user.tenantId,
    userId: user._id,
    extractedData: extraction,
    aiConfidence: datos.confianza
  });

  return { draft: resumen(borrador), extraction };
}

/**
 * Elimina un borrador del usuario y su archivo.
 *
 * @returns {Promise<boolean>} false si no existe o no es suyo
 */
async function eliminarBorrador(id, user) {
  if (!esId(id)) return false;
  const borrador = await DocumentDraft.findOneAndDelete({ _id: id, userId: user._id });
  if (!borrador) return false;
  fileUtils.deleteFile(borrador.fileName);
  return true;
}

/**
 * Pasa al expediente (aun sin guardar) los borradores que indica el alta.
 *
 * Solo se adjuntan los que son del usuario; el resto se ignora. El tipo puede
 * venir corregido por el agente. Devuelve los identificadores adjuntados para
 * borrarlos con `descartarAdjuntados` una vez guardado el expediente.
 *
 * @param {object} expedition documento Mongoose del expediente
 * @param {Array<{ id: string, type?: string }>} pedidos
 * @param {object} user
 * @param {string[]} tiposValidos tipos de documento admitidos
 * @returns {Promise<string[]>} identificadores de los borradores adjuntados
 */
async function adjuntarBorradores(expedition, pedidos, user, tiposValidos) {
  const lista = (Array.isArray(pedidos) ? pedidos : [])
    .filter(p => p && esId(p.id))
    .slice(0, MAX_BORRADORES_POR_ALTA);
  if (lista.length === 0) return [];

  const borradores = await DocumentDraft.find({ _id: { $in: lista.map(p => p.id) }, userId: user._id });
  const adjuntados = [];

  for (const pedido of lista) {
    const borrador = borradores.find(b => String(b._id) === pedido.id);
    if (!borrador || adjuntados.includes(pedido.id)) continue;
    const type = tiposValidos.includes(pedido.type) ? pedido.type : borrador.type;

    expedition.documents.push({
      type,
      fileName: borrador.fileName,
      originalName: borrador.originalName,
      filePath: borrador.filePath,
      fileSize: borrador.fileSize,
      mimeType: borrador.mimeType,
      uploadedAt: borrador.createdAt,
      uploadedBy: user._id,
      status: 'pending',
      extractedData: borrador.extractedData,
      aiConfidence: borrador.aiConfidence
    });
    const documento = expedition.documents[expedition.documents.length - 1];

    const pendiente = (expedition.documentChecklist || []).find(i => i.documentType === type && !i.received);
    if (pendiente) {
      pendiente.received = true;
      pendiente.documentId = documento._id;
    }
    expedition.timeline.push({
      action: 'document_uploaded',
      description: `Documento ${type} subido en el alta`,
      userId: user._id,
      performedBy: user.name,
      metadata: { documentType: type, fileName: borrador.originalName }
    });
    adjuntados.push(pedido.id);
  }
  return adjuntados;
}

/** Borra los borradores ya adjuntados. El archivo se queda: ahora es del expediente. */
async function descartarAdjuntados(ids) {
  if (!ids || ids.length === 0) return;
  await DocumentDraft.deleteMany({ _id: { $in: ids } });
}

module.exports = {
  crearBorrador,
  eliminarBorrador,
  adjuntarBorradores,
  descartarAdjuntados,
  limpiarCaducados,
  MAX_BORRADORES_POR_ALTA
};
