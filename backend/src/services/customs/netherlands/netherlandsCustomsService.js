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
    'ROTTERDAM_HAVEN': 'NL000297',
    'ROTTERDAM_RIJNMOND': 'NL000251',
    'SCHIPHOL': 'NL000399',
    'EINDHOVEN': 'NL000440',
    'MAASTRICHT': 'NL000447',
    'GRONINGEN': 'NL000460',
    'BREDA': 'NL000231',
    'HEERLEN': 'NL000441',
    'VENLO': 'NL000448',
  },
  documentTypes: {
    transport: ['N740', 'N741', 'N714', 'N730', 'N720', 'N722', 'N750', 'N760'],
    previous: ['N830', 'N821', 'NMRN', 'N822', 'N825', 'NZZZ'],
    additional: ['N853', 'N861', 'N862', 'N864', 'N865', 'N954', 'N955'],
    authorization: ['N990', 'N991', 'N992', 'C514', 'C517', 'C518', 'C519'],
    supporting: ['N380', 'N386', 'N325', 'N271', 'N935', 'N941', 'N951', 'N952', 'N953'],
    deco: ['N380', 'N271', 'N325', 'N740', 'N741', 'N714'],
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
   * Aligned with EU Annex B H7 dataset requirements + WCO DMS namespace
   * Data elements per EUCDM Annex B for simplified low-value declarations
   */
  _buildDECOXml(data) {
    const lrn = data.lrn || data.uniqueConsignmentRef || `LRN-${Date.now()}`;
    const customsOffice = data.customsOffice || NL_CODES.customsOffices['SCHIPHOL'];
    const countryOfDestination = data.countryOfDestination || 'NL';
    const countryOfDispatch = data.countryOfDispatch || data.exporter?.country || 'XX';
    const borderTransportMode = data.transport?.modeAtBorder || '4'; // default air
    const containerId = data.transport?.containerId || '';
    const currency = data.currency || 'EUR';
    const intrinsicValue = data.intrinsicValue || data.totalCustomsValue || 0;

    // D.E. 6/x - Goods items with all required H7 data elements
    const items = data.items.map((item, idx) => {
      const seqNum = item.itemNumber || (idx + 1);
      const commodityCode = (item.commodityCode || '000000').substring(0, 6); // D.E. 6/14: HS 6 digits for H7
      const netMass = item.netMass || item.grossMass || 0;
      const grossMass = item.grossMass || 0;
      const itemValue = item.customsValue || item.statisticalValue || 0;

      return `
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>${seqNum}</SequenceNumeric>
        <!-- D.E. 8/6: Statistical value -->
        <StatisticalValueAmount currencyID="${item.currency || currency}">${itemValue}</StatisticalValueAmount>
        <!-- D.E. 2/1: Previous documents -->
        ${item.previousDocument ? `<PreviousDocument>
          <CategoryCode>Y</CategoryCode>
          <ID>${this._escapeXml(item.previousDocument.id || '')}</ID>
          <TypeCode>${item.previousDocument.type || 'N830'}</TypeCode>
          <LineNumeric>${seqNum}</LineNumeric>
        </PreviousDocument>` : ''}
        <Commodity>
          <!-- D.E. 6/14: Commodity code (HS 6 digits for H7) -->
          <Classification>
            <ID>${commodityCode}</ID>
            <IdentificationTypeCode>TSP</IdentificationTypeCode>
          </Classification>
          <!-- D.E. 6/8: Description of goods -->
          <Description>${this._escapeXml(item.description || '')}</Description>
          <!-- D.E. 6/5: Gross mass -->
          <GoodsMeasure>
            <GrossMassMeasure unitCode="KGM">${grossMass}</GrossMassMeasure>
            <!-- D.E. 6/1: Net mass -->
            <NetNetWeightMeasure unitCode="KGM">${netMass}</NetNetWeightMeasure>
          </GoodsMeasure>
        </Commodity>
        <!-- D.E. 5/14: Country of dispatch (item level) -->
        <GovernmentProcedure>
          <CurrentCode>C</CurrentCode>
          <PreviousCode>00</PreviousCode>
        </GovernmentProcedure>
        <Origin>
          <CountryCode>${item.countryOfOrigin || countryOfDispatch}</CountryCode>
        </Origin>
        <Packaging>
          <!-- D.E. 6/9: Type of packages -->
          <TypeCode>${item.packageType || 'PK'}</TypeCode>
          <!-- D.E. 6/10: Number of packages -->
          <QuantityQuantity>${item.numberOfPackages || 1}</QuantityQuantity>
        </Packaging>
        <!-- D.E. 6/16: Items value -->
        <ValuationAdjustment>
          <AdditionCode>0000</AdditionCode>
        </ValuationAdjustment>
        <CustomsValuation>
          <ItemChargeAmount currencyID="${item.currency || currency}">${itemValue}</ItemChargeAmount>
        </CustomsValuation>
      </GovernmentAgencyGoodsItem>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2"
             xmlns:ds="urn:wco:datamodel:WCO:Declaration_DS:DMS:2"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xsi:schemaLocation="urn:wco:datamodel:WCO:DEC-DMS:2 WCO_DEC_2_DMS.xsd">
  <!-- D.E. 1/1: Declaration type - IM for import -->
  <FunctionCode>9</FunctionCode>
  <FunctionalReferenceID>${this._escapeXml(lrn)}</FunctionalReferenceID>
  <!-- D.E. 1/1: Type code -->
  <TypeCode>IM</TypeCode>
  <!-- D.E. 1/2: Additional declaration type - C for simplified -->
  <AdditionalDeclarationTypeCode>C</AdditionalDeclarationTypeCode>
  <GoodsItemQuantity>${data.items.length}</GoodsItemQuantity>
  <!-- D.E. 6/5: Total gross mass at declaration level -->
  <TotalGrossMassMeasure unitCode="KGM">${data.totalGrossMass || 0}</TotalGrossMassMeasure>
  <TotalPackageQuantity>${data.totalPackages || 0}</TotalPackageQuantity>
  <!-- D.E. 4/18: Intrinsic value -->
  <InvoiceAmount currencyID="${currency}">${intrinsicValue}</InvoiceAmount>
  ${data.authentication ? `<Authentication>
    <Authenticator>${this._escapeXml(data.authentication.authenticator || '')}</Authenticator>
  </Authentication>` : ''}
  <!-- D.E. 3/16: Declarant -->
  <Declarant>
    <ID>${this._escapeXml(data.declarant.eori || '')}</ID>
    <Name>${this._escapeXml(data.declarant.name || '')}</Name>
    ${data.declarant.address ? `<Address>
      <Line>${this._escapeXml(data.declarant.address.street || '')}</Line>
      <CityName>${this._escapeXml(data.declarant.address.city || '')}</CityName>
      <CountryCode>${data.declarant.address.country || 'NL'}</CountryCode>
      <PostcodeID>${this._escapeXml(data.declarant.address.postalCode || '')}</PostcodeID>
    </Address>` : ''}
  </Declarant>
  <!-- D.E. 3/1: Exporter (seller/consignor) -->
  <Exporter>
    <Name>${this._escapeXml(data.exporter.name || '')}</Name>
    <Address>
      <Line>${this._escapeXml(data.exporter.address?.street || '')}</Line>
      <CityName>${this._escapeXml(data.exporter.address?.city || '')}</CityName>
      <CountryCode>${data.exporter.country || countryOfDispatch}</CountryCode>
      <PostcodeID>${this._escapeXml(data.exporter.address?.postalCode || '')}</PostcodeID>
    </Address>
  </Exporter>
  <!-- D.E. 3/15: Importer -->
  <Importer>
    <ID>${this._escapeXml(data.importer.eori || '')}</ID>
    ${data.importer.name ? `<Name>${this._escapeXml(data.importer.name)}</Name>` : ''}
  </Importer>
  <!-- D.E. 3/40: Additional fiscal references (IOSS/Special scheme) -->
  ${data.iossNumber ? `<AdditionalFiscalReference>
    <ID>${this._escapeXml(data.iossNumber)}</ID>
    <RoleCode>FR5</RoleCode>
  </AdditionalFiscalReference>` : ''}
  <GoodsShipment>
    <TransactionNatureCode>11</TransactionNatureCode>
    <!-- D.E. 5/8: Country of destination -->
    <Destination>
      <CountryCode>${countryOfDestination}</CountryCode>
    </Destination>
    <!-- D.E. 5/14: Country of dispatch -->
    <ExportCountry>
      <ID>${countryOfDispatch}</ID>
    </ExportCountry>
    <!-- D.E. 5/23: Location of goods (customs office) -->
    <GoodsLocation>
      <Name>${this._escapeXml(data.goodsLocation?.name || 'Customs warehouse')}</Name>
      <ID>${customsOffice}</ID>
      <TypeCode>${data.goodsLocation?.typeCode || 'B'}</TypeCode>
      <Address>
        <TypeCode>U</TypeCode>
        <CountryCode>NL</CountryCode>
      </Address>
    </GoodsLocation>
    <Consignment>
      <!-- D.E. 7/4: Mode of transport at the border -->
      <ArrivalTransportMeans>
        <ModeCode>${borderTransportMode}</ModeCode>
      </ArrivalTransportMeans>
      <!-- D.E. 7/2: Container identification -->
      ${containerId ? `<TransportEquipment>
        <SequenceNumeric>1</SequenceNumeric>
        <ID>${this._escapeXml(containerId)}</ID>
      </TransportEquipment>` : ''}
    </Consignment>
    <!-- UCR / transport document -->
    <UCR>
      <TraderAssignedReferenceID>${this._escapeXml(data.uniqueConsignmentRef || lrn)}</TraderAssignedReferenceID>
    </UCR>
    <TransportDocument>
      <ID>${this._escapeXml(data.transport?.documentRef || '')}</ID>
      <TypeCode>${data.transport?.documentType || 'N740'}</TypeCode>
    </TransportDocument>
    <!-- Goods items -->
    ${items}
  </GoodsShipment>
</Declaration>`;
  }

  /**
   * Build DMS 4.0 H1 XML (Standard import/export - full EUCDM dataset)
   */
  _buildDMSXml(data, operationType) {
    logger.info(`NL DMS 4.0 ${operationType} XML builder`);

    const isExport = operationType === 'export';
    const typeCode = isExport ? 'EX' : 'IM';
    const additionalType = data.additionalDeclarationType || 'A'; // A = standard
    const lrn = data.lrn || data.uniqueConsignmentRef || `LRN-${Date.now()}`;
    const currency = data.currency || 'EUR';
    const customsOffice = data.customsOffice || NL_CODES.customsOffices['ROTTERDAM_HAVEN'];
    const supervisingOffice = data.supervisingOffice || customsOffice;

    // Build goods items
    const items = (data.items || []).map((item, idx) => {
      const seqNum = item.itemNumber || (idx + 1);
      const commodityCode = item.commodityCode || '0000000000'; // 10 digits for H1
      const taricAdditional = item.taricAdditionalCode || '';
      const nationalAdditional = item.nationalAdditionalCode || '';
      const netMass = item.netMass || 0;
      const grossMass = item.grossMass || 0;
      const itemValue = item.customsValue || item.statisticalValue || 0;
      const procedureCode = item.procedureCode || (isExport ? '1000' : '4000');
      const previousProcedure = item.previousProcedure || '00';

      return `
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>${seqNum}</SequenceNumeric>
        <StatisticalValueAmount currencyID="${item.currency || currency}">${itemValue}</StatisticalValueAmount>
        ${item.previousDocument ? `<PreviousDocument>
          <CategoryCode>Y</CategoryCode>
          <ID>${this._escapeXml(item.previousDocument.id || '')}</ID>
          <TypeCode>${item.previousDocument.type || 'NMRN'}</TypeCode>
          <LineNumeric>${seqNum}</LineNumeric>
        </PreviousDocument>` : ''}
        ${(item.additionalDocuments || []).map(doc => `<AdditionalDocument>
          <CategoryCode>${doc.category || 'N'}</CategoryCode>
          <ID>${this._escapeXml(doc.id || '')}</ID>
          <TypeCode>${doc.type || 'N380'}</TypeCode>
        </AdditionalDocument>`).join('')}
        <Commodity>
          <Description>${this._escapeXml(item.description || '')}</Description>
          <Classification>
            <ID>${commodityCode}</ID>
            <IdentificationTypeCode>TSP</IdentificationTypeCode>
          </Classification>
          ${taricAdditional ? `<Classification>
            <ID>${taricAdditional}</ID>
            <IdentificationTypeCode>TRA</IdentificationTypeCode>
          </Classification>` : ''}
          ${nationalAdditional ? `<Classification>
            <ID>${nationalAdditional}</ID>
            <IdentificationTypeCode>GN</IdentificationTypeCode>
          </Classification>` : ''}
          <DutyTaxFee>
            <TypeCode>${isExport ? 'A00' : 'A00'}</TypeCode>
            <Payment>
              <MethodCode>${data.paymentMethod || 'E'}</MethodCode>
            </Payment>
          </DutyTaxFee>
          ${!isExport ? `<DutyTaxFee>
            <TypeCode>B00</TypeCode>
            <Payment>
              <MethodCode>${data.paymentMethod || 'E'}</MethodCode>
            </Payment>
          </DutyTaxFee>` : ''}
          <GoodsMeasure>
            <GrossMassMeasure unitCode="KGM">${grossMass}</GrossMassMeasure>
            <NetNetWeightMeasure unitCode="KGM">${netMass}</NetNetWeightMeasure>
            ${item.supplementaryUnits ? `<TariffQuantity>${item.supplementaryUnits}</TariffQuantity>` : ''}
          </GoodsMeasure>
        </Commodity>
        <GovernmentProcedure>
          <CurrentCode>${procedureCode.substring(0, 2)}</CurrentCode>
          <PreviousCode>${previousProcedure}</PreviousCode>
        </GovernmentProcedure>
        ${item.additionalProcedure ? `<GovernmentProcedure>
          <CurrentCode>${item.additionalProcedure}</CurrentCode>
        </GovernmentProcedure>` : ''}
        <Origin>
          <CountryCode>${item.countryOfOrigin || 'XX'}</CountryCode>
          ${item.preferentialOrigin ? `<TypeCode>1</TypeCode>` : ''}
        </Origin>
        <Packaging>
          <TypeCode>${item.packageType || 'PK'}</TypeCode>
          <QuantityQuantity>${item.numberOfPackages || 1}</QuantityQuantity>
          ${item.shippingMarks ? `<MarksNumbersID>${this._escapeXml(item.shippingMarks)}</MarksNumbersID>` : ''}
        </Packaging>
        <ValuationAdjustment>
          <AdditionCode>0000</AdditionCode>
        </ValuationAdjustment>
      </GovernmentAgencyGoodsItem>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2"
             xmlns:ds="urn:wco:datamodel:WCO:Declaration_DS:DMS:2"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xsi:schemaLocation="urn:wco:datamodel:WCO:DEC-DMS:2 WCO_DEC_2_DMS.xsd">
  <FunctionCode>9</FunctionCode>
  <FunctionalReferenceID>${this._escapeXml(lrn)}</FunctionalReferenceID>
  <TypeCode>${typeCode}</TypeCode>
  <AdditionalDeclarationTypeCode>${additionalType}</AdditionalDeclarationTypeCode>
  <GoodsItemQuantity>${(data.items || []).length}</GoodsItemQuantity>
  <TotalGrossMassMeasure unitCode="KGM">${data.totalGrossMass || 0}</TotalGrossMassMeasure>
  <TotalPackageQuantity>${data.totalPackages || 0}</TotalPackageQuantity>
  <InvoiceAmount currencyID="${currency}">${data.totalCustomsValue || 0}</InvoiceAmount>
  <!-- Declarant (D.E. 3/18) -->
  <Declarant>
    <ID>${this._escapeXml(data.declarant?.eori || '')}</ID>
    <Name>${this._escapeXml(data.declarant?.name || '')}</Name>
    ${data.declarant?.address ? `<Address>
      <Line>${this._escapeXml(data.declarant.address.street || '')}</Line>
      <CityName>${this._escapeXml(data.declarant.address.city || '')}</CityName>
      <CountryCode>${data.declarant.address.country || 'NL'}</CountryCode>
      <PostcodeID>${this._escapeXml(data.declarant.address.postalCode || '')}</PostcodeID>
    </Address>` : ''}
  </Declarant>
  <!-- Exporter / Seller -->
  <Exporter>
    ${data.exporter?.eori ? `<ID>${this._escapeXml(data.exporter.eori)}</ID>` : ''}
    <Name>${this._escapeXml(data.exporter?.name || '')}</Name>
    <Address>
      <Line>${this._escapeXml(data.exporter?.address?.street || '')}</Line>
      <CityName>${this._escapeXml(data.exporter?.address?.city || '')}</CityName>
      <CountryCode>${data.exporter?.country || 'XX'}</CountryCode>
      <PostcodeID>${this._escapeXml(data.exporter?.address?.postalCode || '')}</PostcodeID>
    </Address>
  </Exporter>
  <!-- Importer / Buyer -->
  <Importer>
    <ID>${this._escapeXml(data.importer?.eori || '')}</ID>
    ${data.importer?.name ? `<Name>${this._escapeXml(data.importer.name)}</Name>` : ''}
    ${data.importer?.address ? `<Address>
      <Line>${this._escapeXml(data.importer.address.street || '')}</Line>
      <CityName>${this._escapeXml(data.importer.address.city || '')}</CityName>
      <CountryCode>${data.importer.address.country || 'NL'}</CountryCode>
      <PostcodeID>${this._escapeXml(data.importer.address.postalCode || '')}</PostcodeID>
    </Address>` : ''}
  </Importer>
  ${data.representative ? `<Agent>
    <ID>${this._escapeXml(data.representative.eori || '')}</ID>
    <FunctionCode>${data.representative.status || '2'}</FunctionCode>
  </Agent>` : ''}
  <GoodsShipment>
    <TransactionNatureCode>${data.transactionNature || '11'}</TransactionNatureCode>
    <Destination>
      <CountryCode>${data.countryOfDestination || 'NL'}</CountryCode>
    </Destination>
    <ExportCountry>
      <ID>${data.countryOfDispatch || data.exporter?.country || 'XX'}</ID>
    </ExportCountry>
    <GoodsLocation>
      <Name>${this._escapeXml(data.goodsLocation?.name || '')}</Name>
      <ID>${customsOffice}</ID>
      <TypeCode>${data.goodsLocation?.typeCode || 'B'}</TypeCode>
      <Address>
        <TypeCode>U</TypeCode>
        <CountryCode>NL</CountryCode>
      </Address>
    </GoodsLocation>
    <Consignment>
      <ContainerCode>${data.transport?.containerIndicator || '0'}</ContainerCode>
      <ArrivalTransportMeans>
        <ModeCode>${data.transport?.modeAtBorder || '1'}</ModeCode>
        ${data.transport?.borderMeansId ? `<ID>${this._escapeXml(data.transport.borderMeansId)}</ID>` : ''}
        ${data.transport?.borderMeansType ? `<IdentificationTypeCode>${data.transport.borderMeansType}</IdentificationTypeCode>` : ''}
        ${data.transport?.borderNationality ? `<RegistrationNationalityCode>${data.transport.borderNationality}</RegistrationNationalityCode>` : ''}
      </ArrivalTransportMeans>
      ${data.transport?.containerId ? `<TransportEquipment>
        <SequenceNumeric>1</SequenceNumeric>
        <ID>${this._escapeXml(data.transport.containerId)}</ID>
      </TransportEquipment>` : ''}
    </Consignment>
    ${data.warehouse ? `<Warehouse>
      <ID>${this._escapeXml(data.warehouse.id || '')}</ID>
      <TypeCode>${data.warehouse.type || 'U'}</TypeCode>
    </Warehouse>` : ''}
    <CustomsOfficeOfEntry>
      <ID>${customsOffice}</ID>
    </CustomsOfficeOfEntry>
    <SupervisingOffice>
      <ID>${supervisingOffice}</ID>
    </SupervisingOffice>
    ${data.guarantee ? `<ObligationGuarantee>
      <ID>${this._escapeXml(data.guarantee.reference || '')}</ID>
      <SecurityDetailsCode>${data.guarantee.type || '0'}</SecurityDetailsCode>
    </ObligationGuarantee>` : ''}
    <TransportDocument>
      <ID>${this._escapeXml(data.transport?.documentRef || '')}</ID>
      <TypeCode>${data.transport?.documentType || 'N740'}</TypeCode>
    </TransportDocument>
    <UCR>
      <TraderAssignedReferenceID>${this._escapeXml(data.uniqueConsignmentRef || lrn)}</TraderAssignedReferenceID>
    </UCR>
    ${items}
  </GoodsShipment>
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
