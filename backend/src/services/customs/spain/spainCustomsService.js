/**
 * Spain Customs Service - Wrapper around existing AEAT implementation
 * Delegates to aeatSubmitService, h1XmlBuilder, h7XmlBuilder, etc.
 */
const BaseCustomsService = require('../common/baseCustomsService');

class SpainCustomsService extends BaseCustomsService {
  constructor(config = {}) {
    super('ES', config);

    // Lazy-load existing AEAT services to avoid circular deps
    this._submitService = null;
    this._configService = null;
  }

  get submitService() {
    if (!this._submitService) {
      this._submitService = require('../../aeat/aeatSubmitService');
    }
    return this._submitService;
  }

  get configService() {
    if (!this._configService) {
      this._configService = require('../../aeat/aeatConfig');
    }
    return this._configService;
  }

  async submitDeclaration(expedition, declarationType) {
    switch (declarationType) {
      case 'H1': return this.submitService.submitH1(expedition);
      case 'H7': return this.submitService.submitH7(expedition);
      case 'AES': return this.submitService.submitAES(expedition);
      case 'ENS': return this.submitService.submitENS(expedition);
      case 'NCTS': return this.submitService.submitNCTS(expedition);
      default:
        throw new Error(`Unsupported declaration type for Spain: ${declarationType}`);
    }
  }

  async queryStatus(mrn) {
    // Use existing query functionality
    const queryBuilder = require('../../aeat/queryXmlBuilder');
    return queryBuilder.queryDeclarationStatus(mrn);
  }

  async amendDeclaration(mrn, amendmentData) {
    // Delegate to existing amendment services
    if (amendmentData.type === 'ENS') {
      return this.submitService.submitENSAmendment(mrn, amendmentData);
    }
    throw new Error('Amendment not yet supported for this type in Spain');
  }

  async cancelDeclaration(mrn) {
    const cancelBuilder = require('../../aeat/h1CancelXmlBuilder');
    return cancelBuilder.cancelDeclaration(mrn);
  }

  buildDeclarationXml(data, declarationType) {
    switch (declarationType) {
      case 'H1': {
        const { buildH1ImportXML } = require('../../aeat/h1XmlBuilder');
        return buildH1ImportXML(data);
      }
      case 'H7': {
        const { buildH7ImportXML } = require('../../aeat/h7XmlBuilder');
        return buildH7ImportXML(data);
      }
      case 'AES': {
        const { buildAESExportXML } = require('../../aeat/aesXmlBuilder');
        return buildAESExportXML(data);
      }
      default:
        throw new Error(`XML builder not available for: ${declarationType}`);
    }
  }

  async validateDeclaration(data, declarationType) {
    // Basic validation - existing builders do their own
    const errors = [];
    if (!data) errors.push('Declaration data is required');
    return { valid: errors.length === 0, errors };
  }

  getEndpoints() {
    return this.configService.getEndpoints ? this.configService.getEndpoints() : {
      H1: '/wlpl/ADUA-JDIT/ws/PresDecAduana',
      H7: '/wlpl/ADUA-JDIT/ws/BajoValorH7',
      AES: '/wlpl/ADUA-JDIT/ws/PresDecExportacion',
      ENS: '/wlpl/ADUA-JDIT/ws/ENS_ICS2',
      NCTS: '/wlpl/ADUA-JDIT/ws/TransitoNCTS',
    };
  }

  getSupportedDeclarationTypes() {
    return ['H1', 'H7', 'AES', 'ENS', 'NCTS'];
  }

  isConfigured() {
    try {
      const certService = require('../../aeat/certificateService');
      return !!certService.getCertificatePath();
    } catch {
      return false;
    }
  }
}

module.exports = SpainCustomsService;
