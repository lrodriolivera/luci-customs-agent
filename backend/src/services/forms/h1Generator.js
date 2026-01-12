/**
 * Generador de declaraciones H1 (Importacion)
 * Formato segun nuevo sistema AEAT desde octubre 2025
 *
 * Estructura H1:
 * - D10: Declaration Header
 * - GS11: Goods Shipment
 * - SI12: Goods Items
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Codigos de regimen aduanero
 */
const REGIMES = {
  '40': 'Despacho a libre practica',
  '42': 'Libre practica + entrega intracomunitaria',
  '44': 'Libre practica con uso final',
  '51': 'Perfeccionamiento activo',
  '53': 'Importacion temporal',
  '61': 'Reimportacion',
  '71': 'Deposito aduanero'
};

/**
 * Codigos de preferencia
 */
const PREFERENCES = {
  '100': 'Arancel normal terceros paises',
  '200': 'SPG (Sistema Preferencias Generalizadas)',
  '300': 'Preferencia arancelaria (EUR.1, EUR-MED)',
  '400': 'Union aduanera (ATR Turquia)'
};

/**
 * Aduanas principales de Espana
 */
const CUSTOMS_OFFICES = {
  'ES002801': 'Barcelona - Puerto',
  'ES002805': 'Barcelona - Aeropuerto',
  'ES004601': 'Valencia - Puerto',
  'ES002101': 'Madrid - Barajas',
  'ES002901': 'Malaga',
  'ES003001': 'Algeciras',
  'ES004801': 'Bilbao',
  'ES003501': 'Las Palmas',
  'ES003801': 'Tenerife'
};

class H1Generator {
  /**
   * Generar declaracion H1 completa
   */
  generate(expedition, aiData = {}) {
    // Generar LRN unico
    const lrn = this.generateLRN();

    // Construir datos estructurados
    const h1Data = {
      lrn,
      declarationType: aiData.declarationType || 'A',
      declarationHeader: this.buildDeclarationHeader(expedition, aiData),
      goodsShipment: this.buildGoodsShipment(expedition, aiData),
      goodsItems: this.buildGoodsItems(expedition, aiData)
    };

    // Generar XML
    const xml = this.generateXML(h1Data);

    // Calcular resumen
    const summary = this.calculateSummary(h1Data);

    return {
      lrn,
      data: h1Data,
      xml,
      summary
    };
  }

  /**
   * Generar Local Reference Number (LRN)
   */
  generateLRN() {
    const year = new Date().getFullYear().toString().slice(-2);
    const uuid = uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase();
    return `${year}ES${uuid}`;
  }

  /**
   * Construir cabecera de declaracion (D10)
   */
  buildDeclarationHeader(expedition, aiData) {
    return {
      // Identificacion
      lrn: aiData.lrn || this.generateLRN(),
      declarationType: aiData.declarationType || 'A',
      additionalDeclarationType: 'A', // Normal

      // Aduana
      customsOfficePresentation: aiData.customsOffice || this.determineCustomsOffice(expedition),
      customsOfficeLodgement: aiData.customsOffice || this.determineCustomsOffice(expedition),

      // Importador
      importer: {
        identificationNumber: expedition.client?.eori || `ES${expedition.client?.nif}`,
        name: expedition.client?.companyName,
        address: {
          streetAndNumber: expedition.client?.address?.street,
          city: expedition.client?.address?.city,
          postcode: expedition.client?.address?.postalCode,
          country: 'ES'
        }
      },

      // Declarante (representante)
      declarant: {
        identificationNumber: expedition.representative?.eori || `ES${expedition.representative?.nif}`,
        name: expedition.representative?.companyName || 'Stock Logistic',
        representativeStatus: expedition.representative?.representationType === 'direct' ? '2' : '3'
      },

      // Exportador
      exporter: expedition.exporter ? {
        name: expedition.exporter.companyName,
        address: {
          streetAndNumber: expedition.exporter.address,
          city: expedition.exporter.city,
          country: expedition.exporter.country
        }
      } : null,

      // Totales
      totalPackages: expedition.goodsSummary?.totalPackages || 0,
      totalGrossMass: expedition.goodsSummary?.totalGrossWeight || 0,

      // Fechas
      acceptanceDate: new Date().toISOString().split('T')[0]
    };
  }

