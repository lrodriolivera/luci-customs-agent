/**
 * Netherlands Customs Service - DMS 4.0 + DECO
 * DMS 4.0: Standard import/export declarations
 * DECO: E-commerce low-value imports (H7, ≤150 EUR)
 * Communication via Digipoort
 */
const BaseCustomsService = require('../common/baseCustomsService');
const logger = require('../../../config/logger');

// Netherlands-specific configuration
const NL_CONFIG = {
  test: {
    digipoort: 'https://preprod-dgp2.procesinfrastructuur.nl',
    dms: 'https://test-dms.douane.nl',
    deco: 'https://test-deco.douane.nl',
  },
  production: {
    digipoort: 'https://dgp2.procesinfrastructuur.nl',
    dms: 'https://dms.douane.nl',
    deco: 'https://deco.douane.nl',
  }
};

// DMS national codes (NXXXX format, replacing old 9XXXX AGS codes)
const NL_CODES = {
  customsOffices: {
    'AMSTERDAM': 'NL000396',
    'ROTTERDAM': 'NL000297',
    'SCHIPHOL': 'NL000399',
    'EINDHOVEN': 'NL000440',
    'MAASTRICHT': 'NL000447',
  },
  documentTypes: {
    transport: ['N740', 'N741', 'N714', 'N730'],
    previous: ['N830', 'N821', 'NMRN'],
    additional: ['N853', 'N861', 'N862'],
    authorization: ['N990', 'N991'],
    supporting: ['N380', 'N386', 'N325'],
  }
};

class NetherlandsCustomsService extends BaseCustomsService {
  constructor(config = {}) {
    super('NL', config);
    this.certificate = config.certificatePath || process.env.NL_CERT_PATH;
    this.certPassword = config.certificatePassword || process.env.NL_CERT_PASSWORD;
    this.eori = config.eoriNumber || process.env.NL_EORI;

    const env = this.environment === 'production' ? 'production' : 'test';
    this.endpoints = NL_CONFIG[env];

    logger.info(`NetherlandsCustomsService initialized (${env})`);
  }

  async submitDeclaration(expedition, declarationType) {
    switch (declarationType) {
      case 'H7':
        return this._submitDECO(expedition);
      case 'H1':
        return this._submitDMS(expedition, 'import');
      case 'AES':
        return this._submitDMS(expedition, 'export');
      default:
        throw new Error(`Declaration type ${declarationType} not yet supported for Netherlands`);
    }
  }

  /**
   * Submit H7 low-value declaration via DECO
   */
  async _submitDECO(expedition) {
    const UCCDataMapper = require('../common/uccDataMapper');
    const uccData = UCCDataMapper.expeditionToH7(expedition);

    // Validate H7 constraints
    const validation = UCCDataMapper.validateH7(uccData);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    // Build DECO XML
    const xml = this._buildDECOXml(uccData);

    if (!this.isConfigured()) {
      logger.warn('NL DECO: No certificate configured - using simulation mode');
      return this._simulateResponse('H7', expedition.expeditionId);
    }

    // Send via Digipoort
    return this._sendViaDigipoort(xml, 'DECO');
  }

  /**
   * Submit standard declaration via DMS 4.0
   */
  async _submitDMS(expedition, operationType) {
    const UCCDataMapper = require('../common/uccDataMapper');
    const uccData = UCCDataMapper.expeditionToH1(expedition);

    // Build DMS 4.0 XML
    const xml = this._buildDMSXml(uccData, operationType);

    if (!this.isConfigured()) {
      logger.warn('NL DMS: No certificate configured - using simulation mode');
      return this._simulateResponse('H1', expedition.expeditionId);
    }

    // Send via Digipoort
    return this._sendViaDigipoort(xml, 'DMS4.NL');
  }

