/**
 * PUE XML Generator
 * Generador de mensajes XML para Punto Unico de Entrada
 *
 * Tipos de PUE:
 * - ROHS/RAEE: Restriccion de sustancias peligrosas
 * - COM: Seguridad de productos industriales
 * - ECO: Productos ecologicos
 * - CAL: Calidad comercial
 *
 * Endpoint AEAT: https://www7.aeat.es/wlpl/AD44-JDIT/EnvioMensajePUE
 */

const crypto = require('crypto');

// Namespace declarations
const NAMESPACES = {
  pue: 'urn:aeat:adua:pue:v1',
  common: 'urn:aeat:adua:common:v1',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance'
};

// Message types
const MESSAGE_TYPES = {
  REQUEST: 'PUE_REQUEST',
  STATUS_QUERY: 'PUE_STATUS_QUERY',
  COMPLEMENTARY: 'PUE_COMPLEMENTARY',
  CANCELLATION: 'PUE_CANCELLATION'
};

class PUEGenerator {
  constructor() {
    this.version = '1.0';
  }

  /**
   * Generate main PUE request XML
   * @param {Object} pueRequest - PUE request document
   * @param {Object} options - Generation options
   * @returns {string} XML string
   */
  generate(pueRequest, options = {}) {
    const messageId = this._generateMessageId();
    const timestamp = new Date().toISOString();

    // Select builder based on PUE type
    let typeSpecificContent;
    switch (pueRequest.pueType) {
      case 'ROHS':
        typeSpecificContent = this._buildROHSRequest(pueRequest);
        break;
      case 'COM':
        typeSpecificContent = this._buildCOMRequest(pueRequest);
        break;
      case 'ECO':
        typeSpecificContent = this._buildECORequest(pueRequest);
        break;
      case 'CAL':
        typeSpecificContent = this._buildCALRequest(pueRequest);
        break;
      default:
        throw new Error(`Tipo PUE no soportado: ${pueRequest.pueType}`);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<pue:PUERequest xmlns:pue="${NAMESPACES.pue}"
                xmlns:common="${NAMESPACES.common}"
                xmlns:xsi="${NAMESPACES.xsi}">
  <pue:Header>
    <pue:MessageId>${messageId}</pue:MessageId>
    <pue:MessageType>${MESSAGE_TYPES.REQUEST}</pue:MessageType>
    <pue:Timestamp>${timestamp}</pue:Timestamp>
    <pue:Version>${this.version}</pue:Version>
    <pue:PUEType>${pueRequest.pueType}</pue:PUEType>
    ${pueRequest.pueSubtype ? `<pue:PUESubtype>${pueRequest.pueSubtype}</pue:PUESubtype>` : ''}
  </pue:Header>

  <pue:Reference>
    <pue:LocalReference>${pueRequest.reference}</pue:LocalReference>
    ${pueRequest.declarationMRN ? `<pue:DeclarationMRN>${pueRequest.declarationMRN}</pue:DeclarationMRN>` : ''}
    ${pueRequest.ensReference ? `<pue:ENSReference>${pueRequest.ensReference}</pue:ENSReference>` : ''}
  </pue:Reference>

  ${this._buildOperator(pueRequest.operator)}
  ${pueRequest.importer ? this._buildParty('Importer', pueRequest.importer) : ''}
  ${pueRequest.manufacturer ? this._buildParty('Manufacturer', pueRequest.manufacturer) : ''}
  ${pueRequest.representative ? this._buildParty('Representative', pueRequest.representative) : ''}

  ${this._buildCustomsOffice(pueRequest)}
  ${this._buildSOIVREOffice(pueRequest)}

  <pue:GoodsItems>
    ${pueRequest.goods.map((item, idx) => this._buildGoodsItem(item, idx + 1, pueRequest.pueType)).join('\n    ')}
  </pue:GoodsItems>

  <pue:Totals>
    <pue:TotalItems>${pueRequest.totals?.items || pueRequest.goods.length}</pue:TotalItems>
    <pue:TotalGrossMass>${pueRequest.totals?.grossMass || 0}</pue:TotalGrossMass>
    <pue:TotalNetMass>${pueRequest.totals?.netMass || 0}</pue:TotalNetMass>
    <pue:TotalPackages>${pueRequest.totals?.packages || 0}</pue:TotalPackages>
    ${pueRequest.totals?.statisticalValue ? `<pue:TotalStatisticalValue currency="EUR">${pueRequest.totals.statisticalValue}</pue:TotalStatisticalValue>` : ''}
  </pue:Totals>

  ${this._buildTransport(pueRequest.transport)}

  ${typeSpecificContent}

  <pue:Documents>
    ${(pueRequest.attachedDocuments || []).map(doc => this._buildDocument(doc)).join('\n    ')}
  </pue:Documents>

  <pue:Priority>${pueRequest.priority || 'normal'}</pue:Priority>

</pue:PUERequest>`;
  }

  /**
   * Generate status query XML
   * @param {string} pueReference - PUE reference to query
   * @returns {string} XML string
   */
  generateStatusQuery(pueReference) {
    const messageId = this._generateMessageId();
    const timestamp = new Date().toISOString();

    return `<?xml version="1.0" encoding="UTF-8"?>
<pue:PUEStatusQuery xmlns:pue="${NAMESPACES.pue}">
  <pue:Header>
    <pue:MessageId>${messageId}</pue:MessageId>
    <pue:MessageType>${MESSAGE_TYPES.STATUS_QUERY}</pue:MessageType>
    <pue:Timestamp>${timestamp}</pue:Timestamp>
    <pue:Version>${this.version}</pue:Version>
  </pue:Header>
  <pue:PUEReference>${pueReference}</pue:PUEReference>
</pue:PUEStatusQuery>`;
  }

  /**
   * Generate complementary data XML
   * @param {string} pueReference - PUE reference
   * @param {Object} data - Complementary data
   * @returns {string} XML string
   */
  generateComplementaryData(pueReference, data) {
    const messageId = this._generateMessageId();
    const timestamp = new Date().toISOString();

    return `<?xml version="1.0" encoding="UTF-8"?>
<pue:PUEComplementaryData xmlns:pue="${NAMESPACES.pue}">
  <pue:Header>
    <pue:MessageId>${messageId}</pue:MessageId>
    <pue:MessageType>${MESSAGE_TYPES.COMPLEMENTARY}</pue:MessageType>
    <pue:Timestamp>${timestamp}</pue:Timestamp>
    <pue:Version>${this.version}</pue:Version>
  </pue:Header>
  <pue:PUEReference>${pueReference}</pue:PUEReference>
  <pue:ComplementaryData>
    ${data.documents ? `<pue:AdditionalDocuments>
      ${data.documents.map(doc => this._buildDocument(doc)).join('\n      ')}
    </pue:AdditionalDocuments>` : ''}
    ${data.certifications ? `<pue:AdditionalCertifications>
      ${data.certifications.map(cert => this._buildCertification(cert)).join('\n      ')}
    </pue:AdditionalCertifications>` : ''}
    ${data.notes ? `<pue:Notes>${this._escapeXml(data.notes)}</pue:Notes>` : ''}
  </pue:ComplementaryData>
</pue:PUEComplementaryData>`;
  }

  /**
   * Generate cancellation request XML
   * @param {string} pueReference - PUE reference to cancel
   * @param {string} reason - Cancellation reason
   * @returns {string} XML string
   */
  generateCancellation(pueReference, reason) {
    const messageId = this._generateMessageId();
    const timestamp = new Date().toISOString();

    return `<?xml version="1.0" encoding="UTF-8"?>
<pue:PUECancellation xmlns:pue="${NAMESPACES.pue}">
  <pue:Header>
    <pue:MessageId>${messageId}</pue:MessageId>
    <pue:MessageType>${MESSAGE_TYPES.CANCELLATION}</pue:MessageType>
    <pue:Timestamp>${timestamp}</pue:Timestamp>
    <pue:Version>${this.version}</pue:Version>
  </pue:Header>
  <pue:PUEReference>${pueReference}</pue:PUEReference>
  <pue:CancellationReason>${this._escapeXml(reason)}</pue:CancellationReason>
</pue:PUECancellation>`;
  }

  // ============================================
  // TYPE-SPECIFIC BUILDERS
  // ============================================

  /**
   * Build ROHS-specific request content
   */
  _buildROHSRequest(pueRequest) {
    return `<pue:ROHSData>
    <pue:ControlType>ROHS_RAEE</pue:ControlType>
    <pue:Regulation>RD 110/2015</pue:Regulation>
    <pue:ProductCategories>
      ${this._getROHSCategories(pueRequest.goods).map(cat => `<pue:Category>${cat}</pue:Category>`).join('\n      ')}
    </pue:ProductCategories>
    <pue:SubstanceDeclaration>
      <pue:LeadCompliant>true</pue:LeadCompliant>
      <pue:MercuryCompliant>true</pue:MercuryCompliant>
      <pue:CadmiumCompliant>true</pue:CadmiumCompliant>
      <pue:HexavalentChromiumCompliant>true</pue:HexavalentChromiumCompliant>
      <pue:PBBCompliant>true</pue:PBBCompliant>
      <pue:PBDECompliant>true</pue:PBDECompliant>
      <pue:DEHPCompliant>true</pue:DEHPCompliant>
      <pue:BBPCompliant>true</pue:BBPCompliant>
      <pue:DBPCompliant>true</pue:DBPCompliant>
      <pue:DIBPCompliant>true</pue:DIBPCompliant>
    </pue:SubstanceDeclaration>
    <pue:RAEERegistration>
      ${pueRequest.manufacturer?.registrationNumber ? `<pue:ProducerRegistrationNumber>${pueRequest.manufacturer.registrationNumber}</pue:ProducerRegistrationNumber>` : ''}
      <pue:WEEEMarking>true</pue:WEEEMarking>
    </pue:RAEERegistration>
  </pue:ROHSData>`;
  }

  /**
   * Build COM-specific request content
   */
  _buildCOMRequest(pueRequest) {
    const comSubtype = pueRequest.pueSubtype || 'COM_GENERAL';
    const directive = this._getCOMDirective(comSubtype);

    return `<pue:COMData>
    <pue:ControlType>${comSubtype}</pue:ControlType>
    <pue:Directive>${directive}</pue:Directive>
    <pue:CEMarking>
      <pue:Required>true</pue:Required>
      <pue:Present>true</pue:Present>
      ${pueRequest.goods.some(g => g.certifications?.some(c => c.type === 'CE')) ?
        '<pue:NotifiedBodyNumber>' + this._getCENotifiedBody(pueRequest) + '</pue:NotifiedBodyNumber>' : ''}
    </pue:CEMarking>
    <pue:ConformityAssessment>
      <pue:Procedure>ModuleA</pue:Procedure>
      <pue:DeclarationAvailable>true</pue:DeclarationAvailable>
      <pue:TechnicalFileAvailable>true</pue:TechnicalFileAvailable>
    </pue:ConformityAssessment>
    <pue:SafetyRequirements>
      <pue:GeneralSafetyCompliant>true</pue:GeneralSafetyCompliant>
      ${comSubtype === 'COM_JUGUETES' ? '<pue:ToysSafetyCompliant>true</pue:ToysSafetyCompliant>' : ''}
      ${comSubtype === 'COM_EPI' ? '<pue:PPECategoryCompliant>true</pue:PPECategoryCompliant>' : ''}
      ${comSubtype === 'COM_MATERIAL_ELECTRICO' ? '<pue:LVDCompliant>true</pue:LVDCompliant>' : ''}
      ${comSubtype === 'COM_MAQUINARIA' ? '<pue:MachineryDirectiveCompliant>true</pue:MachineryDirectiveCompliant>' : ''}
    </pue:SafetyRequirements>
    <pue:UserInstructions>
      <pue:Language>ES</pue:Language>
      <pue:Available>true</pue:Available>
    </pue:UserInstructions>
  </pue:COMData>`;
  }

  /**
   * Build ECO-specific request content
   */
  _buildECORequest(pueRequest) {
    const ecoCerts = [];
    for (const item of pueRequest.goods) {
      if (item.certifications) {
        ecoCerts.push(...item.certifications.filter(c => ['ECO', 'BIO'].includes(c.type)));
      }
    }

    return `<pue:ECOData>
    <pue:ControlType>ECO_ORGANIC</pue:ControlType>
    <pue:Regulation>Reglamento (UE) 2018/848</pue:Regulation>
    <pue:OrganicCertification>
      ${ecoCerts.length > 0 ? ecoCerts.map(cert => `
      <pue:Certificate>
        <pue:Number>${cert.number || ''}</pue:Number>
        <pue:Issuer>${this._escapeXml(cert.issuer || '')}</pue:Issuer>
        <pue:IssueDate>${cert.issuedAt ? new Date(cert.issuedAt).toISOString().split('T')[0] : ''}</pue:IssueDate>
        ${cert.expiresAt ? `<pue:ExpiryDate>${new Date(cert.expiresAt).toISOString().split('T')[0]}</pue:ExpiryDate>` : ''}
      </pue:Certificate>`).join('') : '<pue:Certificate />'}
    </pue:OrganicCertification>
    <pue:ProductionMethod>
      <pue:Type>ORGANIC</pue:Type>
      <pue:ConversionPeriodCompleted>true</pue:ConversionPeriodCompleted>
    </pue:ProductionMethod>
    <pue:ControlBody>
      <pue:Code>${this._getEcoControlBody(pueRequest)}</pue:Code>
      <pue:Country>${pueRequest.goods[0]?.countryOfOrigin || 'XX'}</pue:Country>
    </pue:ControlBody>
    <pue:ImportAuthorization>
      <pue:Required>${this._isEcoImportAuthRequired(pueRequest) ? 'true' : 'false'}</pue:Required>
      ${pueRequest.ecoAuthorization ? `<pue:Number>${pueRequest.ecoAuthorization}</pue:Number>` : ''}
    </pue:ImportAuthorization>
    <pue:Traceability>
      <pue:LotNumbers>${pueRequest.goods.map(g => g.batchNumber).filter(Boolean).join(', ')}</pue:LotNumbers>
      <pue:TraceabilityDocumentAvailable>true</pue:TraceabilityDocumentAvailable>
    </pue:Traceability>
  </pue:ECOData>`;
  }

  /**
   * Build CAL-specific request content
   */
  _buildCALRequest(pueRequest) {
    const calSubtype = pueRequest.pueSubtype || 'CAL_GENERAL';

    return `<pue:CALData>
    <pue:ControlType>${calSubtype}</pue:ControlType>
    <pue:Regulation>Ley 21/1992</pue:Regulation>
    <pue:Labelling>
      <pue:Required>true</pue:Required>
      <pue:SpanishLanguage>true</pue:SpanishLanguage>
      <pue:Composition>true</pue:Composition>
      <pue:Origin>true</pue:Origin>
      <pue:CareInstructions>${['CAL_TEXTIL', 'CAL_CALZADO'].includes(calSubtype) ? 'true' : 'false'}</pue:CareInstructions>
    </pue:Labelling>
    <pue:CompositionDeclaration>
      ${this._getCompositionData(pueRequest)}
    </pue:CompositionDeclaration>
    <pue:QualityStandards>
      ${calSubtype === 'CAL_TEXTIL' ? '<pue:TextileStandard>EN 13402</pue:TextileStandard>' : ''}
      ${calSubtype === 'CAL_CALZADO' ? '<pue:FootwearStandard>EN ISO 18454</pue:FootwearStandard>' : ''}
      ${calSubtype === 'CAL_CERAMICA' ? '<pue:CeramicStandard>EN 14411</pue:CeramicStandard>' : ''}
      ${calSubtype === 'CAL_VIDRIO' ? '<pue:GlassStandard>EN 12150</pue:GlassStandard>' : ''}
      ${calSubtype === 'CAL_MUEBLES' ? '<pue:FurnitureStandard>EN 527</pue:FurnitureStandard>' : ''}
    </pue:QualityStandards>
  </pue:CALData>`;
  }

  // ============================================
  // COMMON BUILDERS
  // ============================================

  _buildOperator(operator) {
    if (!operator) return '';

    return `<pue:Operator>
    ${operator.eori ? `<pue:EORI>${operator.eori}</pue:EORI>` : ''}
    ${operator.nif ? `<pue:NIF>${operator.nif}</pue:NIF>` : ''}
    <pue:Name>${this._escapeXml(operator.name)}</pue:Name>
    ${this._buildAddress(operator.address)}
    ${operator.contactPerson ? `<pue:ContactPerson>${this._escapeXml(operator.contactPerson)}</pue:ContactPerson>` : ''}
    ${operator.phone ? `<pue:Phone>${operator.phone}</pue:Phone>` : ''}
    ${operator.email ? `<pue:Email>${operator.email}</pue:Email>` : ''}
  </pue:Operator>`;
  }

  _buildParty(elementName, party) {
    if (!party) return '';

    return `<pue:${elementName}>
    ${party.eori ? `<pue:EORI>${party.eori}</pue:EORI>` : ''}
    ${party.nif ? `<pue:NIF>${party.nif}</pue:NIF>` : ''}
    <pue:Name>${this._escapeXml(party.name)}</pue:Name>
    ${this._buildAddress(party.address)}
    ${party.contactPerson ? `<pue:ContactPerson>${this._escapeXml(party.contactPerson)}</pue:ContactPerson>` : ''}
    ${party.phone ? `<pue:Phone>${party.phone}</pue:Phone>` : ''}
    ${party.email ? `<pue:Email>${party.email}</pue:Email>` : ''}
  </pue:${elementName}>`;
  }

  _buildAddress(address) {
    if (!address) return '';

    return `<pue:Address>
      ${address.streetAndNumber ? `<pue:Street>${this._escapeXml(address.streetAndNumber)}</pue:Street>` : ''}
      ${address.city ? `<pue:City>${this._escapeXml(address.city)}</pue:City>` : ''}
      ${address.postalCode ? `<pue:PostalCode>${address.postalCode}</pue:PostalCode>` : ''}
      ${address.province ? `<pue:Province>${this._escapeXml(address.province)}</pue:Province>` : ''}
      ${address.country ? `<pue:Country>${address.country}</pue:Country>` : ''}
    </pue:Address>`;
  }

  _buildCustomsOffice(pueRequest) {
    if (!pueRequest.customsOffice?.code) return '';

    return `<pue:CustomsOffice>
    <pue:Code>${pueRequest.customsOffice.code}</pue:Code>
    ${pueRequest.customsOffice.name ? `<pue:Name>${this._escapeXml(pueRequest.customsOffice.name)}</pue:Name>` : ''}
  </pue:CustomsOffice>`;
  }

  _buildSOIVREOffice(pueRequest) {
    if (!pueRequest.soivreOffice?.code) return '';

    return `<pue:SOIVREOffice>
    <pue:Code>${pueRequest.soivreOffice.code}</pue:Code>
    ${pueRequest.soivreOffice.name ? `<pue:Name>${this._escapeXml(pueRequest.soivreOffice.name)}</pue:Name>` : ''}
    ${pueRequest.soivreOffice.province ? `<pue:Province>${this._escapeXml(pueRequest.soivreOffice.province)}</pue:Province>` : ''}
  </pue:SOIVREOffice>`;
  }

  _buildGoodsItem(item, sequence, pueType) {
    return `<pue:GoodsItem>
      <pue:SequenceNumber>${sequence}</pue:SequenceNumber>
      <pue:TARICCode>${item.taricCode}</pue:TARICCode>
      <pue:Description>${this._escapeXml(item.description)}</pue:Description>
      ${item.quantity ? `<pue:Quantity unit="${item.unitOfMeasure || 'PCE'}">${item.quantity}</pue:Quantity>` : ''}
      ${item.grossMass ? `<pue:GrossMass>${item.grossMass}</pue:GrossMass>` : ''}
      ${item.netMass ? `<pue:NetMass>${item.netMass}</pue:NetMass>` : ''}
      ${item.statisticalValue ? `<pue:StatisticalValue currency="EUR">${item.statisticalValue}</pue:StatisticalValue>` : ''}
      ${item.countryOfOrigin ? `<pue:CountryOfOrigin>${item.countryOfOrigin}</pue:CountryOfOrigin>` : ''}
      ${item.brand ? `<pue:Brand>${this._escapeXml(item.brand)}</pue:Brand>` : ''}
      ${item.model ? `<pue:Model>${this._escapeXml(item.model)}</pue:Model>` : ''}
      ${item.serialNumber ? `<pue:SerialNumber>${item.serialNumber}</pue:SerialNumber>` : ''}
      ${item.batchNumber ? `<pue:BatchNumber>${item.batchNumber}</pue:BatchNumber>` : ''}
      ${item.manufacturer ? this._buildManufacturerElement(item.manufacturer) : ''}
      ${item.certifications && item.certifications.length > 0 ?
        `<pue:Certifications>
        ${item.certifications.map(cert => this._buildCertification(cert)).join('\n        ')}
      </pue:Certifications>` : ''}
      ${item.numberOfPackages ? `<pue:NumberOfPackages>${item.numberOfPackages}</pue:NumberOfPackages>` : ''}
      ${item.kindOfPackages ? `<pue:KindOfPackages>${item.kindOfPackages}</pue:KindOfPackages>` : ''}
      ${item.marksAndNumbers ? `<pue:MarksAndNumbers>${this._escapeXml(item.marksAndNumbers)}</pue:MarksAndNumbers>` : ''}
      ${this._buildTypeSpecificGoodsData(item, pueType)}
    </pue:GoodsItem>`;
  }

  _buildManufacturerElement(manufacturer) {
    return `<pue:Manufacturer>
        <pue:Name>${this._escapeXml(manufacturer.name || '')}</pue:Name>
        ${manufacturer.country ? `<pue:Country>${manufacturer.country}</pue:Country>` : ''}
        ${manufacturer.registrationNumber ? `<pue:RegistrationNumber>${manufacturer.registrationNumber}</pue:RegistrationNumber>` : ''}
      </pue:Manufacturer>`;
  }

  _buildCertification(cert) {
    return `<pue:Certification>
        <pue:Type>${cert.type}</pue:Type>
        ${cert.number ? `<pue:Number>${cert.number}</pue:Number>` : ''}
        ${cert.issuer ? `<pue:Issuer>${this._escapeXml(cert.issuer)}</pue:Issuer>` : ''}
        ${cert.issuedAt ? `<pue:IssuedDate>${new Date(cert.issuedAt).toISOString().split('T')[0]}</pue:IssuedDate>` : ''}
        ${cert.expiresAt ? `<pue:ExpiryDate>${new Date(cert.expiresAt).toISOString().split('T')[0]}</pue:ExpiryDate>` : ''}
        <pue:Status>${cert.status || 'pending_validation'}</pue:Status>
      </pue:Certification>`;
  }

  _buildTypeSpecificGoodsData(item, pueType) {
    switch (pueType) {
      case 'ROHS':
        return item.hazardousComponents && item.hazardousComponents.length > 0 ?
          `<pue:HazardousComponents>
          ${item.hazardousComponents.map(h => `<pue:Component>
            <pue:Substance>${this._escapeXml(h.substance)}</pue:Substance>
            ${h.casNumber ? `<pue:CASNumber>${h.casNumber}</pue:CASNumber>` : ''}
            ${h.concentration ? `<pue:Concentration unit="${h.unit || 'ppm'}">${h.concentration}</pue:Concentration>` : ''}
          </pue:Component>`).join('\n          ')}
        </pue:HazardousComponents>` : '';

      case 'ECO':
        return item.productCategory ?
          `<pue:OrganicCategory>${item.productCategory}</pue:OrganicCategory>` : '';

      case 'CAL':
        return item.subCategory ?
          `<pue:QualityCategory>${item.subCategory}</pue:QualityCategory>` : '';

      default:
        return '';
    }
  }

  _buildTransport(transport) {
    if (!transport) return '';

    return `<pue:Transport>
    <pue:Mode>${transport.mode}</pue:Mode>
    ${transport.documentType ? `<pue:DocumentType>${transport.documentType}</pue:DocumentType>` : ''}
    ${transport.documentNumber ? `<pue:DocumentNumber>${transport.documentNumber}</pue:DocumentNumber>` : ''}
    ${transport.containerNumber ? `<pue:ContainerNumber>${transport.containerNumber}</pue:ContainerNumber>` : ''}
    ${transport.sealNumber ? `<pue:SealNumber>${transport.sealNumber}</pue:SealNumber>` : ''}
    ${transport.vehicleRegistration ? `<pue:VehicleRegistration>${transport.vehicleRegistration}</pue:VehicleRegistration>` : ''}
    ${transport.vesselName ? `<pue:VesselName>${this._escapeXml(transport.vesselName)}</pue:VesselName>` : ''}
    ${transport.flightNumber ? `<pue:FlightNumber>${transport.flightNumber}</pue:FlightNumber>` : ''}
    ${transport.arrivalDate ? `<pue:ArrivalDate>${new Date(transport.arrivalDate).toISOString()}</pue:ArrivalDate>` : ''}
    ${transport.expectedArrivalDate ? `<pue:ExpectedArrivalDate>${new Date(transport.expectedArrivalDate).toISOString()}</pue:ExpectedArrivalDate>` : ''}
    ${transport.unloadingPlace ? `<pue:UnloadingPlace>${this._escapeXml(transport.unloadingPlace)}</pue:UnloadingPlace>` : ''}
  </pue:Transport>`;
  }

  _buildDocument(doc) {
    return `<pue:Document>
      <pue:Type>${doc.type}</pue:Type>
      ${doc.name ? `<pue:Name>${this._escapeXml(doc.name)}</pue:Name>` : ''}
      ${doc.documentNumber ? `<pue:Number>${doc.documentNumber}</pue:Number>` : ''}
      ${doc.url ? `<pue:URL>${doc.url}</pue:URL>` : ''}
      ${doc.uploadedAt ? `<pue:UploadDate>${new Date(doc.uploadedAt).toISOString()}</pue:UploadDate>` : ''}
    </pue:Document>`;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  _generateMessageId() {
    return `PUE${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  _escapeXml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  _getROHSCategories(goods) {
    const categories = new Set();
    for (const item of goods) {
      const taric = item.taricCode || '';
      // Map TARIC to ROHS/WEEE categories
      if (taric.startsWith('8418')) categories.add('1'); // Large cooling appliances
      if (taric.startsWith('8450') || taric.startsWith('8451')) categories.add('2'); // Large household appliances
      if (taric.startsWith('8509') || taric.startsWith('8510')) categories.add('2'); // Small household appliances
      if (taric.startsWith('8471') || taric.startsWith('8517')) categories.add('3'); // IT equipment
      if (taric.startsWith('8521') || taric.startsWith('8528')) categories.add('4'); // Consumer equipment
      if (taric.startsWith('9405')) categories.add('5'); // Lighting
      if (taric.startsWith('8467')) categories.add('6'); // Electrical tools
      if (taric.startsWith('9504')) categories.add('7'); // Toys
      if (taric.startsWith('9018') || taric.startsWith('9019')) categories.add('8'); // Medical devices
      if (taric.startsWith('9027') || taric.startsWith('9030')) categories.add('9'); // Monitoring instruments
      if (taric.startsWith('8476')) categories.add('10'); // Automatic dispensers
    }
    return Array.from(categories);
  }

  _getCOMDirective(subtype) {
    const directives = {
      'COM_JUGUETES': '2009/48/EC',
      'COM_EPI': '(EU) 2016/425',
      'COM_MATERIAL_ELECTRICO': '2014/35/EU',
      'COM_MAQUINARIA': '2006/42/EC',
      'COM_EXPLOSIVOS': '2014/28/EU',
      'COM_GAS': '2016/426/EU',
      'COM_GENERAL': '2001/95/EC'
    };
    return directives[subtype] || '2001/95/EC';
  }

  _getCENotifiedBody(pueRequest) {
    for (const item of pueRequest.goods) {
      const ceCert = item.certifications?.find(c => c.type === 'CE');
      if (ceCert && ceCert.issuer) {
        // Extract notified body number if present
        const match = ceCert.issuer.match(/\d{4}/);
        if (match) return match[0];
      }
    }
    return '';
  }

  _getEcoControlBody(pueRequest) {
    for (const item of pueRequest.goods) {
      const ecoCert = item.certifications?.find(c => ['ECO', 'BIO'].includes(c.type));
      if (ecoCert && ecoCert.issuer) {
        return ecoCert.issuer;
      }
    }
    return 'ES-ECO-XXX';
  }

  _isEcoImportAuthRequired(pueRequest) {
    // Check if origin country is outside EU equivalence list
    const euEquivalent = ['AR', 'AU', 'CA', 'CH', 'CL', 'CR', 'IN', 'IL', 'JP', 'KR', 'NZ', 'TN', 'US'];
    const origins = pueRequest.goods.map(g => g.countryOfOrigin).filter(Boolean);
    return origins.some(o => !euEquivalent.includes(o) && !o.startsWith('EU'));
  }

  _getCompositionData(pueRequest) {
    const compositions = [];
    for (const item of pueRequest.goods) {
      if (item.description) {
        compositions.push(`<pue:Item>
        <pue:Description>${this._escapeXml(item.description)}</pue:Description>
        ${item.productCategory ? `<pue:Composition>${this._escapeXml(item.productCategory)}</pue:Composition>` : ''}
      </pue:Item>`);
      }
    }
    return compositions.join('\n      ');
  }
}

module.exports = new PUEGenerator();
