/**
 * Generador de declaraciones H7 (Importacion simplificada bajo valor)
 * Para envios con valor intrinseco <= 150 EUR
 * Sistema IOSS (Import One-Stop Shop) desde julio 2021
 *
 * Caracteristicas H7:
 * - Declaracion simplificada para comercio electronico B2C
 * - Sin aranceles para mercancias <= 150 EUR (solo IVA)
 * - Campos reducidos respecto a H1
 * - Proceso de despacho acelerado
 * - Compatible con plataformas e-commerce (IOSS)
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Limite de valor para H7
 */
const H7_VALUE_LIMIT = 150; // EUR

/**
 * Tipos de declaracion H7
 */
const H7_TYPES = {
  'H7': 'Declaracion simplificada bajo valor',
  'H7A': 'H7 con numero IOSS',
  'H7B': 'H7 sin IOSS (IVA en destino)'
};

/**
 * Codigos de aduana para H7 (centros de despacho expres)
 */
const H7_CUSTOMS_OFFICES = {
  'ES002801': 'Barcelona - Puerto',
  'ES002805': 'Barcelona - Aeropuerto El Prat',
  'ES002101': 'Madrid - Barajas',
  'ES004601': 'Valencia - Puerto',
  'ES003001': 'Algeciras',
  'ES003501': 'Las Palmas',
  'ES003801': 'Tenerife'
};

/**
 * Regimenes aplicables a H7
 */
const H7_REGIMES = {
  '40': 'Despacho a libre practica (normal)',
  'I1': 'Despacho simplificado B2C con IOSS'
};

class H7Generator {
  /**
   * Validar si un expediente es apto para H7
   */
  isEligibleForH7(expedition) {
    const totalValue = expedition.goodsSummary?.totalValue ||
      expedition.goods?.reduce((sum, g) => sum + (g.invoiceValue || 0), 0) || 0;

    // Verificar limite de valor
    if (totalValue > H7_VALUE_LIMIT) {
      return {
        eligible: false,
        reason: `Valor total (${totalValue} EUR) excede limite H7 de ${H7_VALUE_LIMIT} EUR`
      };
    }

    // Verificar que no contenga bienes restringidos
    const restrictedGoods = this.checkRestrictedGoods(expedition.goods);
    if (restrictedGoods.length > 0) {
      return {
        eligible: false,
        reason: `Contiene bienes no elegibles para H7: ${restrictedGoods.join(', ')}`
      };
    }

    // Verificar que sea B2C (persona fisica como destinatario)
    // En este caso, lo hacemos opcional ya que tambien puede ser B2B bajo valor

    return {
      eligible: true,
      reason: 'Expediente apto para declaracion H7'
    };
  }

  /**
   * Verificar bienes restringidos (no aptos para H7)
   */
  checkRestrictedGoods(goods) {
    const restricted = [];
    const restrictedChapters = ['22', '24']; // Alcohol, Tabaco

    goods?.forEach((good, index) => {
      const chapter = good.taricCode?.substring(0, 2) || good.hsCode?.substring(0, 2);
      if (restrictedChapters.includes(chapter)) {
        restricted.push(`Item ${index + 1}: ${good.description} (Cap. ${chapter})`);
      }
    });

    return restricted;
  }

  /**
   * Generar declaracion H7 completa
   */
  generate(expedition, options = {}) {
    // Verificar elegibilidad
    const eligibility = this.isEligibleForH7(expedition);
    if (!eligibility.eligible && !options.forceGenerate) {
      throw new Error(eligibility.reason);
    }

    const lrn = this.generateLRN();
    const hasIOSS = !!options.iossNumber || !!expedition.ecommerce?.iossNumber;

    const h7Data = {
      lrn,
      declarationType: hasIOSS ? 'H7A' : 'H7B',
      h7Type: hasIOSS ? 'I1' : '40',
      declarationHeader: this.buildDeclarationHeader(expedition, options, lrn),
      shipment: this.buildShipment(expedition, options),
      goodsItem: this.buildGoodsItem(expedition, options),
      iossData: hasIOSS ? this.buildIOSSData(expedition, options) : null,
      vatCalculation: this.calculateVAT(expedition, options)
    };

    const xml = this.generateXML(h7Data);
    const summary = this.calculateSummary(h7Data, expedition);

    return {
      lrn,
      data: h7Data,
      xml,
      summary,
      eligibility
    };
  }

