/**
 * Container Release Message (CVB) Service
 * Required for maritime imports at Dutch ports (Rotterdam, Amsterdam, Vlissingen)
 * Flow: CVB → DECO/DMS declaration
 */
const logger = require('../../../config/logger');

class CVBService {
  constructor(config = {}) {
    this.endpoint = config.endpoint || 'https://cvb.portbase.com/api/v1';
    this.apiKey = config.apiKey || process.env.NL_CVB_API_KEY;
    this.isConfigured = !!this.apiKey;

    logger.info(`CVBService initialized (${this.isConfigured ? 'configured' : 'simulation'})`);
  }

  /**
   * Request container release
   * Must be done BEFORE submitting import declaration for maritime cargo
   */
  async requestRelease(containerData) {
    const {
      containerNumber,      // e.g., "MSKU1234567"
      billOfLading,         // B/L number
      carrierCode,          // SCAC code of shipping line
      portOfDischarge,      // NLRTM (Rotterdam), NLAMS (Amsterdam)
      consigneeEori,        // EORI of consignee
      customsStatus,        // 'T1' (non-EU goods) or 'T2' (EU goods in transit)
      estimatedArrival,     // Date
      goodsDescription,
      grossWeight,
      numberOfPackages,
    } = containerData;

    // Validate required fields
    const errors = [];
    if (!containerNumber) errors.push('Container number required');
    if (!billOfLading) errors.push('Bill of Lading required');
    if (!portOfDischarge) errors.push('Port of discharge required');
    if (!consigneeEori) errors.push('Consignee EORI required');

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Validate container number format (4 letters + 7 digits)
    if (!/^[A-Z]{4}\d{7}$/.test(containerNumber)) {
      return { success: false, errors: ['Container number format invalid (expected: 4 letters + 7 digits)'] };
    }

    if (!this.isConfigured) {
      logger.warn('CVB: Simulation mode');
      return this._simulateCVBResponse(containerData);
    }

    try {
      const axios = require('axios');
      const response = await axios.post(`${this.endpoint}/release-request`, {
        containerNumber,
        billOfLading,
        carrierCode,
        portOfDischarge,
        consigneeEori,
        customsStatus: customsStatus || 'T1',
        estimatedArrival,
        grossWeight,
        numberOfPackages,
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      return {
        success: true,
        releaseId: response.data.releaseId,
        status: response.data.status,
        containerNumber,
        message: 'CVB release requested'
      };
    } catch (error) {
      logger.error(`CVB error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check CVB release status
   */
  async checkReleaseStatus(releaseId) {
    if (!this.isConfigured) {
      return { success: true, releaseId, status: 'RELEASED', simulated: true };
    }

    try {
      const axios = require('axios');
      const response = await axios.get(`${this.endpoint}/release-status/${releaseId}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        timeout: 15000
      });
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if CVB is required for this expedition
   */
  static requiresCVB(expedition) {
    const maritimePorts = ['NLRTM', 'NLAMS', 'NLVLI', 'NL000297', 'NL000396', 'NL000511'];
    const isMaritimeImport = expedition.transportMode === 'maritime';
    const isDutchPort = maritimePorts.includes(expedition.transport?.entryCustomsOffice);
    const hasContainer = !!expedition.transport?.containerNumber;

    return isMaritimeImport || isDutchPort || hasContainer;
  }

  _simulateCVBResponse(data) {
    return {
      success: true,
      releaseId: `CVB-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      status: 'PENDING_RELEASE',
      containerNumber: data.containerNumber,
      estimatedRelease: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      simulated: true,
      message: 'CVB release simulated - awaiting carrier confirmation'
    };
  }
}

module.exports = CVBService;
