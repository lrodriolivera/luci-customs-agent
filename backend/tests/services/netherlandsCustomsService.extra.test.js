/**
 * Tests COMPLEMENTARIOS para NetherlandsCustomsService
 * ---------------------------------------------------------------------------
 * Objetivo: ampliar la cobertura de RAMAS del servicio ejercitando el codigo
 * real de los builders XML, el enrutado de submitDeclaration, el batch DECO,
 * el envio via Digipoort y las operaciones de ciclo de vida (query/amend/cancel).
 *
 * ESTRATEGIA DE MOCKING (misma filosofia que netherlandsCustoms.test.js):
 *  - Se mockea SOLO el logger (ruido) y, para _sendViaDigipoort, las FRONTERAS
 *    externas: `fs`, `https`, `axios` y `node-forge`. NUNCA se mockea la logica
 *    interna del servicio ni sus helpers (NLValidation, UCCDataMapper, builders
 *    XML, _parseDigipoortResponse) — se ejecutan de verdad.
 *  - JAMAS se deja salir una peticion a red: axios.post/get estan mockeados.
 *  - Los mocks de frontera se instalan por test (jest.config tiene
 *    resetMocks:true, que restaura implementaciones en cada beforeEach).
 *  - Para forzar el camino "configurado" (this.certificate + this.certPassword)
 *    se instancia el servicio con certificatePath/certificatePassword ficticios;
 *    isConfigured() pasa a true y se ejercita _sendViaDigipoort en vez de la
 *    simulacion.
 *
 * Este fichero NO repite lo que ya cubre netherlandsCustoms.test.js; se centra
 * en las ramas opcionales de los ternarios de los builders, el switch de
 * submitDeclaration, el envio Digipoort y el resto de metodos publicos.
 */

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const NetherlandsCustomsService = require('../../src/services/customs/netherlands/netherlandsCustomsService');

// --- Helpers de datos -------------------------------------------------------

// Expedition valida H7 (para submitDeclaration('H7') -> _submitDECO -> simulacion)
function validH7Expedition() {
  return {
    expeditionId: 'EXP-NL-H7-001',
    declarant: { eori: 'NL123456789', companyName: 'NL Broker BV' },
    exporter: { companyName: 'China Exports Ltd', country: 'CN' },
    importer: { eori: 'NL987654321', companyName: 'NL Buyer BV' },
    client: { taxId: 'NL123456789', companyName: 'NL Broker BV' },
    transport: { documentRef: 'AWB-12345', documentType: 'N740' },
    transportMode: 'air',
    goods: [{
      hsCode: '610910',
      description: 'Cotton T-shirt',
      invoiceValue: 25,
      grossWeight: 0.5,
      netWeight: 0.4,
      countryOfOrigin: 'CN',
      packageCount: 1,
    }],
    calculations: { customsValue: 25, invoiceTotal: 25 },
    currency: 'EUR',
  };
}

// Expedition valida H1 (aereo -> NO requiere CVB)
function validH1Expedition() {
  return {
    expeditionId: 'EXP-NL-H1-001',
    declarant: { eori: 'NL123456789', companyName: 'NL Broker BV' },
    exporter: { companyName: 'China Exports Ltd', country: 'CN' },
    importer: { eori: 'NL987654321', companyName: 'NL Buyer BV' },
    client: { taxId: 'NL123456789', companyName: 'NL Broker BV' },
    transport: { documentRef: 'BL-98765', documentType: 'N705', entryCustomsOffice: 'NL000399' },
    transportMode: 'air',
    goods: [{
      taricCode: '8471300000',
      description: 'Laptop computer',
      invoiceValue: 800,
      grossWeight: 3.5,
      netWeight: 2.8,
      countryOfOrigin: 'CN',
      packageCount: 1,
    }],
    calculations: { customsValue: 800, invoiceTotal: 800 },
    currency: 'EUR',
  };
}

