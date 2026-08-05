/**
 * Tests for TRACES Service - Branch Coverage
 * Objetivo: aumentar cobertura de ramas sin modificar lógica de negocio
 *
 * Este fichero cubre ramas específicas no cubiertas por tracesService.test.js:
 * - Errores de red simulados en _callTRACESAPI
 * - Validaciones de decisiones de control
 * - Solicitudes de laboratorio
 * - Resultados de laboratorio
 * - Búsqueda de CHEDs
 * - Frecuencias de inspección
 * - Verificación de certificados (válidos e inválidos)
 * - Establecimientos autorizados
 * - Notificaciones de llegada
 * - Actualización de CHEDs
 * - Obtención de CHEDs completos
 * - Casos edge de validación
 */

const tracesService = require('../../src/services/integrations/tracesService');

// Helper para forzar modo NO simulación (testa la rama de _callTRACESAPI)
const setEnvironment = (env) => {
  const originalEnv = process.env.TRACES_ENVIRONMENT;
  const originalSimulationMode = tracesService.simulationMode;
  const originalEnvironment = tracesService.environment;
  const originalConfig = tracesService.config;

  process.env.TRACES_ENVIRONMENT = env;

  // Recargar el service para que tome la nueva configuración
  // Como es un singleton, necesitamos modificar su estado interno
  tracesService.environment = env;
  tracesService.config = {
    baseUrl: env === 'simulation'
      ? 'https://traces-simulation.local'
      : env === 'acceptance'
        ? 'https://webgate.acceptance.ec.europa.eu/tracesnt'
        : 'https://webgate.ec.europa.eu/tracesnt',
    apiUrl: env === 'simulation'
      ? 'https://traces-simulation.local/api'
      : env === 'acceptance'
        ? 'https://webgate.acceptance.ec.europa.eu/tracesnt/api'
        : 'https://webgate.ec.europa.eu/tracesnt/api'
  };
  tracesService.simulationMode = env === 'simulation';

  return () => {
    process.env.TRACES_ENVIRONMENT = originalEnv;
    tracesService.environment = originalEnvironment;
    tracesService.simulationMode = originalSimulationMode;
    tracesService.config = originalConfig;
  };
};

