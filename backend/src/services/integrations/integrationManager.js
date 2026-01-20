/**
 * Integration Manager
 * Gestor centralizado de integraciones con sistemas externos
 *
 * Coordina las integraciones con:
 * - AEAT (Agencia Tributaria)
 * - VUA (Ventanilla Única Aduanera)
 * - TRACES (Control sanitario/veterinario UE)
 * - NCTS (Sistema de tránsito UE)
 * - TARIC (Arancel integrado)
 */

const logger = require('../../config/logger');

// Importar servicios de integración
const vuaService = require('./vuaService');
const tracesService = require('./tracesService');
const nctsService = require('./nctsService');

// Intentar importar AEAT service (puede estar en otra ubicación)
let aeatService;
try {
  aeatService = require('../aeat/aeatService');
} catch (e) {
  try {
    aeatService = require('../aeatService');
  } catch (e2) {
    logger.warn('AEAT Service no disponible');
  }
}

// Configuración de integraciones
const INTEGRATION_CONFIG = {
  AEAT: {
    name: 'Agencia Estatal de Administración Tributaria',
    description: 'Declaraciones aduaneras, DUAs, impuestos',
    category: 'customs',
    country: 'ES',
    required: true,
    service: aeatService
  },
  VUA: {
    name: 'Ventanilla Única Aduanera',
    description: 'Tramitación unificada multi-autoridad',
    category: 'customs',
    country: 'ES',
    required: true,
    service: vuaService
  },
  TRACES: {
    name: 'TRACES NT',
    description: 'Control sanitario, veterinario y fitosanitario UE',
    category: 'health',
    country: 'EU',
    required: false,
    service: tracesService
  },
  NCTS: {
    name: 'New Computerised Transit System',
    description: 'Sistema de tránsito informatizado UE',
    category: 'transit',
    country: 'EU',
    required: false,
    service: nctsService
  }
};

// Estados de integración
const INTEGRATION_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ERROR: 'error',
  MAINTENANCE: 'maintenance',
  SIMULATION: 'simulation'
};

class IntegrationManager {
  constructor() {
    this.integrations = INTEGRATION_CONFIG;
    this.statusCache = new Map();
    this.lastHealthCheck = null;
  }

  /**
   * Obtener todas las integraciones disponibles
   */
  getIntegrations() {
    return Object.entries(this.integrations).map(([code, config]) => ({
      code,
      name: config.name,
      description: config.description,
      category: config.category,
      country: config.country,
      required: config.required,
      available: !!config.service,
      status: this.statusCache.get(code) || INTEGRATION_STATUS.INACTIVE
    }));
  }

  /**
   * Obtener integración específica
   */
  getIntegration(code) {
    const config = this.integrations[code];
    if (!config) {
      return null;
    }

    return {
      code,
      ...config,
      service: undefined, // No exponer el servicio directamente
      available: !!config.service,
      status: this.statusCache.get(code) || INTEGRATION_STATUS.INACTIVE
    };
  }

  /**
   * Obtener servicio de integración
   */
  getService(code) {
    const config = this.integrations[code];
    return config?.service || null;
  }

  /**
   * Verificar estado de todas las integraciones
   */
  async healthCheck() {
    const results = {};

    for (const [code, config] of Object.entries(this.integrations)) {
      if (!config.service) {
        results[code] = {
          status: INTEGRATION_STATUS.INACTIVE,
          message: 'Servicio no disponible',
          timestamp: new Date().toISOString()
        };
        this.statusCache.set(code, INTEGRATION_STATUS.INACTIVE);
        continue;
      }

      try {
        const testResult = await config.service.testConnectivity();
        const status = testResult.success
          ? (testResult.simulationMode ? INTEGRATION_STATUS.SIMULATION : INTEGRATION_STATUS.ACTIVE)
          : INTEGRATION_STATUS.ERROR;

        results[code] = {
          status,
          environment: testResult.environment,
          simulationMode: testResult.simulationMode,
          message: testResult.message,
          timestamp: new Date().toISOString()
        };

        this.statusCache.set(code, status);
      } catch (error) {
        results[code] = {
          status: INTEGRATION_STATUS.ERROR,
          message: error.message,
          timestamp: new Date().toISOString()
        };
        this.statusCache.set(code, INTEGRATION_STATUS.ERROR);
      }
    }

    this.lastHealthCheck = new Date().toISOString();

    return {
      timestamp: this.lastHealthCheck,
      integrations: results,
      summary: {
        total: Object.keys(results).length,
        active: Object.values(results).filter(r => r.status === INTEGRATION_STATUS.ACTIVE).length,
        simulation: Object.values(results).filter(r => r.status === INTEGRATION_STATUS.SIMULATION).length,
        error: Object.values(results).filter(r => r.status === INTEGRATION_STATUS.ERROR).length,
        inactive: Object.values(results).filter(r => r.status === INTEGRATION_STATUS.INACTIVE).length
      }
    };
  }

