/**
 * Tests para IntegrationManager
 * Suite de tests del orquestador de integraciones (AEAT, VUA, TRACES, NCTS)
 */

// Silenciar logger
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mockear los 4 sub-servicios de integración
jest.mock('../../../src/services/integrations/vuaService', () => ({
  testConnectivity: jest.fn(),
  getInfo: jest.fn(),
  submitDocument: jest.fn(),
  queryStatus: jest.fn(),
  getRequiredControls: jest.fn()
}));

jest.mock('../../../src/services/integrations/tracesService', () => ({
  testConnectivity: jest.fn(),
  getInfo: jest.fn(),
  determineCHEDType: jest.fn(),
  createCHED: jest.fn(),
  getCHEDStatus: jest.fn()
}));

jest.mock('../../../src/services/integrations/nctsService', () => ({
  testConnectivity: jest.fn(),
  getInfo: jest.fn(),
  createTransitDeclaration: jest.fn(),
  getDeclarationStatus: jest.fn()
}));

// Mockear AMBAS rutas de aeatService (la preferida y la fallback)
jest.mock('../../../src/services/aeat/aeatService', () => ({
  testConnectivity: jest.fn(),
  submitH1: jest.fn()
}));

jest.mock('../../../src/services/aeatService', () => ({
  testConnectivity: jest.fn(),
  submitH1: jest.fn()
}));

const vuaService = require('../../../src/services/integrations/vuaService');
const tracesService = require('../../../src/services/integrations/tracesService');
const nctsService = require('../../../src/services/integrations/nctsService');
const aeatService = require('../../../src/services/aeat/aeatService');
const logger = require('../../../src/config/logger');

// Cargar integrationManager UNA vez (los mocks ya están instalados arriba)
const integrationManager = require('../../../src/services/integrations/integrationManager');

