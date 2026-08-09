/**
 * PUERequest Model
 * Punto Unico de Entrada - Ventanilla Unica Aduanera
 *
 * Tipos de PUE:
 * - ROHS/RAEE: Residuos de aparatos electricos y electronicos
 * - COM: Seguridad de productos industriales
 * - ECO: Productos ecologicos
 * - CAL: Calidad comercial
 *
 * Endpoint AEAT: https://www7.aeat.es/wlpl/AD44-JDIT/EnvioMensajePUE
 */
const mongoose = require('mongoose');
// Contador atomico: el patron countDocuments()+1 reutilizaba referencias vivas
// tras un borrado (E11000) y repartia el mismo numero en altas concurrentes.
const { nextReference } = require('../utils/sequence');

// Esquema de direccion
const AddressSchema = new mongoose.Schema({
  streetAndNumber: String,
  city: String,
  postalCode: String,
  province: String,
  country: {
    type: String,
    match: /^[A-Z]{2}$/,
    default: 'ES'
  }
}, { _id: false });

// Esquema de parte (operador/importador/fabricante)
const PartySchema = new mongoose.Schema({
  eori: {
    type: String,
    match: /^[A-Z]{2}\w{1,15}$/
  },
  nif: String,
  name: {
    type: String,
    required: true
  },
  address: AddressSchema,
  contactPerson: String,
  phone: String,
  email: String,
  role: {
    type: String,
    enum: ['operator', 'importer', 'exporter', 'manufacturer', 'representative', 'consignee']
  }
}, { _id: false });

// Esquema de certificacion para productos
const CertificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'CE', 'ROHS', 'WEEE', 'REACH', 'ECO', 'BIO', 'ISO',
      'ENEC', 'GS', 'UKCA', 'FCC', 'UL', 'OTHER'
    ],
    required: true
  },
  number: String,
  issuer: String,
  issuedAt: Date,
  expiresAt: Date,
  status: {
    type: String,
    enum: ['valid', 'expired', 'pending_validation', 'invalid'],
    default: 'pending_validation'
  },
  documentUrl: String
}, { _id: false });

// Esquema de item de mercancia
const GoodsItemSchema = new mongoose.Schema({
  sequenceNumber: {
    type: Number,
    required: true,
    min: 1
  },
  description: {
    type: String,
    required: true,
    maxlength: 512
  },
  // Codigo TARIC (10 digitos)
  taricCode: {
    type: String,
    required: true,
    match: /^\d{8,10}$/
  },
  // Cantidad y unidad
  quantity: {
    type: Number,
    min: 0
  },
  unitOfMeasure: {
    type: String,
    default: 'PCE',
    enum: ['KGM', 'PCE', 'MTR', 'LTR', 'M2', 'M3', 'PAR', 'SET', 'TNE', 'UNI']
  },
  // Peso bruto en kg
  grossMass: {
    type: Number,
    min: 0
  },
  // Peso neto en kg
  netMass: {
    type: Number,
    min: 0
  },
  // Valor estadistico EUR
  statisticalValue: Number,
  // Pais de origen
  countryOfOrigin: {
    type: String,
    match: /^[A-Z]{2}$/
  },
  // Fabricante
  manufacturer: {
    name: String,
    country: String,
    registrationNumber: String
  },
  // Marca y modelo
  brand: String,
  model: String,
  // Numero de serie o lote
  serialNumber: String,
  batchNumber: String,
  // Certificaciones del producto
  certifications: [CertificationSchema],
  // Categoria de producto especifica
  productCategory: String,
  // Subcategoria (para ROHS: AEE categoria)
  subCategory: String,
  // Componentes peligrosos declarados
  hazardousComponents: [{
    substance: String,
    casNumber: String,
    concentration: Number,
    unit: String
  }],
  // Marcas y numeros de los bultos
  marksAndNumbers: String,
  // Numero de bultos
  numberOfPackages: Number,
  // Tipo de embalaje
  kindOfPackages: String,
  // Resultado de control para este item
  controlResult: {
    status: {
      type: String,
      enum: ['pending', 'passed', 'failed', 'conditional']
    },
    notes: String,
    checkedAt: Date,
    checkedBy: String
  }
}, { _id: false });

