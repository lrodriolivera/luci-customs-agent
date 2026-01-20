/**
 * Auto-Response Service
 * ML-based automatic response generation for AEAT requirements
 * Phase 6.5: Advanced Machine Learning
 */

const logger = require('../../config/logger');

// ==================== Response Templates ====================

/**
 * Response templates by requirement type
 */
const RESPONSE_TEMPLATES = {
  documentary: {
    invoice: {
      template: `Adjunto factura comercial numero {invoiceNumber} de fecha {invoiceDate} emitida por {supplierName}.

El valor declarado de {declaredValue} EUR corresponde al precio realmente pagado segun las condiciones de compraventa ({incoterm}).

Se incluye desglose detallado de:
- Precio FOB: {fobPrice} EUR
- Flete: {freight} EUR
- Seguro: {insurance} EUR

Documentos adjuntos:
{attachedDocs}`,
      requiredFields: ['invoiceNumber', 'invoiceDate', 'supplierName', 'declaredValue', 'incoterm']
    },

    bl: {
      template: `Adjunto conocimiento de embarque {blNumber} que acredita el transporte de la mercancia.

Datos del transporte:
- Puerto de carga: {loadingPort}
- Puerto de descarga: {dischargePort}
- Fecha de embarque: {shippingDate}
- Buque: {vesselName}
- Contenedor(es): {containerNumbers}

El B/L confirma la ruta declarada desde {originCountry} hasta {destinationCountry}.`,
      requiredFields: ['blNumber', 'loadingPort', 'dischargePort', 'shippingDate']
    },

    packingList: {
      template: `Adjunto lista de empaque que detalla el contenido del envio.

Resumen:
- Total bultos: {totalPackages}
- Peso bruto total: {grossWeight} kg
- Peso neto total: {netWeight} kg

El desglose por partida coincide con lo declarado en el DUA.`,
      requiredFields: ['totalPackages', 'grossWeight', 'netWeight']
    },

    originCertificate: {
      template: `Adjunto certificado de origen {certificateType} numero {certificateNumber} emitido por {issuingAuthority} con fecha {issueDate}.

El certificado acredita que las mercancias clasificadas en la partida {taricCode} son originarias de {originCountry} y cumplen las reglas de origen del acuerdo {tradeAgreement}.

Criterio de origen aplicado: {originCriteria}`,
      requiredFields: ['certificateType', 'certificateNumber', 'originCountry', 'taricCode']
    }
  },

  valuation: {
    priceJustification: {
      template: `En respuesta al requerimiento de justificacion de valor, informamos:

1. RELACION ENTRE PARTES
{partyRelationship}

2. METODO DE VALORACION
Se aplica el metodo del valor de transaccion (Art. 70 CAU) basado en el precio realmente pagado.

3. JUSTIFICACION DEL PRECIO
{priceJustification}

4. ELEMENTOS A INCLUIR EN EL VALOR (Art. 71 CAU)
{valueElements}

5. DOCUMENTACION DE SOPORTE
{supportingDocs}

El valor declarado de {declaredValue} EUR es conforme a las disposiciones del Codigo Aduanero de la Union.`,
      requiredFields: ['declaredValue', 'partyRelationship', 'priceJustification']
    },

    lowValueExplanation: {
      template: `En relacion con el valor declarado, que puede parecer bajo respecto a referencias de mercado, aclaramos:

MOTIVOS DEL PRECIO REDUCIDO:
{lowPriceReasons}

COMPARATIVA DE MERCADO:
{marketComparison}

DOCUMENTACION ADJUNTA:
{supportingDocs}

Confirmamos que el precio declarado es el efectivamente pagado y representa el valor de transaccion real.`,
      requiredFields: ['lowPriceReasons', 'declaredValue']
    }
  },

  classification: {
    taricJustification: {
      template: `En respuesta al requerimiento sobre clasificacion arancelaria, justificamos la partida {taricCode} de la siguiente manera:

DESCRIPCION DEL PRODUCTO:
{productDescription}

CARACTERISTICAS DETERMINANTES:
{keyCharacteristics}

APLICACION DE REGLAS:
{classificationRules}

NOTAS EXPLICATIVAS APLICADAS:
{explanatoryNotes}

PRECEDENTES/IAV:
{precedents}

Consideramos que la clasificacion en la partida {taricCode} es correcta segun las Reglas Generales de Interpretacion de la Nomenclatura Combinada.`,
      requiredFields: ['taricCode', 'productDescription', 'keyCharacteristics']
    }
  },

  origin: {
    originVerification: {
      template: `En respuesta al requerimiento de verificacion de origen, aportamos:

1. PAIS DE ORIGEN DECLARADO: {originCountry}

2. JUSTIFICACION:
{originJustification}

3. CERTIFICADO DE ORIGEN:
{certificateInfo}

4. TRAZABILIDAD:
{traceability}

5. REGLAS DE ORIGEN CUMPLIDAS:
{originRules}

Confirmamos que las mercancias son originarias de {originCountry} segun las disposiciones del acuerdo aplicable.`,
      requiredFields: ['originCountry', 'originJustification']
    }
  },

  physical: {
    inspectionCoordination: {
      template: `En relacion con la inspeccion fisica programada, confirmamos:

DATOS DE LA MERCANCIA:
- Expediente: {expeditionRef}
- MRN: {mrn}
- Ubicacion: {location}

CONTACTO PARA COORDINACION:
- Persona: {contactPerson}
- Telefono: {contactPhone}
- Email: {contactEmail}

DISPONIBILIDAD:
{availability}

DOCUMENTACION PREPARADA:
{preparedDocs}

Quedamos a disposicion para facilitar la inspeccion en el horario acordado.`,
      requiredFields: ['expeditionRef', 'mrn', 'location', 'contactPerson']
    }
  }
};