  /**
   * Build DECO H7 XML (Netherlands-specific format)
   * Aligned with EUCDM but using NL national codes
   */
  _buildDECOXml(data) {
    const items = data.items.map((item, idx) => `
      <GoodsItem>
        <SequenceNumber>${item.itemNumber}</SequenceNumber>
        <CommodityCode>${item.commodityCode}</CommodityCode>
        <GoodsDescription>${this._escapeXml(item.description)}</GoodsDescription>
        <GrossMass>${item.grossMass}</GrossMass>
        <StatisticalValue>${item.customsValue}</StatisticalValue>
        <StatisticalValueCurrency>${item.currency}</StatisticalValueCurrency>
        <CountryOfOrigin>${item.countryOfOrigin || 'XX'}</CountryOfOrigin>
        <NumberOfPackages>${item.numberOfPackages}</NumberOfPackages>
        <PackageType>${item.packageType}</PackageType>
      </GoodsItem>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2" xmlns:ds="urn:wco:datamodel:WCO:Declaration_DS:DMS:2">
  <FunctionCode>9</FunctionCode>
  <TypeCode>IM</TypeCode>
  <AdditionalTypeCode>C</AdditionalTypeCode>
  <TotalGrossMassMeasure>${data.totalGrossMass}</TotalGrossMassMeasure>
  <TotalPackageQuantity>${data.totalPackages}</TotalPackageQuantity>
  <Declarant>
    <ID>${data.declarant.eori}</ID>
    <Name>${this._escapeXml(data.declarant.name || '')}</Name>
  </Declarant>
  <Exporter>
    <Name>${this._escapeXml(data.exporter.name || '')}</Name>
    <Address>
      <CountryCode>${data.exporter.country || 'XX'}</CountryCode>
    </Address>
  </Exporter>
  <Importer>
    <ID>${data.importer.eori}</ID>
  </Importer>
  ${data.iossNumber ? `<AdditionalInformation>
    <StatementCode>IOSS</StatementCode>
    <StatementDescription>${data.iossNumber}</StatementDescription>
  </AdditionalInformation>` : ''}
  <GoodsShipment>
    <TransactionNatureCode>11</TransactionNatureCode>
    <UCR>${data.uniqueConsignmentRef}</UCR>
    <TransportDocument>
      <ID>${data.transport.documentRef || ''}</ID>
      <TypeCode>${data.transport.documentType || 'N740'}</TypeCode>
    </TransportDocument>
    ${items}
  </GoodsShipment>
</Declaration>`;
  }

  /**
   * Build DMS 4.0 H1 XML
   */
  _buildDMSXml(data, operationType) {
    // DMS 4.0 uses EUCDM-aligned XML
    // More complex than DECO - full dataset
    // TODO: Implement full DMS 4.0 XML once MIG specs obtained from nh.douane.nl

    logger.info(`NL DMS 4.0 ${operationType} XML builder - placeholder`);
    return `<?xml version="1.0" encoding="UTF-8"?>
<Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2">
  <FunctionCode>9</FunctionCode>
  <TypeCode>${operationType === 'export' ? 'EX' : 'IM'}</TypeCode>
  <AdditionalTypeCode>A</AdditionalTypeCode>
  <!-- DMS 4.0 full implementation pending MIG specs from nh.douane.nl -->
</Declaration>`;
  }

  /**
   * Send XML to Dutch Customs via Digipoort
   */
  async _sendViaDigipoort(xml, processId) {
    // Digipoort uses SOAP with PKIoverheid certificate (mutual TLS)
    // Similar to AEAT but different envelope structure

    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <!-- PKIoverheid certificate auth -->
    </wsse:Security>
  </soap:Header>
  <soap:Body>
    <aanleverRequest xmlns="http://logius.nl/digipoort/koppelvlakservices/1.2/">
      <berichtsoort>${processId}</berichtsoort>
      <berichtInhoud>${Buffer.from(xml).toString('base64')}</berichtInhoud>
    </aanleverRequest>
  </soap:Body>
</soap:Envelope>`;

    try {
      const fs = require('fs');
      const https = require('https');
      const axios = require('axios');
      const forge = require('node-forge');

      // Load PKIoverheid certificate (same .p12 format as FNMT)
      const p12Buffer = fs.readFileSync(this.certificate);
      const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, this.certPassword);

      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

      const cert = forge.pki.certificateToPem(certBags[forge.pki.oids.certBag][0].cert);
      const key = forge.pki.privateKeyToPem(keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key);

      const httpsAgent = new https.Agent({ cert, key, rejectUnauthorized: true });

      const response = await axios.post(
        `${this.endpoints.digipoort}/aanleverservice/1.2`,
        soapEnvelope,
        {
          headers: { 'Content-Type': 'text/xml; charset=utf-8' },
          httpsAgent,
          timeout: 60000
        }
      );

      return this._parseDigipoortResponse(response.data);
    } catch (error) {
      logger.error(`NL Digipoort error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Parse Digipoort response
   */
  _parseDigipoortResponse(responseData) {
    const body = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);

    const statusMatch = body.match(/<statuscode>(\w+)<\/statuscode>/);
    const mrnMatch = body.match(/<MRN>([^<]+)<\/MRN>/);
    const errorMatch = body.match(/<fout(?:beschrijving)?>([^<]+)</);

    const status = statusMatch ? statusMatch[1] : 'UNKNOWN';

    return {
      success: ['OK', '0000', 'ACCEPTED'].includes(status.toUpperCase()),
      code: status,
      mrn: mrnMatch ? mrnMatch[1] : null,
      channel: 'green', // NL defaults, actual channel from response
      error: errorMatch ? errorMatch[1] : null,
      rawResponse: body.substring(0, 2000)
    };
  }

  /**
   * Simulation mode (no certificate)
   */
  _simulateResponse(type, expeditionId) {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const seq = Math.random().toString(36).substring(2, 10).toUpperCase();

    return {
      success: true,
      code: '0000',
      mrn: `${year}NL0003${seq}`,
      lrn: expeditionId,
      channel: 'green',
      simulated: true,
      message: 'Simulation mode - no PKIoverheid certificate configured'
    };
  }

  async queryStatus(mrn) {
    if (!this.isConfigured()) {
      return { success: true, status: 'ACCEPTED', mrn, simulated: true };
    }
    // TODO: Implement real DMS status query
    return { success: true, status: 'PENDING', mrn };
  }

  async amendDeclaration(mrn, data) {
    throw new Error('Amendment not yet implemented for Netherlands');
  }

  async cancelDeclaration(mrn) {
    throw new Error('Cancellation not yet implemented for Netherlands');
  }

  async validateDeclaration(data, declarationType) {
    if (declarationType === 'H7') {
      const UCCDataMapper = require('../common/uccDataMapper');
      const uccData = UCCDataMapper.expeditionToH7({ ...data, goods: data.goods || data.items });
      return UCCDataMapper.validateH7(uccData);
    }
    return { valid: true, errors: [] };
  }

  getEndpoints() {
    return this.endpoints;
  }

  getSupportedDeclarationTypes() {
    return ['H7', 'H1']; // DECO for H7, DMS for H1
  }

  isConfigured() {
    return !!(this.certificate && this.certPassword);
  }

  _escapeXml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

module.exports = NetherlandsCustomsService;