  /**
   * Construir datos del envio (GS11)
   */
  buildGoodsShipment(expedition, aiData) {
    return {
      // Pais de expedicion
      countryOfDispatch: expedition.exporter?.country || 'CN',

      // Destino
      countryOfDestination: 'ES',
      regionOfDestination: expedition.client?.address?.province || 'ES-CT',

      // Transporte
      transportMeans: {
        modeAtBorder: this.getTransportModeCode(expedition.transportMode),
        modeInland: '3', // Carretera por defecto
        identity: expedition.transport?.vehicleId,
        nationality: expedition.transport?.vehicleNationality
      },

      // Ubicacion
      placeOfLoading: {
        country: expedition.transport?.loadingPlace?.substring(0, 2) || expedition.exporter?.country,
        location: expedition.transport?.loadingPlace
      },
      placeOfUnloading: {
        country: 'ES',
        location: expedition.transport?.unloadingPlace || expedition.transport?.arrivalPort
      },

      // Documento transporte
      transportDocument: {
        type: this.getTransportDocumentType(expedition.transportMode),
        reference: expedition.transport?.documentNumber
      },

      // Contenedores
      containerIndicator: expedition.transport?.containers?.length > 0 ? '1' : '0',
      containers: expedition.transport?.containers?.map(c => ({
        containerNumber: c.number,
        sealNumber: c.sealNumber
      })) || [],

      // Incoterm
      deliveryTerms: {
        code: expedition.incoterm?.code || 'CIF',
        location: expedition.incoterm?.place
      },

      // Valor
      totalInvoicedAmount: expedition.goodsSummary?.totalValue || 0,
      currency: 'EUR',
      exchangeRate: 1
    };
  }

  /**
   * Construir partidas de mercancias (SI12)
   */
  buildGoodsItems(expedition, aiData) {
    return expedition.goods.map((good, index) => ({
      itemNumber: index + 1,

      // Clasificacion
      commodityCode: {
        harmonizedSystemCode: good.hsCode || good.taricCode?.substring(0, 6),
        combinedNomenclatureCode: good.taricCode?.substring(0, 8),
        taricCode: good.taricCode,
        taricAdditionalCode: good.taricCode?.substring(10, 14)
      },

      // Descripcion
      goodsDescription: good.description,
      descriptionOfGoods: good.descriptionEs || good.description,

      // Regimen
      requestedProcedure: aiData.regime || '40',
      previousProcedure: '00',
      additionalProcedure: aiData.additionalProcedure || '000',

      // Origen y preferencia
      countryOfOrigin: good.originCountry || expedition.exporter?.country,
      preferentialOrigin: good.originCountry,
      preference: aiData.preference || '100',

      // Cantidades
      grossMass: good.grossWeight,
      netMass: good.netWeight,
      supplementaryUnits: good.supplementaryUnits,
      supplementaryUnitsType: good.supplementaryUnitType,

      // Bultos
      packaging: {
        numberOfPackages: good.packages?.quantity,
        typeOfPackages: good.packages?.type,
        shippingMarks: good.packages?.marks
      },

      // Valores
      statisticalValue: good.statisticalValue || good.invoiceValue,
      itemPrice: good.invoiceValue,
      customsValue: good.invoiceValue,

      // Documentos previos
      previousDocuments: [],

      // Documentos presentados
      supportingDocuments: this.buildSupportingDocuments(expedition, good)
    }));
  }

  /**
   * Construir lista de documentos de soporte
   */
  buildSupportingDocuments(expedition, good) {
    const docs = [];

    // Factura comercial
    const invoice = expedition.documents?.find(d => d.type === 'commercial_invoice');
    if (invoice) {
      docs.push({
        type: 'N380', // Codigo para factura comercial
        reference: invoice.originalName,
        date: invoice.uploadedAt
      });
    }

    // Documento transporte
    const transportDoc = expedition.documents?.find(d =>
      ['bill_of_lading', 'air_waybill', 'cmr'].includes(d.type)
    );
    if (transportDoc) {
      docs.push({
        type: this.getDocumentTypeCode(transportDoc.type),
        reference: expedition.transport?.documentNumber
      });
    }

    // Certificado origen si aplica
    const originCert = expedition.documents?.find(d =>
      ['certificate_origin', 'eur1', 'atr', 'form_a'].includes(d.type)
    );
    if (originCert) {
      docs.push({
        type: this.getDocumentTypeCode(originCert.type),
        reference: originCert.originalName
      });
    }

    return docs;
  }

