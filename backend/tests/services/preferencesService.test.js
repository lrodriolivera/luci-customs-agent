/**
 * Tests for Preferences Service
 * Preferencias Arancelarias - FTA, GSP, GSP+, EBA
 */

/**
 * Los tipos general y preferencial salen del Arancel Integrado de la AEAT. Se simula
 * la consulta (frontera con la sede electronica): nunca se llama a la AEAT real.
 * Antes el ahorro salia de `preferentialRate: 0` fijo en cada acuerdo, igual para
 * cualquier codigo TARIC.
 */
jest.mock('../../src/services/aeat/arancelIntegrado', () => ({
  consultarArancelIntegrado: jest.fn()
}));

const { consultarArancelIntegrado } = require('../../src/services/aeat/arancelIntegrado');
const preferencesService = require('../../src/services/preferencesService');

/** Respuesta del Arancel Integrado: derecho general y, si se da, preferencia del origen. */
function respuestaAeat({ origen, general = '16,000%', preferencia = '0,000%', codigoPref = '142-PREF' }) {
  const medidas = [{ codigo: '103-APPL', tipo: 'arancel', areaGeografica: '1011 ERGA OMNES', derecho: general }];
  if (preferencia !== null) {
    medidas.push({ codigo: codigoPref, tipo: 'arancel', areaGeografica: `${origen} Pais`, derecho: preferencia });
  }
  medidas.push({ codigo: 'IVA', tipo: 'iva', areaGeografica: '1011 ERGA OMNES', derecho: '21,000%' });
  return { existe: true, codigo: '0000000000', areaGeografica: origen, medidas };
}

beforeEach(() => {
  consultarArancelIntegrado.mockReset();
  // Por defecto: 16 % general y preferencia al 0 % para el origen consultado.
  consultarArancelIntegrado.mockImplementation(async ({ origen }) => respuestaAeat({ origen }));
});

