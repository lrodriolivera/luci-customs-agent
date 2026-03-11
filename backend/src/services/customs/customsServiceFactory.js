/**
 * Customs Service Factory
 * Returns the appropriate customs service based on country code
 */
const SpainCustomsService = require('./spain/spainCustomsService');
const NetherlandsCustomsService = require('./netherlands/netherlandsCustomsService');
const logger = require('../../config/logger');

// Cache service instances per tenant
const serviceCache = new Map();

class CustomsServiceFactory {

  /**
   * Get customs service for a country
   * @param {string} countryCode - ISO 2-letter country code (ES, NL, BE, etc.)
   * @param {object} config - Country-specific config (certificate, eori, environment)
   * @returns {BaseCustomsService} Country-specific customs service
   */
  static getService(countryCode, config = {}) {
    const cacheKey = `${countryCode}-${config.tenantId || 'default'}`;

    if (serviceCache.has(cacheKey)) {
      return serviceCache.get(cacheKey);
    }

    let service;

    switch (countryCode.toUpperCase()) {
      case 'ES':
        service = new SpainCustomsService(config);
        break;
      case 'NL':
        service = new NetherlandsCustomsService(config);
        break;
      // Future countries:
      // case 'BE': service = new BelgiumCustomsService(config); break;
      // case 'DE': service = new GermanyCustomsService(config); break;
      // case 'FR': service = new FranceCustomsService(config); break;
      default:
        throw new Error(`Customs service not available for country: ${countryCode}. Supported: ES, NL`);
    }

    serviceCache.set(cacheKey, service);
    logger.info(`CustomsServiceFactory: Created service for ${countryCode} (${service.getEnvironment()})`);

    return service;
  }

  /**
   * Get service from tenant configuration
   */
  static getServiceForTenant(tenant) {
    const country = tenant.customsConfig?.country || tenant.businessInfo?.country || 'ES';
    const config = {
      tenantId: tenant._id?.toString(),
      environment: tenant.customsConfig?.environment || process.env.AEAT_ENVIRONMENT || 'test',
      certificatePath: tenant.customsConfig?.certificatePath,
      certificatePassword: tenant.customsConfig?.certificatePassword,
      eoriNumber: tenant.businessInfo?.eori,
    };

    return CustomsServiceFactory.getService(country, config);
  }

  /**
   * Get all supported countries
   */
  static getSupportedCountries() {
    return [
      { code: 'ES', name: 'Espana', system: 'AEAT', types: ['H1', 'H7', 'AES', 'ENS', 'NCTS'], status: 'active' },
      { code: 'NL', name: 'Paises Bajos', system: 'DMS/DECO', types: ['H1', 'H7'], status: 'beta' },
      // { code: 'BE', name: 'Belgica', system: 'PLDA/IDMS', types: ['H1', 'H7'], status: 'planned' },
      // { code: 'DE', name: 'Alemania', system: 'ATLAS', types: ['H1', 'AES'], status: 'planned' },
      // { code: 'FR', name: 'Francia', system: 'DELTA', types: ['H1', 'AES'], status: 'planned' },
    ];
  }

  /**
   * Clear cache (useful for testing or config changes)
   */
  static clearCache() {
    serviceCache.clear();
  }
}

module.exports = CustomsServiceFactory;
