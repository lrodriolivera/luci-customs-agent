/**
 * Jest setup file
 * Runs before each test suite
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.AEAT_MODE = 'simulation';
// Must be >=32 chars and NOT a known placeholder (enforced by jwtService)
process.env.JWT_SECRET = 'test-secret-key-for-jest-ci-32chars-min-length-a1b2c3';
process.env.JWT_ISSUER = 'luci-customs-agent';
process.env.JWT_AUDIENCE = 'luci-api';
process.env.MONGODB_URI = 'mongodb://localhost:27017/luci-test';

// Increase timeout for integration tests
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Keep console.error and console.warn for debugging
  error: jest.fn(),
  warn: jest.fn(),
  // Mock console.log and console.info
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Add custom matchers if needed
expect.extend({
  toBeValidMRN(received) {
    const mrnRegex = /^\d{2}[A-Z]{2}[A-Z0-9]{14,18}$/;
    const pass = mrnRegex.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid MRN`
          : `expected ${received} to be a valid MRN format (e.g., 24ES123456789012345678)`
    };
  },

  toBeValidNIF(received) {
    const nifRegex = /^[A-Z]\d{8}$|^\d{8}[A-Z]$/;
    const pass = nifRegex.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid NIF`
          : `expected ${received} to be a valid Spanish NIF format`
    };
  },

  toBeValidTARIC(received) {
    const taricRegex = /^\d{10}$/;
    const pass = taricRegex.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid TARIC code`
          : `expected ${received} to be a 10-digit TARIC code`
    };
  }
});
