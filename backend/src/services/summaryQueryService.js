/**
 * Summary Query Service
 * Servicio para consultas a ADDS-JDIT de AEAT
 *
 * Servicios soportados:
 * - QIntNuCono: Consulta por numero de conocimiento (B/L, AWB)
 * - QIntCont: Consulta por contenedor
 * - QIntUbic: Consulta por ubicacion
 * - QIntDocAsoc: Consulta de documentos asociados
 * - QIntMRN: Consulta por MRN
 * - QIntEORI: Consulta por EORI
 */
const { SummaryQuery } = require('../models');
const logger = require('../config/logger');

// Configuracion de servicios de consulta
const QUERY_SERVICES = {
  QIntNuCono: {
    code: 'QIntNuCono',
    name: 'Consulta por Conocimiento',
    wsdl: '/static_files/common/internet/dep/aduanas/es/aeat/adht/jdit/ws/ConsultaDeclaracV1.wsdl',
    operation: 'consultarPorConocimiento',
    description: 'Consulta declaraciones por numero de B/L, AWB o CMR'
  },
  QIntCont: {
    code: 'QIntCont',
    name: 'Consulta por Contenedor',
    wsdl: '/static_files/common/internet/dep/aduanas/es/aeat/adht/jdit/ws/ConsultaDeclaracV1.wsdl',
    operation: 'consultarPorContenedor',
    description: 'Consulta declaraciones asociadas a un contenedor'
  },
  QIntUbic: {
    code: 'QIntUbic',
    name: 'Consulta por Ubicacion',
    wsdl: '/static_files/common/internet/dep/aduanas/es/aeat/adht/jdit/ws/ConsultaDeclaracV1.wsdl',
    operation: 'consultarPorUbicacion',
    description: 'Consulta declaraciones en una ubicacion/aduana'
  },
  QIntDocAsoc: {
    code: 'QIntDocAsoc',
    name: 'Documentos Asociados',
    wsdl: '/static_files/common/internet/dep/aduanas/es/aeat/adht/jdit/ws/ConsultaDocumentosV1.wsdl',
    operation: 'consultarDocumentosAsociados',
    description: 'Consulta documentos asociados a una declaracion'
  },
  QIntMRN: {
    code: 'QIntMRN',
    name: 'Consulta por MRN',
    wsdl: '/static_files/common/internet/dep/aduanas/es/aeat/adht/jdit/ws/ConsultaDeclaracV1.wsdl',
    operation: 'consultarPorMRN',
    description: 'Consulta estado de declaracion por MRN'
  },
  QIntEORI: {
    code: 'QIntEORI',
    name: 'Consulta por EORI',
    wsdl: '/static_files/common/internet/dep/aduanas/es/aeat/adht/jdit/ws/ConsultaDeclaracV1.wsdl',
    operation: 'consultarPorEORI',
    description: 'Consulta declaraciones de un operador EORI'
  }
};

class SummaryQueryService {

  constructor() {
    this.services = QUERY_SERVICES;
  }

  /**
   * Consulta por numero de conocimiento (B/L, AWB, CMR)
   */
  async queryByBillOfLading(reference, userId, options = {}) {
    const startTime = Date.now();

    const query = new SummaryQuery({
      queryType: 'QIntNuCono',
      executedBy: userId,
      searchParams: {
        billOfLading: reference,
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        declarationType: options.declarationType,
        includeDocuments: options.includeDocuments !== false
      },
      metadata: {
        sourceIP: options.sourceIP,
        userAgent: options.userAgent,
        certificateAlias: options.certificateAlias,
        environment: process.env.AEAT_ENVIRONMENT || 'sandbox'
      }
    });

    try {
      query.queryStatus = 'processing';
      await query.save();

      // [DEMO] Simular consulta a AEAT
      const results = await this._simulateAEATQuery('QIntNuCono', {
        billOfLading: reference
      });

      const executionTime = Date.now() - startTime;
      query.complete(results, executionTime);
      await query.save();

      logger.info(`Query QIntNuCono completed: ${reference}, ${results.length} results`);

      return {
        success: true,
        queryId: query.queryId,
        results,
        count: results.length,
        executionTime
      };

    } catch (error) {
      query.fail(error);
      await query.save();

      logger.error('Error in queryByBillOfLading:', error);
      throw error;
    }
  }

