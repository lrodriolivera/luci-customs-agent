/**
 * Generador de declaraciones AES (Exportacion)
 * Automated Export System - Sistema de Exportacion Automatizada
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Tipos de exportacion
 */
const EXPORT_TYPES = {
  '10': 'Exportacion definitiva',
  '11': 'Exportacion definitiva de mercancias UE en libre practica',
  '21': 'Exportacion temporal',
  '22': 'Exportacion temporal para perfeccionamiento pasivo',
  '23': 'Exportacion temporal para reparacion',
  '31': 'Reexportacion tras regimen suspensivo'
};

class AESGenerator {
  /**
   * Generar declaracion AES completa
   */
  generate(expedition, aiData = {}) {
    const lrn = this.generateLRN();

    const aesData = {
      lrn,
      declarationType: aiData.declarationType || 'EX',
      exportType: aiData.exportType || '10',
      declarationHeader: this.buildDeclarationHeader(expedition, aiData, lrn),
      consignment: this.buildConsignment(expedition, aiData),
      goodsItems: this.buildGoodsItems(expedition, aiData)
    };

    const xml = this.generateXML(aesData);
    const summary = this.calculateSummary(aesData);

    return {
      lrn,
      data: aesData,
      xml,
      summary
    };
  }

  /**
   * Generar LRN para AES
   */
  generateLRN() {
    const year = new Date().getFullYear().toString().slice(-2);
    const uuid = uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase();
    return `${year}ESEX${uuid}`;
  }

  /**
   * Construir cabecera de declaracion
   */
  buildDeclarationHeader(expedition, aiData, lrn) {
    return {
      lrn,
      declarationType: 'EX',
      specificCircumstanceIndicator: 'A',

      // Aduana de exportacion
      customsOfficeExport: aiData.customsOffice || this.determineExportOffice(expedition),
      customsOfficeExit: aiData.exitOffice || this.determineExitOffice(expedition),

      // Exportador
      exporter: {
        identificationNumber: expedition.client?.eori || `ES${expedition.client?.nif}`,
        name: expedition.client?.companyName,
        address: {
          streetAndNumber: expedition.client?.address?.street,
          city: expedition.client?.address?.city,
          postcode: expedition.client?.address?.postalCode,
          country: 'ES'
        }
      },

      // Declarante/Representante
      declarant: {
        identificationNumber: expedition.representative?.eori || `ES${expedition.representative?.nif}`,
        name: expedition.representative?.companyName || 'Stock Logistic',
        representativeStatus: expedition.representative?.representationType === 'direct' ? '2' : '3'
      },

      // Consignatario/Destinatario
      consignee: expedition.consignee ? {
        name: expedition.consignee.companyName,
        address: {
          streetAndNumber: expedition.consignee.address?.street,
          city: expedition.consignee.address?.city,
          country: expedition.consignee.address?.country
        }
      } : null,

      // Totales
      totalPackages: expedition.goodsSummary?.totalPackages || 0,
      totalGrossMass: expedition.goodsSummary?.totalGrossWeight || 0,

      // Fecha
      declarationDate: new Date().toISOString().split('T')[0]
    };
  }

  /**
   * Construir datos de consignment
   */
  buildConsignment(expedition, aiData) {
    return {
      // Pais destino
      countryOfDestination: expedition.consignee?.address?.country ||
        aiData.destinationCountry || 'US',

      // Transporte
      transportMeans: {
        modeAtBorder: this.getTransportModeCode(expedition.transportMode),
        identity: expedition.transport?.vehicleId,
        nationality: expedition.transport?.vehicleNationality || 'ES'
      },

      // Lugares
      placeOfLoading: {
        country: 'ES',
        location: expedition.transport?.loadingPlace || expedition.transport?.arrivalPort
      },

      // Documento transporte
      transportDocument: {
        type: this.getTransportDocumentType(expedition.transportMode),
        reference: expedition.transport?.documentNumber
      },

      // Contenedores
      containers: expedition.transport?.containers || [],

      // Incoterm
      deliveryTerms: {
        code: expedition.incoterm?.code || 'FCA',
        location: expedition.incoterm?.place
      },

      // Valor total
      totalInvoicedAmount: expedition.goodsSummary?.totalValue || 0,
      currency: 'EUR'
    };
  }

