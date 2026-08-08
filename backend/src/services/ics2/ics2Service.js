/**
 * ICS2 (Import Control System 2) — envío de ENS para los modos que ya NO admite
 * el canal legacy IE315 de la AEAT (marítimo, aéreo, carretera).
 *
 * CONTEXTO NORMATIVO (verificado contra AEAT PRE, 8/Ago/2026):
 * Tras la fase 4 del ICS2, la AEAT rechaza por el canal legacy (IE315V5) las ENS
 * de los sectores marítimo, aéreo y carretera con el error 92
 * ("Las ENS del sector X se deben declarar solo en el sistema ICS2").
 * Solo FERROCARRIL (RAIL) sigue admitiéndose por el canal legacy.
 *
 * ICS2 NO es un servicio web de la AEAT, sino el sistema centralizado de la UE
 * (Comisión Europea). El envío S2S (System to System) se realiza contra el STI
 * (Shared Trader Interface) del GTP:
 *   - Producción:  https://customs.ec.europa.eu/gtp
 *   - Conformance: https://conformance.customs.ec.europa.eu/euctp
 * y utiliza los mensajes CFTS (F13 = Sea master B/L, etc.), autenticación UUM&DS
 * y un Party ID de sistema. Requisitos previos que NO dependen del código:
 *   1. Alta del EORI en el entorno conformance (la hace la Comisión; se solicita
 *      por email a ics.helpdesk@correo.aeat.es).
 *   2. Party ID / alta de sistema S2S.
 *   3. Acceso UUM&DS (identidad UE), no el certificado FNMT del canal AEAT legacy.
 *
 * Hasta completar esos pasos, ICS2 permanece DESHABILITADO (ICS2_ENABLED=false) y
 * el envío de esos modos se bloquea con un mensaje claro en vez de intentar el
 * legacy (que AEAT rechazaría). Este módulo deja preparado el andamiaje S2S.
 */

const logger = require('../../config/logger');

// Modos cuyo envío corresponde a ICS2 (no al canal legacy IE315).
const ICS2_MODES = ['SEA', 'AIR', 'ROAD'];

// Mensaje CFTS por modo (referencia; el envío real se implementará al habilitar ICS2).
const ICS2_MESSAGE_BY_MODE = {
  SEA: 'F13',   // Sea — master bill of lading
  AIR: 'F21',   // Air
  ROAD: 'F31'   // Road
};

const ICS2_CONFIG = {
  enabled: process.env.ICS2_ENABLED === 'true',
  environment: process.env.ICS2_ENVIRONMENT || 'conformance', // 'conformance' | 'production'
  endpoints: {
    conformance: process.env.ICS2_ENDPOINT_CONFORMANCE || 'https://conformance.customs.ec.europa.eu/euctp',
    production: process.env.ICS2_ENDPOINT_PRODUCTION || 'https://customs.ec.europa.eu/gtp'
  },
  partyId: process.env.ICS2_PARTY_ID || ''
};

/** Indica si un modo de transporte debe enviarse por ICS2 (y no por el legacy AEAT). */
function requiereICS2(transportMode) {
  return ICS2_MODES.includes(String(transportMode || '').toUpperCase());
}

function getBaseUrl() {
  return ICS2_CONFIG.environment === 'production'
    ? ICS2_CONFIG.endpoints.production
    : ICS2_CONFIG.endpoints.conformance;
}

/**
 * Enviar una ENS a ICS2 (STI, S2S).
 *
 * Mientras ICS2 no esté habilitado (falta el alta del EORI en conformance, Party ID
 * y acceso UUM&DS) devuelve un resultado no-exitoso explicando el motivo, en vez de
 * fingir un envío. Cuando se habilite, aquí se construirá el mensaje CFTS (F13/F21/F31)
 * y se enviará al STI del GTP con autenticación UUM&DS.
 */
async function submitENSviaICS2(declaration) {
  const mode = String(declaration.transportMode || '').toUpperCase();
  const message = ICS2_MESSAGE_BY_MODE[mode] || 'F13';

  if (!ICS2_CONFIG.enabled) {
    logger.warn(`[ICS2] Envío no realizado (ICS2 deshabilitado). Modo ${mode} requiere ICS2.`);
    return {
      success: false,
      notEnabled: true,
      code: 'ICS2_NOT_ENABLED',
      error: `El modo de transporte ${mode} debe declararse mediante ICS2 (no por el canal legacy de la AEAT). ` +
        `La integración ICS2 aún no está habilitada: requiere el alta del EORI en el entorno de la UE ` +
        `y un Party ID S2S (ver ics.helpdesk@correo.aeat.es).`
    };
  }

  // ANDAMIAJE: cuando ICS2_ENABLED=true se implementará el envío real del mensaje CFTS.
  // Construcción del F13/F21/F31 + POST al STI (getBaseUrl()) con UUM&DS + Party ID.
  logger.info(`[ICS2] (pendiente de implementación real) Enviaría ${message} al STI ${getBaseUrl()} para ${declaration.reference}`);
  return {
    success: false,
    code: 'ICS2_NOT_IMPLEMENTED',
    error: `Envío ICS2 (${message}) aún no implementado; endpoint ${getBaseUrl()}.`
  };
}

module.exports = {
  ICS2_MODES,
  ICS2_MESSAGE_BY_MODE,
  ICS2_CONFIG,
  requiereICS2,
  getBaseUrl,
  submitENSviaICS2
};