  /**
   * Consulta por numero AWB (carta de porte aereo)
   */
  async queryByAWB(awbNumber, userId, options = {}) {
    // AWB es un caso especial de B/L
    return this.queryByBillOfLading(awbNumber, userId, {
      ...options,
      declarationType: 'ENS' // AWB tipicamente asociado a ENS aereas
    });
  }

  /**
   * Consulta por contenedor
   */
  async queryByContainer(containerNumber, userId, options = {}) {
    const startTime = Date.now();

    // Validar formato de contenedor (ISO 6346)
    if (!this._validateContainerNumber(containerNumber)) {
      return {
        success: false,
        error: 'Formato de contenedor invalido. Debe seguir ISO 6346 (ej: MSKU1234567)'
      };
    }

    const query = new SummaryQuery({
      queryType: 'QIntCont',
      executedBy: userId,
      searchParams: {
        containerNumber: containerNumber.toUpperCase(),
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        declarationType: options.declarationType,
        includeDocuments: options.includeDocuments !== false
      },
      metadata: {
        sourceIP: options.sourceIP,
        userAgent: options.userAgent,
        certificateAlias: options.certificateAlias,
        environment: process.env.AEAT_ENVIRONMENT || 'sandbox'
      }
    });

    try {
      query.queryStatus = 'processing';
      await query.save();

      // [DEMO] Simular consulta a AEAT
      const results = await this._simulateAEATQuery('QIntCont', {
        containerNumber: containerNumber.toUpperCase()
      });

      const executionTime = Date.now() - startTime;
      query.complete(results, executionTime);
      await query.save();

      logger.info(`Query QIntCont completed: ${containerNumber}, ${results.length} results`);

      return {
        success: true,
        queryId: query.queryId,
        results,
        count: results.length,
        executionTime
      };

    } catch (error) {
      query.fail(error);
      await query.save();

      logger.error('Error in queryByContainer:', error);
      throw error;
    }
  }

  /**
   * Consulta por ubicacion/aduana
   */
  async queryByLocation(locationCode, userId, options = {}) {
    const startTime = Date.now();

    const query = new SummaryQuery({
      queryType: 'QIntUbic',
      executedBy: userId,
      searchParams: {
        locationCode,
        dateFrom: options.dateFrom || this._getDateDaysAgo(7),
        dateTo: options.dateTo || new Date().toISOString(),
        declarationType: options.declarationType,
        status: options.status
      },
      metadata: {
        sourceIP: options.sourceIP,
        userAgent: options.userAgent,
        certificateAlias: options.certificateAlias,
        environment: process.env.AEAT_ENVIRONMENT || 'sandbox'
      }
    });

    try {
      query.queryStatus = 'processing';
      await query.save();

      // [DEMO] Simular consulta a AEAT
      const results = await this._simulateAEATQuery('QIntUbic', {
        locationCode
      });

      const executionTime = Date.now() - startTime;
      query.complete(results, executionTime);
      await query.save();

      logger.info(`Query QIntUbic completed: ${locationCode}, ${results.length} results`);

      return {
        success: true,
        queryId: query.queryId,
        results,
        count: results.length,
        executionTime
      };

    } catch (error) {
      query.fail(error);
      await query.save();

      logger.error('Error in queryByLocation:', error);
      throw error;
    }
  }