// Datos "ricos" para _buildDECOXml: todos los opcionales presentes
function richDECOData() {
  return {
    lrn: 'LRN-DECO-RICH',
    declarant: {
      eori: 'NL123456789',
      name: 'Broker BV',
      address: { city: 'Schiphol', country: 'NL', street: 'Kaagbaan 1', postalCode: '1118AA' },
      contactName: 'Jan Jansen',
      contactEmail: 'jan@broker.nl',
    },
    representative: {
      eori: 'NL555555555',
      status: '2',
      contactName: 'Rep Contact',
      contactEmail: 'rep@broker.nl',
    },
    exporter: {
      name: 'China Co',
      country: 'CN',
      address: { city: 'Shenzhen', street: 'Export Rd 5', postalCode: '518000' },
    },
    importer: {
      eori: 'NL987654321',
      name: 'Buyer BV',
      address: { city: 'Rotterdam', country: 'NL', street: 'Haven 9', postalCode: '3000AA' },
    },
    transport: { documentRef: 'AWB-RICH', documentType: 'N740' },
    goodsLocation: { city: 'Schiphol', street: 'Cargo 3', postalCode: '1118BB' },
    iossNumber: 'IMNL000000123',
    transportCharges: 15,
    previousDocument: { id: 'PREV-DOC-1', type: 'N830' },
    supportingDocuments: [
      { id: 'INV-1', type: 'N380' },
      { id: 'PACK-1', type: 'N271' },
    ],
    items: [{
      itemNumber: 1,
      commodityCode: '610910',
      description: 'T-shirt',
      grossMass: 0.5,
      customsValue: 25,
      currency: 'USD',
      transportCharges: 5,
      exporterName: 'Item Exporter',
      exporterCity: 'Guangzhou',
      exporterStreet: 'Factory Rd',
      exporterPostcode: '510000',
      countryOfOrigin: 'CN',
      additionalProcedure: 'F48',
      numberOfPackages: 3,
      previousDocument: { id: 'ITEM-PREV', type: 'N821' },
      supportingDocuments: [{ id: 'ITEM-SUP', type: 'N386' }],
      ucr: 'UCR-ITEM',
      transportDocRef: 'ITEM-TRANS',
      transportDocType: 'N741',
    }],
    totalGrossMass: 0.5,
    currency: 'EUR',
  };
}

// Datos minimos para _buildDECOXml: opcionales ausentes (rama '' de cada ternario)
function minimalDECOData() {
  return {
    items: [{ commodityCode: '610910', description: 'Item', customsValue: 10 }],
  };
}

// Datos ricos para _buildDMSXml
function richDMSData() {
  return {
    lrn: 'LRN-DMS-RICH',
    typeCode: '1',
    currency: 'USD',
    customsOffice: 'NL000297',
    countryOfDispatch: 'CN',
    declarant: {
      eori: 'NL123456789',
      name: 'Broker BV',
      address: { city: 'Rotterdam', country: 'NL', street: 'Haven 1', postalCode: '3000AA' },
    },
    representative: { eori: 'NL555555555', status: '3' },
    authorisations: [
      { id: 'AUTH-1', type: 'C514', holderId: 'NL123456789' },
      { id: 'AUTH-2', type: 'C517' },
    ],
    deferredPayment: 'DEF-PAY-1',
    exitOffice: 'NL000399',
    exporter: {
      name: 'China Co',
      eori: 'CN999999999',
      country: 'CN',
      address: { city: 'Shenzhen', street: 'Export Rd', postalCode: '518000' },
    },
    importer: {
      eori: 'NL987654321',
      name: 'Buyer BV',
      address: { city: 'Rotterdam', country: 'NL', street: 'Haven 9', postalCode: '3000AA' },
    },
    goodsLocation: { city: 'Rotterdam', street: 'Terminal 5', postalCode: '3199LA' },
    totalCustomsValue: 5000,
    totalGrossMass: 100,
    transactionNature: '11',
    transport: {
      documentRef: 'BL-RICH',
      documentType: 'N705',
      containerIndicator: '1',
      containerId: 'MSKU1234567',
      borderMeansId: 'MAERSK-01',
      borderMeansType: '11',
      borderNationality: 'DK',
      modeAtBorder: '1',
    },
    countryOfDestination: 'DE',
    previousDocuments: [{ id: 'PREV-DMS', type: 'NMRN' }],
    supportingDocuments: [{ id: 'SUP-DMS', type: 'N380' }],
    tradeTerms: { incoterm: 'FOB', locationName: 'Rotterdam Port', country: 'NL' },
    warehouse: { id: 'WH-1', type: 'U' },
    guarantee: { type: '1', reference: 'GRN-123', accessCode: 'AC123' },
    supervisingOffice: 'NL000251',
    paymentMethod: 'H',
    items: [{
      itemNumber: 1,
      commodityCode: '8471300000',
      taricAdditionalCode: 'TA01',
      nationalAdditionalCode: 'NA01',
      description: 'Laptop',
      grossMass: 3.5,
      netMass: 2.8,
      customsValue: 800,
      statisticalValue: 810,
      currency: 'USD',
      supplementaryUnits: 2,
      procedureCode: '40',
      previousProcedure: '00',
      additionalProcedure: 'F11',
      countryOfOrigin: 'CN',
      preferentialOrigin: true,
      shippingMarks: 'MARK-123',
      numberOfPackages: 2,
      packageType: 'BX',
      previousDocument: { id: 'ITEM-PREV-DMS', type: 'NMRN', lineNumeric: 3 },
      supportingDocuments: [{ id: 'ITEM-SUP-DMS', type: 'N935' }],
      ucr: 'UCR-DMS-ITEM',
    }],
  };
}