  /**
   * Verificar integración específica
   */
  async checkIntegration(code) {
    const config = this.integrations[code];
    if (!config?.service) {
      return {
        code,
        status: INTEGRATION_STATUS.INACTIVE,
        message: 'Servicio no disponible'
      };
    }

    try {
      const testResult = await config.service.testConnectivity();
      const status = testResult.success
        ? (testResult.simulationMode ? INTEGRATION_STATUS.SIMULATION : INTEGRATION_STATUS.ACTIVE)
        : INTEGRATION_STATUS.ERROR;

      this.statusCache.set(code, status);

      return {
        code,
        status,
        ...testResult
      };
    } catch (error) {
      this.statusCache.set(code, INTEGRATION_STATUS.ERROR);
      return {
        code,
        status: INTEGRATION_STATUS.ERROR,
        error: error.message
      };
    }
  }

  /**
   * Obtener información de todos los servicios
   */
  async getServicesInfo() {
    const info = {};

    for (const [code, config] of Object.entries(this.integrations)) {
      if (config.service?.getInfo) {
        info[code] = {
          ...config.service.getInfo(),
          category: config.category,
          country: config.country
        };
      } else {
        info[code] = {
          service: code,
          available: false,
          category: config.category,
          country: config.country
        };
      }
    }

    return info;
  }

  /**
   * Procesar operación que requiere múltiples integraciones
   */
  async processMultiIntegrationOperation(operationData) {
    const {
      type,
      declaration,
      goods,
      operator,
      options = {}
    } = operationData;

    const results = {
      timestamp: new Date().toISOString(),
      operations: [],
      summary: {
        total: 0,
        success: 0,
        failed: 0,
        pending: 0
      }
    };

    try {
      // 1. Determinar integraciones necesarias
      const requiredIntegrations = await this._determineRequiredIntegrations(operationData);

      results.summary.total = requiredIntegrations.length;

      // 2. Ejecutar operaciones en cada integración
      for (const integration of requiredIntegrations) {
        const operationResult = await this._executeIntegrationOperation(
          integration,
          operationData
        );

        results.operations.push(operationResult);

        if (operationResult.success) {
          results.summary.success++;
        } else if (operationResult.pending) {
          results.summary.pending++;
        } else {
          results.summary.failed++;
        }
      }

      // 3. Determinar estado global
      results.globalStatus = results.summary.failed > 0
        ? 'partial_failure'
        : (results.summary.pending > 0 ? 'pending' : 'success');

      return results;
    } catch (error) {
      logger.error('IntegrationManager: Error en operación multi-integración:', error);
      throw error;
    }
  }

  /**
   * Sincronizar estado con todas las integraciones para una operación
   */
  async syncOperationStatus(operationId, operationType) {
    const syncResults = {
      operationId,
      operationType,
      timestamp: new Date().toISOString(),
      integrations: []
    };

    for (const [code, config] of Object.entries(this.integrations)) {
      if (!config.service) continue;

      try {
        // Intentar sincronizar según el tipo de operación
        let status = null;

        if (operationType === 'transit' && code === 'NCTS') {
          status = await config.service.getDeclarationStatus(operationId);
        } else if (operationType === 'sanitary' && code === 'TRACES') {
          status = await config.service.getCHEDStatus(operationId);
        } else if (operationType === 'declaration' && code === 'VUA') {
          status = await config.service.queryStatus(operationId);
        }

        if (status) {
          syncResults.integrations.push({
            code,
            name: config.name,
            ...status
          });
        }
      } catch (error) {
        syncResults.integrations.push({
          code,
          name: config.name,
          error: error.message
        });
      }
    }

    return syncResults;
  }

  /**
   * Obtener controles requeridos para una operación
   */
  async getRequiredControls(operationData) {
    const controls = {
      customs: [],
      health: [],
      transit: [],
      other: []
    };

    // Controles aduaneros (VUA)
    if (vuaService) {
      try {
        const vuaControls = await vuaService.getRequiredControls(operationData);
        if (vuaControls.success) {
          controls.customs = vuaControls.controls.filter(c => c.authority === 'AEAT');
          controls.other = vuaControls.controls.filter(c => c.authority !== 'AEAT');
        }
      } catch (error) {
        logger.error('Error obteniendo controles VUA:', error);
      }
    }

    // Controles sanitarios (TRACES)
    if (tracesService) {
      try {
        for (const item of operationData.goods || []) {
          const chedType = tracesService.determineCHEDType(item);
          if (chedType) {
            controls.health.push({
              type: chedType.type,
              name: chedType.name,
              authority: chedType.authority,
              required: true,
              taricCode: item.taricCode
            });
          }
        }
      } catch (error) {
        logger.error('Error determinando controles TRACES:', error);
      }
    }

    // Controles de tránsito (NCTS)
    if (operationData.requiresTransit && nctsService) {
      controls.transit.push({
        type: operationData.transitType || 'T1',
        service: 'NCTS',
        guaranteeRequired: true
      });
    }

    return {
      ...controls,
      summary: {
        customs: controls.customs.length,
        health: controls.health.length,
        transit: controls.transit.length,
        other: controls.other.length,
        total: controls.customs.length + controls.health.length + controls.transit.length + controls.other.length
      }
    };
  }

