/**
 * Tests for Netherlands Customs Integration
 * Covers: NLValidation, NL_CODES, UCCDataMapper (NL context),
 *         NetherlandsCustomsService, CustomsServiceFactory
 */

// Mock logger before importing
jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const NLValidation = require('../../src/services/customs/netherlands/nlValidation');
const NL_CODES = require('../../src/services/customs/netherlands/nlCodes');
const UCCDataMapper = require('../../src/services/customs/common/uccDataMapper');
const NetherlandsCustomsService = require('../../src/services/customs/netherlands/netherlandsCustomsService');
const CustomsServiceFactory = require('../../src/services/customs/customsServiceFactory');
const SpainCustomsService = require('../../src/services/customs/spain/spainCustomsService');

// Helper: valid DECO data
function validDECOData() {
  return {
    declarant: { eori: 'NL123456789' },
    exporter: { name: 'China Exports Ltd', country: 'CN' },
    importer: { eori: 'NL987654321', name: 'NL Buyer BV' },
    transport: { documentRef: 'AWB-12345', documentType: 'N740' },
    items: [
      {
        commodityCode: '610910',
        description: 'Cotton T-shirt',
        customsValue: 25,
        grossMass: 0.5,
        netMass: 0.4,
        countryOfOrigin: 'CN',
        numberOfPackages: 1,
        packageType: 'PK',
      }
    ],
    totalCustomsValue: 25,
    currency: 'EUR',
  };
}

// Helper: valid DMS H1 data
function validDMSData() {
  return {
    declarant: { eori: 'NL123456789' },
    exporter: { name: 'China Exports Ltd', country: 'CN' },
    importer: { eori: 'NL987654321', name: 'NL Buyer BV' },
    transport: { documentRef: 'BL-98765', documentType: 'N705' },
    customsOffice: 'NL000297',
    items: [
      {
        commodityCode: '8471300000',
        description: 'Laptop computer',
        customsValue: 800,
        grossMass: 3.5,
        netMass: 2.8,
        countryOfOrigin: 'CN',
      }
    ],
    totalCustomsValue: 800,
    currency: 'EUR',
  };
}

// Helper: valid expedition for UCCDataMapper
function validExpedition() {
  return {
    expeditionId: 'EXP-NL-001',
    declarant: { eori: 'NL123456789', companyName: 'NL Broker BV' },
    exporter: { companyName: 'China Exports Ltd', country: 'CN' },
    importer: { eori: 'NL987654321', companyName: 'NL Buyer BV' },
    client: { taxId: 'NL123456789', companyName: 'NL Broker BV' },
    transport: { documentRef: 'AWB-12345', documentType: 'N740' },
    transportMode: 'air',
    goods: [
      {
        hsCode: '610910',
        description: 'Cotton T-shirt',
        invoiceValue: 25,
        grossWeight: 0.5,
        netWeight: 0.4,
        countryOfOrigin: 'CN',
        packageCount: 1,
      }
    ],
    calculations: { customsValue: 25, invoiceTotal: 25 },
    currency: 'EUR',
  };
}

