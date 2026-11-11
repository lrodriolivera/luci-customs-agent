/**
 * Autorizacion de despacho vigente de un cliente.
 *
 * La autorizacion de despacho (poder de representacion aduanera) vale cuatro
 * años. Si el cliente ya la entrego en una operacion anterior del mismo
 * despacho, no hay que volver a pedirsela: en el checklist debe salir marcada
 * (criterio de la agente de aduanas, UAT del 11/Nov/2026).
 *
 * Los cuatro años cuentan desde la fecha de la autorizacion, que indica quien
 * la sube (`documentDate`). Las autorizaciones subidas antes de que existiera
 * ese campo no la tienen: para ellas se toma la fecha de subida.
 */
const { Expedition } = require('../../models');

const TIPO_AUTORIZACION = 'dispatch_authorization';
const VIGENCIA_ANIOS = 4;
const MAX_EXPEDIENTES = 200;

const sumarAnios = (fecha, anios) => {
  const d = new Date(fecha);
  d.setFullYear(d.getFullYear() + anios);
  return d;
};

/**
 * Autorizacion de despacho mas reciente y todavia vigente que el mismo cliente
 * (mismo NIF, mismo tenant) entrego en OTRO expediente.
 *
 * Sin tenant o sin NIF no se busca nada: nunca se cruza informacion entre
 * despachos ni entre clientes sin identificar.
 *
 * @param {object} expedition
 * @param {{ ahora?: Date }} [opciones]
 * @returns {Promise<{ expeditionId: string, fecha: Date, validaHasta: Date }|null>}
 */
async function autorizacionVigente(expedition, { ahora = new Date() } = {}) {
  const nif = String(expedition?.client?.nif || '').trim();
  if (!expedition?.tenantId || !nif) return null;

  const desde = sumarAnios(ahora, -VIGENCIA_ANIOS);
  const anteriores = await Expedition.find({
    _id: { $ne: expedition._id },
    tenantId: expedition.tenantId,
    'client.nif': nif,
    documents: { $elemMatch: { type: TIPO_AUTORIZACION, status: { $ne: 'rejected' } } }
  }).select('expeditionId documents.type documents.status documents.uploadedAt documents.documentDate')
    .sort({ createdAt: -1 }).limit(MAX_EXPEDIENTES).lean();

  let mejor = null;
  anteriores.forEach((anterior) => {
    (anterior.documents || []).forEach((doc) => {
      const origen = doc.documentDate || doc.uploadedAt;
      if (doc.type !== TIPO_AUTORIZACION || doc.status === 'rejected' || !origen) return;
      const fecha = new Date(origen);
      if (fecha <= desde || fecha > ahora) return;
      if (!mejor || fecha > mejor.fecha) mejor = { expeditionId: anterior.expeditionId, fecha };
    });
  });

  return mejor ? { ...mejor, validaHasta: sumarAnios(mejor.fecha, VIGENCIA_ANIOS) } : null;
}

const fechaCorta = (fecha) => new Date(fecha).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' });

/**
 * Checklist (objetos planos) con la autorizacion de despacho marcada como
 * entregada cuando la cubre una operacion anterior. No toca el resto ni lo
 * que ya esta recibido en este expediente.
 *
 * @param {Array<object>} checklist
 * @param {{ expeditionId: string, fecha: Date, validaHasta: Date }|null} vigente
 * @returns {Array<object>}
 */
function aplicarAutorizacionVigente(checklist, vigente) {
  if (!vigente) return checklist;
  return checklist.map((item) => {
    if (item.documentType !== TIPO_AUTORIZACION || item.received) return item;
    return {
      ...item,
      received: true,
      coveredByPrevious: {
        expeditionId: vigente.expeditionId,
        date: vigente.fecha,
        validUntil: vigente.validaHasta
      },
      notes: `Vigente: autorizacion del ${fechaCorta(vigente.fecha)}, entregada en el expediente ${vigente.expeditionId}. ` +
        `Valida hasta el ${fechaCorta(vigente.validaHasta)}.`
    };
  });
}

module.exports = { autorizacionVigente, aplicarAutorizacionVigente, VIGENCIA_ANIOS, TIPO_AUTORIZACION };
