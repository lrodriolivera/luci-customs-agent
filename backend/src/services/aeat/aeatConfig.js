/**
 * Configuracion centralizada para integracion AEAT
 * STRIX AI - LUCI Customs Agent
 */

const { ADUANAS_OFICIALES } = require('../../config/aduanasOficiales');

// Entornos disponibles
// NOTA: NO se requiere registro de IP ante la AEAT (eliminado).
// Solo se necesita certificado electronico cualificado para autenticacion SSL mutua.
const ENVIRONMENTS = {
  simulation: {
    name: 'Simulacion',
    isReal: false,
    baseUrl: null,
    description: 'Modo simulacion para desarrollo y demostraciones'
  },
  test: {
    name: 'Pruebas AEAT (PRE)',
    isReal: true,
    baseUrl: 'https://prewww10.aeat.es',
    altUrls: ['https://prewww1.aeat.es', 'https://prewww2.aeat.es'],
    description: 'Entorno de pruebas con certificado - NO requiere registro de IP'
  },
  production: {
    name: 'Produccion AEAT',
    isReal: true,
    baseUrl: 'https://www2.agenciatributaria.gob.es',
    description: 'Entorno de produccion - Solo certificado electronico'
  }
};

// Codigos de respuesta AEAT expandidos
const RESPONSE_CODES = {
  // Exito
  '0000': { status: 'accepted', severity: 'success', description: 'Declaracion aceptada' },
  '0001': { status: 'pending', severity: 'info', description: 'Pendiente de validacion' },
  '0002': { status: 'accepted_warnings', severity: 'warning', description: 'Aceptada con observaciones' },

  // Errores de formato/estructura
  '1000': { status: 'error', severity: 'error', description: 'Error de formato XML' },
  '1001': { status: 'error', severity: 'error', description: 'Error de firma digital' },
  '1002': { status: 'error', severity: 'error', description: 'Certificado no valido o caducado' },
  '1003': { status: 'error', severity: 'error', description: 'Namespace XML incorrecto' },
  '1004': { status: 'error', severity: 'error', description: 'Elementos obligatorios faltantes' },
  '1005': { status: 'error', severity: 'error', description: 'Formato de fecha incorrecto' },
  '1006': { status: 'error', severity: 'error', description: 'Longitud de campo excedida' },
  '1007': { status: 'error', severity: 'error', description: 'Tipo de dato incorrecto' },

  // Errores de datos
  '2000': { status: 'rejected', severity: 'error', description: 'Declaracion rechazada - datos incorrectos' },
  '2001': { status: 'rejected', severity: 'error', description: 'EORI no valido o no registrado' },
  '2002': { status: 'rejected', severity: 'error', description: 'Codigo TARIC no valido' },
  '2003': { status: 'rejected', severity: 'error', description: 'Aduana de presentacion incorrecta' },
  '2004': { status: 'rejected', severity: 'error', description: 'Peso declarado inconsistente' },
  '2005': { status: 'rejected', severity: 'error', description: 'Valor aduanero incorrecto' },
  '2006': { status: 'rejected', severity: 'error', description: 'Regimen aduanero no permitido' },
  '2007': { status: 'rejected', severity: 'error', description: 'Pais de origen no valido' },
  '2008': { status: 'rejected', severity: 'error', description: 'Incoterm inconsistente con datos' },
  '2009': { status: 'rejected', severity: 'error', description: 'Moneda no reconocida' },
  '2010': { status: 'rejected', severity: 'error', description: 'Fecha de carga invalida' },

  // Errores de autorizacion
  '3000': { status: 'unauthorized', severity: 'error', description: 'Representante no autorizado' },
  '3001': { status: 'unauthorized', severity: 'error', description: 'Importador/Exportador sin EORI activo' },
  '3002': { status: 'unauthorized', severity: 'error', description: 'Autorizacion OEA requerida' },
  '3003': { status: 'unauthorized', severity: 'error', description: 'Garantia insuficiente' },

  // Advertencias (no bloquean)
  '4000': { status: 'warning', severity: 'warning', description: 'Valor estadistico parece bajo' },
  '4001': { status: 'warning', severity: 'warning', description: 'Peso neto supera peso bruto' },
  '4002': { status: 'warning', severity: 'warning', description: 'Codigo de aduana no reconocido' },
  '4003': { status: 'warning', severity: 'warning', description: 'Fecha de entrega muy lejana' }
};

