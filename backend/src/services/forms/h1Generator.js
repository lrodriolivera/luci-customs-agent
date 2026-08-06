/**
 * Generador de declaraciones H1 (Importacion)
 * Formato segun nuevo sistema AEAT desde octubre 2025
 * EUCDM Anexo B - Conjunto de datos completo
 *
 * Estructura H1:
 * - D10: Declaration Header
 * - GS11: Goods Shipment
 * - SI12: Goods Items
 * - DutyTaxFee: Liquidacion
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
 * Metodos de valoracion (Art. 70-74 CAU)
 */
const VALUATION_METHODS = {
  '1': 'Valor de transaccion (Art. 70 CAU)',
  '2': 'Valor de transaccion de mercancias identicas (Art. 74.2.a)',
  '3': 'Valor de transaccion de mercancias similares (Art. 74.2.b)',
  '4': 'Metodo deductivo (Art. 74.2.c)',
  '5': 'Metodo del valor calculado (Art. 74.2.d)',
  '6': 'Metodo del ultimo recurso (Art. 74.3)'
};

/**
 * Metodos de pago
 */
const PAYMENT_METHODS = {
  'A': 'Pago al contado',
  'B': 'Pago con tarjeta de credito',
  'C': 'Pago con cheque',
  'D': 'Otro (transferencia, etc.)',
  'E': 'Aplazamiento de pago',
  'G': 'Aplazamiento con garantia global',
  'H': 'Transferencia electronica',
  'M': 'Garantia individual',
  'P': 'Deposito en cuenta aduanera',
  'R': 'Garantia en metalico',
  'S': 'Garantia individual con compromiso fiador',
  'T': 'Cuenta corriente tributaria'
};

/**
 * Tipos de impuestos/derechos
 */
