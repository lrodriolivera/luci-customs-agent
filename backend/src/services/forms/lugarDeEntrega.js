/**
 * Lugar convenido del incoterm y su pais (H1 CAU, grupo DeliveryTerms: guia
 * tecnica de importacion CAU v3.20, pag. 52; regla C0596: sin UNLOCODE van
 * `location` y `country`, el pais del lugar de entrega).
 *
 * Con E y F el lugar esta en el pais de expedicion (FOB Shanghai -> CN); con C
 * y D, en el de destino (CIF Valencia, DAP Madrid -> ES). Fuente unica para el
 * mensaje CC415A y para la vista previa. Funcion pura.
 */
const INCOTERMS_EN_DESTINO = new Set(['CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']);
const PAIS_DE_DESTINO = 'ES';

const texto = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

/**
 * @param {object} expedition
 * @param {string|null} paisExpedicion  pais de expedicion ya resuelto (dos letras)
 * @returns {{ incoterm: string, lugar: string|null, pais: string|null }|null}  null sin incoterm
 */
function lugarDeEntrega(expedition, paisExpedicion) {
  const incoterm = typeof expedition?.incoterm === 'object' ? expedition.incoterm : { code: expedition?.incoterm };
  const codigo = texto(incoterm?.code);
  if (!codigo) return null;
  const enDestino = INCOTERMS_EN_DESTINO.has(codigo.toUpperCase());
  const lugar = texto(incoterm.place) || texto(enDestino ? expedition.transport?.arrivalPort : expedition.transport?.departurePort);
  const pais = texto(incoterm.country) || (enDestino ? PAIS_DE_DESTINO : texto(paisExpedicion));
  return { incoterm: codigo.toUpperCase(), lugar: lugar ? lugar.slice(0, 35) : null, pais: pais ? pais.toUpperCase() : null };
}

module.exports = { lugarDeEntrega, INCOTERMS_EN_DESTINO };
