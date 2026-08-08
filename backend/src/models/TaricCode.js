const mongoose = require('mongoose');

/**
 * Restriccion arancelaria por pais de origen.
 *
 * En esquema aparte con `typeKey` cambiado porque el campo se llama `type`
 * (prohibition, quota, antidumping) y `type` es la clave reservada con la que
 * Mongoose declara el tipo de un path. Declarado en linea, Mongoose leia el
 * elemento como `String` y guardar una restriccion fallaba con
 * `Cast to [string] failed`: de este campo depende avisar de un antidumping,
 * que es una diferencia de miles de euros en la liquidacion.
 */
const RestriccionOrigenSchema = new mongoose.Schema({
  country: String,
  type: String, // prohibition, quota, antidumping
  description: String
}, { _id: false, typeKey: '$type' });

/**
 * Modelo para almacenar codigos TARIC y sus detalles
 * Se puede poblar desde la API de la Comision Europea o archivos locales
 */
const TaricCodeSchema = new mongoose.Schema({
  // Codigo completo (hasta 14 digitos)
  code: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Desglose del codigo
  breakdown: {
    chapter: String,      // 2 digitos (ej: 84)
    heading: String,      // 4 digitos (ej: 8471)
    subheading: String,   // 6 digitos HS (ej: 847130)
    cnCode: String,       // 8 digitos NC (ej: 84713000)
    taricCode: String,    // 10 digitos TARIC (ej: 8471300000)
    additionalCode: String // 4 digitos adicionales si aplica
  },

  // Descripcion en varios idiomas
  description: {
    es: { type: String, required: true },
    en: String
  },

  // Descripcion legal completa (incluye notas de seccion/capitulo)
  legalDescription: String,

  // Jerarquia
  parent: {
    type: String,
    index: true
  },

  level: {
    type: Number, // 2, 4, 6, 8, 10, 14
    required: true
  },

  // Aranceles
  duties: {
    thirdCountry: {
      type: Number, // Porcentaje
      default: 0
    },
    specific: {
      amount: Number,
      unit: String // EUR/100kg, EUR/hl, etc.
    },
    mixed: {
      adValorem: Number,
      specific: {
        amount: Number,
        unit: String
      }
    }
  },

  // IVA
  vat: {
    standard: { type: Number, default: 21 },
    reduced: Number,
    superReduced: Number,
    applicable: { type: Number, default: 21 }
  },

  // Impuestos especiales
  specialTaxes: [{
    type: { type: String }, // hidrocarburos, alcohol, tabaco, etc.
    rate: Number,
    unit: String
  }],

  // Unidades suplementarias requeridas.
  // OJO: `type` es palabra reservada de Mongoose. Declarado como `type: String`
  // (SchemaType), Mongoose colapsaba TODO el subobjeto a un SchemaString y, ademas,
  // la clave `required: {...}` (truthy) lo marcaba como requerido. Efecto real:
  // guardar `supplementaryUnit: { required, type, description }` -que es lo que
  // escribe taricService- reventaba con "Cast to string failed" y el campo NO se
  // persistia. AEAT exige supplementaryUnits para varios codigos (error 2149,
  // p.ej. 8471*), asi que el catalogo perdia ese dato. Fix: envolver `type` en
  // { type: String } para que sea un campo del subdocumento, no el SchemaType.
  supplementaryUnit: {
    required: { type: Boolean, default: false },
    type: { type: String }, // p/st (piezas), pa (pares), l (litros), etc.
    description: String
  },

  // Medidas y restricciones
  measures: [{
    type: { type: String }, // import_license, quota, surveillance, etc.
    code: String,
    description: String,
    startDate: Date,
    endDate: Date,
    footnote: String
  }],

  // Certificados/documentos requeridos
  requiredDocuments: [{
    code: String, // C400, N851, etc.
    description: String,
    authority: String, // SOIVRE, Sanidad, etc.
    conditions: String
  }],

  // Restricciones por origen
  originRestrictions: [RestriccionOrigenSchema],

  // Preferencias arancelarias disponibles
  preferences: [{
    agreement: String, // SPG, EUR-MED, etc.
    countries: [String],
    dutyRate: Number,
    certificateRequired: String // EUR.1, Form A, etc.
  }],

  // Notas importantes
  notes: [String],

  // Palabras clave para busqueda
  keywords: [String],

  // Ejemplos de productos
  examples: [String],

  // Metadatos
  isLeaf: { type: Boolean, default: false }, // Es codigo final (no tiene hijos)
  isActive: { type: Boolean, default: true },
  validFrom: Date,
  validTo: Date,
  lastUpdated: { type: Date, default: Date.now }

}, {
  timestamps: true
});

// Indexes para busqueda
TaricCodeSchema.index({ 'description.es': 'text', 'keywords': 'text', 'examples': 'text' });
TaricCodeSchema.index({ 'breakdown.chapter': 1 });
TaricCodeSchema.index({ level: 1, isActive: 1 });

// Metodos
TaricCodeSchema.methods.getFullPath = async function() {
  const codes = [this];
  let current = this;

  while (current.parent) {
    current = await this.model('TaricCode').findOne({ code: current.parent });
    if (current) codes.unshift(current);
    else break;
  }

  return codes;
};

TaricCodeSchema.methods.getChildren = function() {
  const nextLevel = this.level + 2;
  const prefix = this.code;
  return this.model('TaricCode').find({
    code: new RegExp(`^${prefix}`),
    level: nextLevel,
    isActive: true
  }).sort({ code: 1 });
};

// Statics
TaricCodeSchema.statics.search = function(query, limit = 20) {
  return this.find(
    { $text: { $search: query }, isActive: true, isLeaf: true },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .lean();
};

TaricCodeSchema.statics.findByChapter = function(chapter) {
  return this.find({
    'breakdown.chapter': chapter,
    isActive: true
  }).sort({ code: 1 });
};

TaricCodeSchema.statics.getChapters = function() {
  return this.find({
    level: 2,
    isActive: true
  }).sort({ code: 1 }).select('code description');
};

module.exports = mongoose.model('TaricCode', TaricCodeSchema);