describe('NLValidation', () => {
  describe('validateDECO', () => {
    test('should pass valid DECO H7 data', () => {
      const result = NLValidation.validateDECO(validDECOData());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.declarationType).toBe('H7');
      expect(result.system).toBe('DECO');
    });

    test('should reject items over 150 EUR', () => {
      const data = validDECOData();
      data.items[0].customsValue = 200;
      const result = NLValidation.validateDECO(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('150 EUR'))).toBe(true);
    });

    test('should reject total value over 150 EUR', () => {
      const data = validDECOData();
      data.items.push({
        commodityCode: '620520',
        description: 'Shirt',
        customsValue: 130,
        grossMass: 0.3,
      });
      // item1=25 + item2=130 = 155 > 150
      const result = NLValidation.validateDECO(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Valor total'))).toBe(true);
    });

    test('should reject items with value <= 0', () => {
      const data = validDECOData();
      data.items[0].customsValue = 0;
      const result = NLValidation.validateDECO(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('mayor que 0'))).toBe(true);
    });

    test('should reject excise goods (chapter 22 - beverages)', () => {
      const data = validDECOData();
      data.items[0].commodityCode = '220300';
      const result = NLValidation.validateDECO(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('impuestos especiales'))).toBe(true);
    });

    test('should reject excise goods (chapter 24 - tobacco)', () => {
      const data = validDECOData();
      data.items[0].commodityCode = '240210';
      const result = NLValidation.validateDECO(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('excise'))).toBe(true);
    });

    test('should warn on restricted goods chapters', () => {
      const data = validDECOData();
      data.items[0].commodityCode = '850140'; // chapter 85 restricted
      const result = NLValidation.validateDECO(data);
      expect(result.warnings.some(w => w.includes('permisos adicionales'))).toBe(true);
    });

    test('should warn when HS code > 6 digits (will be truncated)', () => {
      const data = validDECOData();
      data.items[0].commodityCode = '6109100000';
      const result = NLValidation.validateDECO(data);
      expect(result.warnings.some(w => w.includes('truncara'))).toBe(true);
    });

    test('should reject HS code < 6 digits', () => {
      const data = validDECOData();
      data.items[0].commodityCode = '6109';
      const result = NLValidation.validateDECO(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('6 digitos'))).toBe(true);
    });

    test('should reject invalid IOSS format', () => {
      const data = validDECOData();
      data.iossNumber = 'INVALID123';
      const result = NLValidation.validateDECO(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('IOSS'))).toBe(true);
    });

    test('should accept valid IOSS number', () => {
      const data = validDECOData();
      data.iossNumber = 'IMNL000000123';
      const result = NLValidation.validateDECO(data);
      expect(result.valid).toBe(true);
    });

    test('should reject missing declarant EORI', () => {
      const data = validDECOData();
      data.declarant = {};
      const result = NLValidation.validateDECO(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('EORI'))).toBe(true);
    });

    test('should reject missing exporter name', () => {
      const data = validDECOData();
      data.exporter.name = '';
      const result = NLValidation.validateDECO(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('exportador'))).toBe(true);
    });

    test('should reject missing transport document ref', () => {
      const data = validDECOData();
      data.transport.documentRef = '';
      const result = NLValidation.validateDECO(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('transporte'))).toBe(true);
    });

    test('should reject empty items array', () => {
      const data = validDECOData();
      data.items = [];
      const result = NLValidation.validateDECO(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('articulo'))).toBe(true);
    });

    test('should reject > 99 items', () => {
      const data = validDECOData();
      data.items = Array(100).fill({
        commodityCode: '610910', description: 'Shirt', customsValue: 1, grossMass: 0.1,
      });
      const result = NLValidation.validateDECO(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('99 articulos'))).toBe(true);
    });

    test('should reject exporter country NL', () => {
      const data = validDECOData();
      data.exporter.country = 'NL';
      const result = NLValidation.validateDECO(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('NL para importacion'))).toBe(true);
    });

    test('should warn on NL EORI with non-standard format', () => {
      const data = validDECOData();
      data.declarant.eori = 'NLABC';
      const result = NLValidation.validateDECO(data);
      expect(result.warnings.some(w => w.includes('formato NL estandar'))).toBe(true);
    });
  });

  describe('validateDMS', () => {
    test('should pass valid DMS H1 data', () => {
      const result = NLValidation.validateDMS(validDMSData());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.declarationType).toBe('H1');
      expect(result.system).toBe('DMS 4.0');
    });

    test('should reject TARIC code < 8 digits', () => {
      const data = validDMSData();
      data.items[0].commodityCode = '8471';
      const result = NLValidation.validateDMS(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('8-10 digitos'))).toBe(true);
    });

    test('should reject missing importer EORI', () => {
      const data = validDMSData();
      data.importer = { name: 'Test' };
      const result = NLValidation.validateDMS(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('EORI importador'))).toBe(true);
    });

    test('should warn when no customs office specified', () => {
      const data = validDMSData();
      delete data.customsOffice;
      const result = NLValidation.validateDMS(data);
      expect(result.warnings.some(w => w.includes('Rotterdam'))).toBe(true);
    });

    test('should warn when value > 5000 without guarantee', () => {
      const data = validDMSData();
      data.totalCustomsValue = 6000;
      data.guarantee = undefined;
      const result = NLValidation.validateDMS(data);
      expect(result.warnings.some(w => w.includes('garantia'))).toBe(true);
    });
  });

  describe('isValidIOSS', () => {
    test('should accept IMNL000000123', () => {
      expect(NLValidation.isValidIOSS('IMNL000000123')).toBe(true);
    });

    test('should accept IMDE123456789012', () => {
      expect(NLValidation.isValidIOSS('IMDE123456789012')).toBe(true);
    });

    test('should reject invalid format', () => {
      expect(NLValidation.isValidIOSS('12345')).toBe(false);
      expect(NLValidation.isValidIOSS('IMNL')).toBe(false);
      expect(NLValidation.isValidIOSS('')).toBe(false);
    });
  });

  describe('canUseDECO', () => {
    test('should allow non-excise goods under 150', () => {
      const result = NLValidation.canUseDECO('610910', 25);
      expect(result.allowed).toBe(true);
    });

    test('should reject excise goods', () => {
      const result = NLValidation.canUseDECO('220300', 25);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('impuestos especiales');
    });

    test('should reject value over 150', () => {
      const result = NLValidation.canUseDECO('610910', 200);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('150 EUR');
    });
  });
});

