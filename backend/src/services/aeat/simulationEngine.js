/**
 * Motor de Simulacion AEAT
 * Genera respuestas realistas sin conexion real a AEAT
 * Stock Logistic - LUCI Customs Agent
 */

const crypto = require('crypto');
const {
  RESPONSE_CODES,
  INSPECTION_CHANNELS,
  CUSTOMS_OFFICES,
  HIGH_RISK_COUNTRIES,
  SENSITIVE_TARIC_CHAPTERS,
  isHighRiskCountry,
  getTaricChapterControl
} = require('./aeatConfig');
const logger = require('../../config/logger');

class SimulationEngine {
  constructor(options = {}) {
    this.delayMs = options.delayMs || parseInt(process.env.AEAT_SIMULATION_DELAY_MS) || 1500;
    this.errorRate = options.errorRate || parseFloat(process.env.AEAT_SIMULATION_ERROR_RATE) || 0.05;
  }

  /**
   * Generar MRN realista
   * Formato AEAT: AANNTTXXXXXXXXXXXX (18 caracteres)
   * AA = Ano (2 digitos)
   * NN = Pais (ES)
   * TT = Tipo (IM=import, EX=export)
   * X = Alfanumerico (12 caracteres)
   */
  generateMRN(type = 'H1') {
    const year = new Date().getFullYear().toString().slice(-2);
    const typePrefix = type === 'AES' || type === 'export' ? 'EX' : 'IM';
    const randomPart = crypto.randomBytes(5).toString('hex').toUpperCase();
    const sequence = Date.now().toString().slice(-4);
    const checkDigit = this._calculateCheckDigit(`${year}ES${typePrefix}${randomPart}${sequence}`);
    return `${year}ES${typePrefix}${randomPart}${sequence}${checkDigit}`;
  }

