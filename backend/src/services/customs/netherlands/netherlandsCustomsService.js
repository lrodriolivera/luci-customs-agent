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
    const NLValidation = require('./nlValidation');
    const uccData = UCCDataMapper.expeditionToH7(expedition);

    // Validate with NL-specific DECO rules
    const nlValidation = NLValidation.validateDECO(uccData);
    if (!nlValidation.valid) {
      return { success: false, errors: nlValidation.errors, warnings: nlValidation.warnings, system: 'DECO' };
    }

    // Also run common UCC validation
    const uccValidation = UCCDataMapper.validateH7(uccData);
    if (!uccValidation.valid) {
      return { success: false, errors: uccValidation.errors };
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
    // Check if CVB is needed for maritime imports
    const CVBService = require('./cvbService');
    if (CVBService.requiresCVB(expedition) && !expedition.cvbReleaseId) {
      return { success: false, error: 'Container Release Message (CVB) required for maritime imports. Request CVB first.', requiresCVB: true };
    }

    const UCCDataMapper = require('../common/uccDataMapper');
    const NLValidation = require('./nlValidation');
    const uccData = UCCDataMapper.expeditionToH1(expedition);

    // Validate with NL-specific DMS rules
    const nlValidation = NLValidation.validateDMS(uccData);
    if (!nlValidation.valid) {
      return { success: false, errors: nlValidation.errors, warnings: nlValidation.warnings, system: 'DMS 4.0' };
    }

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
   * Build DECO 2.0 H7 XML - NL MIG DECO 2.0 compliant
   * Based on official XSD: urn:wco:datamodel:WCO:DECO.Declaration:2
   * Reference: docs/nl-migs/DECO-2.0/MIG DECO 2.0/Section 2 (B2DECO)
   */
  _buildDECOXml(data) {
    const lrn = data.lrn || data.uniqueConsignmentRef || `LRN-${Date.now()}`;
    const customsOffice = data.customsOffice || NL_CODES.customsOffices['SCHIPHOL'];
    const countryOfDispatch = data.countryOfDispatch || data.exporter?.country || 'XX';
    const currency = data.currency || 'EUR';
    const totalGrossMass = data.totalGrossMass || 0;
    const now = new Date();
    const prepDateTime = now.toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z';

    // Build GovernmentAgencyGoodsItem elements per XSD sequence order
    const items = data.items.map((item, idx) => {
      const seqNum = item.itemNumber || (idx + 1);
      const commodityCode = (item.commodityCode || '000000').substring(0, 6);
      const grossMass = item.grossMass || 0;
      const itemValue = item.customsValue || item.statisticalValue || 0;

      return `
        <GovernmentAgencyGoodsItem>
          <SequenceNumeric>${seqNum}</SequenceNumeric>
          <Commodity>
            <Description>${this._escapeXml(item.description || '')}</Description>
            <Classification>
              <ID>${commodityCode}</ID>
              <IdentificationTypeCode>SSH</IdentificationTypeCode>
            </Classification>
            <GoodsMeasure>
              <GrossMassMeasure>${grossMass}</GrossMassMeasure>
            </GoodsMeasure>
            <InvoiceLine>
              <ItemChargeAmount currencyID="${item.currency || currency}">${itemValue}</ItemChargeAmount>
            </InvoiceLine>
          </Commodity>
          ${item.transportCharges ? `<CustomsValuation>
            <ExitToEntryChargeAmount currencyID="${item.currency || currency}">${item.transportCharges}</ExitToEntryChargeAmount>
          </CustomsValuation>` : ''}
          <Exporter>
            <Name>${this._escapeXml(item.exporterName || data.exporter?.name || '')}</Name>
            <Address>
              <CityName>${this._escapeXml(item.exporterCity || data.exporter?.address?.city || '')}</CityName>
              <CountryCode>${item.countryOfOrigin || countryOfDispatch}</CountryCode>
              <Line>${this._escapeXml(item.exporterStreet || data.exporter?.address?.street || '')}</Line>
              <PostcodeID>${this._escapeXml(item.exporterPostcode || data.exporter?.address?.postalCode || '')}</PostcodeID>
            </Address>
          </Exporter>
          <GovernmentProcedure>
            <AdditionalProcedure>
              <SequenceNumeric>1</SequenceNumeric>
              <ProcedureCode>${item.additionalProcedure || 'C07'}</ProcedureCode>
            </AdditionalProcedure>
          </GovernmentProcedure>
          <Packaging>
            <QuantityQuantity>${item.numberOfPackages || 1}</QuantityQuantity>
          </Packaging>
          ${item.previousDocument ? `<PreviousDocument>
            <ID>${this._escapeXml(item.previousDocument.id || '')}</ID>
            <TypeCode>${item.previousDocument.type || '380'}</TypeCode>
            <SequenceNumeric>1</SequenceNumeric>
          </PreviousDocument>` : ''}
          ${(item.supportingDocuments || []).map((doc, di) => `<SupportingDocument>
            <ID>${this._escapeXml(doc.id || '')}</ID>
            <TypeCode>${doc.type || 'N380'}</TypeCode>
            <SequenceNumeric>${di + 1}</SequenceNumeric>
          </SupportingDocument>`).join('')}
          <UCR>
            <TraderAssignedReferenceID>${this._escapeXml(item.ucr || data.uniqueConsignmentRef || lrn)}</TraderAssignedReferenceID>
          </UCR>
          <TransportContractDocument>
            <ID>${this._escapeXml(item.transportDocRef || data.transport?.documentRef || '')}</ID>
            <TypeCode>${item.transportDocType || data.transport?.documentType || 'N740'}</TypeCode>
            <SequenceNumeric>1</SequenceNumeric>
          </TransportContractDocument>
        </GovernmentAgencyGoodsItem>`;
    }).join('');

    // Build full MetaData > Declaration structure per DECO 2.0 XSD
    return `<?xml version="1.0" encoding="UTF-8"?>
<MetaData xmlns="urn:wco:datamodel:WCO:DECO.Declaration:2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="urn:wco:datamodel:WCO:DECO.Declaration:2 DECO.Declaration_2p00.xsd">
  <WCOTypeCode>DECO</WCOTypeCode>
  <CommunicationMetaData>
    <ApplicationReferenceID>${this._escapeXml(lrn)}</ApplicationReferenceID>
    <PreparationDateTime formatCode="304">${prepDateTime}</PreparationDateTime>
    <Recipient>
      <ID>NL</ID>
    </Recipient>
    <Sender>
      <ID>${this._escapeXml(data.declarant?.eori || this.eori || '')}</ID>
    </Sender>
  </CommunicationMetaData>
  <Declaration>
    <FunctionalReferenceID>${this._escapeXml(lrn)}</FunctionalReferenceID>
    <TypeCode>154</TypeCode>
    <DeclarationOffice>
      <ID>${customsOffice}</ID>
    </DeclarationOffice>
    ${data.representative ? `<Agent>
      <ID>${this._escapeXml(data.representative.eori || '')}</ID>
      <FunctionCode>${data.representative.status || '2'}</FunctionCode>
      ${data.representative.contactName ? `<Contact>
        <Name>${this._escapeXml(data.representative.contactName)}</Name>
        ${data.representative.contactEmail ? `<Communication>
          <SequenceNumeric>1</SequenceNumeric>
          <ID>${this._escapeXml(data.representative.contactEmail)}</ID>
          <TypeCode>EM</TypeCode>
        </Communication>` : ''}
      </Contact>` : ''}
    </Agent>` : ''}
    <Declarant>
      <Name>${this._escapeXml(data.declarant?.name || '')}</Name>
      <ID>${this._escapeXml(data.declarant?.eori || '')}</ID>
      ${data.declarant?.address ? `<Address>
        <CityName>${this._escapeXml(data.declarant.address.city || '')}</CityName>
        <CountryCode>${data.declarant.address.country || 'NL'}</CountryCode>
        <Line>${this._escapeXml(data.declarant.address.street || '')}</Line>
        <PostcodeID>${this._escapeXml(data.declarant.address.postalCode || '')}</PostcodeID>
      </Address>` : ''}
      ${data.declarant?.contactName ? `<Contact>
        <Name>${this._escapeXml(data.declarant.contactName)}</Name>
        ${data.declarant.contactEmail ? `<Communication>
          <SequenceNumeric>1</SequenceNumeric>
          <ID>${this._escapeXml(data.declarant.contactEmail)}</ID>
          <TypeCode>EM</TypeCode>
        </Communication>` : ''}
      </Contact>` : ''}
    </Declarant>
    <GoodsShipment>
      <SequenceNumeric>1</SequenceNumeric>
      <Consignment>
        <TotalGrossMassMeasure>${totalGrossMass}</TotalGrossMassMeasure>
        <GoodsLocation>
          <ID>${customsOffice}</ID>
          <TypeCode>B</TypeCode>
          <IdentificationTypeCode>A</IdentificationTypeCode>
          ${data.goodsLocation?.city ? `<Address>
            <CityName>${this._escapeXml(data.goodsLocation.city)}</CityName>
            <CountryCode>NL</CountryCode>
            ${data.goodsLocation.street ? `<Line>${this._escapeXml(data.goodsLocation.street)}</Line>` : ''}
            ${data.goodsLocation.postalCode ? `<PostcodeID>${this._escapeXml(data.goodsLocation.postalCode)}</PostcodeID>` : ''}
          </Address>` : ''}
        </GoodsLocation>
        <TransportContractDocument>
          <ID>${this._escapeXml(data.transport?.documentRef || '')}</ID>
          <TypeCode>${data.transport?.documentType || 'N740'}</TypeCode>
          <SequenceNumeric>1</SequenceNumeric>
        </TransportContractDocument>
        <UCR>
          <TraderAssignedReferenceID>${this._escapeXml(data.uniqueConsignmentRef || lrn)}</TraderAssignedReferenceID>
        </UCR>
      </Consignment>
      ${data.transportCharges ? `<CustomsValuation>
        <ExitToEntryChargeAmount>${data.transportCharges}</ExitToEntryChargeAmount>
      </CustomsValuation>` : ''}
      ${data.iossNumber ? `<DomesticDutyTaxParty>
        <ID>${this._escapeXml(data.iossNumber)}</ID>
        <RoleCode>FR5</RoleCode>
      </DomesticDutyTaxParty>` : ''}
      <Exporter>
        <Name>${this._escapeXml(data.exporter?.name || '')}</Name>
        <Address>
          <CityName>${this._escapeXml(data.exporter?.address?.city || '')}</CityName>
          <CountryCode>${data.exporter?.country || countryOfDispatch}</CountryCode>
          <Line>${this._escapeXml(data.exporter?.address?.street || '')}</Line>
          <PostcodeID>${this._escapeXml(data.exporter?.address?.postalCode || '')}</PostcodeID>
        </Address>
      </Exporter>
      ${items}
      ${data.previousDocument ? `<PreviousDocument>
        <ID>${this._escapeXml(data.previousDocument.id || '')}</ID>
        <TypeCode>${data.previousDocument.type || '380'}</TypeCode>
        <SequenceNumeric>1</SequenceNumeric>
      </PreviousDocument>` : ''}
      ${(data.supportingDocuments || []).map((doc, di) => `<SupportingDocument>
        <ID>${this._escapeXml(doc.id || '')}</ID>
        <TypeCode>${doc.type || 'N380'}</TypeCode>
        <SequenceNumeric>${di + 1}</SequenceNumeric>
      </SupportingDocument>`).join('')}
    </GoodsShipment>
    <Importer>
      <Name>${this._escapeXml(data.importer?.name || '')}</Name>
      <ID>${this._escapeXml(data.importer?.eori || '')}</ID>
      ${data.importer?.address ? `<Address>
        <CityName>${this._escapeXml(data.importer.address.city || '')}</CityName>
        <CountryCode>${data.importer.address.country || 'NL'}</CountryCode>
        <Line>${this._escapeXml(data.importer.address.street || '')}</Line>
        <PostcodeID>${this._escapeXml(data.importer.address.postalCode || '')}</PostcodeID>
      </Address>` : ''}
    </Importer>
  </Declaration>
</MetaData>`;
  }

  /**
   * Build DMS 1.30 XML - NL MIG DMS 1.30 compliant
   * Based on official XSD: urn:wco:datamodel:WCO:DMS.Declaration:1
   * Reference: docs/nl-migs/DMS-1.30/MIG DMS 1.30/Section 2 (B2DMS)
   */
  _buildDMSXml(data, operationType) {
    logger.info(`NL DMS 1.30 ${operationType} XML builder`);

    const isExport = operationType === 'export';
    const typeCode = data.typeCode || (isExport ? '1' : '1'); // DMS TypeCode is numeric
    const lrn = data.lrn || data.uniqueConsignmentRef || `LRN-${Date.now()}`;
    const currency = data.currency || 'EUR';
    const customsOffice = data.customsOffice || NL_CODES.customsOffices['ROTTERDAM_HAVEN'];
    const countryOfDispatch = data.countryOfDispatch || data.exporter?.country || 'XX';
    const now = new Date();
    const prepDateTime = now.toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z';

    // Build GovernmentAgencyGoodsItem per XSD sequence:
    // CustomsValueAmount, SequenceNumeric, StatisticalValueAmount, TransactionNatureCode,
    // AdditionalReference*, AdditionalInformation*, Commodity, Consignee, CustomsValuation,
    // Destination, ExportCountry, Exporter, GovernmentProcedure, Origin*, Packaging*,
    // PreviousDocument*, SupportingDocument*, UCR, ValuationAdjustment, TransportContractDocument*
    const items = (data.items || []).map((item, idx) => {
      const seqNum = item.itemNumber || (idx + 1);
      const commodityCode = item.commodityCode || '0000000000';
      const taricAdditional = item.taricAdditionalCode || '';
      const nationalAdditional = item.nationalAdditionalCode || '';
      const netMass = item.netMass || 0;
      const grossMass = item.grossMass || 0;
      const itemValue = item.customsValue || item.statisticalValue || 0;
      const procedureCode = item.procedureCode || (isExport ? '10' : '40');
      const previousProcedure = item.previousProcedure || '00';
      let classSeq = 0;

      return `
        <GovernmentAgencyGoodsItem>
          ${itemValue ? `<CustomsValueAmount currencyID="${item.currency || currency}">${itemValue}</CustomsValueAmount>` : ''}
          <SequenceNumeric>${seqNum}</SequenceNumeric>
          ${item.statisticalValue ? `<StatisticalValueAmount>${item.statisticalValue}</StatisticalValueAmount>` : ''}
          <Commodity>
            <Description>${this._escapeXml(item.description || '')}</Description>
            <Classification>
              <SequenceNumeric>${++classSeq}</SequenceNumeric>
              <ID>${commodityCode}</ID>
              <IdentificationTypeCode>TSP</IdentificationTypeCode>
            </Classification>
            ${taricAdditional ? `<Classification>
              <SequenceNumeric>${++classSeq}</SequenceNumeric>
              <ID>${taricAdditional}</ID>
              <IdentificationTypeCode>TRA</IdentificationTypeCode>
            </Classification>` : ''}
            ${nationalAdditional ? `<Classification>
              <SequenceNumeric>${++classSeq}</SequenceNumeric>
              <ID>${nationalAdditional}</ID>
              <IdentificationTypeCode>GN</IdentificationTypeCode>
            </Classification>` : ''}
            <GoodsMeasure>
              <GrossMassMeasure>${grossMass}</GrossMassMeasure>
              <NetNetWeightMeasure>${netMass}</NetNetWeightMeasure>
              ${item.supplementaryUnits ? `<TariffQuantity>${item.supplementaryUnits}</TariffQuantity>` : ''}
            </GoodsMeasure>
            <InvoiceLine>
              <ItemChargeAmount>${itemValue}</ItemChargeAmount>
            </InvoiceLine>
            <TaxCalculation>
              <DutyTaxFee>
                <SequenceNumeric>1</SequenceNumeric>
                <TypeCode>A00</TypeCode>
                <Payment>
                  <MethodCode>${data.paymentMethod || 'E'}</MethodCode>
                </Payment>
              </DutyTaxFee>
              ${!isExport ? `<DutyTaxFee>
                <SequenceNumeric>2</SequenceNumeric>
                <TypeCode>B00</TypeCode>
                <Payment>
                  <MethodCode>${data.paymentMethod || 'E'}</MethodCode>
                </Payment>
              </DutyTaxFee>` : ''}
            </TaxCalculation>
          </Commodity>
          <GovernmentProcedure>
            <CurrentCode>${procedureCode}</CurrentCode>
            <PreviousCode>${previousProcedure}</PreviousCode>
            ${item.additionalProcedure ? `<AdditionalProcedure>
              <SequenceNumeric>1</SequenceNumeric>
              <ProcedureCode>${item.additionalProcedure}</ProcedureCode>
            </AdditionalProcedure>` : ''}
          </GovernmentProcedure>
          <Origin>
            <SequenceNumeric>1</SequenceNumeric>
            <CountryCode>${item.countryOfOrigin || countryOfDispatch}</CountryCode>
            ${item.preferentialOrigin ? `<TypeCode>1</TypeCode>` : ''}
          </Origin>
          <Packaging>
            <SequenceNumeric>1</SequenceNumeric>
            ${item.shippingMarks ? `<MarksNumbersID>${this._escapeXml(item.shippingMarks)}</MarksNumbersID>` : ''}
            <QuantityQuantity>${item.numberOfPackages || 1}</QuantityQuantity>
            <TypeCode>${item.packageType || 'PK'}</TypeCode>
          </Packaging>
          ${item.previousDocument ? `<PreviousDocument>
            <ID>${this._escapeXml(item.previousDocument.id || '')}</ID>
            <TypeCode>${item.previousDocument.type || 'NMRN'}</TypeCode>
            <SequenceNumeric>1</SequenceNumeric>
            ${item.previousDocument.lineNumeric ? `<LineNumeric>${item.previousDocument.lineNumeric}</LineNumeric>` : ''}
          </PreviousDocument>` : ''}
          ${(item.supportingDocuments || []).map((doc, di) => `<SupportingDocument>
            <ID>${this._escapeXml(doc.id || '')}</ID>
            <TypeCode>${doc.type || 'N380'}</TypeCode>
            <SequenceNumeric>${di + 1}</SequenceNumeric>
          </SupportingDocument>`).join('')}
          <UCR>
            <TraderAssignedReferenceID>${this._escapeXml(item.ucr || data.uniqueConsignmentRef || lrn)}</TraderAssignedReferenceID>
          </UCR>
        </GovernmentAgencyGoodsItem>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<MetaData xmlns="urn:wco:datamodel:WCO:DMS.Declaration:1"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="urn:wco:datamodel:WCO:DMS.Declaration:1 DMS.Declaration_1p30.xsd">
  <WCOTypeCode>DMS</WCOTypeCode>
  <CommunicationMetaData>
    <ApplicationReferenceID>${this._escapeXml(lrn)}</ApplicationReferenceID>
    <PreparationDateTime formatCode="304">${prepDateTime}</PreparationDateTime>
    <Recipient>
      <ID>NL</ID>
    </Recipient>
    <Sender>
      <ID>${this._escapeXml(data.declarant?.eori || this.eori || '')}</ID>
    </Sender>
  </CommunicationMetaData>
  <Declaration>
    <FunctionalReferenceID>${this._escapeXml(lrn)}</FunctionalReferenceID>
    <TypeCode>${typeCode}</TypeCode>
    <DeclarationOffice>
      <ID>${customsOffice}</ID>
    </DeclarationOffice>
    ${data.representative ? `<Agent>
      <ID>${this._escapeXml(data.representative.eori || '')}</ID>
      <FunctionCode>${data.representative.status || '2'}</FunctionCode>
    </Agent>` : ''}
    ${(data.authorisations || []).map((auth, ai) => `<Authorisation>
      <ID>${this._escapeXml(auth.id || '')}</ID>
      <TypeCode>${auth.type || '1'}</TypeCode>
      <SequenceNumeric>${ai + 1}</SequenceNumeric>
      ${auth.holderId ? `<AuthorisationHolder>
        <ID>${this._escapeXml(auth.holderId)}</ID>
      </AuthorisationHolder>` : ''}
    </Authorisation>`).join('')}
    <Declarant>
      <Name>${this._escapeXml(data.declarant?.name || '')}</Name>
      <ID>${this._escapeXml(data.declarant?.eori || '')}</ID>
      ${data.declarant?.address ? `<Address>
        <CityName>${this._escapeXml(data.declarant.address.city || '')}</CityName>
        <CountryCode>${data.declarant.address.country || 'NL'}</CountryCode>
        <Line>${this._escapeXml(data.declarant.address.street || '')}</Line>
        <PostcodeID>${this._escapeXml(data.declarant.address.postalCode || '')}</PostcodeID>
      </Address>` : ''}
    </Declarant>
    ${data.deferredPayment ? `<DeferredPayment>
      <ID>${this._escapeXml(data.deferredPayment)}</ID>
    </DeferredPayment>` : ''}
    ${isExport && data.exitOffice ? `<ExitOffice>
      <ID>${this._escapeXml(data.exitOffice)}</ID>
    </ExitOffice>` : ''}
    <Exporter>
      <Name>${this._escapeXml(data.exporter?.name || '')}</Name>
      ${data.exporter?.eori ? `<ID>${this._escapeXml(data.exporter.eori)}</ID>` : ''}
      ${data.exporter?.address ? `<Address>
        <CityName>${this._escapeXml(data.exporter.address.city || '')}</CityName>
        <CountryCode>${data.exporter.country || countryOfDispatch}</CountryCode>
        <Line>${this._escapeXml(data.exporter.address.street || '')}</Line>
        <PostcodeID>${this._escapeXml(data.exporter.address.postalCode || '')}</PostcodeID>
      </Address>` : ''}
    </Exporter>
    <GoodsShipment>
      <SequenceNumeric>1</SequenceNumeric>
      <TransactionNatureCode>${data.transactionNature || '11'}</TransactionNatureCode>
      <DispatchCountryCode>${countryOfDispatch}</DispatchCountryCode>
      ${data.totalCustomsValue ? `<InvoiceAmount>${data.totalCustomsValue}</InvoiceAmount>` : ''}
      ${currency !== 'EUR' ? `<InvoiceCurrencyCode>${currency}</InvoiceCurrencyCode>` : ''}
      <Consignment>
        <ContainerCode>${data.transport?.containerIndicator || '0'}</ContainerCode>
        <TotalGrossMassMeasure>${data.totalGrossMass || 0}</TotalGrossMassMeasure>
        <ArrivalTransportMeans>
          ${data.transport?.borderMeansId ? `<ID>${this._escapeXml(data.transport.borderMeansId)}</ID>` : ''}
          ${data.transport?.borderMeansType ? `<IdentificationTypeCode>${data.transport.borderMeansType}</IdentificationTypeCode>` : ''}
          <ModeCode>${data.transport?.modeAtBorder || '1'}</ModeCode>
        </ArrivalTransportMeans>
        ${data.transport?.borderMeansId ? `<BorderTransportMeans>
          <ID>${this._escapeXml(data.transport.borderMeansId)}</ID>
          ${data.transport.borderMeansType ? `<IdentificationTypeCode>${data.transport.borderMeansType}</IdentificationTypeCode>` : ''}
          ${data.transport.borderNationality ? `<RegistrationNationalityCode>${data.transport.borderNationality}</RegistrationNationalityCode>` : ''}
          <ModeCode>${data.transport.modeAtBorder || '1'}</ModeCode>
        </BorderTransportMeans>` : ''}
        <GoodsLocation>
          <ID>${customsOffice}</ID>
          <TypeCode>B</TypeCode>
          <IdentificationTypeCode>A</IdentificationTypeCode>
          ${data.goodsLocation?.city ? `<Address>
            <CityName>${this._escapeXml(data.goodsLocation.city)}</CityName>
            <CountryCode>NL</CountryCode>
            ${data.goodsLocation.street ? `<Line>${this._escapeXml(data.goodsLocation.street)}</Line>` : ''}
            ${data.goodsLocation.postalCode ? `<PostcodeID>${this._escapeXml(data.goodsLocation.postalCode)}</PostcodeID>` : ''}
          </Address>` : ''}
        </GoodsLocation>
        <TransportContractDocument>
          <ID>${this._escapeXml(data.transport?.documentRef || '')}</ID>
          <TypeCode>${data.transport?.documentType || 'N740'}</TypeCode>
          <SequenceNumeric>1</SequenceNumeric>
        </TransportContractDocument>
        ${data.transport?.containerId ? `<TransportEquipment>
          <SequenceNumeric>1</SequenceNumeric>
          <ID>${this._escapeXml(data.transport.containerId)}</ID>
        </TransportEquipment>` : ''}
        <UCR>
          <TraderAssignedReferenceID>${this._escapeXml(data.uniqueConsignmentRef || lrn)}</TraderAssignedReferenceID>
        </UCR>
      </Consignment>
      <Destination>
        <CountryCode>${data.countryOfDestination || 'NL'}</CountryCode>
      </Destination>
      <ExportCountry>
        <ID>${countryOfDispatch}</ID>
      </ExportCountry>
      <Exporter>
        <Name>${this._escapeXml(data.exporter?.name || '')}</Name>
        ${data.exporter?.eori ? `<ID>${this._escapeXml(data.exporter.eori)}</ID>` : ''}
        ${data.exporter?.address ? `<Address>
          <CityName>${this._escapeXml(data.exporter.address.city || '')}</CityName>
          <CountryCode>${data.exporter.country || countryOfDispatch}</CountryCode>
          <Line>${this._escapeXml(data.exporter.address.street || '')}</Line>
          <PostcodeID>${this._escapeXml(data.exporter.address.postalCode || '')}</PostcodeID>
        </Address>` : ''}
      </Exporter>
      ${items}
      ${(data.previousDocuments || []).map((doc, di) => `<PreviousDocument>
        <ID>${this._escapeXml(doc.id || '')}</ID>
        <TypeCode>${doc.type || '1'}</TypeCode>
        <SequenceNumeric>${di + 1}</SequenceNumeric>
      </PreviousDocument>`).join('')}
      ${(data.supportingDocuments || []).map((doc, di) => `<SupportingDocument>
        <ID>${this._escapeXml(doc.id || '')}</ID>
        <TypeCode>${doc.type || 'N380'}</TypeCode>
        <SequenceNumeric>${di + 1}</SequenceNumeric>
      </SupportingDocument>`).join('')}
      ${data.tradeTerms ? `<TradeTerms>
        <ConditionCode>${this._escapeXml(data.tradeTerms.incoterm || 'CIF')}</ConditionCode>
        ${data.tradeTerms.locationName ? `<LocationName>${this._escapeXml(data.tradeTerms.locationName)}</LocationName>` : ''}
        ${data.tradeTerms.country ? `<CountryCode>${data.tradeTerms.country}</CountryCode>` : ''}
      </TradeTerms>` : ''}
      ${data.warehouse ? `<Warehouse>
        <ID>${this._escapeXml(data.warehouse.id || '')}</ID>
        <TypeCode>${data.warehouse.type || 'U'}</TypeCode>
      </Warehouse>` : ''}
    </GoodsShipment>
    <Importer>
      <Name>${this._escapeXml(data.importer?.name || '')}</Name>
      <ID>${this._escapeXml(data.importer?.eori || '')}</ID>
      ${data.importer?.address ? `<Address>
        <CityName>${this._escapeXml(data.importer.address.city || '')}</CityName>
        <CountryCode>${data.importer.address.country || 'NL'}</CountryCode>
        <Line>${this._escapeXml(data.importer.address.street || '')}</Line>
        <PostcodeID>${this._escapeXml(data.importer.address.postalCode || '')}</PostcodeID>
      </Address>` : ''}
    </Importer>
    ${data.guarantee ? `<ObligationGuarantee>
      <SequenceNumeric>1</SequenceNumeric>
      <SecurityDetailsCode>${data.guarantee.type || '0'}</SecurityDetailsCode>
      <GuaranteeReference>
        <ID>${this._escapeXml(data.guarantee.reference || '')}</ID>
        <SequenceNumeric>1</SequenceNumeric>
        ${data.guarantee.accessCode ? `<AccessCode>${this._escapeXml(data.guarantee.accessCode)}</AccessCode>` : ''}
      </GuaranteeReference>
    </ObligationGuarantee>` : ''}
    ${data.supervisingOffice ? `<SupervisingOffice>
      <ID>${this._escapeXml(data.supervisingOffice)}</ID>
    </SupervisingOffice>` : ''}
  </Declaration>
</MetaData>`;
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
   * Parse Digipoort/DECO/DMS response
   * Handles multiple response formats from Dutch customs
   */
  _parseDigipoortResponse(responseData, declarationType = 'H7') {
    const body = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
    const NL_CODES_EXT = require('./nlCodes');

    // Extract key elements using multiple patterns (DMS can return different formats)
    const extractors = {
      // MRN - multiple possible element names
      mrn: [
        /<MRN>([^<]+)<\/MRN>/,
        /<mrn>([^<]+)<\/mrn>/,
        /<DeclarationReferenceNumber>([^<]+)<\/DeclarationReferenceNumber>/,
        /<ReferenceNumber>([^<]+)<\/ReferenceNumber>/,
      ],
      // Status code
      status: [
        /<statuscode>([^<]+)<\/statuscode>/,
        /<StatusCode>([^<]+)<\/StatusCode>/,
        /<ResponseCode>([^<]+)<\/ResponseCode>/,
        /<resultaat>([^<]+)<\/resultaat>/,
        /<FunctionCode>([^<]+)<\/FunctionCode>/,
      ],
      // Error description
      error: [
        /<foutbeschrijving>([^<]+)<\/foutbeschrijving>/,
        /<ErrorDescription>([^<]+)<\/ErrorDescription>/,
        /<Reason>([^<]+)<\/Reason>/,
        /<faultstring>([^<]+)<\/faultstring>/,
        /<ErrorText>([^<]+)<\/ErrorText>/,
      ],
      // Error code
      errorCode: [
        /<foutcode>([^<]+)<\/foutcode>/,
        /<ErrorCode>([^<]+)<\/ErrorCode>/,
        /<ReasonCode>([^<]+)<\/ReasonCode>/,
      ],
      // Channel/control type
      channel: [
        /<ControlType>([^<]+)<\/ControlType>/,
        /<CustomsIntervention>([^<]+)<\/CustomsIntervention>/,
        /<ControlResult>([^<]+)<\/ControlResult>/,
      ],
      // Declaration ID from Digipoort
      kenmerk: [
        /<kenmerk>([^<]+)<\/kenmerk>/,
        /<berichtkenmerk>([^<]+)<\/berichtkenmerk>/,
        /<MessageIdentification>([^<]+)<\/MessageIdentification>/,
      ],
      // Correction indicators
      correction: [
        /<CorrectionRequired>([^<]+)<\/CorrectionRequired>/,
        /<Amendment>([^<]+)<\/Amendment>/,
      ],
      // Duty/tax amounts
      dutyAmount: [
        /<TotalDutyAmount>([^<]+)<\/TotalDutyAmount>/,
        /<PayableAmount>([^<]+)<\/PayableAmount>/,
      ],
    };

    // Run all extractors
    const extracted = {};
    for (const [key, patterns] of Object.entries(extractors)) {
      for (const pattern of patterns) {
        const match = body.match(pattern);
        if (match) {
          extracted[key] = match[1].trim();
          break;
        }
      }
    }

    // Extract all errors (there can be multiple)
    const allErrors = [];
    const errorPattern = /<(?:Error|Fout|FunctionalError)[^>]*>([\s\S]*?)<\/(?:Error|Fout|FunctionalError)>/g;
    let errorMatch;
    while ((errorMatch = errorPattern.exec(body)) !== null) {
      const errorBlock = errorMatch[1];
      const code = (errorBlock.match(/<(?:ErrorCode|foutcode|Code)>([^<]+)/) || [])[1];
      const desc = (errorBlock.match(/<(?:ErrorDescription|foutbeschrijving|Description|Text)>([^<]+)/) || [])[1];
      const pointer = (errorBlock.match(/<(?:Pointer|ErrorPointer|Location)>([^<]+)/) || [])[1];
      allErrors.push({ code, description: desc, pointer });
    }

    // Determine success
    const statusCode = extracted.status || '';
    const isSuccess = ['OK', '01', '02', '0000', 'ACCEPTED', 'RELEASED', '9'].includes(statusCode.toUpperCase())
      || !!(extracted.mrn && !extracted.errorCode);

    // Map channel
    const channelMap = {
      '00': 'green',   // No control
      '01': 'green',   // Release
      '10': 'orange',  // Document control
      '11': 'red',     // Physical control
      'H1': 'green',
      'H2': 'orange',
      'H3': 'red',
    };
    const channel = channelMap[extracted.channel] || (isSuccess ? 'green' : null);

    // Check if correction is required (NL-specific: declarant must correct)
    const correctionRequired = extracted.correction === 'true' || extracted.correction === '1'
      || statusCode === '04' || statusCode === '06';

    // Build response
    const response = {
      success: isSuccess && !correctionRequired,
      code: statusCode,
      mrn: extracted.mrn || null,
      channel: channel,
      messageId: extracted.kenmerk || null,
      error: extracted.error || (allErrors.length > 0 ? allErrors[0].description : null),
      errorCode: extracted.errorCode || (allErrors.length > 0 ? allErrors[0].code : null),
      errors: allErrors,
      correctionRequired: correctionRequired,
      dutyAmount: extracted.dutyAmount ? parseFloat(extracted.dutyAmount) : null,
      rawResponse: body.substring(0, 3000),
      system: declarationType === 'H7' ? 'DECO' : 'DMS 4.0',
      timestamp: new Date().toISOString(),
    };

    // Add status description from NL codes
    const statusInfo = Object.values(NL_CODES_EXT.responseCodes).find(s => s.code === statusCode);
    if (statusInfo) {
      response.statusDescription = statusInfo.description;
    }

    return response;
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

  /**
   * Submit batch H7 declarations via DECO
   * @param {Array} expeditions - Array of expedition objects
   * @returns {Object} { success, results: [{expeditionId, mrn, success, error}], stats }
   */
  async submitBatchDECO(expeditions) {
    const NLValidation = require('./nlValidation');
    const UCCDataMapper = require('../common/uccDataMapper');

    if (expeditions.length > 10000) {
      return { success: false, error: 'DECO batch max 10,000 declarations' };
    }

    // Validate all first
    const validationResults = [];
    const validExpeditions = [];

    for (const exp of expeditions) {
      const uccData = UCCDataMapper.expeditionToH7(exp);
      const validation = NLValidation.validateDECO(uccData);

      if (validation.valid) {
        validExpeditions.push({ expedition: exp, uccData });
      }
      validationResults.push({
        expeditionId: exp.expeditionId,
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    if (validExpeditions.length === 0) {
      return {
        success: false,
        error: 'No hay declaraciones validas en el batch',
        validationResults
      };
    }

    // Build batch XML
    const batchXml = this._buildBatchDECOXml(validExpeditions.map(v => v.uccData));

    logger.info(`NL DECO Batch: ${validExpeditions.length}/${expeditions.length} validas, enviando...`);

    if (!this.isConfigured()) {
      // Simulate batch response
      const results = validExpeditions.map(v => ({
        expeditionId: v.expedition.expeditionId,
        ...this._simulateResponse('H7', v.expedition.expeditionId)
      }));

      return {
        success: true,
        simulated: true,
        results,
        stats: {
          total: expeditions.length,
          valid: validExpeditions.length,
          invalid: expeditions.length - validExpeditions.length,
          submitted: validExpeditions.length
        },
        validationResults
      };
    }

    // Real submission via Digipoort
    const response = await this._sendViaDigipoort(batchXml, 'DECO');

    // Parse batch response (each declaration gets its own result)
    return {
      success: response.success,
      results: validExpeditions.map((v, idx) => ({
        expeditionId: v.expedition.expeditionId,
        mrn: response.mrn, // In real API, each gets its own MRN
        success: response.success,
      })),
      stats: {
        total: expeditions.length,
        valid: validExpeditions.length,
        invalid: expeditions.length - validExpeditions.length,
        submitted: validExpeditions.length
      },
      validationResults
    };
  }

  /**
   * Build batch DECO XML (multiple declarations)
   * Each declaration is a complete MetaData envelope
   */
  _buildBatchDECOXml(dataArray) {
    const declarations = dataArray.map(data => this._buildDECOXml(data));

    return `<?xml version="1.0" encoding="UTF-8"?>
<DeclarationBatch xmlns="urn:wco:datamodel:WCO:DECO.Declaration:2"
                  totalDeclarations="${declarations.length}">
  ${declarations.map((xml, idx) =>
    `<BatchItem sequenceNumber="${idx + 1}">\n${xml.replace(/<\?xml[^>]*\?>/, '').trim()}\n</BatchItem>`
  ).join('\n  ')}
</DeclarationBatch>`;
  }

  /**
   * Query declaration status via Digipoort
   * Sends a status query message and parses the Response
   * Response namespace: urn:wco:datamodel:WCO:DMS.Response:1 or DECO.Response:2
   */
  async queryStatus(mrn, declarationType = 'H7') {
    if (!this.isConfigured()) {
      return { success: true, status: 'ACCEPTED', mrn, simulated: true, system: declarationType === 'H7' ? 'DECO' : 'DMS' };
    }

    const now = new Date();
    const prepDateTime = now.toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z';
    const isDeco = declarationType === 'H7';
    const ns = isDeco ? 'urn:wco:datamodel:WCO:DECO.Declaration:2' : 'urn:wco:datamodel:WCO:DMS.Declaration:1';
    const processId = isDeco ? 'DECO' : 'DMS4.NL';

    // Status query: send a declaration with the MRN as ID and FunctionCode for query
    const queryXml = `<?xml version="1.0" encoding="UTF-8"?>
<MetaData xmlns="${ns}">
  <WCOTypeCode>${isDeco ? 'DECO' : 'DMS'}</WCOTypeCode>
  <CommunicationMetaData>
    <ApplicationReferenceID>STATUS-${mrn}</ApplicationReferenceID>
    <PreparationDateTime formatCode="304">${prepDateTime}</PreparationDateTime>
    <Recipient>
      <ID>NL</ID>
    </Recipient>
    <Sender>
      <ID>${this._escapeXml(this.eori || '')}</ID>
    </Sender>
  </CommunicationMetaData>
  <Declaration>
    <FunctionalReferenceID>STATUS-${this._escapeXml(mrn)}</FunctionalReferenceID>
    <ID>${this._escapeXml(mrn)}</ID>
    <TypeCode>154</TypeCode>
  </Declaration>
</MetaData>`;

    try {
      const response = await this._sendViaDigipoort(queryXml, processId);
      return {
        success: response.success,
        mrn,
        status: response.code || 'UNKNOWN',
        channel: response.channel,
        correctionRequired: response.correctionRequired || false,
        errors: response.errors || [],
        dutyAmount: response.dutyAmount,
        statusDescription: response.statusDescription,
        system: isDeco ? 'DECO' : 'DMS 4.0',
        rawResponse: response.rawResponse,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`NL status query error for ${mrn}: ${error.message}`);
      return { success: false, mrn, status: 'ERROR', error: error.message };
    }
  }

  /**
   * Amend a declaration via DMS AdditionalMessage
   * Namespace: urn:wco:datamodel:WCO:DMS.AdditionalMessage:1
   * Reference: MIG DMS 1.30 Section 2 (B2DMS)/XmlSchema/2. AddMes
   */
  async amendDeclaration(mrn, data, declarationType = 'H7') {
    if (!this.isConfigured()) {
      return {
        success: true, mrn, simulated: true,
        message: 'Amendment simulated - no PKIoverheid certificate configured'
      };
    }

    const now = new Date();
    const prepDateTime = now.toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z';
    const lrn = data.lrn || `AMEND-${mrn}-${Date.now()}`;
    const isDeco = declarationType === 'H7';

    // AdditionalMessage uses same structure as Declaration but with the MRN as ID
    // and IssueDateTime to indicate when the amendment was created
    const ns = isDeco ? 'urn:wco:datamodel:WCO:DECO.Declaration:2' : 'urn:wco:datamodel:WCO:DMS.AdditionalMessage:1';
    const processId = isDeco ? 'DECO' : 'DMS4.NL';

    // For DECO amendments, resend the full declaration with corrected data
    if (isDeco) {
      const correctedXml = this._buildDECOXml({ ...data, lrn });
      // Replace the FunctionalReferenceID to reference the original MRN
      const amendedXml = correctedXml.replace(
        /<FunctionalReferenceID>[^<]*<\/FunctionalReferenceID>/,
        `<FunctionalReferenceID>${this._escapeXml(lrn)}</FunctionalReferenceID>`
      ).replace(
        /(<Declaration>[\s\S]*?<TypeCode>)154(<\/TypeCode>)/,
        `$1154$2\n    <ID>${this._escapeXml(mrn)}</ID>`
      );

      try {
        const response = await this._sendViaDigipoort(amendedXml, processId);
        return {
          success: response.success,
          mrn: response.mrn || mrn,
          amendmentLrn: lrn,
          system: 'DECO',
          rawResponse: response.rawResponse,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        logger.error(`NL DECO amendment error for ${mrn}: ${error.message}`);
        return { success: false, mrn, error: error.message };
      }
    }

    // For DMS amendments, use AdditionalMessage format
    const amendXml = `<?xml version="1.0" encoding="UTF-8"?>
<MetaData xmlns="${ns}"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="${ns} DMS.AdditionalMessage_1p30.xsd">
  <WCOTypeCode>DMS</WCOTypeCode>
  <CommunicationMetaData>
    <ApplicationReferenceID>${this._escapeXml(lrn)}</ApplicationReferenceID>
    <PreparationDateTime formatCode="304">${prepDateTime}</PreparationDateTime>
    <Recipient>
      <ID>NL</ID>
    </Recipient>
    <Sender>
      <ID>${this._escapeXml(data.declarant?.eori || this.eori || '')}</ID>
    </Sender>
  </CommunicationMetaData>
  <Declaration>
    <FunctionalReferenceID>${this._escapeXml(lrn)}</FunctionalReferenceID>
    <ID>${this._escapeXml(mrn)}</ID>
    <IssueDateTime formatCode="304">${prepDateTime}</IssueDateTime>
    <TypeCode>${data.typeCode || '1'}</TypeCode>
    <DeclarationOffice>
      <ID>${data.customsOffice || NL_CODES.customsOffices['ROTTERDAM_HAVEN']}</ID>
    </DeclarationOffice>
    <Declarant>
      <Name>${this._escapeXml(data.declarant?.name || '')}</Name>
      <ID>${this._escapeXml(data.declarant?.eori || '')}</ID>
    </Declarant>
    <Exporter>
      <Name>${this._escapeXml(data.exporter?.name || '')}</Name>
      ${data.exporter?.eori ? `<ID>${this._escapeXml(data.exporter.eori)}</ID>` : ''}
    </Exporter>
    <GoodsShipment>
      <SequenceNumeric>1</SequenceNumeric>
      ${(data.items || []).map((item, idx) => `<GovernmentAgencyGoodsItem>
        ${item.customsValue ? `<CustomsValueAmount>${item.customsValue}</CustomsValueAmount>` : ''}
        <SequenceNumeric>${item.itemNumber || (idx + 1)}</SequenceNumeric>
        <Commodity>
          <Description>${this._escapeXml(item.description || '')}</Description>
          <Classification>
            <SequenceNumeric>1</SequenceNumeric>
            <ID>${item.commodityCode || ''}</ID>
            <IdentificationTypeCode>TSP</IdentificationTypeCode>
          </Classification>
          <GoodsMeasure>
            <GrossMassMeasure>${item.grossMass || 0}</GrossMassMeasure>
            <NetNetWeightMeasure>${item.netMass || 0}</NetNetWeightMeasure>
          </GoodsMeasure>
        </Commodity>
        <GovernmentProcedure>
          <CurrentCode>${item.procedureCode || '40'}</CurrentCode>
          <PreviousCode>${item.previousProcedure || '00'}</PreviousCode>
        </GovernmentProcedure>
        <Origin>
          <SequenceNumeric>1</SequenceNumeric>
          <CountryCode>${item.countryOfOrigin || 'XX'}</CountryCode>
        </Origin>
        <Packaging>
          <SequenceNumeric>1</SequenceNumeric>
          <QuantityQuantity>${item.numberOfPackages || 1}</QuantityQuantity>
          <TypeCode>${item.packageType || 'PK'}</TypeCode>
        </Packaging>
      </GovernmentAgencyGoodsItem>`).join('')}
    </GoodsShipment>
    <Importer>
      <Name>${this._escapeXml(data.importer?.name || '')}</Name>
      <ID>${this._escapeXml(data.importer?.eori || '')}</ID>
    </Importer>
  </Declaration>
</MetaData>`;

    try {
      const response = await this._sendViaDigipoort(amendXml, processId);
      return {
        success: response.success,
        mrn: response.mrn || mrn,
        amendmentLrn: lrn,
        system: 'DMS 4.0',
        rawResponse: response.rawResponse,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`NL DMS amendment error for ${mrn}: ${error.message}`);
      return { success: false, mrn, error: error.message };
    }
  }

  /**
   * Cancel/invalidate a declaration
   * Uses AdditionalMessage with specific TypeCode for invalidation
   */
  async cancelDeclaration(mrn, reason = '', declarationType = 'H7') {
    if (!this.isConfigured()) {
      return {
        success: true, mrn, simulated: true,
        message: 'Cancellation simulated - no PKIoverheid certificate configured'
      };
    }

    const now = new Date();
    const prepDateTime = now.toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z';
    const lrn = `CANCEL-${mrn}-${Date.now()}`;
    const isDeco = declarationType === 'H7';
    const ns = isDeco ? 'urn:wco:datamodel:WCO:DECO.Declaration:2' : 'urn:wco:datamodel:WCO:DMS.AdditionalMessage:1';
    const processId = isDeco ? 'DECO' : 'DMS4.NL';

    const cancelXml = `<?xml version="1.0" encoding="UTF-8"?>
<MetaData xmlns="${ns}">
  <WCOTypeCode>${isDeco ? 'DECO' : 'DMS'}</WCOTypeCode>
  <CommunicationMetaData>
    <ApplicationReferenceID>${this._escapeXml(lrn)}</ApplicationReferenceID>
    <PreparationDateTime formatCode="304">${prepDateTime}</PreparationDateTime>
    <Recipient>
      <ID>NL</ID>
    </Recipient>
    <Sender>
      <ID>${this._escapeXml(this.eori || '')}</ID>
    </Sender>
  </CommunicationMetaData>
  <Declaration>
    <FunctionalReferenceID>${this._escapeXml(lrn)}</FunctionalReferenceID>
    <ID>${this._escapeXml(mrn)}</ID>
    <AdditionalInformation>
      <SequenceNumeric>1</SequenceNumeric>
      <StatementCode>INV</StatementCode>
      <StatementDescription>${this._escapeXml(reason || 'Request for invalidation')}</StatementDescription>
      <StatementTypeCode>CLE</StatementTypeCode>
    </AdditionalInformation>
  </Declaration>
</MetaData>`;

    try {
      const response = await this._sendViaDigipoort(cancelXml, processId);
      return {
        success: response.success,
        mrn,
        cancellationLrn: lrn,
        system: isDeco ? 'DECO' : 'DMS 4.0',
        rawResponse: response.rawResponse,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`NL cancellation error for ${mrn}: ${error.message}`);
      return { success: false, mrn, error: error.message };
    }
  }

  async validateDeclaration(data, declarationType) {
    const NLValidation = require('./nlValidation');
    const UCCDataMapper = require('../common/uccDataMapper');

    if (declarationType === 'H7') {
      const uccData = UCCDataMapper.expeditionToH7({ ...data, goods: data.goods || data.items });
      return NLValidation.validateDECO(uccData);
    }
    if (declarationType === 'H1') {
      const uccData = UCCDataMapper.expeditionToH1({ ...data, goods: data.goods || data.items });
      return NLValidation.validateDMS(uccData);
    }
    return { valid: true, errors: [], warnings: [] };
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