/**
 * Standard phrases for common situations
 */
const STANDARD_PHRASES = {
  partyRelationship: {
    independent: 'Las partes son independientes. No existe vinculacion segun el articulo 127 del RECAU.',
    related: 'Existe vinculacion entre las partes conforme al articulo 127 del RECAU. No obstante, esta vinculacion no ha influido en el precio, segun se acredita con la documentacion adjunta.',
    unknown: 'Segun nuestro conocimiento, las partes son independientes.'
  },
  lowPriceReasons: {
    promotion: 'El precio corresponde a una promocion especial del proveedor.',
    volume: 'Descuento por volumen de compra significativo.',
    oldStock: 'Mercancia de temporada anterior / stock antiguo.',
    defective: 'Mercancia con defectos menores que no afectan su uso.',
    sample: 'Muestras comerciales con valor reducido.',
    closeout: 'Liquidacion por cierre de linea de producto.'
  },
  valueElements: {
    complete: 'El valor incluye todos los elementos del Art. 71 CAU: precio pagado, comisiones (si aplica), envases, embalajes, y gastos de transporte/seguro hasta el lugar de entrada en la UE.',
    fob: 'El valor FOB se ha ajustado anadiendo flete ({freight} EUR) y seguro ({insurance} EUR) para determinar el valor CIF en frontera de la UE.',
    exw: 'El valor EXW se ha ajustado anadiendo todos los gastos de transporte y seguro hasta el lugar de entrada.'
  }
};

// ==================== Response Generation ====================

/**
 * Generate automatic response for a requirement
 * @param {Object} requirement - Requirement details
 * @param {Object} expeditionData - Related expedition data
 * @param {Object} options - Generation options
 * @returns {Object} Generated response
 */