  /**
   * Generar LRN para H7
   */
  generateLRN() {
    const year = new Date().getFullYear().toString().slice(-2);
    const uuid = uuidv4().replace(/-/g, '').substring(0, 14).toUpperCase();
    return `${year}ESH7${uuid}`;
  }

  /**
   * Construir cabecera de declaracion H7
   */
  buildDeclarationHeader(expedition, options, lrn) {
    return {
      lrn,
      declarationType: 'H7',
      additionalDeclarationType: options.iossNumber ? 'A' : 'B',

      // Aduana de presentacion
      customsOffice: options.customsOffice || this.determineCustomsOffice(expedition),

      // Destinatario/Importador (puede ser persona fisica en B2C)
      consignee: {
        identificationNumber: expedition.client?.eori ||
          expedition.client?.nif ||
          expedition.client?.passport,
        name: expedition.client?.companyName || expedition.client?.name,
        address: {
          streetAndNumber: expedition.client?.address?.street,
          city: expedition.client?.address?.city,
          postcode: expedition.client?.address?.postalCode,
          country: 'ES'
        },
        isPrivateIndividual: !expedition.client?.eori
      },

      // Declarante (operador postal/expres o representante)
      declarant: {
        identificationNumber: expedition.representative?.eori ||
          `ES${expedition.representative?.nif}` ||
          'ESB12345678', // Operador por defecto
        name: expedition.representative?.companyName || 'STRIX AI SL',
        representativeStatus: '3' // Representacion indirecta para H7
      },

      // Expedidor/Vendedor
      seller: expedition.exporter ? {
        name: expedition.exporter.companyName,
        address: {
          streetAndNumber: expedition.exporter.address,
          city: expedition.exporter.city,
          country: expedition.exporter.country
        }
      } : null,

      // Datos IOSS si aplica
      iossNumber: options.iossNumber || expedition.ecommerce?.iossNumber,

      // Fecha
      declarationDate: new Date().toISOString().split('T')[0]
    };
  }

  /**
   * Construir datos del envio H7
   */
  buildShipment(expedition, options) {
    return {
      // Origen
      countryOfDispatch: expedition.exporter?.country || options.originCountry || 'CN',

      // Destino
      countryOfDestination: 'ES',

      // Transporte - simplificado para H7
      transportMode: this.getTransportModeCode(expedition.transportMode || 'postal'),
      transportDocument: {
        type: expedition.transportMode === 'air' ? 'N740' : 'N770', // AWB o postal
        reference: expedition.transport?.documentNumber ||
          expedition.transport?.trackingNumber
      },

      // Tracking
      trackingNumber: expedition.transport?.trackingNumber ||
        expedition.ecommerce?.trackingNumber,

      // Valor intrinseco (sin flete ni seguro para H7)
      intrinsicValue: this.calculateIntrinsicValue(expedition),
      currency: 'EUR',

      // Ubicacion de entrega
      deliveryLocation: {
        postalCode: expedition.client?.address?.postalCode,
        city: expedition.client?.address?.city
      }
    };
  }

  /**
   * Construir item de mercancias H7 (simplificado - un solo item agregado)
   */
  buildGoodsItem(expedition, options) {
    // H7 permite agrupar items similares en una sola partida
    const goods = expedition.goods || [];

    // Calcular totales
    const totalValue = goods.reduce((sum, g) => sum + (g.invoiceValue || 0), 0);
    const totalWeight = goods.reduce((sum, g) => sum + (g.grossWeight || 0), 0);
    const totalPackages = expedition.goodsSummary?.totalPackages ||
      goods.reduce((sum, g) => sum + (g.packages?.quantity || 1), 0);

    // Obtener codigo TARIC principal (el de mayor valor)
    const mainItem = goods.sort((a, b) => (b.invoiceValue || 0) - (a.invoiceValue || 0))[0];

    return {
      // Identificacion
      itemNumber: 1,
      sequenceNumber: 1,

      // Clasificacion simplificada
      commodityCode: {
        // Para H7 se puede usar solo 6 digitos (HS) o codigo simplificado
        hsCode: mainItem?.hsCode || mainItem?.taricCode?.substring(0, 6) || '999999',
        taricCode: mainItem?.taricCode,
        // Codigo simplificado para bienes variados de bajo valor
        simplifiedCode: goods.length > 1 ? '99999999' : mainItem?.taricCode
      },

      // Descripcion agregada
      goodsDescription: this.buildAggregatedDescription(goods),

      // Origen
      countryOfOrigin: mainItem?.originCountry || expedition.exporter?.country || 'CN',

      // Cantidades
      grossMass: totalWeight,
      numberOfPackages: totalPackages,
      packageType: 'PK', // Paquete por defecto para H7

      // Valor
      intrinsicValue: totalValue,
      statisticalValue: totalValue,

      // Cantidad de items individuales
      itemCount: goods.length,
      itemDetails: goods.map((g, i) => ({
        sequence: i + 1,
        description: g.description,
        quantity: g.quantity || 1,
        value: g.invoiceValue
      }))
    };
  }

