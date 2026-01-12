/**
 * Generador de checklists de documentos segun tipo de operacion
 * Basado en normativa CAU y requisitos AEAT
 */

// Definicion de documentos
const DOCUMENT_DEFINITIONS = {
  // Documentos comerciales
  commercial_invoice: {
    name: 'Factura Comercial',
    description: 'Factura con valor, descripcion de mercancias e incoterm',
    requiredFor: ['import', 'export']
  },
  proforma_invoice: {
    name: 'Factura Proforma',
    description: 'Factura provisional previa a la comercial',
    requiredFor: []
  },
  packing_list: {
    name: 'Packing List',
    description: 'Lista de contenido con bultos, pesos y marcas',
    requiredFor: ['import', 'export']
  },

  // Documentos de transporte
  bill_of_lading: {
    name: 'Bill of Lading (BL)',
    description: 'Conocimiento de embarque maritimo',
    requiredFor: [],
    transportModes: ['maritime']
  },
  air_waybill: {
    name: 'Air Waybill (AWB)',
    description: 'Carta de porte aereo',
    requiredFor: [],
    transportModes: ['air']
  },
  cmr: {
    name: 'CMR',
    description: 'Carta de porte internacional por carretera',
    requiredFor: [],
    transportModes: ['road']
  },

  // Autorizaciones
  dispatch_authorization: {
    name: 'Autorizacion de Despacho',
    description: 'Poder de representacion aduanera',
    requiredFor: ['import', 'export']
  },

  // Certificados de origen
  certificate_origin: {
    name: 'Certificado de Origen',
    description: 'Acredita el pais de fabricacion',
    requiredFor: [],
    conditions: 'Segun origen y producto'
  },
  eur1: {
    name: 'EUR.1',
    description: 'Certificado de origen preferencial UE',
    requiredFor: [],
    conditions: 'Para preferencia arancelaria con paises con acuerdo'
  },
  eur_med: {
    name: 'EUR-MED',
    description: 'Certificado origen pan-euro-mediterraneo',
    requiredFor: [],
    conditions: 'Paises zona PEM'
  },
  atr: {
    name: 'ATR',
    description: 'Certificado de circulacion Turquia',
    requiredFor: [],
    conditions: 'Origen Turquia'
  },
  form_a: {
    name: 'Form A / REX',
    description: 'Certificado SPG para paises en desarrollo',
    requiredFor: [],
    conditions: 'Paises beneficiarios SPG'
  },

  // Certificados sanitarios/fitosanitarios
  sanitary_certificate: {
    name: 'Certificado Sanitario',
    description: 'Para productos alimenticios de origen no animal',
    requiredFor: [],
    conditions: 'Productos alimenticios'
  },
  phytosanitary_certificate: {
    name: 'Certificado Fitosanitario',
    description: 'Para productos vegetales',
    requiredFor: [],
    conditions: 'Productos vegetales, madera, semillas'
  },
  veterinary_certificate: {
    name: 'Certificado Veterinario',
    description: 'Para productos de origen animal',
    requiredFor: [],
    conditions: 'Productos animales o derivados'
  },
  fumigation_certificate: {
    name: 'Certificado de Fumigacion',
    description: 'Tratamiento de embalajes de madera',
    requiredFor: [],
    conditions: 'Embalajes de madera (NIMF-15)'
  },

  // Otros certificados
  insurance_certificate: {
    name: 'Certificado de Seguro',
    description: 'Poliza de seguro de transporte',
    requiredFor: [],
    conditions: 'Incoterms CIF, CIP'
  },
  import_license: {
    name: 'Licencia de Importacion',
    description: 'Autorizacion para productos controlados',
    requiredFor: [],
    conditions: 'Productos sujetos a licencia'
  },
  export_license: {
    name: 'Licencia de Exportacion',
    description: 'Autorizacion para exportar bienes controlados',
    requiredFor: [],
    conditions: 'Doble uso, armamento, etc.'
  },
  ce_certificate: {
    name: 'Certificado CE',
    description: 'Marcado CE de conformidad europea',
    requiredFor: [],
    conditions: 'Productos electricos, juguetes, maquinaria'
  },
  quality_certificate: {
    name: 'Certificado de Calidad',
    description: 'Certificacion de calidad del producto',
    requiredFor: [],
    conditions: 'Segun requisitos del cliente'
  }
};