// Esquema de transporte
const TransportSchema = new mongoose.Schema({
  mode: {
    type: String,
    enum: ['ROAD', 'RAIL', 'AIR', 'SEA', 'MULTIMODAL'],
    required: true
  },
  // Numero de documento de transporte (CMR, BL, AWB)
  documentType: {
    type: String,
    enum: ['CMR', 'BL', 'AWB', 'CIM', 'TIR', 'OTHER']
  },
  documentNumber: String,
  // Contenedor
  containerNumber: String,
  sealNumber: String,
  // Matricula vehiculo
  vehicleRegistration: String,
  // Datos de buque/avion
  vesselName: String,
  flightNumber: String,
  // Fechas
  departureDate: Date,
  arrivalDate: Date,
  expectedArrivalDate: Date,
  // Lugar de descarga
  unloadingPlace: String
}, { _id: false });

// Esquema de inspeccion
const InspectionSchema = new mongoose.Schema({
  scheduled: {
    type: Boolean,
    default: false
  },
  scheduledDate: Date,
  scheduledTime: String,
  location: String,
  inspector: {
    name: String,
    id: String,
    organization: String
  },
  type: {
    type: String,
    enum: ['documental', 'fisica', 'laboratorio', 'mixta']
  },
  // Resultado
  result: {
    type: String,
    enum: ['pending', 'favorable', 'favorable_with_conditions', 'unfavorable', 'cancelled']
  },
  resultDate: Date,
  resultNotes: String,
  // Muestras de laboratorio
  laboratoryAnalysis: {
    required: Boolean,
    samplesTaken: Number,
    laboratoryName: String,
    analysisType: String,
    analysisResult: String,
    reportReference: String,
    reportDate: Date
  },
  // Hallazgos
  findings: [{
    category: String,
    description: String,
    severity: {
      type: String,
      enum: ['minor', 'major', 'critical']
    },
    action: String
  }],
  // Actas
  reportNumber: String,
  reportDate: Date,
  reportUrl: String
}, { _id: false });

// Esquema de certificado emitido
const IssuedCertificateSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['CERTIFICATE_CONFORMITY', 'CERTIFICATE_INSPECTION', 'AUTHORIZATION', 'EXEMPTION', 'OTHER']
  },
  number: String,
  issuedAt: Date,
  validUntil: Date,
  issuedBy: {
    authority: String,
    office: String,
    officer: String
  },
  documentUrl: String,
  status: {
    type: String,
    enum: ['active', 'revoked', 'expired'],
    default: 'active'
  }
}, { _id: false });

// Esquema de documento requerido
const RequiredDocumentSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true
  },
  name: String,
  required: {
    type: Boolean,
    default: true
  },
  provided: {
    type: Boolean,
    default: false
  },
  providedAt: Date,
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  },
  documentUrl: String,
  validationStatus: {
    type: String,
    enum: ['pending', 'valid', 'invalid', 'expired'],
    default: 'pending'
  },
  validationNotes: String
}, { _id: false });

// Esquema de tasa
const FeeSchema = new mongoose.Schema({
  concept: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'EUR'
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'exempt'],
    default: 'pending'
  },
  paymentReference: String,
  paidAt: Date
}, { _id: false });

// Esquema de respuesta AEAT/SOIVRE
const ResponseSchema = new mongoose.Schema({
  code: String,
  message: String,
  timestamp: Date,
  correlationId: String,
  errors: [{
    field: String,
    code: String,
    message: String
  }],
  warnings: [{
    field: String,
    code: String,
    message: String
  }]
}, { _id: false, suppressReservedKeysWarning: true });

