/**
 * Base Customs Service - Abstract interface for all country implementations
 * Each country (Spain, Netherlands, Belgium...) extends this class
 */
class BaseCustomsService {
  constructor(countryCode, config) {
    if (new.target === BaseCustomsService) {
      throw new Error('BaseCustomsService is abstract - use a country implementation');
    }
    this.countryCode = countryCode;
    this.config = config;
    this.environment = config.environment || 'test';
  }

  // Declaration lifecycle
  async submitDeclaration(expedition, declarationType) {
    throw new Error('submitDeclaration() must be implemented');
  }

  async queryStatus(mrn) {
    throw new Error('queryStatus() must be implemented');
  }

  async amendDeclaration(mrn, amendmentData) {
    throw new Error('amendDeclaration() must be implemented');
  }

  async cancelDeclaration(mrn) {
    throw new Error('cancelDeclaration() must be implemented');
  }

  // XML generation
  buildDeclarationXml(data, declarationType) {
    throw new Error('buildDeclarationXml() must be implemented');
  }

  // Validation
  async validateDeclaration(data, declarationType) {
    throw new Error('validateDeclaration() must be implemented');
  }

  // Configuration
  getEndpoints() {
    throw new Error('getEndpoints() must be implemented');
  }

  getSupportedDeclarationTypes() {
    throw new Error('getSupportedDeclarationTypes() must be implemented');
  }

  getCountryCode() {
    return this.countryCode;
  }

  getEnvironment() {
    return this.environment;
  }

  // Helpers
  isConfigured() {
    return false;
  }

  getServiceInfo() {
    return {
      country: this.countryCode,
      environment: this.environment,
      configured: this.isConfigured(),
      supportedTypes: this.getSupportedDeclarationTypes()
    };
  }
}

module.exports = BaseCustomsService;