  /**
   * Consulta documentos asociados a una declaracion
   */
  async queryAssociatedDocuments(reference, userId, options = {}) {
    const startTime = Date.now();

    const query = new SummaryQuery({
      queryType: 'QIntDocAsoc',
      executedBy: userId,
      searchParams: {
        documentReference: reference,
        mrn: options.mrn
      },
      metadata: {
        sourceIP: options.sourceIP,
        userAgent: options.userAgent,
        certificateAlias: options.certificateAlias,
        environment: process.env.AEAT_ENVIRONMENT || 'sandbox'
      }
    });

    try {
      query.queryStatus = 'processing';
      await query.save();

      // [DEMO] Simular consulta a AEAT
      const results = await this._simulateAEATQuery('QIntDocAsoc', {
        reference,
        mrn: options.mrn
      });

      const executionTime = Date.now() - startTime;
      query.complete(results, executionTime);
      await query.save();

      logger.info(`Query QIntDocAsoc completed: ${reference}, ${results.length} results`);

      return {
        success: true,
        queryId: query.queryId,
        results,
        count: results.length,
        executionTime
      };

    } catch (error) {
      query.fail(error);
      await query.save();

      logger.error('Error in queryAssociatedDocuments:', error);
      throw error;
    }
  }

  /**
   * Consulta por MRN
   */
  async queryByMRN(mrn, userId, options = {}) {
    const startTime = Date.now();

    const query = new SummaryQuery({
      queryType: 'QIntMRN',
      executedBy: userId,
      searchParams: {
        mrn,
        includeHistory: options.includeHistory,
        includeDocuments: options.includeDocuments !== false
      },
      metadata: {
        sourceIP: options.sourceIP,
        userAgent: options.userAgent,
        certificateAlias: options.certificateAlias,
        environment: process.env.AEAT_ENVIRONMENT || 'sandbox'
      }
    });

    try {
      query.queryStatus = 'processing';
      await query.save();

      // [DEMO] Simular consulta a AEAT
      const results = await this._simulateAEATQuery('QIntMRN', { mrn });

      const executionTime = Date.now() - startTime;
      query.complete(results, executionTime);
      await query.save();

      logger.info(`Query QIntMRN completed: ${mrn}, ${results.length} results`);

      return {
        success: true,
        queryId: query.queryId,
        results,
        count: results.length,
        executionTime
      };

    } catch (error) {
      query.fail(error);
      await query.save();

      logger.error('Error in queryByMRN:', error);
      throw error;
    }
  }

  /**
   * Consulta por EORI
   */
  async queryByEORI(eori, userId, options = {}) {
    const startTime = Date.now();

    // Validar formato EORI
    if (!/^[A-Z]{2}\w{1,15}$/.test(eori)) {
      return {
        success: false,
        error: 'Formato EORI invalido (debe ser codigo pais + hasta 15 caracteres)'
      };
    }

    const query = new SummaryQuery({
      queryType: 'QIntEORI',
      executedBy: userId,
      searchParams: {
        eori,
        dateFrom: options.dateFrom || this._getDateDaysAgo(30),
        dateTo: options.dateTo || new Date().toISOString(),
        declarationType: options.declarationType,
        status: options.status
      },
      metadata: {
        sourceIP: options.sourceIP,
        userAgent: options.userAgent,
        certificateAlias: options.certificateAlias,
        environment: process.env.AEAT_ENVIRONMENT || 'sandbox'
      }
    });

    try {
      query.queryStatus = 'processing';
      await query.save();

      // [DEMO] Simular consulta a AEAT
      const results = await this._simulateAEATQuery('QIntEORI', { eori });

      const executionTime = Date.now() - startTime;
      query.complete(results, executionTime);
      await query.save();

      logger.info(`Query QIntEORI completed: ${eori}, ${results.length} results`);

      return {
        success: true,
        queryId: query.queryId,
        results,
        count: results.length,
        executionTime
      };

    } catch (error) {
      query.fail(error);
      await query.save();

      logger.error('Error in queryByEORI:', error);
      throw error;
    }
  }

  /**
   * Obtener historial de consultas del usuario
   */
  async getQueryHistory(userId, filters = {}) {
    return SummaryQuery.getHistory(userId, filters);
  }