describe('Preferences Service', () => {

  describe('findApplicableAgreements', () => {
    test('should find CETA agreement for Canada', () => {
      const agreements = preferencesService.findApplicableAgreements('CA');

      expect(agreements.length).toBeGreaterThan(0);
      expect(agreements.some(a => a.key === 'CETA')).toBe(true);
    });

    test('should find JEFTA agreement for Japan', () => {
      const agreements = preferencesService.findApplicableAgreements('JP');

      expect(agreements.length).toBeGreaterThan(0);
      expect(agreements.some(a => a.key === 'JEFTA')).toBe(true);
    });

    test('should find EU-UK agreement for United Kingdom', () => {
      const agreements = preferencesService.findApplicableAgreements('GB');

      expect(agreements.length).toBeGreaterThan(0);
      expect(agreements.some(a => a.key === 'EU-UK')).toBe(true);
    });

    test('should find GSP agreement for India', () => {
      const agreements = preferencesService.findApplicableAgreements('IN');

      expect(agreements.length).toBeGreaterThan(0);
      expect(agreements.some(a => a.type === 'GSP')).toBe(true);
    });

    test('should find GSP+ agreement for Pakistan', () => {
      const agreements = preferencesService.findApplicableAgreements('PK');

      expect(agreements.length).toBeGreaterThan(0);
      expect(agreements.some(a => a.type === 'GSP+')).toBe(true);
    });

    test('should find EBA agreement for Bangladesh', () => {
      const agreements = preferencesService.findApplicableAgreements('BD');

      expect(agreements.length).toBeGreaterThan(0);
      expect(agreements.some(a => a.type === 'EBA')).toBe(true);
    });

    test('should find Pan-Euro-Med agreements for Switzerland', () => {
      const agreements = preferencesService.findApplicableAgreements('CH');

      expect(agreements.length).toBeGreaterThan(0);
      expect(agreements.some(a => a.type === 'PEM')).toBe(true);
    });

    test('should return empty array for countries without agreements', () => {
      const agreements = preferencesService.findApplicableAgreements('ZZ');

      expect(agreements).toHaveLength(0);
    });
  });

  describe('checkEligibility', () => {
    test('should return eligible for Canada with goods', async () => {
      const operation = {
        originCountry: 'CA',
        goods: [
          { taricCode: '8517120000', customsValue: 50000, description: 'Smartphones' }
        ]
      };

      const result = await preferencesService.checkEligibility(operation);

      expect(result.eligible).toBe(true);
      expect(result.agreements.length).toBeGreaterThan(0);
      expect(result.recommended).toBeDefined();
      expect(result.savings).toBeGreaterThanOrEqual(0);
    });

    test('should return eligible for Japan with goods', async () => {
      const operation = {
        originCountry: 'JP',
        goods: [
          { taricCode: '8471300000', customsValue: 100000, description: 'Laptops' }
        ]
      };

      const result = await preferencesService.checkEligibility(operation);

      expect(result.eligible).toBe(true);
      expect(result.agreements.some(a => a.name.includes('Japan'))).toBe(true);
    });

    test('should return not eligible for country without agreements', async () => {
      const operation = {
        originCountry: 'ZZ',
        goods: [
          { taricCode: '8517120000', customsValue: 50000 }
        ]
      };

      const result = await preferencesService.checkEligibility(operation);

      expect(result.eligible).toBe(false);
      expect(result.warnings.some(w => w.code === 'NO_AGREEMENTS')).toBe(true);
    });

    test('should calculate savings for applicable agreement', async () => {
      const operation = {
        originCountry: 'CA',
        goods: [
          { taricCode: '8701200000', customsValue: 100000, description: 'Agricultural tractors' }
        ]
      };

      const result = await preferencesService.checkEligibility(operation);

      expect(result.eligible).toBe(true);
      expect(result.savings).toBeGreaterThan(0);
    });

    /**
     * Verificado en produccion el 10/Ago/2026: el TARIC 8471300000 (portatiles) tiene
     * arancel REAL 0% y la pantalla anunciaba ahorro por el CETA. Un acuerdo no puede
     * ahorrar sobre un arancel que ya es cero.
     */
    test('sin arancel que ahorrar el ahorro es cero', async () => {
      consultarArancelIntegrado.mockImplementation(async ({ origen }) =>
        respuestaAeat({ origen, general: '0,000%', preferencia: null }));

      const result = await preferencesService.checkEligibility({
        originCountry: 'CA',
        goods: [{ taricCode: '8471300000', customsValue: 50000, description: 'Portatiles' }]
      });

      expect(result.eligible).toBe(true);   // el acuerdo aplica...
      expect(result.savings).toBe(0);       // ...pero no ahorra nada
      expect(result.standardRate).toBe(0);
    });

    // UAT 16/Nov/2026: la calculadora decia 0 % preferencial para cualquier codigo.
    test('el tipo general y el preferencial son los de la AEAT para el codigo y el origen', async () => {
      consultarArancelIntegrado.mockImplementation(async ({ origen }) =>
        respuestaAeat({ origen, general: '12,000%', preferencia: '4,500%' }));

      const result = await preferencesService.checkEligibility({
        originCountry: 'VN',
        goods: [{ taricCode: '6403999300', customsValue: 10000, description: 'Calzado' }]
      });

      expect(consultarArancelIntegrado).toHaveBeenCalledWith({ codigo: '6403999300', origen: 'VN' });
      expect(result.aeatAvailable).toBe(true);
      expect(result.standardRate).toBe(12);
      expect(result.preferentialRate).toBe(4.5);
      expect(result.preferenceMeasure).toBe('142-PREF');
      expect(result.savings).toBe(750); // 10.000 x (12 - 4,5) %
      expect(result.recommended.conditions).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'preferential', rate: 4.5 })])
      );
    });

    test('si la AEAT no recoge preferencia para el origen no es elegible ni hay ahorro', async () => {
      consultarArancelIntegrado.mockImplementation(async ({ origen }) =>
        respuestaAeat({ origen, general: '6,500%', preferencia: null }));

      const result = await preferencesService.checkEligibility({
        originCountry: 'JP',
        goods: [{ taricCode: '8703239000', customsValue: 20000 }]
      });

      expect(result.eligible).toBe(false);
      expect(result.standardRate).toBe(6.5);
      expect(result.preferentialRate).toBeNull();
      expect(result.savings).toBe(0);
      expect(result.warnings.some(w => w.code === 'SIN_PREFERENCIA_AEAT')).toBe(true);
    });

    test('las preferencias de otros origenes no cuentan', async () => {
      consultarArancelIntegrado.mockResolvedValue({
        existe: true,
        areaGeografica: 'JP',
        medidas: [
          { codigo: '103-APPL', areaGeografica: '1011 ERGA OMNES', derecho: '10,000%' },
          { codigo: '142-PREF', areaGeografica: 'KR Corea del Sur', derecho: '0,000%' }
        ]
      });

      const result = await preferencesService.checkEligibility({
        originCountry: 'JP',
        goods: [{ taricCode: '8703239000', customsValue: 1000 }]
      });

      expect(result.preferentialRate).toBeNull();
      expect(result.eligible).toBe(false);
    });

    test('con varias preferencias del origen se toma la mas favorable', async () => {
      consultarArancelIntegrado.mockResolvedValue({
        existe: true,
        areaGeografica: 'MA',
        medidas: [
          { codigo: '103-APPL', areaGeografica: '1011 ERGA OMNES', derecho: '8,000%' },
          { codigo: '142-PREF', areaGeografica: 'MA Marruecos', derecho: '2,000%' },
          { codigo: '143-PRFQ', areaGeografica: 'MA Marruecos', derecho: '0,000%' }
        ]
      });

      const result = await preferencesService.checkEligibility({
        originCountry: 'MA',
        goods: [{ taricCode: '0702000007', customsValue: 1000 }]
      });

      expect(result.preferentialRate).toBe(0);
      expect(result.preferenceMeasure).toBe('143-PRFQ');
      expect(result.savings).toBe(80);
    });

    // Si la AEAT no responde no se inventa un 0 %: el ahorro queda desconocido (null).
    test('si la AEAT no responde lo dice y no declara tipos ni ahorro', async () => {
      consultarArancelIntegrado.mockRejectedValue(new Error('timeout de la sede'));

      const result = await preferencesService.checkEligibility({
        originCountry: 'CA',
        goods: [{ taricCode: '8701200000', customsValue: 100000, description: 'Tractores' }]
      });

      expect(result.eligible).toBe(true); // el acuerdo existe
      expect(result.aeatAvailable).toBe(false);
      expect(result.standardRate).toBeNull();
      expect(result.preferentialRate).toBeNull();
      expect(result.savings).toBeNull();
      expect(result.warnings.some(w => w.code === 'AEAT_NO_DISPONIBLE')).toBe(true);
    });

    test('un codigo que la AEAT no conoce no da tipos', async () => {
      consultarArancelIntegrado.mockResolvedValue({ existe: false, areaGeografica: 'CA', medidas: [] });

      const result = await preferencesService.checkEligibility({
        originCountry: 'CA',
        goods: [{ taricCode: '9999999999', customsValue: 100 }]
      });

      expect(result.savings).toBeNull();
      expect(result.warnings.some(w => w.code === 'AEAT_NO_DISPONIBLE')).toBe(true);
    });

    test('un derecho que no es porcentaje no se convierte en 0 %', async () => {
      consultarArancelIntegrado.mockImplementation(async ({ origen }) =>
        respuestaAeat({ origen, general: '24,00 EUR/100 kg', preferencia: null }));

      const result = await preferencesService.checkEligibility({
        originCountry: 'CA',
        goods: [{ taricCode: '1006309800', customsValue: 100 }]
      });

      expect(result.standardRate).toBeNull();
      expect(result.savings).toBeNull();
    });

    test('suma el ahorro de varias mercancias', async () => {
      const result = await preferencesService.checkEligibility({
        originCountry: 'CA',
        goods: [
          { taricCode: '8701200000', customsValue: 1000 },
          { taricCode: '8701200000', customsValue: 500 }
        ]
      });

      expect(result.rates).toHaveLength(2);
      expect(result.savings).toBe(240); // 1.500 x 16 %
    });

    test('should include requirements for applying preference', async () => {
      const operation = {
        originCountry: 'CA',
        goods: [
          { taricCode: '8517120000', customsValue: 50000 }
        ]
      };

      const result = await preferencesService.checkEligibility(operation);

      expect(result.requirements).toBeDefined();
      expect(result.requirements.length).toBeGreaterThan(0);
      expect(result.requirements.some(r => r.type === 'certificate')).toBe(true);
    });
  });

  describe('getAgreementInfo', () => {
    test('should return CETA agreement info', () => {
      const info = preferencesService.getAgreementInfo('CETA');

      expect(info).toBeDefined();
      expect(info.name).toContain('Canada');
      expect(info.type).toBe('FTA');
      expect(info.countries).toContain('CA');
      expect(info.certificate).toBeDefined();
    });

    test('should return GSP agreement info', () => {
      const info = preferencesService.getAgreementInfo('GSP');

      expect(info).toBeDefined();
      expect(info.type).toBe('GSP');
      expect(info.certificate).toBe('Form A');
    });

    test('should return null for non-existent agreement', () => {
      const info = preferencesService.getAgreementInfo('INVALID');

      expect(info).toBeNull();
    });
  });

  describe('getAllAgreements', () => {
    test('should return all available agreements', () => {
      const agreements = preferencesService.getAllAgreements();

      expect(agreements).toBeInstanceOf(Array);
      expect(agreements.length).toBeGreaterThan(5);
      expect(agreements.some(a => a.key === 'CETA')).toBe(true);
      expect(agreements.some(a => a.key === 'JEFTA')).toBe(true);
      expect(agreements.some(a => a.key === 'GSP')).toBe(true);
    });

    test('should include required fields for each agreement', () => {
      const agreements = preferencesService.getAllAgreements();

      agreements.forEach(agreement => {
        expect(agreement.key).toBeDefined();
        expect(agreement.name).toBeDefined();
        expect(agreement.type).toBeDefined();
        expect(agreement.certificate).toBeDefined();
      });
    });
  });

  describe('getOriginRule', () => {
    test('should return rule for textile chapters (50-63)', () => {
      const rule = preferencesService.getOriginRule('62');

      expect(rule).toBeDefined();
      expect(rule.rule).toBe('CC');
      expect(rule.description).toContain('change of tariff chapter');
    });

    test('should return rule for machinery chapters (84-85)', () => {
      const rule = preferencesService.getOriginRule('84');

      expect(rule).toBeDefined();
      expect(rule.rule).toBe('RVC');
      expect(rule.valueAdded).toBe(0.45);
    });

    test('should return rule for vehicles chapter (87)', () => {
      const rule = preferencesService.getOriginRule('87');

      // Chapter 87 is defined separately in ORIGIN_RULES_BY_CHAPTER
      // If not found in ranges, returns default CC rule
      expect(rule).toBeDefined();
      expect(rule.rule).toBeDefined();
      expect(['RVC', 'CC']).toContain(rule.rule);
    });

    test('should return default rule for unknown chapter', () => {
      const rule = preferencesService.getOriginRule('99');

      expect(rule).toBeDefined();
      expect(rule.rule).toBe('CC');
    });
  });

  describe('validateCertificate', () => {
    test('should validate a correct EUR.1 certificate', async () => {
      const certificate = {
        type: 'EUR.1',
        certificateNumber: 'ES123456',
        issuedDate: new Date().toISOString(),
        exporterName: 'Exporter Company',
        consigneeName: 'Importer Company',
        originCountry: 'CA'
      };

      const result = await preferencesService.validateCertificate(certificate);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('should reject expired certificate (>10 months)', async () => {
      const expiredDate = new Date();
      expiredDate.setMonth(expiredDate.getMonth() - 11);

      const certificate = {
        type: 'EUR.1',
        certificateNumber: 'ES123456',
        issuedDate: expiredDate.toISOString(),
        exporterName: 'Exporter Company',
        consigneeName: 'Importer Company',
        originCountry: 'CA'
      };

      const result = await preferencesService.validateCertificate(certificate);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.field === 'issuedDate')).toBe(true);
    });

    test('should reject certificate with missing required fields', async () => {
      const certificate = {
        type: 'EUR.1',
        issuedDate: new Date().toISOString()
        // Missing exporterName, consigneeName, originCountry, certificateNumber
      };

      const result = await preferencesService.validateCertificate(certificate);

      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('should reject invalid certificate type', async () => {
      const certificate = {
        type: 'INVALID_TYPE',
        certificateNumber: 'ES123456',
        issuedDate: new Date().toISOString(),
        exporterName: 'Exporter Company',
        consigneeName: 'Importer Company',
        originCountry: 'CA'
      };

      const result = await preferencesService.validateCertificate(certificate);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.field === 'type')).toBe(true);
    });

    test('should warn about non-standard EUR.1 number format', async () => {
      const certificate = {
        type: 'EUR.1',
        certificateNumber: 'IRREGULAR123',
        issuedDate: new Date().toISOString(),
        exporterName: 'Exporter Company',
        consigneeName: 'Importer Company',
        originCountry: 'CA'
      };

      const result = await preferencesService.validateCertificate(certificate);

      expect(result.warnings.some(w => w.field === 'certificateNumber')).toBe(true);
    });
  });

  describe('generateOptimizationRecommendations', () => {
    test('should recommend applying preference when eligible', async () => {
      const operation = {
        originCountry: 'CA',
        goods: [
          { taricCode: '8517120000', customsValue: 50000 }
        ]
      };

      const recommendations = await preferencesService.generateOptimizationRecommendations(operation);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.type === 'preference')).toBe(true);
    });

    test('should recommend invoice declaration for low value shipments', async () => {
      const operation = {
        originCountry: 'MX',
        goods: [
          { taricCode: '8517120000', customsValue: 5000 } // Below 6000 EUR
        ]
      };

      const recommendations = await preferencesService.generateOptimizationRecommendations(operation);

      expect(recommendations.some(r => r.type === 'documentation')).toBe(true);
    });

    test('should suggest cumulation opportunities when materials provided', async () => {
      const operation = {
        originCountry: 'CA',
        goods: [
          { taricCode: '8517120000', customsValue: 50000 }
        ],
        materials: [
          { origin: 'US', value: 10000 }
        ]
      };

      const recommendations = await preferencesService.generateOptimizationRecommendations(operation);

      expect(recommendations.some(r => r.type === 'cumulation')).toBe(true);
    });
  });

  describe('checkOriginRules', () => {
    test('should verify RVC compliance for machinery', async () => {
      const operation = {
        originCountry: 'CA',
        goods: [
          {
            taricCode: '8471300000',
            customsValue: 100000,
            originBreakdown: {
              originatingMaterials: 50000
            }
          }
        ]
      };

      const agreement = preferencesService.findApplicableAgreements('CA')[0];
      const result = preferencesService.checkOriginRules(operation, agreement);

      expect(result.complies).toBe(true);
      expect(result.conditions.some(c => c.type === 'rvc')).toBe(true);
    });

    test('should reject insufficient RVC', async () => {
      const operation = {
        originCountry: 'CA',
        goods: [
          {
            taricCode: '8471300000',
            customsValue: 100000,
            originBreakdown: {
              originatingMaterials: 30000 // Only 30% RVC
            },
            description: 'Computer'
          }
        ]
      };

      const agreement = preferencesService.findApplicableAgreements('CA')[0];
      const result = preferencesService.checkOriginRules(operation, agreement);

      expect(result.complies).toBe(false);
      expect(result.issues.some(i => i.issue.includes('regional value content'))).toBe(true);
    });

    test('should check tolerance for non-originating materials', async () => {
      const operation = {
        originCountry: 'CA',
        goods: [
          {
            taricCode: '8471300000',
            customsValue: 100000,
            nonOriginatingContent: 15000, // 15% non-originating
            description: 'Computer'
          }
        ]
      };

      const agreement = preferencesService.findApplicableAgreements('CA')[0];
      const result = preferencesService.checkOriginRules(operation, agreement);

      // 15% exceeds 10% tolerance
      expect(result.issues.some(i => i.issue.includes('tolerance'))).toBe(true);
    });
  });
  /**
   * Prueba de origen segun la lista oficial de acuerdos de la AEAT (Acuerdos_UE.pdf)
   * y la UAT del 16/Nov/2026: Chile y Japon no usan EUR.1.
   */
  describe('prueba de origen de cada acuerdo', () => {
    const acuerdo = (pais) => preferencesService.findApplicableAgreements(pais);

    test('Chile: Acuerdo Interino de Comercio, declaracion de origen y no EUR.1', () => {
      const [chile] = acuerdo('CL');
      expect(chile.name).toContain('Interim Trade Agreement');
      expect(chile.effectiveDate).toBe('2025-02-01');
      expect(chile.certificate).toMatch(/Declaración de origen/);
      expect(chile.certificate).not.toMatch(/EUR\.1/);
      expect(chile.proofKind).toBe('exporter_declaration');
    });

    test('Japon: declaracion de origen o conocimiento del importador, sin EUR.1', () => {
      const [japon] = acuerdo('JP');
      expect(japon.certificate).toMatch(/statement on origin/);
      expect(japon.certificate).toMatch(/conocimiento del importador/);
      expect(japon.certificate).not.toMatch(/EUR\.1/);
      expect(japon.proofKind).toBe('exporter_declaration');
    });

    test('Canada (CETA): declaracion de origen, sin EUR.1', () => {
      const [canada] = acuerdo('CA');
      expect(canada.certificate).not.toMatch(/EUR\.1/);
      expect(canada.proofKind).toBe('exporter_declaration');
    });

    test('Turquia: union aduanera con A.TR, no Pan-Euro-Med', () => {
      const turquia = acuerdo('TR');
      expect(turquia).toHaveLength(1);
      expect(turquia[0].key).toBe('EU-TURKEY');
      expect(turquia[0].certificate).toMatch(/A\.TR/);
    });

    test('ningun acuerdo fija un tipo preferencial: lo da la AEAT', () => {
      for (const key of preferencesService.getAllAgreements().map(a => a.key)) {
        expect(preferencesService.getAgreementInfo(key).preferentialRate).toBeUndefined();
      }
    });

    test('el resultado lleva la prueba de origen y su clase', async () => {
      const result = await preferencesService.checkEligibility({
        originCountry: 'CL',
        goods: [{ taricCode: '0806101090', customsValue: 1000 }]
      });
      expect(result.recommended.proofKind).toBe('exporter_declaration');
      expect(result.recommended.certificate).not.toMatch(/EUR\.1/);
      expect(result.requirements.find(r => r.type === 'certificate').description).toMatch(/^Prueba de origen/);
    });

    test('no sugiere "declaracion en lugar de EUR.1" donde no hay EUR.1', async () => {
      const recommendations = await preferencesService.generateOptimizationRecommendations({
        originCountry: 'JP',
        goods: [{ taricCode: '8703239000', customsValue: 3000 }]
      });
      expect(recommendations.some(r => r.type === 'documentation')).toBe(false);
    });
  });
});