  /**
   * Construir datos IOSS
   */
  buildIOSSData(expedition, options) {
    const iossNumber = options.iossNumber || expedition.ecommerce?.iossNumber;

    return {
      iossNumber,
      // Validar formato IOSS: IMxxxyyyyyyz (IM + 2 letras pais + 10 digitos)
      isValid: /^IM[A-Z]{2}\d{10}$/.test(iossNumber),
      // El IVA ya fue cobrado por la plataforma
      vatAlreadyCollected: true,
      platform: expedition.ecommerce?.platform || 'Unknown'
    };
  }

  /**
   * Calcular valor intrinseco (sin flete/seguro)
   */
  calculateIntrinsicValue(expedition) {
    const totalValue = expedition.goodsSummary?.totalValue ||
      expedition.goods?.reduce((sum, g) => sum + (g.invoiceValue || 0), 0) || 0;

    // H7 usa valor intrinseco, excluyendo transporte y seguro
    const freight = expedition.costs?.freight || 0;
    const insurance = expedition.costs?.insurance || 0;

    return Math.max(0, totalValue - freight - insurance);
  }

  /**
   * Calcular IVA para H7
   */
  calculateVAT(expedition, options) {
    const intrinsicValue = this.calculateIntrinsicValue(expedition);
    const vatRate = options.vatRate || 0.21; // 21% IVA espanol por defecto

    // Si tiene IOSS, el IVA ya fue cobrado por la plataforma
    const hasIOSS = !!options.iossNumber || !!expedition.ecommerce?.iossNumber;

    return {
      intrinsicValue,
      vatRate: vatRate * 100, // Porcentaje
      vatAmount: hasIOSS ? 0 : intrinsicValue * vatRate,
      vatAlreadyPaid: hasIOSS,
      // Sin aranceles para envios <= 150 EUR
      dutyAmount: 0,
      dutyExempt: true,
      totalToPay: hasIOSS ? 0 : intrinsicValue * vatRate
    };
  }

  /**
   * Construir descripcion agregada de bienes
   */
  buildAggregatedDescription(goods) {
    if (goods.length === 0) return 'Mercancias varias';
    if (goods.length === 1) return goods[0].description;

    // Agregar descripciones para multiples items
    const descriptions = goods.slice(0, 3).map(g => g.description);
    const remaining = goods.length - 3;

    let desc = descriptions.join(', ');
    if (remaining > 0) {
      desc += ` y ${remaining} articulo(s) mas`;
    }

    return desc.substring(0, 200); // Limitar longitud
  }