  /**
   * Obtener una consulta especifica por ID
   */
  async getQueryById(queryId, userId) {
    const query = await SummaryQuery.findOne({
      queryId,
      executedBy: userId
    });

    if (!query) {
      return { success: false, error: 'Consulta no encontrada' };
    }

    return { success: true, data: query };
  }

  /**
   * Obtener estadisticas de consultas
   */
  async getQueryStats(userId, filters = {}) {
    return SummaryQuery.getStats(userId, filters);
  }

  /**
   * Obtener servicios disponibles
   */
  getAvailableServices() {
    return Object.values(this.services).map(s => ({
      code: s.code,
      name: s.name,
      description: s.description
    }));
  }

  // ============== METODOS PRIVADOS ==============

  /**
   * Simular consulta a AEAT (para desarrollo)
   */
  async _simulateAEATQuery(queryType, params) {
    // Simular latencia de red
    await this._delay(200 + Math.random() * 300);

    // Generar resultados de ejemplo
    const numResults = Math.floor(Math.random() * 5) + 1;
    const results = [];

    for (let i = 0; i < numResults; i++) {
      const declarationType = ['ENS', 'H1', 'H7', 'AES', 'NCTS'][Math.floor(Math.random() * 5)];
      const status = ['ACCEPTED', 'RELEASED', 'PENDING', 'CONTROL'][Math.floor(Math.random() * 4)];
      const channel = ['GREEN', 'ORANGE', 'RED'][Math.floor(Math.random() * 3)];

      results.push({
        mrn: this._generateMRN(declarationType),
        lrn: `LUCI${Date.now().toString(36).toUpperCase()}${i}`,
        declarationType,
        status,
        channel: status === 'ACCEPTED' || status === 'RELEASED' ? channel : null,
        customsOffice: {
          code: 'ES002801',
          name: 'Algeciras'
        },
        submissionDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        acceptanceDate: status !== 'PENDING' ? new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000) : null,
        releaseDate: status === 'RELEASED' ? new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000) : null,
        declarant: {
          eori: 'ES12345678A',
          name: 'LUCI Demo Company SL'
        },
        carrier: params.containerNumber ? {
          eori: 'ES87654321B',
          name: 'Transport Demo SA'
        } : null,
        containerNumber: params.containerNumber || (Math.random() > 0.5 ? `MSKU${Math.floor(Math.random() * 9000000) + 1000000}` : null),
        transportReference: params.billOfLading || `BL${Date.now().toString().substring(5)}`,
        grossMass: Math.floor(Math.random() * 20000) + 1000,
        numberOfPackages: Math.floor(Math.random() * 500) + 1,
        goodsDescription: 'Mercancias varias / Mixed goods',
        documents: queryType === 'QIntDocAsoc' ? [
          { type: 'ENS', documentNumber: `ENS-${Date.now()}`, status: 'VALID' },
          { type: 'DUA', documentNumber: `DUA-${Date.now()}`, status: 'VALID' }
        ] : [],
        messages: status === 'CONTROL' ? [
          { code: 'DOC_REQ', text: 'Se requiere documentacion adicional', timestamp: new Date() }
        ] : [],
        pendingActions: status === 'CONTROL' ? [
          { type: 'SUBMIT_DOCS', description: 'Enviar documentacion', deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) }
        ] : []
      });
    }

    return results;
  }

  /**
   * Validar numero de contenedor (ISO 6346)
   */
  _validateContainerNumber(number) {
    if (!number || number.length < 11) return false;
    // Formato basico: 4 letras + 7 digitos
    return /^[A-Z]{4}\d{7}$/i.test(number.replace(/\s/g, ''));
  }

  /**
   * Generar MRN de ejemplo
   */
  _generateMRN(type = 'ENS') {
    const year = new Date().getFullYear().toString().substring(2);
    const country = 'ES';
    const random = Math.random().toString().substring(2, 16).padEnd(14, '0');
    const suffix = type.substring(0, 2);
    return `${year}${country}${random}${suffix}`;
  }

  /**
   * Obtener fecha hace N dias
   */
  _getDateDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }

  /**
   * Delay helper
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new SummaryQueryService();