describe('NL_CODES', () => {
  describe('customsOffices', () => {
    test('should have Rotterdam Haven', () => {
      expect(NL_CODES.customsOffices['NL000297']).toBeDefined();
      expect(NL_CODES.customsOffices['NL000297'].name).toBe('Rotterdam Haven');
    });

    test('should have Schiphol as airport', () => {
      expect(NL_CODES.customsOffices['NL000399'].type).toBe('airport');
    });
  });

  describe('getOfficeName', () => {
    test('should return office name for valid code', () => {
      expect(NL_CODES.getOfficeName('NL000399')).toBe('Schiphol');
    });

    test('should return code itself for unknown code', () => {
      expect(NL_CODES.getOfficeName('NL999999')).toBe('NL999999');
    });
  });

  describe('getDocumentName', () => {
    test('should find transport document', () => {
      expect(NL_CODES.getDocumentName('N740')).toBe('Air waybill');
    });

    test('should find additional document', () => {
      expect(NL_CODES.getDocumentName('N861')).toBe('Certificate of origin');
    });

    test('should return code for unknown', () => {
      expect(NL_CODES.getDocumentName('XXXX')).toBe('XXXX');
    });
  });

  describe('isPortOffice / isAirportOffice', () => {
    test('should identify port offices', () => {
      expect(NL_CODES.isPortOffice('NL000297')).toBe(true);
      expect(NL_CODES.isPortOffice('NL000399')).toBe(false);
    });

    test('should identify airport offices', () => {
      expect(NL_CODES.isAirportOffice('NL000399')).toBe(true);
      expect(NL_CODES.isAirportOffice('NL000297')).toBe(false);
    });
  });

  describe('getOfficesByType', () => {
    test('should return all port offices', () => {
      const ports = NL_CODES.getOfficesByType('port');
      expect(ports.length).toBeGreaterThanOrEqual(3);
      expect(ports.every(p => p.type === 'port')).toBe(true);
    });

    test('should return airport offices', () => {
      const airports = NL_CODES.getOfficesByType('airport');
      expect(airports.length).toBeGreaterThanOrEqual(1);
      expect(airports[0].name).toBe('Schiphol');
    });
  });

  describe('agsToNxxx mapping', () => {
    test('should map old AGS codes to new NXXXX codes', () => {
      expect(NL_CODES.agsToNxxx['91000']).toBe('N380');
      expect(NL_CODES.agsToNxxx['92100']).toBe('N740');
      expect(NL_CODES.agsToNxxx['92200']).toBe('N705');
      expect(NL_CODES.agsToNxxx['96000']).toBe('N862');
    });
  });

  describe('responseCodes', () => {
    test('should have ACCEPTED as success', () => {
      expect(NL_CODES.responseCodes.ACCEPTED.success).toBe(true);
      expect(NL_CODES.responseCodes.ACCEPTED.code).toBe('01');
    });

    test('should have REJECTED as failure', () => {
      expect(NL_CODES.responseCodes.REJECTED.success).toBe(false);
    });
  });
});