  /**
   * Construir items de mercancias
   */
  buildGoodsItems(expedition, aiData) {
    return expedition.goods.map((good, index) => ({
      itemNumber: index + 1,

      // Clasificacion
      commodityCode: good.taricCode,
      hsCode: good.hsCode || good.taricCode?.substring(0, 6),

      // Descripcion
      goodsDescription: good.description,

      // Regimen exportacion
      procedureCode: aiData.exportType || '10',

      // Destino
      countryOfDestination: expedition.consignee?.address?.country || 'US',

      // Cantidades
      grossMass: good.grossWeight,
      netMass: good.netWeight,
      supplementaryUnits: good.supplementaryUnits,

      // Bultos
      packaging: {
        numberOfPackages: good.packages?.quantity,
        typeOfPackages: good.packages?.type || 'PK',
        shippingMarks: good.packages?.marks
      },

      // Valor
      statisticalValue: good.statisticalValue || good.invoiceValue,
      itemPrice: good.invoiceValue,

      // Documentos
      supportingDocuments: this.buildSupportingDocuments(expedition, good)
    }));
  }

  /**
   * Construir documentos de soporte
   */
  buildSupportingDocuments(expedition, good) {
    const docs = [];

    const invoice = expedition.documents?.find(d => d.type === 'commercial_invoice');
    if (invoice) {
      docs.push({
        type: 'N380',
        reference: invoice.originalName
      });
    }

    const transportDoc = expedition.documents?.find(d =>
      ['bill_of_lading', 'air_waybill', 'cmr'].includes(d.type)
    );
    if (transportDoc) {
      docs.push({
        type: this.getDocumentTypeCode(transportDoc.type),
        reference: expedition.transport?.documentNumber
      });
    }

    return docs;
  }