  /**
   * Generar LRN (Local Reference Number)
   * Formato: YYESTXXXXXXXX
   */
  generateLRN() {
    const year = new Date().getFullYear().toString().slice(-2);
    const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${year}ESL${randomPart}`;
  }

  /**
   * Calcular digito de control
   */
  _calculateCheckDigit(value) {
    let sum = 0;
    for (let i = 0; i < value.length; i++) {
      sum += value.charCodeAt(i) * (i + 1);
    }
    return (sum % 36).toString(36).toUpperCase();
  }

  /**
   * Simular envio H1 (Importacion)
   */
  async simulateH1Submission(xml, options = {}) {
    logger.info('[SIMULATION] Processing H1 submission...');

    await this._simulateDelay();

    // Validar XML basico antes de "enviar"
    const validationResult = this._validateXmlStructure(xml, 'H1');
    if (!validationResult.valid) {
      logger.warn('[SIMULATION] H1 validation failed:', validationResult.errors);
      return this._generateErrorResponse(validationResult.errors, xml);
    }

    // Determinar escenario basado en datos del XML
    const scenario = options.forceScenario || this._determineScenario(xml, options);
    logger.info(`[SIMULATION] H1 scenario determined: ${scenario}`);

    return this._executeScenario(scenario, xml, 'H1', validationResult.warnings);
  }

  /**
   * Simular envio AES (Exportacion)
   */
  async simulateAESSubmission(xml, options = {}) {
    logger.info('[SIMULATION] Processing AES submission...');

    await this._simulateDelay();

    const validationResult = this._validateXmlStructure(xml, 'AES');
    if (!validationResult.valid) {
      logger.warn('[SIMULATION] AES validation failed:', validationResult.errors);
      return this._generateErrorResponse(validationResult.errors, xml);
    }

    const scenario = options.forceScenario || this._determineScenario(xml, options);
    logger.info(`[SIMULATION] AES scenario determined: ${scenario}`);

    return this._executeScenario(scenario, xml, 'AES', validationResult.warnings);
  }

  /**
   * Validar estructura XML basica
   */
  _validateXmlStructure(xml, type) {
    const errors = [];
    const warnings = [];

    if (!xml || typeof xml !== 'string') {
      errors.push({
        code: '1000',
        field: 'xml',
        message: 'XML no proporcionado o formato invalido'
      });
      return { valid: false, errors, warnings };
    }

    // Verificar declaracion XML
    if (!xml.trim().startsWith('<?xml')) {
      warnings.push({
        code: '4000',
        field: 'xml_declaration',
        message: 'Falta declaracion XML (<?xml version="1.0"?>)'
      });
    }

    // Verificar elemento raiz
    const hasValidRoot = xml.includes('<CC515C') ||
                         xml.includes('<Declaration') ||
                         xml.includes('<CustomsDeclaration');
    if (!hasValidRoot) {
      errors.push({
        code: '1003',
        field: 'root',
        message: 'Elemento raiz no encontrado (CC515C, Declaration o CustomsDeclaration)'
      });
    }

    // Verificar LRN
    const lrnMatch = xml.match(/<LRN>([^<]+)<\/LRN>/);
    if (!lrnMatch || !lrnMatch[1].trim()) {
      errors.push({
        code: '1004',
        field: 'LRN',
        message: 'LRN (Local Reference Number) es obligatorio'
      });
    }

    // Verificar DeclarationOfficeID
    const officeMatch = xml.match(/<(?:DeclarationOfficeID|CustomsOfficeID)>([^<]+)<\/(?:DeclarationOfficeID|CustomsOfficeID)>/);
    if (officeMatch) {
      const officeCode = officeMatch[1].trim();
      if (!CUSTOMS_OFFICES[officeCode]) {
        warnings.push({
          code: '4002',
          field: 'DeclarationOfficeID',
          message: `Codigo de aduana ${officeCode} no reconocido en el catalogo`
        });
      }
    } else {
      errors.push({
        code: '1004',
        field: 'DeclarationOfficeID',
        message: 'DeclarationOfficeID es obligatorio'
      });
    }

    // Validaciones especificas por tipo
    if (type === 'H1') {
      this._validateH1Specific(xml, errors, warnings);
    } else if (type === 'AES') {
      this._validateAESSpecific(xml, errors, warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validaciones especificas para H1 (Importacion)
   */
  _validateH1Specific(xml, errors, warnings) {
    // Verificar Importer
    const hasImporter = xml.includes('<Importer>') || xml.includes('<Importador>');
    if (!hasImporter) {
      errors.push({
        code: '1004',
        field: 'Importer',
        message: 'Datos del importador son obligatorios para H1'
      });
    }

    // Verificar EORI del importador
    const eoriMatch = xml.match(/<(?:Importer|Importador)>[\s\S]*?<(?:IdentificationID|EORI)>([^<]+)<\/(?:IdentificationID|EORI)>/);
    if (eoriMatch) {
      const eori = eoriMatch[1].trim();
      if (!this._validateEORI(eori)) {
        errors.push({
          code: '2001',
          field: 'Importer.EORI',
          message: `EORI ${eori} no tiene formato valido (debe ser XX + 1-15 caracteres alfanumericos)`
        });
      }
    } else {
      errors.push({
        code: '2001',
        field: 'Importer.EORI',
        message: 'EORI del importador es obligatorio'
      });
    }

    // Verificar items de mercancia
    const itemMatches = xml.match(/<(?:GovernmentAgencyGoodsItem|GoodsItem|Item)>/g);
    if (!itemMatches || itemMatches.length === 0) {
      errors.push({
        code: '1004',
        field: 'GoodsItems',
        message: 'Debe incluir al menos una partida de mercancias'
      });
    }

    // Verificar TARIC en items
    const taricMatches = [...xml.matchAll(/<(?:Classification|ClassificationID|TARIC)>[\s\S]*?<ID>(\d+)<\/ID>/g)];
    for (const match of taricMatches) {
      const taric = match[1];
      if (taric.length < 8 || taric.length > 14) {
        warnings.push({
          code: '2002',
          field: 'Classification.ID',
          message: `Codigo TARIC ${taric} tiene longitud incorrecta (debe ser 8-10 digitos, maximo 14 con adicionales)`
        });
      }
    }

    // Verificar peso bruto
    const grossMassMatch = xml.match(/<GrossMass>([^<]+)<\/GrossMass>/);
    if (grossMassMatch) {
      const grossMass = parseFloat(grossMassMatch[1]);
      if (isNaN(grossMass) || grossMass <= 0) {
        errors.push({
          code: '2004',
          field: 'GrossMass',
          message: 'Peso bruto debe ser un numero positivo'
        });
      }
    }
  }

  /**
   * Validaciones especificas para AES (Exportacion)
   */
  _validateAESSpecific(xml, errors, warnings) {
    // Verificar Exporter
    const hasExporter = xml.includes('<Exporter>') || xml.includes('<Exportador>');
    if (!hasExporter) {
      errors.push({
        code: '1004',
        field: 'Exporter',
        message: 'Datos del exportador son obligatorios para AES'
      });
    }

    // Verificar EORI del exportador
    const eoriMatch = xml.match(/<(?:Exporter|Exportador)>[\s\S]*?<(?:IdentificationID|EORI)>([^<]+)<\/(?:IdentificationID|EORI)>/);
    if (eoriMatch) {
      const eori = eoriMatch[1].trim();
      if (!this._validateEORI(eori)) {
        errors.push({
          code: '2001',
          field: 'Exporter.EORI',
          message: `EORI ${eori} no tiene formato valido`
        });
      }
    }

    // Verificar pais destino
    const destMatch = xml.match(/<(?:CountryOfDestinationCode|DestinationCountry)>([A-Z]{2})<\/(?:CountryOfDestinationCode|DestinationCountry)>/);
    if (!destMatch) {
      errors.push({
        code: '1004',
        field: 'CountryOfDestination',
        message: 'Pais de destino es obligatorio para exportaciones'
      });
    }

    // Verificar ExitOfficeID para exportaciones
    if (!xml.includes('<ExitOfficeID>')) {
      warnings.push({
        code: '4003',
        field: 'ExitOfficeID',
        message: 'ExitOfficeID recomendado para exportaciones'
      });
    }
  }

  /**
   * Validar formato EORI
   */
  _validateEORI(eori) {
    if (!eori) return false;
    // EORI europeo: 2 letras pais + hasta 15 caracteres alfanumericos
    return /^[A-Z]{2}[A-Z0-9]{1,15}$/.test(eori.toUpperCase());
  }

  /**
   * Determinar escenario basado en contenido XML
   */
  _determineScenario(xml, options) {
    // Si hay error forzado por tasa de error
    if (Math.random() < this.errorRate) {
      return 'random_error';
    }

    // Extraer datos relevantes para determinar escenario
    const totalValue = this._extractNumericValue(xml, 'TotalInvoiceAmount') ||
                       this._extractNumericValue(xml, 'InvoiceValue') ||
                       this._extractNumericValue(xml, 'ItemAmount');
    const taricCodes = this._extractAllTaricCodes(xml);
    const origin = this._extractValue(xml, 'CountryOfDispatchCode') ||
                   this._extractValue(xml, 'OriginCountry') ||
                   this._extractValue(xml, 'CountryCode');

    // Escenarios basados en valor (alto valor = mayor probabilidad de inspeccion)
    if (totalValue > 100000) {
      return Math.random() < 0.4 ? 'high_value_inspection' : 'success_with_warnings';
    }

    if (totalValue > 50000) {
      return Math.random() < 0.2 ? 'high_value_inspection' : 'success';
    }

    // Escenarios basados en origen (paises de riesgo)
    if (isHighRiskCountry(origin)) {
      return Math.random() < 0.25 ? 'origin_review' : 'success';
    }

    // Escenarios basados en TARIC (productos sensibles)
    const hasSensitive = taricCodes.some(code => {
      const chapter = code.substring(0, 2);
      return SENSITIVE_TARIC_CHAPTERS[chapter];
    });

    if (hasSensitive) {
      return Math.random() < 0.30 ? 'certificate_required' : 'success';
    }

    // Default: exito normal con probabilidades de canal
    return 'success';
  }

  /**
   * Ejecutar escenario especifico
   */
  _executeScenario(scenario, xml, type, validationWarnings = []) {
    const mrn = this.generateMRN(type);
    const lrn = this._extractValue(xml, 'LRN') || this.generateLRN();
    const customsOffice = this._extractValue(xml, 'DeclarationOfficeID') ||
                          this._extractValue(xml, 'CustomsOfficeID') ||
                          'ES002801';
    const timestamp = new Date().toISOString();

    const baseResponse = {
      simulated: true,
      environment: 'simulation',
      mrn,
      lrn,
      customsOffice,
      customsOfficeName: CUSTOMS_OFFICES[customsOffice]?.name || 'Desconocida',
      timestamp,
      declarationType: type
    };

    let result;

    switch (scenario) {
      case 'success':
        result = this._successResponse(baseResponse, type);
        break;

      case 'success_with_warnings':
        result = this._successWithWarningsResponse(baseResponse, type);
        break;

      case 'high_value_inspection':
        result = this._highValueInspectionResponse(baseResponse, type);
        break;

      case 'origin_review':
        result = this._originReviewResponse(baseResponse, type);
        break;

      case 'certificate_required':
        result = this._certificateRequiredResponse(baseResponse, type);
        break;

      case 'random_error':
        result = this._randomErrorResponse(baseResponse);
        break;

      default:
        result = this._successResponse(baseResponse, type);
    }

    // Agregar warnings de validacion si existen
    if (validationWarnings.length > 0) {
      result.validationWarnings = validationWarnings;
    }

    logger.info(`[SIMULATION] ${type} processed - MRN: ${mrn}, Channel: ${result.channel || 'N/A'}`);

    return result;
  }

  /**
   * Respuesta exitosa estandar
   */
  _successResponse(base, type) {
    const channel = this._assignChannel();

    return {
      ...base,
      success: true,
      status: 'accepted',
      channel: channel.code,
      channelLabel: channel.label,
      channelDescription: channel.description,
      acceptanceDate: new Date().toISOString(),
      estimatedRelease: this._calculateEstimatedRelease(channel),
      duties: type === 'H1' ? this._generateDuties() : null,
      exportInfo: type === 'AES' ? this._generateExportInfo() : null,
      aeatResponse: {
        code: '0000',
        ...RESPONSE_CODES['0000'],
        timestamp: base.timestamp
      },
      message: `[SIMULACION] Declaracion ${type} aceptada - ${channel.label}`,
      nextSteps: this._getNextSteps(channel.code, type)
    };
  }

  /**
   * Respuesta exitosa con advertencias
   */
  _successWithWarningsResponse(base, type) {
    const channel = this._assignChannel({ biasToward: 'orange', orangeProbability: 0.5 });

    return {
      ...base,
      success: true,
      status: 'accepted_warnings',
      channel: channel.code,
      channelLabel: channel.label,
      channelDescription: channel.description,
      acceptanceDate: new Date().toISOString(),
      estimatedRelease: this._calculateEstimatedRelease(channel),
      duties: type === 'H1' ? this._generateDuties() : null,
      warnings: [
        {
          code: '4000',
          message: 'Valor estadistico parece inferior al esperado para este tipo de mercancia',
          field: 'StatisticalValue'
        }
      ],
      aeatResponse: {
        code: '0002',
        ...RESPONSE_CODES['0002'],
        timestamp: base.timestamp
      },
      message: `[SIMULACION] Declaracion ${type} aceptada con observaciones - ${channel.label}`,
      nextSteps: this._getNextSteps(channel.code, type)
    };
  }

  /**
   * Inspeccion por alto valor
   */
  _highValueInspectionResponse(base, type) {
    return {
      ...base,
      success: true,
      status: 'accepted',
      channel: 'orange',
      channelLabel: INSPECTION_CHANNELS.orange.label,
      channelDescription: 'Revision documental por alto valor declarado',
      acceptanceDate: new Date().toISOString(),
      estimatedRelease: this._calculateEstimatedRelease(INSPECTION_CHANNELS.orange),
      duties: type === 'H1' ? this._generateDuties(true) : null,
      inspectionReason: 'Valor declarado superior al umbral de revision automatica (> 100.000 EUR)',
      documentRequest: [
        'Factura comercial original',
        'Justificante de pago/transferencia',
        'Contratos de compraventa'
      ],
      deadline: this._calculateDeadline(10),
      aeatResponse: {
        code: '0000',
        ...RESPONSE_CODES['0000'],
        timestamp: base.timestamp
      },
      message: `[SIMULACION] ${type} aceptada - Canal Naranja por alto valor declarado`,
      nextSteps: [
        'Preparar documentacion justificativa del valor',
        `Responder antes del ${this._calculateDeadline(10)}`,
        'Subir documentos al portal o enviar por GAUDI'
      ]
    };
  }

  /**
   * Revision por origen de riesgo
   */
  _originReviewResponse(base, type) {
    return {
      ...base,
      success: true,
      status: 'accepted',
      channel: 'orange',
      channelLabel: INSPECTION_CHANNELS.orange.label,
      channelDescription: 'Revision documental por pais de origen',
      acceptanceDate: new Date().toISOString(),
      estimatedRelease: this._calculateEstimatedRelease(INSPECTION_CHANNELS.orange),
      duties: type === 'H1' ? this._generateDuties() : null,
      inspectionReason: 'Pais de origen sujeto a control reforzado',
      documentRequest: [
        'Certificado de origen',
        'EUR.1 o declaracion en factura (si aplica preferencia)',
        'Documentacion de la cadena de custodia'
      ],
      deadline: this._calculateDeadline(10),
      aeatResponse: {
        code: '0000',
        ...RESPONSE_CODES['0000'],
        timestamp: base.timestamp
      },
      message: `[SIMULACION] ${type} aceptada - Revision documental de origen requerida`,
      nextSteps: [
        'Verificar certificados de origen disponibles',
        'Comprobar elegibilidad de preferencia arancelaria',
        `Presentar documentacion antes del ${this._calculateDeadline(10)}`
      ]
    };
  }

  /**
   * Certificados paraduaneros pendientes
   */
  _certificateRequiredResponse(base, type) {
    const pendingCerts = this._generatePendingCertificates();

    return {
      ...base,
      success: true,
      status: 'pending_documents',
      channel: 'yellow',
      channelLabel: INSPECTION_CHANNELS.yellow.label,
      channelDescription: 'Certificados paraduaneros pendientes de validacion',
      acceptanceDate: new Date().toISOString(),
      pendingCertificates: pendingCerts,
      controlAuthorities: [...new Set(pendingCerts.map(c => c.authority))],
      duties: type === 'H1' ? this._generateDuties() : null,
      aeatResponse: {
        code: '0001',
        ...RESPONSE_CODES['0001'],
        timestamp: base.timestamp
      },
      message: `[SIMULACION] ${type} pendiente - Se requieren certificados adicionales`,
      nextSteps: [
        'Contactar con autoridades competentes para certificados',
        'Subir certificados al portal cuando esten disponibles',
        'El sistema reevaluara automaticamente al recibir los documentos'
      ]
    };
  }

  /**
   * Error aleatorio simulado
   */
  _randomErrorResponse(base) {
    const errorCodes = ['2001', '2002', '2005', '2006', '2007'];
    const errorCode = errorCodes[Math.floor(Math.random() * errorCodes.length)];
    const errorInfo = RESPONSE_CODES[errorCode];

    const errorDetails = {
      '2001': { field: 'Importer.EORI', suggestion: 'Verificar que el EORI este activo en el registro VIES' },
      '2002': { field: 'Classification.ID', suggestion: 'Consultar el codigo TARIC correcto en la base de datos de la UE' },
      '2005': { field: 'ItemAmount', suggestion: 'Revisar que el valor declarado coincida con la factura comercial' },
      '2006': { field: 'RequestedRegime', suggestion: 'Verificar que el regimen solicitado sea compatible con la operacion' },
      '2007': { field: 'OriginCountry', suggestion: 'Usar codigo ISO de 2 letras valido' }
    };

    return {
      ...base,
      success: false,
      status: errorInfo.status,
      channel: null,
      errorDetails: errorDetails[errorCode] || {},
      aeatResponse: {
        code: errorCode,
        ...errorInfo,
        timestamp: base.timestamp
      },
      message: `[SIMULACION] Error: ${errorInfo.description}`,
      nextSteps: [
        'Corregir el error indicado',
        'Regenerar la declaracion',
        'Volver a enviar'
      ]
    };
  }

  /**
   * Generar respuesta de error de validacion
   */
  _generateErrorResponse(errors, xml) {
    const primaryError = errors[0];
    const lrn = this._extractValue(xml, 'LRN') || 'UNKNOWN';

    return {
      success: false,
      simulated: true,
      environment: 'simulation',
      lrn,
      status: 'validation_error',
      channel: null,
      errors,
      errorCount: errors.length,
      aeatResponse: {
        code: primaryError.code,
        ...RESPONSE_CODES[primaryError.code],
        timestamp: new Date().toISOString()
      },
      message: `[SIMULACION] Error de validacion: ${primaryError.message}`,
      nextSteps: [
        'Revisar los errores indicados',
        'Corregir los campos con problemas',
        'Regenerar el XML y volver a enviar'
      ]
    };
  }

  /**
   * Asignar canal basado en probabilidades
   */
  _assignChannel(options = {}) {
    const random = Math.random();

    // Si hay sesgo hacia naranja
    if (options.biasToward === 'orange') {
      const orangeProb = options.orangeProbability || 0.5;
      if (random < (1 - orangeProb - 0.05)) return INSPECTION_CHANNELS.green;
      if (random < (1 - 0.05)) return INSPECTION_CHANNELS.orange;
      return INSPECTION_CHANNELS.red;
    }

    // Distribucion normal
    if (random < INSPECTION_CHANNELS.green.probability) {
      return INSPECTION_CHANNELS.green;
    }
    if (random < INSPECTION_CHANNELS.green.probability + INSPECTION_CHANNELS.orange.probability) {
      return INSPECTION_CHANNELS.orange;
    }
    return INSPECTION_CHANNELS.red;
  }

  /**
   * Calcular fecha estimada de levante
   */
  _calculateEstimatedRelease(channel) {
    const now = new Date();
    const hoursToAdd = channel.processingTime.min +
      Math.random() * (channel.processingTime.max - channel.processingTime.min);
    return new Date(now.getTime() + hoursToAdd * 60 * 60 * 1000).toISOString();
  }

  /**
   * Calcular deadline en dias habiles
   */
  _calculateDeadline(days) {
    const date = new Date();
    let addedDays = 0;
    while (addedDays < days) {
      date.setDate(date.getDate() + 1);
      // Saltar fines de semana
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        addedDays++;
      }
    }
    return date.toISOString().split('T')[0];
  }

  /**
   * Generar derechos simulados
   */
  _generateDuties(highValue = false) {
    const baseAmount = highValue ? 15000 : 3000;
    const variance = highValue ? 10000 : 2000;

    const dutyAmount = Math.floor(Math.random() * variance) + (baseAmount * 0.3);
    const vatBase = Math.floor(Math.random() * variance) + baseAmount;
    const vatAmount = Math.floor(vatBase * 0.21);

    return {
      dutyAmount: Math.round(dutyAmount * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      totalAmount: Math.round((dutyAmount + vatAmount) * 100) / 100,
      currency: 'EUR',
      deferredPayment: Math.random() > 0.3,
      paymentDeadline: this._calculateDeadline(5),
      breakdown: {
        tariffDuty: Math.round(dutyAmount * 0.8 * 100) / 100,
        antiDumping: Math.round(dutyAmount * 0.2 * 100) / 100,
        vatRate: 21
      }
    };
  }

  /**
   * Generar info de exportacion
   */
  _generateExportInfo() {
    return {
      exportDate: new Date().toISOString(),
      exitOffice: 'ES002801',
      exitOfficeName: 'Barcelona - Puerto',
      estimatedExit: this._calculateEstimatedRelease({ processingTime: { min: 2, max: 8 } }),
      mrn_status: 'awaiting_exit'
    };
  }

  /**
   * Generar certificados pendientes aleatorios
   */
  _generatePendingCertificates() {
    const possibleCerts = [
      { code: 'C620', name: 'Certificado sanitario de importacion', authority: 'SOIVRE' },
      { code: 'C625', name: 'Certificado veterinario', authority: 'MAPA' },
      { code: 'C644', name: 'Certificado CITES', authority: 'MITERD' },
      { code: 'N002', name: 'Licencia de importacion', authority: 'MINECO' },
      { code: 'Y929', name: 'Documento de vigilancia', authority: 'MINECO' }
    ];

    // Seleccionar 1-2 certificados aleatorios
    const count = Math.random() > 0.5 ? 2 : 1;
    const shuffled = possibleCerts.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * Obtener siguientes pasos segun canal
   */
  _getNextSteps(channel, type) {
    const steps = {
      green: [
        'Levante autorizado - mercancia disponible para retirada',
        type === 'H1' ? 'Proceder al pago de derechos si no hay diferimiento' : 'Confirmar salida de mercancia',
        'Descargar documento de levante desde el portal'
      ],
      yellow: [
        'Esperar validacion de certificados por autoridades',
        'Subir certificados pendientes al portal',
        'El sistema notificara cuando se complete la validacion'
      ],
      orange: [
        'Preparar documentacion solicitada',
        'Responder al requerimiento antes del plazo',
        'Subir documentos al portal GAUDI o entregar en aduana'
      ],
      red: [
        'Mercancia retenida para inspeccion fisica',
        'Coordinar cita para inspeccion con la aduana',
        'Preparar mercancia para reconocimiento'
      ]
    };

    return steps[channel] || steps.green;
  }

  /**
   * Extraer valor de XML
   */
  _extractValue(xml, tag) {
    const patterns = [
      new RegExp(`<${tag}>([^<]+)</${tag}>`, 'i'),
      new RegExp(`<[a-z]+:${tag}>([^<]+)</[a-z]+:${tag}>`, 'i')
    ];

    for (const pattern of patterns) {
      const match = xml.match(pattern);
      if (match) return match[1].trim();
    }
    return null;
  }

  /**
   * Extraer valor numerico de XML
   */
  _extractNumericValue(xml, tag) {
    const value = this._extractValue(xml, tag);
    if (value) {
      const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
      return isNaN(num) ? null : num;
    }
    return null;
  }

  /**
   * Extraer todos los codigos TARIC
   */
  _extractAllTaricCodes(xml) {
    const patterns = [
      /<Classification>[\s\S]*?<ID>(\d+)<\/ID>/gi,
      /<ClassificationID>(\d+)<\/ClassificationID>/gi,
      /<TARIC>(\d+)<\/TARIC>/gi,
      /<TARICCode>(\d+)<\/TARICCode>/gi
    ];

    const codes = [];
    for (const pattern of patterns) {
      const matches = xml.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length >= 8) {
          codes.push(match[1]);
        }
      }
    }
    return [...new Set(codes)];
  }

  /**
   * Simular delay de red
   */
  async _simulateDelay() {
    const delay = this.delayMs + (Math.random() * 1000 - 500);
    return new Promise(resolve => setTimeout(resolve, Math.max(500, delay)));
  }

  /**
   * Simular consulta de estado
   */
  async simulateQueryStatus(mrn) {
    logger.info(`[SIMULATION] Querying status for MRN: ${mrn}`);

    await this._simulateDelay();

    if (!mrn || mrn.length < 10) {
      return {
        success: false,
        simulated: true,
        error: 'MRN invalido',
        message: '[SIMULACION] MRN no tiene formato valido'
      };
    }

    // Simular diferentes estados basados en hash del MRN
    const hash = mrn.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const states = [
      { status: 'accepted', channel: 'green', description: 'Aceptada - Levante autorizado' },
      { status: 'processing', channel: 'orange', description: 'En revision documental' },
      { status: 'released', channel: 'green', description: 'Levante completado' },
      { status: 'held', channel: 'red', description: 'Retenida para inspeccion' },
      { status: 'pending_documents', channel: 'yellow', description: 'Pendiente certificados' }
    ];
    const state = states[hash % states.length];

    return {
      success: true,
      simulated: true,
      mrn,
      status: state.status,
      statusDescription: state.description,
      channel: state.channel,
      channelLabel: INSPECTION_CHANNELS[state.channel]?.label,
      lastUpdate: new Date().toISOString(),
      history: [
        { date: new Date(Date.now() - 86400000).toISOString(), action: 'Declaracion presentada' },
        { date: new Date(Date.now() - 43200000).toISOString(), action: 'Validacion completada' },
        { date: new Date().toISOString(), action: state.description }
      ],
      message: `[SIMULACION] Estado actual: ${state.description}`
    };
  }

  /**
   * Simular anulacion de declaracion
   */
  async simulateCancelDeclaration(mrn, reason) {
    logger.info(`[SIMULATION] Cancelling declaration: ${mrn}`);

    await this._simulateDelay();

    // 90% exito, 10% rechazo
    const success = Math.random() > 0.1;

    if (success) {
      return {
        success: true,
        simulated: true,
        mrn,
        status: 'cancelled',
        cancellationDate: new Date().toISOString(),
        reason,
        message: '[SIMULACION] Declaracion anulada correctamente',
        nextSteps: [
          'La declaracion ha sido anulada',
          'Puede presentar una nueva declaracion si es necesario'
        ]
      };
    } else {
      return {
        success: false,
        simulated: true,
        mrn,
        status: 'cancellation_rejected',
        reason: 'Declaracion ya tiene levante autorizado - no se puede anular',
        message: '[SIMULACION] No se puede anular la declaracion',
        nextSteps: [
          'Contactar con la aduana para solicitar revision',
          'Considerar presentar declaracion complementaria'
        ]
      };
    }
  }
}

module.exports = SimulationEngine;
