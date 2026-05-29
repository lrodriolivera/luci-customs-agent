const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware para manejar errores de validacion
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Datos de entrada invalidos',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

/**
 * Validadores para autenticacion
 */
const authValidators = {
  register: [
    body('email')
      .isEmail()
      .withMessage('Email invalido')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('La contrasena debe tener al menos 6 caracteres'),
    body('name')
      .trim()
      .notEmpty()
      .withMessage('El nombre es obligatorio')
      .isLength({ max: 100 })
      .withMessage('El nombre no puede exceder 100 caracteres'),
    body('companyName')
      .trim()
      .notEmpty()
      .withMessage('El nombre de la empresa es obligatorio')
      .isLength({ max: 200 })
      .withMessage('El nombre de empresa no puede exceder 200 caracteres'),
    handleValidationErrors
  ],

  login: [
    body('email')
      .isEmail()
      .withMessage('Email invalido')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('La contrasena es obligatoria'),
    handleValidationErrors
  ],

  forgotPassword: [
    body('email')
      .isEmail()
      .withMessage('Email invalido')
      .normalizeEmail(),
    handleValidationErrors
  ],

  resetPassword: [
    param('token')
      .isHexadecimal()
      .withMessage('Token invalido')
      .isLength({ min: 64, max: 64 })
      .withMessage('Token invalido'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('La contrasena debe tener al menos 6 caracteres'),
    handleValidationErrors
  ]
};

/**
 * Validadores para expedientes
 */
const expeditionValidators = {
  create: [
    body('operationType')
      .customSanitizer(value => value?.toLowerCase())
      .isIn(['import', 'export', 'transit'])
      .withMessage('Tipo de operacion debe ser: import, export o transit'),
    body('transportMode')
      .customSanitizer(value => {
        // Map frontend values to backend values
        const mapping = {
          'SEA': 'maritime',
          'AIR': 'air',
          'ROAD': 'road',
          'RAIL': 'rail',
          'MULTIMODAL': 'multimodal',
          'POSTAL': 'postal'
        };
        return mapping[value] || value?.toLowerCase();
      })
      .isIn(['maritime', 'air', 'road', 'rail', 'postal', 'multimodal'])
      .withMessage('Modo de transporte invalido'),
    body('client.companyName')
      .trim()
      .notEmpty()
      .withMessage('Nombre de empresa del cliente es obligatorio'),
    body('client.nif')
      .trim()
      .notEmpty()
      .withMessage('NIF del cliente es obligatorio')
      .matches(/^[A-Z0-9]{8,9}[A-Z0-9]?$/)
      .withMessage('Formato de NIF invalido (debe ser 8-10 caracteres alfanumericos)'),
    body('client.email')
      .optional()
      .isEmail()
      .withMessage('Email del cliente invalido'),
    handleValidationErrors
  ],

  update: [
    param('id')
      .isMongoId()
      .withMessage('ID de expediente invalido'),
    body('status')
      .optional()
      .isIn([
        'draft', 'pending_documents', 'documents_received',
        'validating_documents', 'documents_incomplete', 'documents_validated',
        'classification_pending', 'classification_done', 'ready_for_declaration',
        'declaration_draft', 'declaration_submitted', 'green_channel',
        'orange_channel', 'red_channel', 'levante', 'completed', 'cancelled', 'on_hold'
      ])
      .withMessage('Estado invalido'),
    handleValidationErrors
  ],

  getById: [
    param('id')
      .isMongoId()
      .withMessage('ID de expediente invalido'),
    handleValidationErrors
  ],

  list: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Pagina debe ser un numero positivo'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limite debe ser entre 1 y 100'),
    query('status')
      .optional()
      .isString(),
    query('operationType')
      .optional()
      .isIn(['import', 'export', 'transit']),
    handleValidationErrors
  ]
};

/**
 * Validadores para documentos
 */