// Datos minimos DMS: opcionales ausentes
function minimalDMSData() {
  return {
    items: [{ commodityCode: '8471300000', description: 'Item', grossMass: 1, netMass: 1 }],
  };
}

// --- Suites -----------------------------------------------------------------

describe('NetherlandsCustomsService (cobertura extra)', () => {
  let service;

  beforeEach(() => {
    // Servicio SIN certificado -> isConfigured() = false -> rama simulacion
    service = new NetherlandsCustomsService({ environment: 'test' });
  });

  describe('submitDeclaration (enrutado por tipo)', () => {
    test('H7 delega en _submitDECO y devuelve simulacion cuando no hay certificado', async () => {
      // Arrange
      const expedition = validH7Expedition();
      // Act
      const result = await service.submitDeclaration(expedition, 'H7');
      // Assert
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(result.mrn).toMatch(/^\d{2}NL0003/);
    });

    test('H1 delega en _submitDMS import y simula cuando no hay certificado', async () => {
      // Arrange
      const expedition = validH1Expedition();
      // Act
      const result = await service.submitDeclaration(expedition, 'H1');
      // Assert
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
    });

    test('AES delega en _submitDMS export y simula cuando no hay certificado', async () => {
      // Arrange: export tambien es DMS
      const expedition = { ...validH1Expedition(), expeditionId: 'EXP-AES-1' };
      // Act
      const result = await service.submitDeclaration(expedition, 'AES');
      // Assert
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
    });

    test('tipo no soportado lanza error', async () => {
      // Act + Assert
      await expect(service.submitDeclaration(validH7Expedition(), 'ENS'))
        .rejects.toThrow('not yet supported for Netherlands');
    });
  });

  describe('_submitDECO (ramas de validacion y simulacion)', () => {
    test('devuelve success:false con errores cuando la validacion NL DECO falla', async () => {
      // Arrange: valor > 150 EUR rompe validateDECO
      const expedition = validH7Expedition();
      expedition.goods[0].invoiceValue = 500;
      expedition.calculations = { customsValue: 500, invoiceTotal: 500 };
      // Act
      const result = await service._submitDECO(expedition);
      // Assert
      expect(result.success).toBe(false);
      expect(result.system).toBe('DECO');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('devuelve success:false cuando la validacion UCC comun falla pero la NL pasa', async () => {
      // Arrange: NLValidation.validateDECO no comprueba descripcion; validateH7 SI.
      // Un item sin description pasa NL pero falla UCC.
      const expedition = validH7Expedition();
      delete expedition.goods[0].description;
      // Act
      const result = await service._submitDECO(expedition);
      // Assert
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Description'))).toBe(true);
    });
  });

  describe('_submitDMS (requiresCVB y validacion)', () => {
    test('import maritimo con contenedor y sin cvbReleaseId exige CVB', async () => {
      // Arrange: transportMode maritime + containerNumber -> requiresCVB true
      const expedition = validH1Expedition();
      expedition.transportMode = 'maritime';
      expedition.transport.containerNumber = 'MSKU1234567';
      // sin cvbReleaseId
      // Act
      const result = await service._submitDMS(expedition, 'import');
      // Assert
      expect(result.success).toBe(false);
      expect(result.requiresCVB).toBe(true);
    });

    test('maritimo con cvbReleaseId presente continua y simula', async () => {
      // Arrange
      const expedition = validH1Expedition();
      expedition.transportMode = 'maritime';
      expedition.transport.containerNumber = 'MSKU1234567';
      expedition.cvbReleaseId = 'CVB-OK-1';
      // Act
      const result = await service._submitDMS(expedition, 'import');
      // Assert: pasa CVB, valida y simula
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
    });

    test('devuelve success:false con errores cuando la validacion NL DMS falla', async () => {
      // Arrange: codigo TARIC < 8 digitos rompe validateDMS
      const expedition = validH1Expedition();
      expedition.goods[0].taricCode = '8471';
      // Act
      const result = await service._submitDMS(expedition, 'import');
      // Assert
      expect(result.success).toBe(false);
      expect(result.system).toBe('DMS 4.0');
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('_buildDECOXml (ambas ramas de los ternarios)', () => {
    test('datos ricos incluyen todos los bloques opcionales', () => {
      // Arrange + Act
      const xml = service._buildDECOXml(richDECOData());
      // Assert
      expect(xml).toContain('<Agent>');
      expect(xml).toContain('rep@broker.nl');
      expect(xml).toContain('<DomesticDutyTaxParty>');
      expect(xml).toContain('IMNL000000123');
      expect(xml).toContain('<ExitToEntryChargeAmount'); // transportCharges item + envio
      expect(xml).toContain('PREV-DOC-1'); // previousDocument envio
      expect(xml).toContain('INV-1'); // supportingDocuments envio
      expect(xml).toContain('ITEM-PREV'); // previousDocument item
      expect(xml).toContain('ITEM-SUP'); // supportingDocuments item
      expect(xml).toContain('jan@broker.nl'); // declarant contact email
      expect(xml).toContain('<CityName>Rotterdam</CityName>'); // importer address
      expect(xml).toContain('currencyID="USD"'); // item.currency override
    });

    test('datos minimos omiten los bloques opcionales', () => {
      // Arrange + Act
      const xml = service._buildDECOXml(minimalDECOData());
      // Assert: ausencia de bloques opcionales
      expect(xml).not.toContain('<Agent>');
      expect(xml).not.toContain('<DomesticDutyTaxParty>');
      expect(xml).not.toContain('<PreviousDocument>');
      expect(xml).not.toContain('<SupportingDocument>');
      // pero el esqueleto obligatorio sigue presente
      expect(xml).toContain('<WCOTypeCode>DECO</WCOTypeCode>');
      expect(xml).toContain('<TypeCode>154</TypeCode>');
    });

    test('genera lrn/customsOffice/countryOfDispatch por defecto cuando faltan', () => {
      // Arrange: sin lrn, sin customsOffice, sin exporter.country
      const data = { items: [{ commodityCode: '610910', description: 'X', customsValue: 5 }] };
      // Act
      const xml = service._buildDECOXml(data);
      // Assert: default office SCHIPHOL y country XX
      expect(xml).toContain('NL000399'); // SCHIPHOL default
      expect(xml).toContain('<CountryCode>XX</CountryCode>');
    });
  });

  describe('_buildDMSXml (ambas ramas, import y export)', () => {
    test('import con datos ricos incluye bloques opcionales y linea de IVA (B00)', () => {
      // Arrange + Act
      const xml = service._buildDMSXml(richDMSData(), 'import');
      // Assert
      expect(xml).toContain('<Agent>');
      expect(xml).toContain('<Authorisation>');
      expect(xml).toContain('AUTH-1');
      expect(xml).toContain('<AuthorisationHolder>');
      expect(xml).toContain('<DeferredPayment>');
      expect(xml).toContain('<TariffQuantity>2</TariffQuantity>'); // supplementaryUnits
      expect(xml).toContain('IdentificationTypeCode>TRA'); // taricAdditionalCode
      expect(xml).toContain('IdentificationTypeCode>GN'); // nationalAdditionalCode
      expect(xml).toContain('<TypeCode>B00</TypeCode>'); // IVA solo import
      expect(xml).toContain('<StatisticalValueAmount>810</StatisticalValueAmount>');
      expect(xml).toContain('<BorderTransportMeans>');
      expect(xml).toContain('MSKU1234567'); // containerId -> TransportEquipment
      expect(xml).toContain('<TradeTerms>');
      expect(xml).toContain('<Warehouse>');
      expect(xml).toContain('<ObligationGuarantee>');
      expect(xml).toContain('<AccessCode>AC123</AccessCode>');
      expect(xml).toContain('<SupervisingOffice>');
      expect(xml).toContain('<InvoiceCurrencyCode>USD</InvoiceCurrencyCode>'); // currency != EUR
      expect(xml).toContain('<LineNumeric>3</LineNumeric>'); // previousDocument.lineNumeric
      expect(xml).toContain('<TypeCode>1</TypeCode>'); // preferentialOrigin -> Origin TypeCode
    });

    test('export omite la linea de IVA B00 y no incluye ExitOffice sin dato', () => {
      // Arrange: export con exitOffice presente
      const data = richDMSData();
      // Act
      const xml = service._buildDMSXml(data, 'export');
      // Assert: no linea IVA (solo import), pero ExitOffice si (isExport && exitOffice)
      expect(xml).not.toContain('<TypeCode>B00</TypeCode>');
      expect(xml).toContain('<ExitOffice>');
    });

    test('export sin exitOffice NO incluye ExitOffice', () => {
      // Arrange
      const data = richDMSData();
      delete data.exitOffice;
      // Act
      const xml = service._buildDMSXml(data, 'export');
      // Assert
      expect(xml).not.toContain('<ExitOffice>');
    });

    test('datos minimos omiten los bloques opcionales', () => {
      // Arrange + Act
      const xml = service._buildDMSXml(minimalDMSData(), 'import');
      // Assert
      expect(xml).not.toContain('<Agent>');
      expect(xml).not.toContain('<Authorisation>');
      expect(xml).not.toContain('<DeferredPayment>');
      expect(xml).not.toContain('<TradeTerms>');
      expect(xml).not.toContain('<Warehouse>');
      expect(xml).not.toContain('<ObligationGuarantee>');
      expect(xml).not.toContain('<BorderTransportMeans>');
      expect(xml).not.toContain('<InvoiceCurrencyCode>'); // currency EUR por defecto
      expect(xml).toContain('<WCOTypeCode>DMS</WCOTypeCode>');
      // default office ROTTERDAM_HAVEN
      expect(xml).toContain('NL000297');
    });
  });

  describe('_parseDigipoortResponse (ramas adicionales)', () => {
    test('exito por MRN sin errorCode (isSuccess via mrn)', () => {
      // Arrange: sin status pero con MRN y sin errorCode
      const xml = '<r><DeclarationReferenceNumber>26NL0003ABCDEF</DeclarationReferenceNumber></r>';
      // Act
      const result = service._parseDigipoortResponse(xml);
      // Assert
      expect(result.success).toBe(true);
      expect(result.mrn).toBe('26NL0003ABCDEF');
      expect(result.channel).toBe('green'); // fallback green por isSuccess
    });

    test('canal H2 mapea a orange', () => {
      // Arrange
      const xml = '<r><statuscode>OK</statuscode><MRN>26NL0003X</MRN><CustomsIntervention>H2</CustomsIntervention></r>';
      // Act
      const result = service._parseDigipoortResponse(xml);
      // Assert
      expect(result.channel).toBe('orange');
    });

    test('correccion requerida via CorrectionRequired=true', () => {
      // Arrange
      const xml = '<r><statuscode>OK</statuscode><MRN>26NL0003X</MRN><CorrectionRequired>true</CorrectionRequired></r>';
      // Act
      const result = service._parseDigipoortResponse(xml);
      // Assert
      expect(result.correctionRequired).toBe(true);
      expect(result.success).toBe(false); // isSuccess && !correctionRequired
    });

    test('correccion requerida via Amendment=1', () => {
      // Arrange
      const xml = '<r><statuscode>OK</statuscode><MRN>26NL0003X</MRN><Amendment>1</Amendment></r>';
      // Act
      const result = service._parseDigipoortResponse(xml);
      // Assert
      expect(result.correctionRequired).toBe(true);
    });

    test('extrae multiples errores <Fout> con foutcode y foutbeschrijving', () => {
      // Arrange
      const xml = `<r>
        <Fout><foutcode>F01</foutcode><foutbeschrijving>Campo malo</foutbeschrijving></Fout>
        <Fout><foutcode>F02</foutcode><foutbeschrijving>Otro</foutbeschrijving></Fout>
      </r>`;
      // Act
      const result = service._parseDigipoortResponse(xml);
      // Assert
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].code).toBe('F01');
      expect(result.error).toBe('Campo malo'); // fallback a allErrors[0].description
    });

    test('objeto (no string) se serializa con JSON.stringify', () => {
      // Arrange: objeto con la clave dentro; JSON.stringify no genera <MRN> asi que no hay exito
      const result = service._parseDigipoortResponse({ foo: 'bar' });
      // Assert: se procesa sin fallar, sin MRN -> success false
      expect(result.success).toBe(false);
      expect(result.mrn).toBeNull();
      expect(result.rawResponse).toContain('foo');
    });

    test('statusDescription se rellena desde nlCodes para status 02', () => {
      // Arrange
      const xml = '<r><statuscode>02</statuscode><MRN>26NL0003X</MRN></r>';
      // Act
      const result = service._parseDigipoortResponse(xml);
      // Assert
      expect(result.statusDescription).toBe('Mercancias liberadas');
    });
  });

  describe('submitBatchDECO', () => {
    test('rechaza lotes de mas de 10000 declaraciones', async () => {
      // Arrange
      const huge = new Array(10001).fill(validH7Expedition());
      // Act
      const result = await service.submitBatchDECO(huge);
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('10,000');
    });

    test('lote mixto: separa validas de invalidas y simula las validas', async () => {
      // Arrange: una valida + una invalida (valor > 150)
      const valida = validH7Expedition();
      const invalida = validH7Expedition();
      invalida.expeditionId = 'EXP-BAD';
      invalida.goods[0].invoiceValue = 999;
      invalida.calculations = { customsValue: 999, invoiceTotal: 999 };
      // Act
      const result = await service.submitBatchDECO([valida, invalida]);
      // Assert
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(result.stats.total).toBe(2);
      expect(result.stats.valid).toBe(1);
      expect(result.stats.invalid).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.validationResults).toHaveLength(2);
    });

    test('lote sin ninguna declaracion valida devuelve error', async () => {
      // Arrange
      const invalida = validH7Expedition();
      invalida.goods[0].invoiceValue = 999;
      invalida.calculations = { customsValue: 999, invoiceTotal: 999 };
      // Act
      const result = await service.submitBatchDECO([invalida]);
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('validas');
      expect(result.validationResults).toHaveLength(1);
    });
  });

  describe('_buildBatchDECOXml', () => {
    test('envuelve cada declaracion en BatchItem con totalDeclarations', () => {
      // Arrange
      const d1 = { items: [{ commodityCode: '610910', description: 'A', customsValue: 5 }] };
      const d2 = { items: [{ commodityCode: '610920', description: 'B', customsValue: 6 }] };
      // Act
      const xml = service._buildBatchDECOXml([d1, d2]);
      // Assert
      expect(xml).toContain('<DeclarationBatch');
      expect(xml).toContain('totalDeclarations="2"');
      expect(xml).toContain('<BatchItem sequenceNumber="1">');
      expect(xml).toContain('<BatchItem sequenceNumber="2">');
    });
  });

  describe('queryStatus / amendDeclaration / cancelDeclaration (modo simulacion)', () => {
    test('queryStatus sin certificado devuelve ACCEPTED simulado', async () => {
      // Act
      const result = await service.queryStatus('26NL0003X', 'H7');
      // Assert
      expect(result.simulated).toBe(true);
      expect(result.status).toBe('ACCEPTED');
      expect(result.system).toBe('DECO');
    });

    test('queryStatus H1 simulado reporta system DMS', async () => {
      const result = await service.queryStatus('26NL0003X', 'H1');
      expect(result.system).toBe('DMS');
    });

    test('amendDeclaration sin certificado simula', async () => {
      const result = await service.amendDeclaration('26NL0003X', {}, 'H7');
      expect(result.simulated).toBe(true);
      expect(result.mrn).toBe('26NL0003X');
    });

    test('cancelDeclaration sin certificado simula', async () => {
      const result = await service.cancelDeclaration('26NL0003X', 'motivo', 'H1');
      expect(result.simulated).toBe(true);
    });
  });

  describe('_escapeXml / getEndpoints / getSupportedDeclarationTypes', () => {
    test('_escapeXml devuelve cadena vacia para valores falsy', () => {
      expect(service._escapeXml('')).toBe('');
      expect(service._escapeXml(null)).toBe('');
      expect(service._escapeXml(undefined)).toBe('');
    });

    test('getEndpoints y tipos soportados', () => {
      expect(service.getEndpoints().digipoort).toContain('preprod');
      expect(service.getSupportedDeclarationTypes()).toEqual(['H7', 'H1']);
    });

    test('validateDeclaration con tipo no H7/H1 devuelve valido por defecto', async () => {
      // Act: rama por defecto (ni H7 ni H1)
      const result = await service.validateDeclaration({}, 'AES');
      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

// --- Suite CONFIGURADA: ejercita _sendViaDigipoort mockeando fronteras -------

describe('NetherlandsCustomsService via Digipoort (configurado, fronteras mockeadas)', () => {
  let service;
  let fs;
  let https;
  let axios;
  let forge;

  beforeEach(() => {
    // Servicio CON certificado ficticio -> isConfigured() = true
    service = new NetherlandsCustomsService({
      environment: 'test',
      certificatePath: '/fake/cert.p12',
      certificatePassword: 'fakepass',
      eoriNumber: 'NL123456789',
    });

    // Mock de fronteras externas (resetMocks:true las restaura entre tests)
    fs = require('fs');
    https = require('https');
    axios = require('axios');
    forge = require('node-forge');

    jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('fake-p12-bytes'));

    // node-forge: cadena asn1 -> pkcs12 -> bags -> pem
    const fakeBags = {
      [forge.pki.oids.certBag]: [{ cert: {} }],
      [forge.pki.oids.pkcs8ShroudedKeyBag]: [{ key: {} }],
    };
    jest.spyOn(forge.asn1, 'fromDer').mockReturnValue({});
    jest.spyOn(forge.pkcs12, 'pkcs12FromAsn1').mockReturnValue({
      getBags: jest.fn(() => fakeBags),
    });
    jest.spyOn(forge.pki, 'certificateToPem').mockReturnValue('-----CERT-----');
    jest.spyOn(forge.pki, 'privateKeyToPem').mockReturnValue('-----KEY-----');

    // https.Agent: no debe hacer nada real
    jest.spyOn(https, 'Agent').mockImplementation(function () { return {}; });
  });

  test('envio OK: parsea la respuesta de Digipoort y devuelve success', async () => {
    // Arrange
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: '<r><statuscode>OK</statuscode><MRN>26NL000399999</MRN></r>',
    });
    // Act
    const result = await service._sendViaDigipoort('<xml/>', 'DECO');
    // Assert
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.mrn).toBe('26NL000399999');
    // se envio a un endpoint de PRE (test), nunca a produccion/red real
    const calledUrl = axios.post.mock.calls[0][0];
    expect(calledUrl).toContain('preprod');
  });

  test('envio con error de axios: catch devuelve success:false y el mensaje', async () => {
    // Arrange
    jest.spyOn(axios, 'post').mockRejectedValue(new Error('ECONNREFUSED'));
    // Act
    const result = await service._sendViaDigipoort('<xml/>', 'DECO');
    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe('ECONNREFUSED');
  });

  test('_submitDECO configurado envia via Digipoort en vez de simular', async () => {
    // Arrange
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: '<r><statuscode>OK</statuscode><MRN>26NL000388888</MRN></r>',
    });
    // Act
    const result = await service._submitDECO(validH7Expedition());
    // Assert
    expect(result.simulated).toBeUndefined();
    expect(result.success).toBe(true);
    expect(result.mrn).toBe('26NL000388888');
  });

  test('_submitDMS configurado envia via Digipoort en vez de simular', async () => {
    // Arrange
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: '<r><statuscode>OK</statuscode><MRN>26NL000399111</MRN></r>',
    });
    // Act
    const result = await service._submitDMS(validH1Expedition(), 'import');
    // Assert
    expect(result.simulated).toBeUndefined();
    expect(result.success).toBe(true);
    expect(result.mrn).toBe('26NL000399111');
  });

  test('queryStatus configurado consulta via Digipoort', async () => {
    // Arrange
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: '<r><statuscode>01</statuscode><MRN>26NL000377777</MRN></r>',
    });
    // Act
    const result = await service.queryStatus('26NL000377777', 'H1');
    // Assert
    expect(result.success).toBe(true);
    expect(result.status).toBe('01');
    expect(result.system).toBe('DMS 4.0');
  });

  test('amendDeclaration DECO configurado reenvia la declaracion corregida', async () => {
    // Arrange
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: '<r><statuscode>OK</statuscode><MRN>26NL000366666</MRN></r>',
    });
    // Act: usar datos DECO ricos para el rebuild
    const result = await service.amendDeclaration('26NL000366666', richDECOData(), 'H7');
    // Assert
    expect(result.success).toBe(true);
    expect(result.system).toBe('DECO');
    expect(result.amendmentLrn).toBeDefined();
  });

  test('amendDeclaration DMS configurado usa formato AdditionalMessage', async () => {
    // Arrange
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: '<r><statuscode>OK</statuscode><MRN>26NL000355555</MRN></r>',
    });
    // Act
    const result = await service.amendDeclaration('26NL000355555', richDMSData(), 'H1');
    // Assert
    expect(result.success).toBe(true);
    expect(result.system).toBe('DMS 4.0');
  });

  test('cancelDeclaration configurado envia mensaje de invalidacion', async () => {
    // Arrange
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: '<r><statuscode>07</statuscode><MRN>26NL000344444</MRN></r>',
    });
    // Act
    const result = await service.cancelDeclaration('26NL000344444', 'error de datos', 'H7');
    // Assert
    expect(result.cancellationLrn).toBeDefined();
    expect(result.system).toBe('DECO');
  });

  test('submitBatchDECO configurado envia el lote via Digipoort', async () => {
    // Arrange
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: '<r><statuscode>OK</statuscode><MRN>26NL000333333</MRN></r>',
    });
    // Act
    const result = await service.submitBatchDECO([validH7Expedition(), validH7Expedition()]);
    // Assert: sin simulated, con results por cada valida
    expect(result.simulated).toBeUndefined();
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].mrn).toBe('26NL000333333');
  });
});
