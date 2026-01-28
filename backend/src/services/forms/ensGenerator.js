/**
 * ENS XML Generator
 * Generador de mensajes XML para ICS2 (Entry Summary Declaration)
 *
 * Mensajes soportados:
 * - CC315C: Presentacion ENS (Road/Rail)
 * - CC313C: Rectificacion ENS
 * - CC305C: Notificacion de llegada
 * - CC328C: Anulacion
 *
 * Normativa: ICS2 Release 3 - Guia tecnica AEAT
 */

class ENSGenerator {

  constructor() {
    // Namespace ICS2
    this.namespaces = {
      ics2: 'urn:wco:datamodel:WCO:DocumentMetaData-DMS:2',
      ie: 'http://ics2.dgtaxud.ec/ie',
      md: 'urn:wco:datamodel:WCO:DEC-DMS:2'
    };

    // Version del mensaje
    this.messageVersion = '3.0';
  }

  /**
   * Generar XML de presentacion ENS (CC315C)
   */
  generate(declaration, options = {}) {
    try {
      const timestamp = new Date().toISOString();
      const messageId = this._generateMessageId('ENS');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ie:CC315C xmlns:ie="${this.namespaces.ie}" xmlns:md="${this.namespaces.md}">
  <md:MessageMetaData>
    <md:MessageIdentifier>${messageId}</md:MessageIdentifier>
    <md:MessageType>CC315C</md:MessageType>
    <md:MessageDateTime>${timestamp}</md:MessageDateTime>
    <md:MessageSender>LUCI-Customs-Agent</md:MessageSender>
    <md:MessageRecipient>ES.AEAT.ICS2</md:MessageRecipient>
    <md:MessageVersion>${this.messageVersion}</md:MessageVersion>
  </md:MessageMetaData>

  <ie:TransitOperation>
    <ie:LRN>${declaration.lrn}</ie:LRN>
    <ie:DeclarationType>${declaration.declarationType || 'ENS'}</ie:DeclarationType>
  </ie:TransitOperation>

  ${this._buildCustomsOfficeOfFirstEntry(declaration.entryOffice)}

  ${this._buildCarrier(declaration.carrier)}

  ${this._buildTransportMeans(declaration.transportMeans, declaration.transportMode)}

  ${this._buildConsignment(declaration)}

  ${this._buildConsignor(declaration.consignor)}

  ${this._buildConsignee(declaration.consignee)}

  ${declaration.houseConsignments?.length > 0 ?
    this._buildHouseConsignments(declaration.houseConsignments) :
    this._buildGoodsItems(declaration.goods)}

</ie:CC315C>`;

      return {
        success: true,
        xml: this._cleanXML(xml),
        messageId,
        messageType: 'CC315C'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generar XML de rectificacion (CC313C)
   */
  generateAmendment(originalMRN, amendments, options = {}) {
    try {
      const timestamp = new Date().toISOString();
      const messageId = this._generateMessageId('AMD');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ie:CC313C xmlns:ie="${this.namespaces.ie}" xmlns:md="${this.namespaces.md}">
  <md:MessageMetaData>
    <md:MessageIdentifier>${messageId}</md:MessageIdentifier>
    <md:MessageType>CC313C</md:MessageType>
    <md:MessageDateTime>${timestamp}</md:MessageDateTime>
    <md:MessageSender>LUCI-Customs-Agent</md:MessageSender>
    <md:MessageRecipient>ES.AEAT.ICS2</md:MessageRecipient>
    <md:MessageVersion>${this.messageVersion}</md:MessageVersion>
  </md:MessageMetaData>

  <ie:TransitOperation>
    <ie:MRN>${originalMRN}</ie:MRN>
    <ie:AmendmentType>1</ie:AmendmentType>
    <ie:AmendmentReason>${this._escapeXML(amendments.reason || 'Rectificacion')}</ie:AmendmentReason>
  </ie:TransitOperation>

  ${amendments.entryOffice ? this._buildCustomsOfficeOfFirstEntry(amendments.entryOffice) : ''}

  ${amendments.carrier ? this._buildCarrier(amendments.carrier) : ''}

  ${amendments.transportMeans ? this._buildTransportMeans(amendments.transportMeans, amendments.transportMode) : ''}

  ${amendments.consignment ? `
  <ie:Consignment>
    ${amendments.consignment.referenceNumber ? `<ie:ReferenceNumber>${this._escapeXML(amendments.consignment.referenceNumber)}</ie:ReferenceNumber>` : ''}
    ${amendments.consignment.grossMass ? `<ie:GrossMass>${amendments.consignment.grossMass}</ie:GrossMass>` : ''}
    ${amendments.consignment.numberOfPackages ? `<ie:NumberOfPackages>${amendments.consignment.numberOfPackages}</ie:NumberOfPackages>` : ''}
  </ie:Consignment>` : ''}

</ie:CC313C>`;

      return {
        success: true,
        xml: this._cleanXML(xml),
        messageId,
        messageType: 'CC313C'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generar XML de notificacion de llegada (CC305C)
   */
  generateArrivalNotification(mrn, arrivalData) {
    try {
      const timestamp = new Date().toISOString();
      const messageId = this._generateMessageId('ARR');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ie:CC305C xmlns:ie="${this.namespaces.ie}" xmlns:md="${this.namespaces.md}">
  <md:MessageMetaData>
    <md:MessageIdentifier>${messageId}</md:MessageIdentifier>
    <md:MessageType>CC305C</md:MessageType>
    <md:MessageDateTime>${timestamp}</md:MessageDateTime>
    <md:MessageSender>LUCI-Customs-Agent</md:MessageSender>
    <md:MessageRecipient>ES.AEAT.ICS2</md:MessageRecipient>
    <md:MessageVersion>${this.messageVersion}</md:MessageVersion>
  </md:MessageMetaData>

  <ie:TransitOperation>
    <ie:MRN>${mrn}</ie:MRN>
  </ie:TransitOperation>

  <ie:ArrivalNotification>
    <ie:ActualDateTimeOfArrival>${arrivalData.actualArrival || timestamp}</ie:ActualDateTimeOfArrival>
    ${arrivalData.presentationOffice ? `
    <ie:CustomsOfficeOfPresentation>
      <ie:ReferenceNumber>${arrivalData.presentationOffice.code}</ie:ReferenceNumber>
    </ie:CustomsOfficeOfPresentation>` : ''}
    ${arrivalData.unloadingPlace ? `
    <ie:UnloadingPlace>
      <ie:Description>${this._escapeXML(arrivalData.unloadingPlace)}</ie:Description>
    </ie:UnloadingPlace>` : ''}
  </ie:ArrivalNotification>

</ie:CC305C>`;

      return {
        success: true,
        xml: this._cleanXML(xml),
        messageId,
        messageType: 'CC305C'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generar XML de anulacion (CC328C)
   */
  generateCancellation(mrn, reason) {
    try {
      const timestamp = new Date().toISOString();
      const messageId = this._generateMessageId('CAN');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ie:CC328C xmlns:ie="${this.namespaces.ie}" xmlns:md="${this.namespaces.md}">
  <md:MessageMetaData>
    <md:MessageIdentifier>${messageId}</md:MessageIdentifier>
    <md:MessageType>CC328C</md:MessageType>
    <md:MessageDateTime>${timestamp}</md:MessageDateTime>
    <md:MessageSender>LUCI-Customs-Agent</md:MessageSender>
    <md:MessageRecipient>ES.AEAT.ICS2</md:MessageRecipient>
    <md:MessageVersion>${this.messageVersion}</md:MessageVersion>
  </md:MessageMetaData>

  <ie:TransitOperation>
    <ie:MRN>${mrn}</ie:MRN>
    <ie:CancellationReason>${this._escapeXML(reason || 'Anulacion solicitada')}</ie:CancellationReason>
    <ie:CancellationDateTime>${timestamp}</ie:CancellationDateTime>
  </ie:TransitOperation>

</ie:CC328C>`;

      return {
        success: true,
        xml: this._cleanXML(xml),
        messageId,
        messageType: 'CC328C'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ============== BUILDERS PRIVADOS ==============

  /**
   * Construir bloque de aduana de entrada
   */
  _buildCustomsOfficeOfFirstEntry(entryOffice) {
    if (!entryOffice) return '';

    return `
  <ie:CustomsOfficeOfFirstEntry>
    <ie:ReferenceNumber>${entryOffice.code}</ie:ReferenceNumber>
    ${entryOffice.expectedArrival ? `<ie:ExpectedDateTimeOfArrival>${new Date(entryOffice.expectedArrival).toISOString()}</ie:ExpectedDateTimeOfArrival>` : ''}
  </ie:CustomsOfficeOfFirstEntry>`;
  }

  /**
   * Construir bloque de transportista
   */
  _buildCarrier(carrier) {
    if (!carrier) return '';

    return `
  <ie:Carrier>
    <ie:IdentificationNumber>${carrier.eori}</ie:IdentificationNumber>
    ${carrier.name ? `<ie:Name>${this._escapeXML(carrier.name)}</ie:Name>` : ''}
    ${carrier.address ? this._buildAddress(carrier.address) : ''}
  </ie:Carrier>`;
  }

  /**
   * Construir bloque de medio de transporte
   */
  _buildTransportMeans(transportMeans, transportMode) {
    if (!transportMeans) return '';

    const modeCode = this._getTransportModeCode(transportMode);

    return `
  <ie:TransportMeansAtBorder>
    <ie:ModeOfTransportAtBorderCode>${modeCode}</ie:ModeOfTransportAtBorderCode>
    <ie:IdentificationType>${this._getIdentificationType(transportMeans.identificationType)}</ie:IdentificationType>
    <ie:IdentificationNumber>${this._escapeXML(transportMeans.identification)}</ie:IdentificationNumber>
    ${transportMeans.nationality ? `<ie:Nationality>${transportMeans.nationality}</ie:Nationality>` : ''}
  </ie:TransportMeansAtBorder>`;
  }

  /**
   * Construir bloque de consignment
   */
  _buildConsignment(declaration) {
    const consignment = declaration.consignment;
    if (!consignment) return '';

    return `
  <ie:Consignment>
    <ie:ReferenceNumber>${this._escapeXML(consignment.referenceNumber)}</ie:ReferenceNumber>
    ${consignment.referenceType ? `<ie:ReferenceType>${consignment.referenceType}</ie:ReferenceType>` : ''}
    <ie:GrossMass>${consignment.grossMass}</ie:GrossMass>
    <ie:NumberOfPackages>${consignment.numberOfPackages}</ie:NumberOfPackages>
    <ie:GoodsDescription>${this._escapeXML(consignment.goodsDescription)}</ie:GoodsDescription>
    ${consignment.containerNumber ? `
    <ie:TransportEquipment>
      <ie:ContainerIdentificationNumber>${consignment.containerNumber}</ie:ContainerIdentificationNumber>
      ${consignment.sealNumber ? `<ie:SealNumber>${consignment.sealNumber}</ie:SealNumber>` : ''}
    </ie:TransportEquipment>` : ''}
    ${consignment.countryOfDispatch ? `<ie:CountryOfDispatch>${consignment.countryOfDispatch}</ie:CountryOfDispatch>` : ''}
    ${consignment.countryOfDestination ? `<ie:CountryOfDestination>${consignment.countryOfDestination}</ie:CountryOfDestination>` : ''}
    ${consignment.ucr ? `<ie:UCR>${this._escapeXML(consignment.ucr)}</ie:UCR>` : ''}
  </ie:Consignment>`;
  }

  /**
   * Construir bloque de consignor
   */
  _buildConsignor(consignor) {
    if (!consignor) return '';

    return `
  <ie:Consignor>
    ${consignor.eori ? `<ie:IdentificationNumber>${consignor.eori}</ie:IdentificationNumber>` : ''}
    ${consignor.name ? `<ie:Name>${this._escapeXML(consignor.name)}</ie:Name>` : ''}
    ${consignor.address ? this._buildAddress(consignor.address) : ''}
    ${consignor.contactPerson ? `<ie:ContactPerson>${this._escapeXML(consignor.contactPerson)}</ie:ContactPerson>` : ''}
  </ie:Consignor>`;
  }

  /**
   * Construir bloque de consignee
   */
  _buildConsignee(consignee) {
    if (!consignee) return '';

    return `
  <ie:Consignee>
    ${consignee.eori ? `<ie:IdentificationNumber>${consignee.eori}</ie:IdentificationNumber>` : ''}
    ${consignee.name ? `<ie:Name>${this._escapeXML(consignee.name)}</ie:Name>` : ''}
    ${consignee.address ? this._buildAddress(consignee.address) : ''}
    ${consignee.contactPerson ? `<ie:ContactPerson>${this._escapeXML(consignee.contactPerson)}</ie:ContactPerson>` : ''}
  </ie:Consignee>`;
  }

  /**
   * Construir bloque de direccion
   */
  _buildAddress(address) {
    if (!address) return '';

    return `
    <ie:Address>
      ${address.streetAndNumber ? `<ie:StreetAndNumber>${this._escapeXML(address.streetAndNumber)}</ie:StreetAndNumber>` : ''}
      ${address.city ? `<ie:City>${this._escapeXML(address.city)}</ie:City>` : ''}
      ${address.postalCode ? `<ie:PostalCode>${address.postalCode}</ie:PostalCode>` : ''}
      ${address.country ? `<ie:Country>${address.country}</ie:Country>` : ''}
    </ie:Address>`;
  }

  /**
   * Construir house consignments (grupaje)
   */
  _buildHouseConsignments(houses) {
    if (!houses || houses.length === 0) return '';

    return houses.map((house, index) => `
  <ie:HouseConsignment>
    <ie:SequenceNumber>${house.sequenceNumber || index + 1}</ie:SequenceNumber>
    <ie:ReferenceNumber>${this._escapeXML(house.referenceNumber)}</ie:ReferenceNumber>
    ${house.grossMass ? `<ie:GrossMass>${house.grossMass}</ie:GrossMass>` : ''}
    ${house.numberOfPackages ? `<ie:NumberOfPackages>${house.numberOfPackages}</ie:NumberOfPackages>` : ''}
    ${house.consignor ? this._buildConsignor(house.consignor) : ''}
    ${house.consignee ? this._buildConsignee(house.consignee) : ''}
    ${house.notifyParty ? `
    <ie:NotifyParty>
      ${house.notifyParty.eori ? `<ie:IdentificationNumber>${house.notifyParty.eori}</ie:IdentificationNumber>` : ''}
      ${house.notifyParty.name ? `<ie:Name>${this._escapeXML(house.notifyParty.name)}</ie:Name>` : ''}
    </ie:NotifyParty>` : ''}
    ${this._buildGoodsItems(house.goods, true)}
  </ie:HouseConsignment>`).join('');
  }

  /**
   * Construir items de mercancia
   */
  _buildGoodsItems(goods, nested = false) {
    if (!goods || goods.length === 0) return '';

    const indent = nested ? '    ' : '';

    return goods.map((item, index) => `
${indent}<ie:GoodsItem>
${indent}  <ie:SequenceNumber>${item.sequenceNumber || index + 1}</ie:SequenceNumber>
${indent}  <ie:Description>${this._escapeXML(item.description)}</ie:Description>
${indent}  <ie:CommodityCode>${item.commodityCode}</ie:CommodityCode>
${indent}  <ie:GrossMass>${item.grossMass}</ie:GrossMass>
${item.quantity ? `${indent}  <ie:Quantity>${item.quantity}</ie:Quantity>` : ''}
${item.unitOfMeasure ? `${indent}  <ie:UnitOfMeasure>${item.unitOfMeasure}</ie:UnitOfMeasure>` : ''}
${item.countryOfOrigin ? `${indent}  <ie:CountryOfOrigin>${item.countryOfOrigin}</ie:CountryOfOrigin>` : ''}
${item.numberOfPackages ? `${indent}  <ie:NumberOfPackages>${item.numberOfPackages}</ie:NumberOfPackages>` : ''}
${item.kindOfPackages ? `${indent}  <ie:KindOfPackages>${item.kindOfPackages}</ie:KindOfPackages>` : ''}
${item.marksAndNumbers ? `${indent}  <ie:MarksAndNumbers>${this._escapeXML(item.marksAndNumbers)}</ie:MarksAndNumbers>` : ''}
${item.ucr ? `${indent}  <ie:UCR>${this._escapeXML(item.ucr)}</ie:UCR>` : ''}
${indent}</ie:GoodsItem>`).join('');
  }

  // ============== UTILIDADES ==============

  /**
   * Generar ID de mensaje
   */
  _generateMessageId(prefix = 'MSG') {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `LUCI-${prefix}-${timestamp}${random}`;
  }

  /**
   * Obtener codigo de modo de transporte
   */
  _getTransportModeCode(mode) {
    const codes = {
      'SEA': '1',
      'RAIL': '2',
      'ROAD': '3',
      'AIR': '4',
      'MAIL': '5',
      'MULTIMODAL': '6',
      'FIXED': '7',
      'INLAND_WATER': '8',
      'UNKNOWN': '9'
    };
    return codes[mode] || '9';
  }

  /**
   * Obtener tipo de identificacion
   */
  _getIdentificationType(type) {
    const types = {
      'VEHICLE_REGISTRATION': '21',
      'TRAIN_NUMBER': '30',
      'FLIGHT_NUMBER': '40',
      'VESSEL_IMO': '10',
      'VESSEL_NAME': '11'
    };
    return types[type] || '99';
  }

  /**
   * Escapar caracteres XML
   */
  _escapeXML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Limpiar XML (eliminar lineas vacias y espacios extras)
   */
  _cleanXML(xml) {
    return xml
      .split('\n')
      .filter(line => line.trim() !== '')
      .join('\n')
      .replace(/^\s+$/gm, '');
  }
}

module.exports = new ENSGenerator();