// Esquema principal PUERequest
const PUERequestSchema = new mongoose.Schema({
  // Multi-tenancy
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },

  // === IDENTIFICADORES ===

  // Referencia interna unica
  reference: {
    type: String,
    unique: true,
    sparse: true
  },

  // Referencia PUE asignada por AEAT/SOIVRE
  pueReference: {
    type: String,
    sparse: true
  },

  // Numero de expediente SOIVRE
  expedientNumber: String,

  // === TIPO DE CONTROL ===

  pueType: {
    type: String,
    required: true,
    enum: ['ROHS', 'COM', 'ECO', 'CAL']
  },

  // Subtipo especifico
  pueSubtype: {
    type: String,
    enum: [
      // ROHS subtipos
      'ROHS_AEE', 'ROHS_RAEE', 'ROHS_PILAS',
      // COM subtipos
      'COM_JUGUETES', 'COM_EPI', 'COM_MATERIAL_ELECTRICO', 'COM_MAQUINARIA', 'COM_EXPLOSIVOS', 'COM_GAS',
      // ECO subtipos
      'ECO_ALIMENTOS', 'ECO_VINOS', 'ECO_TEXTIL', 'ECO_COSMETICOS',
      // CAL subtipos
      'CAL_TEXTIL', 'CAL_CALZADO', 'CAL_CERAMICA', 'CAL_VIDRIO', 'CAL_MUEBLES'
    ]
  },

  // === REFERENCIAS CRUZADAS ===

  // Expedicion asociada
  expedition: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expedition'
  },

  // MRN de declaracion aduanera
  declarationMRN: String,

  // Clave Zeta Partida (5 digitos, identifica item dentro del MRN)
  claveZeta: {
    type: String,
    match: /^\d{5}$/
  },

  // MRN + Clave Zeta combinado
  mrnPartida: String,

  // Tipo de flujo (determina bifurcacion UI SOIVRE vs ROHS/RAEE)
  flowType: {
    type: String,
    enum: ['SOIVRE', 'ROHS_RAEE']
  },

  // Operacion
  operationType: {
    type: String,
    enum: ['ALTA', 'BAJA', 'MODIFICACION'],
    default: 'ALTA'
  },

  // Tipo documento
  documentTypePue: {
    type: String,
    enum: ['DUA', 'OTRA_DECLARACION'],
    default: 'DUA'
  },

  // Referencia / Docucice 1
  referenciaDocucice: String,

  // Especificidades (multi-select)
  specificities: [String],

  // Unidades de Mercancia
  merchandiseUnit: {
    type: String,
    enum: ['DOZ', 'SET', 'MTR', 'M2', 'M3', 'PAR', 'UNI', 'KGM', 'PCE', 'TNE']
  },

  // Cantidad de mercancia
  merchandiseQuantity: Number,

  // DUA Precedente
  duaPrecedente: String,

  // Id. (No de solicitud) SOIVRE precedente
  soivrePrecedente: String,

  // CodCice (Centro del S.I. SOIVRE)
  codCice: {
    code: String,
    name: String
  },

  // CodPi (Punto de inspeccion SOIVRE)
  codPi: {
    code: String,
    name: String
  },

  // Correo electronico de contacto
  contactEmail: String,

  // Tipo Declaracion SOIVRE
  declarationTypeSoivre: {
    type: String,
    enum: ['EXPEDIENTE_NUEVO', 'AMPLIACION', 'RECTIFICACION'],
    default: 'EXPEDIENTE_NUEVO'
  },

  // Codigo SOIVRE Producto
  codigoSoivreProducto: String,

  // Certificados solicitados
  certificates: {
    com: {
      type: String,
      enum: ['NORMAL', 'NOT_APPLICABLE', 'CONSULT']
    },
    rohs: {
      type: String,
      enum: ['NORMAL', 'NOT_APPLICABLE', 'CONSULT']
    },
    raee: {
      type: String,
      enum: ['NORMAL', 'NOT_APPLICABLE', 'CONSULT']
    }
  },

  // Numeros RII (Registro Integrado Industrial)
  riiNumbers: {
    raee: String,
    pya: String
  },

  // Datos auto-rellenados desde H1
  h1AutoFill: {
    importerName: String,
    importerNif: String,
    importerEori: String,
    taricCode: String,
    goodsDescription: String,
    quantity: Number,
    unit: String,
    origin: String,
    customsOffice: String
  },

  // Referencia ENS (si aplica)
  ensReference: String,

  // === USUARIO ===

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // === PARTES INVOLUCRADAS ===

  // Operador/Solicitante
  operator: {
    type: PartySchema,
    required: true
  },

  // Importador
  importer: PartySchema,

  // Fabricante
  manufacturer: PartySchema,

  // Representante aduanero
  representative: PartySchema,

  // Destinatario final
  consignee: PartySchema,

  // === ADUANA Y OFICINA ===

  // Aduana de despacho
  customsOffice: {
    code: {
      type: String,
      match: /^ES\d{6}$/
    },
    name: String
  },

  // Oficina SOIVRE
  soivreOffice: {
    code: String,
    name: String,
    province: String
  },

  // === MERCANCIAS ===

  goods: {
    type: [GoodsItemSchema],
    validate: {
      validator: function(items) {
        return items.length > 0;
      },
      message: 'Debe incluir al menos una mercancia'
    }
  },

  // Totales
  totals: {
    grossMass: Number,
    netMass: Number,
    packages: Number,
    statisticalValue: Number,
    items: Number
  },

  // === TRANSPORTE ===

  transport: TransportSchema,

  // === ESTADO ===

  status: {
    type: String,
    enum: [
      'draft',              // Borrador
      'validated',          // Validada localmente
      'submitted',          // Enviada a AEAT/SOIVRE
      'registered',         // Registrada/admitida
      'pending_documents',  // Pendiente de documentacion
      'pending_inspection', // Pendiente de inspeccion
      'inspection_scheduled', // Inspeccion programada
      'in_inspection',      // En inspeccion
      'pending_lab',        // Pendiente laboratorio
      'approved',           // Aprobada/favorable
      'approved_conditions', // Aprobada con condiciones
      'rejected',           // Rechazada/desfavorable
      'cancelled',          // Anulada
      'expired'             // Caducada
    ],
    default: 'draft'
  },

  // Fecha de envio
  submittedAt: Date,

  // Fecha limite de resolucion
  deadline: Date,

  // Prioridad
  priority: {
    type: String,
    enum: ['normal', 'urgent', 'express'],
    default: 'normal'
  },

  // === RESPUESTAS AEAT/SOIVRE ===

  aeatResponse: ResponseSchema,

  soivreResponse: ResponseSchema,

  // === INSPECCION ===

  inspection: InspectionSchema,

  // === CERTIFICADO EMITIDO ===

  issuedCertificate: IssuedCertificateSchema,

  // === DOCUMENTOS ===

  // Documentos requeridos
  requiredDocuments: [RequiredDocumentSchema],

  // Documentos adjuntos
  attachedDocuments: [{
    type: {
      type: String,
      enum: [
        'DECLARATION_CONFORMITY', 'CERTIFICATE_CE', 'CERTIFICATE_ROHS',
        'CERTIFICATE_REACH', 'TEST_REPORT', 'TECHNICAL_FILE',
        'INVOICE', 'PACKING_LIST', 'TRANSPORT_DOC', 'POWER_OF_ATTORNEY',
        'MANUFACTURER_AUTH', 'LABEL_SAMPLE', 'PRODUCT_IMAGE', 'OTHER'
      ]
    },
    name: String,
    documentNumber: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

  // === TASAS ===

  fees: [FeeSchema],

  totalFees: {
    type: Number,
    default: 0
  },

  // === HISTORIAL ===

  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    aeatCode: String,
    soivreCode: String
  }],

  // === NOTAS ===

  notes: [{
    text: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    isInternal: { type: Boolean, default: false }
  }],

  // === XML ===

  generatedXML: String,

  // === METADATA ===

  metadata: {
    source: String, // 'manual', 'api', 'import'
    batchId: String,
    externalReference: String
  }

}, {
  timestamps: true,
  suppressReservedKeysWarning: true
});

