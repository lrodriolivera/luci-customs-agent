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

// Codigo de error de una consulta que aun no tiene conexion real con la AEAT.
const CODIGO_NO_CONECTADA = 'AEAT_QUERY_NOT_CONNECTED';

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

      const results = await this._consultarAEAT('QIntNuCono', {
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

      const results = await this._consultarAEAT('QIntCont', {
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

      const results = await this._consultarAEAT('QIntUbic', {
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

      const results = await this._consultarAEAT('QIntDocAsoc', {
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

      const results = await this._consultarAEAT('QIntMRN', { mrn });

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

      const results = await this._consultarAEAT('QIntEORI', { eori });

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
      description: s.description,
      // Ninguna tiene todavia conexion real con la AEAT.
      available: false
    }));
  }

  // ============== METODOS PRIVADOS ==============

  /**
   * Consulta a la AEAT. NO ESTA CONECTADA.
   *
   * Hasta el 10/Nov/2026 este metodo fabricaba entre 1 y 5 resultados al azar
   * (MRN, estado, canal, levante, declarante «LUCI Demo Company SL») y los
   * devolvia como respuesta de la AEAT. Una consulta que no se ha hecho no
   * devuelve datos: falla diciendolo. La unica consulta de sumarias conectada
   * de verdad es la de una partida de DSDT (services/aeat/dsdtConsXmlBuilder.js,
   * aeatSubmitService.consultarSumaria), que usa el expediente.
   */
  async _consultarAEAT(queryType) {
    const servicio = this.services[queryType]?.name || queryType;
    throw Object.assign(
      new Error(`«${servicio}» todavía no está conectada con la AEAT: LUCI no devuelve resultados que no ha obtenido`),
      { code: CODIGO_NO_CONECTADA, details: queryType }
    );
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
   * Obtener fecha hace N dias
   */
  _getDateDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }
}

module.exports = new SummaryQueryService();
module.exports.CODIGO_NO_CONECTADA = CODIGO_NO_CONECTADA;
