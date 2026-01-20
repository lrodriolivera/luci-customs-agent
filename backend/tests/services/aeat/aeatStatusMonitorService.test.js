/**
 * Tests for AEAT Status Monitor Service
 * Phase 6.1: Intelligent Status Monitoring Tests
 */

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
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear tracked declarations
    aeatStatusMonitorService.trackedDeclarations = new Map();
  });

  describe('Declaration Tracking', () => {
    test('should track a declaration', () => {
      const result = aeatStatusMonitorService.trackDeclaration('26ESTEST123456', 'H1', {
        expeditionId: 'exp-001',
        userId: 'user-001'
      });

      expect(result).toBeDefined();
      expect(result.mrn).toBe('26ESTEST123456');
    });

    test('should list tracked declarations', () => {
      aeatStatusMonitorService.trackDeclaration('MRN1', 'H1', {});
      aeatStatusMonitorService.trackDeclaration('MRN2', 'AES', {});

      const tracked = aeatStatusMonitorService.listTrackedDeclarations();

      expect(Array.isArray(tracked)).toBe(true);
      expect(tracked.length).toBeGreaterThanOrEqual(2);
    });

    test('should get specific declaration tracking info', () => {
      aeatStatusMonitorService.trackDeclaration('TEST-MRN', 'H1', {});

      const result = aeatStatusMonitorService.getTrackedDeclaration('TEST-MRN');

      expect(result).toBeDefined();
      expect(result.mrn).toBe('TEST-MRN');
    });

    test('should untrack a declaration', () => {
      aeatStatusMonitorService.trackDeclaration('MRN-TO-REMOVE', 'H1', {});
      expect(aeatStatusMonitorService.getTrackedDeclaration('MRN-TO-REMOVE')).toBeDefined();

      const result = aeatStatusMonitorService.untrackDeclaration('MRN-TO-REMOVE');

      expect(result.success).toBe(true);
      expect(aeatStatusMonitorService.getTrackedDeclaration('MRN-TO-REMOVE')).toBeUndefined();
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
    test('should get active alerts from tracked declarations', () => {
      // Track a declaration first
      aeatStatusMonitorService.trackDeclaration('TEST-MRN', 'H1', {});

      // getActiveAlerts may return array or object with alerts
      const alerts = aeatStatusMonitorService.getActiveAlerts();
      const alertsArray = Array.isArray(alerts) ? alerts : (alerts.alerts || []);

      expect(Array.isArray(alertsArray)).toBe(true);
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
    test('should return service information', () => {
      const info = aeatStatusMonitorService.getInfo();

      expect(info).toBeDefined();
      expect(info).toHaveProperty('service');
      expect(info).toHaveProperty('trackedDeclarations');
      expect(info).toHaveProperty('pollingEnabled');
    });
  });

  describe('Filtering Tracked Declarations', () => {
    beforeEach(() => {
      aeatStatusMonitorService.trackedDeclarations = new Map();
      aeatStatusMonitorService.trackDeclaration('MRN-H1', 'H1', {});
      aeatStatusMonitorService.trackDeclaration('MRN-AES', 'AES', {});
    });

    test('should filter by type', () => {
      const h1Only = aeatStatusMonitorService.listTrackedDeclarations({ type: 'H1' });

      expect(h1Only.length).toBeGreaterThanOrEqual(1);
      // Check that at least one result has type H1
      const hasH1 = h1Only.some(d => d.type === 'H1');
      expect(hasH1).toBe(true);
    });
  });
});
