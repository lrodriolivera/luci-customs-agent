/**
 * Integration Controller
 * Controlador para gestión de integraciones con sistemas externos
 */

const { integrationManager, vuaService, tracesService, nctsService } = require('../services/integrations');
const logger = require('../config/logger');

/**
 * Obtener estado de todas las integraciones
 */
exports.getStatus = async (req, res) => {
  try {
    const healthCheck = await integrationManager.healthCheck();
    res.json({
      success: true,
      data: healthCheck
    });
  } catch (error) {
    logger.error('Error obteniendo estado de integraciones:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estado de integraciones',
      message: error.message
    });
  }
};

/**
 * Obtener lista de integraciones disponibles
 */
exports.listIntegrations = async (req, res) => {
  try {
    const integrations = integrationManager.getIntegrations();
    res.json({
      success: true,
      data: integrations
    });
  } catch (error) {
    logger.error('Error listando integraciones:', error);
    res.status(500).json({
      success: false,
      error: 'Error listando integraciones',
      message: error.message
    });
  }
};

/**
 * Obtener información de integración específica
 */
exports.getIntegration = async (req, res) => {
  try {
    const { code } = req.params;
    const integration = integrationManager.getIntegration(code);

    if (!integration) {
      return res.status(404).json({
        success: false,
        error: 'Integración no encontrada'
      });
    }

    // Obtener estado actualizado
    const status = await integrationManager.checkIntegration(code);

    res.json({
      success: true,
      data: {
        ...integration,
        status: status.status,
        environment: status.environment,
        simulationMode: status.simulationMode
      }
    });
  } catch (error) {
    logger.error('Error obteniendo integración:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo integración',
      message: error.message
    });
  }
};

/**
 * Verificar conectividad de integración
 */
exports.testConnectivity = async (req, res) => {
  try {
    const { code } = req.params;
    const result = await integrationManager.checkIntegration(code);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error verificando conectividad:', error);
    res.status(500).json({
      success: false,
      error: 'Error verificando conectividad',
      message: error.message
    });
  }
};

/**
 * Obtener información de todos los servicios
 */
exports.getServicesInfo = async (req, res) => {
  try {
    const info = await integrationManager.getServicesInfo();
    res.json({
      success: true,
      data: info
    });
  } catch (error) {
    logger.error('Error obteniendo información de servicios:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo información de servicios',
      message: error.message
    });
  }
};

/**
 * Obtener configuración de ambiente
 */
exports.getEnvironmentConfig = async (req, res) => {
  try {
    const config = integrationManager.getEnvironmentConfig();
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Error obteniendo configuración:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo configuración',
      message: error.message
    });
  }
};

/**
 * Obtener estadísticas de uso
 */
exports.getUsageStats = async (req, res) => {
  try {
    const stats = integrationManager.getUsageStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estadísticas',
      message: error.message
    });
  }
};

/**
 * Obtener controles requeridos para una operación
 */
exports.getRequiredControls = async (req, res) => {
  try {
    const operationData = req.body;
    const controls = await integrationManager.getRequiredControls(operationData);

    res.json({
      success: true,
      data: controls
    });
  } catch (error) {
    logger.error('Error obteniendo controles requeridos:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo controles requeridos',
      message: error.message
    });
  }
};

// ============================================
// VUA Endpoints
// ============================================

/**
 * Presentar documento en VUA
 */
exports.vuaSubmitDocument = async (req, res) => {
  try {
    const result = await vuaService.submitDocument(req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error en VUA submitDocument:', error);
    res.status(500).json({
      success: false,
      error: 'Error presentando documento en VUA',
      message: error.message
    });
  }
};

/**
 * Consultar estado en VUA
 */
exports.vuaQueryStatus = async (req, res) => {
  try {
    const { reference } = req.params;
    const result = await vuaService.queryStatus(reference);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error en VUA queryStatus:', error);
    res.status(500).json({
      success: false,
      error: 'Error consultando estado en VUA',
      message: error.message
    });
  }
};

/**
 * Obtener servicios VUA disponibles
 */
exports.vuaGetServices = async (req, res) => {
  try {
    const services = vuaService.getAvailableServices();
    res.json({
      success: true,
      data: services
    });
  } catch (error) {
    logger.error('Error obteniendo servicios VUA:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo servicios VUA',
      message: error.message
    });
  }
};

/**
 * Obtener autoridades VUA
 */
exports.vuaGetAuthorities = async (req, res) => {
  try {
    const authorities = vuaService.getAvailableAuthorities();
    res.json({
      success: true,
      data: authorities
    });
  } catch (error) {
    logger.error('Error obteniendo autoridades VUA:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo autoridades VUA',
      message: error.message
    });
  }
};

// ============================================
// TRACES Endpoints
// ============================================

/**
 * Crear CHED en TRACES
 */
exports.tracesCreateCHED = async (req, res) => {
  try {
    const result = await tracesService.createCHED(req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error en TRACES createCHED:', error);
    res.status(500).json({
      success: false,
      error: 'Error creando CHED en TRACES',
      message: error.message
    });
  }
};

/**
 * Consultar CHED en TRACES
 */
exports.tracesGetCHED = async (req, res) => {
  try {
    const { reference } = req.params;
    const result = await tracesService.getCHED(reference);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error en TRACES getCHED:', error);
    res.status(500).json({
      success: false,
      error: 'Error consultando CHED en TRACES',
      message: error.message
    });
  }
};

/**
 * Obtener estado de CHED
 */
exports.tracesGetCHEDStatus = async (req, res) => {
  try {
    const { reference } = req.params;
    const result = await tracesService.getCHEDStatus(reference);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error en TRACES getCHEDStatus:', error);
    res.status(500).json({
      success: false,
      error: 'Error consultando estado de CHED',
      message: error.message
    });
  }
};

/**
 * Enviar CHED para validación
 */
exports.tracesSubmitCHED = async (req, res) => {
  try {
    const { reference } = req.params;
    const result = await tracesService.submitCHED(reference);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error en TRACES submitCHED:', error);
    res.status(500).json({
      success: false,
      error: 'Error enviando CHED',
      message: error.message
    });
  }
};

/**
 * Obtener tipos de CHED
 */
exports.tracesGetCHEDTypes = async (req, res) => {
  try {
    const types = tracesService.getCHEDTypes();
    res.json({
      success: true,
      data: types
    });
  } catch (error) {
    logger.error('Error obteniendo tipos de CHED:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo tipos de CHED',
      message: error.message
    });
  }
};