  /**
   * Generar XML AES
   */
  generateXML(aesData) {
    const header = aesData.declarationHeader;
    const consignment = aesData.consignment;
    const items = aesData.goodsItems;

    return `<?xml version="1.0" encoding="UTF-8"?>
<CC515C xmlns="urn:wco:datamodel:WCO:DEC-DMS:2">
  <MessageSender>LUCI-CUSTOMS</MessageSender>
  <MessageRecipient>ES.AEAT</MessageRecipient>
  <PreparationDateTime>${new Date().toISOString()}</PreparationDateTime>
  <MessageIdentification>${aesData.lrn}</MessageIdentification>
  <MessageType>CC515C-EXP</MessageType>

  <Declaration>
    <FunctionCode>9</FunctionCode>
    <TypeCode>${header.declarationType}</TypeCode>
    <GoodsItemQuantity>${items.length}</GoodsItemQuantity>
    <TotalPackageQuantity>${header.totalPackages}</TotalPackageQuantity>
    <TotalGrossMassMeasure>${header.totalGrossMass}</TotalGrossMassMeasure>

    <DeclarationOfficeID>${header.customsOfficeExport}</DeclarationOfficeID>
    <ExitOfficeID>${header.customsOfficeExit}</ExitOfficeID>
    <LRN>${aesData.lrn}</LRN>

    <!-- Exporter -->
    <Exporter>
      <IdentificationID>${header.exporter.identificationNumber}</IdentificationID>
      <Name>${this.escapeXml(header.exporter.name)}</Name>
      <Address>
        <Line>${this.escapeXml(header.exporter.address.streetAndNumber || '')}</Line>
        <CityName>${this.escapeXml(header.exporter.address.city || '')}</CityName>
        <PostcodeID>${header.exporter.address.postcode || ''}</PostcodeID>
        <CountryCode>${header.exporter.address.country}</CountryCode>
      </Address>
    </Exporter>

    <!-- Declarant -->
    <Declarant>
      <IdentificationID>${header.declarant.identificationNumber}</IdentificationID>
      <Name>${this.escapeXml(header.declarant.name)}</Name>
      <StatusCode>${header.declarant.representativeStatus}</StatusCode>
    </Declarant>

    ${header.consignee ? `
    <!-- Consignee -->
    <Consignee>
      <Name>${this.escapeXml(header.consignee.name)}</Name>
      <Address>
        <Line>${this.escapeXml(header.consignee.address.streetAndNumber || '')}</Line>
        <CityName>${this.escapeXml(header.consignee.address.city || '')}</CityName>
        <CountryCode>${header.consignee.address.country}</CountryCode>
      </Address>
    </Consignee>` : ''}

    <!-- Consignment -->
    <GoodsShipment>
      <Consignment>
        <CountryOfDestinationCode>${consignment.countryOfDestination}</CountryOfDestinationCode>

        <TransportMeans>
          <ModeCode>${consignment.transportMeans.modeAtBorder}</ModeCode>
          <IdentificationNumber>${this.escapeXml(consignment.transportMeans.identity || '')}</IdentificationNumber>
          <NationalityCode>${consignment.transportMeans.nationality}</NationalityCode>
        </TransportMeans>

        ${consignment.containers.map(c => `
        <TransportEquipment>
          <IdentificationNumber>${c.number}</IdentificationNumber>
          <SealID>${c.sealNumber || ''}</SealID>
        </TransportEquipment>`).join('')}
      </Consignment>

      <DeliveryTerms>
        <ConditionCode>${consignment.deliveryTerms.code}</ConditionCode>
        <LocationName>${this.escapeXml(consignment.deliveryTerms.location || '')}</LocationName>
      </DeliveryTerms>

      <TradeTerms>
        <InvoiceCurrencyCode>${consignment.currency}</InvoiceCurrencyCode>
        <TotalInvoiceAmount>${consignment.totalInvoicedAmount}</TotalInvoiceAmount>
      </TradeTerms>

      <!-- Goods Items -->
      ${items.map(item => `
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>${item.itemNumber}</SequenceNumeric>

        <Commodity>
          <Description>${this.escapeXml(item.goodsDescription)}</Description>
          <Classification>
            <ID>${item.commodityCode}</ID>
            <IdentificationTypeCode>TSP</IdentificationTypeCode>
          </Classification>
          <GoodsMeasure>
            <GrossMassMeasure>${item.grossMass || 0}</GrossMassMeasure>
            <NetNetWeightMeasure>${item.netMass || 0}</NetNetWeightMeasure>
            ${item.supplementaryUnits ? `<TariffQuantity>${item.supplementaryUnits}</TariffQuantity>` : ''}
          </GoodsMeasure>
        </Commodity>

        <GovernmentProcedure>
          <CurrentCode>${item.procedureCode}</CurrentCode>
          <PreviousCode>00</PreviousCode>
        </GovernmentProcedure>

        <Destination>
          <CountryCode>${item.countryOfDestination}</CountryCode>
        </Destination>

        <Packaging>
          <QuantityQuantity>${item.packaging.numberOfPackages || 0}</QuantityQuantity>
          <TypeCode>${item.packaging.typeOfPackages}</TypeCode>
          <MarksNumbers>${this.escapeXml(item.packaging.shippingMarks || '')}</MarksNumbers>
        </Packaging>

        <CustomsValuation>
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
   * Calcular resumen
   */
  calculateSummary(aesData) {
    const items = aesData.goodsItems;

    return {
      lrn: aesData.lrn,
      declarationType: aesData.declarationType,
      exportType: aesData.exportType,
      exportTypeDescription: EXPORT_TYPES[aesData.exportType] || 'Desconocido',
      totalItems: items.length,
      totalPackages: aesData.declarationHeader.totalPackages,
      totalGrossWeight: aesData.declarationHeader.totalGrossMass,
      totalValue: aesData.consignment.totalInvoicedAmount,
      customsOfficeExport: aesData.declarationHeader.customsOfficeExport,
      customsOfficeExit: aesData.declarationHeader.customsOfficeExit,
      destinationCountry: aesData.consignment.countryOfDestination,
      taricCodes: items.map(i => i.commodityCode)
    };
  }

  /**
   * Determinar aduana de exportacion
   */
  determineExportOffice(expedition) {
    const port = expedition.transport?.loadingPlace?.toUpperCase() || '';

    if (port.includes('BCN') || port.includes('BARCELONA')) return 'ES002801';
    if (port.includes('VLC') || port.includes('VALENCIA')) return 'ES004601';
    if (port.includes('MAD') || port.includes('BARAJAS')) return 'ES002101';
    if (port.includes('ALG') || port.includes('ALGECIRAS')) return 'ES003001';

    return 'ES002801';
  }

  /**
   * Determinar aduana de salida
   */
  determineExitOffice(expedition) {
    // Puede ser diferente si sale por otra frontera
    return this.determineExportOffice(expedition);
  }

  /**
   * Codigo modo transporte
   */
  getTransportModeCode(mode) {
    const codes = {
      maritime: '1',
      rail: '2',
      road: '3',
      air: '4',
      postal: '5'
    };
    return codes[mode] || '1';
  }

  /**
   * Tipo documento transporte
   */
  getTransportDocumentType(mode) {
    const types = {
      maritime: 'N705',
      air: 'N740',
      road: 'N730'
    };
    return types[mode] || 'N785';
  }

  /**
   * Codigo tipo documento
   */
  getDocumentTypeCode(docType) {
    const codes = {
      commercial_invoice: 'N380',
      bill_of_lading: 'N705',
      air_waybill: 'N740',
      cmr: 'N730'
    };
    return codes[docType] || 'N990';
  }

  /**
   * Escapar XML
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

module.exports = new AESGenerator();
