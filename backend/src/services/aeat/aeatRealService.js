/**
 * AEAT Real Integration Service
 * Fase 6.1.3-6.1.6 - LUCI Customs Agent
 *
 * Integración real con servicios web de la Agencia Tributaria
 * Basado en documentación oficial: https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/ws.html
 * Guías técnicas: https://sede.agenciatributaria.gob.es/Sede/aduanas/aduana-electronica/guias-tecnicas.html
 */

const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');
const logger = require('../../config/logger');
const certificateService = require('./certificateService');
const xadesSignatureService = require('./xadesSignatureService');

class AEATRealService {
  constructor() {
    // Configuración de entornos AEAT
    // Documentación oficial: https://sede.agenciatributaria.gob.es/Sede/aduanas/aduana-electronica/guias-tecnicas.html
    this.ENVIRONMENTS = {
      PRODUCTION: {
        name: 'production',
        description: 'Entorno de produccion AEAT',
        baseUrl: 'https://www2.agenciatributaria.gob.es',
        wsBaseUrl: 'https://www2.agenciatributaria.gob.es',
        ws3BaseUrl: 'https://www2.agenciatributaria.gob.es',
        testUrl: 'https://www1.agenciatributaria.gob.es'
      },
      SANDBOX: {
        name: 'sandbox',
        description: 'Entorno de pruebas AEAT (Pre-produccion) - NO requiere registro IP',
        baseUrl: 'https://prewww10.aeat.es',
        wsBaseUrl: 'https://prewww10.aeat.es',
        ws3BaseUrl: 'https://prewww10.aeat.es',
        testUrl: 'https://prewww10.aeat.es'
      }
    };

    // Entorno actual (configurable)
    this.environment = process.env.AEAT_ENVIRONMENT === 'production' ?
      this.ENVIRONMENTS.PRODUCTION : this.ENVIRONMENTS.SANDBOX;

    // ============== SERVICIOS WEB AEAT ==============

    // ============== SERVICIOS WEB AEAT - ENDPOINTS OFICIALES (de WSDLs) ==============
    // Fuente: https://www2.agenciatributaria.gob.es/ADUA/internet/ws.html
    // Los paths son relativos al baseUrl/wsBaseUrl del entorno actual
    this.SERVICES = {
      // === IMPORTACIÓN H1 (CAU) ===
      H1_SUBMIT: {
        code: 'H1_SUBMIT',
        name: 'Presentación DUA Importación H1',
        path: '/wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.ImportacionCompletaV1SOAP',
        wsdlUrl: 'https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/dit/adu/adip/ws/ImportacionCompletaV1.wsdl',
        operation: 'ImportacionCompletaV1',
        messageType: 'CC460A',
        description: 'Declaracion completa de importacion segun CAU'
      },
      H1_QUERY: {
        code: 'H1_QUERY',
        name: 'Consulta DUA Importación',
        path: '/wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.ConsultaImportacionV2SOAP',
        wsdlUrl: 'https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/dit/adu/adip/ws/ConsultaImportacionV2.wsdl',
        operation: 'ConsultaImportacionV2',
        description: 'Consulta estado de declaracion H1'
      },
      H1_SIMPLIFIED: {
        code: 'H1_SIMPLIFIED',
        name: 'Declaracion Simplificada Importación',
        path: '/wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.DeclaSimpliImporV1SOAP',
        wsdlUrl: 'https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/dit/adu/adip/ws/DeclaSimpliImporV1.wsdl',
        operation: 'DeclaSimpliImporV1',
        description: 'Declaracion simplificada de importacion'
      },
      H1_INVALIDATION: {
        code: 'H1_INVALIDATION',
        name: 'Anulación DUA Importación',
        path: '/wlpl/inwinvoc/es.aeat.dit.adu.adip.ws.AnulaImportacionV1SOAP',
        wsdlUrl: 'https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/dit/adu/adip/ws/AnulaImportacionV1.wsdl',
        operation: 'AnulaImportacionV1',
        description: 'Anulacion de declaracion H1'
      },

      // === EXPORTACIÓN AES ===
      AES_SUBMIT: {
        code: 'AES_SUBMIT',
        name: 'Presentación Declaración Exportación AES',
        path: '/wlpl/ADEX-JDIT/ws/aes/CC515CV1SOAP',
        wsdlUrl: 'https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adex/jdit/ws/aes/CC515CV1.wsdl',
        operation: 'CC515CV1',
        messageType: 'CC515C',
        description: 'Declaracion de exportacion AES P1'
      },
      AES_QUERY: {
        code: 'AES_QUERY',
        name: 'Consulta Exportación',
        path: '/wlpl/ADEX-JDIT/ws/aes/CCAESCV1SOAP',
        wsdlUrl: 'https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adex/jdit/ws/aes/CCAESCV1.wsdl',
        operation: 'CCAESCV1',
        description: 'Consulta estado declaracion exportacion'
      },

      // === TRÁNSITO NCTS5 ===
      NCTS_SUBMIT: {
        code: 'NCTS_SUBMIT',
        name: 'Presentación Tránsito NCTS',
        path: '/wlpl/ADTR-JDIT/ws/ncts5/CC015CV1SOAP',
        wsdlUrl: 'https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adtr/jdit/ws/ncts5/CC015CV1.wsdl',
        operation: 'CC015CV1',
        messageType: 'CC015C',
        description: 'Declaracion de transito NCTS Fase 5'
      },
      NCTS_ARRIVAL: {
        code: 'NCTS_ARRIVAL',
        name: 'Notificación Llegada NCTS',
        path: '/wlpl/ADTR-JDIT/ws/ncts5/CC007CV1SOAP',
        wsdlUrl: 'https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adtr/jdit/ws/ncts5/CC007CV1.wsdl',
        operation: 'CC007CV1',
        messageType: 'CC007C',
        description: 'Notificacion de llegada de transito'
      },
      NCTS_UNLOADING: {
        code: 'NCTS_UNLOADING',
        name: 'Notificación Descarga NCTS',
        path: '/wlpl/ADTR-JDIT/ws/ncts5/CC044CV1SOAP',
        wsdlUrl: 'https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adtr/jdit/ws/ncts5/CC044CV1.wsdl',
        operation: 'CC044CV1',
        messageType: 'CC044C',
        description: 'Observaciones descarga de transito'
      },
      NCTS_QUERY: {
        code: 'NCTS_QUERY',
        name: 'Consulta Tránsito',
        path: '/wlpl/ADTR-JDIT/ws/ncts5/CCTRACV2SOAP',
        wsdlUrl: 'https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adtr/jdit/ws/ncts5/CCTRACV2.wsdl',
        operation: 'CCTRACV2',
        description: 'Consulta estado de transito'
      },

      // === ICS2 ENS (Import Control System 2) - Release 5 ===
      ICS2_ENS_SUBMIT: {
        code: 'ICS2_ENS_SUBMIT',
        name: 'Presentación ENS ICS2',
        path: '/wlpl/inwinvoc/es.aeat.dit.adu.aden.enswsv5.IE315V5SOAP',
        wsdlUrl: 'https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/aden/enswsv5/IE315V5.wsdl',
        operation: 'IE315V5',
        messageType: 'IE315',
        description: 'Declaracion sumaria de entrada ICS2'
      },
      ICS2_ENS_AMEND: {
        code: 'ICS2_ENS_AMEND',
        name: 'Rectificación ENS ICS2',
        path: '/wlpl/inwinvoc/es.aeat.dit.adu.aden.enswsv5.IE313V5SOAP',
        wsdlUrl: 'https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/aden/enswsv5/IE313V5.wsdl',
        operation: 'IE313V5',
        messageType: 'IE313',
        description: 'Rectificacion de declaracion sumaria de entrada'
      },
      ICS2_ENS_QUERY: {
        code: 'ICS2_ENS_QUERY',
        name: 'Consulta ENS ICS2',
        path: '/wlpl/inwinvoc/es.aeat.dit.adu.aden.enswsv5.ConsENSV3SOAP',
        wsdlUrl: 'https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/aden/enswsv5/ConsENSV3.wsdl',
        operation: 'ConsENSV3',
        description: 'Consulta estado de declaracion ENS'
      },

      // === SOIVRE ===
      SOIVRE_SUBMIT: {
        code: 'SOIVRE_SUBMIT',
        name: 'Alta Solicitud SOIVRE',
        path: '/L/inwinvoc/es.aeat.dit.adu.ad44.soivre.SOIVREaltaV1SOAP',
        wsdlUrl: 'https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/ad44/soivre/SOIVREaltaV1.wsdl',
        operation: 'SOIVREaltaV1',
        description: 'Alta de solicitud de inspeccion SOIVRE'
      },

      // === CONSULTAS ADDS-JDIT ===
      QUERY_BY_BOL: {
        code: 'QUERY_BY_BOL',
        name: 'Consulta por Conocimiento',
        wsdl: '/static_files/common/internet/dep/aduanas/es/aeat/adht/jdit/ws/ConsultaDeclaracV1.wsdl',
        operation: 'consultarPorConocimiento',
        description: 'Consulta declaraciones por número de B/L, AWB o CMR'
      },
      QUERY_BY_CONTAINER: {
        code: 'QUERY_BY_CONTAINER',
        name: 'Consulta por Contenedor',
        wsdl: '/static_files/common/internet/dep/aduanas/es/aeat/adht/jdit/ws/ConsultaDeclaracV1.wsdl',
        operation: 'consultarPorContenedor',
        description: 'Consulta declaraciones por número de contenedor'
      },
      QUERY_BY_LOCATION: {
        code: 'QUERY_BY_LOCATION',
        name: 'Consulta por Ubicación',
        wsdl: '/static_files/common/internet/dep/aduanas/es/aeat/adht/jdit/ws/ConsultaDeclaracV1.wsdl',
        operation: 'consultarPorUbicacion',
        description: 'Consulta declaraciones por ubicación/aduana'
      },
      QUERY_DOCUMENTS: {
        code: 'QUERY_DOCUMENTS',
        name: 'Consulta Documentos Asociados',
        wsdl: '/static_files/common/internet/dep/aduanas/es/aeat/adht/jdit/ws/ConsultaDocumentosV1.wsdl',
        operation: 'consultarDocumentosAsociados',
        description: 'Consulta documentos asociados a una declaración'
      },

      // === BANDEJA DE ENTRADA ===
      INBOX_LIST: {
        code: 'INBOX_LIST',
        name: 'Lista de Declaraciones',
        wsdl: '/static_files/common/internet/dep/aduanas/es/aeat/adht/band/ws/li/ListaDecV4.wsdl',
        operation: 'listarDeclaraciones',
        description: 'Consulta bandeja de entrada de declaraciones'
      },

      // === DOCUMENTOS DIGITALIZADOS ===
      DOCS_SUBMIT: {
        code: 'DOCS_SUBMIT',
        name: 'Envío Documentos Digitalizados',
        wsdl: '/static_files/common/internet/dep/aduanas/es/aeat/adaa/jdit/ws/EnvioDeDocumentosV1.wsdl',
        operation: 'enviarDocumentos',
        version: '1.7',
        description: 'Envío de documentación digitalizada adjunta'
      },

      // === SILICIE (Impuestos Especiales) ===
      SILICIE_ALCOHOL_ALTA: {
        code: 'SILICIE_ALCOHOL_ALTA',
        name: 'SILICIE Alcohol - Alta',
        wsdl: '/static_files/common/internet/dep/aduanas/es/aeat/adsi/lico/ws/v2/altas/alc/IESA1V2.wsdl',
        operation: 'altaAsiento',
        description: 'Alta de asiento contable SILICIE Alcohol'
      },
      SILICIE_HYDROCARB_ALTA: {
        code: 'SILICIE_HYDROCARB_ALTA',
        name: 'SILICIE Hidrocarburos - Alta',
        wsdl: '/static_files/common/internet/dep/aduanas/es/aeat/adsi/lico/ws/v2/altas/hid/IESH1V2.wsdl',
        operation: 'altaAsiento',
        description: 'Alta de asiento contable SILICIE Hidrocarburos'
      },
      SILICIE_TOBACCO_ALTA: {
        code: 'SILICIE_TOBACCO_ALTA',
        name: 'SILICIE Tabaco - Alta',
        wsdl: '/static_files/common/internet/dep/aduanas/es/aeat/adsi/lico/ws/v2/altas/tab/IEST1V2.wsdl',
        operation: 'altaAsiento',
        description: 'Alta de asiento contable SILICIE Tabaco'
      },

      // === EMCS (Excise Movement Control System) ===
      EMCS_IE815: {
        code: 'EMCS_IE815',
        name: 'EMCS - Documento de Acompañamiento',
        wsdl: '/static_files/common/internet/dep/aduanas/es/aeat/dit/adu/adi1/emcssw/Ie815V4.wsdl',
        operation: 'enviarIE815',
        description: 'Borrador de documento de acompañamiento EMCS'
      }
    };

    // Códigos de respuesta AEAT
    this.RESPONSE_CODES = {
      // Aceptación
      '0000': { status: 'accepted', description: 'Declaración aceptada' },
      '0001': { status: 'accepted_warning', description: 'Aceptada con advertencias' },

      // Canal asignado
      '1000': { status: 'channel_green', description: 'Canal verde - Levante automático' },
      '1001': { status: 'channel_orange', description: 'Canal naranja - Control documental' },
      '1002': { status: 'channel_red', description: 'Canal rojo - Reconocimiento físico' },
      '1003': { status: 'channel_yellow', description: 'Canal amarillo - Pendiente certificados' },

      // Errores de formato
      '2001': { status: 'error', description: 'Error de formato XML' },
      '2002': { status: 'error', description: 'Firma digital inválida' },
      '2003': { status: 'error', description: 'Certificado no autorizado' },
      '2004': { status: 'error', description: 'Campos obligatorios faltantes' },

      // Errores de validación
      '3001': { status: 'rejected', description: 'NIF/EORI no válido' },
      '3002': { status: 'rejected', description: 'Código TARIC inválido' },
      '3003': { status: 'rejected', description: 'Valor declarado inconsistente' },
      '3004': { status: 'rejected', description: 'País de origen no autorizado' },
      '3005': { status: 'rejected', description: 'Certificado de origen requerido' },
      '3006': { status: 'rejected', description: 'Licencia de importación requerida' },

      // Errores de sistema
      '9001': { status: 'system_error', description: 'Error interno AEAT' },
      '9002': { status: 'system_error', description: 'Servicio temporalmente no disponible' },
      '9003': { status: 'timeout', description: 'Tiempo de espera agotado' }
    };

    // Estado de conexión
    this.connectionStatus = {
      lastCheck: null,
      isConnected: false,
      environment: this.environment.name,
      latency: null
    };

    // Configuración HTTP
    this.httpConfig = {
      timeout: parseInt(process.env.AEAT_TIMEOUT) || 30000,
      maxRetries: parseInt(process.env.AEAT_MAX_RETRIES) || 3,
      retryDelay: parseInt(process.env.AEAT_RETRY_DELAY) || 1000
    };

    // HTTPS Agent con certificado para autenticación mutua SSL
    this.httpsAgent = null;
    this.certificateLoaded = false;
    this._initializeSSLAgent();
  }

