/**
 * PUE Service - Punto Unico de Entrada
 * Servicio para gestion de controles PUE (ROHS, COM, ECO, CAL)
 *
 * Endpoint AEAT: https://www7.aeat.es/wlpl/AD44-JDIT/EnvioMensajePUE
 */

const { PUERequest } = require('../models');
const logger = require('../config/logger');
const crypto = require('crypto');

// Configuracion PUE
const PUE_CONFIG = {
  // Endpoint AEAT para envio de mensajes PUE
  aeatEndpoint: 'https://www7.aeat.es/wlpl/AD44-JDIT/EnvioMensajePUE',

  // Tipos de PUE
  types: {
    ROHS: {
      code: 'ROHS',
      name: 'ROHS/RAEE',
      fullName: 'Restriccion de sustancias peligrosas en aparatos electricos y electronicos',
      authority: 'SOIVRE',
      regulation: 'RD 110/2015',
      subtypes: ['ROHS_AEE', 'ROHS_RAEE', 'ROHS_PILAS'],
      deadlineDays: 5,
      inspectionRate: 0.1 // 10% inspeccion fisica
    },
    COM: {
      code: 'COM',
      name: 'Seguridad de Productos',
      fullName: 'Control de seguridad de productos industriales',
      authority: 'SOIVRE',
      regulation: 'RD 1801/2003',
      subtypes: ['COM_JUGUETES', 'COM_EPI', 'COM_MATERIAL_ELECTRICO', 'COM_MAQUINARIA', 'COM_EXPLOSIVOS', 'COM_GAS'],
      deadlineDays: 7,
      inspectionRate: 0.15
    },
    ECO: {
      code: 'ECO',
      name: 'Productos Ecologicos',
      fullName: 'Control de productos ecologicos',
      authority: 'SOIVRE',
      regulation: 'Reglamento (UE) 2018/848',
      subtypes: ['ECO_ALIMENTOS', 'ECO_VINOS', 'ECO_TEXTIL', 'ECO_COSMETICOS'],
      deadlineDays: 5,
      inspectionRate: 0.05
    },
    CAL: {
      code: 'CAL',
      name: 'Calidad Comercial',
      fullName: 'Control de calidad comercial',
      authority: 'SOIVRE',
      regulation: 'Ley 21/1992',
      subtypes: ['CAL_TEXTIL', 'CAL_CALZADO', 'CAL_CERAMICA', 'CAL_VIDRIO', 'CAL_MUEBLES'],
      deadlineDays: 10,
      inspectionRate: 0.08
    }
  },

  // Oficinas SOIVRE por provincia
  soivreOffices: {
    '01': { code: 'SOIVRE-01', name: 'SOIVRE Alava', province: 'Alava' },
    '02': { code: 'SOIVRE-02', name: 'SOIVRE Albacete', province: 'Albacete' },
    '03': { code: 'SOIVRE-03', name: 'SOIVRE Alicante', province: 'Alicante' },
    '04': { code: 'SOIVRE-04', name: 'SOIVRE Almeria', province: 'Almeria' },
    '08': { code: 'SOIVRE-08', name: 'SOIVRE Barcelona', province: 'Barcelona' },
    '09': { code: 'SOIVRE-09', name: 'SOIVRE Burgos', province: 'Burgos' },
    '11': { code: 'SOIVRE-11', name: 'SOIVRE Cadiz', province: 'Cadiz' },
    '15': { code: 'SOIVRE-15', name: 'SOIVRE A Coruna', province: 'A Coruna' },
    '17': { code: 'SOIVRE-17', name: 'SOIVRE Girona', province: 'Girona' },
    '20': { code: 'SOIVRE-20', name: 'SOIVRE Guipuzcoa', province: 'Guipuzcoa' },
    '21': { code: 'SOIVRE-21', name: 'SOIVRE Huelva', province: 'Huelva' },
    '28': { code: 'SOIVRE-28', name: 'SOIVRE Madrid', province: 'Madrid' },
    '29': { code: 'SOIVRE-29', name: 'SOIVRE Malaga', province: 'Malaga' },
    '30': { code: 'SOIVRE-30', name: 'SOIVRE Murcia', province: 'Murcia' },
    '31': { code: 'SOIVRE-31', name: 'SOIVRE Navarra', province: 'Navarra' },
    '33': { code: 'SOIVRE-33', name: 'SOIVRE Asturias', province: 'Asturias' },
    '35': { code: 'SOIVRE-35', name: 'SOIVRE Las Palmas', province: 'Las Palmas' },
    '36': { code: 'SOIVRE-36', name: 'SOIVRE Pontevedra', province: 'Pontevedra' },
    '38': { code: 'SOIVRE-38', name: 'SOIVRE S.C. Tenerife', province: 'S.C. Tenerife' },
    '39': { code: 'SOIVRE-39', name: 'SOIVRE Cantabria', province: 'Cantabria' },
    '41': { code: 'SOIVRE-41', name: 'SOIVRE Sevilla', province: 'Sevilla' },
    '43': { code: 'SOIVRE-43', name: 'SOIVRE Tarragona', province: 'Tarragona' },
    '46': { code: 'SOIVRE-46', name: 'SOIVRE Valencia', province: 'Valencia' },
    '48': { code: 'SOIVRE-48', name: 'SOIVRE Bizkaia', province: 'Bizkaia' },
    '50': { code: 'SOIVRE-50', name: 'SOIVRE Zaragoza', province: 'Zaragoza' }
  },

  // Codigos TARIC que requieren control PUE por tipo
  taricCodes: {
    ROHS: [
      // Capitulo 84 - Maquinas y aparatos mecanicos
      '8415', '8418', '8421', '8422', '8443', '8450', '8451', '8467', '8470', '8471', '8472', '8476',
      // Capitulo 85 - Maquinas y aparatos electricos
      '8501', '8504', '8508', '8509', '8510', '8513', '8516', '8517', '8518', '8519', '8521', '8523',
      '8525', '8526', '8527', '8528', '8531', '8539', '8541', '8543',
      // Capitulo 90 - Instrumentos
      '9001', '9002', '9005', '9006', '9007', '9008', '9010', '9011', '9012', '9013', '9015', '9018',
      '9019', '9022', '9027', '9028', '9030', '9031', '9032',
      // Capitulo 91 - Relojeria
      '9101', '9102', '9103', '9104', '9105', '9107', '9108', '9109', '9110', '9111', '9112', '9113',
      // Capitulo 95 - Juguetes
      '9504'
    ],
    COM: [
      // Juguetes
      '9503',
      // EPI - Equipos de proteccion individual
      '3926', '4015', '4203', '6210', '6211', '6216', '6307', '6506', '9004',
      // Material electrico baja tension
      '8536', '8537', '8544',
      // Maquinaria
      '8425', '8426', '8427', '8428', '8429', '8430', '8432', '8433', '8434', '8465',
      // Aparatos de gas
      '7321', '8419',
      // Explosivos civiles
      '3601', '3602', '3603', '3604'
    ],
    ECO: [
      // Productos agricolas ecologicos
      '07', '08', '09', '10', '11', '12',
      // Vinos ecologicos
      '2204', '2205',
      // Aceites ecologicos
      '1509', '1510',
      // Textil ecologico
      '50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63',
      // Cosmeticos ecologicos
      '3303', '3304', '3305', '3306', '3307'
    ],
    CAL: [
      // Textil
      '50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63',
      // Calzado
      '64',
      // Ceramica
      '69',
      // Vidrio
      '70',
      // Muebles
      '94'
    ]
  },

  // Documentos requeridos por tipo
  requiredDocuments: {
    ROHS: [
      { code: 'DOC_CONFORMIDAD_UE', name: 'Declaracion UE de conformidad', required: true },
      { code: 'CERT_ROHS', name: 'Certificado de conformidad RoHS', required: true },
      { code: 'INFORME_ENSAYO', name: 'Informe de ensayo laboratorio acreditado', required: false },
      { code: 'DOC_TECNICA', name: 'Documentacion tecnica', required: false },
      { code: 'FACTURA', name: 'Factura comercial', required: true },
      { code: 'PACKING_LIST', name: 'Lista de empaque', required: true }
    ],
    COM: [
      { code: 'DOC_CONFORMIDAD_UE', name: 'Declaracion UE de conformidad', required: true },
      { code: 'MARCADO_CE', name: 'Certificado marcado CE', required: true },
      { code: 'INFORME_ENSAYO', name: 'Informe de ensayo', required: true },
      { code: 'DOC_TECNICA', name: 'Documentacion tecnica', required: false },
      { code: 'MANUAL_INSTRUCCIONES', name: 'Manual de instrucciones ES', required: true },
      { code: 'FACTURA', name: 'Factura comercial', required: true },
      { code: 'PACKING_LIST', name: 'Lista de empaque', required: true }
    ],
    ECO: [
      { code: 'CERT_ORGANICO', name: 'Certificado de produccion ecologica', required: true },
      { code: 'CERT_IMPORTACION', name: 'Certificado de inspeccion importacion', required: true },
      { code: 'CERT_OPERADOR', name: 'Certificado de operador', required: true },
      { code: 'TRAZABILIDAD', name: 'Documentacion trazabilidad', required: true },
      { code: 'FACTURA', name: 'Factura comercial', required: true },
      { code: 'PACKING_LIST', name: 'Lista de empaque', required: true }
    ],
    CAL: [
      { code: 'ETIQUETADO', name: 'Muestras de etiquetado', required: true },
      { code: 'COMPOSICION', name: 'Certificado de composicion', required: true },
      { code: 'INSTRUCCIONES_CONSERVACION', name: 'Instrucciones de conservacion', required: false },
      { code: 'FACTURA', name: 'Factura comercial', required: true },
      { code: 'PACKING_LIST', name: 'Lista de empaque', required: true }
    ]
  },

  // Tasas aplicables (en EUR)
  fees: {
    ROHS: { inspection: 45.00, laboratory: 150.00, certificate: 30.00 },
    COM: { inspection: 60.00, laboratory: 200.00, certificate: 35.00 },
    ECO: { inspection: 40.00, laboratory: 100.00, certificate: 25.00 },
    CAL: { inspection: 35.00, laboratory: 80.00, certificate: 20.00 }
  }
};