// Indices
PUERequestSchema.index({ reference: 1 });
PUERequestSchema.index({ pueReference: 1 });
PUERequestSchema.index({ expedientNumber: 1 });
PUERequestSchema.index({ pueType: 1, status: 1 });
PUERequestSchema.index({ status: 1, createdAt: -1 });
PUERequestSchema.index({ 'operator.eori': 1 });
PUERequestSchema.index({ 'operator.nif': 1 });
PUERequestSchema.index({ declarationMRN: 1 });
PUERequestSchema.index({ expedition: 1 });
PUERequestSchema.index({ 'customsOffice.code': 1 });
PUERequestSchema.index({ 'soivreOffice.code': 1 });
PUERequestSchema.index({ createdBy: 1, createdAt: -1 });
PUERequestSchema.index({ deadline: 1 });
PUERequestSchema.index({ 'goods.taricCode': 1 });
PUERequestSchema.index({ 'transport.containerNumber': 1 });
PUERequestSchema.index({ mrnPartida: 1 });
PUERequestSchema.index({ flowType: 1 });
PUERequestSchema.index({ 'codCice.code': 1 });
PUERequestSchema.index({ 'riiNumbers.raee': 1 });

// Generar referencia automatica
PUERequestSchema.pre('save', async function(next) {
  if (!this.reference) {
    const year = new Date().getFullYear();
    this.reference = await nextReference(this.constructor, 'reference', `PUE-${this.pueType}-${year}`, 6);
  }

  // Calcular totales
  if (this.goods && this.goods.length > 0) {
    this.totals = {
      grossMass: this.goods.reduce((sum, g) => sum + (g.grossMass || 0), 0),
      netMass: this.goods.reduce((sum, g) => sum + (g.netMass || 0), 0),
      packages: this.goods.reduce((sum, g) => sum + (g.numberOfPackages || 0), 0),
      statisticalValue: this.goods.reduce((sum, g) => sum + (g.statisticalValue || 0), 0),
      items: this.goods.length
    };
  }

  // Calcular total de tasas
  if (this.fees && this.fees.length > 0) {
    this.totalFees = this.fees
      .filter(f => f.status !== 'exempt')
      .reduce((sum, f) => sum + f.amount, 0);
  }

  // Registrar cambio de estado
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date()
    });
  }

  next();
});