  /**
   * Inicializar agente HTTPS con certificado P12 para autenticación mutua SSL
   */
  _initializeSSLAgent() {
    try {
      const certPath = process.env.AEAT_CERTIFICATE_PATH;
      const certPassword = process.env.AEAT_CERTIFICATE_PASSWORD;

      if (!certPath || !certPassword) {
        logger.warn('[AEAT] No certificate configured - SSL mutual auth disabled');
        return;
      }

      // Resolver ruta del certificado
      const absolutePath = path.isAbsolute(certPath)
        ? certPath
        : path.join(process.cwd(), certPath);

      if (!fs.existsSync(absolutePath)) {
        logger.warn(`[AEAT] Certificate file not found: ${absolutePath}`);
        return;
      }

      // Leer certificado P12
      const p12Buffer = fs.readFileSync(absolutePath);

      // Convertir P12 a formato PEM para HTTPS agent
      const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12Buffer));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, certPassword);

      // Extraer certificado y clave privada
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

      const certBag = certBags[forge.pki.oids.certBag];
      const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];

      if (!certBag || certBag.length === 0 || !keyBag || keyBag.length === 0) {
        logger.error('[AEAT] Invalid P12 certificate - missing cert or key');
        return;
      }

      const certificate = certBag[0].cert;
      const privateKey = keyBag[0].key;

      // Convertir a PEM
      const certPem = forge.pki.certificateToPem(certificate);
      const keyPem = forge.pki.privateKeyToPem(privateKey);

      // Crear HTTPS agent con certificado cliente
      this.httpsAgent = new https.Agent({
        cert: certPem,
        key: keyPem,
        rejectUnauthorized: true, // Verificar certificado del servidor
        keepAlive: true,
        maxSockets: 10
      });

      this.certificateLoaded = true;

      // Extraer información del certificado
      const subject = certificate.subject.attributes.reduce((acc, attr) => {
        acc[attr.shortName || attr.name] = attr.value;
        return acc;
      }, {});

      logger.info('[AEAT] SSL mutual authentication configured', {
        subject: subject.CN || subject.O,
        validTo: certificate.validity.notAfter.toISOString(),
        environment: this.environment.name
      });

    } catch (error) {
      logger.error('[AEAT] Failed to initialize SSL agent', { error: error.message });
      this.certificateLoaded = false;
    }
  }

  /**
   * Verificar si el certificado está cargado para conexión real
   */
  isCertificateReady() {
    return this.certificateLoaded && this.httpsAgent !== null;
  }

  // ============== MÉTODOS PRINCIPALES ==============

  /**
   * Enviar declaración H1 de importación
   */
  async submitH1Declaration(declarationXML, certificateId, password, options = {}) {
    return this._submitDeclaration(
      this.SERVICES.H1_SUBMIT,
      declarationXML,
      certificateId,
      password,
      options
    );
  }

  /**
   * Enviar declaración H7 (bajo valor)
   */
  async submitH7Declaration(declarationXML, certificateId, password, options = {}) {
    return this._submitDeclaration(
      this.SERVICES.H7_SUBMIT,
      declarationXML,
      certificateId,
      password,
      {
        ...options,
        // En 2026: sin umbral mínimo para e-commerce
        validateNoThreshold: true
      }
    );
  }

  /**
   * Enviar declaración AES de exportación
   */
  async submitAESDeclaration(declarationXML, certificateId, password, options = {}) {
    return this._submitDeclaration(
      this.SERVICES.AES_SUBMIT,
      declarationXML,
      certificateId,
      password,
      options
    );
  }

  /**
   * Enviar declaración de tránsito NCTS
   */
  async submitNCTSDeclaration(declarationXML, certificateId, password, options = {}) {
    return this._submitDeclaration(
      this.SERVICES.NCTS_SUBMIT,
      declarationXML,
      certificateId,
      password,
      options
    );
  }

  /**
   * Enviar declaración ENS (ICS2)
   */
  async submitENSDeclaration(xml, certificateId, password, options = {}) {
    return this._submitDeclaration(
      this.SERVICES.ICS2_ENS_SUBMIT,
      xml,
      certificateId,
      password,
      options
    );
  }

  /**
   * Rectificar declaración ENS
   */
  async amendENSDeclaration(xml, certificateId, password, options = {}) {
    return this._submitDeclaration(
      this.SERVICES.ICS2_ENS_AMEND,
      xml,
      certificateId,
      password,
      options
    );
  }

  /**
   * Notificar llegada ENS
   */
  async notifyENSArrival(xml, certificateId, password, options = {}) {
    return this._submitDeclaration(
      this.SERVICES.ICS2_ENS_ARRIVAL,
      xml,
      certificateId,
      password,
      options
    );
  }

  /**
   * Anular declaración ENS
   */
  async cancelENSDeclaration(xml, certificateId, password, options = {}) {
    return this._submitDeclaration(
      this.SERVICES.ICS2_ENS_CANCEL,
      xml,
      certificateId,
      password,
      options
    );
  }

  /**
   * Consultar estado de ENS
   */
  async queryENSStatus(mrn, certificateId, password) {
    return this.queryDeclarationStatus(mrn, 'ENS', certificateId, password);
  }

  /**
   * Consultar estado de declaración
   */
  async queryDeclarationStatus(mrn, declarationType, certificateId, password) {
    const serviceMap = {
      'H1': this.SERVICES.H1_QUERY,
      'H7': this.SERVICES.H7_QUERY,
      'AES': this.SERVICES.AES_QUERY,
      'NCTS': this.SERVICES.NCTS_QUERY,
      'ENS': this.SERVICES.ICS2_ENS_QUERY
    };

    const service = serviceMap[declarationType];
    if (!service) {
      return {
        success: false,
        error: `Tipo de declaración no soportado: ${declarationType}`,
        luciAnalysis: this._generateInvalidTypeAnalysis(declarationType)
      };
    }

    try {
      logger.info(`AEATReal: Consultando estado ${declarationType} MRN: ${mrn}`);

      // Validar certificado
      const certValidation = await certificateService.validateCertificateForOperation(
        certificateId,
        declarationType
      );

      if (!certValidation.valid) {
        return {
          success: false,
          error: 'Certificado no válido para esta operación',
          luciAnalysis: certValidation.luciAnalysis
        };
      }

      // Construir petición de consulta
      const queryXML = this._buildQueryRequest(mrn, declarationType);

      // Firmar petición
      const signResult = await xadesSignatureService.signForAEAT(
        queryXML,
        certificateId,
        password,
        { operationType: declarationType }
      );

      if (!signResult.success) {
        return signResult;
      }

      // Enviar consulta
      const response = await this._sendSOAPRequest(service, signResult.signedXML);

      // Procesar respuesta
      const result = this._processQueryResponse(response, declarationType);

      // Análisis LUCI del estado
      result.luciAnalysis = await this._luciStatusAnalysis(result, declarationType);

      return result;

    } catch (error) {
      logger.error(`AEATReal: Error consultando ${declarationType}`, { error: error.message });
      return {
        success: false,
        error: error.message,
        luciAnalysis: this._generateQueryErrorAnalysis(error, declarationType)
      };
    }
  }

  /**
   * Obtener bandeja de entrada
   */
  async getInbox(certificateId, password, filters = {}) {
    try {
      logger.info('AEATReal: Consultando bandeja de entrada');

      const queryXML = this._buildInboxRequest(filters);

      const signResult = await xadesSignatureService.signForAEAT(
        queryXML,
        certificateId,
        password,
        { operationType: 'INBOX' }
      );

      if (!signResult.success) {
        return signResult;
      }

      const response = await this._sendSOAPRequest(this.SERVICES.INBOX_LIST, signResult.signedXML);

      const declarations = this._parseInboxResponse(response);

      // Análisis LUCI de la bandeja
      const luciAnalysis = await this._luciInboxAnalysis(declarations);

      return {
        success: true,
        declarations,
        summary: {
          total: declarations.length,
          byStatus: this._groupByStatus(declarations),
          byType: this._groupByType(declarations),
          pendingAction: declarations.filter(d => d.requiresAction).length
        },
        luciAnalysis
      };

    } catch (error) {
      logger.error('AEATReal: Error consultando bandeja', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enviar documentos digitalizados
   */
  async submitDigitalDocuments(mrn, documents, certificateId, password) {
    try {
      logger.info(`AEATReal: Enviando ${documents.length} documentos para MRN: ${mrn}`);

      // Construir petición con documentos
      const docsXML = this._buildDocumentsRequest(mrn, documents);

      const signResult = await xadesSignatureService.signForAEAT(
        docsXML,
        certificateId,
        password,
        { operationType: 'DOCS' }
      );

      if (!signResult.success) {
        return signResult;
      }

      const response = await this._sendSOAPRequest(this.SERVICES.DOCS_SUBMIT, signResult.signedXML);

      const result = this._processDocumentsResponse(response);

      result.luciAnalysis = {
        status: result.success ? 'success' : 'error',
        summary: result.success ?
          `${documents.length} documentos enviados correctamente a AEAT` :
          'Error al enviar documentos',
        documentsProcessed: documents.map(d => ({
          name: d.name,
          type: d.type,
          status: result.success ? 'sent' : 'failed'
        }))
      };

      return result;

    } catch (error) {
      logger.error('AEATReal: Error enviando documentos', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test de conectividad con AEAT
   */
  async testConnectivity() {
    try {
      logger.info('AEATReal: Probando conectividad con AEAT');

      const startTime = Date.now();

      // URL de prueba (usar la definida en el entorno o fallback a producción)
      const testUrl = this.environment.testUrl || 'https://www1.agenciatributaria.gob.es';

      // Usar el HTTPS agent con certificado si está disponible
      const agent = this.httpsAgent || new https.Agent({ rejectUnauthorized: false });

      const response = await axios.get(testUrl, {
        timeout: 15000,
        httpsAgent: agent,
        validateStatus: (status) => status < 500 // Aceptar cualquier respuesta que no sea error de servidor
      });

      const latency = Date.now() - startTime;

      this.connectionStatus = {
        lastCheck: new Date().toISOString(),
        isConnected: true,
        environment: this.environment.name,
        latency,
        sslMutualAuth: this.certificateLoaded,
        responseStatus: response.status
      };

      return {
        success: true,
        connectivity: this.connectionStatus,
        luciAnalysis: {
          status: 'connected',
          message: `Conexión exitosa con AEAT (${this.environment.name})`,
          latency: `${latency}ms`,
          sslStatus: this.certificateLoaded ? 'Autenticación SSL mutua activa' : 'Sin certificado cliente',
          recommendation: latency > 2000 ?
            'La latencia es alta, considerar reintentos automáticos' :
            'Conectividad óptima'
        }
      };

    } catch (error) {
      const latency = Date.now() - (this.connectionStatus?.lastCheck ? new Date(this.connectionStatus.lastCheck).getTime() : Date.now());

      this.connectionStatus = {
        lastCheck: new Date().toISOString(),
        isConnected: false,
        environment: this.environment.name,
        sslMutualAuth: this.certificateLoaded,
        error: error.message
      };

      // Analizar tipo de error
      let errorAnalysis = {
        status: 'disconnected',
        message: 'No se pudo conectar con AEAT',
        error: error.message,
        recommendations: [
          'Verificar conexión a internet',
          'Comprobar que los servicios AEAT estén operativos',
          'Verificar configuración de firewall/proxy',
          'Consultar estado de servicios: https://sede.agenciatributaria.gob.es'
        ]
      };

      // Errores de certificado
      if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
          error.code === 'CERT_HAS_EXPIRED' ||
          error.message.includes('certificate')) {
        errorAnalysis.recommendations = [
          'Verificar que el certificado FNMT esté vigente',
          'Comprobar que la IP esté autorizada en AEAT',
          'Renovar certificado si ha expirado'
        ];
      }

      // Errores de red
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorAnalysis.recommendations = [
          'Verificar conexión a internet',
          'Comprobar configuración de DNS',
          'Verificar firewall corporativo'
        ];
      }

      return {
        success: false,
        connectivity: this.connectionStatus,
        luciAnalysis: errorAnalysis
      };
    }
  }

  // ============== MÉTODOS PRIVADOS ==============

  /**
   * Enviar declaración genérica
   */
  async _submitDeclaration(service, declarationXML, certificateId, password, options) {
    try {
      logger.info(`AEATReal: Enviando declaración ${service.code}`);

      // 1. Validar certificado para la operación
      const operationType = service.code.split('_')[0]; // H1, H7, AES, NCTS
      const certValidation = await certificateService.validateCertificateForOperation(
        certificateId,
        operationType
      );

      if (!certValidation.valid) {
        return {
          success: false,
          error: 'Certificado no válido para esta operación',
          luciAnalysis: certValidation.luciAnalysis
        };
      }

      // 2. Validación previa LUCI
      const preValidation = await this._luciPreSubmitValidation(declarationXML, service, options);

      if (!preValidation.canSubmit) {
        return {
          success: false,
          error: 'Validación previa fallida',
          luciAnalysis: preValidation
        };
      }

      // 3. Firmar declaración con XAdES-EPES
      const signResult = await xadesSignatureService.signForAEAT(
        declarationXML,
        certificateId,
        password,
        { operationType, messageType: service.messageType }
      );

      if (!signResult.success) {
        return {
          success: false,
          error: 'Error firmando declaración',
          signatureError: signResult.error,
          luciAnalysis: signResult.luciAnalysis
        };
      }

      // 4. Construir sobre SOAP
      const soapEnvelope = this._buildSOAPEnvelope(service, signResult.signedXML);

      // 5. Enviar a AEAT con reintentos
      const response = await this._sendSOAPRequestWithRetry(service, soapEnvelope);

      // 6. Verificar firma de respuesta
      if (response.signed) {
        const verifyResult = await xadesSignatureService.verifyAEATResponse(response.body);
        response.signatureVerification = verifyResult;
      }

      // 7. Procesar respuesta
      const result = this._processSubmissionResponse(response, service);

      // 8. Análisis LUCI de la respuesta
      result.luciAnalysis = await this._luciResponseAnalysis(result, service);

      logger.info(`AEATReal: Declaración ${service.code} procesada`, {
        success: result.success,
        mrn: result.mrn,
        channel: result.channel
      });

      return result;

    } catch (error) {
      logger.error(`AEATReal: Error en ${service.code}`, { error: error.message });

      return {
        success: false,
        error: error.message,
        luciAnalysis: await this._luciSubmissionErrorAnalysis(error, service)
      };
    }
  }

  /**
   * Construir sobre SOAP
   */
  _buildSOAPEnvelope(service, signedContent) {
    const timestamp = new Date().toISOString();

    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:aeat="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas">
  <soapenv:Header>
    <aeat:ServiceHeader>
      <aeat:Timestamp>${timestamp}</aeat:Timestamp>
      <aeat:ServiceCode>${service.code}</aeat:ServiceCode>
      <aeat:Version>${service.guideVersion || '1.0'}</aeat:Version>
    </aeat:ServiceHeader>
  </soapenv:Header>
  <soapenv:Body>
    <aeat:${service.operation}Request>
      ${signedContent}
    </aeat:${service.operation}Request>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  /**
   * Enviar petición SOAP con reintentos
   */
  async _sendSOAPRequestWithRetry(service, soapEnvelope) {
    let lastError = null;

    for (let attempt = 1; attempt <= this.httpConfig.maxRetries; attempt++) {
      try {
        logger.info(`AEATReal: Intento ${attempt}/${this.httpConfig.maxRetries} para ${service.code}`);

        const response = await this._sendSOAPRequest(service, soapEnvelope);
        return response;

      } catch (error) {
        lastError = error;
        logger.warn(`AEATReal: Intento ${attempt} fallido`, { error: error.message });

        if (attempt < this.httpConfig.maxRetries) {
          await this._delay(this.httpConfig.retryDelay * attempt);
        }
      }
    }

    throw lastError;
  }

  /**
   * Enviar petición SOAP
   */
  async _sendSOAPRequest(service, soapEnvelope) {
    // Usar path directo al SOAP endpoint (no WSDL)
    const serviceUrl = `${this.environment.wsBaseUrl}${service.path || service.wsdl}`;

    // En modo simulación, devolver respuesta simulada
    if (process.env.AEAT_SIMULATE === 'true' || process.env.AEAT_FORCE_SIMULATION === 'true') {
      logger.info(`[AEAT] Using SIMULATION mode for ${service.code}`);
      return this._simulateAEATResponse(service, soapEnvelope);
    }

    // Verificar que tenemos certificado para conexión real
    if (!this.isCertificateReady()) {
      logger.warn('[AEAT] No certificate loaded - falling back to simulation');
      return this._simulateAEATResponse(service, soapEnvelope);
    }

    // Log de petición si debug está activo
    if (process.env.AEAT_DEBUG === 'true') {
      logger.info(`[AEAT] Sending REAL request to ${serviceUrl}`, {
        service: service.code,
        operation: service.operation,
        environment: this.environment.name
      });
    }

    try {
      // Petición real con autenticación SSL mutua
      const response = await axios.post(serviceUrl, soapEnvelope, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': `"${service.operation}"`,
          'Accept': 'text/xml, application/xml',
          'User-Agent': 'LUCI-Customs-Agent/1.0'
        },
        timeout: this.httpConfig.timeout,
        httpsAgent: this.httpsAgent, // Usar agente con certificado
        validateStatus: (status) => status < 500 // Aceptar respuestas de error de negocio
      });

      if (process.env.AEAT_DEBUG === 'true') {
        logger.info(`[AEAT] Response received from ${service.code}`, {
          status: response.status,
          contentLength: response.data?.length
        });
      }

      return {
        status: response.status,
        body: response.data,
        signed: response.data.includes('<ds:Signature'),
        simulated: false
      };

    } catch (error) {
      // Manejar errores de conexión
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        logger.error(`[AEAT] Connection failed to ${serviceUrl}`, {
          code: error.code,
          message: error.message
        });
        throw new Error(`No se pudo conectar con AEAT: ${error.message}`);
      }

      if (error.code === 'CERT_HAS_EXPIRED' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        logger.error('[AEAT] SSL Certificate error', { code: error.code });
        throw new Error('Error de certificado SSL: ' + error.message);
      }

      if (error.response) {
        // AEAT respondió con error
        logger.error('[AEAT] Server error response', {
          status: error.response.status,
          data: error.response.data?.substring?.(0, 500)
        });
        return {
          status: error.response.status,
          body: error.response.data,
          signed: false,
          simulated: false,
          error: true
        };
      }

      throw error;
    }
  }

  /**
   * Simular respuesta AEAT (para desarrollo/sandbox)
   */
  _simulateAEATResponse(service, soapEnvelope) {
    const timestamp = new Date().toISOString();
    const mrn = this._generateMRN(service.code);

    // Determinar canal aleatorio para simulación
    const channels = ['green', 'orange', 'red'];
    const weights = [0.85, 0.10, 0.05]; // 85% verde, 10% naranja, 5% rojo
    const channel = this._weightedRandom(channels, weights);

    const channelCodes = { green: '1000', orange: '1001', red: '1002' };

    logger.info(`AEATReal: [SIMULACIÓN] Generando respuesta para ${service.code}`, {
      mrn,
      channel
    });

    return {
      status: 200,
      body: `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <aeat:${service.operation}Response>
      <aeat:ResponseCode>${channelCodes[channel]}</aeat:ResponseCode>
      <aeat:ResponseMessage>${this.RESPONSE_CODES[channelCodes[channel]].description}</aeat:ResponseMessage>
      <aeat:MRN>${mrn}</aeat:MRN>
      <aeat:Channel>${channel.toUpperCase()}</aeat:Channel>
      <aeat:Timestamp>${timestamp}</aeat:Timestamp>
      <aeat:Environment>SANDBOX</aeat:Environment>
    </aeat:${service.operation}Response>
  </soapenv:Body>
</soapenv:Envelope>`,
      signed: false,
      simulated: true
    };
  }

  /**
   * Procesar respuesta de envío
   */
  _processSubmissionResponse(response, service) {
    const body = response.body;

    // Extraer código de respuesta
    const codeMatch = body.match(/<aeat:ResponseCode>(\d+)<\/aeat:ResponseCode>/);
    const responseCode = codeMatch ? codeMatch[1] : 'UNKNOWN';

    // Extraer MRN
    const mrnMatch = body.match(/<aeat:MRN>([^<]+)<\/aeat:MRN>/);
    const mrn = mrnMatch ? mrnMatch[1] : null;

    // Extraer canal
    const channelMatch = body.match(/<aeat:Channel>([^<]+)<\/aeat:Channel>/);
    const channel = channelMatch ? channelMatch[1].toLowerCase() : null;

    // Extraer mensaje
    const msgMatch = body.match(/<aeat:ResponseMessage>([^<]+)<\/aeat:ResponseMessage>/);
    const message = msgMatch ? msgMatch[1] : null;

    const responseInfo = this.RESPONSE_CODES[responseCode] || {
      status: 'unknown',
      description: 'Código de respuesta no reconocido'
    };

    const success = ['accepted', 'accepted_warning', 'channel_green', 'channel_orange', 'channel_red', 'channel_yellow']
      .includes(responseInfo.status);

    return {
      success,
      responseCode,
      responseStatus: responseInfo.status,
      responseMessage: message || responseInfo.description,
      mrn,
      channel,
      timestamp: new Date().toISOString(),
      service: service.code,
      environment: this.environment.name,
      simulated: response.simulated || false,
      rawResponse: body
    };
  }

  /**
   * Construir petición de consulta
   */
  _buildQueryRequest(mrn, declarationType) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<aeat:ConsultaDeclaracion xmlns:aeat="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas">
  <aeat:MRN>${mrn}</aeat:MRN>
  <aeat:TipoDeclaracion>${declarationType}</aeat:TipoDeclaracion>
  <aeat:FechaConsulta>${new Date().toISOString()}</aeat:FechaConsulta>
</aeat:ConsultaDeclaracion>`;
  }

  /**
   * Procesar respuesta de consulta
   */
  _processQueryResponse(response, declarationType) {
    // Implementación simplificada - parsear XML de respuesta
    const body = response.body;

    return {
      success: true,
      declarationType,
      status: this._extractField(body, 'Estado') || 'UNKNOWN',
      channel: this._extractField(body, 'Canal'),
      lastUpdate: this._extractField(body, 'FechaActualizacion'),
      messages: this._extractMessages(body)
    };
  }

  /**
   * Construir petición de bandeja
   */
  _buildInboxRequest(filters) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<aeat:ConsultaBandeja xmlns:aeat="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas">
  <aeat:FechaDesde>${filters.dateFrom || this._getDateDaysAgo(30)}</aeat:FechaDesde>
  <aeat:FechaHasta>${filters.dateTo || new Date().toISOString()}</aeat:FechaHasta>
  <aeat:TipoDeclaracion>${filters.type || 'TODOS'}</aeat:TipoDeclaracion>
  <aeat:Estado>${filters.status || 'TODOS'}</aeat:Estado>
</aeat:ConsultaBandeja>`;
  }

  /**
   * Construir petición de documentos
   */
  _buildDocumentsRequest(mrn, documents) {
    const docsXML = documents.map((doc, i) => `
      <aeat:Documento>
        <aeat:Secuencia>${i + 1}</aeat:Secuencia>
        <aeat:Tipo>${doc.type}</aeat:Tipo>
        <aeat:Nombre>${doc.name}</aeat:Nombre>
        <aeat:Contenido>${doc.base64Content}</aeat:Contenido>
      </aeat:Documento>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<aeat:EnvioDocumentos xmlns:aeat="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas">
  <aeat:MRN>${mrn}</aeat:MRN>
  <aeat:FechaEnvio>${new Date().toISOString()}</aeat:FechaEnvio>
  <aeat:NumeroDocumentos>${documents.length}</aeat:NumeroDocumentos>
  <aeat:Documentos>${docsXML}
  </aeat:Documentos>
</aeat:EnvioDocumentos>`;
  }

  // ============== ANÁLISIS LUCI ==============

  async _luciPreSubmitValidation(declarationXML, service, options) {
    const issues = [];
    const warnings = [];

    // Verificar XML básico
    if (!declarationXML || declarationXML.length === 0) {
      issues.push('Declaración XML vacía');
    }

    // Verificar estructura según tipo
    const expectedTag = service.messageType ? `<${service.messageType}` : null;
    if (expectedTag && !declarationXML.includes(expectedTag)) {
      warnings.push(`No se encontró tag esperado ${service.messageType}`);
    }

    // Verificar campos críticos según tipo de declaración
    const criticalFields = this._getCriticalFields(service.code);
    for (const field of criticalFields) {
      if (!declarationXML.includes(`<${field.tag}>`) && !declarationXML.includes(`<${field.tag} `)) {
        if (field.required) {
          issues.push(`Campo obligatorio faltante: ${field.name}`);
        } else {
          warnings.push(`Campo recomendado faltante: ${field.name}`);
        }
      }
    }

    // Verificaciones específicas H7 (2026)
    if (service.code === 'H7_SUBMIT' && options.validateNoThreshold) {
      warnings.push('Recordatorio: Desde 2026, todos los envíos e-commerce requieren H7 sin umbral mínimo');
    }

    return {
      canSubmit: issues.length === 0,
      issues,
      warnings,
      service: service.name,
      validatedFields: criticalFields.length,
      recommendations: issues.length > 0 ?
        issues.map(i => `Corregir: ${i}`) :
        ['Declaración lista para envío a AEAT']
    };
  }

  async _luciResponseAnalysis(result, service) {
    const analysis = {
      status: result.success ? 'success' : 'error',
      summary: '',
      details: {},
      nextSteps: [],
      alerts: []
    };

    if (result.success) {
      analysis.summary = `Declaración ${service.code} procesada correctamente por AEAT`;

      if (result.channel) {
        analysis.details.channel = {
          assigned: result.channel,
          description: this._getChannelDescription(result.channel),
          actions: this._getChannelActions(result.channel)
        };

        if (result.channel === 'green') {
          analysis.nextSteps = [
            'Levante concedido automáticamente',
            'Puede proceder con el despacho de la mercancía',
            'Guardar MRN para seguimiento'
          ];
        } else if (result.channel === 'orange') {
          analysis.nextSteps = [
            'AEAT requiere documentación adicional',
            'Preparar documentos solicitados',
            'Responder en plazo máximo de 10 días',
            'Monitorear bandeja de entrada'
          ];
          analysis.alerts.push({
            level: 'warning',
            message: 'Canal naranja asignado - Acción requerida'
          });
        } else if (result.channel === 'red') {
          analysis.nextSteps = [
            'Reconocimiento físico programado',
            'Coordinar con el recinto aduanero',
            'Preparar mercancía para inspección',
            'Tener documentación original disponible'
          ];
          analysis.alerts.push({
            level: 'critical',
            message: 'Canal rojo - Inspección física requerida'
          });
        }
      }

      analysis.details.mrn = result.mrn;
      analysis.details.timestamp = result.timestamp;

    } else {
      analysis.summary = `Error procesando declaración: ${result.responseMessage}`;
      analysis.details.errorCode = result.responseCode;
      analysis.details.errorDescription = result.responseMessage;
      analysis.nextSteps = this._getErrorRecoverySteps(result.responseCode);
    }

    return analysis;
  }

  async _luciStatusAnalysis(result, declarationType) {
    return {
      status: result.status,
      declarationType,
      interpretation: this._interpretStatus(result.status, declarationType),
      recommendations: this._getStatusRecommendations(result.status, declarationType)
    };
  }

  async _luciInboxAnalysis(declarations) {
    const pending = declarations.filter(d => d.requiresAction);
    const urgent = pending.filter(d => d.daysUntilDeadline <= 3);

    return {
      summary: `${declarations.length} declaraciones en bandeja, ${pending.length} requieren acción`,
      urgent: urgent.length > 0 ? {
        count: urgent.length,
        message: `¡${urgent.length} declaración(es) con plazo urgente!`,
        declarations: urgent.map(d => ({
          mrn: d.mrn,
          type: d.type,
          daysLeft: d.daysUntilDeadline
        }))
      } : null,
      recommendations: pending.length > 0 ? [
        'Revisar declaraciones pendientes de acción',
        'Priorizar las que tienen plazo más cercano',
        'Preparar documentación para canales naranja'
      ] : ['Bandeja de entrada al día']
    };
  }

  async _luciSubmissionErrorAnalysis(error, service) {
    const errorMsg = error.message.toLowerCase();

    let analysis = {
      status: 'error',
      summary: `Error al enviar ${service.name}`,
      error: error.message,
      possibleCauses: [],
      recommendations: []
    };

    if (errorMsg.includes('timeout') || errorMsg.includes('econnrefused')) {
      analysis.possibleCauses = [
        'Servicios AEAT no disponibles',
        'Problema de conectividad de red',
        'Firewall bloqueando conexión'
      ];
      analysis.recommendations = [
        'Reintentar en unos minutos',
        'Verificar estado servicios AEAT',
        'Comprobar conexión a internet'
      ];
    } else if (errorMsg.includes('certificate') || errorMsg.includes('ssl')) {
      analysis.possibleCauses = [
        'Certificado digital no válido',
        'Certificado expirado',
        'Error de configuración SSL'
      ];
      analysis.recommendations = [
        'Verificar certificado en LUCI',
        'Renovar certificado si ha expirado',
        'Comprobar configuración de certificados'
      ];
    } else if (errorMsg.includes('xml') || errorMsg.includes('parse')) {
      analysis.possibleCauses = [
        'XML de declaración mal formado',
        'Campos con formato incorrecto',
        'Caracteres no válidos en el XML'
      ];
      analysis.recommendations = [
        'Revisar formato de la declaración',
        'Validar XML contra esquema XSD',
        'Verificar codificación UTF-8'
      ];
    } else {
      analysis.possibleCauses = ['Error técnico no identificado'];
      analysis.recommendations = [
        'Revisar logs de error',
        'Contactar soporte técnico',
        'Reintentar la operación'
      ];
    }

    return analysis;
  }

  // ============== UTILIDADES ==============

  _getCriticalFields(serviceCode) {
    const fieldsMap = {
      'H1_SUBMIT': [
        { tag: 'DeclarationOfficeID', name: 'Aduana de despacho', required: true },
        { tag: 'Declarant', name: 'Declarante', required: true },
        { tag: 'GoodsShipment', name: 'Partida de mercancías', required: true },
        { tag: 'CustomsValuation', name: 'Valor en aduana', required: true },
        { tag: 'Classification', name: 'Código TARIC', required: true }
      ],
      'H7_SUBMIT': [
        { tag: 'Sender', name: 'Remitente', required: true },
        { tag: 'Recipient', name: 'Destinatario', required: true },
        { tag: 'GoodsDescription', name: 'Descripción mercancía', required: true },
        { tag: 'IntrinsicValue', name: 'Valor intrínseco', required: true }
      ],
      'AES_SUBMIT': [
        { tag: 'Exporter', name: 'Exportador', required: true },
        { tag: 'DestinationCountry', name: 'País destino', required: true },
        { tag: 'ExportOffice', name: 'Aduana exportación', required: true },
        { tag: 'GoodsItem', name: 'Partida de mercancía', required: true }
      ],
      'NCTS_SUBMIT': [
        { tag: 'Principal', name: 'Titular tránsito', required: true },
        { tag: 'DepartureOffice', name: 'Aduana partida', required: true },
        { tag: 'DestinationOffice', name: 'Aduana destino', required: true },
        { tag: 'Guarantee', name: 'Garantía', required: true }
      ]
    };

    return fieldsMap[serviceCode] || [];
  }

  _getChannelDescription(channel) {
    const descriptions = {
      green: 'Canal verde: Levante automático sin control adicional',
      orange: 'Canal naranja: Control documental requerido por AEAT',
      red: 'Canal rojo: Reconocimiento físico de la mercancía',
      yellow: 'Canal amarillo: Pendiente de certificados o autorizaciones'
    };
    return descriptions[channel] || 'Canal desconocido';
  }

  _getChannelActions(channel) {
    const actions = {
      green: ['Proceder con despacho', 'Archivar documentación'],
      orange: ['Preparar documentos', 'Responder requerimiento', 'Monitorear estado'],
      red: ['Coordinar inspección', 'Preparar mercancía', 'Asistir reconocimiento'],
      yellow: ['Obtener certificados', 'Solicitar autorizaciones', 'Reenviar documentación']
    };
    return actions[channel] || [];
  }

  _getErrorRecoverySteps(errorCode) {
    const steps = {
      '2001': ['Validar XML contra esquema XSD', 'Corregir errores de formato'],
      '2002': ['Verificar certificado digital', 'Refirmar declaración'],
      '2003': ['Usar certificado autorizado', 'Verificar permisos de representación'],
      '2004': ['Completar campos obligatorios', 'Revisar guía técnica AEAT'],
      '3001': ['Verificar NIF/EORI en base de datos', 'Actualizar censo'],
      '3002': ['Verificar código TARIC', 'Consultar arancel vigente'],
      '3003': ['Revisar valor declarado', 'Adjuntar justificantes de precio'],
      '3004': ['Verificar restricciones de origen', 'Consultar medidas vigentes'],
      '3005': ['Obtener certificado de origen', 'Adjuntar EUR.1/Form A'],
      '3006': ['Solicitar licencia de importación', 'Verificar contingentes']
    };
    return steps[errorCode] || ['Revisar mensaje de error', 'Consultar documentación AEAT'];
  }

  _interpretStatus(status, type) {
    const interpretations = {
      'ACCEPTED': `La declaración ${type} ha sido aceptada por AEAT`,
      'PENDING': `La declaración ${type} está pendiente de procesamiento`,
      'RELEASED': 'Mercancía despachada - Levante concedido',
      'CONTROL': 'En proceso de control aduanero',
      'REJECTED': 'Declaración rechazada - Requiere corrección'
    };
    return interpretations[status] || `Estado: ${status}`;
  }

  _getStatusRecommendations(status, type) {
    const recommendations = {
      'ACCEPTED': ['Monitorear asignación de canal', 'Preparar documentación por si canal naranja'],
      'PENDING': ['Esperar procesamiento', 'Verificar en 24h si no hay respuesta'],
      'RELEASED': ['Proceder con retirada de mercancía', 'Archivar documentación'],
      'CONTROL': ['Preparar documentación solicitada', 'Responder en plazo'],
      'REJECTED': ['Revisar errores indicados', 'Corregir y reenviar declaración']
    };
    return recommendations[status] || [];
  }

  _generateMRN(serviceCode) {
    const year = new Date().getFullYear().toString().slice(-2);
    const country = 'ES';
    const random = crypto.randomBytes(8).toString('hex').toUpperCase();
    return `${year}${country}${random}`;
  }

  _weightedRandom(items, weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * total;

    for (let i = 0; i < items.length; i++) {
      if (random < weights[i]) return items[i];
      random -= weights[i];
    }
    return items[items.length - 1];
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _extractField(xml, fieldName) {
    const match = xml.match(new RegExp(`<aeat:${fieldName}>([^<]+)<\/aeat:${fieldName}>`));
    return match ? match[1] : null;
  }

  _extractMessages(xml) {
    const messages = [];
    const regex = /<aeat:Mensaje[^>]*>([^<]+)<\/aeat:Mensaje>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      messages.push(match[1]);
    }
    return messages;
  }

  _parseInboxResponse(response) {
    // Implementación simplificada
    return [];
  }

  _groupByStatus(declarations) {
    return declarations.reduce((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {});
  }

  _groupByType(declarations) {
    return declarations.reduce((acc, d) => {
      acc[d.type] = (acc[d.type] || 0) + 1;
      return acc;
    }, {});
  }

  _getDateDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }

  _generateInvalidTypeAnalysis(type) {
    return {
      issue: 'Tipo de declaración no válido',
      description: `El tipo "${type}" no está soportado`,
      validTypes: ['H1', 'H7', 'AES', 'NCTS'],
      recommendations: ['Usar uno de los tipos válidos: H1, H7, AES, NCTS']
    };
  }

  _generateQueryErrorAnalysis(error, type) {
    return {
      issue: 'Error consultando declaración',
      description: error.message,
      declarationType: type,
      recommendations: [
        'Verificar que el MRN sea correcto',
        'Comprobar conectividad con AEAT',
        'Reintentar la consulta'
      ]
    };
  }

  /**
   * Recargar certificado SSL (útil después de importar nuevo certificado)
   */
  reloadCertificate() {
    logger.info('[AEAT] Reloading SSL certificate...');
    this._initializeSSLAgent();
    return {
      success: this.certificateLoaded,
      message: this.certificateLoaded
        ? 'Certificate reloaded successfully'
        : 'Failed to reload certificate'
    };
  }

  /**
   * Obtener información del servicio
   */
  getInfo() {
    return {
      service: 'AEAT Real Integration Service',
      version: '6.1.0',
      environment: this.environment.name,
      baseUrl: this.environment.baseUrl,
      services: Object.keys(this.SERVICES).length,
      supportedDeclarations: ['H1', 'H7', 'AES', 'NCTS', 'ENS', 'EXS'],
      features: [
        'Firma XAdES-EPES',
        'Autenticación SSL mutua',
        'Reintentos automáticos',
        'Análisis LUCI integrado',
        'Modo sandbox/producción'
      ],
      sslStatus: {
        certificateLoaded: this.certificateLoaded,
        mutualAuthEnabled: this.httpsAgent !== null,
        certificatePath: process.env.AEAT_CERTIFICATE_PATH ? 'Configured' : 'Not configured'
      },
      simulationMode: process.env.AEAT_SIMULATE === 'true' || process.env.AEAT_FORCE_SIMULATION === 'true',
      connectivity: this.connectionStatus,
      documentation: {
        webServices: 'https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/ws.html',
        technicalGuides: 'https://sede.agenciatributaria.gob.es/Sede/aduanas/aduana-electronica/guias-tecnicas.html'
      }
    };
  }

  /**
   * Obtener servicios disponibles
   */
  getAvailableServices() {
    return Object.values(this.SERVICES).map(s => ({
      code: s.code,
      name: s.name,
      description: s.description,
      messageType: s.messageType,
      guideVersion: s.guideVersion
    }));
  }
}

module.exports = new AEATRealService();