class PUEService {
  constructor() {
    this.config = PUE_CONFIG;
    this.simulationMode = process.env.PUE_ENVIRONMENT !== 'production';
  }

  /**
   * Crear nueva solicitud PUE
   */
  async createRequest(data, userId) {
    try {
      // Pre-validar datos
      const preValidation = await this.preValidate(data);
      if (!preValidation.valid) {
        return {
          success: false,
          errors: preValidation.errors
        };
      }

      // Determinar documentos requeridos
      const requiredDocs = this.config.requiredDocuments[data.pueType] || [];

      // Calcular deadline
      const typeConfig = this.config.types[data.pueType];
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + (typeConfig?.deadlineDays || 10));

      // Preparar datos de tasas
      const fees = [];
      const feeConfig = this.config.fees[data.pueType];
      if (feeConfig) {
        fees.push({ concept: 'Tasa de inspeccion', amount: feeConfig.inspection, status: 'pending' });
        if (data.requiresLabAnalysis) {
          fees.push({ concept: 'Analisis de laboratorio', amount: feeConfig.laboratory, status: 'pending' });
        }
        fees.push({ concept: 'Emision de certificado', amount: feeConfig.certificate, status: 'pending' });
      }

      const pueRequest = new PUERequest({
        ...data,
        createdBy: userId,
        status: 'draft',
        deadline,
        requiredDocuments: requiredDocs.map(doc => ({
          code: doc.code,
          name: doc.name,
          required: doc.required,
          provided: false
        })),
        fees,
        statusHistory: [{
          status: 'draft',
          timestamp: new Date(),
          user: userId
        }]
      });

      await pueRequest.save();

      logger.info(`PUE: Solicitud creada ${pueRequest.reference} tipo ${data.pueType}`);

      return {
        success: true,
        data: pueRequest
      };
    } catch (error) {
      logger.error('PUE: Error creando solicitud:', error);
      throw error;
    }
  }

  /**
   * Pre-validacion temprana
   */
  async preValidate(data) {
    const errors = [];
    const warnings = [];

    // Validar tipo PUE
    if (!data.pueType || !this.config.types[data.pueType]) {
      errors.push({
        field: 'pueType',
        code: 'PUE_INVALID_TYPE',
        message: `Tipo PUE no valido. Valores permitidos: ${Object.keys(this.config.types).join(', ')}`
      });
    }

    // Validar operador
    if (!data.operator?.name) {
      errors.push({
        field: 'operator.name',
        code: 'PUE_OPERATOR_NAME_REQUIRED',
        message: 'Nombre del operador es obligatorio'
      });
    }

    // Validar mercancias
    if (!data.goods || data.goods.length === 0) {
      errors.push({
        field: 'goods',
        code: 'PUE_GOODS_REQUIRED',
        message: 'Debe incluir al menos una mercancia'
      });
    }

    // Validar TARIC codes
    if (data.goods && data.pueType) {
      const validTarics = this.config.taricCodes[data.pueType] || [];
      for (const [idx, item] of data.goods.entries()) {
        if (item.taricCode) {
          const prefix4 = item.taricCode.substring(0, 4);
          const prefix2 = item.taricCode.substring(0, 2);
          const isValid = validTarics.some(t => item.taricCode.startsWith(t) || prefix4.startsWith(t) || prefix2 === t);
          if (!isValid) {
            warnings.push({
              field: `goods[${idx}].taricCode`,
              code: 'PUE_TARIC_NOT_TYPICAL',
              message: `Codigo TARIC ${item.taricCode} no es tipico para control ${data.pueType}`
            });
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validacion completa para envio
   */
  async validateRequest(requestId) {
    try {
      const request = await PUERequest.findById(requestId);
      if (!request) {
        return {
          valid: false,
          errors: [{ code: 'PUE_NOT_FOUND', message: 'Solicitud no encontrada' }]
        };
      }

      const validation = request.validateForSubmission();

      // Validar documentos requeridos
      const missingDocs = request.requiredDocuments.filter(d => d.required && !d.provided);
      if (missingDocs.length > 0) {
        for (const doc of missingDocs) {
          validation.errors.push({
            field: 'requiredDocuments',
            code: 'PUE_DOC_MISSING',
            message: `Documento requerido no aportado: ${doc.name}`
          });
        }
        validation.valid = false;
      }

      if (validation.valid) {
        request.status = 'validated';
        request.statusHistory.push({
          status: 'validated',
          timestamp: new Date()
        });
        await request.save();
      }

      return validation;
    } catch (error) {
      logger.error('PUE: Error validando solicitud:', error);
      throw error;
    }
  }

  /**
   * Enviar solicitud a AEAT
   */
  async submitToAEAT(requestId, userId, certAlias) {
    try {
      const request = await PUERequest.findById(requestId);
      if (!request) {
        throw new Error('Solicitud no encontrada');
      }

      if (!['draft', 'validated'].includes(request.status)) {
        throw new Error(`No se puede enviar solicitud en estado ${request.status}`);
      }

      // Validar antes de enviar
      const validation = request.validateForSubmission();
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      // Generar XML
      const pueGenerator = require('./forms/pueGenerator');
      const xml = pueGenerator.generate(request);
      request.generatedXML = xml;

      logger.info(`PUE: Enviando solicitud ${request.reference} a AEAT`);

      if (this.simulationMode) {
        // Simular respuesta AEAT
        const response = this._simulateAEATSubmission(request);

        request.pueReference = response.pueReference;
        request.status = response.status;
        request.submittedAt = new Date();
        request.aeatResponse = {
          code: response.code,
          message: response.message,
          timestamp: new Date(),
          correlationId: response.correlationId
        };
        request.statusHistory.push({
          status: response.status,
          timestamp: new Date(),
          user: userId,
          aeatCode: response.code
        });

        await request.save();

        return {
          success: true,
          data: {
            reference: request.reference,
            pueReference: request.pueReference,
            status: request.status,
            aeatResponse: request.aeatResponse
          }
        };
      }

      // Produccion: llamar servicio AEAT real
      // TODO: Implementar llamada real a AEAT
      throw new Error('Integracion AEAT produccion pendiente de implementacion');

    } catch (error) {
      logger.error('PUE: Error enviando a AEAT:', error);
      throw error;
    }
  }

  /**
   * Consultar estado en AEAT
   */
  async queryStatus(pueReference) {
    try {
      const request = await PUERequest.findOne({ pueReference });
      if (!request) {
        throw new Error('Solicitud no encontrada');
      }

      if (this.simulationMode) {
        return this._simulateStatusQuery(request);
      }

      // Produccion: consultar AEAT real
      throw new Error('Integracion AEAT produccion pendiente de implementacion');

    } catch (error) {
      logger.error('PUE: Error consultando estado:', error);
      throw error;
    }
  }

  /**
   * Procesar respuesta SOIVRE
   */
  async processSoivreResponse(reference, responseData) {
    try {
      const request = await PUERequest.findOne({
        $or: [{ reference }, { pueReference: reference }]
      });

      if (!request) {
        throw new Error('Solicitud no encontrada');
      }

      request.soivreResponse = {
        code: responseData.code,
        message: responseData.message,
        timestamp: new Date(),
        errors: responseData.errors || [],
        warnings: responseData.warnings || []
      };

      if (responseData.expedientNumber) {
        request.expedientNumber = responseData.expedientNumber;
      }

      // Actualizar estado segun respuesta
      if (responseData.status) {
        request.status = responseData.status;
        request.statusHistory.push({
          status: responseData.status,
          timestamp: new Date(),
          soivreCode: responseData.code,
          reason: responseData.message
        });
      }

      await request.save();

      return {
        success: true,
        data: request
      };
    } catch (error) {
      logger.error('PUE: Error procesando respuesta SOIVRE:', error);
      throw error;
    }
  }

  /**
   * Agregar documento a solicitud
   */
  async addDocument(requestId, documentData, userId) {
    try {
      const request = await PUERequest.findById(requestId);
      if (!request) {
        throw new Error('Solicitud no encontrada');
      }

      request.addDocument(documentData, userId);

      // Si es un documento requerido, marcarlo como provisto
      if (documentData.code) {
        request.markDocumentProvided(documentData.code, documentData.documentId, documentData.url);
      }

      await request.save();

      logger.info(`PUE: Documento agregado a ${request.reference}`);

      return {
        success: true,
        data: request
      };
    } catch (error) {
      logger.error('PUE: Error agregando documento:', error);
      throw error;
    }
  }

  /**
   * Programar inspeccion
   */
  async scheduleInspection(requestId, inspectionData, userId) {
    try {
      const request = await PUERequest.findById(requestId);
      if (!request) {
        throw new Error('Solicitud no encontrada');
      }

      request.inspection = {
        scheduled: true,
        scheduledDate: inspectionData.date,
        scheduledTime: inspectionData.time,
        location: inspectionData.location,
        type: inspectionData.type,
        inspector: inspectionData.inspector,
        result: 'pending'
      };

      request.status = 'inspection_scheduled';
      request.statusHistory.push({
        status: 'inspection_scheduled',
        timestamp: new Date(),
        user: userId,
        reason: `Inspeccion programada para ${inspectionData.date}`
      });

      await request.save();

      logger.info(`PUE: Inspeccion programada para ${request.reference}`);

      return {
        success: true,
        data: request
      };
    } catch (error) {
      logger.error('PUE: Error programando inspeccion:', error);
      throw error;
    }
  }

  /**
   * Registrar resultado de inspeccion
   */
  async recordInspectionResult(requestId, resultData, userId) {
    try {
      const request = await PUERequest.findById(requestId);
      if (!request) {
        throw new Error('Solicitud no encontrada');
      }

      request.recordInspectionResult(
        resultData.result,
        resultData.notes,
        resultData.findings || []
      );

      if (resultData.laboratoryAnalysis) {
        request.inspection.laboratoryAnalysis = resultData.laboratoryAnalysis;
        if (resultData.laboratoryAnalysis.required && !resultData.laboratoryAnalysis.analysisResult) {
          request.status = 'pending_lab';
        }
      }

      if (resultData.reportNumber) {
        request.inspection.reportNumber = resultData.reportNumber;
        request.inspection.reportDate = new Date();
      }

      request.statusHistory.push({
        status: request.status,
        timestamp: new Date(),
        user: userId,
        reason: `Resultado inspeccion: ${resultData.result}`
      });

      await request.save();

      logger.info(`PUE: Resultado inspeccion registrado para ${request.reference}: ${resultData.result}`);

      return {
        success: true,
        data: request
      };
    } catch (error) {
      logger.error('PUE: Error registrando resultado inspeccion:', error);
      throw error;
    }
  }

  /**
   * Emitir certificado
   */
  async issueCertificate(requestId, certificateData, userId) {
    try {
      const request = await PUERequest.findById(requestId);
      if (!request) {
        throw new Error('Solicitud no encontrada');
      }

      if (!['approved', 'approved_conditions'].includes(request.status)) {
        throw new Error('Solo se puede emitir certificado para solicitudes aprobadas');
      }

      const certificateNumber = `CERT-${request.pueType}-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      request.issuedCertificate = {
        type: certificateData.type || 'CERTIFICATE_CONFORMITY',
        number: certificateNumber,
        issuedAt: new Date(),
        validUntil: certificateData.validUntil || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        issuedBy: {
          authority: 'SOIVRE',
          office: request.soivreOffice?.name,
          officer: certificateData.officer
        },
        documentUrl: certificateData.documentUrl,
        status: 'active'
      };

      // Actualizar tasa de certificado como pagada
      const certFee = request.fees.find(f => f.concept.includes('certificado'));
      if (certFee) {
        certFee.status = 'paid';
        certFee.paidAt = new Date();
      }

      request.statusHistory.push({
        status: request.status,
        timestamp: new Date(),
        user: userId,
        reason: `Certificado emitido: ${certificateNumber}`
      });

      await request.save();

      logger.info(`PUE: Certificado emitido para ${request.reference}: ${certificateNumber}`);

      return {
        success: true,
        data: {
          certificate: request.issuedCertificate,
          request
        }
      };
    } catch (error) {
      logger.error('PUE: Error emitiendo certificado:', error);
      throw error;
    }
  }

  /**
   * Cancelar solicitud
   */
  async cancelRequest(requestId, reason, userId) {
    try {
      const request = await PUERequest.findById(requestId);
      if (!request) {
        throw new Error('Solicitud no encontrada');
      }

      const nonCancellableStates = ['approved', 'approved_conditions', 'cancelled', 'expired'];
      if (nonCancellableStates.includes(request.status)) {
        throw new Error(`No se puede cancelar solicitud en estado ${request.status}`);
      }

      request.status = 'cancelled';
      request.statusHistory.push({
        status: 'cancelled',
        timestamp: new Date(),
        user: userId,
        reason
      });

      await request.save();

      logger.info(`PUE: Solicitud cancelada ${request.reference}`);

      return {
        success: true,
        data: request
      };
    } catch (error) {
      logger.error('PUE: Error cancelando solicitud:', error);
      throw error;
    }
  }

  /**
   * Determinar controles PUE requeridos para mercancias
   */
  getRequiredPUE(goods) {
    const required = [];

    for (const item of goods) {
      const taric = item.taricCode || '';

      for (const [pueType, codes] of Object.entries(this.config.taricCodes)) {
        const matches = codes.some(code => taric.startsWith(code));
        if (matches && !required.find(r => r.type === pueType)) {
          const typeConfig = this.config.types[pueType];
          required.push({
            type: pueType,
            name: typeConfig.name,
            authority: typeConfig.authority,
            regulation: typeConfig.regulation,
            reason: `Codigo TARIC ${taric} requiere control ${pueType}`,
            taricCodes: [taric]
          });
        } else if (matches) {
          const existing = required.find(r => r.type === pueType);
          if (!existing.taricCodes.includes(taric)) {
            existing.taricCodes.push(taric);
          }
        }
      }
    }

    return {
      required,
      count: required.length,
      types: required.map(r => r.type)
    };
  }

  /**
   * Procesamiento masivo de solicitudes
   */
  async processBatch(requests, userId, options = {}) {
    const results = {
      total: requests.length,
      created: 0,
      submitted: 0,
      failed: 0,
      errors: []
    };

    for (const requestData of requests) {
      try {
        const createResult = await this.createRequest(requestData, userId);
        if (createResult.success) {
          results.created++;

          if (options.autoSubmit) {
            try {
              const submitResult = await this.submitToAEAT(
                createResult.data._id,
                userId,
                options.certificateAlias
              );
              if (submitResult.success) {
                results.submitted++;
              }
            } catch (submitError) {
              results.errors.push({
                reference: createResult.data.reference,
                error: submitError.message,
                phase: 'submit'
              });
            }
          }
        } else {
          results.failed++;
          results.errors.push({
            data: requestData,
            errors: createResult.errors,
            phase: 'create'
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          data: requestData,
          error: error.message,
          phase: 'create'
        });
      }
    }

    logger.info(`PUE: Procesamiento masivo completado - ${results.created} creadas, ${results.submitted} enviadas, ${results.failed} fallidas`);

    return results;
  }

  /**
   * Obtener estadisticas
   */
  async getStats(filters = {}) {
    return PUERequest.getStats(filters);
  }

  /**
   * Listar solicitudes
   */
  async list(filters = {}) {
    const query = {};

    if (filters.pueType) query.pueType = filters.pueType;
    if (filters.status) query.status = filters.status;
    if (filters.createdBy) query.createdBy = filters.createdBy;

    if (filters.search) {
      query.$or = [
        { reference: { $regex: filters.search, $options: 'i' } },
        { pueReference: { $regex: filters.search, $options: 'i' } },
        { 'operator.name': { $regex: filters.search, $options: 'i' } },
        { 'operator.eori': { $regex: filters.search, $options: 'i' } },
        { 'goods.taricCode': { $regex: filters.search, $options: 'i' } }
      ];
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      PUERequest.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email'),
      PUERequest.countDocuments(query)
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Obtener solicitud por ID
   */
  async getById(id) {
    return PUERequest.findById(id)
      .populate('createdBy', 'name email')
      .populate('expedition');
  }

  /**
   * Actualizar solicitud
   */
  async update(id, updateData, userId) {
    const request = await PUERequest.findById(id);
    if (!request) {
      throw new Error('Solicitud no encontrada');
    }

    if (!['draft', 'pending_documents'].includes(request.status)) {
      throw new Error(`No se puede modificar solicitud en estado ${request.status}`);
    }

    // Actualizar campos permitidos
    const allowedFields = [
      'operator', 'importer', 'manufacturer', 'representative', 'consignee',
      'goods', 'transport', 'customsOffice', 'soivreOffice', 'pueSubtype',
      'priority', 'declarationMRN', 'ensReference'
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        request[field] = updateData[field];
      }
    }

    await request.save();

    return {
      success: true,
      data: request
    };
  }

  /**
   * Obtener tipos de PUE
   */
  getTypes() {
    return Object.entries(this.config.types).map(([code, config]) => ({
      code,
      ...config
    }));
  }

  /**
   * Obtener oficinas SOIVRE
   */
  getSoivreOffices(province = null) {
    const offices = Object.values(this.config.soivreOffices);
    if (province) {
      return offices.filter(o =>
        o.province.toLowerCase().includes(province.toLowerCase())
      );
    }
    return offices;
  }

  /**
   * Obtener documentos requeridos por tipo
   */
  getRequiredDocuments(pueType) {
    return this.config.requiredDocuments[pueType] || [];
  }

  /**
   * Verificar codigos TARIC
   */
  checkTaricCodes(taricCodes) {
    const results = [];

    for (const taric of taricCodes) {
      const requiredControls = [];

      for (const [pueType, codes] of Object.entries(this.config.taricCodes)) {
        if (codes.some(code => taric.startsWith(code))) {
          requiredControls.push({
            type: pueType,
            name: this.config.types[pueType].name
          });
        }
      }

      results.push({
        taricCode: taric,
        requiresPUE: requiredControls.length > 0,
        controls: requiredControls
      });
    }

    return results;
  }

  /**
   * Obtener informacion del servicio
   */
  getInfo() {
    return {
      service: 'PUE Service',
      version: '1.0.0',
      simulationMode: this.simulationMode,
      endpoint: this.config.aeatEndpoint,
      types: Object.keys(this.config.types),
      offices: Object.keys(this.config.soivreOffices).length,
      description: 'Servicio de gestion de controles PUE (ROHS, COM, ECO, CAL)'
    };
  }

  // ============================================
  // METODOS PRIVADOS - SIMULACION
  // ============================================

  _simulateAEATSubmission(request) {
    const pueReference = `PUE${new Date().getFullYear()}${request.pueType}${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const needsInspection = Math.random() < (this.config.types[request.pueType]?.inspectionRate || 0.1);

    return {
      success: true,
      pueReference,
      code: needsInspection ? 'PUE_INSPECTION_REQUIRED' : 'PUE_ACCEPTED',
      message: needsInspection
        ? 'Solicitud admitida - Requiere inspeccion fisica'
        : 'Solicitud admitida a tramite',
      status: needsInspection ? 'pending_inspection' : 'registered',
      correlationId: crypto.randomUUID()
    };
  }

  _simulateStatusQuery(request) {
    const statuses = ['registered', 'pending_documents', 'pending_inspection', 'in_inspection', 'approved'];
    const currentIdx = statuses.indexOf(request.status);
    const nextIdx = Math.min(currentIdx + 1, statuses.length - 1);

    return {
      success: true,
      reference: request.reference,
      pueReference: request.pueReference,
      currentStatus: request.status,
      nextStatus: statuses[nextIdx],
      lastUpdate: new Date().toISOString(),
      estimatedCompletion: request.deadline
    };
  }
}

module.exports = new PUEService();