  /**
   * Generar XML H7 en formato AEAT
   */
  generateXML(h7Data) {
    const header = h7Data.declarationHeader;
    const shipment = h7Data.shipment;
    const item = h7Data.goodsItem;
    const vat = h7Data.vatCalculation;

    return `<?xml version="1.0" encoding="UTF-8"?>
<CC513C xmlns="urn:wco:datamodel:WCO:DEC-DMS:2">
  <MessageSender>LUCI-CUSTOMS</MessageSender>
  <MessageRecipient>ES.AEAT</MessageRecipient>
  <PreparationDateTime>${new Date().toISOString()}</PreparationDateTime>
  <MessageIdentification>${h7Data.lrn}</MessageIdentification>
  <MessageType>CC513C-H7</MessageType>

  <!-- H7 - Declaracion Simplificada Bajo Valor -->
  <Declaration>
    <FunctionCode>9</FunctionCode>
    <TypeCode>H7</TypeCode>
    <DeclarationTypeCode>${h7Data.declarationType}</DeclarationTypeCode>

    <DeclarationOfficeID>${header.customsOffice}</DeclarationOfficeID>
    <LRN>${h7Data.lrn}</LRN>

    <!-- Valor intrinseco total -->
    <InvoicedValueAmount currencyID="EUR">${shipment.intrinsicValue}</InvoicedValueAmount>

    ${header.iossNumber ? `
    <!-- IOSS - Import One-Stop Shop -->
    <IOSSRegistration>
      <IdentificationNumber>${header.iossNumber}</IdentificationNumber>
      <VATAlreadyPaid>1</VATAlreadyPaid>
    </IOSSRegistration>` : ''}

    <!-- Destinatario/Consignatario -->
    <Consignee>
      ${header.consignee.identificationNumber ?
      `<IdentificationID>${header.consignee.identificationNumber}</IdentificationID>` : ''}
      <Name>${this.escapeXml(header.consignee.name)}</Name>
      <Address>
        <Line>${this.escapeXml(header.consignee.address.streetAndNumber || '')}</Line>
        <CityName>${this.escapeXml(header.consignee.address.city || '')}</CityName>
        <PostcodeID>${header.consignee.address.postcode || ''}</PostcodeID>
        <CountryCode>${header.consignee.address.country}</CountryCode>
      </Address>
      ${header.consignee.isPrivateIndividual ? '<PersonTypeCode>1</PersonTypeCode>' : ''}
    </Consignee>

    <!-- Declarante/Operador Postal -->
    <Declarant>
      <IdentificationID>${header.declarant.identificationNumber}</IdentificationID>
      <Name>${this.escapeXml(header.declarant.name)}</Name>
      <StatusCode>${header.declarant.representativeStatus}</StatusCode>
    </Declarant>

    ${header.seller ? `
    <!-- Vendedor/Expedidor -->
    <Seller>
      <Name>${this.escapeXml(header.seller.name)}</Name>
      <Address>
        <Line>${this.escapeXml(header.seller.address.streetAndNumber || '')}</Line>
        <CityName>${this.escapeXml(header.seller.address.city || '')}</CityName>
        <CountryCode>${header.seller.address.country}</CountryCode>
      </Address>
    </Seller>` : ''}

    <!-- Envio -->
    <Consignment>
      <CountryOfDispatchCode>${shipment.countryOfDispatch}</CountryOfDispatchCode>
      <CountryOfDestinationCode>${shipment.countryOfDestination}</CountryOfDestinationCode>

      <TransportMeans>
        <ModeCode>${shipment.transportMode}</ModeCode>
      </TransportMeans>

      <TransportDocument>
        <TypeCode>${shipment.transportDocument.type}</TypeCode>
        <ID>${this.escapeXml(shipment.transportDocument.reference || '')}</ID>
      </TransportDocument>

      ${shipment.trackingNumber ? `
      <TrackingID>${this.escapeXml(shipment.trackingNumber)}</TrackingID>` : ''}

      <DeliveryLocation>
        <PostcodeID>${shipment.deliveryLocation.postalCode || ''}</PostcodeID>
        <CityName>${this.escapeXml(shipment.deliveryLocation.city || '')}</CityName>
      </DeliveryLocation>
    </Consignment>

    <!-- Item de Mercancias (agregado) -->
    <GoodsItem>
      <SequenceNumeric>${item.sequenceNumber}</SequenceNumeric>

      <Commodity>
        <Description>${this.escapeXml(item.goodsDescription)}</Description>
        <Classification>
          <ID>${item.commodityCode.simplifiedCode || item.commodityCode.hsCode}</ID>
          <IdentificationTypeCode>HS</IdentificationTypeCode>
        </Classification>
        <GoodsMeasure>
          <GrossMassMeasure unitCode="KGM">${item.grossMass || 0}</GrossMassMeasure>
        </GoodsMeasure>
      </Commodity>

      <Origin>
        <CountryCode>${item.countryOfOrigin}</CountryCode>
      </Origin>

      <Packaging>
        <QuantityQuantity>${item.numberOfPackages || 1}</QuantityQuantity>
        <TypeCode>${item.packageType}</TypeCode>
      </Packaging>

      <Valuation>
        <IntrinsicValueAmount currencyID="EUR">${item.intrinsicValue}</IntrinsicValueAmount>
        <ItemCount>${item.itemCount}</ItemCount>
      </Valuation>
    </GoodsItem>

    <!-- Calculo de Impuestos -->
    <DutyTaxFee>
      <!-- Sin aranceles para H7 (valor <= 150 EUR) -->
      <DutyAmount currencyID="EUR">0</DutyAmount>
      <DutyExemptionCode>H7E</DutyExemptionCode>

      <!-- IVA -->
      <VATRate>${vat.vatRate}</VATRate>
      <VATAmount currencyID="EUR">${vat.vatAmount.toFixed(2)}</VATAmount>
      ${vat.vatAlreadyPaid ? '<VATAlreadyPaidIndicator>1</VATAlreadyPaidIndicator>' : ''}

      <TotalTaxAmount currencyID="EUR">${vat.totalToPay.toFixed(2)}</TotalTaxAmount>
    </DutyTaxFee>

  </Declaration>
</CC513C>`;
  }