const DUTY_TYPES = {
  'A00': 'Derechos de importacion',
  'A10': 'Derechos antidumping',
  'A20': 'Derechos compensatorios',
  'A30': 'Derechos adicionales',
  'B00': 'IVA',
  'C00': 'Derechos de exportacion',
  'E00': 'Impuestos especiales'
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

/**
 * Tipos de ubicacion de mercancias
 */
const LOCATION_TYPES = {
  'A': 'Direccion designada',
  'B': 'Codigo autorizado',
  'C': 'Codigo aduanero',
  'D': 'Coordenadas GPS'
};

/**
 * Calificadores de ubicacion
 */
const LOCATION_QUALIFIERS = {
  'T': 'Deposito temporal',
  'V': 'Recinto aduanero',
  'W': 'Instalaciones del operador',
  'X': 'Lugar de control fronterizo',
  'Y': 'Otro lugar',
  'Z': 'Zonas francas'
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
      goodsItems: this.buildGoodsItems(expedition, aiData),
      valuation: this.buildValuation(expedition, aiData),
      dutyTaxFee: this.buildDutyTaxFee(expedition, aiData),
      guarantee: this.buildGuarantee(expedition, aiData)
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
  /**
   * Un DUA con peso, importe o bultos a cero es una declaracion incorrecta ante
   * la AEAT, pero el XML sale sintacticamente valido y se presentaba sin un
   * solo aviso.
   *
   * Pasa cuando `goodsSummary` no se calculo: el hook pre-save del expediente
   * suma `grossWeight` / `invoiceValue` / `packages.quantity` de cada partida,
   * y si esos campos llegaron con otro nombre Mongoose los descarta en
   * silencio. El error nombra el expediente y el campo para que el agente sepa
   * donde mirar.
   */
  totalesNoDeclarables(expedition) {
    const resumen = expedition?.goodsSummary || {};

    const faltantes = [];
    if (!(resumen.totalGrossWeight > 0)) faltantes.push('peso bruto total');
    if (!(resumen.totalValue > 0)) faltantes.push('importe de factura total');
    if (!(resumen.totalPackages > 0)) faltantes.push('numero de bultos');

    if (faltantes.length === 0) return null;

    const ref = expedition?.expeditionId || expedition?._id || 'sin identificar';
    return `No se puede generar el H1 del expediente ${ref}: ${faltantes.join(', ')} a cero. ` +
      'Revisa que cada partida declare grossWeight, invoiceValue y packages.quantity.';
  }

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
      additionalDeclarationType: aiData.additionalDeclarationType || 'A',

      // Aduana
      customsOfficePresentation: aiData.customsOffice || this.determineCustomsOffice(expedition),
      customsOfficeLodgement: aiData.customsOffice || this.determineCustomsOffice(expedition),
      customsOfficeEntry: aiData.customsOfficeEntry || this.determineCustomsOffice(expedition),
      customsOfficeSupervision: aiData.customsOfficeSupervision || null,
      customsOfficeGuarantee: aiData.customsOfficeGuarantee || null,

      // Importador
      importer: {
        identificationNumber: expedition.client?.eori || `ES${expedition.client?.nif}`,
        name: expedition.client?.companyName,
        address: {
          streetAndNumber: expedition.client?.address?.street,
          city: expedition.client?.address?.city,
          postcode: expedition.client?.address?.postalCode,
          country: 'ES'
        },
        contact: {
          name: expedition.client?.contact?.name,
          phone: expedition.client?.contact?.phone,
          email: expedition.client?.contact?.email
        }
      },

      // Declarante (representante)
      declarant: {
        identificationNumber: expedition.representative?.eori || `ES${expedition.representative?.nif}`,
        name: expedition.representative?.companyName || 'STRIX AI SL',
        representativeStatus: expedition.representative?.representationType === 'direct' ? '2' : '3',
        contact: {
          name: expedition.representative?.contact?.name || 'Departamento Aduanas',
          phone: expedition.representative?.contact?.phone,
          email: expedition.representative?.contact?.email
        }
      },

      // Exportador
      exporter: expedition.exporter ? {
        identificationNumber: expedition.exporter.eori,
        name: expedition.exporter.companyName,
        address: {
          streetAndNumber: expedition.exporter.address,
          city: expedition.exporter.city,
          postcode: expedition.exporter.postalCode,
          country: expedition.exporter.country
        }
      } : null,

      // Comprador (si diferente del importador)
      buyer: expedition.buyer ? {
        identificationNumber: expedition.buyer.eori || expedition.buyer.nif,
        name: expedition.buyer.companyName,
        address: {
          streetAndNumber: expedition.buyer.address?.street,
          city: expedition.buyer.address?.city,
          postcode: expedition.buyer.address?.postalCode,
          country: expedition.buyer.address?.country
        }
      } : null,

      // Vendedor (si diferente del exportador)
      seller: expedition.seller ? {
        identificationNumber: expedition.seller.eori || expedition.seller.nif,
        name: expedition.seller.companyName,
        address: {
          streetAndNumber: expedition.seller.address?.street,
          city: expedition.seller.address?.city,
          postcode: expedition.seller.address?.postalCode,
          country: expedition.seller.address?.country
        }
      } : null,

      // Destinatario (si diferente del importador)
      consignee: expedition.consignee ? {
        identificationNumber: expedition.consignee.eori || expedition.consignee.nif,
        name: expedition.consignee.companyName,
        address: {
          streetAndNumber: expedition.consignee.address?.street,
          city: expedition.consignee.address?.city,
          postcode: expedition.consignee.address?.postalCode,
          country: expedition.consignee.address?.country
        }
      } : null,

      // Titular regimen (para regimenes especiales)
      holderOfProcedure: expedition.holderOfProcedure ? {
        identificationNumber: expedition.holderOfProcedure.eori,
        name: expedition.holderOfProcedure.companyName
      } : null,

      // Titular autorizacion
      holderOfAuthorization: expedition.holderOfAuthorization ? {
        identificationNumber: expedition.holderOfAuthorization.eori,
        authorizationType: expedition.holderOfAuthorization.type,
        authorizationNumber: expedition.holderOfAuthorization.number
      } : null,

      // Totales
      totalPackages: expedition.goodsSummary?.totalPackages || 0,
      totalGrossMass: expedition.goodsSummary?.totalGrossWeight || 0,
      invoiceNumber: expedition.invoice?.number,

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
      countryOfFirstEntry: aiData.countryOfFirstEntry || 'ES',

      // Destino
      countryOfDestination: 'ES',
      regionOfDestination: expedition.client?.address?.province || this.getRegionCode(expedition.client?.address?.city),

      // Pais de procedencia (ultimo pais antes de UE)
      countryOfProvenance: expedition.transport?.countryOfProvenance || expedition.exporter?.country,

      // Transporte
      transportMeans: {
        modeAtBorder: this.getTransportModeCode(expedition.transportMode),
        modeInland: aiData.transportModeInland || '3',
        identityAtBorder: expedition.transport?.vehicleId,
        identityInland: expedition.transport?.inlandVehicleId,
        nationality: expedition.transport?.vehicleNationality,
        typeCode: this.getTransportTypeCode(expedition.transportMode),
        referenceNumber: expedition.transport?.voyageNumber || expedition.transport?.flightNumber
      },

      // Ubicacion de mercancias (5/13 - CRITICO)
      goodsLocation: {
        typeOfLocation: aiData.goodsLocationType || 'B',
        qualifierOfIdentification: aiData.goodsLocationQualifier || 'T',
        identificationOfLocation: expedition.transport?.temporaryStorageCode || expedition.transport?.warehouseCode,
        additionalIdentifier: expedition.transport?.warehouseId,
        unLocode: expedition.transport?.unLocode,
        gpsCoordinates: expedition.transport?.gpsCoordinates,
        address: expedition.transport?.storageAddress ? {
          streetAndNumber: expedition.transport.storageAddress.street,
          city: expedition.transport.storageAddress.city,
          postcode: expedition.transport.storageAddress.postalCode,
          country: expedition.transport.storageAddress.country || 'ES'
        } : null
      },

      // Ubicacion carga/descarga
      placeOfLoading: {
        country: expedition.transport?.loadingPlace?.substring(0, 2) || expedition.exporter?.country,
        location: expedition.transport?.loadingPlace,
        unLocode: expedition.transport?.loadingUnLocode
      },
      placeOfUnloading: {
        country: 'ES',
        location: expedition.transport?.unloadingPlace || expedition.transport?.arrivalPort,
        unLocode: expedition.transport?.unloadingUnLocode
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
        sealNumber: c.sealNumber,
        sealType: c.sealType || '1',
        sealIdentity: c.sealIdentity
      })) || [],

      // Incoterm
      deliveryTerms: {
        code: expedition.incoterm?.code || 'CIF',
        location: expedition.incoterm?.place,
        country: expedition.incoterm?.country || 'ES'
      },

      // Valores comerciales
      totalInvoicedAmount: expedition.goodsSummary?.totalValue || 0,
      currency: expedition.invoice?.currency || 'EUR',
      exchangeRate: expedition.invoice?.exchangeRate || 1,

      // Gastos de transporte (7/14 - CRITICO)
      transportCharges: {
        freightAmount: expedition.costs?.freight || expedition.customsValue?.freight || 0,
        freightCurrency: expedition.costs?.freightCurrency || 'EUR',
        freightPaymentMethod: expedition.costs?.freightPaymentMethod || 'A', // A=prepaid, B=collect
        freightToDestination: expedition.costs?.freightToDestination || true
      },

      // Gastos de seguro (7/15 - CRITICO)
      insuranceCharges: {
        insuranceAmount: expedition.costs?.insurance || expedition.customsValue?.insurance || 0,
        insuranceCurrency: expedition.costs?.insuranceCurrency || 'EUR'
      }
    };
  }

  /**
   * Construir valoracion aduanera (Grupo 4 - CRITICO)
   */
  buildValuation(expedition, aiData) {
    const invoiceValue = expedition.goodsSummary?.totalValue || 0;
    const freight = expedition.costs?.freight || expedition.customsValue?.freight || 0;
    const insurance = expedition.costs?.insurance || expedition.customsValue?.insurance || 0;

    // Calcular adiciones al precio (4/9)
    const additions = {
      commissions: expedition.valuation?.commissions || 0,
      brokerage: expedition.valuation?.brokerage || 0,
      containers: expedition.valuation?.containers || 0,
      packing: expedition.valuation?.packing || 0,
      materials: expedition.valuation?.materials || 0,
      tools: expedition.valuation?.tools || 0,
      consumed: expedition.valuation?.consumed || 0,
      engineering: expedition.valuation?.engineering || 0,
      royalties: expedition.valuation?.royalties || 0,
      resaleProceeds: expedition.valuation?.resaleProceeds || 0,
      freightToEU: freight,
      insuranceToEU: insurance
    };

    const totalAdditions = Object.values(additions).reduce((sum, val) => sum + (val || 0), 0);

    // Calcular deducciones (4/10)
    const deductions = {
      freightAfterImport: expedition.valuation?.freightAfterImport || 0,
      installationCharges: expedition.valuation?.installationCharges || 0,
      customsDuties: expedition.valuation?.customsDuties || 0,
      interestCharges: expedition.valuation?.interestCharges || 0,
      buyingCommissions: expedition.valuation?.buyingCommissions || 0,
      postImportTransport: expedition.valuation?.postImportTransport || 0,
      constructionCharges: expedition.valuation?.constructionCharges || 0,
      otherDeductions: expedition.valuation?.otherDeductions || 0
    };

    const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + (val || 0), 0);

    // Valor en aduana (Art. 70 CAU)
    const customsValue = invoiceValue + totalAdditions - totalDeductions;

    return {
      // Metodo de valoracion (4/11 - CRITICO)
      valuationMethod: aiData.valuationMethod || expedition.valuation?.method || '1',
      valuationMethodDescription: VALUATION_METHODS[aiData.valuationMethod || expedition.valuation?.method || '1'],

      // Indicadores de valoracion
      indicators: {
        relatedParty: expedition.valuation?.relatedParty || false,
        relatedPartyInfluence: expedition.valuation?.relatedPartyInfluence || false,
        restrictions: expedition.valuation?.restrictions || false,
        conditions: expedition.valuation?.conditions || false,
        royaltiesIncluded: expedition.valuation?.royaltiesIncluded || (additions.royalties > 0),
        resaleProceedsIncluded: expedition.valuation?.resaleProceedsIncluded || (additions.resaleProceeds > 0)
      },

      // Valor factura
      invoiceValue,
      invoiceCurrency: expedition.invoice?.currency || 'EUR',
      exchangeRate: expedition.invoice?.exchangeRate || 1,

      // Adiciones (4/9 - CRITICO)
      additions,
      totalAdditions,

      // Deducciones (4/10 - CRITICO)
      deductions,
      totalDeductions,

      // Valor en aduana calculado
      customsValue,

      // Valor estadistico
      statisticalValue: customsValue
    };
  }

  /**
   * Construir liquidacion (Grupo 8 - CRITICO)
   */
  buildDutyTaxFee(expedition, aiData) {
    const valuation = this.buildValuation(expedition, aiData);
    const customsValue = valuation.customsValue;

    // Obtener tasas arancelarias (simplificado - en produccion vendria de TARIC)
    const tariffRate = aiData.tariffRate ?? expedition.duties?.tariffRate ?? 0;
    const vatRate = aiData.vatRate ?? 21; // IVA general Espana
    const exciseRate = aiData.exciseRate ?? 0;
    const antidumpingRate = aiData.antidumpingRate ?? 0;

    // Calculos
    const tariffAmount = Math.round(customsValue * tariffRate / 100 * 100) / 100;
    const antidumpingAmount = Math.round(customsValue * antidumpingRate / 100 * 100) / 100;
    const exciseAmount = Math.round(customsValue * exciseRate / 100 * 100) / 100;

    // Base para IVA = valor aduanero + derechos
    const vatBase = customsValue + tariffAmount + antidumpingAmount + exciseAmount;
    const vatAmount = Math.round(vatBase * vatRate / 100 * 100) / 100;

    // Total deuda aduanera
    const totalDuty = tariffAmount + antidumpingAmount + exciseAmount + vatAmount;

    return {
      // Derechos de importacion (8/1)
      importDuty: {
        type: 'A00',
        typeDescription: DUTY_TYPES['A00'],
        rate: tariffRate,
        baseAmount: customsValue,
        payableAmount: tariffAmount
      },

      // Derechos antidumping (8/4)
      antidumpingDuty: antidumpingRate > 0 ? {
        type: 'A10',
        typeDescription: DUTY_TYPES['A10'],
        rate: antidumpingRate,
        baseAmount: customsValue,
        payableAmount: antidumpingAmount
      } : null,

      // Impuestos especiales (8/3)
      exciseDuty: exciseRate > 0 ? {
        type: 'E00',
        typeDescription: DUTY_TYPES['E00'],
        rate: exciseRate,
        baseAmount: customsValue,
        payableAmount: exciseAmount
      } : null,

      // IVA (8/2)
      vat: {
        type: 'B00',
        typeDescription: DUTY_TYPES['B00'],
        rate: vatRate,
        baseAmount: vatBase,
        payableAmount: vatAmount
      },

      // Total deuda aduanera (8/6 - CRITICO)
      totalDuty,
      totalDutyCurrency: 'EUR',

      // Metodo de pago (8/7 - CRITICO)
      paymentMethod: aiData.paymentMethod || expedition.payment?.method || 'A',
      paymentMethodDescription: PAYMENT_METHODS[aiData.paymentMethod || expedition.payment?.method || 'A'],

      // Aplazamiento de pago
      deferredPayment: expedition.payment?.deferred ? {
        accountNumber: expedition.payment.deferredAccount,
        authorizationNumber: expedition.payment.deferredAuthorization
      } : null,

      // Desglose por partida
      itemDuties: []
    };
  }

  /**
   * Construir garantia
   */
  buildGuarantee(expedition, aiData) {
    if (!expedition.guarantee && !aiData.guarantee) {
      return null;
    }

    const guarantee = expedition.guarantee || aiData.guarantee || {};

    return {
      // Codigo garantia (8/8)
      guaranteeType: guarantee.type || '1',
      grn: guarantee.grn,
      accessCode: guarantee.accessCode,

      // Importe garantia (8/9)
      guaranteeAmount: guarantee.amount,
      guaranteeCurrency: guarantee.currency || 'EUR',

      // Referencia garantia (8/10)
      guaranteeReference: guarantee.reference,

      // Aduana de garantia
      customsOfficeOfGuarantee: guarantee.customsOffice,

      // Garante
      guarantor: guarantee.guarantor ? {
        identificationNumber: guarantee.guarantor.eori || guarantee.guarantor.nif,
        name: guarantee.guarantor.name
      } : null
    };
  }

  /**
   * Construir partidas de mercancias (SI12)
   */
  buildGoodsItems(expedition, aiData) {
    const valuation = this.buildValuation(expedition, aiData);

    return expedition.goods.map((good, index) => {
      // Calcular valor proporcional de la partida
      const itemValue = good.invoiceValue || 0;
      const totalValue = expedition.goodsSummary?.totalValue || itemValue;
      const proportion = totalValue > 0 ? itemValue / totalValue : 1;

      // Valor en aduana de la partida
      const itemCustomsValue = Math.round(valuation.customsValue * proportion * 100) / 100;

      return {
        itemNumber: index + 1,

        // Clasificacion
        commodityCode: {
          harmonizedSystemCode: good.hsCode || good.taricCode?.substring(0, 6),
          combinedNomenclatureCode: good.taricCode?.substring(0, 8),
          taricCode: good.taricCode,
          taricAdditionalCode: good.taricAdditionalCode || good.taricCode?.substring(10, 14),
          nationalAdditionalCode: good.nationalCode,
          cusCode: good.cusCode
        },

        // Descripcion
        goodsDescription: good.description,
        descriptionOfGoods: good.descriptionEs || good.description,

        // Regimen
        requestedProcedure: aiData.regime || good.regime || '40',
        previousProcedure: good.previousProcedure || '00',
        additionalProcedure: good.additionalProcedure || aiData.additionalProcedure || '000',

        // Origen y preferencia
        countryOfOrigin: good.originCountry || expedition.exporter?.country,
        regionOfOrigin: good.regionOfOrigin,
        preferentialOrigin: good.preferentialOrigin || good.originCountry,
        preference: good.preference || aiData.preference || '100',
        countryOfPreferentialDestination: good.preferentialDestination,

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
        invoiceValue: itemValue,
        customsValue: itemCustomsValue,
        statisticalValue: good.statisticalValue || itemCustomsValue,
        itemPrice: itemValue,
        valuationAdjustment: good.valuationAdjustment,

        // Informacion adicional
        additionalInformation: good.additionalInformation || [],

        // Documentos previos
        previousDocuments: good.previousDocuments || [],

        // Documentos presentados
        supportingDocuments: this.buildSupportingDocuments(expedition, good),

        // Codigo uso final (para regimen 44)
        endUseCode: good.endUseCode,

        // UN/LOCODE
        unLocode: good.unLocode
      };
    });
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
        type: 'N380',
        reference: invoice.originalName || expedition.invoice?.number,
        date: invoice.uploadedAt,
        issuer: invoice.issuer
      });
    }

    // Documento transporte
    const transportDoc = expedition.documents?.find(d =>
      ['bill_of_lading', 'air_waybill', 'cmr'].includes(d.type)
    );
    if (transportDoc) {
      docs.push({
        type: this.getDocumentTypeCode(transportDoc.type),
        reference: expedition.transport?.documentNumber,
        date: transportDoc.uploadedAt
      });
    }

    // Certificado origen si aplica
    const originCert = expedition.documents?.find(d =>
      ['certificate_origin', 'eur1', 'atr', 'form_a'].includes(d.type)
    );
    if (originCert) {
      docs.push({
        type: this.getDocumentTypeCode(originCert.type),
        reference: originCert.originalName,
        date: originCert.uploadedAt,
        validUntil: originCert.validUntil
      });
    }

    // Packing list
    const packingList = expedition.documents?.find(d => d.type === 'packing_list');
    if (packingList) {
      docs.push({
        type: 'N271',
        reference: packingList.originalName,
        date: packingList.uploadedAt
      });
    }

    // Certificados sanitarios/fitosanitarios
    const sanitaryCert = expedition.documents?.find(d => d.type === 'sanitary_certificate');
    if (sanitaryCert) {
      docs.push({
        type: 'C678',
        reference: sanitaryCert.originalName,
        date: sanitaryCert.uploadedAt
      });
    }

    const phytoCert = expedition.documents?.find(d => d.type === 'phytosanitary_certificate');
    if (phytoCert) {
      docs.push({
        type: 'C635',
        reference: phytoCert.originalName,
        date: phytoCert.uploadedAt
      });
    }

    // Licencias de importacion
    const importLicense = expedition.documents?.find(d => d.type === 'import_license');
    if (importLicense) {
      docs.push({
        type: 'N990',
        reference: importLicense.originalName,
        date: importLicense.uploadedAt
      });
    }

    // Documentos adicionales de la mercancia
    if (good.documents) {
      good.documents.forEach(doc => {
        docs.push({
          type: doc.type,
          reference: doc.reference,
          date: doc.date
        });
      });
    }

    return docs;
  }

  /**
   * Generar XML en formato AEAT/EUCDM
   */
  generateXML(h1Data) {
    const header = h1Data.declarationHeader;
    const shipment = h1Data.goodsShipment;
    const valuation = h1Data.valuation;
    const duties = h1Data.dutyTaxFee;
    const guarantee = h1Data.guarantee;
    const items = h1Data.goodsItems;

    return `<?xml version="1.0" encoding="UTF-8"?>
<CC515C xmlns="urn:wco:datamodel:WCO:DEC-DMS:2">
  <MessageSender>LUCI-CUSTOMS</MessageSender>
  <MessageRecipient>ES.AEAT</MessageRecipient>
  <PreparationDateTime>${new Date().toISOString()}</PreparationDateTime>
  <MessageIdentification>${h1Data.lrn}</MessageIdentification>
  <MessageType>CC515C</MessageType>

  <!-- ==================== D10 - Declaration Header ==================== -->
  <Declaration>
    <FunctionCode>9</FunctionCode>
    <TypeCode>${header.declarationType}</TypeCode>
    <AdditionalTypeCode>${header.additionalDeclarationType}</AdditionalTypeCode>
    <GoodsItemQuantity>${items.length}</GoodsItemQuantity>
    <TotalPackageQuantity>${header.totalPackages}</TotalPackageQuantity>
    <TotalGrossMassMeasure>${header.totalGrossMass}</TotalGrossMassMeasure>
    ${header.invoiceNumber ? `<InvoiceNumber>${this.escapeXml(header.invoiceNumber)}</InvoiceNumber>` : ''}

    <DeclarationOfficeID>${header.customsOfficePresentation}</DeclarationOfficeID>
    <LRN>${h1Data.lrn}</LRN>

    <!-- Aduana de entrada (5/14) -->
    ${header.customsOfficeEntry ? `<EntryCustomsOfficeID>${header.customsOfficeEntry}</EntryCustomsOfficeID>` : ''}

    <!-- Aduana de supervision (5/17) - para regimenes especiales -->
    ${header.customsOfficeSupervision ? `<SupervisingCustomsOfficeID>${header.customsOfficeSupervision}</SupervisingCustomsOfficeID>` : ''}

    <!-- Aduana de garantia (5/18) -->
    ${header.customsOfficeGuarantee ? `<GuaranteeCustomsOfficeID>${header.customsOfficeGuarantee}</GuaranteeCustomsOfficeID>` : ''}

    <!-- ==================== Grupo 3 - Partes ==================== -->

    <!-- Importador (3/7, 3/8, 3/9) -->
    <Importer>
      <IdentificationID>${header.importer.identificationNumber}</IdentificationID>
      <Name>${this.escapeXml(header.importer.name)}</Name>
      <Address>
        <Line>${this.escapeXml(header.importer.address.streetAndNumber || '')}</Line>
        <CityName>${this.escapeXml(header.importer.address.city || '')}</CityName>
        <PostcodeID>${header.importer.address.postcode || ''}</PostcodeID>
        <CountryCode>${header.importer.address.country}</CountryCode>
      </Address>
      ${header.importer.contact?.name ? `
      <Contact>
        <Name>${this.escapeXml(header.importer.contact.name)}</Name>
        ${header.importer.contact.phone ? `<PhoneNumber>${header.importer.contact.phone}</PhoneNumber>` : ''}
        ${header.importer.contact.email ? `<Email>${header.importer.contact.email}</Email>` : ''}
      </Contact>` : ''}
    </Importer>

    <!-- Declarante/Representante (3/10, 3/11, 3/12) -->
    <Declarant>
      <IdentificationID>${header.declarant.identificationNumber}</IdentificationID>
      <Name>${this.escapeXml(header.declarant.name)}</Name>
      <StatusCode>${header.declarant.representativeStatus}</StatusCode>
      ${header.declarant.contact?.name ? `
      <Contact>
        <Name>${this.escapeXml(header.declarant.contact.name)}</Name>
        ${header.declarant.contact.phone ? `<PhoneNumber>${header.declarant.contact.phone}</PhoneNumber>` : ''}
        ${header.declarant.contact.email ? `<Email>${header.declarant.contact.email}</Email>` : ''}
      </Contact>` : ''}
    </Declarant>

    ${header.exporter ? `
    <!-- Exportador (3/1, 3/2) -->
    <Exporter>
      ${header.exporter.identificationNumber ? `<IdentificationID>${header.exporter.identificationNumber}</IdentificationID>` : ''}
      <Name>${this.escapeXml(header.exporter.name)}</Name>
      <Address>
        <Line>${this.escapeXml(header.exporter.address.streetAndNumber || '')}</Line>
        <CityName>${this.escapeXml(header.exporter.address.city || '')}</CityName>
        ${header.exporter.address.postcode ? `<PostcodeID>${header.exporter.address.postcode}</PostcodeID>` : ''}
        <CountryCode>${header.exporter.address.country}</CountryCode>
      </Address>
    </Exporter>` : ''}

    ${header.buyer ? `
    <!-- Comprador (3/15) -->
    <Buyer>
      ${header.buyer.identificationNumber ? `<IdentificationID>${header.buyer.identificationNumber}</IdentificationID>` : ''}
      <Name>${this.escapeXml(header.buyer.name)}</Name>
      <Address>
        <Line>${this.escapeXml(header.buyer.address?.streetAndNumber || '')}</Line>
        <CityName>${this.escapeXml(header.buyer.address?.city || '')}</CityName>
        <CountryCode>${header.buyer.address?.country || 'ES'}</CountryCode>
      </Address>
    </Buyer>` : ''}

    ${header.seller ? `
    <!-- Vendedor (3/16) -->
    <Seller>
      ${header.seller.identificationNumber ? `<IdentificationID>${header.seller.identificationNumber}</IdentificationID>` : ''}
      <Name>${this.escapeXml(header.seller.name)}</Name>
      <Address>
        <Line>${this.escapeXml(header.seller.address?.streetAndNumber || '')}</Line>
        <CityName>${this.escapeXml(header.seller.address?.city || '')}</CityName>
        <CountryCode>${header.seller.address?.country || ''}</CountryCode>
      </Address>
    </Seller>` : ''}

    ${header.holderOfProcedure ? `
    <!-- Titular del regimen (3/19) -->
    <HolderOfTheProcedure>
      <IdentificationID>${header.holderOfProcedure.identificationNumber}</IdentificationID>
      <Name>${this.escapeXml(header.holderOfProcedure.name)}</Name>
    </HolderOfTheProcedure>` : ''}

    ${header.holderOfAuthorization ? `
    <!-- Titular de la autorizacion (3/20) -->
    <HolderOfTheAuthorisation>
      <IdentificationID>${header.holderOfAuthorization.identificationNumber}</IdentificationID>
      <AuthorisationTypeCode>${header.holderOfAuthorization.authorizationType}</AuthorisationTypeCode>
      <AuthorisationReferenceNumber>${header.holderOfAuthorization.authorizationNumber}</AuthorisationReferenceNumber>
    </HolderOfTheAuthorisation>` : ''}

    <!-- ==================== GS11 - Goods Shipment ==================== -->
    <GoodsShipment>
      <Consignment>
        <ContainerIndicator>${shipment.containerIndicator}</ContainerIndicator>
        <GrossWeight>${header.totalGrossMass}</GrossWeight>

        <!-- Paises (Grupo 5) -->
        <CountryOfDispatchCode>${shipment.countryOfDispatch}</CountryOfDispatchCode>
        <CountryOfDestinationCode>${shipment.countryOfDestination}</CountryOfDestinationCode>
        <RegionOfDestination>${shipment.regionOfDestination}</RegionOfDestination>
        ${shipment.countryOfProvenance ? `<CountryOfProvenanceCode>${shipment.countryOfProvenance}</CountryOfProvenanceCode>` : ''}
        ${shipment.countryOfFirstEntry ? `<CountryOfFirstEntryCode>${shipment.countryOfFirstEntry}</CountryOfFirstEntryCode>` : ''}

        <!-- Transporte (Grupo 7) -->
        <TransportMeans>
          <ModeCode>${shipment.transportMeans.modeAtBorder}</ModeCode>
          <TypeCode>${shipment.transportMeans.typeCode || ''}</TypeCode>
          <IdentificationNumber>${this.escapeXml(shipment.transportMeans.identityAtBorder || '')}</IdentificationNumber>
          ${shipment.transportMeans.nationality ? `<RegistrationNationalityCode>${shipment.transportMeans.nationality}</RegistrationNationalityCode>` : ''}
          ${shipment.transportMeans.referenceNumber ? `<ReferenceNumber>${shipment.transportMeans.referenceNumber}</ReferenceNumber>` : ''}
        </TransportMeans>

        <DepartureTransportMeans>
          <ModeCode>${shipment.transportMeans.modeInland}</ModeCode>
          ${shipment.transportMeans.identityInland ? `<IdentificationNumber>${this.escapeXml(shipment.transportMeans.identityInland)}</IdentificationNumber>` : ''}
        </DepartureTransportMeans>

        <!-- Localizacion de mercancias (5/13 - CRITICO) -->
        <GoodsLocation>
          <TypeOfLocation>${shipment.goodsLocation.typeOfLocation}</TypeOfLocation>
          <QualifierOfIdentification>${shipment.goodsLocation.qualifierOfIdentification}</QualifierOfIdentification>
          ${shipment.goodsLocation.identificationOfLocation ? `<IdentificationOfLocation>${shipment.goodsLocation.identificationOfLocation}</IdentificationOfLocation>` : ''}
          ${shipment.goodsLocation.additionalIdentifier ? `<AdditionalIdentifier>${shipment.goodsLocation.additionalIdentifier}</AdditionalIdentifier>` : ''}
          ${shipment.goodsLocation.unLocode ? `<UNLOCODE>${shipment.goodsLocation.unLocode}</UNLOCODE>` : ''}
          ${shipment.goodsLocation.gpsCoordinates ? `
          <GPS>
            <Latitude>${shipment.goodsLocation.gpsCoordinates.latitude}</Latitude>
            <Longitude>${shipment.goodsLocation.gpsCoordinates.longitude}</Longitude>
          </GPS>` : ''}
          ${shipment.goodsLocation.address ? `
          <Address>
            <Line>${this.escapeXml(shipment.goodsLocation.address.streetAndNumber || '')}</Line>
            <CityName>${this.escapeXml(shipment.goodsLocation.address.city || '')}</CityName>
            <PostcodeID>${shipment.goodsLocation.address.postcode || ''}</PostcodeID>
            <CountryCode>${shipment.goodsLocation.address.country}</CountryCode>
          </Address>` : ''}
        </GoodsLocation>

        <!-- Lugar de carga (5/11) -->
        <PlaceOfLoading>
          <CountryCode>${shipment.placeOfLoading.country}</CountryCode>
          ${shipment.placeOfLoading.location ? `<LocationName>${this.escapeXml(shipment.placeOfLoading.location)}</LocationName>` : ''}
          ${shipment.placeOfLoading.unLocode ? `<UNLOCODE>${shipment.placeOfLoading.unLocode}</UNLOCODE>` : ''}
        </PlaceOfLoading>

        <!-- Lugar de descarga (5/12) -->
        <PlaceOfUnloading>
          <CountryCode>${shipment.placeOfUnloading.country}</CountryCode>
          ${shipment.placeOfUnloading.location ? `<LocationName>${this.escapeXml(shipment.placeOfUnloading.location)}</LocationName>` : ''}
          ${shipment.placeOfUnloading.unLocode ? `<UNLOCODE>${shipment.placeOfUnloading.unLocode}</UNLOCODE>` : ''}
        </PlaceOfUnloading>

        <!-- Contenedores (7/9, 7/10, 7/11) -->
        <TransportEquipment>
          ${shipment.containers.map(c => `
          <Container>
            <IdentificationNumber>${c.containerNumber}</IdentificationNumber>
            <Seal>
              <SealNumber>${c.sealNumber || ''}</SealNumber>
              ${c.sealType ? `<SealType>${c.sealType}</SealType>` : ''}
              ${c.sealIdentity ? `<SealIdentity>${c.sealIdentity}</SealIdentity>` : ''}
            </Seal>
          </Container>`).join('')}
        </TransportEquipment>
      </Consignment>

      <!-- Condiciones de entrega (4/1, 4/2) -->
      <DeliveryTerms>
        <ConditionCode>${shipment.deliveryTerms.code}</ConditionCode>
        <LocationName>${this.escapeXml(shipment.deliveryTerms.location || '')}</LocationName>
        ${shipment.deliveryTerms.country ? `<CountryCode>${shipment.deliveryTerms.country}</CountryCode>` : ''}
      </DeliveryTerms>

      <!-- Terminos comerciales -->
      <TradeTerms>
        <InvoiceCurrencyCode>${shipment.currency}</InvoiceCurrencyCode>
        <TotalInvoiceAmount>${shipment.totalInvoicedAmount}</TotalInvoiceAmount>
        <ExchangeRate>${shipment.exchangeRate}</ExchangeRate>
      </TradeTerms>

      <!-- Gastos de transporte (7/14 - CRITICO) -->
      <FreightCharges>
        <FreightAmount currencyID="${shipment.transportCharges.freightCurrency}">${shipment.transportCharges.freightAmount}</FreightAmount>
        <PaymentMethodCode>${shipment.transportCharges.freightPaymentMethod}</PaymentMethodCode>
      </FreightCharges>

      <!-- Gastos de seguro (7/15 - CRITICO) -->
      <InsuranceCharges>
        <InsuranceAmount currencyID="${shipment.insuranceCharges.insuranceCurrency}">${shipment.insuranceCharges.insuranceAmount}</InsuranceAmount>
      </InsuranceCharges>

      <!-- ==================== Grupo 4 - Valoracion ==================== -->
      <CustomsValuation>
        <!-- Metodo de valoracion (4/11 - CRITICO) -->
        <ValuationMethod>${valuation.valuationMethod}</ValuationMethod>

        <!-- Indicadores de valoracion (4/12 a 4/15) -->
        <ValuationIndicators>
          <RelatedPartyIndicator>${valuation.indicators.relatedParty ? '1' : '0'}</RelatedPartyIndicator>
          <RelatedPartyInfluenceIndicator>${valuation.indicators.relatedPartyInfluence ? '1' : '0'}</RelatedPartyInfluenceIndicator>
          <RestrictionsIndicator>${valuation.indicators.restrictions ? '1' : '0'}</RestrictionsIndicator>
          <ConditionsIndicator>${valuation.indicators.conditions ? '1' : '0'}</ConditionsIndicator>
          <RoyaltiesIndicator>${valuation.indicators.royaltiesIncluded ? '1' : '0'}</RoyaltiesIndicator>
          <ResaleProceedsIndicator>${valuation.indicators.resaleProceedsIncluded ? '1' : '0'}</ResaleProceedsIndicator>
        </ValuationIndicators>

        <!-- Valor factura (4/6) -->
        <InvoiceValue currencyID="${valuation.invoiceCurrency}">${valuation.invoiceValue}</InvoiceValue>

        <!-- Adiciones al precio (4/9 - CRITICO) -->
        <Additions>
          ${valuation.additions.commissions > 0 ? `<Commissions>${valuation.additions.commissions}</Commissions>` : ''}
          ${valuation.additions.brokerage > 0 ? `<Brokerage>${valuation.additions.brokerage}</Brokerage>` : ''}
          ${valuation.additions.containers > 0 ? `<Containers>${valuation.additions.containers}</Containers>` : ''}
          ${valuation.additions.packing > 0 ? `<Packing>${valuation.additions.packing}</Packing>` : ''}
          ${valuation.additions.materials > 0 ? `<Materials>${valuation.additions.materials}</Materials>` : ''}
          ${valuation.additions.tools > 0 ? `<Tools>${valuation.additions.tools}</Tools>` : ''}
          ${valuation.additions.consumed > 0 ? `<Consumed>${valuation.additions.consumed}</Consumed>` : ''}
          ${valuation.additions.engineering > 0 ? `<Engineering>${valuation.additions.engineering}</Engineering>` : ''}
          ${valuation.additions.royalties > 0 ? `<Royalties>${valuation.additions.royalties}</Royalties>` : ''}
          ${valuation.additions.resaleProceeds > 0 ? `<ResaleProceeds>${valuation.additions.resaleProceeds}</ResaleProceeds>` : ''}
          <FreightToEU>${valuation.additions.freightToEU}</FreightToEU>
          <InsuranceToEU>${valuation.additions.insuranceToEU}</InsuranceToEU>
          <TotalAdditions>${valuation.totalAdditions}</TotalAdditions>
        </Additions>

        <!-- Deducciones (4/10 - CRITICO) -->
        <Deductions>
          ${valuation.deductions.freightAfterImport > 0 ? `<FreightAfterImport>${valuation.deductions.freightAfterImport}</FreightAfterImport>` : ''}
          ${valuation.deductions.installationCharges > 0 ? `<InstallationCharges>${valuation.deductions.installationCharges}</InstallationCharges>` : ''}
          ${valuation.deductions.customsDuties > 0 ? `<CustomsDuties>${valuation.deductions.customsDuties}</CustomsDuties>` : ''}
          ${valuation.deductions.interestCharges > 0 ? `<InterestCharges>${valuation.deductions.interestCharges}</InterestCharges>` : ''}
          ${valuation.deductions.buyingCommissions > 0 ? `<BuyingCommissions>${valuation.deductions.buyingCommissions}</BuyingCommissions>` : ''}
          ${valuation.deductions.postImportTransport > 0 ? `<PostImportTransport>${valuation.deductions.postImportTransport}</PostImportTransport>` : ''}
          ${valuation.deductions.constructionCharges > 0 ? `<ConstructionCharges>${valuation.deductions.constructionCharges}</ConstructionCharges>` : ''}
          ${valuation.deductions.otherDeductions > 0 ? `<OtherDeductions>${valuation.deductions.otherDeductions}</OtherDeductions>` : ''}
          <TotalDeductions>${valuation.totalDeductions}</TotalDeductions>
        </Deductions>

        <!-- Valor en aduana calculado (4/4) -->
        <CustomsValueAmount currencyID="EUR">${valuation.customsValue}</CustomsValueAmount>

        <!-- Valor estadistico (4/5) -->
        <StatisticalValue>${valuation.statisticalValue}</StatisticalValue>
      </CustomsValuation>

      <!-- ==================== Grupo 8 - Liquidacion ==================== -->
      <DutyTaxFee>
        <!-- Derechos de importacion (8/1) -->
        <ImportDuty>
          <TypeCode>${duties.importDuty.type}</TypeCode>
          <TaxRate>${duties.importDuty.rate}</TaxRate>
          <TaxBaseAmount currencyID="EUR">${duties.importDuty.baseAmount}</TaxBaseAmount>
          <PayableTaxAmount currencyID="EUR">${duties.importDuty.payableAmount}</PayableTaxAmount>
        </ImportDuty>

        ${duties.antidumpingDuty ? `
        <!-- Derechos antidumping (8/4) -->
        <AntidumpingDuty>
          <TypeCode>${duties.antidumpingDuty.type}</TypeCode>
          <TaxRate>${duties.antidumpingDuty.rate}</TaxRate>
          <TaxBaseAmount currencyID="EUR">${duties.antidumpingDuty.baseAmount}</TaxBaseAmount>
          <PayableTaxAmount currencyID="EUR">${duties.antidumpingDuty.payableAmount}</PayableTaxAmount>
        </AntidumpingDuty>` : ''}

        ${duties.exciseDuty ? `
        <!-- Impuestos especiales (8/3) -->
        <ExciseDuty>
          <TypeCode>${duties.exciseDuty.type}</TypeCode>
          <TaxRate>${duties.exciseDuty.rate}</TaxRate>
          <TaxBaseAmount currencyID="EUR">${duties.exciseDuty.baseAmount}</TaxBaseAmount>
          <PayableTaxAmount currencyID="EUR">${duties.exciseDuty.payableAmount}</PayableTaxAmount>
        </ExciseDuty>` : ''}

        <!-- IVA (8/2) -->
        <VAT>
          <TypeCode>${duties.vat.type}</TypeCode>
          <TaxRate>${duties.vat.rate}</TaxRate>
          <TaxBaseAmount currencyID="EUR">${duties.vat.baseAmount}</TaxBaseAmount>
          <PayableTaxAmount currencyID="EUR">${duties.vat.payableAmount}</PayableTaxAmount>
        </VAT>

        <!-- Total deuda aduanera (8/6 - CRITICO) -->
        <TotalDutyAmount currencyID="${duties.totalDutyCurrency}">${duties.totalDuty}</TotalDutyAmount>

        <!-- Metodo de pago (8/7 - CRITICO) -->
        <PaymentMethod>${duties.paymentMethod}</PaymentMethod>

        ${duties.deferredPayment ? `
        <!-- Aplazamiento de pago -->
        <DeferredPayment>
          <AccountNumber>${duties.deferredPayment.accountNumber}</AccountNumber>
          <AuthorisationNumber>${duties.deferredPayment.authorizationNumber}</AuthorisationNumber>
        </DeferredPayment>` : ''}
      </DutyTaxFee>

      ${guarantee ? `
      <!-- ==================== Garantia (8/8, 8/9, 8/10) ==================== -->
      <Guarantee>
        <GuaranteeType>${guarantee.guaranteeType}</GuaranteeType>
        ${guarantee.grn ? `<GRN>${guarantee.grn}</GRN>` : ''}
        ${guarantee.accessCode ? `<AccessCode>${guarantee.accessCode}</AccessCode>` : ''}
        ${guarantee.guaranteeAmount ? `<GuaranteeAmount currencyID="${guarantee.guaranteeCurrency}">${guarantee.guaranteeAmount}</GuaranteeAmount>` : ''}
        ${guarantee.guaranteeReference ? `<GuaranteeReference>${guarantee.guaranteeReference}</GuaranteeReference>` : ''}
        ${guarantee.customsOfficeOfGuarantee ? `<CustomsOfficeOfGuarantee>${guarantee.customsOfficeOfGuarantee}</CustomsOfficeOfGuarantee>` : ''}
        ${guarantee.guarantor ? `
        <Guarantor>
          <IdentificationID>${guarantee.guarantor.identificationNumber}</IdentificationID>
          <Name>${this.escapeXml(guarantee.guarantor.name)}</Name>
        </Guarantor>` : ''}
      </Guarantee>` : ''}

      <!-- ==================== SI12 - Goods Items ==================== -->
      ${items.map(item => `
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>${item.itemNumber}</SequenceNumeric>

        <!-- Clasificacion (Grupo 6) -->
        <Commodity>
          <Description>${this.escapeXml(item.goodsDescription)}</Description>
          <Classification>
            <ID>${item.commodityCode.taricCode}</ID>
            <IdentificationTypeCode>TSP</IdentificationTypeCode>
          </Classification>
          ${item.commodityCode.harmonizedSystemCode ? `
          <Classification>
            <ID>${item.commodityCode.harmonizedSystemCode}</ID>
            <IdentificationTypeCode>HS</IdentificationTypeCode>
          </Classification>` : ''}
          ${item.commodityCode.combinedNomenclatureCode ? `
          <Classification>
            <ID>${item.commodityCode.combinedNomenclatureCode}</ID>
            <IdentificationTypeCode>CN</IdentificationTypeCode>
          </Classification>` : ''}
          ${item.commodityCode.taricAdditionalCode ? `
          <Classification>
            <ID>${item.commodityCode.taricAdditionalCode}</ID>
            <IdentificationTypeCode>TRA</IdentificationTypeCode>
          </Classification>` : ''}
          ${item.commodityCode.nationalAdditionalCode ? `
          <Classification>
            <ID>${item.commodityCode.nationalAdditionalCode}</ID>
            <IdentificationTypeCode>NAC</IdentificationTypeCode>
          </Classification>` : ''}
          ${item.commodityCode.cusCode ? `
          <Classification>
            <ID>${item.commodityCode.cusCode}</ID>
            <IdentificationTypeCode>CUS</IdentificationTypeCode>
          </Classification>` : ''}
          <GoodsMeasure>
            <GrossMassMeasure>${item.grossMass || 0}</GrossMassMeasure>
            <NetNetWeightMeasure>${item.netMass || 0}</NetNetWeightMeasure>
            ${item.supplementaryUnits ? `<TariffQuantity unitCode="${item.supplementaryUnitsType || ''}">${item.supplementaryUnits}</TariffQuantity>` : ''}
          </GoodsMeasure>
        </Commodity>

        <!-- Regimen (1/11) -->
        <GovernmentProcedure>
          <CurrentCode>${item.requestedProcedure}</CurrentCode>
          <PreviousCode>${item.previousProcedure}</PreviousCode>
        </GovernmentProcedure>

        <AdditionalProcedure>
          <CurrentCode>${item.additionalProcedure}</CurrentCode>
        </AdditionalProcedure>

        <!-- Origen (5/5, 5/6) -->
        <Origin>
          <CountryCode>${item.countryOfOrigin}</CountryCode>
          ${item.regionOfOrigin ? `<RegionID>${item.regionOfOrigin}</RegionID>` : ''}
        </Origin>

        <!-- Preferencia (4/17) -->
        <Preference>
          <TypeCode>${item.preference}</TypeCode>
        </Preference>

        <!-- Bultos (6/5, 6/6, 6/7) -->
        <Packaging>
          <QuantityQuantity>${item.packaging.numberOfPackages || 0}</QuantityQuantity>
          <TypeCode>${item.packaging.typeOfPackages || 'PK'}</TypeCode>
          <MarksNumbers>${this.escapeXml(item.packaging.shippingMarks || '')}</MarksNumbers>
        </Packaging>

        <!-- Valoracion de la partida -->
        <CustomsValuation>
          <ItemChargeAmount currencyID="EUR">${item.customsValue || 0}</ItemChargeAmount>
          <StatisticalValueAmount currencyID="EUR">${item.statisticalValue || 0}</StatisticalValueAmount>
          ${item.valuationAdjustment ? `<ValuationAdjustment>${item.valuationAdjustment}</ValuationAdjustment>` : ''}
        </CustomsValuation>

        <!-- Documentos presentados (2/3) -->
        ${item.supportingDocuments.map(doc => `
        <AdditionalDocument>
          <TypeCode>${doc.type}</TypeCode>
          <ID>${this.escapeXml(doc.reference || '')}</ID>
          ${doc.date ? `<IssueDate>${new Date(doc.date).toISOString().split('T')[0]}</IssueDate>` : ''}
          ${doc.validUntil ? `<ValidUntilDate>${new Date(doc.validUntil).toISOString().split('T')[0]}</ValidUntilDate>` : ''}
        </AdditionalDocument>`).join('')}

        <!-- Documentos anteriores (2/4) -->
        ${item.previousDocuments.map(doc => `
        <PreviousDocument>
          <TypeCode>${doc.type}</TypeCode>
          <ID>${this.escapeXml(doc.reference || '')}</ID>
        </PreviousDocument>`).join('')}

        <!-- Informacion adicional (2/2) -->
        ${item.additionalInformation.map(info => `
        <AdditionalInformation>
          <StatementCode>${info.code}</StatementCode>
          <StatementDescription>${this.escapeXml(info.description || '')}</StatementDescription>
        </AdditionalInformation>`).join('')}

        ${item.endUseCode ? `
        <!-- Uso final (6/15) -->
        <EndUse>
          <EndUseCode>${item.endUseCode}</EndUseCode>
        </EndUse>` : ''}

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
    const valuation = h1Data.valuation;
    const duties = h1Data.dutyTaxFee;

    return {
      lrn: h1Data.lrn,
      declarationType: h1Data.declarationType,
      totalItems: items.length,
      totalPackages: h1Data.declarationHeader.totalPackages,
      totalGrossWeight: h1Data.declarationHeader.totalGrossMass,

      // Valores
      invoiceValue: valuation.invoiceValue,
      customsValue: valuation.customsValue,
      statisticalValue: valuation.statisticalValue,
      totalAdditions: valuation.totalAdditions,
      totalDeductions: valuation.totalDeductions,

      // Liquidacion
      tariffAmount: duties.importDuty.payableAmount,
      vatAmount: duties.vat.payableAmount,
      totalDuty: duties.totalDuty,
      paymentMethod: duties.paymentMethod,
      paymentMethodDescription: duties.paymentMethodDescription,

      // Regimen
      regime: items[0]?.requestedProcedure,
      regimeDescription: REGIMES[items[0]?.requestedProcedure] || 'Desconocido',
      preference: items[0]?.preference,
      preferenceDescription: PREFERENCES[items[0]?.preference] || 'Desconocido',

      // Valoracion
      valuationMethod: valuation.valuationMethod,
      valuationMethodDescription: valuation.valuationMethodDescription,

      // Aduana
      customsOffice: h1Data.declarationHeader.customsOfficePresentation,
      customsOfficeName: CUSTOMS_OFFICES[h1Data.declarationHeader.customsOfficePresentation] || 'Desconocido',

      // Mercancias
      taricCodes: items.map(i => i.commodityCode.taricCode),
      origins: [...new Set(items.map(i => i.countryOfOrigin))],

      // Transporte
      transportMode: h1Data.goodsShipment.transportMeans.modeAtBorder,
      freight: h1Data.goodsShipment.transportCharges.freightAmount,
      insurance: h1Data.goodsShipment.insuranceCharges.insuranceAmount
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
    if (port.includes('LPA') || port.includes('PALMAS')) return 'ES003501';
    if (port.includes('TFN') || port.includes('TENERIFE')) return 'ES003801';
    if (port.includes('MAL') || port.includes('MALAGA')) return 'ES002901';

    return 'ES002801'; // Barcelona por defecto
  }

  /**
   * Obtener codigo de region (CCAA)
   */
  getRegionCode(city) {
    if (!city) return 'ES-CT';

    const cityUpper = city.toUpperCase();
    const regions = {
      'BARCELONA': 'ES-CT', 'TARRAGONA': 'ES-CT', 'GIRONA': 'ES-CT', 'LLEIDA': 'ES-CT',
      'MADRID': 'ES-MD',
      'VALENCIA': 'ES-VC', 'ALICANTE': 'ES-VC', 'CASTELLON': 'ES-VC',
      'SEVILLA': 'ES-AN', 'MALAGA': 'ES-AN', 'CADIZ': 'ES-AN', 'ALGECIRAS': 'ES-AN',
      'BILBAO': 'ES-PV', 'VITORIA': 'ES-PV', 'SAN SEBASTIAN': 'ES-PV',
      'PALMAS': 'ES-CN', 'TENERIFE': 'ES-CN',
      'PALMA': 'ES-IB',
      'ZARAGOZA': 'ES-AR',
      'MURCIA': 'ES-MC', 'CARTAGENA': 'ES-MC'
    };

    for (const [key, value] of Object.entries(regions)) {
      if (cityUpper.includes(key)) return value;
    }

    return 'ES-CT';
  }

  /**
   * Obtener codigo de modo de transporte
   */
  getTransportModeCode(mode) {
    const codes = {
      maritime: '1',
      sea: '1',
      rail: '2',
      train: '2',
      road: '3',
      truck: '3',
      air: '4',
      flight: '4',
      postal: '5',
      mail: '5',
      multimodal: '7',
      pipeline: '8',
      inland_waterway: '9'
    };
    return codes[mode?.toLowerCase()] || '1';
  }

  /**
   * Obtener codigo de tipo de medio de transporte
   */
  getTransportTypeCode(mode) {
    const codes = {
      maritime: '11',  // Buque
      sea: '11',
      rail: '21',      // Tren
      train: '21',
      road: '31',      // Camion
      truck: '31',
      air: '41',       // Avion
      flight: '41'
    };
    return codes[mode?.toLowerCase()] || '11';
  }

  /**
   * Obtener tipo de documento de transporte
   */
  getTransportDocumentType(mode) {
    const types = {
      maritime: 'N705', // BL
      sea: 'N705',
      air: 'N740',      // AWB
      flight: 'N740',
      road: 'N730',     // CMR
      truck: 'N730',
      rail: 'N720'      // CIM
    };
    return types[mode?.toLowerCase()] || 'N785';
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
      cim: 'N720',
      certificate_origin: 'N861',
      eur1: 'N864',
      eur_med: 'N864',
      atr: 'N018',
      form_a: 'N865',
      packing_list: 'N271',
      sanitary_certificate: 'C678',
      phytosanitary_certificate: 'C635',
      veterinary_certificate: 'C640',
      import_license: 'N990',
      export_license: 'E012',
      dangerous_goods: 'N703',
      insurance_certificate: 'N714'
    };
    return codes[docType] || 'N990';
  }

  /**
   * Escapar caracteres especiales para XML
   */
  escapeXml(str) {
    if (!str) return '';
    // String() y no str.replace directo: si el campo llega numerico -- una
    // razon social como "12345 SL" o un codigo postal en la casilla de ciudad --
    // .replace no existe y la generacion del DUA entero reventaba con
    // "str.replace is not a function". Para cadenas el comportamiento es el
    // mismo de antes.
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

module.exports = new H1Generator();