const documentValidators = {
  upload: [
    body('documentType')
      .isIn([
        'commercial_invoice', 'proforma_invoice', 'packing_list',
        'bill_of_lading', 'air_waybill', 'cmr', 'certificate_origin',
        'eur1', 'eur_med', 'atr', 'form_a', 'sanitary_certificate',
        'phytosanitary_certificate', 'veterinary_certificate',
        'fumigation_certificate', 'insurance_certificate',
        'dispatch_authorization', 'import_license', 'export_license',
        'ce_certificate', 'quality_certificate', 'other'
      ])
      .withMessage('Tipo de documento invalido'),
    body('expeditionId')
      .isMongoId()
      .withMessage('ID de expediente invalido'),
    handleValidationErrors
  ],

  validate: [
    param('expeditionId')
      .isMongoId()
      .withMessage('ID de expediente invalido'),
    param('docId')
      .isMongoId()
      .withMessage('ID de documento invalido'),
    handleValidationErrors
  ]
};

/**
 * Validadores para clasificacion TARIC
 */
const classificationValidators = {
  suggest: [
    body('description')
      .trim()
      .notEmpty()
      .withMessage('La descripcion del producto es obligatoria')
      .isLength({ min: 10, max: 2000 })
      .withMessage('La descripcion debe tener entre 10 y 2000 caracteres'),
    body('additionalInfo')
      .optional()
      .isObject()
      .withMessage('Informacion adicional debe ser un objeto'),
    handleValidationErrors
  ],

  getByCode: [
    param('code')
      .matches(/^\d{2,14}$/)
      .withMessage('Codigo TARIC invalido (debe ser 2-14 digitos)'),
    handleValidationErrors
  ]
};

/**
 * Validadores para declaraciones
 */
const declarationValidators = {
  generateH1: [
    body('expeditionId')
      .isMongoId()
      .withMessage('ID de expediente invalido'),
    body('regime')
      .optional()
      .matches(/^\d{2}$/)
      .withMessage('Regimen debe ser un codigo de 2 digitos'),
    handleValidationErrors
  ],

  generateAES: [
    body('expeditionId')
      .isMongoId()
      .withMessage('ID de expediente invalido'),
    handleValidationErrors
  ]
};

/**
 * Middleware para normalizar campos de calculo (acepta nombres alternativos)
 */
const normalizeCalculationFields = (req, res, next) => {
  if (req.body) {
    if (!req.body.taricCode && req.body.code) req.body.taricCode = req.body.code;
    if (req.body.value === undefined && req.body.customsValue !== undefined) req.body.value = req.body.customsValue;
    if (!req.body.origin && req.body.countryOfOrigin) req.body.origin = req.body.countryOfOrigin;
    if (!req.body.weight && req.body.netWeight) req.body.weight = req.body.netWeight;
  }
  next();
};

/**
 * Validadores para calculos
 */
const calculationValidators = {
  calculate: [
    normalizeCalculationFields,
    body('taricCode')
      .matches(/^\d{10,14}$/)
      .withMessage('Codigo TARIC debe tener 10-14 digitos'),
    body('value')
      .isFloat({ min: 0 })
      .withMessage('El valor debe ser un numero positivo'),
    body('currency')
      .optional()
      .isLength({ min: 3, max: 3 })
      .withMessage('La moneda debe ser un codigo ISO de 3 letras'),
    body('origin')
      .isLength({ min: 2, max: 2 })
      .withMessage('El origen debe ser un codigo ISO de 2 letras'),
    body('weight')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('El peso debe ser un numero positivo'),
    handleValidationErrors
  ]
};

/**
 * Validadores para chat/portal
 */
const portalValidators = {
  getByToken: [
    param('token')
      .isUUID(4)
      .withMessage('Token invalido'),
    handleValidationErrors
  ],

  sendMessage: [
    param('token')
      .isUUID(4)
      .withMessage('Token invalido'),
    body('content')
      .trim()
      .notEmpty()
      .withMessage('El mensaje no puede estar vacio')
      .isLength({ max: 10000 })
      .withMessage('El mensaje no puede exceder 10000 caracteres'),
    handleValidationErrors
  ]
};

module.exports = {
  handleValidationErrors,
  authValidators,
  expeditionValidators,
  documentValidators,
  classificationValidators,
  declarationValidators,
  calculationValidators,
  portalValidators
};
