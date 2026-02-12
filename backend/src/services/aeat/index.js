/**
 * AEAT Services - Index
 * Exporta todos los servicios de integracion AEAT
 * STRIX AI - LUCI Customs Agent
 *
 * Fase 6.1: Integración Real AEAT
 */

const aeatService = require('./aeatService');
const aeatConfig = require('./aeatConfig');
const signatureService = require('./signatureService');
const xmlParser = require('./xmlParser');
const SimulationEngine = require('./simulationEngine');

// Fase 6.1 - Nuevos servicios de integración real
const certificateService = require('./certificateService');
const xadesSignatureService = require('./xadesSignatureService');
const aeatRealService = require('./aeatRealService');
const aeatStatusMonitorService = require('./aeatStatusMonitorService');

module.exports = {
  // Servicio principal (simulación)
  aeatService,

  // Configuracion
  aeatConfig,

  // Servicios auxiliares originales
  signatureService,
  xmlParser,

  // Motor de simulacion (para testing o uso directo)
  SimulationEngine,

  // === FASE 6.1: Integración Real AEAT ===

  // Gestión de certificados digitales (6.1.1)
  certificateService,

  // Firma electrónica XAdES (6.1.2)
  xadesSignatureService,

  // Integración real con web services AEAT (6.1.3-6.1.4)
  aeatRealService,

  // Monitoreo de estado con LUCI (6.1.5-6.1.6)
  aeatStatusMonitorService,

  // Exportaciones directas de funciones utiles
  isSimulationMode: aeatConfig.isSimulationMode,
  getCurrentEnvironment: aeatConfig.getCurrentEnvironment,
  getResponseInfo: aeatConfig.getResponseInfo,
  getCustomsOfficeInfo: aeatConfig.getCustomsOfficeInfo,

  // Constantes utiles
  RESPONSE_CODES: aeatConfig.RESPONSE_CODES,
  INSPECTION_CHANNELS: aeatConfig.INSPECTION_CHANNELS,
  CUSTOMS_OFFICES: aeatConfig.CUSTOMS_OFFICES,
  CUSTOMS_REGIMES: aeatConfig.CUSTOMS_REGIMES,

  // === XML Builders (formato oficial AEAT) ===
  h1XmlBuilder: require('./h1XmlBuilder'),
  h7XmlBuilder: require('./h7XmlBuilder'),
  aesXmlBuilder: require('./aesXmlBuilder'),
  nctsXmlBuilder: require('./nctsXmlBuilder'),
  ensXmlBuilder: require('./ensXmlBuilder'),
  soivreXmlBuilder: require('./soivreXmlBuilder'),
  queryXmlBuilder: require('./queryXmlBuilder'),

  // === Lifecycle Builders (cancellation, arrival, unloading, amendment) ===
  h1CancelXmlBuilder: require('./h1CancelXmlBuilder'),
  cc007XmlBuilder: require('./cc007XmlBuilder'),
  cc044XmlBuilder: require('./cc044XmlBuilder'),
  ie313XmlBuilder: require('./ie313XmlBuilder')
};