function generateResponse(requirement, expeditionData, options = {}) {
  try {
    const {
      requirementType,
      requestedDocuments = [],
      specificQuestions = [],
      deadline
    } = requirement;

    const response = {
      requirementId: requirement.id,
      generatedAt: new Date().toISOString(),
      sections: [],
      attachments: [],
      confidence: 0,
      requiresReview: true
    };

    // Determine which templates to use
    const templates = selectTemplates(requirementType, requestedDocuments, specificQuestions);

    // Generate each section
    templates.forEach(templateInfo => {
      const section = generateSection(templateInfo, expeditionData, options);
      if (section) {
        response.sections.push(section);
      }
    });

    // Calculate confidence
    response.confidence = calculateResponseConfidence(response.sections, expeditionData);
    response.requiresReview = response.confidence < 80;

    // Generate summary
    response.summary = generateSummary(response.sections);

    // Suggest attachments
    response.suggestedAttachments = suggestAttachments(requirementType, requestedDocuments);

    // Add deadline reminder
    if (deadline) {
      const daysRemaining = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
      response.deadlineReminder = {
        deadline,
        daysRemaining,
        urgency: daysRemaining <= 2 ? 'critical' : daysRemaining <= 5 ? 'high' : 'normal'
      };
    }

    logger.info('Auto-response generated', {
      requirementId: requirement.id,
      type: requirementType,
      confidence: response.confidence
    });

    return {
      success: true,
      response
    };
  } catch (error) {
    logger.error('Auto-response generation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Select appropriate templates based on requirement
 */
function selectTemplates(requirementType, requestedDocuments, specificQuestions) {
  const templates = [];

  switch (requirementType) {
    case 'documentary':
      requestedDocuments.forEach(doc => {
        const docLower = doc.toLowerCase();
        if (docLower.includes('factura') || docLower.includes('invoice')) {
          templates.push({ category: 'documentary', type: 'invoice' });
        }
        if (docLower.includes('conocimiento') || docLower.includes('bl') || docLower.includes('transporte')) {
          templates.push({ category: 'documentary', type: 'bl' });
        }
        if (docLower.includes('packing') || docLower.includes('empaque') || docLower.includes('bultos')) {
          templates.push({ category: 'documentary', type: 'packingList' });
        }
        if (docLower.includes('origen') || docLower.includes('eur') || docLower.includes('certificate')) {
          templates.push({ category: 'documentary', type: 'originCertificate' });
        }
      });
      break;

    case 'valuation':
      templates.push({ category: 'valuation', type: 'priceJustification' });
      if (specificQuestions.some(q => q.toLowerCase().includes('bajo') || q.toLowerCase().includes('low'))) {
        templates.push({ category: 'valuation', type: 'lowValueExplanation' });
      }
      break;

    case 'classification':
      templates.push({ category: 'classification', type: 'taricJustification' });
      break;

    case 'origin':
      templates.push({ category: 'origin', type: 'originVerification' });
      break;

    case 'physical':
      templates.push({ category: 'physical', type: 'inspectionCoordination' });
      break;

    default:
      // Generic documentary response
      templates.push({ category: 'documentary', type: 'invoice' });
  }

  return templates;
}

/**
 * Generate a response section from template
 */
function generateSection(templateInfo, expeditionData, options) {
  const { category, type } = templateInfo;
  const template = RESPONSE_TEMPLATES[category]?.[type];

  if (!template) return null;

  // Prepare field values
  const fields = prepareFieldValues(template.requiredFields, expeditionData, options);

  // Check for missing required fields
  const missingFields = template.requiredFields.filter(f => !fields[f] || fields[f] === '{' + f + '}');

  // Fill template
  let content = template.template;
  Object.entries(fields).forEach(([key, value]) => {
    content = content.replace(new RegExp(`{${key}}`, 'g'), value || `[${key}]`);
  });

  return {
    type,
    category,
    content,
    fields,
    missingFields,
    complete: missingFields.length === 0
  };
}

/**
 * Prepare field values from expedition data
 */
function prepareFieldValues(requiredFields, expeditionData, options) {
  const {
    reference,
    mrn,
    declaration,
    client,
    supplier,
    goods,
    documents,
    customsValue,
    incoterm,
    originCountry,
    taricCode,
    transport
  } = expeditionData;

  const invoice = documents?.find(d => d.type === 'INVOICE');
  const bl = documents?.find(d => d.type === 'BL' || d.type === 'AWB');
  const originCert = documents?.find(d => ['EUR1', 'FORM_A', 'ATR', 'ORIGIN'].includes(d.type));

  return {
    // Invoice fields
    invoiceNumber: invoice?.number || options.invoiceNumber,
    invoiceDate: invoice?.date ? new Date(invoice.date).toLocaleDateString('es-ES') : options.invoiceDate,
    supplierName: supplier?.name || options.supplierName,
    declaredValue: customsValue?.toLocaleString('es-ES'),
    incoterm: incoterm || 'FOB',
    fobPrice: customsValue ? Math.round(customsValue * 0.85).toLocaleString('es-ES') : '',
    freight: transport?.freight?.toLocaleString('es-ES') || '',
    insurance: transport?.insurance?.toLocaleString('es-ES') || '',
    attachedDocs: documents?.map(d => `- ${d.name}`).join('\n') || '- Ver documentos adjuntos',

    // BL fields
    blNumber: bl?.number || options.blNumber,
    loadingPort: transport?.loadingPort || options.loadingPort,
    dischargePort: transport?.dischargePort || options.dischargePort,
    shippingDate: transport?.shippingDate ? new Date(transport.shippingDate).toLocaleDateString('es-ES') : '',
    vesselName: transport?.vesselName || '',
    containerNumbers: transport?.containers?.join(', ') || '',
    originCountry: originCountry || '',
    destinationCountry: 'Espana',

    // Packing list fields
    totalPackages: goods?.packages || '',
    grossWeight: goods?.grossWeight?.toLocaleString('es-ES') || '',
    netWeight: goods?.netWeight?.toLocaleString('es-ES') || '',

    // Origin certificate fields
    certificateType: originCert?.type || options.certificateType || 'EUR.1',
    certificateNumber: originCert?.number || options.certificateNumber,
    issuingAuthority: originCert?.issuingAuthority || '',
    issueDate: originCert?.date ? new Date(originCert.date).toLocaleDateString('es-ES') : '',
    taricCode: taricCode || '',
    tradeAgreement: options.tradeAgreement || '',
    originCriteria: options.originCriteria || 'Fabricacion completa',

    // Valuation fields
    partyRelationship: options.partyRelationship || STANDARD_PHRASES.partyRelationship.independent,
    priceJustification: options.priceJustification || 'Precio de mercado segun cotizacion del proveedor.',
    valueElements: options.valueElements || STANDARD_PHRASES.valueElements.complete,
    supportingDocs: options.supportingDocs || 'Ver documentos adjuntos.',

    // Low value fields
    lowPriceReasons: options.lowPriceReasons || '',
    marketComparison: options.marketComparison || '',

    // Classification fields
    productDescription: goods?.description || '',
    keyCharacteristics: options.keyCharacteristics || '',
    classificationRules: options.classificationRules || 'Aplicacion de RGI 1 y 6.',
    explanatoryNotes: options.explanatoryNotes || '',
    precedents: options.precedents || 'No se conocen IAV especificas para este producto.',

    // Origin verification fields
    originJustification: options.originJustification || '',
    certificateInfo: originCert ? `Certificado ${originCert.type} num. ${originCert.number}` : '',
    traceability: options.traceability || '',
    originRules: options.originRules || '',

    // Inspection fields
    expeditionRef: reference || '',
    mrn: mrn || declaration?.mrn || '',
    location: options.location || '',
    contactPerson: client?.contactName || options.contactPerson || '',
    contactPhone: client?.phone || options.contactPhone || '',
    contactEmail: client?.email || options.contactEmail || '',
    availability: options.availability || 'Disponible en horario de aduana.',
    preparedDocs: options.preparedDocs || 'Toda la documentacion del expediente.'
  };
}

/**
 * Calculate confidence score for response
 */
function calculateResponseConfidence(sections, expeditionData) {
  if (sections.length === 0) return 0;

  let totalScore = 0;

  sections.forEach(section => {
    // Base score for complete sections
    const completeness = section.complete ? 100 : (1 - section.missingFields.length / 5) * 60;

    // Bonus for having supporting documents
    const hasDocuments = expeditionData.documents?.length > 0;
    const documentBonus = hasDocuments ? 10 : 0;

    totalScore += completeness + documentBonus;
  });

  return Math.round(totalScore / sections.length);
}

/**
 * Generate summary of response
 */
function generateSummary(sections) {
  const completeSections = sections.filter(s => s.complete);
  const incompleteSections = sections.filter(s => !s.complete);

  return {
    totalSections: sections.length,
    completeSections: completeSections.length,
    incompleteSections: incompleteSections.length,
    allMissingFields: incompleteSections.flatMap(s => s.missingFields),
    status: completeSections.length === sections.length ? 'complete' : 'partial'
  };
}

/**
 * Suggest attachments based on requirement type
 */
function suggestAttachments(requirementType, requestedDocuments) {
  const suggestions = [];

  const documentSuggestions = {
    documentary: [
      'Factura comercial',
      'Conocimiento de embarque / AWB',
      'Packing list',
      'Certificado de origen (si aplica)'
    ],
    valuation: [
      'Factura comercial',
      'Contrato de compraventa',
      'Cotizaciones / lista de precios',
      'Extractos bancarios de pago'
    ],
    classification: [
      'Ficha tecnica del producto',
      'Fotos del producto',
      'Catalogo del fabricante',
      'Analisis de laboratorio (si aplica)'
    ],
    origin: [
      'Certificado de origen',
      'Declaracion del proveedor',
      'Documentos de fabricacion',
      'Trazabilidad de materiales'
    ],
    physical: [
      'Copia del DUA',
      'Todos los documentos del expediente',
      'Instrucciones de manipulacion'
    ]
  };

  suggestions.push(...(documentSuggestions[requirementType] || documentSuggestions.documentary));

  return suggestions;
}

/**
 * Get response template preview
 */
function getTemplatePreview(category, type) {
  const template = RESPONSE_TEMPLATES[category]?.[type];

  if (!template) {
    return { success: false, error: 'Template not found' };
  }

  return {
    success: true,
    template: {
      category,
      type,
      content: template.template,
      requiredFields: template.requiredFields
    }
  };
}

/**
 * List available templates
 */
function listTemplates() {
  const templates = [];

  Object.entries(RESPONSE_TEMPLATES).forEach(([category, types]) => {
    Object.entries(types).forEach(([type, template]) => {
      templates.push({
        category,
        type,
        requiredFields: template.requiredFields,
        description: `${category} - ${type}`
      });
    });
  });

  return {
    success: true,
    templates,
    standardPhrases: Object.keys(STANDARD_PHRASES)
  };
}

module.exports = {
  generateResponse,
  getTemplatePreview,
  listTemplates,
  RESPONSE_TEMPLATES,
  STANDARD_PHRASES
};