// Canales de inspeccion con probabilidades
const INSPECTION_CHANNELS = {
  green: {
    code: 'green',
    label: 'Canal Verde',
    description: 'Levante automatico autorizado',
    probability: 0.70,
    processingTime: { min: 0, max: 2 }, // horas
    actions: ['levante_automatico']
  },
  yellow: {
    code: 'yellow',
    label: 'Canal Amarillo',
    description: 'Certificados paraduaneros pendientes',
    probability: 0.0, // No asignado aleatoriamente, solo por certificados
    processingTime: { min: 4, max: 24 },
    actions: ['espera_certificados', 'reevaluacion_automatica']
  },
  orange: {
    code: 'orange',
    label: 'Canal Naranja',
    description: 'Revision documental requerida',
    probability: 0.25,
    processingTime: { min: 4, max: 48 },
    actions: ['requerimiento_documental', 'plazo_10_dias']
  },
  red: {
    code: 'red',
    label: 'Canal Rojo',
    description: 'Inspeccion fisica requerida',
    probability: 0.05,
    processingTime: { min: 24, max: 72 },
    actions: ['retencion_mercancia', 'inspeccion_fisica', 'plazo_5_dias']
  }
};

// Regimenes aduaneros
const CUSTOMS_REGIMES = {
  '40': { description: 'Despacho a libre practica', type: 'import' },
  '42': { description: 'Despacho a libre practica con exencion IVA', type: 'import' },
  '44': { description: 'Despacho con uso final', type: 'import' },
  '51': { description: 'Perfeccionamiento activo', type: 'special' },
  '53': { description: 'Importacion temporal', type: 'special' },
  '61': { description: 'Reimportacion', type: 'import' },
  '71': { description: 'Deposito aduanero', type: 'special' },
  '10': { description: 'Exportacion definitiva', type: 'export' },
  '11': { description: 'Exportacion con solicitud devolucion', type: 'export' },
  '21': { description: 'Exportacion temporal', type: 'export' },
  '22': { description: 'Perfeccionamiento pasivo', type: 'special' },
  '31': { description: 'Reexportacion', type: 'export' }
};

// Aduanas espanolas: se derivan de la lista oficial (config/aduanasOficiales.js).
// El catalogo que habia aqui tenia codigos equivocados (ES002801 como
// "Barcelona - Puerto" cuando es Madrid aeropuerto, ES003001 como Algeciras
// cuando Algeciras maritima es ES001131...). `type` conserva los valores de
// siempre para los recintos de paso (maritime/air/land/inland) y usa el tipo de
// la lista oficial para el resto (admin, postal, central...).
const TIPO_AEAT = { road: 'land', rail: 'land' };
const CUSTOMS_OFFICES = Object.fromEntries(ADUANAS_OFICIALES.map(a => [a.code, {
  name: a.name,
  region: a.region,
  type: TIPO_AEAT[a.type] || a.type,
  code: a.recinto
}]));

// Paises de riesgo para inspeccion adicional
const HIGH_RISK_COUNTRIES = ['CN', 'HK', 'VN', 'BD', 'PK', 'IN', 'TR', 'AE', 'TH', 'MY'];

// Capitulos TARIC sensibles (requieren control adicional)
const SENSITIVE_TARIC_CHAPTERS = {
  '02': { description: 'Carnes', control: 'sanitary', authority: 'SOIVRE' },
  '03': { description: 'Pescados', control: 'sanitary', authority: 'SOIVRE' },
  '04': { description: 'Lacteos', control: 'sanitary', authority: 'SOIVRE' },
  '22': { description: 'Bebidas alcoholicas', control: 'excise', authority: 'AEAT' },
  '24': { description: 'Tabaco', control: 'excise', authority: 'AEAT' },
  '28': { description: 'Productos quimicos', control: 'chemical', authority: 'MITERD' },
  '29': { description: 'Productos quimicos organicos', control: 'chemical', authority: 'MITERD' },
  '30': { description: 'Productos farmaceuticos', control: 'pharmaceutical', authority: 'AEMPS' },
  '84': { description: 'Maquinaria', control: 'dual_use', authority: 'MINECO' },
  '85': { description: 'Electronica', control: 'dual_use', authority: 'MINECO' },
  '93': { description: 'Armas', control: 'weapons', authority: 'INTERIOR' }
};