describe('IntegrationManager', () => {
  beforeEach(() => {
    // Limpiar SOLO mocks y statusCache, NO resetear módulos (el singleton ya está cargado)
    jest.clearAllMocks();

    // Limpiar estado interno del singleton
    integrationManager.statusCache.clear();
    integrationManager.lastHealthCheck = null;

    // Re-instalar implementaciones de mocks (resetMocks:true en jest.config.js los borra)
    vuaService.testConnectivity.mockResolvedValue({
      success: true,
      environment: 'simulation',
      simulationMode: true,
      message: 'Modo simulación activo',
      timestamp: new Date().toISOString()
    });

    tracesService.testConnectivity.mockResolvedValue({
      success: true,
      environment: 'simulation',
      simulationMode: true,
      message: 'Modo simulación activo',
      timestamp: new Date().toISOString()
    });

    nctsService.testConnectivity.mockResolvedValue({
      success: true,
      environment: 'simulation',
      simulationMode: true,
      message: 'Modo simulación activo',
      timestamp: new Date().toISOString()
    });

    aeatService.testConnectivity.mockResolvedValue({
      success: true,
      mode: 'simulation',
      simulationMode: true,
      message: 'Simulation mode - no connectivity test needed'
    });

    vuaService.getInfo.mockReturnValue({
      service: 'VUA Service',
      version: '1.0.0',
      environment: 'simulation',
      simulationMode: true,
      services: 10,
      authorities: 8,
      description: 'Integración con Ventanilla Única Aduanera de España'
    });

    tracesService.getInfo.mockReturnValue({
      service: 'TRACES Service',
      version: '1.0.0',
      environment: 'simulation',
      simulationMode: true,
      chedTypes: 4,
      borderControlPosts: 20,
      laboratories: 15,
      description: 'Integración con TRACES NT - Sistema de Control Sanitario UE'
    });

    nctsService.getInfo.mockReturnValue({
      service: 'NCTS Service',
      version: '5.0.0',
      environment: 'simulation',
      simulationMode: true,
      transitTypes: 5,
      guaranteeTypes: 9,
      messages: 30,
      description: 'Integración con NCTS Phase 5 - Sistema de Tránsito Informatizado UE'
    });
  });

  describe('Estructura y configuración', () => {
    test('debe ser una instancia exportada (singleton)', () => {
      expect(integrationManager).toBeDefined();
      expect(typeof integrationManager).toBe('object');
      expect(integrationManager.integrations).toBeDefined();
    });

    test('debe tener las 4 integraciones configuradas', () => {
      expect(integrationManager.integrations).toHaveProperty('AEAT');
      expect(integrationManager.integrations).toHaveProperty('VUA');
      expect(integrationManager.integrations).toHaveProperty('TRACES');
      expect(integrationManager.integrations).toHaveProperty('NCTS');
    });

    test('debe tener statusCache y lastHealthCheck inicializados', () => {
      expect(integrationManager.statusCache).toBeInstanceOf(Map);
      expect(integrationManager.lastHealthCheck).toBeNull();
    });
  });

  describe('getIntegrations', () => {
    test('debe retornar array con las 4 integraciones', () => {
      const integrations = integrationManager.getIntegrations();

      expect(Array.isArray(integrations)).toBe(true);
      expect(integrations).toHaveLength(4);

      const codes = integrations.map(i => i.code);
      expect(codes).toContain('AEAT');
      expect(codes).toContain('VUA');
      expect(codes).toContain('TRACES');
      expect(codes).toContain('NCTS');
    });

    test('debe incluir available:true para integraciones con servicio', () => {
      const integrations = integrationManager.getIntegrations();
      const vua = integrations.find(i => i.code === 'VUA');

      expect(vua).toBeDefined();
      expect(vua.available).toBe(true);
      expect(vua).toHaveProperty('name');
      expect(vua).toHaveProperty('description');
      expect(vua).toHaveProperty('category');
      expect(vua).toHaveProperty('country');
      expect(vua).toHaveProperty('required');
    });

    test('debe incluir status del cache si existe', () => {
      // Poblar cache manualmente
      integrationManager.statusCache.set('VUA', 'active');

      const integrations = integrationManager.getIntegrations();
      const vua = integrations.find(i => i.code === 'VUA');

      expect(vua.status).toBe('active');
    });

    test('debe incluir status inactive si no hay cache', () => {
      const integrations = integrationManager.getIntegrations();
      const aeat = integrations.find(i => i.code === 'AEAT');

      expect(aeat.status).toBe('inactive');
    });
  });

  describe('getIntegration', () => {
    test('debe retornar null si el código no existe', () => {
      const result = integrationManager.getIntegration('INEXISTENTE');
      expect(result).toBeNull();
    });

    test('debe retornar integración válida con code existente', () => {
      const result = integrationManager.getIntegration('VUA');

      expect(result).toBeDefined();
      expect(result.code).toBe('VUA');
      expect(result.name).toBe('Ventanilla Única Aduanera');
      expect(result.available).toBe(true);
      expect(result.service).toBeUndefined(); // no expone el servicio (está en undefined)
    });

    test('debe incluir status del cache si existe', () => {
      integrationManager.statusCache.set('TRACES', 'simulation');

      const result = integrationManager.getIntegration('TRACES');
      expect(result.status).toBe('simulation');
    });
  });

  describe('getService', () => {
    test('debe retornar null si el código no existe', () => {
      const service = integrationManager.getService('INEXISTENTE');
      expect(service).toBeNull();
    });

    test('debe retornar el servicio si existe', () => {
      const service = integrationManager.getService('VUA');
      expect(service).toBe(vuaService);
    });

    test('debe retornar null si el código existe pero no tiene servicio', () => {
      // Simular integración sin servicio
      const original = integrationManager.integrations.AEAT.service;
      integrationManager.integrations.AEAT.service = null;

      const service = integrationManager.getService('AEAT');
      expect(service).toBeNull();

      // Restaurar
      integrationManager.integrations.AEAT.service = original;
    });
  });

  describe('healthCheck', () => {
    test('debe ejecutar testConnectivity de todos los servicios disponibles', async () => {
      const result = await integrationManager.healthCheck();

      expect(vuaService.testConnectivity).toHaveBeenCalled();
      expect(tracesService.testConnectivity).toHaveBeenCalled();
      expect(nctsService.testConnectivity).toHaveBeenCalled();
      expect(aeatService.testConnectivity).toHaveBeenCalled();
    });

    test('debe retornar summary con total, active, simulation, error, inactive', async () => {
      const result = await integrationManager.healthCheck();

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('integrations');
      expect(result).toHaveProperty('summary');

      expect(result.summary).toHaveProperty('total');
      expect(result.summary).toHaveProperty('active');
      expect(result.summary).toHaveProperty('simulation');
      expect(result.summary).toHaveProperty('error');
      expect(result.summary).toHaveProperty('inactive');

      expect(result.summary.total).toBe(4);
    });

    test('debe marcar integración como SIMULATION si testConnectivity success+simulationMode', async () => {
      vuaService.testConnectivity.mockResolvedValueOnce({
        success: true,
        simulationMode: true,
        environment: 'simulation',
        message: 'Modo simulación activo'
      });

      const result = await integrationManager.healthCheck();

      expect(result.integrations.VUA.status).toBe('simulation');
      expect(result.summary.simulation).toBeGreaterThan(0);
    });

    test('debe marcar integración como ACTIVE si testConnectivity success sin simulationMode', async () => {
      vuaService.testConnectivity.mockResolvedValueOnce({
        success: true,
        simulationMode: false,
        environment: 'production',
        message: 'Conectado'
      });

      const result = await integrationManager.healthCheck();

      expect(result.integrations.VUA.status).toBe('active');
      expect(result.summary.active).toBeGreaterThan(0);
    });

    test('debe marcar integración como ERROR si testConnectivity success:false', async () => {
      vuaService.testConnectivity.mockResolvedValueOnce({
        success: false,
        environment: 'production',
        message: 'Conexión fallida'
      });

      const result = await integrationManager.healthCheck();

      expect(result.integrations.VUA.status).toBe('error');
      expect(result.summary.error).toBeGreaterThan(0);
    });

    test('debe marcar integración como ERROR si testConnectivity lanza excepción', async () => {
      vuaService.testConnectivity.mockRejectedValueOnce(new Error('Network error'));

      const result = await integrationManager.healthCheck();

      expect(result.integrations.VUA.status).toBe('error');
      expect(result.integrations.VUA.message).toBe('Network error');
      expect(result.summary.error).toBeGreaterThan(0);
    });

    test('debe marcar integración como INACTIVE si no tiene servicio', async () => {
      // Simular integración sin servicio
      const original = integrationManager.integrations.AEAT.service;
      integrationManager.integrations.AEAT.service = null;

      const result = await integrationManager.healthCheck();

      expect(result.integrations.AEAT.status).toBe('inactive');
      expect(result.integrations.AEAT.message).toBe('Servicio no disponible');
      expect(result.summary.inactive).toBeGreaterThan(0);

      // Restaurar
      integrationManager.integrations.AEAT.service = original;
    });

    test('debe actualizar statusCache con los resultados', async () => {
      await integrationManager.healthCheck();

      expect(integrationManager.statusCache.get('VUA')).toBe('simulation');
      expect(integrationManager.statusCache.get('TRACES')).toBe('simulation');
      expect(integrationManager.statusCache.get('NCTS')).toBe('simulation');
      expect(integrationManager.statusCache.get('AEAT')).toBe('simulation');
    });

    test('debe actualizar lastHealthCheck con timestamp', async () => {
      expect(integrationManager.lastHealthCheck).toBeNull();

      const result = await integrationManager.healthCheck();

      expect(integrationManager.lastHealthCheck).not.toBeNull();
      expect(result.timestamp).toBe(integrationManager.lastHealthCheck);
    });
  });

  describe('checkIntegration', () => {
    test('debe retornar inactive si no tiene servicio', async () => {
      const original = integrationManager.integrations.AEAT.service;
      integrationManager.integrations.AEAT.service = null;

      const result = await integrationManager.checkIntegration('AEAT');

      expect(result.code).toBe('AEAT');
      expect(result.status).toBe('inactive');
      expect(result.message).toBe('Servicio no disponible');

      integrationManager.integrations.AEAT.service = original;
    });

    test('debe invocar testConnectivity del servicio correspondiente', async () => {
      await integrationManager.checkIntegration('VUA');
      expect(vuaService.testConnectivity).toHaveBeenCalled();
    });

    test('debe retornar SIMULATION si testConnectivity success+simulationMode', async () => {
      vuaService.testConnectivity.mockResolvedValueOnce({
        success: true,
        simulationMode: true,
        environment: 'simulation',
        message: 'Modo simulación activo'
      });

      const result = await integrationManager.checkIntegration('VUA');

      expect(result.status).toBe('simulation');
      expect(result.simulationMode).toBe(true);
    });

    test('debe retornar ACTIVE si testConnectivity success sin simulationMode', async () => {
      vuaService.testConnectivity.mockResolvedValueOnce({
        success: true,
        simulationMode: false,
        environment: 'production'
      });

      const result = await integrationManager.checkIntegration('VUA');

      expect(result.status).toBe('active');
    });

    test('debe retornar ERROR si testConnectivity lanza excepción', async () => {
      vuaService.testConnectivity.mockRejectedValueOnce(new Error('Timeout'));

      const result = await integrationManager.checkIntegration('VUA');

      expect(result.status).toBe('error');
      expect(result.error).toBe('Timeout');
    });

    test('debe actualizar statusCache', async () => {
      vuaService.testConnectivity.mockResolvedValueOnce({
        success: true,
        simulationMode: false
      });

      await integrationManager.checkIntegration('VUA');

      expect(integrationManager.statusCache.get('VUA')).toBe('active');
    });
  });

  describe('getServicesInfo', () => {
    test('debe retornar info de todos los servicios', async () => {
      const info = await integrationManager.getServicesInfo();

      expect(info).toHaveProperty('AEAT');
      expect(info).toHaveProperty('VUA');
      expect(info).toHaveProperty('TRACES');
      expect(info).toHaveProperty('NCTS');
    });

    test('debe invocar getInfo() del servicio si existe', async () => {
      const info = await integrationManager.getServicesInfo();

      expect(vuaService.getInfo).toHaveBeenCalled();
      expect(tracesService.getInfo).toHaveBeenCalled();
      expect(nctsService.getInfo).toHaveBeenCalled();

      expect(info.VUA.service).toBe('VUA Service');
      expect(info.TRACES.service).toBe('TRACES Service');
      expect(info.NCTS.service).toBe('NCTS Service');
    });

    test('debe retornar available:false si el servicio no tiene getInfo', async () => {
      // aeatService no tiene getInfo (confirmado en lectura del código)
      const info = await integrationManager.getServicesInfo();

      expect(info.AEAT.available).toBe(false);
      expect(info.AEAT.category).toBe('customs');
      expect(info.AEAT.country).toBe('ES');
    });

    test('debe incluir category y country del config', async () => {
      const info = await integrationManager.getServicesInfo();

      expect(info.VUA.category).toBe('customs');
      expect(info.VUA.country).toBe('ES');

      expect(info.TRACES.category).toBe('health');
      expect(info.TRACES.country).toBe('EU');

      expect(info.NCTS.category).toBe('transit');
      expect(info.NCTS.country).toBe('EU');
    });
  });

  describe('processMultiIntegrationOperation', () => {
    test('debe determinar integraciones requeridas para import', async () => {
      vuaService.submitDocument.mockResolvedValueOnce({
        success: true,
        vuaReference: 'VUA-2024-001',
        status: 'SUBMITTED'
      });

      const operationData = {
        type: 'import',
        declaration: { mrn: 'TEST123' },
        goods: [],
        operator: { nif: 'B12345678' }
      };

      const result = await integrationManager.processMultiIntegrationOperation(operationData);

      expect(result.summary.total).toBeGreaterThan(0);
      expect(result.operations).toBeDefined();
      expect(Array.isArray(result.operations)).toBe(true);
    });

    test('debe determinar integraciones requeridas para export', async () => {
      vuaService.submitDocument.mockResolvedValueOnce({
        success: true,
        vuaReference: 'VUA-2024-002',
        status: 'SUBMITTED'
      });

      const operationData = {
        type: 'export',
        declaration: { mrn: 'TEST456' },
        goods: [],
        operator: { nif: 'B12345678' }
      };

      const result = await integrationManager.processMultiIntegrationOperation(operationData);

      expect(result.summary.total).toBeGreaterThan(0);
      expect(result.operations.some(op => op.code === 'VUA')).toBe(true);
    });

    test('debe incluir TRACES si hay productos con determineCHEDType', async () => {
      tracesService.determineCHEDType.mockReturnValueOnce({
        type: 'CHED_P',
        code: 'CHED-P',
        name: 'CHED for Products'
      });

      tracesService.createCHED.mockResolvedValueOnce({
        success: true,
        reference: 'CHED-P-2024-001',
        status: 'DRAFT'
      });

      vuaService.submitDocument.mockResolvedValueOnce({
        success: true,
        vuaReference: 'VUA-2024-003',
        status: 'SUBMITTED'
      });

      const operationData = {
        type: 'import',
        declaration: { mrn: 'TEST789' },
        goods: [{ taricCode: '0203291500', description: 'Carne de cerdo' }],
        operator: { nif: 'B12345678' }
      };

      const result = await integrationManager.processMultiIntegrationOperation(operationData);

      expect(tracesService.determineCHEDType).toHaveBeenCalledWith({ taricCode: '0203291500', description: 'Carne de cerdo' });
      expect(result.operations.some(op => op.code === 'TRACES')).toBe(true);
    });

    test('debe incluir NCTS si requiresTransit es true', async () => {
      nctsService.createTransitDeclaration.mockResolvedValueOnce({
        success: true,
        lrn: 'LRN-001',
        mrn: '24ES123456789',
        status: 'SUBMITTED'
      });

      vuaService.submitDocument.mockResolvedValueOnce({
        success: true,
        vuaReference: 'VUA-2024-004',
        status: 'SUBMITTED'
      });

      const operationData = {
        type: 'import',
        declaration: { mrn: 'TEST999' },
        goods: [],
        operator: { nif: 'B12345678' },
        requiresTransit: true
      };

      const result = await integrationManager.processMultiIntegrationOperation(operationData);

      expect(result.operations.some(op => op.code === 'NCTS')).toBe(true);
    });

    test('debe incluir AEAT si directAEAT es true', async () => {
      aeatService.submitH1.mockResolvedValueOnce({
        success: true,
        mrn: '24ES987654321',
        status: 'ACCEPTED'
      });

      const operationData = {
        type: 'import',
        declaration: { xml: '<H1>...</H1>' },
        goods: [],
        operator: { nif: 'B12345678' },
        directAEAT: true
      };

      const result = await integrationManager.processMultiIntegrationOperation(operationData);

      expect(result.operations.some(op => op.code === 'AEAT')).toBe(true);
    });

    test('debe contar success/failed/pending correctamente', async () => {
      vuaService.submitDocument.mockResolvedValueOnce({
        success: true,
        vuaReference: 'VUA-2024-005',
        status: 'SUBMITTED'
      });

      tracesService.determineCHEDType.mockReturnValueOnce({
        type: 'CHED_P',
        code: 'CHED-P'
      });

      tracesService.createCHED.mockResolvedValueOnce({
        success: false,
        error: 'Datos incompletos'
      });

      const operationData = {
        type: 'import',
        declaration: { mrn: 'TEST111' },
        goods: [{ taricCode: '0203291500' }],
        operator: { nif: 'B12345678' }
      };

      const result = await integrationManager.processMultiIntegrationOperation(operationData);

      expect(result.summary.success).toBeGreaterThanOrEqual(1); // VUA OK
      expect(result.summary.failed).toBeGreaterThanOrEqual(1); // TRACES FAIL
    });

    test('debe retornar globalStatus partial_failure si alguna falla', async () => {
      vuaService.submitDocument.mockResolvedValueOnce({
        success: true,
        vuaReference: 'VUA-2024-006',
        status: 'SUBMITTED'
      });

      tracesService.determineCHEDType.mockReturnValueOnce({
        type: 'CHED_P',
        code: 'CHED-P'
      });

      tracesService.createCHED.mockResolvedValueOnce({
        success: false,
        error: 'Certificado sanitario no válido'
      });

      const operationData = {
        type: 'import',
        declaration: { mrn: 'TEST222' },
        goods: [{ taricCode: '0203291500' }],
        operator: { nif: 'B12345678' }
      };

      const result = await integrationManager.processMultiIntegrationOperation(operationData);

      expect(result.globalStatus).toBe('partial_failure');
    });

    test('debe retornar globalStatus success si todas tienen éxito', async () => {
      vuaService.submitDocument.mockResolvedValueOnce({
        success: true,
        vuaReference: 'VUA-2024-007',
        status: 'SUBMITTED'
      });

      const operationData = {
        type: 'import',
        declaration: { mrn: 'TEST333' },
        goods: [],
        operator: { nif: 'B12345678' }
      };

      const result = await integrationManager.processMultiIntegrationOperation(operationData);

      expect(result.globalStatus).toBe('success');
    });

    test('debe retornar timestamp en el resultado', async () => {
      vuaService.submitDocument.mockResolvedValueOnce({
        success: true,
        vuaReference: 'VUA-2024-008',
        status: 'SUBMITTED'
      });

      const operationData = {
        type: 'import',
        declaration: { mrn: 'TEST444' },
        goods: [],
        operator: { nif: 'B12345678' }
      };

      const result = await integrationManager.processMultiIntegrationOperation(operationData);

      expect(result).toHaveProperty('timestamp');
      expect(typeof result.timestamp).toBe('string');
    });

    test('debe capturar error fatal del servicio y retornarlo como operation failed', async () => {
      vuaService.submitDocument.mockRejectedValueOnce(new Error('Fatal service error'));

      const operationData = {
        type: 'import',
        declaration: { mrn: 'TEST555' },
        goods: [],
        operator: { nif: 'B12345678' }
      };

      const result = await integrationManager.processMultiIntegrationOperation(operationData);

      expect(result.globalStatus).toBe('partial_failure');
      expect(result.summary.failed).toBe(1);
      const vuaOp = result.operations.find(op => op.code === 'VUA');
      expect(vuaOp.success).toBe(false);
      expect(vuaOp.error).toBe('Fatal service error');
    });
  });

  describe('syncOperationStatus', () => {
    test('debe retornar estructura con operationId, operationType, timestamp, integrations', async () => {
      const result = await integrationManager.syncOperationStatus('OP-001', 'declaration');

      expect(result).toHaveProperty('operationId', 'OP-001');
      expect(result).toHaveProperty('operationType', 'declaration');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('integrations');
      expect(Array.isArray(result.integrations)).toBe(true);
    });

    test('debe saltar integraciones sin servicio', async () => {
      const original = integrationManager.integrations.AEAT.service;
      integrationManager.integrations.AEAT.service = null;

      const result = await integrationManager.syncOperationStatus('OP-002', 'transit');

      // No debe tener AEAT en los resultados
      expect(result.integrations.some(i => i.code === 'AEAT')).toBe(false);

      integrationManager.integrations.AEAT.service = original;
    });

    test('debe invocar getDeclarationStatus para operationType transit en NCTS', async () => {
      nctsService.getDeclarationStatus.mockResolvedValueOnce({
        success: true,
        mrn: '24ES123456789',
        status: '011',
        statusName: 'En tránsito'
      });

      const result = await integrationManager.syncOperationStatus('24ES123456789', 'transit');

      expect(nctsService.getDeclarationStatus).toHaveBeenCalledWith('24ES123456789');
      const nctsResult = result.integrations.find(i => i.code === 'NCTS');
      expect(nctsResult).toBeDefined();
      expect(nctsResult.status).toBe('011');
    });

    test('debe invocar getCHEDStatus para operationType sanitary en TRACES', async () => {
      tracesService.getCHEDStatus.mockResolvedValueOnce({
        success: true,
        reference: 'CHED-P-2024-001',
        status: 'SUBMITTED',
        statusName: 'Enviado'
      });

      const result = await integrationManager.syncOperationStatus('CHED-P-2024-001', 'sanitary');

      expect(tracesService.getCHEDStatus).toHaveBeenCalledWith('CHED-P-2024-001');
      const tracesResult = result.integrations.find(i => i.code === 'TRACES');
      expect(tracesResult).toBeDefined();
      expect(tracesResult.status).toBe('SUBMITTED');
    });

    test('debe invocar queryStatus para operationType declaration en VUA', async () => {
      vuaService.queryStatus.mockResolvedValueOnce({
        success: true,
        vuaReference: 'VUA-2024-009',
        status: 'VALI',
        statusName: 'En validación'
      });

      const result = await integrationManager.syncOperationStatus('VUA-2024-009', 'declaration');

      expect(vuaService.queryStatus).toHaveBeenCalledWith('VUA-2024-009');
      const vuaResult = result.integrations.find(i => i.code === 'VUA');
      expect(vuaResult).toBeDefined();
      expect(vuaResult.status).toBe('VALI');
    });

    test('debe capturar errores de servicios individuales', async () => {
      vuaService.queryStatus.mockRejectedValueOnce(new Error('Connection timeout'));

      const result = await integrationManager.syncOperationStatus('VUA-2024-010', 'declaration');

      const vuaResult = result.integrations.find(i => i.code === 'VUA');
      expect(vuaResult).toBeDefined();
      expect(vuaResult.error).toBe('Connection timeout');
    });

    test('debe incluir name del servicio en los resultados', async () => {
      nctsService.getDeclarationStatus.mockResolvedValueOnce({
        success: true,
        mrn: '24ES111111111',
        status: '003'
      });

      const result = await integrationManager.syncOperationStatus('24ES111111111', 'transit');

      const nctsResult = result.integrations.find(i => i.code === 'NCTS');
      expect(nctsResult.name).toBe('New Computerised Transit System');
    });
  });

  describe('getRequiredControls', () => {
    test('debe agregar controles customs de VUA si tiene servicio', async () => {
      vuaService.getRequiredControls.mockResolvedValueOnce({
        success: true,
        controls: [
          { authority: 'AEAT', controlType: 'DUA', required: true },
          { authority: 'SOIVRE', controlType: 'SOIVRE', required: false }
        ]
      });

      const operationData = {
        goods: [{ taricCode: '6203291500' }]
      };

      const result = await integrationManager.getRequiredControls(operationData);

      expect(result.customs).toHaveLength(1); // AEAT
      expect(result.other).toHaveLength(1); // SOIVRE
    });

    test('debe manejar error en getRequiredControls de VUA', async () => {
      vuaService.getRequiredControls.mockRejectedValueOnce(new Error('VUA error'));

      const operationData = {
        goods: [{ taricCode: '8517120000' }]
      };

      const result = await integrationManager.getRequiredControls(operationData);

      expect(logger.error).toHaveBeenCalledWith('Error obteniendo controles VUA:', expect.any(Error));
      expect(result.customs).toHaveLength(0);
    });

    test('debe agregar controles health si determineCHEDType retorna tipo', async () => {
      tracesService.determineCHEDType.mockReturnValueOnce({
        type: 'CHED_P',
        name: 'CHED for Products',
        authority: 'Veterinary'
      });

      const operationData = {
        goods: [{ taricCode: '0203291500' }]
      };

      const result = await integrationManager.getRequiredControls(operationData);

      expect(result.health).toHaveLength(1);
      expect(result.health[0].type).toBe('CHED_P');
      expect(result.health[0].authority).toBe('Veterinary');
    });

    test('debe agregar controles transit si requiresTransit', async () => {
      const operationData = {
        goods: [{ taricCode: '8517120000' }],
        requiresTransit: true
      };

      const result = await integrationManager.getRequiredControls(operationData);

      expect(result.transit).toHaveLength(1);
      expect(result.transit[0].service).toBe('NCTS');
      expect(result.transit[0].guaranteeRequired).toBe(true);
    });

    test('debe incluir summary con conteos', async () => {
      vuaService.getRequiredControls.mockResolvedValueOnce({
        success: true,
        controls: [
          { authority: 'AEAT', controlType: 'DUA', required: true }
        ]
      });

      tracesService.determineCHEDType.mockReturnValueOnce({
        type: 'CHED_P',
        name: 'CHED for Products',
        authority: 'Veterinary'
      });

      const operationData = {
        goods: [{ taricCode: '0203291500' }],
        requiresTransit: true
      };

      const result = await integrationManager.getRequiredControls(operationData);

      expect(result.summary).toBeDefined();
      expect(result.summary.customs).toBe(1);
      expect(result.summary.health).toBe(1);
      expect(result.summary.transit).toBe(1);
      expect(result.summary.total).toBe(3);
    });

    test('debe manejar operationData.goods vacío', async () => {
      const operationData = {
        goods: []
      };

      const result = await integrationManager.getRequiredControls(operationData);

      expect(result.health).toHaveLength(0);
      expect(result.summary.total).toBe(0);
    });
  });

  describe('getUsageStats', () => {
    test('debe retornar estadísticas simuladas de uso', () => {
      const stats = integrationManager.getUsageStats();

      expect(stats).toHaveProperty('period', 'last_30_days');
      expect(stats).toHaveProperty('integrations');
      expect(stats).toHaveProperty('totals');

      expect(stats.integrations).toHaveProperty('AEAT');
      expect(stats.integrations).toHaveProperty('VUA');
      expect(stats.integrations).toHaveProperty('TRACES');
      expect(stats.integrations).toHaveProperty('NCTS');

      expect(stats.totals.calls).toBeGreaterThan(0);
      expect(stats.totals.successRate).toBeGreaterThan(0);
    });
  });

  describe('getEnvironmentConfig', () => {
    test('debe retornar config de servicios con getConfig', () => {
      // Simular que algunos servicios tienen getConfig
      vuaService.getConfig = jest.fn().mockReturnValue({
        environment: 'simulation',
        baseUrl: 'https://vua-test.local'
      });

      const config = integrationManager.getEnvironmentConfig();

      expect(config).toHaveProperty('AEAT');
      expect(config).toHaveProperty('VUA');

      expect(config.VUA.environment).toBe('simulation');
    });

    test('debe retornar available:false si no tiene getConfig', () => {
      const config = integrationManager.getEnvironmentConfig();

      expect(config.AEAT.available).toBe(false);
    });
  });

  describe('getInfo', () => {
    test('debe retornar información del manager', () => {
      const info = integrationManager.getInfo();

      expect(info).toHaveProperty('service', 'Integration Manager');
      expect(info).toHaveProperty('version', '1.0.0');
      expect(info).toHaveProperty('totalIntegrations', 4);
      expect(info).toHaveProperty('availableIntegrations');
      expect(info).toHaveProperty('lastHealthCheck');
      expect(info).toHaveProperty('description');
    });

    test('debe reflejar lastHealthCheck actualizado después de healthCheck', async () => {
      expect(integrationManager.getInfo().lastHealthCheck).toBeNull();

      await integrationManager.healthCheck();

      expect(integrationManager.getInfo().lastHealthCheck).not.toBeNull();
    });
  });

  describe('Métodos privados expuestos indirectamente', () => {
    test('_determineRequiredIntegrations debe identificar VUA para import/export', async () => {
      vuaService.submitDocument.mockResolvedValueOnce({
        success: true,
        vuaReference: 'VUA-2024-011',
        status: 'SUBMITTED'
      });

      const operationData = {
        type: 'import',
        declaration: { mrn: 'TEST666' },
        goods: [],
        operator: { nif: 'B12345678' }
      };

      const result = await integrationManager.processMultiIntegrationOperation(operationData);

      expect(result.operations.some(op => op.code === 'VUA')).toBe(true);
    });

    test('_determinePUEControls debe agregar PUE para códigos TARIC específicos', async () => {
      vuaService.submitDocument.mockResolvedValueOnce({
        success: true,
        vuaReference: 'VUA-2024-012',
        status: 'SUBMITTED'
      });

      // TARIC 8471 (informática) dispara PUE ROHS
      const operationData = {
        type: 'import',
        declaration: { mrn: 'TEST777' },
        goods: [{ taricCode: '8471300000', description: 'Ordenador portátil' }],
        operator: { nif: 'B12345678' }
      };

      const result = await integrationManager.processMultiIntegrationOperation(operationData);

      // Debe haber agregado una operación submitPUERequest en VUA
      const pueOp = result.operations.find(op => op.operation === 'submitPUERequest');
      expect(pueOp).toBeDefined();
    });

    test('_executeIntegrationOperation debe retornar success:false si servicio no disponible', async () => {
      const original = integrationManager.integrations.AEAT.service;
      integrationManager.integrations.AEAT.service = null;

      const operationData = {
        type: 'import',
        declaration: { xml: '<H1>...</H1>' },
        goods: [],
        operator: { nif: 'B12345678' },
        directAEAT: true
      };

      const result = await integrationManager.processMultiIntegrationOperation(operationData);

      const aeatOp = result.operations.find(op => op.code === 'AEAT');
      expect(aeatOp.success).toBe(false);
      expect(aeatOp.error).toBe('Servicio no disponible');

      integrationManager.integrations.AEAT.service = original;
    });

    test('debe contar operación como pending si operationResult.pending es true', async () => {
      vuaService.submitDocument.mockResolvedValueOnce({
        success: false,
        pending: true,
        vuaReference: 'VUA-2024-013',
        status: 'PENDING_VALIDATION'
      });

      const operationData = {
        type: 'import',
        declaration: { mrn: 'TEST888' },
        goods: [],
        operator: { nif: 'B12345678' }
      };

      const result = await integrationManager.processMultiIntegrationOperation(operationData);

      expect(result.summary.pending).toBe(1);
      expect(result.globalStatus).toBe('pending');
    });

    test('debe capturar error en determineCHEDType de TRACES', async () => {
      tracesService.determineCHEDType.mockImplementationOnce(() => {
        throw new Error('Invalid TARIC code');
      });

      const operationData = {
        goods: [{ taricCode: 'INVALID' }]
      };

      const result = await integrationManager.getRequiredControls(operationData);

      expect(logger.error).toHaveBeenCalledWith('Error determinando controles TRACES:', expect.any(Error));
      expect(result.health).toHaveLength(0);
    });
  });
});
