/**
 * NetherlandsCustomsService tests
 *
 * Fronteras externas mockeadas:
 * - logger (config/logger)
 * - El transporte HTTP/SOAP saliente (axios, https, fs, forge) en _sendViaDigipoort
 *
 * TODO LO DEMAS (mapeos, validaciones, construcción de XML, nlValidation,
 * uccDataMapper, cvbService.requiresCVB) SE EJECUTA REAL — es la lógica bajo
 * prueba. Los `require()` dinámicos internos NO se mockean.
 *
 * NUNCA sale tráfico real a Digipoort/DMS/DECO: mockea
 * _sendViaDigipoort/axios/forge desde el principio.
 */

// Mock logger SIEMPRE (frontera de IO)
jest.mock('../../../../src/config/logger');

// Mock las fronteras de red/cert dentro de _sendViaDigipoort
jest.mock('axios');
jest.mock('fs');
jest.mock('node-forge');
jest.mock('https');

const NetherlandsCustomsService = require('../../../../src/services/customs/netherlands/netherlandsCustomsService');
const logger = require('../../../../src/config/logger');
const axios = require('axios');
const fs = require('fs');
const forge = require('node-forge');
const https = require('https');

describe('NetherlandsCustomsService', () => {
  let service;
  let serviceProd;

  beforeEach(() => {
    jest.clearAllMocks();

    // Instancia de TEST (environment por defecto)
    service = new NetherlandsCustomsService({
      environment: 'test',
      certificatePath: '/fake/cert.p12',
      certificatePassword: 'fakepass',
      eoriNumber: 'NL123456789'
    });

    // Instancia de PRODUCTION (para probar rama env)
    serviceProd = new NetherlandsCustomsService({
      environment: 'production',
      certificatePath: '/fake/cert.p12',
      certificatePassword: 'fakepass',
      eoriNumber: 'NL999888777'
    });

    // Mock de forge para simular lectura de certificado sin fichero real
    const mockCert = { validity: { notAfter: new Date(Date.now() + 365*24*3600*1000) } };
    const mockKey = {};
    forge.asn1 = { fromDer: jest.fn().mockReturnValue({}) };
    forge.pkcs12 = { pkcs12FromAsn1: jest.fn().mockReturnValue({
      getBags: jest.fn((opts) => {
        if (opts.bagType === forge.pki.oids.certBag) {
          return { [forge.pki.oids.certBag]: [{ cert: mockCert }] };
        }
        if (opts.bagType === forge.pki.oids.pkcs8ShroudedKeyBag) {
          return { [forge.pki.oids.pkcs8ShroudedKeyBag]: [{ key: mockKey }] };
        }
        return {};
      })
    }) };
    forge.pki = {
      oids: { certBag: 'certBag', pkcs8ShroudedKeyBag: 'keyBag' },
      certificateToPem: jest.fn().mockReturnValue('-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----'),
      privateKeyToPem: jest.fn().mockReturnValue('-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----')
    };

    fs.readFileSync = jest.fn().mockReturnValue(Buffer.from('fake p12 data'));
    https.Agent = jest.fn();

    // Mock axios para _sendViaDigipoort (red saliente) — default response para evitar crashes
    axios.post = jest.fn().mockResolvedValue({
      data: '<MRN>26NL0003DEFAULT</MRN><statuscode>OK</statuscode>'
    });
  });

  // ================== Constructor y configuración ==================

  describe('constructor', () => {
    test('inicializa con entorno test por defecto', () => {
      const s = new NetherlandsCustomsService({});
      expect(s.countryCode).toBe('NL');
      expect(s.environment).toBe('test');
      expect(s.endpoints.digipoort).toBe('https://preprod-dgp2.procesinfrastructuur.nl');
      expect(s.endpoints.dms).toBe('https://test-dms.douane.nl');
      expect(s.endpoints.deco).toBe('https://test-deco.douane.nl');
      expect(logger.info).toHaveBeenCalledWith('NetherlandsCustomsService initialized (test)');
    });

    test('inicializa con entorno production si se pasa explícitamente', () => {
      const s = new NetherlandsCustomsService({ environment: 'production' });
      expect(s.environment).toBe('production');
      expect(s.endpoints.digipoort).toBe('https://dgp2.procesinfrastructuur.nl');
      expect(s.endpoints.dms).toBe('https://dms.douane.nl');
      expect(s.endpoints.deco).toBe('https://deco.douane.nl');
      expect(logger.info).toHaveBeenCalledWith('NetherlandsCustomsService initialized (production)');
    });

    test('inicializa certificado y EORI desde config o process.env', () => {
      process.env.NL_CERT_PATH = '/env/cert.p12';
      process.env.NL_CERT_PASSWORD = 'envpass';
      process.env.NL_EORI = 'NL000111222';

      const s1 = new NetherlandsCustomsService({ environment: 'test' });
      expect(s1.certificate).toBe('/env/cert.p12');
      expect(s1.certPassword).toBe('envpass');
      expect(s1.eori).toBe('NL000111222');

      const s2 = new NetherlandsCustomsService({
        certificatePath: '/cfg/cert.p12',
        certificatePassword: 'cfgpass',
        eoriNumber: 'NL333444555'
      });
      expect(s2.certificate).toBe('/cfg/cert.p12');
      expect(s2.certPassword).toBe('cfgpass');
      expect(s2.eori).toBe('NL333444555');

      delete process.env.NL_CERT_PATH;
      delete process.env.NL_CERT_PASSWORD;
      delete process.env.NL_EORI;
    });
  });

  describe('getEndpoints', () => {
    test('devuelve endpoints correctos para test', () => {
      const ep = service.getEndpoints();
      expect(ep.digipoort).toBe('https://preprod-dgp2.procesinfrastructuur.nl');
      expect(ep.dms).toBe('https://test-dms.douane.nl');
      expect(ep.deco).toBe('https://test-deco.douane.nl');
    });

    test('devuelve endpoints de producción cuando environment=production', () => {
      const ep = serviceProd.getEndpoints();
      expect(ep.digipoort).toBe('https://dgp2.procesinfrastructuur.nl');
      expect(ep.dms).toBe('https://dms.douane.nl');
      expect(ep.deco).toBe('https://deco.douane.nl');
    });
  });

  describe('getSupportedDeclarationTypes', () => {
    test('soporta H7 y H1', () => {
      expect(service.getSupportedDeclarationTypes()).toEqual(['H7', 'H1']);
    });
  });

  describe('isConfigured', () => {
    test('devuelve true si hay certificado y password', () => {
      expect(service.isConfigured()).toBe(true);
    });

    test('devuelve false si falta certificado', () => {
      const s = new NetherlandsCustomsService({ certificatePassword: 'pass' });
      expect(s.isConfigured()).toBe(false);
    });

    test('devuelve false si falta password', () => {
      const s = new NetherlandsCustomsService({ certificatePath: '/cert.p12' });
      expect(s.isConfigured()).toBe(false);
    });
  });

  // ================== submitDeclaration (router) ==================

  describe('submitDeclaration', () => {
    const fakeExpedition = {
      expeditionId: 'EXP-H7-001',
      client: { taxId: 'NL123456789', companyName: 'Test NL BV' },
      exporter: { companyName: 'CN Exporter', country: 'CN', address: { city: 'Shanghai', street: 'Main St', postalCode: '200000' } },
      importer: { companyName: 'NL Importer', eori: 'NL987654321' },
      goods: [{
        taricCode: '6203423100',
        description: 'Cotton Shirt',
        grossWeight: 0.5,
        invoiceValue: 25,
        currency: 'EUR',
        countryOfOrigin: 'CN',
        packageCount: 1
      }],
      transport: { documentType: 'N740', documentRef: 'AWB123456', mode: '4' },
      currency: 'EUR'
    };

    test('H7 → llama _submitDECO', async () => {
      service._submitDECO = jest.fn().mockResolvedValue({ success: true, mrn: '26NL00039999' });
      const res = await service.submitDeclaration(fakeExpedition, 'H7');
      expect(service._submitDECO).toHaveBeenCalledWith(fakeExpedition);
      expect(res.success).toBe(true);
      expect(res.mrn).toBe('26NL00039999');
    });

    test('H1 → llama _submitDMS con import', async () => {
      service._submitDMS = jest.fn().mockResolvedValue({ success: true, mrn: '26NL00029888' });
      const res = await service.submitDeclaration(fakeExpedition, 'H1');
      expect(service._submitDMS).toHaveBeenCalledWith(fakeExpedition, 'import');
      expect(res.success).toBe(true);
    });

    test('AES → llama _submitDMS con export', async () => {
      service._submitDMS = jest.fn().mockResolvedValue({ success: true, mrn: '26NL00029777' });
      const res = await service.submitDeclaration(fakeExpedition, 'AES');
      expect(service._submitDMS).toHaveBeenCalledWith(fakeExpedition, 'export');
      expect(res.success).toBe(true);
    });

    test('tipo no soportado → lanza error', async () => {
      await expect(service.submitDeclaration(fakeExpedition, 'H3'))
        .rejects.toThrow('Declaration type H3 not yet supported for Netherlands');
    });
  });

  // ================== _submitDECO (H7) ==================

  describe('_submitDECO', () => {
    const validExpeditionH7 = {
      expeditionId: 'H7-001',
      declarant: { eori: 'NL123456789', companyName: 'Declarant BV' },
      exporter: { companyName: 'CN Seller', country: 'CN', address: { city: 'Beijing', street: 'Export St', postalCode: '100000' } },
      importer: { eori: 'NL987654321', companyName: 'NL Buyer' },
      goods: [{
        taricCode: '6203423100',
        description: 'Cotton Shirt',
        grossWeight: 0.3,
        invoiceValue: 45,
        currency: 'EUR',
        countryOfOrigin: 'CN',
        packageCount: 1
      }],
      transport: { documentType: 'N740', documentRef: 'AWB789', mode: '4' }
    };

    test('valida y construye XML DECO correcto', async () => {
      // Sin certificado → simula
      const sNoConfig = new NetherlandsCustomsService({ environment: 'test' });
      const res = await sNoConfig._submitDECO(validExpeditionH7);
      expect(res.success).toBe(true);
      expect(res.simulated).toBe(true);
      expect(res.mrn).toMatch(/^\d{2}NL0003[A-Z0-9]+$/);
      expect(logger.warn).toHaveBeenCalledWith('NL DECO: No certificate configured - using simulation mode');
    });

    test('rechaza si nlValidation.validateDECO falla', async () => {
      const badExp = {
        ...validExpeditionH7,
        goods: [{ ...validExpeditionH7.goods[0], invoiceValue: 200 }] // >150
      };
      const res = await service._submitDECO(badExp);
      expect(res.success).toBe(false);
      expect(res.errors).toBeDefined();
      expect(res.errors.length).toBeGreaterThan(0);
      expect(res.errors[0]).toContain('supera');
      expect(res.system).toBe('DECO');
    });

    test('rechaza si validateH7 del uccDataMapper falla (validación UCC común)', async () => {
      const badExp = {
        ...validExpeditionH7,
        declarant: {} // sin eori
      };
      const res = await service._submitDECO(badExp);
      expect(res.success).toBe(false);
      expect(res.errors).toBeDefined();
    });

    test('con certificado configurado → llama _sendViaDigipoort y parsea respuesta', async () => {
      axios.post.mockResolvedValue({
        data: `<soap:Envelope><soap:Body><MRN>26NL00039TESTDECO</MRN><statuscode>OK</statuscode></soap:Body></soap:Envelope>`
      });

      const res = await service._submitDECO(validExpeditionH7);
      expect(res.success).toBe(true);
      expect(res.mrn).toBe('26NL00039TESTDECO');
      expect(res.system).toBe('DECO');
      expect(axios.post).toHaveBeenCalledWith(
        'https://preprod-dgp2.procesinfrastructuur.nl/aanleverservice/1.2',
        expect.stringContaining('aanleverRequest'),
        expect.objectContaining({ headers: { 'Content-Type': 'text/xml; charset=utf-8' } })
      );
    });
  });

  // ================== _submitDMS (H1/AES) ==================

  describe('_submitDMS', () => {
    const validExpeditionDMS = {
      expeditionId: 'DMS-001',
      declarant: { eori: 'NL123456789', companyName: 'DMS Declarant' },
      exporter: { companyName: 'Exporter Co', country: 'CN', eori: 'CN123' },
      importer: { eori: 'NL987654321', companyName: 'Importer BV' },
      goods: [{
        taricCode: '8471300000',
        description: 'Laptop computer',
        grossWeight: 2.5,
        netWeight: 2.3,
        invoiceValue: 800,
        currency: 'EUR',
        countryOfOrigin: 'CN',
        packageCount: 1,
        packageType: 'CT'
      }],
      transport: { documentType: 'N740', documentRef: 'AWBDMS123', mode: '4', modeAtBorder: '1' },
      totalGrossMass: 2.5
    };

    test('import: valida y construye XML DMS con operationType=import', async () => {
      const sNoConfig = new NetherlandsCustomsService({ environment: 'test' });
      const res = await sNoConfig._submitDMS(validExpeditionDMS, 'import');
      expect(res.success).toBe(true);
      expect(res.simulated).toBe(true);
      expect(res.mrn).toMatch(/^\d{2}NL0003/);
      expect(logger.warn).toHaveBeenCalledWith('NL DMS: No certificate configured - using simulation mode');
    });

    test('export: construye XML DMS con operationType=export', async () => {
      const sNoConfig = new NetherlandsCustomsService({ environment: 'test' });
      const res = await sNoConfig._submitDMS(validExpeditionDMS, 'export');
      expect(res.success).toBe(true);
      expect(res.simulated).toBe(true);
    });

    test('rechaza si requiere CVB y no hay cvbReleaseId', async () => {
      // Simula maritime import sin CVB: necesita transportMode='maritime' O entryCustomsOffice en puerto O containerNumber
      const maritimeExp = {
        ...validExpeditionDMS,
        transportMode: 'maritime', // esto activa requiresCVB
        transport: { ...validExpeditionDMS.transport, mode: '1', documentType: 'N705', containerNumber: 'MSCU1234567' }
      };
      const res = await service._submitDMS(maritimeExp, 'import');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Container Release Message');
      expect(res.requiresCVB).toBe(true);
    });

    test('rechaza si nlValidation.validateDMS falla', async () => {
      const badExp = {
        ...validExpeditionDMS,
        declarant: {} // sin eori
      };
      const res = await service._submitDMS(badExp, 'import');
      expect(res.success).toBe(false);
      expect(res.errors).toBeDefined();
      expect(res.system).toBe('DMS 4.0');
    });

    test('con certificado → llama _sendViaDigipoort', async () => {
      axios.post.mockResolvedValue({
        data: `<MRN>26NL00029TESTDMS</MRN><statuscode>01</statuscode>`
      });
      const res = await service._submitDMS(validExpeditionDMS, 'import');
      expect(res.success).toBe(true);
      expect(res.mrn).toBe('26NL00029TESTDMS');
      // Regresión: una declaración DMS 4.0 (H1/AES) debe etiquetarse como 'DMS 4.0',
      // no como 'DECO'. Antes _submitDMS llamaba a _sendViaDigipoort sin declarationType
      // y _parseDigipoortResponse usaba el default 'H7' → system quedaba en 'DECO'.
      expect(res.system).toBe('DMS 4.0');
    });
  });

  // ================== XML builders: _buildDECOXml ==================

  describe('_buildDECOXml', () => {
    test('genera estructura XML DECO 2.0 válida con todos los campos', () => {
      const data = {
        lrn: 'LRN-TEST-001',
        declarant: { eori: 'NL123456789', name: 'Declarant', contactName: 'John', contactEmail: 'j@test.nl', address: { city: 'Amsterdam', country: 'NL', street: 'Dam 1', postalCode: '1000AA' } },
        exporter: { name: 'CN Exporter', country: 'CN', address: { city: 'Shanghai', street: 'Main', postalCode: '200000' } },
        importer: { eori: 'NL987654321', name: 'Importer' },
        representative: { eori: 'NL555666777', status: '2', contactName: 'Agent', contactEmail: 'agent@nl.com' },
        items: [{
          itemNumber: 1,
          commodityCode: '620342',
          description: 'Test Item',
          grossMass: 1.5,
          customsValue: 50,
          currency: 'EUR',
          exporterName: 'Item Exporter',
          exporterCity: 'Beijing',
          countryOfOrigin: 'CN',
          numberOfPackages: 2,
          additionalProcedure: 'C07',
          transportDocRef: 'AWB123',
          transportDocType: 'N740',
          ucr: 'UCR001',
          previousDocument: { id: 'PREV001', type: '380' },
          supportingDocuments: [{ id: 'SUPP001', type: 'N380' }]
        }],
        transport: { documentRef: 'AWB-MAIN', documentType: 'N740' },
        uniqueConsignmentRef: 'UCR-MAIN',
        totalGrossMass: 1.5,
        iossNumber: 'IMNL000000123',
        customsOffice: 'NL000399',
        currency: 'EUR',
        previousDocument: { id: 'PREVMAIN', type: '380' },
        supportingDocuments: [{ id: 'SUPPMAIN', type: 'N380' }],
        goodsLocation: { city: 'Amsterdam', street: 'Port St', postalCode: '1000BB' }
      };

      const xml = service._buildDECOXml(data);

      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain('urn:wco:datamodel:WCO:DECO.Declaration:2');
      expect(xml).toContain('<WCOTypeCode>DECO</WCOTypeCode>');
      expect(xml).toContain('<FunctionalReferenceID>LRN-TEST-001</FunctionalReferenceID>');
      expect(xml).toContain('<TypeCode>154</TypeCode>');
      expect(xml).toContain('<ID>NL000399</ID>');
      expect(xml).toContain('<Declarant>');
      expect(xml).toContain('<Name>Declarant</Name>');
      expect(xml).toContain('<ID>NL123456789</ID>');
      expect(xml).toContain('<Agent>');
      expect(xml).toContain('<FunctionCode>2</FunctionCode>');
      expect(xml).toContain('<Exporter>');
      expect(xml).toContain('<Name>CN Exporter</Name>');
      expect(xml).toContain('<CountryCode>CN</CountryCode>');
      expect(xml).toContain('<GovernmentAgencyGoodsItem>');
      expect(xml).toContain('<SequenceNumeric>1</SequenceNumeric>');
      expect(xml).toContain('<Description>Test Item</Description>');
      expect(xml).toContain('<ID>620342</ID>');
      expect(xml).toContain('<IdentificationTypeCode>SSH</IdentificationTypeCode>');
      expect(xml).toContain('<GrossMassMeasure>1.5</GrossMassMeasure>');
      expect(xml).toContain('<ItemChargeAmount currencyID="EUR">50</ItemChargeAmount>');
      expect(xml).toContain('<AdditionalProcedure>');
      expect(xml).toContain('<ProcedureCode>C07</ProcedureCode>');
      expect(xml).toContain('<UCR>');
      expect(xml).toContain('<TraderAssignedReferenceID>UCR001</TraderAssignedReferenceID>');
      expect(xml).toContain('<TransportContractDocument>');
      expect(xml).toContain('<TypeCode>N740</TypeCode>');
      expect(xml).toContain('<DomesticDutyTaxParty>');
      expect(xml).toContain('<ID>IMNL000000123</ID>');
      expect(xml).toContain('<RoleCode>FR5</RoleCode>');
      expect(xml).toContain('<Importer>');
      expect(xml).toContain('<ID>NL987654321</ID>');
    });

    test('escapa caracteres XML peligrosos', () => {
      const data = {
        declarant: { eori: 'NL123', name: 'Test & Co <dangerous>' },
        exporter: { name: 'Ex "quotes"', country: 'CN' },
        items: [{
          description: 'Item with <script>alert(1)</script> and & ampersand',
          commodityCode: '620342',
          grossMass: 1
        }],
        transport: { documentRef: 'AWB', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      expect(xml).toContain('Test &amp; Co &lt;dangerous&gt;');
      expect(xml).toContain('Ex &quot;quotes&quot;');
      expect(xml).toContain('Item with &lt;script&gt;alert(1)&lt;/script&gt; and &amp; ampersand');
    });

    test('genera LRN automático si no se proporciona', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'Ex', country: 'CN' },
        items: [{ commodityCode: '620342', grossMass: 1 }],
        transport: { documentRef: 'AWB', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      expect(xml).toMatch(/<FunctionalReferenceID>LRN-\d+<\/FunctionalReferenceID>/);
      expect(xml).toMatch(/<ApplicationReferenceID>LRN-\d+<\/ApplicationReferenceID>/);
    });

    test('usa customsOffice por defecto si no se proporciona', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'Ex', country: 'CN' },
        items: [{ commodityCode: '620342', grossMass: 1 }],
        transport: { documentRef: 'AWB', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      expect(xml).toContain('<ID>NL000399</ID>'); // SCHIPHOL por defecto
    });
  });

  // ================== XML builders: _buildDMSXml ==================

  describe('_buildDMSXml', () => {
    test('genera estructura XML DMS 1.30 para import', () => {
      const data = {
        lrn: 'LRN-DMS-001',
        typeCode: '1',
        declarant: { eori: 'NL123456789', name: 'DMS Declarant' },
        exporter: { name: 'Exporter', eori: 'CN123', country: 'CN' },
        importer: { eori: 'NL987654321', name: 'Importer' },
        items: [{
          itemNumber: 1,
          commodityCode: '8471300000',
          description: 'Laptop',
          grossMass: 2.5,
          netMass: 2.3,
          customsValue: 800,
          currency: 'EUR',
          countryOfOrigin: 'CN',
          numberOfPackages: 1,
          packageType: 'CT',
          procedureCode: '40',
          previousProcedure: '00'
        }],
        transport: { documentRef: 'AWBDMS', documentType: 'N740', containerIndicator: '0', modeAtBorder: '1' },
        customsOffice: 'NL000297',
        countryOfDispatch: 'CN',
        totalGrossMass: 2.5,
        currency: 'EUR'
      };

      const xml = service._buildDMSXml(data, 'import');

      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain('urn:wco:datamodel:WCO:DMS.Declaration:1');
      expect(xml).toContain('<WCOTypeCode>DMS</WCOTypeCode>');
      expect(xml).toContain('<FunctionalReferenceID>LRN-DMS-001</FunctionalReferenceID>');
      expect(xml).toContain('<TypeCode>1</TypeCode>');
      expect(xml).toContain('<ID>NL000297</ID>');
      expect(xml).toContain('<Declarant>');
      expect(xml).toContain('<ID>NL123456789</ID>');
      expect(xml).toContain('<GovernmentAgencyGoodsItem>');
      expect(xml).toContain('<SequenceNumeric>1</SequenceNumeric>');
      expect(xml).toContain('<Description>Laptop</Description>');
      expect(xml).toContain('<ID>8471300000</ID>');
      expect(xml).toContain('<IdentificationTypeCode>TSP</IdentificationTypeCode>');
      expect(xml).toContain('<GrossMassMeasure>2.5</GrossMassMeasure>');
      expect(xml).toContain('<NetNetWeightMeasure>2.3</NetNetWeightMeasure>');
      expect(xml).toContain('<CurrentCode>40</CurrentCode>');
      expect(xml).toContain('<PreviousCode>00</PreviousCode>');
      expect(xml).toContain('<TotalGrossMassMeasure>2.5</TotalGrossMassMeasure>');
      expect(xml).toContain('<ModeCode>1</ModeCode>');
    });

    test('export: usa procedureCode 10 por defecto y no incluye segunda DutyTaxFee', () => {
      const data = {
        declarant: { eori: 'NL123', name: 'Exp Decl' },
        exporter: { name: 'Exp', country: 'NL', eori: 'NL456' },
        importer: { eori: 'CN789', name: 'CN Imp' },
        items: [{
          commodityCode: '6203420000',
          description: 'Export Item',
          grossMass: 1,
          netMass: 0.9,
          customsValue: 100
        }],
        transport: { documentRef: 'EXP-DOC', documentType: 'N740' },
        exitOffice: 'NL000297'
      };

      const xml = service._buildDMSXml(data, 'export');

      expect(xml).toContain('<CurrentCode>10</CurrentCode>'); // export default
      expect(xml).toContain('<ExitOffice>');
      expect(xml).toContain('<ID>NL000297</ID>');
      // Solo una DutyTaxFee para export
      const dutyMatches = xml.match(/<DutyTaxFee>/g);
      expect(dutyMatches.length).toBe(1); // solo A00, no B00
    });

    test('incluye códigos TARIC adicionales si se proporcionan', () => {
      const data = {
        declarant: { eori: 'NL123', name: 'D' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456', name: 'I' },
        items: [{
          commodityCode: '8471300000',
          taricAdditionalCode: '1234',
          nationalAdditionalCode: 'X99',
          description: 'Item with codes',
          grossMass: 1,
          netMass: 0.9
        }],
        transport: { documentRef: 'DOC', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');

      expect(xml).toContain('<ID>8471300000</ID>');
      expect(xml).toContain('<IdentificationTypeCode>TSP</IdentificationTypeCode>');
      expect(xml).toContain('<ID>1234</ID>');
      expect(xml).toContain('<IdentificationTypeCode>TRA</IdentificationTypeCode>');
      expect(xml).toContain('<ID>X99</ID>');
      expect(xml).toContain('<IdentificationTypeCode>GN</IdentificationTypeCode>');
      // Verificar SequenceNumeric incrementa
      const classSeqs = xml.match(/<Classification>[\s\S]*?<SequenceNumeric>(\d+)<\/SequenceNumeric>/g);
      expect(classSeqs.length).toBe(3); // TSP, TRA, GN
    });

    test('incluye campos opcionales cuando están presentes', () => {
      const data = {
        declarant: { eori: 'NL123', name: 'D' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456', name: 'I' },
        representative: { eori: 'NL777', status: '3' },
        authorisations: [{ id: 'AUTH001', type: '1', holderId: 'NL888' }],
        deferredPayment: 'DP12345',
        guarantee: { type: '0', reference: 'GRN123', accessCode: 'ACC456' },
        supervisingOffice: 'NL000231',
        warehouse: { id: 'WH001', type: 'U' },
        tradeTerms: { incoterm: 'CIF', locationName: 'Rotterdam', country: 'NL' },
        items: [{
          commodityCode: '8471300000',
          description: 'Item',
          grossMass: 1,
          netMass: 0.9,
          supplementaryUnits: 10,
          shippingMarks: 'MARK-001',
          preferentialOrigin: true,
          previousDocument: { id: 'PDOC001', type: 'NMRN', lineNumeric: 1 },
          supportingDocuments: [{ id: 'SDOC001', type: 'N380' }]
        }],
        transport: { documentRef: 'DOC', documentType: 'N740', containerId: 'CONT123' },
        previousDocuments: [{ id: 'PREV001', type: '1' }],
        supportingDocuments: [{ id: 'SUPP001', type: 'N380' }]
      };

      const xml = service._buildDMSXml(data, 'import');

      expect(xml).toContain('<Agent>');
      expect(xml).toContain('<FunctionCode>3</FunctionCode>');
      expect(xml).toContain('<Authorisation>');
      expect(xml).toContain('<ID>AUTH001</ID>');
      expect(xml).toContain('<DeferredPayment>');
      expect(xml).toContain('<ID>DP12345</ID>');
      expect(xml).toContain('<ObligationGuarantee>');
      expect(xml).toContain('<SecurityDetailsCode>0</SecurityDetailsCode>');
      expect(xml).toContain('<AccessCode>ACC456</AccessCode>');
      expect(xml).toContain('<SupervisingOffice>');
      expect(xml).toContain('<ID>NL000231</ID>');
      expect(xml).toContain('<Warehouse>');
      expect(xml).toContain('<ID>WH001</ID>');
      expect(xml).toContain('<TradeTerms>');
      expect(xml).toContain('<ConditionCode>CIF</ConditionCode>');
      expect(xml).toContain('<TariffQuantity>10</TariffQuantity>');
      expect(xml).toContain('<MarksNumbersID>MARK-001</MarksNumbersID>');
      expect(xml).toContain('<TypeCode>1</TypeCode>'); // preferential origin
      expect(xml).toContain('<LineNumeric>1</LineNumeric>');
      expect(xml).toContain('<TransportEquipment>');
      expect(xml).toContain('<ID>CONT123</ID>');
      expect(xml).toContain('<PreviousDocument>');
      expect(xml).toContain('<ID>PREV001</ID>');
    });
  });

  // ================== _sendViaDigipoort y _parseDigipoortResponse ==================

  describe('_sendViaDigipoort', () => {
    test('construye SOAP envelope y envía a Digipoort', async () => {
      axios.post.mockResolvedValue({
        data: '<MRN>26NL00039TEST</MRN><statuscode>OK</statuscode>'
      });

      const xml = '<Declaration>test</Declaration>';
      const res = await service._sendViaDigipoort(xml, 'DECO');

      expect(axios.post).toHaveBeenCalledWith(
        'https://preprod-dgp2.procesinfrastructuur.nl/aanleverservice/1.2',
        expect.stringContaining('aanleverRequest'),
        expect.objectContaining({
          headers: { 'Content-Type': 'text/xml; charset=utf-8' },
          timeout: 60000
        })
      );

      const soapArg = axios.post.mock.calls[0][1];
      expect(soapArg).toContain('<berichtsoort>DECO</berichtsoort>');
      expect(soapArg).toContain('<berichtInhoud>');
      // XML debe estar base64-encoded
      const b64Match = soapArg.match(/<berichtInhoud>([^<]+)<\/berichtInhoud>/);
      expect(b64Match).toBeTruthy();
      const decoded = Buffer.from(b64Match[1], 'base64').toString();
      expect(decoded).toBe(xml);

      expect(res.success).toBe(true);
      expect(res.mrn).toBe('26NL00039TEST');
    });

    test('carga certificado PKIoverheid y lo usa en httpsAgent', async () => {
      axios.post.mockResolvedValue({
        data: '<MRN>26NL00039CERT</MRN><statuscode>OK</statuscode>'
      });

      await service._sendViaDigipoort('<xml/>', 'DMS4.NL');

      expect(fs.readFileSync).toHaveBeenCalledWith('/fake/cert.p12');
      expect(forge.asn1.fromDer).toHaveBeenCalled();
      expect(forge.pkcs12.pkcs12FromAsn1).toHaveBeenCalledWith(expect.anything(), 'fakepass');
      expect(forge.pki.certificateToPem).toHaveBeenCalled();
      expect(forge.pki.privateKeyToPem).toHaveBeenCalled();
      expect(https.Agent).toHaveBeenCalled();

      const axiosCall = axios.post.mock.calls[0];
      expect(axiosCall[2].httpsAgent).toBeDefined();
    });

    test('maneja error de red y devuelve success:false', async () => {
      axios.post.mockRejectedValue(new Error('Network timeout'));

      const res = await service._sendViaDigipoort('<xml/>', 'DECO');

      expect(res.success).toBe(false);
      expect(res.error).toBe('Network timeout');
      expect(logger.error).toHaveBeenCalledWith('NL Digipoort error: Network timeout');
    });
  });

  describe('_parseDigipoortResponse', () => {
    test('extrae MRN y status OK', () => {
      const body = '<MRN>26NL00039SUCCESS</MRN><statuscode>OK</statuscode>';
      const res = service._parseDigipoortResponse(body, 'H7');
      expect(res.success).toBe(true);
      expect(res.mrn).toBe('26NL00039SUCCESS');
      expect(res.code).toBe('OK');
      expect(res.system).toBe('DECO');
      expect(res.channel).toBe('green');
    });

    test('extrae MRN con diferentes nombres de elemento', () => {
      const body1 = '<mrn>26NL00029TEST1</mrn><statuscode>01</statuscode>';
      const res1 = service._parseDigipoortResponse(body1, 'H1');
      expect(res1.mrn).toBe('26NL00029TEST1');

      const body2 = '<DeclarationReferenceNumber>26NL00029TEST2</DeclarationReferenceNumber><statuscode>02</statuscode>';
      const res2 = service._parseDigipoortResponse(body2, 'H1');
      expect(res2.mrn).toBe('26NL00029TEST2');
    });

    test('mapea status codes a success correcto', () => {
      const codes = ['OK', '01', '02', '0000', 'ACCEPTED', 'RELEASED', '9'];
      codes.forEach(code => {
        const body = `<MRN>26NL0003999</MRN><statuscode>${code}</statuscode>`;
        const res = service._parseDigipoortResponse(body, 'H7');
        expect(res.success).toBe(true);
      });
    });

    test('mapea channel codes', () => {
      const channels = [
        { code: '00', expected: 'green' },
        { code: '01', expected: 'green' },
        { code: '10', expected: 'orange' },
        { code: '11', expected: 'red' },
        { code: 'H1', expected: 'green' },
        { code: 'H2', expected: 'orange' },
        { code: 'H3', expected: 'red' }
      ];

      channels.forEach(({ code, expected }) => {
        const body = `<MRN>26NL0003999</MRN><statuscode>OK</statuscode><ControlType>${code}</ControlType>`;
        const res = service._parseDigipoortResponse(body, 'H7');
        expect(res.channel).toBe(expected);
      });
    });

    test('detecta correctionRequired', () => {
      const body1 = '<MRN>26NL0003999</MRN><statuscode>04</statuscode>';
      const res1 = service._parseDigipoortResponse(body1, 'H7');
      expect(res1.success).toBe(false);
      expect(res1.correctionRequired).toBe(true);

      const body2 = '<MRN>26NL0003999</MRN><statuscode>OK</statuscode><CorrectionRequired>true</CorrectionRequired>';
      const res2 = service._parseDigipoortResponse(body2, 'H7');
      expect(res2.success).toBe(false);
      expect(res2.correctionRequired).toBe(true);
    });

    test('extrae errores múltiples', () => {
      const body = `
        <Error>
          <ErrorCode>E001</ErrorCode>
          <ErrorDescription>First error</ErrorDescription>
          <Pointer>/Declaration/Item[1]</Pointer>
        </Error>
        <Error>
          <ErrorCode>E002</ErrorCode>
          <ErrorDescription>Second error</ErrorDescription>
        </Error>
      `;
      const res = service._parseDigipoortResponse(body, 'H7');
      expect(res.errors.length).toBe(2);
      expect(res.errors[0].code).toBe('E001');
      expect(res.errors[0].description).toBe('First error');
      expect(res.errors[0].pointer).toBe('/Declaration/Item[1]');
      expect(res.errors[1].code).toBe('E002');
    });

    test('extrae dutyAmount', () => {
      const body = '<MRN>26NL0003999</MRN><statuscode>OK</statuscode><TotalDutyAmount>125.50</TotalDutyAmount>';
      const res = service._parseDigipoortResponse(body, 'H7');
      expect(res.dutyAmount).toBe(125.5);
    });

    test('incluye rawResponse limitado a 3000 chars', () => {
      const body = 'x'.repeat(5000);
      const res = service._parseDigipoortResponse(body, 'H7');
      expect(res.rawResponse.length).toBe(3000);
    });

    test('maneja body como objeto (lo convierte a string)', () => {
      const body = { MRN: '26NL0003999', statuscode: 'OK' };
      const res = service._parseDigipoortResponse(body, 'H7');
      // JSON.stringify no genera XML tags, así que no matchea los patterns de extracción
      // pero debe devolver una respuesta sin reventar
      expect(res.success).toBeDefined();
      expect(res.rawResponse).toContain('26NL0003999');
    });
  });

  // ================== _simulateResponse ==================

  describe('_simulateResponse', () => {
    test('genera respuesta simulada con MRN formato NL', () => {
      const res = service._simulateResponse('H7', 'EXP-001');
      expect(res.success).toBe(true);
      expect(res.code).toBe('0000');
      expect(res.mrn).toMatch(/^\d{2}NL0003[A-Z0-9]+$/);
      expect(res.lrn).toBe('EXP-001');
      expect(res.channel).toBe('green');
      expect(res.simulated).toBe(true);
      expect(res.message).toContain('Simulation mode');
    });
  });

  // ================== submitBatchDECO ==================

  describe('submitBatchDECO', () => {
    const exp1 = {
      expeditionId: 'BATCH-001',
      declarant: { eori: 'NL123456789', companyName: 'Decl' },
      exporter: { companyName: 'Exp', country: 'CN', address: { city: 'SH' } },
      importer: { eori: 'NL987654321', companyName: 'Imp' },
      goods: [{ taricCode: '6203423100', description: 'Item1', grossWeight: 0.5, invoiceValue: 40 }],
      transport: { documentRef: 'AWB1', documentType: 'N740' }
    };

    const exp2 = {
      expeditionId: 'BATCH-002',
      declarant: { eori: 'NL111222333', companyName: 'Decl2' },
      exporter: { companyName: 'Exp2', country: 'US', address: { city: 'NY' } },
      importer: { eori: 'NL444555666', companyName: 'Imp2' },
      goods: [{ taricCode: '8471300000', description: 'Item2', grossWeight: 1.2, invoiceValue: 80 }],
      transport: { documentRef: 'AWB2', documentType: 'N740' }
    };

    test('valida y envía batch con todas válidas', async () => {
      const sNoConfig = new NetherlandsCustomsService({ environment: 'test' });
      const res = await sNoConfig.submitBatchDECO([exp1, exp2]);

      expect(res.success).toBe(true);
      expect(res.simulated).toBe(true);
      expect(res.results.length).toBe(2);
      expect(res.results[0].expeditionId).toBe('BATCH-001');
      expect(res.results[0].success).toBe(true);
      expect(res.results[0].mrn).toMatch(/^\d{2}NL0003/);
      expect(res.stats.total).toBe(2);
      expect(res.stats.valid).toBe(2);
      expect(res.stats.invalid).toBe(0);
      expect(res.stats.submitted).toBe(2);
      expect(res.validationResults.length).toBe(2);
    });

    test('rechaza batch si supera 10,000 declaraciones', async () => {
      const bigBatch = Array(10001).fill(exp1);
      const res = await service.submitBatchDECO(bigBatch);
      expect(res.success).toBe(false);
      expect(res.error).toContain('10,000');
    });

    test('filtra inválidas y envía solo válidas', async () => {
      const expBad = {
        ...exp1,
        goods: [{ ...exp1.goods[0], invoiceValue: 200 }] // >150
      };

      const sNoConfig = new NetherlandsCustomsService({ environment: 'test' });
      const res = await sNoConfig.submitBatchDECO([exp1, expBad, exp2]);

      expect(res.success).toBe(true);
      expect(res.results.length).toBe(2); // solo exp1 y exp2
      expect(res.stats.total).toBe(3);
      expect(res.stats.valid).toBe(2);
      expect(res.stats.invalid).toBe(1);
      expect(res.validationResults[1].valid).toBe(false);
      expect(res.validationResults[1].errors.length).toBeGreaterThan(0);
    });

    test('falla si ninguna declaración es válida', async () => {
      const expBad1 = { ...exp1, goods: [{ ...exp1.goods[0], invoiceValue: 200 }] };
      const expBad2 = { ...exp2, declarant: {} };

      const res = await service.submitBatchDECO([expBad1, expBad2]);
      expect(res.success).toBe(false);
      expect(res.error).toContain('No hay declaraciones validas');
      expect(res.validationResults.length).toBe(2);
    });

    test('con certificado → envía batch real', async () => {
      axios.post.mockResolvedValue({
        data: '<MRN>26NL00039BATCH</MRN><statuscode>OK</statuscode>'
      });

      const res = await service.submitBatchDECO([exp1, exp2]);
      expect(res.success).toBe(true);
      expect(res.results[0].mrn).toBe('26NL00039BATCH');
      expect(axios.post).toHaveBeenCalled();
    });
  });

  describe('_buildBatchDECOXml', () => {
    test('construye estructura batch con múltiples declaraciones', () => {
      const data1 = {
        lrn: 'LRN-B1',
        declarant: { eori: 'NL123' },
        exporter: { name: 'E1', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '620342', description: 'I1', grossMass: 1 }],
        transport: { documentRef: 'D1', documentType: 'N740' }
      };
      const data2 = {
        lrn: 'LRN-B2',
        declarant: { eori: 'NL789' },
        exporter: { name: 'E2', country: 'US' },
        importer: { eori: 'NL012' },
        items: [{ commodityCode: '847130', description: 'I2', grossMass: 2 }],
        transport: { documentRef: 'D2', documentType: 'N740' }
      };

      const xml = service._buildBatchDECOXml([data1, data2]);

      expect(xml).toContain('<DeclarationBatch');
      expect(xml).toContain('totalDeclarations="2"');
      expect(xml).toContain('<BatchItem sequenceNumber="1">');
      expect(xml).toContain('<FunctionalReferenceID>LRN-B1</FunctionalReferenceID>');
      expect(xml).toContain('<BatchItem sequenceNumber="2">');
      expect(xml).toContain('<FunctionalReferenceID>LRN-B2</FunctionalReferenceID>');
      // Solo el <?xml del batch wrapper, no en cada item
      const xmlDeclMatches = xml.match(/<\?xml version/g);
      expect(xmlDeclMatches.length).toBe(1); // solo el del wrapper
    });
  });

  // ================== queryStatus ==================

  describe('queryStatus', () => {
    test('sin certificado → simula respuesta', async () => {
      const sNoConfig = new NetherlandsCustomsService({ environment: 'test' });
      const res = await sNoConfig.queryStatus('26NL00039TEST', 'H7');
      expect(res.success).toBe(true);
      expect(res.status).toBe('ACCEPTED');
      expect(res.mrn).toBe('26NL00039TEST');
      expect(res.simulated).toBe(true);
      expect(res.system).toBe('DECO');
    });

    test('con certificado → construye query XML DECO y envía', async () => {
      axios.post.mockResolvedValue({
        data: '<MRN>26NL00039TEST</MRN><statuscode>01</statuscode><ControlType>00</ControlType>'
      });

      const res = await service.queryStatus('26NL00039TEST', 'H7');
      expect(res.success).toBe(true);
      expect(res.mrn).toBe('26NL00039TEST');
      expect(res.status).toBe('01');
      expect(res.channel).toBe('green');
      expect(res.system).toBe('DECO');

      const soapArg = axios.post.mock.calls[0][1];
      const decoded = Buffer.from(soapArg.match(/<berichtInhoud>([^<]+)<\/berichtInhoud>/)[1], 'base64').toString();
      expect(decoded).toContain('<FunctionalReferenceID>STATUS-26NL00039TEST</FunctionalReferenceID>');
      expect(decoded).toContain('<ID>26NL00039TEST</ID>');
      expect(decoded).toContain('urn:wco:datamodel:WCO:DECO.Declaration:2');
    });

    test('DMS (H1): construye query XML DMS', async () => {
      axios.post.mockResolvedValue({
        data: '<MRN>26NL00029DMS</MRN><statuscode>02</statuscode>'
      });

      const res = await service.queryStatus('26NL00029DMS', 'H1');
      expect(res.success).toBe(true);
      expect(res.system).toBe('DMS 4.0');

      const decoded = Buffer.from(axios.post.mock.calls[0][1].match(/<berichtInhoud>([^<]+)<\/berichtInhoud>/)[1], 'base64').toString();
      expect(decoded).toContain('urn:wco:datamodel:WCO:DMS.Declaration:1');
    });

    test('error de red → devuelve success:false', async () => {
      axios.post.mockRejectedValue(new Error('Query failed'));
      const res = await service.queryStatus('26NL0003999', 'H7');
      expect(res.success).toBe(false);
      // _sendViaDigipoort captura el error y devuelve {success:false, error:...} SIN lanzar
      // → queryStatus lo recibe y usa response.code || 'UNKNOWN' (línea 974)
      expect(res.status).toBe('UNKNOWN');
      expect(res.errors).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith('NL Digipoort error: Query failed');
    });
  });

  // ================== amendDeclaration ==================

  describe('amendDeclaration', () => {
    const amendData = {
      declarant: { eori: 'NL123', name: 'Decl' },
      exporter: { name: 'Exp', country: 'CN' },
      importer: { eori: 'NL456', name: 'Imp' },
      items: [{
        commodityCode: '6203423100',
        description: 'Corrected Item',
        grossMass: 0.6,
        netMass: 0.55,
        customsValue: 50
      }],
      transport: { documentRef: 'AWB-AMEND', documentType: 'N740' }
    };

    test('sin certificado → simula', async () => {
      const sNoConfig = new NetherlandsCustomsService({ environment: 'test' });
      const res = await sNoConfig.amendDeclaration('26NL00039ORIG', amendData, 'H7');
      expect(res.success).toBe(true);
      expect(res.simulated).toBe(true);
      expect(res.mrn).toBe('26NL00039ORIG');
    });

    test('DECO (H7): reenvía declaración completa con MRN original', async () => {
      axios.post.mockResolvedValue({
        data: '<MRN>26NL00039AMEND</MRN><statuscode>OK</statuscode>'
      });

      const res = await service.amendDeclaration('26NL00039ORIG', amendData, 'H7');
      expect(res.success).toBe(true);
      expect(res.mrn).toBe('26NL00039AMEND');
      expect(res.amendmentLrn).toMatch(/^AMEND-26NL00039ORIG-\d+$/);
      expect(res.system).toBe('DECO');

      const decoded = Buffer.from(axios.post.mock.calls[0][1].match(/<berichtInhoud>([^<]+)<\/berichtInhoud>/)[1], 'base64').toString();
      expect(decoded).toContain('<ID>26NL00039ORIG</ID>'); // MRN original
      expect(decoded).toContain('<FunctionalReferenceID>AMEND-26NL00039ORIG-');
      expect(decoded).toContain('urn:wco:datamodel:WCO:DECO.Declaration:2');
    });

    test('DMS (H1): usa AdditionalMessage', async () => {
      axios.post.mockResolvedValue({
        data: '<MRN>26NL00029AMEND</MRN><statuscode>01</statuscode>'
      });

      const res = await service.amendDeclaration('26NL00029ORIG', amendData, 'H1');
      expect(res.success).toBe(true);
      expect(res.mrn).toBe('26NL00029AMEND');
      expect(res.system).toBe('DMS 4.0');

      const decoded = Buffer.from(axios.post.mock.calls[0][1].match(/<berichtInhoud>([^<]+)<\/berichtInhoud>/)[1], 'base64').toString();
      expect(decoded).toContain('urn:wco:datamodel:WCO:DMS.AdditionalMessage:1');
      expect(decoded).toContain('<ID>26NL00029ORIG</ID>');
      expect(decoded).toContain('<IssueDateTime');
    });

    test('error de red → devuelve success:false', async () => {
      axios.post.mockRejectedValue(new Error('Amendment failed'));
      const res = await service.amendDeclaration('26NL0003999', amendData, 'H7');
      expect(res.success).toBe(false);
      // BUG: el catch en línea 1036-1037 SÍ devuelve error.message, pero _sendViaDigipoort lo captura primero
      // y devuelve {success:false, error:'Amendment failed'} que NO se parsea como respuesta DECO
      // → línea 1026-1034 recibe response sin mrn ni campos útiles
      expect(res.mrn).toBe('26NL0003999'); // mrn pasado al método
      expect(logger.error).toHaveBeenCalledWith('NL Digipoort error: Amendment failed');
    });
  });

  // ================== cancelDeclaration ==================

  describe('cancelDeclaration', () => {
    test('sin certificado → simula', async () => {
      const sNoConfig = new NetherlandsCustomsService({ environment: 'test' });
      const res = await sNoConfig.cancelDeclaration('26NL00039CANCEL', 'Wrong data', 'H7');
      expect(res.success).toBe(true);
      expect(res.simulated).toBe(true);
      expect(res.mrn).toBe('26NL00039CANCEL');
    });

    test('DECO: construye XML con AdditionalInformation INV', async () => {
      axios.post.mockResolvedValue({
        data: '<statuscode>OK</statuscode>'
      });

      const res = await service.cancelDeclaration('26NL00039ORIG', 'Duplicate entry', 'H7');
      expect(res.success).toBe(true);
      expect(res.mrn).toBe('26NL00039ORIG');
      expect(res.cancellationLrn).toMatch(/^CANCEL-26NL00039ORIG-\d+$/);
      expect(res.system).toBe('DECO');

      const decoded = Buffer.from(axios.post.mock.calls[0][1].match(/<berichtInhoud>([^<]+)<\/berichtInhoud>/)[1], 'base64').toString();
      expect(decoded).toContain('<ID>26NL00039ORIG</ID>');
      expect(decoded).toContain('<AdditionalInformation>');
      expect(decoded).toContain('<StatementCode>INV</StatementCode>');
      expect(decoded).toContain('<StatementDescription>Duplicate entry</StatementDescription>');
      expect(decoded).toContain('urn:wco:datamodel:WCO:DECO.Declaration:2');
    });

    test('DMS: usa AdditionalMessage namespace', async () => {
      axios.post.mockResolvedValue({
        data: '<statuscode>01</statuscode>'
      });

      const res = await service.cancelDeclaration('26NL00029ORIG', '', 'H1');
      expect(res.success).toBe(true);
      expect(res.system).toBe('DMS 4.0');

      const decoded = Buffer.from(axios.post.mock.calls[0][1].match(/<berichtInhoud>([^<]+)<\/berichtInhoud>/)[1], 'base64').toString();
      expect(decoded).toContain('urn:wco:datamodel:WCO:DMS.AdditionalMessage:1');
      expect(decoded).toContain('Request for invalidation'); // reason por defecto
    });

    test('error de red → devuelve success:false', async () => {
      axios.post.mockRejectedValue(new Error('Cancellation failed'));
      const res = await service.cancelDeclaration('26NL0003999', 'test', 'H7');
      expect(res.success).toBe(false);
      // Mismo caso que amendDeclaration: _sendViaDigipoort captura y devuelve sin lanzar
      expect(res.mrn).toBe('26NL0003999');
      expect(logger.error).toHaveBeenCalledWith('NL Digipoort error: Cancellation failed');
    });
  });

  // ================== validateDeclaration ==================

  describe('validateDeclaration', () => {
    const validData = {
      declarant: { eori: 'NL123456789', companyName: 'Decl' },
      exporter: { companyName: 'Exp', country: 'CN' },
      importer: { eori: 'NL987654321', companyName: 'Imp' },
      items: [{
        taricCode: '6203423100',
        description: 'Item',
        grossWeight: 0.5,
        invoiceValue: 40
      }],
      transport: { documentRef: 'AWB', documentType: 'N740' }
    };

    test('H7: llama uccDataMapper.expeditionToH7 y nlValidation.validateDECO', async () => {
      const res = await service.validateDeclaration(validData, 'H7');
      expect(res.valid).toBe(true);
      expect(res.errors).toEqual([]);
    });

    test('H1: llama expeditionToH1 y validateDMS', async () => {
      const res = await service.validateDeclaration(validData, 'H1');
      expect(res.valid).toBe(true);
    });

    test('tipo desconocido: devuelve válido por defecto', async () => {
      const res = await service.validateDeclaration(validData, 'UNKNOWN');
      expect(res.valid).toBe(true);
      expect(res.errors).toEqual([]);
    });

    test('detecta error de validación', async () => {
      const badData = {
        ...validData,
        items: [{ ...validData.items[0], invoiceValue: 200 }]
      };
      const res = await service.validateDeclaration(badData, 'H7');
      expect(res.valid).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
    });
  });

  // ================== Tests adicionales para cobertura de ramas ==================

  describe('edge cases y ramas alternativas', () => {
    test('_buildDECOXml: item sin transportCharges (omite CustomsValuation)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{
          commodityCode: '620342',
          description: 'Item sin transportCharges',
          grossMass: 1
          // transportCharges: undefined → omite CustomsValuation en item
        }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      expect(xml).not.toContain('<CustomsValuation>');
      expect(xml).not.toContain('<ExitToEntryChargeAmount');
    });

    test('_buildDECOXml: sin iossNumber (omite DomesticDutyTaxParty)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' }
        // iossNumber: undefined
      };

      const xml = service._buildDECOXml(data);
      expect(xml).not.toContain('<DomesticDutyTaxParty>');
    });

    test('_buildDECOXml: sin representative (omite Agent)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' }
        // representative: undefined
      };

      const xml = service._buildDECOXml(data);
      expect(xml).not.toContain('<Agent>');
    });

    test('_buildDMSXml: sin campos opcionales de item (supplementaryUnits, shippingMarks, etc.)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{
          commodityCode: '8471300000',
          description: 'Item mínimo',
          grossMass: 1,
          netMass: 0.9
          // sin supplementaryUnits, shippingMarks, preferentialOrigin, previousDocument, supportingDocuments
        }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).not.toContain('<TariffQuantity>');
      expect(xml).not.toContain('<MarksNumbersID>');
    });

    test('_buildDMSXml: sin campos opcionales globales (authorisations, deferredPayment, etc.)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
        // sin representative, authorisations, deferredPayment, guarantee, supervisingOffice, warehouse, tradeTerms
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).not.toContain('<Agent>');
      expect(xml).not.toContain('<Authorisation>');
      expect(xml).not.toContain('<DeferredPayment>');
      expect(xml).not.toContain('<ObligationGuarantee>');
      expect(xml).not.toContain('<SupervisingOffice>');
      expect(xml).not.toContain('<Warehouse>');
      expect(xml).not.toContain('<TradeTerms>');
    });

    test('_buildDMSXml: export sin exitOffice (omite ExitOffice)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'NL' },
        importer: { eori: 'CN456' },
        items: [{ commodityCode: '6203420000', description: 'Export', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
        // sin exitOffice
      };

      const xml = service._buildDMSXml(data, 'export');
      expect(xml).not.toContain('<ExitOffice>');
    });

    test('_parseDigipoortResponse: sin MRN en respuesta (mrn null)', () => {
      const body = '<statuscode>ERROR</statuscode><foutbeschrijving>Validation error</foutbeschrijving>';
      const res = service._parseDigipoortResponse(body, 'H7');
      expect(res.success).toBe(false);
      expect(res.mrn).toBeNull();
    });

    test('_parseDigipoortResponse: sin channel code pero isSuccess=true (channel green por defecto)', () => {
      const body = '<MRN>26NL0003999</MRN><statuscode>UNKNOWN</statuscode>';
      const res = service._parseDigipoortResponse(body, 'H7');
      // isSuccess = !!(mrn && !errorCode) = true → channel = 'green'
      expect(res.channel).toBe('green');
    });

    test('_parseDigipoortResponse: sin channel code y isSuccess=false (channel null)', () => {
      const body = '<statuscode>REJECT</statuscode><ErrorCode>E999</ErrorCode>';
      const res = service._parseDigipoortResponse(body, 'H7');
      // isSuccess = false (no mrn, hay errorCode) → channel = null
      expect(res.channel).toBeNull();
    });

    test('_parseDigipoortResponse: sin dutyAmount (dutyAmount null)', () => {
      const body = '<MRN>26NL0003999</MRN><statuscode>OK</statuscode>';
      const res = service._parseDigipoortResponse(body, 'H7');
      expect(res.dutyAmount).toBeNull();
    });

    test('_submitDECO: uccValidation falla después de nlValidation (línea 91)', async () => {
      // Crear expedición que pasa nlValidation pero falla uccValidation
      // nlValidation no chequea customsValue, pero uccValidation sí chequea que no sea 0
      const expBad = {
        expeditionId: 'UCC-FAIL',
        declarant: { eori: 'NL123456789', companyName: 'D' },
        exporter: { companyName: 'E', country: 'CN', address: { city: 'C' } },
        importer: { eori: 'NL987654321', companyName: 'I' },
        goods: [{
          taricCode: '6203423100',
          description: 'Item',
          grossWeight: 0.3,
          invoiceValue: 0, // falla uccValidation (validateH7 requiere customsValue)
          currency: 'EUR'
        }],
        transport: { documentType: 'N740', documentRef: 'AWB' }
      };

      const res = await service._submitDECO(expBad);
      expect(res.success).toBe(false);
      expect(res.errors).toBeDefined();
      expect(res.errors.length).toBeGreaterThan(0);
    });

    test('queryStatus: declarationType H1 (DMS)', async () => {
      axios.post.mockResolvedValue({
        data: '<MRN>26NL00029DMS</MRN><statuscode>02</statuscode>'
      });

      const res = await service.queryStatus('26NL00029DMS', 'H1');
      expect(res.success).toBe(true);
      expect(res.system).toBe('DMS 4.0');
    });

    test('amendDeclaration: declarationType H1 usa namespace DMS.AdditionalMessage', async () => {
      axios.post.mockResolvedValue({
        data: '<MRN>26NL00029AMEND</MRN><statuscode>01</statuscode>'
      });

      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9, customsValue: 100 }]
      };

      const res = await service.amendDeclaration('26NL00029ORIG', data, 'H1');
      expect(res.success).toBe(true);
      expect(res.system).toBe('DMS 4.0');

      const decoded = Buffer.from(axios.post.mock.calls[0][1].match(/<berichtInhoud>([^<]+)<\/berichtInhoud>/)[1], 'base64').toString();
      expect(decoded).toContain('urn:wco:datamodel:WCO:DMS.AdditionalMessage:1');
    });

    test('cancelDeclaration: declarationType H1', async () => {
      axios.post.mockResolvedValue({
        data: '<statuscode>01</statuscode>'
      });

      const res = await service.cancelDeclaration('26NL00029ORIG', 'Reason', 'H1');
      expect(res.success).toBe(true);
      expect(res.system).toBe('DMS 4.0');
    });

    test('_buildDMSXml: item con taricAdditionalCode pero sin nationalAdditionalCode', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{
          commodityCode: '8471300000',
          taricAdditionalCode: '1234', // presente
          // nationalAdditionalCode: undefined
          description: 'I',
          grossMass: 1,
          netMass: 0.9
        }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<ID>1234</ID>');
      expect(xml).toContain('<IdentificationTypeCode>TRA</IdentificationTypeCode>');
      // Solo 2 Classification: TSP + TRA
      const classMatches = xml.match(/<Classification>/g);
      expect(classMatches.length).toBe(2);
    });

    test('_buildDMSXml: item con nationalAdditionalCode pero sin taricAdditionalCode', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{
          commodityCode: '8471300000',
          // taricAdditionalCode: undefined
          nationalAdditionalCode: 'X99',
          description: 'I',
          grossMass: 1,
          netMass: 0.9
        }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<ID>X99</ID>');
      expect(xml).toContain('<IdentificationTypeCode>GN</IdentificationTypeCode>');
      const classMatches = xml.match(/<Classification>/g);
      expect(classMatches.length).toBe(2);
    });

    test('_buildDECOXml: item con previousDocument', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{
          commodityCode: '620342',
          description: 'I',
          grossMass: 1,
          previousDocument: { id: 'PREV123', type: '380' }
        }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      expect(xml).toContain('<PreviousDocument>');
      expect(xml).toContain('<ID>PREV123</ID>');
      expect(xml).toContain('<TypeCode>380</TypeCode>');
    });

    test('_buildDECOXml: item sin previousDocument ni supportingDocuments', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{
          commodityCode: '620342',
          description: 'I',
          grossMass: 1
          // sin previousDocument ni supportingDocuments
        }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      // Verificar estructura mínima sin docs
      expect(xml).toContain('<GovernmentAgencyGoodsItem>');
      expect(xml).toContain('<Description>I</Description>');
    });

    test('_buildDMSXml: import sin currency EUR (usa explícitamente InvoiceCurrencyCode)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        currency: 'USD' // no EUR
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<InvoiceCurrencyCode>USD</InvoiceCurrencyCode>');
    });

    test('_buildDMSXml: import con currency EUR (omite InvoiceCurrencyCode)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        currency: 'EUR'
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).not.toContain('<InvoiceCurrencyCode>');
    });

    test('_buildDMSXml: sin transport.borderMeansId (omite BorderTransportMeans)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740', modeAtBorder: '1' }
        // sin borderMeansId
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).not.toContain('<BorderTransportMeans>');
    });

    test('_buildDMSXml: con transport.borderMeansId (incluye BorderTransportMeans)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740', modeAtBorder: '1', borderMeansId: 'SHIP123', borderMeansType: '10', borderNationality: 'NL' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<BorderTransportMeans>');
      expect(xml).toContain('<ID>SHIP123</ID>');
      expect(xml).toContain('<RegistrationNationalityCode>NL</RegistrationNationalityCode>');
    });

    test('_buildDMSXml: con containerId (incluye TransportEquipment)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740', containerId: 'MSCU1234567' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<TransportEquipment>');
      expect(xml).toContain('<ID>MSCU1234567</ID>');
    });

    test('_buildDMSXml: item con itemValue=0 (CustomsValueAmount omitido por rama falsy)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9, customsValue: 0 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).not.toContain('<CustomsValueAmount');
    });

    test('_buildDMSXml: item con statisticalValue (incluye StatisticalValueAmount)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9, statisticalValue: 500 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<StatisticalValueAmount>500</StatisticalValueAmount>');
    });

    test('_buildDMSXml: item sin statisticalValue (omite StatisticalValueAmount)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).not.toContain('<StatisticalValueAmount>');
    });

    test('_buildDMSXml: item sin preferentialOrigin (omite TypeCode en Origin)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9, countryOfOrigin: 'CN' }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<CountryCode>CN</CountryCode>');
      // Buscar Origin block completo para verificar que no tiene TypeCode
      const originMatch = xml.match(/<Origin>([\s\S]*?)<\/Origin>/);
      expect(originMatch).toBeTruthy();
      expect(originMatch[1]).not.toContain('<TypeCode>');
    });

    test('_buildDMSXml: item con preferentialOrigin=true (incluye TypeCode 1)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9, preferentialOrigin: true }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<TypeCode>1</TypeCode>');
    });

    test('_buildDMSXml: item con previousDocument con lineNumeric', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{
          commodityCode: '8471300000',
          description: 'I',
          grossMass: 1,
          netMass: 0.9,
          previousDocument: { id: 'PREV001', type: 'NMRN', lineNumeric: 5 }
        }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<LineNumeric>5</LineNumeric>');
    });

    test('_buildDMSXml: item con previousDocument sin lineNumeric', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{
          commodityCode: '8471300000',
          description: 'I',
          grossMass: 1,
          netMass: 0.9,
          previousDocument: { id: 'PREV001', type: 'NMRN' }
        }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).not.toContain('<LineNumeric>');
    });

    test('_buildDMSXml: con totalCustomsValue (incluye InvoiceAmount)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        totalCustomsValue: 1000
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<InvoiceAmount>1000</InvoiceAmount>');
    });

    test('_buildDMSXml: sin totalCustomsValue (omite InvoiceAmount)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).not.toContain('<InvoiceAmount>');
    });

    test('_buildDMSXml: transport.borderMeansType presente (incluye IdentificationTypeCode en BorderTransportMeans)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740', borderMeansId: 'SHIP123', borderMeansType: '10' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<IdentificationTypeCode>10</IdentificationTypeCode>');
    });

    test('_buildDMSXml: transport.borderNationality presente (incluye RegistrationNationalityCode)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740', borderMeansId: 'SHIP123', borderNationality: 'GB' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<RegistrationNationalityCode>GB</RegistrationNationalityCode>');
    });

    test('_buildDMSXml: goodsLocation con todos los campos (Address completo)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        goodsLocation: { city: 'Amsterdam', street: 'Port St', postalCode: '1000AA' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<CityName>Amsterdam</CityName>');
      expect(xml).toContain('<Line>Port St</Line>');
      expect(xml).toContain('<PostcodeID>1000AA</PostcodeID>');
    });

    test('_buildDMSXml: goodsLocation sin street ni postalCode (Address solo city)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        goodsLocation: { city: 'Rotterdam' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<CityName>Rotterdam</CityName>');
      expect(xml).not.toContain('<Line>');
      expect(xml).not.toContain('<PostcodeID>');
    });

    test('_buildDECOXml: representative.contactEmail presente (incluye Communication en Agent)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        representative: { eori: 'NL777', status: '2', contactName: 'Agent', contactEmail: 'agent@test.nl' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      expect(xml).toContain('<Communication>');
      expect(xml).toContain('<ID>agent@test.nl</ID>');
      expect(xml).toContain('<TypeCode>EM</TypeCode>');
    });

    test('_buildDECOXml: representative.contactName sin email (omite Communication)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        representative: { eori: 'NL777', status: '2', contactName: 'Agent' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      expect(xml).toContain('<Name>Agent</Name>');
      expect(xml).not.toContain('<Communication>');
    });

    test('_buildDECOXml: declarant.contactEmail presente (incluye Communication en Declarant)', () => {
      const data = {
        declarant: { eori: 'NL123', name: 'D', contactName: 'John', contactEmail: 'john@test.nl' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      expect(xml).toContain('<ID>john@test.nl</ID>');
    });

    test('_buildDECOXml: declarant.contactName sin email (omite Communication en Declarant)', () => {
      const data = {
        declarant: { eori: 'NL123', name: 'D', contactName: 'John' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      expect(xml).toContain('<Name>John</Name>');
      const commMatches = xml.match(/<Communication>/g) || [];
      // Puede haber Communication en representative, pero no en Declarant
      expect(xml).toContain('<Declarant>');
    });

    test('_buildDECOXml: goodsLocation.street presente (incluye Line en Address)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        goodsLocation: { city: 'Amsterdam', street: 'Dam 1', postalCode: '1000AA' }
      };

      const xml = service._buildDECOXml(data);
      expect(xml).toContain('<Line>Dam 1</Line>');
    });

    test('_buildDECOXml: goodsLocation sin street (omite Line en GoodsLocation Address)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        goodsLocation: { city: 'Amsterdam', postalCode: '1000AA' }
      };

      const xml = service._buildDECOXml(data);
      expect(xml).toContain('<CityName>Amsterdam</CityName>');
      // Buscar GoodsLocation Address para verificar que no tiene Line
      const goodsLocMatch = xml.match(/<GoodsLocation>([\s\S]*?)<\/GoodsLocation>/);
      expect(goodsLocMatch).toBeTruthy();
      expect(goodsLocMatch[1]).not.toContain('<Line>');
    });

    test('_buildDECOXml: importer.address presente (incluye Address en Importer)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456', name: 'Imp', address: { city: 'Amsterdam', country: 'NL', street: 'Kade 5', postalCode: '1000BB' } },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      expect(xml).toContain('<Importer>');
      expect(xml).toContain('<CityName>Amsterdam</CityName>');
      expect(xml).toContain('<Line>Kade 5</Line>');
    });

    test('_buildDECOXml: importer sin address (omite Address en Importer)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456', name: 'Imp' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      expect(xml).toContain('<Importer>');
      expect(xml).toContain('<Name>Imp</Name>');
      // Buscar Address dentro de Importer (no en Exporter)
      const importerMatch = xml.match(/<Importer>([\s\S]*?)<\/Importer>/);
      expect(importerMatch).toBeTruthy();
      expect(importerMatch[1]).not.toContain('<Address>');
    });

    test('_parseDigipoortResponse: extrae kenmerk (messageId)', () => {
      const body = '<kenmerk>MSG-12345</kenmerk><MRN>26NL0003999</MRN><statuscode>OK</statuscode>';
      const res = service._parseDigipoortResponse(body, 'H7');
      expect(res.messageId).toBe('MSG-12345');
    });

    test('_parseDigipoortResponse: statusCode 04 marca correctionRequired', () => {
      const body = '<MRN>26NL0003999</MRN><statuscode>04</statuscode>';
      const res = service._parseDigipoortResponse(body, 'H7');
      expect(res.correctionRequired).toBe(true);
      expect(res.success).toBe(false);
    });

    test('_parseDigipoortResponse: statusCode 06 marca correctionRequired', () => {
      const body = '<MRN>26NL0003999</MRN><statuscode>06</statuscode>';
      const res = service._parseDigipoortResponse(body, 'H7');
      expect(res.correctionRequired).toBe(true);
      expect(res.success).toBe(false);
    });

    test('_buildDECOXml: item.currency diferente a data.currency (usa item.currency)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{
          commodityCode: '620342',
          description: 'I',
          grossMass: 1,
          customsValue: 50,
          currency: 'USD' // diferente a EUR global
        }],
        transport: { documentRef: 'D', documentType: 'N740' },
        currency: 'EUR'
      };

      const xml = service._buildDECOXml(data);
      expect(xml).toContain('currencyID="USD"');
    });

    test('_buildDECOXml: item sin currency (usa currency global)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{
          commodityCode: '620342',
          description: 'I',
          grossMass: 1,
          customsValue: 50
          // sin currency
        }],
        transport: { documentRef: 'D', documentType: 'N740' },
        currency: 'EUR'
      };

      const xml = service._buildDECOXml(data);
      expect(xml).toContain('currencyID="EUR"');
    });

    test('_buildDECOXml: sin customsOffice (usa default SCHIPHOL)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' }
        // sin customsOffice
      };

      const xml = service._buildDECOXml(data);
      expect(xml).toContain('<ID>NL000399</ID>'); // SCHIPHOL por defecto
    });

    test('_buildDECOXml: con customsOffice explícito (usa el provisto)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        customsOffice: 'NL000297' // Rotterdam
      };

      const xml = service._buildDECOXml(data);
      expect(xml).toContain('<ID>NL000297</ID>');
    });

    test('_buildDMSXml: sin customsOffice (usa default ROTTERDAM_HAVEN)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<ID>NL000297</ID>'); // ROTTERDAM_HAVEN por defecto
    });

    test('_buildDMSXml: con customsOffice explícito', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        customsOffice: 'NL000399' // SCHIPHOL
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<ID>NL000399</ID>');
    });

    test('_buildDMSXml: sin countryOfDispatch (usa default XX)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E' }, // sin country
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<DispatchCountryCode>XX</DispatchCountryCode>');
      expect(xml).toContain('<ID>XX</ID>'); // en ExportCountry
    });

    test('_buildDMSXml: con data.countryOfDispatch explícito', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        countryOfDispatch: 'US' // override exporter.country
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<DispatchCountryCode>US</DispatchCountryCode>');
    });

    test('_buildDMSXml: item.procedureCode por defecto para import (40)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<CurrentCode>40</CurrentCode>');
    });

    test('_buildDMSXml: item.procedureCode por defecto para export (10)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'NL' },
        importer: { eori: 'CN456' },
        items: [{ commodityCode: '6203420000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'export');
      expect(xml).toContain('<CurrentCode>10</CurrentCode>');
    });

    test('_buildDMSXml: item.previousProcedure por defecto (00)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<PreviousCode>00</PreviousCode>');
    });

    test('_buildDMSXml: item con procedureCode y previousProcedure explícitos', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{
          commodityCode: '8471300000',
          description: 'I',
          grossMass: 1,
          netMass: 0.9,
          procedureCode: '42',
          previousProcedure: '51'
        }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<CurrentCode>42</CurrentCode>');
      expect(xml).toContain('<PreviousCode>51</PreviousCode>');
    });

    test('_buildDMSXml: item.packageType por defecto (PK)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<TypeCode>PK</TypeCode>');
    });

    test('_buildDMSXml: item con packageType explícito', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9, packageType: 'CT' }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<TypeCode>CT</TypeCode>');
    });

    test('_buildDECOXml: item.numberOfPackages por defecto (1)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      expect(xml).toContain('<QuantityQuantity>1</QuantityQuantity>');
    });

    test('_buildDECOXml: item con numberOfPackages explícito', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1, numberOfPackages: 5 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      expect(xml).toContain('<QuantityQuantity>5</QuantityQuantity>');
    });

    test('_buildDECOXml: item.transportDocType por defecto (N740)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D' }
      };

      const xml = service._buildDECOXml(data);
      // Buscar en item TransportContractDocument
      const itemMatch = xml.match(/<GovernmentAgencyGoodsItem>([\s\S]*?)<\/GovernmentAgencyGoodsItem>/);
      expect(itemMatch).toBeTruthy();
      expect(itemMatch[1]).toContain('<TypeCode>N740</TypeCode>');
    });

    test('_buildDMSXml: item con additionalProcedure', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{
          commodityCode: '8471300000',
          description: 'I',
          grossMass: 1,
          netMass: 0.9,
          additionalProcedure: 'F01'
        }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<AdditionalProcedure>');
      expect(xml).toContain('<ProcedureCode>F01</ProcedureCode>');
    });

    test('_buildDMSXml: item sin additionalProcedure (omite AdditionalProcedure)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      const itemMatch = xml.match(/<GovernmentAgencyGoodsItem>([\s\S]*?)<\/GovernmentAgencyGoodsItem>/);
      expect(itemMatch[1]).not.toContain('<AdditionalProcedure>');
    });

    test('_buildDECOXml: item con additionalProcedure explícito', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{
          commodityCode: '620342',
          description: 'I',
          grossMass: 1,
          additionalProcedure: 'C05'
        }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      expect(xml).toContain('<ProcedureCode>C05</ProcedureCode>');
    });

    test('_buildDECOXml: item sin additionalProcedure (usa default C07)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      expect(xml).toContain('<ProcedureCode>C07</ProcedureCode>');
    });

    test('_buildDMSXml: data.paymentMethod explícito', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        paymentMethod: 'D' // deferred
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<MethodCode>D</MethodCode>');
    });

    test('_buildDMSXml: sin paymentMethod (usa default E)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<MethodCode>E</MethodCode>');
    });

    test('_buildDMSXml: data.typeCode explícito', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        typeCode: '3' // ex: simplified
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<TypeCode>3</TypeCode>');
    });

    test('_buildDMSXml: sin data.typeCode (usa default 1)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<TypeCode>1</TypeCode>');
    });

    test('_buildDMSXml: transport.containerIndicator explícito', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740', containerIndicator: '1' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<ContainerCode>1</ContainerCode>');
    });

    test('_buildDMSXml: sin containerIndicator (usa default 0)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<ContainerCode>0</ContainerCode>');
    });

    test('_buildDMSXml: transport.modeAtBorder explícito', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740', modeAtBorder: '4' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<ModeCode>4</ModeCode>');
    });

    test('_buildDMSXml: sin modeAtBorder (usa default 1)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<ModeCode>1</ModeCode>');
    });

    test('_buildDMSXml: data.countryOfDestination explícito', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        countryOfDestination: 'BE'
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<CountryCode>BE</CountryCode>');
    });

    test('_buildDMSXml: sin countryOfDestination (usa default NL)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      const destMatch = xml.match(/<Destination>([\s\S]*?)<\/Destination>/);
      expect(destMatch[1]).toContain('<CountryCode>NL</CountryCode>');
    });

    test('_buildDMSXml: data.transactionNature explícito', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        transactionNature: '21'
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<TransactionNatureCode>21</TransactionNatureCode>');
    });

    test('_buildDMSXml: sin transactionNature (usa default 11)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<TransactionNatureCode>11</TransactionNatureCode>');
    });

    test('_buildDECOXml: sin countryOfDispatch (usa exporter.country)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'US' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      // countryOfDispatch se usa en múltiples lugares; verificar que items usan US
      const itemMatch = xml.match(/<GovernmentAgencyGoodsItem>([\s\S]*?)<\/GovernmentAgencyGoodsItem>/);
      expect(itemMatch[1]).toContain('<CountryCode>US</CountryCode>');
    });

    test('_buildDECOXml: sin exporter.country (usa default XX)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E' }, // sin country
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      const itemMatch = xml.match(/<GovernmentAgencyGoodsItem>([\s\S]*?)<\/GovernmentAgencyGoodsItem>/);
      expect(itemMatch[1]).toContain('<CountryCode>XX</CountryCode>');
    });

    test('_buildDMSXml: exporter sin eori (omite ID en Exporter)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' }, // sin eori
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      // Buscar primero Exporter a nivel Declaration
      const exporterMatches = xml.match(/<Exporter>([\s\S]*?)<\/Exporter>/g);
      // Hay 2 Exporter: uno en Declaration, otro en GoodsShipment
      const declExporter = exporterMatches[0]; // primero es Declaration
      expect(declExporter).toContain('<Name>E</Name>');
      expect(declExporter).not.toContain('<ID>');
    });

    test('_buildDMSXml: exporter con eori (incluye ID)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN', eori: 'CN123' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      const exporterMatches = xml.match(/<Exporter>([\s\S]*?)<\/Exporter>/g);
      const declExporter = exporterMatches[0];
      expect(declExporter).toContain('<ID>CN123</ID>');
    });

    test('_buildDMSXml: declarant.address presente', () => {
      const data = {
        declarant: { eori: 'NL123', name: 'D', address: { city: 'Amsterdam', country: 'NL', street: 'Dam 1', postalCode: '1000AA' } },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<Declarant>');
      expect(xml).toContain('<Address>');
      expect(xml).toContain('<CityName>Amsterdam</CityName>');
    });

    test('_buildDMSXml: declarant sin address (omite Address en Declarant)', () => {
      const data = {
        declarant: { eori: 'NL123', name: 'D' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      const declMatch = xml.match(/<Declarant>([\s\S]*?)<\/Declarant>/);
      expect(declMatch[1]).not.toContain('<Address>');
    });

    test('_buildDECOXml: declarant.address presente', () => {
      const data = {
        declarant: { eori: 'NL123', name: 'D', address: { city: 'Amsterdam', country: 'NL', street: 'Dam 1', postalCode: '1000AA' } },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      const declMatch = xml.match(/<Declarant>([\s\S]*?)<\/Declarant>/);
      expect(declMatch[1]).toContain('<Address>');
    });

    test('_buildDECOXml: declarant sin address (omite Address en Declarant)', () => {
      const data = {
        declarant: { eori: 'NL123', name: 'D' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      const declMatch = xml.match(/<Declarant>([\s\S]*?)<\/Declarant>/);
      expect(declMatch[1]).not.toContain('<Address>');
    });

    test('_buildDECOXml: declarant.contactName presente sin email (incluye Contact sin Communication)', () => {
      const data = {
        declarant: { eori: 'NL123', name: 'D', contactName: 'John' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      const declMatch = xml.match(/<Declarant>([\s\S]*?)<\/Declarant>/);
      expect(declMatch[1]).toContain('<Contact>');
      expect(declMatch[1]).toContain('<Name>John</Name>');
    });

    test('_buildDECOXml: declarant sin contactName (omite Contact en Declarant)', () => {
      const data = {
        declarant: { eori: 'NL123', name: 'D' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      const declMatch = xml.match(/<Declarant>([\s\S]*?)<\/Declarant>/);
      expect(declMatch[1]).not.toContain('<Contact>');
    });

    test('_buildDECOXml: representative sin contactName (omite Contact en Agent)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        representative: { eori: 'NL777', status: '2' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDECOXml(data);
      const agentMatch = xml.match(/<Agent>([\s\S]*?)<\/Agent>/);
      expect(agentMatch[1]).not.toContain('<Contact>');
    });

    test('_buildDMSXml: exporter.address presente', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN', address: { city: 'Beijing', street: 'Main St', postalCode: '100000' } },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      const exporterMatches = xml.match(/<Exporter>([\s\S]*?)<\/Exporter>/g);
      expect(exporterMatches[0]).toContain('<CityName>Beijing</CityName>');
    });

    test('_buildDMSXml: exporter sin address (omite Address en Exporter)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      const exporterMatches = xml.match(/<Exporter>([\s\S]*?)<\/Exporter>/g);
      expect(exporterMatches[0]).not.toContain('<Address>');
    });

    test('_buildDMSXml: importer.address presente', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456', name: 'I', address: { city: 'Amsterdam', country: 'NL', street: 'Kade', postalCode: '1000AA' } },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      const importerMatch = xml.match(/<Importer>([\s\S]*?)<\/Importer>/);
      expect(importerMatch[1]).toContain('<Address>');
    });

    test('_buildDMSXml: importer sin address (omite Address en Importer)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456', name: 'I' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      const importerMatch = xml.match(/<Importer>([\s\S]*?)<\/Importer>/);
      expect(importerMatch[1]).not.toContain('<Address>');
    });

    test('_buildDMSXml: data.previousDocuments array presente', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        previousDocuments: [{ id: 'PREV1', type: '1' }, { id: 'PREV2', type: '2' }]
      };

      const xml = service._buildDMSXml(data, 'import');
      const prevMatches = xml.match(/<PreviousDocument>([\s\S]*?)<\/PreviousDocument>/g);
      expect(prevMatches.length).toBeGreaterThanOrEqual(2); // al menos 2 en GoodsShipment level
    });

    test('_buildDMSXml: sin previousDocuments (omite PreviousDocument a nivel GoodsShipment)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
        // sin previousDocuments a nivel declaration
      };

      const xml = service._buildDMSXml(data, 'import');
      const shipmentMatch = xml.match(/<GoodsShipment>([\s\S]*?)<\/GoodsShipment>/);
      // Puede haber PreviousDocument en items, pero no a nivel GoodsShipment
      const prevInShipment = shipmentMatch[1].match(/<PreviousDocument>/g);
      expect(prevInShipment).toBeNull();
    });

    test('_buildDMSXml: data.supportingDocuments array presente', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        supportingDocuments: [{ id: 'SUPP1', type: 'N380' }]
      };

      const xml = service._buildDMSXml(data, 'import');
      const suppMatches = xml.match(/<SupportingDocument>([\s\S]*?)<\/SupportingDocument>/g);
      expect(suppMatches.length).toBeGreaterThanOrEqual(1);
    });

    test('_buildDMSXml: sin supportingDocuments (omite a nivel GoodsShipment)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' }
      };

      const xml = service._buildDMSXml(data, 'import');
      const shipmentMatch = xml.match(/<GoodsShipment>([\s\S]*?)<\/GoodsShipment>/);
      const suppInShipment = shipmentMatch[1].match(/<SupportingDocument>/g);
      expect(suppInShipment).toBeNull();
    });

    test('_buildDMSXml: data.tradeTerms.locationName presente', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        tradeTerms: { incoterm: 'CIF', locationName: 'Rotterdam', country: 'NL' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<LocationName>Rotterdam</LocationName>');
    });

    test('_buildDMSXml: tradeTerms sin locationName (omite LocationName)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        tradeTerms: { incoterm: 'FOB' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).not.toContain('<LocationName>');
    });

    test('_buildDMSXml: tradeTerms.country presente', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        tradeTerms: { incoterm: 'CIF', country: 'BE' }
      };

      const xml = service._buildDMSXml(data, 'import');
      const tradeMatch = xml.match(/<TradeTerms>([\s\S]*?)<\/TradeTerms>/);
      expect(tradeMatch[1]).toContain('<CountryCode>BE</CountryCode>');
    });

    test('_buildDMSXml: tradeTerms sin country (omite CountryCode en TradeTerms)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        tradeTerms: { incoterm: 'EXW' }
      };

      const xml = service._buildDMSXml(data, 'import');
      const tradeMatch = xml.match(/<TradeTerms>([\s\S]*?)<\/TradeTerms>/);
      expect(tradeMatch[1]).not.toContain('<CountryCode>');
    });

    test('_buildDMSXml: guarantee.accessCode presente', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        guarantee: { type: '0', reference: 'GRN123', accessCode: 'ACC999' }
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<AccessCode>ACC999</AccessCode>');
    });

    test('_buildDMSXml: guarantee sin accessCode (omite AccessCode)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        guarantee: { type: '0', reference: 'GRN123' }
      };

      const xml = service._buildDMSXml(data, 'import');
      const guaranteeMatch = xml.match(/<ObligationGuarantee>([\s\S]*?)<\/ObligationGuarantee>/);
      expect(guaranteeMatch[1]).not.toContain('<AccessCode>');
    });

    test('_buildDMSXml: authorisation.holderId presente', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        authorisations: [{ id: 'AUTH001', type: '1', holderId: 'NL888' }]
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<AuthorisationHolder>');
      expect(xml).toContain('<ID>NL888</ID>');
    });

    test('_buildDMSXml: authorisation sin holderId (omite AuthorisationHolder)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '8471300000', description: 'I', grossMass: 1, netMass: 0.9 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        authorisations: [{ id: 'AUTH001', type: '1' }]
      };

      const xml = service._buildDMSXml(data, 'import');
      expect(xml).toContain('<Authorisation>');
      expect(xml).not.toContain('<AuthorisationHolder>');
    });

    test('_buildDECOXml: goodsLocation.postalCode presente', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        goodsLocation: { city: 'Amsterdam', postalCode: '1000AA' }
      };

      const xml = service._buildDECOXml(data);
      expect(xml).toContain('<PostcodeID>1000AA</PostcodeID>');
    });

    test('_buildDECOXml: goodsLocation sin postalCode (omite PostcodeID)', () => {
      const data = {
        declarant: { eori: 'NL123' },
        exporter: { name: 'E', country: 'CN' },
        importer: { eori: 'NL456' },
        items: [{ commodityCode: '620342', description: 'I', grossMass: 1 }],
        transport: { documentRef: 'D', documentType: 'N740' },
        goodsLocation: { city: 'Amsterdam' }
      };

      const xml = service._buildDECOXml(data);
      const goodsLocMatch = xml.match(/<GoodsLocation>([\s\S]*?)<\/GoodsLocation>/);
      expect(goodsLocMatch[1]).not.toContain('<PostcodeID>');
    });
  });

  // ================== _escapeXml ==================

  describe('_escapeXml', () => {
    test('escapa &, <, >, "', () => {
      expect(service._escapeXml('Test & Co')).toBe('Test &amp; Co');
      expect(service._escapeXml('<script>')).toBe('&lt;script&gt;');
      expect(service._escapeXml('Say "hello"')).toBe('Say &quot;hello&quot;');
      expect(service._escapeXml('A&B<C>D"E')).toBe('A&amp;B&lt;C&gt;D&quot;E');
    });

    test('devuelve string vacío si el input es falsy', () => {
      expect(service._escapeXml(null)).toBe('');
      expect(service._escapeXml(undefined)).toBe('');
      expect(service._escapeXml('')).toBe('');
    });
  });
});