  /**
   * Calcular resumen H7
   */
  calculateSummary(h7Data, expedition) {
    return {
      lrn: h7Data.lrn,
      declarationType: h7Data.declarationType,
      declarationTypeDescription: H7_TYPES[h7Data.declarationType] || 'H7',

      // Valor
      intrinsicValue: h7Data.shipment.intrinsicValue,
      valueLimit: H7_VALUE_LIMIT,
      withinLimit: h7Data.shipment.intrinsicValue <= H7_VALUE_LIMIT,

      // IOSS
      hasIOSS: !!h7Data.iossData,
      iossNumber: h7Data.iossData?.iossNumber,

      // Items
      totalItems: h7Data.goodsItem.itemCount,
      itemDescription: h7Data.goodsItem.goodsDescription,

      // Origen/Destino
      originCountry: h7Data.shipment.countryOfDispatch,
      destinationCountry: h7Data.shipment.countryOfDestination,

      // Transporte
      trackingNumber: h7Data.shipment.trackingNumber,
      transportMode: h7Data.shipment.transportMode === '5' ? 'Postal' : 'Express',

      // Aduana
      customsOffice: h7Data.declarationHeader.customsOffice,
      customsOfficeName: H7_CUSTOMS_OFFICES[h7Data.declarationHeader.customsOffice] || 'Desconocido',

      // Impuestos
      dutyAmount: 0,
      dutyExempt: true,
      vatRate: h7Data.vatCalculation.vatRate,
      vatAmount: h7Data.vatCalculation.vatAmount,
      vatAlreadyPaid: h7Data.vatCalculation.vatAlreadyPaid,
      totalToPay: h7Data.vatCalculation.totalToPay,

      // Consignatario
      consigneeName: h7Data.declarationHeader.consignee.name,
      isB2C: h7Data.declarationHeader.consignee.isPrivateIndividual,

      // Tiempos estimados
      estimatedClearanceTime: h7Data.iossData ? '< 1 hora' : '1-4 horas'
    };
  }

  /**
   * Determinar aduana segun codigo postal
   */
  determineCustomsOffice(expedition) {
    const postalCode = expedition.client?.address?.postalCode || '';
    const prefix = postalCode.substring(0, 2);

    // Mapear por codigo postal
    const postalToOffice = {
      '08': 'ES002805', // Barcelona
      '28': 'ES002101', // Madrid
      '46': 'ES004601', // Valencia
      '35': 'ES003501', // Las Palmas
      '38': 'ES003801', // Tenerife
      '11': 'ES003001'  // Algeciras/Cadiz
    };

    return postalToOffice[prefix] || 'ES002101'; // Madrid por defecto
  }

  /**
   * Obtener codigo de modo de transporte
   */
  getTransportModeCode(mode) {
    const codes = {
      postal: '5',
      air: '4',
      express: '4',
      road: '3'
    };
    return codes[mode] || '5'; // Postal por defecto para H7
  }

  /**
   * Escapar caracteres XML
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

module.exports = new H7Generator();