describe('UCCDataMapper (NL context)', () => {
  describe('expeditionToH7', () => {
    test('should map expedition to H7 format', () => {
      const result = UCCDataMapper.expeditionToH7(validExpedition());
      expect(result.declarationType).toBe('IM');
      expect(result.additionalDeclarationType).toBe('C');
      expect(result.declarant.eori).toBe('NL123456789');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].commodityCode).toBe('610910');
      expect(result.items[0].customsValue).toBe(25);
      expect(result.totalCustomsValue).toBe(25);
      expect(result.transport.documentRef).toBe('AWB-12345');
    });

    test('should truncate HS code to 6 digits for H7', () => {
      const exp = validExpedition();
      exp.goods[0].hsCode = '6109100000';
      const result = UCCDataMapper.expeditionToH7(exp);
      expect(result.items[0].commodityCode).toBe('610910');
    });

    test('should map transport mode correctly', () => {
      expect(UCCDataMapper.mapTransportMode('air')).toBe('4');
      expect(UCCDataMapper.mapTransportMode('maritime')).toBe('1');
      expect(UCCDataMapper.mapTransportMode('road')).toBe('3');
    });
  });

  describe('validateH7', () => {
    test('should pass valid H7 data', () => {
      const data = UCCDataMapper.expeditionToH7(validExpedition());
      const result = UCCDataMapper.validateH7(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should fail when declarant EORI missing', () => {
      const data = UCCDataMapper.expeditionToH7(validExpedition());
      data.declarant.eori = null;
      const result = UCCDataMapper.validateH7(data);
      expect(result.valid).toBe(false);
    });

    test('should fail when item value > 150 EUR', () => {
      const exp = validExpedition();
      exp.goods[0].invoiceValue = 200;
      const data = UCCDataMapper.expeditionToH7(exp);
      const result = UCCDataMapper.validateH7(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('150'))).toBe(true);
    });

    test('should fail when no items', () => {
      const data = UCCDataMapper.expeditionToH7({ ...validExpedition(), goods: [] });
      const result = UCCDataMapper.validateH7(data);
      expect(result.valid).toBe(false);
    });
  });
});