/**
 * Obtener puntos de control fronterizo
 */
exports.tracesGetBCPs = async (req, res) => {
  try {
    const bcps = tracesService.getBorderControlPosts();
    res.json({
      success: true,
      data: bcps
    });
  } catch (error) {
    logger.error('Error obteniendo BCPs:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo puntos de control fronterizo',
      message: error.message
    });
  }
};

/**
 * Verificar país autorizado
 */
exports.tracesCheckCountry = async (req, res) => {
  try {
    const { country, productType } = req.params;
    const authorized = tracesService.isCountryAuthorized(country, productType);
    const approvedCountries = tracesService.getApprovedCountries(productType);

    res.json({
      success: true,
      data: {
        country,
        productType,
        authorized,
        approvedCountries
      }
    });
  } catch (error) {
    logger.error('Error verificando país:', error);
    res.status(500).json({
      success: false,
      error: 'Error verificando país autorizado',
      message: error.message
    });
  }
};

// ============================================
// NCTS Endpoints
// ============================================

/**
 * Crear declaración de tránsito
 */
exports.nctsCreateDeclaration = async (req, res) => {
  try {
    const result = await nctsService.createTransitDeclaration(req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error en NCTS createDeclaration:', error);
    res.status(500).json({
      success: false,
      error: 'Error creando declaración de tránsito',
      message: error.message
    });
  }
};

/**
 * Consultar estado de tránsito
 */
exports.nctsGetStatus = async (req, res) => {
  try {
    const { mrn } = req.params;
    const result = await nctsService.getDeclarationStatus(mrn);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error en NCTS getStatus:', error);
    res.status(500).json({
      success: false,
      error: 'Error consultando estado de tránsito',
      message: error.message
    });
  }
};

/**
 * Obtener detalle de tránsito
 */
exports.nctsGetDetail = async (req, res) => {
  try {
    const { mrn } = req.params;
    const result = await nctsService.getTransitDetail(mrn);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error en NCTS getDetail:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo detalle de tránsito',
      message: error.message
    });
  }
};

/**
 * Notificar llegada
 */
exports.nctsNotifyArrival = async (req, res) => {
  try {
    const result = await nctsService.notifyArrival(req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error en NCTS notifyArrival:', error);
    res.status(500).json({
      success: false,
      error: 'Error notificando llegada',
      message: error.message
    });
  }
};

/**
 * Consultar garantía
 */
exports.nctsQueryGuarantee = async (req, res) => {
  try {
    const { grn } = req.params;
    const { accessCode } = req.query;
    const result = await nctsService.queryGuarantee(grn, accessCode);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error en NCTS queryGuarantee:', error);
    res.status(500).json({
      success: false,
      error: 'Error consultando garantía',
      message: error.message
    });
  }
};

/**
 * Calcular garantía requerida
 */
exports.nctsCalculateGuarantee = async (req, res) => {
  try {
    const { goods, transitType } = req.body;
    const result = nctsService.calculateGuaranteeAmount(goods, transitType);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error calculando garantía:', error);
    res.status(500).json({
      success: false,
      error: 'Error calculando garantía',
      message: error.message
    });
  }
};

/**
 * Obtener tipos de tránsito
 */
exports.nctsGetTransitTypes = async (req, res) => {
  try {
    const types = nctsService.getTransitTypes();
    res.json({
      success: true,
      data: types
    });
  } catch (error) {
    logger.error('Error obteniendo tipos de tránsito:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo tipos de tránsito',
      message: error.message
    });
  }
};

/**
 * Obtener aduanas de tránsito
 */
exports.nctsGetOffices = async (req, res) => {
  try {
    const { type } = req.query;
    const offices = nctsService.getTransitOffices(type);

    res.json({
      success: true,
      data: offices
    });
  } catch (error) {
    logger.error('Error obteniendo aduanas:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo aduanas de tránsito',
      message: error.message
    });
  }
};

/**
 * Obtener tipos de garantía
 */
exports.nctsGetGuaranteeTypes = async (req, res) => {
  try {
    const types = nctsService.getGuaranteeTypes();
    res.json({
      success: true,
      data: types
    });
  } catch (error) {
    logger.error('Error obteniendo tipos de garantía:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo tipos de garantía',
      message: error.message
    });
  }
};

/**
 * Buscar tránsitos
 */
exports.nctsSearch = async (req, res) => {
  try {
    const result = await nctsService.searchTransits(req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error buscando tránsitos:', error);
    res.status(500).json({
      success: false,
      error: 'Error buscando tránsitos',
      message: error.message
    });
  }
};

/**
 * Información del Integration Manager
 */
exports.getInfo = async (req, res) => {
  try {
    const info = integrationManager.getInfo();
    res.json({
      success: true,
      data: info
    });
  } catch (error) {
    logger.error('Error obteniendo información:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo información',
      message: error.message
    });
  }
};