  /**
   * Generar XML en formato AEAT
   */
  generateXML(h1Data) {
    const header = h1Data.declarationHeader;
    const shipment = h1Data.goodsShipment;
    const items = h1Data.goodsItems;

    return `<?xml version="1.0" encoding="UTF-8"?>
<CC515C xmlns="urn:wco:datamodel:WCO:DEC-DMS:2">
  <MessageSender>LUCI-CUSTOMS</MessageSender>
  <MessageRecipient>ES.AEAT</MessageRecipient>
  <PreparationDateTime>${new Date().toISOString()}</PreparationDateTime>
  <MessageIdentification>${h1Data.lrn}</MessageIdentification>
  <MessageType>CC515C</MessageType>

  <!-- D10 - Declaration Header -->
  <Declaration>
    <FunctionCode>9</FunctionCode>
    <TypeCode>${header.declarationType}</TypeCode>
    <GoodsItemQuantity>${items.length}</GoodsItemQuantity>
    <TotalPackageQuantity>${header.totalPackages}</TotalPackageQuantity>
    <TotalGrossMassMeasure>${header.totalGrossMass}</TotalGrossMassMeasure>

    <DeclarationOfficeID>${header.customsOfficePresentation}</DeclarationOfficeID>
    <LRN>${h1Data.lrn}</LRN>

    <!-- Importer -->
    <Importer>
      <IdentificationID>${header.importer.identificationNumber}</IdentificationID>
      <Name>${this.escapeXml(header.importer.name)}</Name>
      <Address>
        <Line>${this.escapeXml(header.importer.address.streetAndNumber || '')}</Line>
        <CityName>${this.escapeXml(header.importer.address.city || '')}</CityName>
        <PostcodeID>${header.importer.address.postcode || ''}</PostcodeID>
        <CountryCode>${header.importer.address.country}</CountryCode>
      </Address>
    </Importer>

    <!-- Declarant -->
    <Declarant>
      <IdentificationID>${header.declarant.identificationNumber}</IdentificationID>
      <Name>${this.escapeXml(header.declarant.name)}</Name>
      <StatusCode>${header.declarant.representativeStatus}</StatusCode>
    </Declarant>

    ${header.exporter ? `
    <!-- Exporter -->
    <Exporter>
      <Name>${this.escapeXml(header.exporter.name)}</Name>
      <Address>
        <Line>${this.escapeXml(header.exporter.address.streetAndNumber || '')}</Line>
        <CityName>${this.escapeXml(header.exporter.address.city || '')}</CityName>
        <CountryCode>${header.exporter.address.country}</CountryCode>
      </Address>
    </Exporter>` : ''}

    <!-- GS11 - Goods Shipment -->
    <GoodsShipment>
      <Consignment>
        <ContainerIndicator>${shipment.containerIndicator}</ContainerIndicator>
        <GrossWeight>${shipment.totalInvoicedAmount}</GrossWeight>

        <TransportMeans>
          <ModeCode>${shipment.transportMeans.modeAtBorder}</ModeCode>
          <IdentificationNumber>${this.escapeXml(shipment.transportMeans.identity || '')}</IdentificationNumber>
        </TransportMeans>

        <DepartureTransportMeans>
          <ModeCode>${shipment.transportMeans.modeInland}</ModeCode>
        </DepartureTransportMeans>

        <CountryOfDispatchCode>${shipment.countryOfDispatch}</CountryOfDispatchCode>
        <CountryOfDestinationCode>${shipment.countryOfDestination}</CountryOfDestinationCode>

        <TransportEquipment>
          ${shipment.containers.map(c => `
          <Container>
            <IdentificationNumber>${c.containerNumber}</IdentificationNumber>
            <SealID>${c.sealNumber || ''}</SealID>
          </Container>`).join('')}
        </TransportEquipment>
      </Consignment>

      <DeliveryTerms>
        <ConditionCode>${shipment.deliveryTerms.code}</ConditionCode>
        <LocationName>${this.escapeXml(shipment.deliveryTerms.location || '')}</LocationName>
      </DeliveryTerms>

      <TradeTerms>
        <InvoiceCurrencyCode>${shipment.currency}</InvoiceCurrencyCode>
        <TotalInvoiceAmount>${shipment.totalInvoicedAmount}</TotalInvoiceAmount>
        <ExchangeRate>${shipment.exchangeRate}</ExchangeRate>
      </TradeTerms>

      <!-- SI12 - Goods Items -->
      ${items.map(item => `
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>${item.itemNumber}</SequenceNumeric>

        <Commodity>
          <Description>${this.escapeXml(item.goodsDescription)}</Description>
          <Classification>
            <ID>${item.commodityCode.taricCode}</ID>
            <IdentificationTypeCode>TSP</IdentificationTypeCode>
          </Classification>
          <GoodsMeasure>
            <GrossMassMeasure>${item.grossMass || 0}</GrossMassMeasure>
            <NetNetWeightMeasure>${item.netMass || 0}</NetNetWeightMeasure>
            ${item.supplementaryUnits ? `<TariffQuantity>${item.supplementaryUnits}</TariffQuantity>` : ''}
          </GoodsMeasure>
        </Commodity>

        <GovernmentProcedure>
          <CurrentCode>${item.requestedProcedure}</CurrentCode>
          <PreviousCode>${item.previousProcedure}</PreviousCode>
        </GovernmentProcedure>

        <AdditionalProcedure>
          <CurrentCode>${item.additionalProcedure}</CurrentCode>
        </AdditionalProcedure>

        <Origin>
          <CountryCode>${item.countryOfOrigin}</CountryCode>
        </Origin>

        <Preference>
          <TypeCode>${item.preference}</TypeCode>
        </Preference>

        <Packaging>
          <QuantityQuantity>${item.packaging.numberOfPackages || 0}</QuantityQuantity>
          <TypeCode>${item.packaging.typeOfPackages || 'PK'}</TypeCode>
          <MarksNumbers>${this.escapeXml(item.packaging.shippingMarks || '')}</MarksNumbers>
        </Packaging>

        <CustomsValuation>
          <ItemChargeAmount>${item.customsValue || 0}</ItemChargeAmount>
          <StatisticalValueAmount>${item.statisticalValue || 0}</StatisticalValueAmount>
        </CustomsValuation>

        ${item.supportingDocuments.map(doc => `
        <AdditionalDocument>
          <TypeCode>${doc.type}</TypeCode>
          <ID>${this.escapeXml(doc.reference || '')}</ID>
        </AdditionalDocument>`).join('')}

      </GovernmentAgencyGoodsItem>`).join('')}

    </GoodsShipment>
  </Declaration>
</CC515C>`;
  }