// Metodo: Validar para envio
PUERequestSchema.methods.validateForSubmission = function() {
  const errors = [];

  // Validar operador
  if (!this.operator || !this.operator.name) {
    errors.push({
      field: 'operator.name',
      code: 'PUE_OPERATOR_REQUIRED',
      message: 'Nombre del operador es obligatorio'
    });
  }

  if (!this.operator?.eori && !this.operator?.nif) {
    errors.push({
      field: 'operator.eori',
      code: 'PUE_OPERATOR_ID_REQUIRED',
      message: 'EORI o NIF del operador es obligatorio'
    });
  }

  // Validar mercancias
  if (!this.goods || this.goods.length === 0) {
    errors.push({
      field: 'goods',
      code: 'PUE_GOODS_REQUIRED',
      message: 'Debe incluir al menos una mercancia'
    });
  }

  // Validar cada mercancia
  for (const [idx, item] of (this.goods || []).entries()) {
    if (!item.taricCode) {
      errors.push({
        field: `goods[${idx}].taricCode`,
        code: 'PUE_TARIC_REQUIRED',
        message: `Codigo TARIC obligatorio para mercancia ${idx + 1}`
      });
    }

    if (!item.description) {
      errors.push({
        field: `goods[${idx}].description`,
        code: 'PUE_DESCRIPTION_REQUIRED',
        message: `Descripcion obligatoria para mercancia ${idx + 1}`
      });
    }

    // Validaciones especificas por tipo
    if (this.pueType === 'ROHS') {
      if (!item.manufacturer?.name) {
        errors.push({
          field: `goods[${idx}].manufacturer.name`,
          code: 'PUE_MANUFACTURER_REQUIRED',
          message: `Fabricante obligatorio para control ROHS en mercancia ${idx + 1}`
        });
      }
    }

    if (this.pueType === 'ECO') {
      const hasEcoCert = item.certifications?.some(c => ['ECO', 'BIO'].includes(c.type));
      if (!hasEcoCert) {
        errors.push({
          field: `goods[${idx}].certifications`,
          code: 'PUE_ECO_CERT_REQUIRED',
          message: `Certificacion ecologica obligatoria para mercancia ${idx + 1}`
        });
      }
    }
  }

  // Validar aduana/oficina
  if (!this.customsOffice?.code && !this.soivreOffice?.code) {
    errors.push({
      field: 'customsOffice',
      code: 'PUE_OFFICE_REQUIRED',
      message: 'Aduana u oficina SOIVRE es obligatoria'
    });
  }

  // Validar transporte (solo si no tiene MRN vinculado)
  if (!this.declarationMRN && !this.transport?.mode) {
    errors.push({
      field: 'transport.mode',
      code: 'PUE_TRANSPORT_REQUIRED',
      message: 'Modo de transporte es obligatorio'
    });
  }

  // === Validaciones Phase 5: SOIVRE Overhaul ===

  // Validar CodCice y CodPi
  if (this.flowType && !this.codCice?.code) {
    errors.push({
      field: 'codCice',
      code: 'PUE_CODCICE_REQUIRED',
      message: 'Centro SOIVRE (CodCice) es obligatorio'
    });
  }

  if (this.flowType && !this.codPi?.code) {
    errors.push({
      field: 'codPi',
      code: 'PUE_CODPI_REQUIRED',
      message: 'Punto de inspeccion (CodPi) es obligatorio'
    });
  }

  // Validar email de contacto
  if (this.flowType && !this.contactEmail) {
    errors.push({
      field: 'contactEmail',
      code: 'PUE_EMAIL_REQUIRED',
      message: 'Correo electronico de contacto es obligatorio'
    });
  }

  // Validaciones especificas por flujo
  if (this.flowType === 'SOIVRE') {
    // SOIVRE requiere documentos obligatoriamente
    if (!this.attachedDocuments || this.attachedDocuments.length === 0) {
      errors.push({
        field: 'attachedDocuments',
        code: 'PUE_SOIVRE_DOCS_REQUIRED',
        message: 'Flujo SOIVRE requiere documentacion adjunta. El inspector no firmara sin documentacion.'
      });
    }
  }

  if (this.flowType === 'ROHS_RAEE') {
    // ROHS/RAEE requiere certificados
    if (!this.certificates?.rohs && !this.certificates?.raee) {
      errors.push({
        field: 'certificates',
        code: 'PUE_ROHS_CERT_REQUIRED',
        message: 'Debe seleccionar al menos un certificado ROHS o RAEE'
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// Metodo: Actualizar estado
PUERequestSchema.methods.updateStatus = function(newStatus, userId, reason, aeatCode, soivreCode) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    user: userId,
    reason,
    aeatCode,
    soivreCode
  });
  return this;
};

// Metodo: Agregar nota
PUERequestSchema.methods.addNote = function(text, userId, isInternal = false) {
  this.notes.push({
    text,
    createdBy: userId,
    createdAt: new Date(),
    isInternal
  });
  return this;
};

// Metodo: Agregar documento
PUERequestSchema.methods.addDocument = function(documentData, userId) {
  this.attachedDocuments.push({
    ...documentData,
    uploadedAt: new Date(),
    uploadedBy: userId
  });
  return this;
};

// Metodo: Marcar documento requerido como provisto
PUERequestSchema.methods.markDocumentProvided = function(code, documentId, documentUrl) {
  const doc = this.requiredDocuments.find(d => d.code === code);
  if (doc) {
    doc.provided = true;
    doc.providedAt = new Date();
    doc.documentId = documentId;
    doc.documentUrl = documentUrl;
  }
  return this;
};

// Metodo: Registrar resultado de inspeccion
PUERequestSchema.methods.recordInspectionResult = function(result, notes, findings = []) {
  if (!this.inspection) {
    this.inspection = {};
  }
  this.inspection.result = result;
  this.inspection.resultDate = new Date();
  this.inspection.resultNotes = notes;
  this.inspection.findings = findings;

  // Actualizar estado segun resultado
  if (result === 'favorable') {
    this.status = 'approved';
  } else if (result === 'favorable_with_conditions') {
    this.status = 'approved_conditions';
  } else if (result === 'unfavorable') {
    this.status = 'rejected';
  }

  return this;
};

// Metodo estatico: Obtener estadisticas
PUERequestSchema.statics.getStats = async function(filters = {}) {
  const match = {};

  if (filters.startDate || filters.endDate) {
    match.createdAt = {};
    if (filters.startDate) match.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) match.createdAt.$lte = new Date(filters.endDate);
  }

  if (filters.pueType) match.pueType = filters.pueType;
  if (filters.createdBy) match.createdBy = new mongoose.Types.ObjectId(filters.createdBy);

  const byStatus = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const byType = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$pueType',
        count: { $sum: 1 },
        approved: {
          $sum: { $cond: [{ $in: ['$status', ['approved', 'approved_conditions']] }, 1, 0] }
        },
        rejected: {
          $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
        },
        pending: {
          $sum: { $cond: [{ $in: ['$status', ['submitted', 'registered', 'pending_documents', 'pending_inspection', 'inspection_scheduled', 'in_inspection', 'pending_lab']] }, 1, 0] }
        }
      }
    },
    { $sort: { count: -1 } }
  ]);

  const byOffice = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$soivreOffice.code',
        name: { $first: '$soivreOffice.name' },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  const pendingInspections = await this.countDocuments({
    ...match,
    status: { $in: ['pending_inspection', 'inspection_scheduled'] }
  });

  const overdueDeadlines = await this.countDocuments({
    ...match,
    status: { $nin: ['approved', 'approved_conditions', 'rejected', 'cancelled', 'expired'] },
    deadline: { $lt: new Date() }
  });

  return {
    byStatus,
    byType,
    byOffice,
    pendingInspections,
    overdueDeadlines,
    totals: {
      total: byStatus.reduce((acc, s) => acc + s.count, 0),
      approved: byType.reduce((acc, t) => acc + t.approved, 0),
      rejected: byType.reduce((acc, t) => acc + t.rejected, 0),
      pending: byType.reduce((acc, t) => acc + t.pending, 0)
    }
  };
};

// Metodo estatico: Buscar por expedicion
PUERequestSchema.statics.findByExpedition = async function(expeditionId) {
  return this.find({ expedition: expeditionId }).sort({ createdAt: -1 });
};

// Metodo estatico: Buscar por declaracion
PUERequestSchema.statics.findByDeclaration = async function(mrn) {
  return this.find({ declarationMRN: mrn }).sort({ createdAt: -1 });
};

// Metodo estatico: Obtener vencimientos proximos
PUERequestSchema.statics.getUpcomingDeadlines = async function(days = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return this.find({
    status: { $nin: ['approved', 'approved_conditions', 'rejected', 'cancelled', 'expired', 'draft'] },
    deadline: {
      $gte: new Date(),
      $lte: futureDate
    }
  }).sort({ deadline: 1 });
};

module.exports = mongoose.model('PUERequest', PUERequestSchema);