  /**
   * Obtener estadísticas de uso de integraciones
   */
  getUsageStats() {
    // En producción, esto leería de una base de datos
    return {
      period: 'last_30_days',
      integrations: {
        AEAT: { calls: 1250, success: 1230, errors: 20, avgResponseTime: 1.2 },
        VUA: { calls: 890, success: 875, errors: 15, avgResponseTime: 2.1 },
        TRACES: { calls: 340, success: 335, errors: 5, avgResponseTime: 3.5 },
        NCTS: { calls: 560, success: 550, errors: 10, avgResponseTime: 1.8 }
      },
      totals: {
        calls: 3040,
        success: 2990,
        errors: 50,
        successRate: 98.36
      }
    };
  }

  /**
   * Obtener configuración de ambiente
   */
  getEnvironmentConfig() {
    const config = {};

    for (const [code, integration] of Object.entries(this.integrations)) {
      if (integration.service?.getConfig) {
        config[code] = integration.service.getConfig();
      } else {
        config[code] = {
          available: false
        };
      }
    }

    return config;
  }

  /**
   * Información del gestor
   */
  getInfo() {
    return {
      service: 'Integration Manager',
      version: '1.0.0',
      totalIntegrations: Object.keys(this.integrations).length,
      availableIntegrations: Object.values(this.integrations).filter(i => !!i.service).length,
      lastHealthCheck: this.lastHealthCheck,
      description: 'Gestor centralizado de integraciones con sistemas externos'
    };
  }

  // ============================================
  // MÉTODOS PRIVADOS
  // ============================================

  /**
   * Determinar integraciones requeridas para una operación
   */
  async _determineRequiredIntegrations(operationData) {
    const required = [];

    // Siempre necesita VUA para declaraciones
    if (operationData.type === 'import' || operationData.type === 'export') {
      required.push({
        code: 'VUA',
        operation: 'submitDocument',
        priority: 1
      });
    }

    // TRACES si hay productos sanitarios/veterinarios
    const goods = operationData.goods || [];
    for (const item of goods) {
      if (tracesService) {
        const chedType = tracesService.determineCHEDType(item);
        if (chedType && !required.find(r => r.code === 'TRACES')) {
          required.push({
            code: 'TRACES',
            operation: 'createCHED',
            chedType: chedType.type,
            priority: 2
          });
        }
      }
    }

    // NCTS si es tránsito
    if (operationData.requiresTransit) {
      required.push({
        code: 'NCTS',
        operation: 'createTransitDeclaration',
        priority: 3
      });
    }

    // AEAT para declaraciones directas
    if (operationData.directAEAT) {
      required.push({
        code: 'AEAT',
        operation: 'submitDeclaration',
        priority: 1
      });
    }

    return required.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Ejecutar operación en una integración específica
   */
  async _executeIntegrationOperation(integration, operationData) {
    const service = this.getService(integration.code);
    if (!service) {
      return {
        code: integration.code,
        operation: integration.operation,
        success: false,
        error: 'Servicio no disponible'
      };
    }

    try {
      let result;

      switch (integration.operation) {
        case 'submitDocument':
          result = await service.submitDocument(this._prepareVUAData(operationData));
          break;
        case 'createCHED':
          result = await service.createCHED(this._prepareTRACESData(operationData, integration.chedType));
          break;
        case 'createTransitDeclaration':
          result = await service.createTransitDeclaration(this._prepareNCTSData(operationData));
          break;
        case 'submitDeclaration':
          result = await service.submitH1(this._prepareAEATData(operationData));
          break;
        default:
          throw new Error(`Operación no soportada: ${integration.operation}`);
      }

      return {
        code: integration.code,
        operation: integration.operation,
        success: result.success,
        reference: result.vuaReference || result.reference || result.mrn,
        status: result.status,
        message: result.message
      };
    } catch (error) {
      return {
        code: integration.code,
        operation: integration.operation,
        success: false,
        error: error.message
      };
    }
  }

  _prepareVUAData(operationData) {
    return {
      serviceType: operationData.type === 'import' ? 'DUA_IMPORT' : 'DUA_EXPORT',
      operatorNIF: operationData.operator?.nif,
      operatorName: operationData.operator?.name,
      customsOffice: operationData.customsOffice,
      content: operationData.declaration
    };
  }

  _prepareTRACESData(operationData, chedType) {
    return {
      type: chedType,
      goods: operationData.goods?.[0],
      originCountry: operationData.originCountry,
      consignee: operationData.operator,
      borderControlPost: operationData.entryPoint
    };
  }

  _prepareNCTSData(operationData) {
    return {
      transitType: operationData.transitType || 'T1',
      principal: operationData.operator,
      departureOffice: operationData.departureOffice,
      destinationOffice: operationData.destinationOffice,
      goods: operationData.goods
    };
  }

  _prepareAEATData(operationData) {
    return operationData.declaration;
  }
}

module.exports = new IntegrationManager();