// Categorias de productos que requieren certificados especiales
const PRODUCT_CATEGORIES = {
  food_non_animal: {
    pattern: /aliment|food|comida|bebida|drink|fruta|fruit|vegetal|vegetable|cereal/i,
    requiredDocs: ['sanitary_certificate']
  },
  plants: {
    pattern: /planta|plant|semilla|seed|flor|flower|madera|wood|timber/i,
    requiredDocs: ['phytosanitary_certificate']
  },
  animal_products: {
    pattern: /carne|meat|pescado|fish|lacteo|dairy|huevo|egg|animal/i,
    requiredDocs: ['veterinary_certificate']
  },
  chemicals: {
    pattern: /quimic|chemical|toxic|peligros|dangerous/i,
    requiredDocs: ['import_license']
  },
  electronics: {
    pattern: /electron|electric|ordenador|computer|telefono|phone|maquina|machine/i,
    requiredDocs: ['ce_certificate']
  }
};

/**
 * Generar checklist de documentos
 * @param {string} operationType - 'import', 'export', 'transit'
 * @param {string} transportMode - 'maritime', 'air', 'road', 'rail', 'postal', 'multimodal'
 * @param {Array} goods - Array de mercancias con descripcion
 * @returns {Array} Checklist de documentos
 */
function getChecklist(operationType, transportMode, goods = []) {
  const checklist = [];

  // 1. Documentos obligatorios segun tipo operacion
  Object.entries(DOCUMENT_DEFINITIONS).forEach(([type, def]) => {
    if (def.requiredFor.includes(operationType)) {
      checklist.push({
        documentType: type,
        documentName: def.name,
        description: def.description,
        required: true,
        conditional: false
      });
    }
  });

  // 2. Documento de transporte segun modo
  const transportDocs = {
    maritime: 'bill_of_lading',
    air: 'air_waybill',
    road: 'cmr',
    rail: 'cmr', // Usar CMR tambien para ferrocarril
    multimodal: 'bill_of_lading' // Por defecto BL
  };

  if (transportDocs[transportMode]) {
    const docType = transportDocs[transportMode];
    const def = DOCUMENT_DEFINITIONS[docType];
    checklist.push({
      documentType: docType,
      documentName: def.name,
      description: def.description,
      required: true,
      conditional: false
    });
  }

  // 3. Documentos condicionales segun producto
  const goodsDescriptions = goods.map(g => g.description || '').join(' ');

  Object.entries(PRODUCT_CATEGORIES).forEach(([category, config]) => {
    if (config.pattern.test(goodsDescriptions)) {
      config.requiredDocs.forEach(docType => {
        // Evitar duplicados
        if (!checklist.find(c => c.documentType === docType)) {
          const def = DOCUMENT_DEFINITIONS[docType];
          if (def) {
            checklist.push({
              documentType: docType,
              documentName: def.name,
              description: def.description,
              required: false, // Condicional
              conditional: true,
              condition: def.conditions
            });
          }
        }
      });
    }
  });

  // 4. Documentos opcionales comunes
  const optionalDocs = ['certificate_origin', 'insurance_certificate'];

  if (operationType === 'import') {
    optionalDocs.push('eur1', 'atr', 'form_a');
  }

  optionalDocs.forEach(docType => {
    if (!checklist.find(c => c.documentType === docType)) {
      const def = DOCUMENT_DEFINITIONS[docType];
      if (def) {
        checklist.push({
          documentType: docType,
          documentName: def.name,
          description: def.description,
          required: false,
          conditional: true,
          condition: def.conditions
        });
      }
    }
  });

  return checklist;
}

/**
 * Obtener definicion de un tipo de documento
 */
function getDocumentDefinition(documentType) {
  return DOCUMENT_DEFINITIONS[documentType] || null;
}

/**
 * Obtener todos los tipos de documento disponibles
 */
function getAllDocumentTypes() {
  return Object.entries(DOCUMENT_DEFINITIONS).map(([type, def]) => ({
    type,
    ...def
  }));
}

/**
 * Verificar si un documento es requerido para una operacion
 */
function isDocumentRequired(documentType, operationType, transportMode) {
  const def = DOCUMENT_DEFINITIONS[documentType];
  if (!def) return false;

  // Verificar por tipo de operacion
  if (def.requiredFor.includes(operationType)) return true;

  // Verificar por modo de transporte
  if (def.transportModes && def.transportModes.includes(transportMode)) return true;

  return false;
}

module.exports = {
  getChecklist,
  getDocumentDefinition,
  getAllDocumentTypes,
  isDocumentRequired,
  DOCUMENT_DEFINITIONS,
  PRODUCT_CATEGORIES
};