// Incoterms reconocidos
const INCOTERMS = {
  'EXW': { name: 'Ex Works', group: 'E', seller_risk: 'minimal' },
  'FCA': { name: 'Free Carrier', group: 'F', seller_risk: 'low' },
  'FAS': { name: 'Free Alongside Ship', group: 'F', seller_risk: 'low', transport: 'sea' },
  'FOB': { name: 'Free On Board', group: 'F', seller_risk: 'medium', transport: 'sea' },
  'CFR': { name: 'Cost and Freight', group: 'C', seller_risk: 'medium', transport: 'sea' },
  'CIF': { name: 'Cost Insurance Freight', group: 'C', seller_risk: 'medium', transport: 'sea' },
  'CPT': { name: 'Carriage Paid To', group: 'C', seller_risk: 'medium' },
  'CIP': { name: 'Carriage Insurance Paid', group: 'C', seller_risk: 'medium' },
  'DAP': { name: 'Delivered At Place', group: 'D', seller_risk: 'high' },
  'DPU': { name: 'Delivered at Place Unloaded', group: 'D', seller_risk: 'high' },
  'DDP': { name: 'Delivered Duty Paid', group: 'D', seller_risk: 'maximum' }
};

// Monedas aceptadas
const CURRENCIES = {
  'EUR': { name: 'Euro', rate: 1.0 },
  'USD': { name: 'Dolar estadounidense', rate: 0.92 },
  'GBP': { name: 'Libra esterlina', rate: 1.17 },
  'CHF': { name: 'Franco suizo', rate: 1.06 },
  'JPY': { name: 'Yen japones', rate: 0.0062 },
  'CNY': { name: 'Yuan chino', rate: 0.13 }
};

/**
 * Obtener entorno actual basado en variables de entorno
 */
function getCurrentEnvironment() {
  const env = process.env.AEAT_ENVIRONMENT || 'simulation';
  return ENVIRONMENTS[env] || ENVIRONMENTS.simulation;
}

/**
 * Verificar si esta en modo simulacion
 */
function isSimulationMode() {
  const certPath = process.env.AEAT_CERTIFICATE_PATH;
  const certPass = process.env.AEAT_CERTIFICATE_PASSWORD;
  const forceSimulation = process.env.AEAT_FORCE_SIMULATION === 'true';

  // Forzar simulacion si esta configurado o si no hay certificado
  return forceSimulation || !certPath || !certPass;
}

/**
 * Obtener informacion de codigo de respuesta
 */
function getResponseInfo(code) {
  return RESPONSE_CODES[code] || {
    status: 'unknown',
    severity: 'warning',
    description: `Codigo desconocido: ${code}`
  };
}

/**
 * Obtener informacion de aduana
 */
function getCustomsOfficeInfo(code) {
  return CUSTOMS_OFFICES[code] || null;
}

/**
 * Verificar si un pais es de alto riesgo
 */
function isHighRiskCountry(countryCode) {
  return HIGH_RISK_COUNTRIES.includes(countryCode?.toUpperCase());
}

/**
 * Obtener control requerido por capitulo TARIC
 */
function getTaricChapterControl(taricCode) {
  const chapter = taricCode?.substring(0, 2);
  return SENSITIVE_TARIC_CHAPTERS[chapter] || null;
}

module.exports = {
  ENVIRONMENTS,
  RESPONSE_CODES,
  INSPECTION_CHANNELS,
  CUSTOMS_REGIMES,
  CUSTOMS_OFFICES,
  HIGH_RISK_COUNTRIES,
  SENSITIVE_TARIC_CHAPTERS,
  INCOTERMS,
  CURRENCIES,
  getCurrentEnvironment,
  isSimulationMode,
  getResponseInfo,
  getCustomsOfficeInfo,
  isHighRiskCountry,
  getTaricChapterControl
};