describe('TRACES Service - Branch Coverage', () => {

  // Restaurar estado original después de cada test
  afterEach(() => {
    // Asegurar que siempre volvemos a simulation
    process.env.TRACES_ENVIRONMENT = 'simulation';
    tracesService.environment = 'simulation';
    tracesService.simulationMode = true;
    tracesService.config = {
      baseUrl: 'https://traces-simulation.local',
      apiUrl: 'https://traces-simulation.local/api',
      description: 'Entorno de simulación local'
    };
  });

  describe('Control Decisions', () => {
    test('should register ACCEPTABLE decision', async () => {
      const result = await tracesService.registerControlDecision(
        'CHED.ES.2024.CHEDP.12345678',
        {
          decision: 'ACCEPTABLE',
          documentaryCheck: { result: 'SATISFACTORY', inspector: 'INS001' },
          identityCheck: { result: 'SATISFACTORY', inspector: 'INS002' },
          physicalCheck: null,
          laboratoryTests: [],
          remarks: 'Todo conforme'
        }
      );

      expect(result.success).toBe(true);
      expect(result.decision).toBe('C');
      expect(result.canRelease).toBe(true);
      expect(result.status).toBe('APPROVED');
    });

    test('should register ACCEPTABLE_CHANNELLED decision', async () => {
      const result = await tracesService.registerControlDecision(
        'CHED.ES.2024.CHEDP.ABCD5678',
        {
          decision: 'ACCEPTABLE_CHANNELLED',
          documentaryCheck: { result: 'SATISFACTORY' },
          identityCheck: { result: 'SATISFACTORY' },
          physicalCheck: { result: 'SATISFACTORY_WITH_CONDITIONS' },
          laboratoryTests: [],
          remarks: 'Destino específico requerido'
        }
      );

      expect(result.success).toBe(true);
      expect(result.decision).toBe('D');
      expect(result.canRelease).toBe(true);
    });

    test('should register NOT_ACCEPTABLE_REEXPORT decision', async () => {
      const result = await tracesService.registerControlDecision(
        'CHED.ES.2024.CHEDA.REJECT01',
        {
          decision: 'NOT_ACCEPTABLE_REEXPORT',
          documentaryCheck: { result: 'SATISFACTORY' },
          identityCheck: { result: 'NOT_SATISFACTORY' },
          physicalCheck: { result: 'NOT_SATISFACTORY' },
          laboratoryTests: [],
          remarks: 'Mercancía no conforme, debe reexportarse'
        }
      );

      expect(result.success).toBe(true);
      expect(result.decision).toBe('R');
      expect(result.canRelease).toBe(false);
      expect(result.status).toBe('REJECTED');
    });

    test('should register NOT_ACCEPTABLE_DESTROY decision', async () => {
      const result = await tracesService.registerControlDecision(
        'CHED.ES.2024.CHEDP.DESTROY1',
        {
          decision: 'NOT_ACCEPTABLE_DESTROY',
          documentaryCheck: { result: 'SATISFACTORY' },
          identityCheck: { result: 'NOT_SATISFACTORY' },
          physicalCheck: { result: 'CONTAMINATED' },
          laboratoryTests: [{ result: 'POSITIVE_SALMONELLA' }],
          remarks: 'Contaminación detectada, destrucción obligatoria'
        }
      );

      expect(result.success).toBe(true);
      expect(result.decision).toBe('X');
      expect(result.canRelease).toBe(false);
    });

    test('should register NOT_ACCEPTABLE_TRANSFORM decision', async () => {
      const result = await tracesService.registerControlDecision(
        'CHED.ES.2024.CHEDP.TRANSF01',
        {
          decision: 'NOT_ACCEPTABLE_TRANSFORM',
          documentaryCheck: { result: 'SATISFACTORY' },
          identityCheck: { result: 'SATISFACTORY' },
          physicalCheck: { result: 'NOT_CONFORMING' },
          laboratoryTests: [],
          remarks: 'Requiere transformación industrial'
        }
      );

      expect(result.success).toBe(true);
      expect(result.decision).toBe('T');
      expect(result.canRelease).toBe(false);
    });

    test('should fail with invalid decision', async () => {
      await expect(
        tracesService.registerControlDecision(
          'CHED.ES.2024.CHEDP.12345678',
          {
            decision: 'INVALID_DECISION',
            documentaryCheck: { result: 'SATISFACTORY' },
            identityCheck: { result: 'SATISFACTORY' }
          }
        )
      ).rejects.toThrow('Decisión no válida: INVALID_DECISION');
    });

    test('should include physical check when provided', async () => {
      const result = await tracesService.registerControlDecision(
        'CHED.ES.2024.CHEDP.PHYSICAL1',
        {
          decision: 'ACCEPTABLE',
          documentaryCheck: { result: 'SATISFACTORY' },
          identityCheck: { result: 'SATISFACTORY' },
          physicalCheck: {
            result: 'SATISFACTORY',
            inspector: 'INS003',
            samples: 5,
            notes: 'Inspección física completa'
          },
          laboratoryTests: [],
          remarks: 'Todo OK'
        }
      );

      expect(result.success).toBe(true);
      expect(result.checks.physical).toBeDefined();
      expect(result.checks.physical.result).toBe('SATISFACTORY');
    });
  });

  describe('Laboratory Analysis', () => {
    test('should request laboratory analysis for VETERINARY type', async () => {
      const result = await tracesService.requestLaboratoryAnalysis(
        'CHED.ES.2024.CHEDP.LAB00001',
        {
          laboratoryCode: 'ESLAB001',
          analysisType: 'MICROBIOLOGICAL',
          sampleDetails: {
            quantity: '500g',
            sampleId: 'SAMPLE-001',
            description: 'Muestra de carne congelada'
          },
          urgency: 'NORMAL'
        }
      );

      expect(result.success).toBe(true);
      expect(result.analysisReference).toBeDefined();
      expect(result.chedReference).toBe('CHED.ES.2024.CHEDP.LAB00001');
      expect(result.laboratory.code).toBe('ESLAB001');
      expect(result.laboratory.name).toBe('Laboratorio Central de Sanidad Animal (LCSA)');
    });

    test('should request laboratory analysis for FOOD type', async () => {
      const result = await tracesService.requestLaboratoryAnalysis(
        'CHED.ES.2024.CHEDD.LAB00002',
        {
          laboratoryCode: 'ESLAB002',
          analysisType: 'CHEMICAL',
          sampleDetails: {
            quantity: '1kg',
            sampleId: 'SAMPLE-002'
          },
          urgency: 'URGENT'
        }
      );

      expect(result.success).toBe(true);
      expect(result.laboratory.code).toBe('ESLAB002');
      expect(result.laboratory.name).toBe('Centro Nacional de Alimentación (CNA)');
    });

    test('should request laboratory analysis for PHYTOSANITARY type', async () => {
      const result = await tracesService.requestLaboratoryAnalysis(
        'CHED.ES.2024.CHEDPP.LAB003',
        {
          laboratoryCode: 'ESLAB003',
          analysisType: 'PHYTOSANITARY',
          sampleDetails: {
            quantity: '100g',
            sampleId: 'SAMPLE-003'
          },
          urgency: 'NORMAL'
        }
      );

      expect(result.success).toBe(true);
      expect(result.laboratory.code).toBe('ESLAB003');
      expect(result.laboratory.name).toBe('Laboratorio de Sanidad Vegetal');
    });

    test('should fail with unauthorized laboratory', async () => {
      await expect(
        tracesService.requestLaboratoryAnalysis(
          'CHED.ES.2024.CHEDP.LAB00001',
          {
            laboratoryCode: 'ESLAB999',
            analysisType: 'MICROBIOLOGICAL',
            sampleDetails: {},
            urgency: 'NORMAL'
          }
        )
      ).rejects.toThrow('Laboratorio no autorizado: ESLAB999');
    });

    test('should register laboratory result with SATISFACTORY status', async () => {
      const result = await tracesService.registerLaboratoryResult(
        'LAB-REF-001',
        {
          result: 'SATISFACTORY',
          details: 'No se detectaron patógenos',
          parameters: {
            salmonella: 'NEGATIVE',
            listeria: 'NEGATIVE',
            ecoli: 'NEGATIVE'
          }
        }
      );

      expect(result.success).toBe(true);
      expect(result.analysisReference).toBe('LAB-REF-001');
      expect(result.result).toBe('SATISFACTORY');
      expect(result.reportNumber).toBeDefined();
    });

    test('should register laboratory result with default values', async () => {
      const result = await tracesService.registerLaboratoryResult(
        'LAB-REF-002',
        {
          // Sin result ni details explícitos
        }
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('SATISFACTORY');
      expect(result.details).toBe('Sin hallazgos significativos');
    });

    test('should register laboratory result with NOT_SATISFACTORY status', async () => {
      const result = await tracesService.registerLaboratoryResult(
        'LAB-REF-003',
        {
          result: 'NOT_SATISFACTORY',
          details: 'Contaminación por Salmonella detectada',
          parameters: {
            salmonella: 'POSITIVE',
            cfu: '150000'
          }
        }
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('NOT_SATISFACTORY');
    });
  });

  describe('CHED Search', () => {
    test('should search CHEDs by type', async () => {
      const result = await tracesService.searchCHEDs({
        type: 'CHED-P',
        status: null,
        dateFrom: null,
        dateTo: null
      });

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.total).toBeGreaterThan(0);
    });

    test('should search CHEDs by status', async () => {
      const result = await tracesService.searchCHEDs({
        type: null,
        status: 'APPROVED',
        dateFrom: null,
        dateTo: null
      });

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
    });

    test('should search CHEDs by date range', async () => {
      const result = await tracesService.searchCHEDs({
        type: null,
        status: null,
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31'
      });

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
    });

    test('should search CHEDs by origin country', async () => {
      const result = await tracesService.searchCHEDs({
        originCountry: 'BR',
        consigneeNIF: null,
        borderControlPost: null
      });

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
    });

    test('should search CHEDs by consignee NIF', async () => {
      const result = await tracesService.searchCHEDs({
        originCountry: null,
        consigneeNIF: 'B12345678',
        borderControlPost: null
      });

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
    });

    test('should search CHEDs by border control post', async () => {
      const result = await tracesService.searchCHEDs({
        originCountry: null,
        consigneeNIF: null,
        borderControlPost: 'ESBCN01'
      });

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
    });

    test('should search CHEDs with multiple criteria', async () => {
      const result = await tracesService.searchCHEDs({
        type: 'CHED-P',
        status: 'APPROVED',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        originCountry: 'BR',
        consigneeNIF: 'B12345678',
        borderControlPost: 'ESBCN01'
      });

      expect(result.success).toBe(true);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });
  });

  describe('Inspection Frequencies', () => {
    test('should get inspection frequencies for Brazil (MEDIUM risk)', async () => {
      const result = await tracesService.getInspectionFrequencies('BR', '0203291500');

      expect(result.success).toBe(true);
      expect(result.country).toBe('BR');
      expect(result.commodity).toBe('0203291500');
      expect(result.frequencies.documentary).toBe(100);
      expect(result.frequencies.identity).toBe(100);
      expect(result.frequencies.physical).toBe(20); // Brasil tiene mayor frecuencia
      expect(result.riskLevel).toBe('MEDIUM');
    });

    test('should get inspection frequencies for low-risk country', async () => {
      const result = await tracesService.getInspectionFrequencies('AU', '0203291500');

      expect(result.success).toBe(true);
      expect(result.country).toBe('AU');
      expect(result.frequencies.physical).toBe(10); // Países no-BR tienen menor frecuencia
      expect(result.riskLevel).toBe('LOW');
    });

    test('should get inspection frequencies for Argentina', async () => {
      const result = await tracesService.getInspectionFrequencies('AR', '0201100000');

      expect(result.success).toBe(true);
      expect(result.country).toBe('AR');
      expect(result.frequencies.physical).toBe(10);
      expect(result.riskLevel).toBe('LOW');
    });
  });

  describe('Certificate Verification', () => {
    test('should verify valid certificate (simulated 90% success rate)', async () => {
      // Ejecutar múltiples veces para probar ambas ramas (válido/no válido)
      const results = [];
      for (let i = 0; i < 20; i++) {
        const result = await tracesService.verifyCertificate({
          certificateNumber: `BR-2024-${i.toString().padStart(6, '0')}`,
          issuingCountry: 'BR',
          issuingAuthority: 'MAPA Brasil',
          issueDate: '2024-01-15',
          commodityCode: '0203291500'
        });

        results.push(result);
        expect(result.success).toBe(true);
        expect(result.certificateNumber).toBeDefined();
        expect(result.verified).toBeDefined();
        expect(result.status).toBeDefined();
      }

      // Al menos uno debe ser válido y al menos uno inválido (probabilísticamente)
      const validCount = results.filter(r => r.verified).length;
      const invalidCount = results.filter(r => !r.verified).length;

      // Con 20 intentos y 90% probabilidad de válido, es casi seguro tener ambos casos
      expect(validCount).toBeGreaterThan(0);
      // BUG: La probabilidad 0.1 de inválido puede fallar (flaky test)
      // Esto no es un bug de lógica, es diseño probabilístico del servicio
    });

    test('should return VALID status for valid certificate', async () => {
      let foundValid = false;

      // Intentar hasta encontrar un caso válido
      for (let i = 0; i < 50 && !foundValid; i++) {
        const result = await tracesService.verifyCertificate({
          certificateNumber: 'AR-2024-123456',
          issuingCountry: 'AR',
          issuingAuthority: 'SENASA Argentina',
          issueDate: '2024-02-20',
          commodityCode: '0201100000'
        });

        if (result.verified) {
          expect(result.status).toBe('VALID');
          expect(result.message).toBe('Certificado verificado correctamente');
          foundValid = true;
        }
      }

      expect(foundValid).toBe(true);
    });

    test('should return NOT_FOUND status for invalid certificate', async () => {
      let foundInvalid = false;

      // Intentar hasta encontrar un caso inválido
      for (let i = 0; i < 50 && !foundInvalid; i++) {
        const result = await tracesService.verifyCertificate({
          certificateNumber: 'US-2024-999999',
          issuingCountry: 'US',
          issuingAuthority: 'USDA',
          issueDate: '2024-03-10',
          commodityCode: '0102210000'
        });

        if (!result.verified) {
          expect(result.status).toBe('NOT_FOUND');
          expect(result.message).toBe('Certificado no encontrado en el sistema del país de origen');
          foundInvalid = true;
        }
      }

      expect(foundInvalid).toBe(true);
    });
  });

  describe('Approved Establishments', () => {
    test('should get approved establishments for country and activity', async () => {
      const result = await tracesService.getApprovedEstablishments('BR', 'MEAT_PROCESSING');

      expect(result.success).toBe(true);
      expect(result.country).toBe('BR');
      expect(result.activityType).toBe('MEAT_PROCESSING');
      expect(result.establishments).toBeDefined();
      expect(Array.isArray(result.establishments)).toBe(true);
      expect(result.establishments.length).toBe(3);
      expect(result.total).toBe(3);
    });

    test('should include establishment details', async () => {
      const result = await tracesService.getApprovedEstablishments('AR', 'DAIRY');

      expect(result.success).toBe(true);
      result.establishments.forEach(est => {
        expect(est.code).toBeDefined();
        expect(est.code).toMatch(/^AR-\d{3}$/);
        expect(est.name).toBeDefined();
        expect(est.city).toBeDefined();
        expect(est.approved).toBe(true);
      });
    });

    test('should get establishments for different countries', async () => {
      const countries = ['BR', 'AR', 'US', 'AU', 'NZ'];

      for (const country of countries) {
        const result = await tracesService.getApprovedEstablishments(country, 'PRODUCTION');

        expect(result.success).toBe(true);
        expect(result.country).toBe(country);
        expect(result.establishments.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Arrival Notification', () => {
    test('should notify arrival with inspection scheduled', async () => {
      let foundScheduled = false;

      // La simulación programa inspección con 50% probabilidad
      for (let i = 0; i < 30 && !foundScheduled; i++) {
        const result = await tracesService.notifyArrival({
          chedReference: 'CHED.ES.2024.CHEDP.ARRIVAL1',
          actualArrivalDate: '2024-08-06T10:30:00Z',
          borderControlPost: 'ESBCN01',
          transportDocument: 'BL-2024-123456',
          containerNumbers: ['MSCU1234567', 'MSCU7654321']
        });

        if (result.inspectionScheduled) {
          expect(result.success).toBe(true);
          expect(result.chedReference).toBe('CHED.ES.2024.CHEDP.ARRIVAL1');
          expect(result.arrivalNotified).toBe(true);
          expect(result.scheduledInspectionTime).toBeDefined();
          foundScheduled = true;
        }
      }

      expect(foundScheduled).toBe(true);
    });

    test('should notify arrival without inspection scheduled', async () => {
      let foundNotScheduled = false;

      for (let i = 0; i < 30 && !foundNotScheduled; i++) {
        const result = await tracesService.notifyArrival({
          chedReference: 'CHED.ES.2024.CHEDA.ARRIVAL2',
          actualArrivalDate: '2024-08-06T14:00:00Z',
          borderControlPost: 'ESMAD01',
          transportDocument: 'AWB-2024-789012',
          containerNumbers: []
        });

        if (!result.inspectionScheduled) {
          expect(result.success).toBe(true);
          expect(result.arrivalDate).toBe('2024-08-06T14:00:00Z');
          expect(result.borderControlPost).toBe('ESMAD01');
          foundNotScheduled = true;
        }
      }

      expect(foundNotScheduled).toBe(true);
    });

    test('should notify arrival with all details', async () => {
      const result = await tracesService.notifyArrival({
        chedReference: 'CHED.ES.2024.CHEDPP.ARRIVAL3',
        actualArrivalDate: '2024-08-06T08:00:00Z',
        borderControlPost: 'ESVLC01',
        transportDocument: 'CMR-2024-456789',
        containerNumbers: ['CONT001', 'CONT002', 'CONT003']
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Llegada notificada correctamente. Pendiente de inspección.');
    });
  });

  describe('CHED Update', () => {
    test('should update CHED in DRAFT status', async () => {
      const result = await tracesService.updateCHED(
        'CHED.ES.2024.CHEDP.UPDATE01',
        {
          goods: {
            commodityCode: '0203291500',
            quantity: 25000,
            unit: 'KGM'
          },
          transportDetails: {
            vessel: 'New Vessel Name',
            containerNumber: 'NEWC1234567'
          }
        }
      );

      expect(result.success).toBe(true);
      expect(result.reference).toBe('CHED.ES.2024.CHEDP.UPDATE01');
      expect(result.status).toBe('DRAFT');
      expect(result.updatedFields).toBeDefined();
      expect(result.updatedFields).toContain('goods');
      expect(result.updatedFields).toContain('transportDetails');
      expect(result.message).toBe('CHED actualizado correctamente');
    });

    test('should update single field', async () => {
      const result = await tracesService.updateCHED(
        'CHED.ES.2024.CHEDA.UPDATE02',
        {
          remarks: 'Observaciones actualizadas'
        }
      );

      expect(result.success).toBe(true);
      expect(result.updatedFields).toHaveLength(1);
      expect(result.updatedFields).toContain('remarks');
    });

    test('should update multiple fields', async () => {
      const result = await tracesService.updateCHED(
        'CHED.ES.2024.CHEDPP.UPDATE03',
        {
          goods: { quantity: 1000 },
          originCountry: 'CO',
          borderControlPost: 'ESBCN01',
          consignee: { nif: 'B98765432' }
        }
      );

      expect(result.success).toBe(true);
      expect(result.updatedFields).toHaveLength(4);
    });
  });

  describe('Get CHED Full', () => {
    test('should get complete CHED information', async () => {
      const result = await tracesService.getCHED('CHED.ES.2024.CHEDP.FULL001');

      expect(result.success).toBe(true);
      expect(result.reference).toBe('CHED.ES.2024.CHEDP.FULL001');
      expect(result.type).toBe('CHED-P');
      expect(result.typeName).toBe('CHED for Products');
      expect(result.status).toBe('IN_PROGRESS');

      // Verificar estructura completa
      expect(result.goods).toBeDefined();
      expect(result.goods.commodityCode).toBeDefined();
      expect(result.goods.description).toBeDefined();
      expect(result.goods.quantity).toBeDefined();

      expect(result.origin).toBeDefined();
      expect(result.origin.country).toBeDefined();
      expect(result.origin.establishment).toBeDefined();

      expect(result.consignee).toBeDefined();
      expect(result.consignee.nif).toBeDefined();

      expect(result.borderControlPost).toBeDefined();
      expect(result.borderControlPost.code).toBeDefined();

      expect(result.healthCertificate).toBeDefined();
      expect(result.transport).toBeDefined();
      expect(result.checks).toBeDefined();
      expect(result.timestamps).toBeDefined();
    });

    test('should include check status in CHED', async () => {
      const result = await tracesService.getCHED('CHED.ES.2024.CHEDP.CHECKS01');

      expect(result.checks.documentary.completed).toBe(true);
      expect(result.checks.identity.completed).toBe(true);
      expect(result.checks.physical.completed).toBe(false);
      expect(result.checks.physical.scheduled).toBe(true);
    });

    test('should include all timestamps', async () => {
      const result = await tracesService.getCHED('CHED.ES.2024.CHEDP.TIME001');

      expect(result.timestamps.created).toBeDefined();
      expect(result.timestamps.submitted).toBeDefined();
      expect(result.timestamps.lastUpdate).toBeDefined();
    });
  });

  describe('CHED Submission Validation Errors', () => {
    test('should handle submission validation errors', async () => {
      // La simulación retorna error ~20% de las veces
      let foundError = false;

      for (let i = 0; i < 30 && !foundError; i++) {
        const result = await tracesService.submitCHED('CHED.ES.2024.CHEDP.INVALID1');

        if (!result.success) {
          expect(result.status).toBe('DRAFT');
          expect(result.submittedAt).toBeNull();
          expect(result.validationErrors).toBeDefined();
          expect(Array.isArray(result.validationErrors)).toBe(true);
          expect(result.validationErrors.length).toBeGreaterThan(0);
          expect(result.message).toBe('Error de validación. Corrija los errores indicados.');
          foundError = true;
        }
      }

      expect(foundError).toBe(true);
    });

    test('should handle successful submission', async () => {
      // La simulación retorna success ~80% de las veces
      let foundSuccess = false;

      for (let i = 0; i < 30 && !foundSuccess; i++) {
        const result = await tracesService.submitCHED('CHED.ES.2024.CHEDP.VALID001');

        if (result.success) {
          expect(result.status).toBe('SUBMITTED');
          expect(result.submittedAt).toBeDefined();
          expect(result.validationErrors).toHaveLength(0);
          expect(result.message).toBe('CHED enviado correctamente para validación');
          foundSuccess = true;
        }
      }

      expect(foundSuccess).toBe(true);
    });
  });

  describe('Connectivity Test', () => {
    test('should test connectivity in simulation mode', async () => {
      const result = await tracesService.testConnectivity();

      expect(result.success).toBe(true);
      expect(result.environment).toBe('simulation');
      expect(result.message).toBe('Modo simulación activo');
      expect(result.chedTypes).toBe(4);
      expect(result.bcps).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();
    });

    test('should fail connectivity test when TRACES API throws error', async () => {
      const restore = setEnvironment('acceptance');

      try {
        const result = await tracesService.testConnectivity();

        // _callTRACESAPI lanza error en modo no-simulación
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.environment).toBe('acceptance');
        expect(result.timestamp).toBeDefined();
      } finally {
        restore();
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle CHED creation error when API call fails', async () => {
      const restore = setEnvironment('production');

      try {
        await expect(
          tracesService.createCHED({
            type: 'CHED_P',
            goods: { commodityCode: '0203291500' },
            originCountry: 'BR'
          })
        ).rejects.toThrow('Integración real pendiente');
      } finally {
        restore();
      }
    });

    test('should handle submit CHED error when API call fails', async () => {
      const restore = setEnvironment('acceptance');

      try {
        await expect(
          tracesService.submitCHED('CHED.ES.2024.CHEDP.TEST001')
        ).rejects.toThrow();
      } finally {
        restore();
      }
    });

    test('should handle getCHEDStatus error when API call fails', async () => {
      const restore = setEnvironment('production');

      try {
        await expect(
          tracesService.getCHEDStatus('CHED.ES.2024.CHEDP.TEST002')
        ).rejects.toThrow();
      } finally {
        restore();
      }
    });

    test('should handle getCHED error when API call fails', async () => {
      const restore = setEnvironment('acceptance');

      try {
        await expect(
          tracesService.getCHED('CHED.ES.2024.CHEDP.TEST003')
        ).rejects.toThrow();
      } finally {
        restore();
      }
    });

    test('should handle updateCHED error when API call fails', async () => {
      const restore = setEnvironment('production');

      try {
        await expect(
          tracesService.updateCHED('CHED.ES.2024.CHEDP.TEST004', { goods: {} })
        ).rejects.toThrow();
      } finally {
        restore();
      }
    });

    test('should handle registerControlDecision error when API call fails', async () => {
      const restore = setEnvironment('acceptance');

      try {
        await expect(
          tracesService.registerControlDecision('CHED.ES.2024.CHEDP.TEST005', {
            decision: 'ACCEPTABLE',
            documentaryCheck: {},
            identityCheck: {}
          })
        ).rejects.toThrow();
      } finally {
        restore();
      }
    });

    test('should handle requestLaboratoryAnalysis error when API call fails', async () => {
      const restore = setEnvironment('production');

      try {
        await expect(
          tracesService.requestLaboratoryAnalysis('CHED.ES.2024.CHEDP.TEST006', {
            laboratoryCode: 'ESLAB001',
            analysisType: 'MICROBIOLOGICAL'
          })
        ).rejects.toThrow();
      } finally {
        restore();
      }
    });

    test('should handle registerLaboratoryResult error when API call fails', async () => {
      const restore = setEnvironment('acceptance');

      try {
        await expect(
          tracesService.registerLaboratoryResult('LAB-TEST-001', {
            result: 'SATISFACTORY'
          })
        ).rejects.toThrow();
      } finally {
        restore();
      }
    });

    test('should handle searchCHEDs error when API call fails', async () => {
      const restore = setEnvironment('production');

      try {
        await expect(
          tracesService.searchCHEDs({ type: 'CHED-P' })
        ).rejects.toThrow();
      } finally {
        restore();
      }
    });

    test('should handle getInspectionFrequencies error when API call fails', async () => {
      const restore = setEnvironment('acceptance');

      try {
        await expect(
          tracesService.getInspectionFrequencies('BR', '0203291500')
        ).rejects.toThrow();
      } finally {
        restore();
      }
    });

    test('should handle verifyCertificate error when API call fails', async () => {
      const restore = setEnvironment('production');

      try {
        await expect(
          tracesService.verifyCertificate({
            certificateNumber: 'TEST-001',
            issuingCountry: 'BR'
          })
        ).rejects.toThrow();
      } finally {
        restore();
      }
    });

    test('should handle getApprovedEstablishments error when API call fails', async () => {
      const restore = setEnvironment('acceptance');

      try {
        await expect(
          tracesService.getApprovedEstablishments('BR', 'MEAT')
        ).rejects.toThrow();
      } finally {
        restore();
      }
    });

    test('should handle notifyArrival error when API call fails', async () => {
      const restore = setEnvironment('production');

      try {
        await expect(
          tracesService.notifyArrival({
            chedReference: 'CHED.ES.2024.CHEDP.TEST007',
            actualArrivalDate: '2024-08-06T10:00:00Z'
          })
        ).rejects.toThrow();
      } finally {
        restore();
      }
    });
  });

  describe('CHED Type Edge Cases', () => {
    test('should handle CHED-D determination', () => {
      // Capítulos CHED-D: 07, 08, 09, 10, 11, 12, 17, 18, 19, 20, 21
      const codes = [
        { taric: '0901210000', name: 'Café (cap 09)' },  // REAL: Café sin tostar
        { taric: '2204210000', name: 'Vino (cap 22)' },  // REAL: Vino con DOP <= 2L
      ];

      const coffee = tracesService.determineCHEDType({ taricCode: codes[0].taric });
      expect(coffee).toBeDefined();
      expect(coffee.type).toBe('CHED_D');
      expect(coffee.authority).toBe('Food Safety');

      const wine = tracesService.determineCHEDType({ taricCode: codes[1].taric });
      expect(wine).toBeNull(); // Cap 22 NO está en ningún CHED
    });

    test('should handle missing taricCode', () => {
      const result = tracesService.determineCHEDType({ taricCode: '' });
      expect(result).toBeNull();
    });

    test('should handle undefined goods', () => {
      const result = tracesService.determineCHEDType({});
      expect(result).toBeNull();
    });
  });

  describe('Country Authorization Edge Cases', () => {
    test('should return false for invalid product type', () => {
      const result = tracesService.isCountryAuthorized('BR', 'INVALID_TYPE');
      expect(result).toBe(false);
    });

    test('should return false for unauthorized country', () => {
      const result = tracesService.isCountryAuthorized('XX', 'animalProducts');
      expect(result).toBe(false);
    });

    test('should return empty array for invalid product type', () => {
      const countries = tracesService.getApprovedCountries('INVALID_TYPE');
      expect(countries).toEqual([]);
    });

    test('should return approved countries for all product types', () => {
      const types = ['animals', 'animalProducts', 'plants', 'food'];

      types.forEach(type => {
        const countries = tracesService.getApprovedCountries(type);
        expect(Array.isArray(countries)).toBe(true);
        expect(countries.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Configuration Methods', () => {
    test('should return configuration', () => {
      const config = tracesService.getConfig();

      expect(config.environment).toBe('simulation');
      expect(config.simulationMode).toBe(true);
      expect(config.baseUrl).toBeDefined();
      expect(config.chedTypes).toBe(4);
      expect(config.bcps).toBeGreaterThan(0);
    });

    test('should return service info', () => {
      const info = tracesService.getInfo();

      expect(info.service).toBe('TRACES Service');
      expect(info.version).toBe('1.0.0');
      expect(info.environment).toBe('simulation');
      expect(info.simulationMode).toBe(true);
      expect(info.chedTypes).toBe(4);
      expect(info.borderControlPosts).toBeGreaterThan(0);
      expect(info.laboratories).toBeGreaterThan(0);
      expect(info.description).toBeDefined();
    });
  });

  describe('CHED Status Query Edge Cases', () => {
    test('should return random status from all possible statuses', async () => {
      const statuses = new Set();

      // Ejecutar múltiples veces para capturar diferentes estados
      for (let i = 0; i < 50; i++) {
        const result = await tracesService.getCHEDStatus(`CHED.ES.2024.CHEDP.STATUS${i}`);

        expect(result.success).toBe(true);
        expect(result.status).toBeDefined();
        expect(result.canModify).toBeDefined();
        expect(result.history).toBeDefined();
        expect(Array.isArray(result.history)).toBe(true);

        statuses.add(result.status);
      }

      // Debería haber capturado múltiples estados diferentes
      expect(statuses.size).toBeGreaterThan(1);
    });
  });
});
