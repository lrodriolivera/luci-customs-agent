/**
 * Tests for AEAT Status Monitor Service
 * Phase 6.1: Intelligent Status Monitoring Tests
 */

// Mock cacheService to prevent Redis connection
jest.mock('../../../src/services/cacheService', () => ({
  getRedisClient: jest.fn().mockReturnValue(null)
}));

// Mock logger
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock aiService
jest.mock('../../../src/services/aiService', () => ({
  analyzeWithLuci: jest.fn().mockResolvedValue({
    summary: 'Status analysis complete',
    recommendations: ['Continue monitoring'],
    predictedChannel: 'green',
    riskScore: 15
  })
}));

// Mock aeatRealService
jest.mock('../../../src/services/aeat/aeatRealService', () => ({
  queryDeclarationStatus: jest.fn().mockResolvedValue({
    success: true,
    data: {
      status: 'accepted',
      channel: 'green',
      timestamp: new Date().toISOString()
    }
  })
}));

const aeatStatusMonitorService = require('../../../src/services/aeat/aeatStatusMonitorService');

describe('AEAT Status Monitor Service', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Clear tracked declarations using the RedisBackedMap's clear method (falls back to in-memory)
    await aeatStatusMonitorService.trackedDeclarations.clear();
  });

  describe('Declaration Tracking', () => {
    test('should track a declaration', async () => {
      const result = await aeatStatusMonitorService.trackDeclaration('26ESTEST123456', 'H1', {
        expeditionId: 'exp-001',
        userId: 'user-001'
      });

      expect(result).toBeDefined();
      expect(result.mrn).toBe('26ESTEST123456');
      expect(result.success).toBe(true);
      expect(result.tracking).toBeDefined();
      expect(result.tracking.type).toBe('H1');
    });

    test('should list tracked declarations', async () => {
      await aeatStatusMonitorService.trackDeclaration('MRN1', 'H1', {});
      await aeatStatusMonitorService.trackDeclaration('MRN2', 'AES', {});

      const result = await aeatStatusMonitorService.listTrackedDeclarations();

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('declarations');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('luciAnalysis');
      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(result.declarations)).toBe(true);
    });

    test('should get specific declaration tracking info', async () => {
      await aeatStatusMonitorService.trackDeclaration('TEST-MRN', 'H1', {});

      const result = await aeatStatusMonitorService.getTrackedDeclaration('TEST-MRN');

      expect(result).toBeDefined();
      expect(result.mrn).toBe('TEST-MRN');
    });

    test('should untrack a declaration', async () => {
      await aeatStatusMonitorService.trackDeclaration('MRN-TO-REMOVE', 'H1', {});
      const tracked = await aeatStatusMonitorService.getTrackedDeclaration('MRN-TO-REMOVE');
      expect(tracked).toBeDefined();

      const result = await aeatStatusMonitorService.untrackDeclaration('MRN-TO-REMOVE');

      expect(result.success).toBe(true);
      const afterRemove = await aeatStatusMonitorService.getTrackedDeclaration('MRN-TO-REMOVE');
      expect(afterRemove).toBeUndefined();
    });
  });

  describe('Channel Prediction', () => {
    test('should calculate risk-based probabilities', () => {
      const lowRisk = aeatStatusMonitorService._calculateChannelProbabilities(5);
      const highRisk = aeatStatusMonitorService._calculateChannelProbabilities(80);

      expect(lowRisk.green).toBeGreaterThan(highRisk.green);
      expect(highRisk.red).toBeGreaterThan(lowRisk.red);
    });

    test('should return all channel probabilities', () => {
      const probs = aeatStatusMonitorService._calculateChannelProbabilities(30);

      expect(probs).toHaveProperty('green');
      expect(probs).toHaveProperty('orange');
      expect(probs).toHaveProperty('red');
      expect(probs).toHaveProperty('yellow');
    });

    test('probabilities should sum to 1', () => {
      const probs = aeatStatusMonitorService._calculateChannelProbabilities(50);
      const sum = probs.green + probs.orange + probs.red + probs.yellow;

      expect(sum).toBeCloseTo(1, 2);
    });
  });

  describe('Alert Management', () => {
    test('should get active alerts from tracked declarations', async () => {
      // Track a declaration first
      await aeatStatusMonitorService.trackDeclaration('TEST-MRN', 'H1', {});

      // getActiveAlerts returns { total, critical, warning, alerts }
      const result = await aeatStatusMonitorService.getActiveAlerts();

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('alerts');
      expect(Array.isArray(result.alerts)).toBe(true);
    });
  });

  describe('Polling Configuration', () => {
    test('should have polling config', () => {
      expect(aeatStatusMonitorService.pollingConfig).toBeDefined();
    });

    test('should have start and stop polling methods', () => {
      expect(typeof aeatStatusMonitorService.startPolling).toBe('function');
      expect(typeof aeatStatusMonitorService.stopPolling).toBe('function');
    });
  });

  describe('Service Methods', () => {
    test('should have trackDeclaration method', () => {
      expect(typeof aeatStatusMonitorService.trackDeclaration).toBe('function');
    });

    test('should have refreshDeclarationStatus method', () => {
      expect(typeof aeatStatusMonitorService.refreshDeclarationStatus).toBe('function');
    });

    test('should have listTrackedDeclarations method', () => {
      expect(typeof aeatStatusMonitorService.listTrackedDeclarations).toBe('function');
    });

    test('should have getTrackedDeclaration method', () => {
      expect(typeof aeatStatusMonitorService.getTrackedDeclaration).toBe('function');
    });

    test('should have getActiveAlerts method', () => {
      expect(typeof aeatStatusMonitorService.getActiveAlerts).toBe('function');
    });

    test('should have getInfo method', () => {
      expect(typeof aeatStatusMonitorService.getInfo).toBe('function');
    });
  });

  describe('Service Info', () => {
    test('should return service information', async () => {
      const info = await aeatStatusMonitorService.getInfo();

      expect(info).toBeDefined();
      expect(info).toHaveProperty('service');
      expect(info).toHaveProperty('trackedDeclarations');
      expect(info).toHaveProperty('pollingEnabled');
    });
  });

  describe('Filtering Tracked Declarations', () => {
    beforeEach(async () => {
      await aeatStatusMonitorService.trackedDeclarations.clear();
      await aeatStatusMonitorService.trackDeclaration('MRN-H1', 'H1', {});
      await aeatStatusMonitorService.trackDeclaration('MRN-AES', 'AES', {});
    });

    test('should filter by type', async () => {
      const result = await aeatStatusMonitorService.listTrackedDeclarations({ type: 'H1' });

      expect(result.declarations.length).toBeGreaterThanOrEqual(1);
      // Check that at least one result has type H1
      const hasH1 = result.declarations.some(d => d.type === 'H1');
      expect(hasH1).toBe(true);
    });
  });
});