  /**
   * Calcular resumen de la declaracion
   */
  calculateSummary(h1Data) {
    const items = h1Data.goodsItems;

    return {
      lrn: h1Data.lrn,
      declarationType: h1Data.declarationType,
      totalItems: items.length,
      totalPackages: h1Data.declarationHeader.totalPackages,
      totalGrossWeight: h1Data.declarationHeader.totalGrossMass,
      totalValue: h1Data.goodsShipment.totalInvoicedAmount,
      regime: items[0]?.requestedProcedure,
      regimeDescription: REGIMES[items[0]?.requestedProcedure] || 'Desconocido',
      preference: items[0]?.preference,
      preferenceDescription: PREFERENCES[items[0]?.preference] || 'Desconocido',
      customsOffice: h1Data.declarationHeader.customsOfficePresentation,
      customsOfficeName: CUSTOMS_OFFICES[h1Data.declarationHeader.customsOfficePresentation] || 'Desconocido',
      taricCodes: items.map(i => i.commodityCode.taricCode),
      origins: [...new Set(items.map(i => i.countryOfOrigin))]
    };
  }

  /**
   * Determinar aduana segun puerto/aeropuerto de entrada
   */
  determineCustomsOffice(expedition) {
    const port = expedition.transport?.arrivalPort?.toUpperCase() || '';

    if (port.includes('BCN') || port.includes('BARCELONA')) return 'ES002801';
    if (port.includes('VLC') || port.includes('VALENCIA')) return 'ES004601';
    if (port.includes('MAD') || port.includes('BARAJAS')) return 'ES002101';
    if (port.includes('ALG') || port.includes('ALGECIRAS')) return 'ES003001';
    if (port.includes('BIO') || port.includes('BILBAO')) return 'ES004801';

    return 'ES002801'; // Barcelona por defecto
  }

  /**
   * Obtener codigo de modo de transporte
   */
  getTransportModeCode(mode) {
    const codes = {
      maritime: '1',
      rail: '2',
      road: '3',
      air: '4',
      postal: '5',
      multimodal: '7'
    };
    return codes[mode] || '1';
  }

  /**
   * Obtener tipo de documento de transporte
   */
  getTransportDocumentType(mode) {
    const types = {
      maritime: 'N705', // BL
      air: 'N740', // AWB
      road: 'N730', // CMR
      rail: 'N720' // CIM
    };
    return types[mode] || 'N785';
  }

  /**
   * Obtener codigo de tipo de documento
   */
  getDocumentTypeCode(docType) {
    const codes = {
      commercial_invoice: 'N380',
      bill_of_lading: 'N705',
      air_waybill: 'N740',
      cmr: 'N730',
      certificate_origin: 'N861',
      eur1: 'N864',
      atr: 'N018',
      form_a: 'N865',
      packing_list: 'N271',
      sanitary_certificate: 'C678',
      phytosanitary_certificate: 'C635'
    };
    return codes[docType] || 'N990';
  }

  /**
   * Escapar caracteres especiales para XML
   */
  escapeXml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

module.exports = new H1Generator();