describe('NetherlandsCustomsService', () => {
  let service;

  beforeEach(() => {
    CustomsServiceFactory.clearCache();
    service = new NetherlandsCustomsService({ environment: 'test' });
  });

  describe('constructor', () => {
    test('should set country code NL', () => {
      expect(service.getCountryCode()).toBe('NL');
    });

    test('should set test environment endpoints', () => {
      const endpoints = service.getEndpoints();
      expect(endpoints.digipoort).toContain('preprod');
      expect(endpoints.deco).toContain('test');
    });

    test('should support H7 and H1', () => {
      const types = service.getSupportedDeclarationTypes();
      expect(types).toContain('H7');
      expect(types).toContain('H1');
    });
  });

  describe('_buildDECOXml', () => {
    test('should produce valid XML with required elements', () => {
      const data = {
        declarant: { eori: 'NL123456789', name: 'Test BV' },
        exporter: { name: 'China Co', country: 'CN' },
        importer: { eori: 'NL987654321', name: 'Buyer BV' },
        transport: { documentRef: 'AWB-123', documentType: 'N740' },
        items: [{
          commodityCode: '610910',
          description: 'T-shirt',
          customsValue: 25,
          grossMass: 0.5,
          netMass: 0.4,
          numberOfPackages: 1,
        }],
        totalGrossMass: 0.5,
        totalPackages: 1,
        totalCustomsValue: 25,
        currency: 'EUR',
      };
      const xml = service._buildDECOXml(data);

      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain('<TypeCode>154</TypeCode>');
      expect(xml).toContain('<ID>NL123456789</ID>');
      expect(xml).toContain('<ID>610910</ID>');
      expect(xml).toContain('<Description>T-shirt</Description>');
      expect(xml).toContain('<QuantityQuantity>1</QuantityQuantity>');
      expect(xml).toContain('urn:wco:datamodel:WCO:DECO.Declaration:2');
      expect(xml).toContain('<CountryCode>CN</CountryCode>');
      expect(xml).toContain('<WCOTypeCode>DECO</WCOTypeCode>');
    });

    test('should escape XML special characters', () => {
      const data = {
        declarant: { eori: 'NL123456789', name: 'Test & Co <BV>' },
        exporter: { name: 'Exp "Ltd"', country: 'CN' },
        importer: { eori: 'NL987654321' },
        transport: { documentRef: 'AWB-123' },
        items: [{
          commodityCode: '610910',
          description: 'Item with <special> & "chars"',
          customsValue: 25,
          grossMass: 0.5,
        }],
        totalCustomsValue: 25,
        currency: 'EUR',
      };
      const xml = service._buildDECOXml(data);
      expect(xml).toContain('Test &amp; Co &lt;BV&gt;');
      expect(xml).toContain('&lt;special&gt; &amp; &quot;chars&quot;');
    });

    test('should include IOSS when provided', () => {
      const data = {
        declarant: { eori: 'NL123456789', name: 'Test' },
        exporter: { name: 'Exp', country: 'CN' },
        importer: { eori: 'NL987654321' },
        transport: { documentRef: 'AWB-123' },
        iossNumber: 'IMNL000000123',
        items: [{ commodityCode: '610910', description: 'Shirt', customsValue: 25, grossMass: 0.5 }],
        totalCustomsValue: 25,
        currency: 'EUR',
      };
      const xml = service._buildDECOXml(data);
      expect(xml).toContain('<DomesticDutyTaxParty>');
      expect(xml).toContain('IMNL000000123');
      expect(xml).toContain('<RoleCode>FR5</RoleCode>');
    });
  });

  describe('simulation mode', () => {
    test('should return simulated response for H7', () => {
      const result = service._simulateResponse('H7', 'EXP-001');
      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(result.mrn).toMatch(/^\d{2}NL0003/);
      expect(result.lrn).toBe('EXP-001');
      expect(result.channel).toBe('green');
    });

    test('should return simulated response for H1', () => {
      const result = service._simulateResponse('H1', 'EXP-002');
      expect(result.success).toBe(true);
      expect(result.mrn).toMatch(/^\d{2}NL/);
    });

    test('should report not configured without certificate', () => {
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('_parseDigipoortResponse', () => {
    test('should parse successful response with MRN', () => {
      const xml = '<response><statuscode>OK</statuscode><MRN>26NL000312345678</MRN></response>';
      const result = service._parseDigipoortResponse(xml);
      expect(result.success).toBe(true);
      expect(result.mrn).toBe('26NL000312345678');
      expect(result.channel).toBe('green');
    });

    test('should parse response with StatusCode format', () => {
      const xml = '<response><StatusCode>01</StatusCode><MRN>26NL000312345678</MRN></response>';
      const result = service._parseDigipoortResponse(xml);
      expect(result.success).toBe(true);
      expect(result.statusDescription).toBe('Declaracion aceptada');
    });

    test('should parse error response', () => {
      const xml = '<response><statuscode>ERROR</statuscode><foutbeschrijving>Invalid data</foutbeschrijving><foutcode>E001</foutcode></response>';
      const result = service._parseDigipoortResponse(xml);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid data');
      expect(result.errorCode).toBe('E001');
    });

    test('should parse multiple functional errors', () => {
      const xml = `<response><statuscode>ERROR</statuscode>
        <FunctionalError><ErrorCode>E01</ErrorCode><ErrorDescription>Bad field</ErrorDescription><Pointer>/item/1</Pointer></FunctionalError>
        <FunctionalError><ErrorCode>E02</ErrorCode><ErrorDescription>Missing data</ErrorDescription></FunctionalError>
      </response>`;
      const result = service._parseDigipoortResponse(xml);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].code).toBe('E01');
      expect(result.errors[0].description).toBe('Bad field');
      expect(result.errors[0].pointer).toBe('/item/1');
      expect(result.errors[1].code).toBe('E02');
    });

    test('should detect correction required (status 04)', () => {
      const xml = '<response><StatusCode>04</StatusCode></response>';
      const result = service._parseDigipoortResponse(xml);
      expect(result.correctionRequired).toBe(true);
      expect(result.success).toBe(false);
    });

    test('should detect document control channel', () => {
      const xml = '<response><statuscode>OK</statuscode><MRN>26NL000312345678</MRN><ControlType>10</ControlType></response>';
      const result = service._parseDigipoortResponse(xml);
      expect(result.channel).toBe('orange');
    });

    test('should detect physical control channel', () => {
      const xml = '<response><statuscode>OK</statuscode><MRN>26NL000312345678</MRN><ControlType>11</ControlType></response>';
      const result = service._parseDigipoortResponse(xml);
      expect(result.channel).toBe('red');
    });

    test('should extract kenmerk/messageId', () => {
      const xml = '<response><statuscode>OK</statuscode><MRN>26NL000312345678</MRN><kenmerk>MSG-001</kenmerk></response>';
      const result = service._parseDigipoortResponse(xml);
      expect(result.messageId).toBe('MSG-001');
    });

    test('should extract duty amount', () => {
      const xml = '<response><statuscode>OK</statuscode><MRN>26NL000312345678</MRN><TotalDutyAmount>123.45</TotalDutyAmount></response>';
      const result = service._parseDigipoortResponse(xml);
      expect(result.dutyAmount).toBe(123.45);
    });

    test('should set system based on declarationType', () => {
      const xml = '<response><statuscode>OK</statuscode></response>';
      const h7Result = service._parseDigipoortResponse(xml, 'H7');
      expect(h7Result.system).toBe('DECO');
      const h1Result = service._parseDigipoortResponse(xml, 'H1');
      expect(h1Result.system).toBe('DMS 4.0');
    });

    test('should include timestamp', () => {
      const xml = '<response><statuscode>OK</statuscode></response>';
      const result = service._parseDigipoortResponse(xml);
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });

    test('should handle non-string input', () => {
      const result = service._parseDigipoortResponse({ statuscode: 'OK' });
      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
    });
  });

  describe('validateDeclaration', () => {
    test('should validate H7 with NL rules', async () => {
      const data = {
        declarant: { eori: 'NL123456789' },
        exporter: { companyName: 'China Co', country: 'CN' },
        importer: { eori: 'NL987654321' },
        transport: { documentRef: 'AWB-123' },
        goods: [{
          hsCode: '610910',
          description: 'Shirt',
          invoiceValue: 25,
          grossWeight: 0.5,
        }],
      };
      const result = await service.validateDeclaration(data, 'H7');
      expect(result.system).toBe('DECO');
    });

    test('should validate H1 with NL rules', async () => {
      const data = {
        declarant: { eori: 'NL123456789' },
        exporter: { companyName: 'China Co', country: 'CN' },
        importer: { eori: 'NL987654321' },
        transport: { documentRef: 'BL-123' },
        customsOffice: 'NL000297',
        goods: [{
          taricCode: '8471300000',
          description: 'Laptop',
          invoiceValue: 800,
          grossWeight: 3.5,
        }],
      };
      const result = await service.validateDeclaration(data, 'H1');
      expect(result.system).toBe('DMS 4.0');
    });
  });
});

describe('CustomsServiceFactory', () => {
  beforeEach(() => {
    CustomsServiceFactory.clearCache();
  });

  test('should return NetherlandsCustomsService for NL', () => {
    const service = CustomsServiceFactory.getService('NL');
    expect(service).toBeInstanceOf(NetherlandsCustomsService);
    expect(service.getCountryCode()).toBe('NL');
  });

  test('should return SpainCustomsService for ES', () => {
    const service = CustomsServiceFactory.getService('ES');
    expect(service).toBeInstanceOf(SpainCustomsService);
  });

  test('should throw for unsupported country', () => {
    expect(() => CustomsServiceFactory.getService('XX')).toThrow('not available');
  });

  test('should cache service instances', () => {
    const s1 = CustomsServiceFactory.getService('NL');
    const s2 = CustomsServiceFactory.getService('NL');
    expect(s1).toBe(s2);
  });

  test('should list supported countries including NL', () => {
    const countries = CustomsServiceFactory.getSupportedCountries();
    const nl = countries.find(c => c.code === 'NL');
    expect(nl).toBeDefined();
    expect(nl.system).toBe('DMS/DECO');
    expect(nl.status).toBe('beta');
  });
});

describe('SpainCustomsService delegation', () => {
  beforeEach(() => {
    CustomsServiceFactory.clearCache();
  });

  test('should support all declaration types', () => {
    const service = CustomsServiceFactory.getService('ES');
    const types = service.getSupportedDeclarationTypes();
    expect(types).toContain('H1');
    expect(types).toContain('H7');
    expect(types).toContain('AES');
    expect(types).toContain('ENS');
    expect(types).toContain('NCTS');
  });

  test('should throw on unsupported declaration type', async () => {
    const service = CustomsServiceFactory.getService('ES');
    await expect(service.submitDeclaration({}, 'INVALID'))
      .rejects.toThrow('Unsupported declaration type');
  });

  test('should have correct country code', () => {
    const service = CustomsServiceFactory.getService('ES');
    expect(service.getCountryCode()).toBe('ES');
  });
});
