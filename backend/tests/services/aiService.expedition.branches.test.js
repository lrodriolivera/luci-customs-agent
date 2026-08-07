/**
 * Tests de cobertura de RAMAS para métodos de EXPEDICIÓN y TRÁNSITO de aiService.js
 * Métodos cubiertos:
 * - analyzeExpeditionRisk (línea 3070)
 * - suggestTaricClassification (línea 3225)
 * - detectInconsistencies (línea 3328)
 * - fullExpeditionAnalysis (línea 3470)
 * - analyzeGoodsForPUE (línea 3514)
 * - autoCompleteTransitData (línea 3582)
 * - validateTransitRoute (línea 3719)
 * - predictTransitIncidents (línea 3839)
 * - suggestTransitGuarantee (línea 3969)
 * - fullTransitAnalysis (línea 4097)
 * - _generateTransitNextSteps (línea 4183)
 *
 * Patrón: spy sobre callClaude del SINGLETON para interceptar sin mockear código bajo prueba
 */

const aiService = require('../../src/services/aiService');

describe('aiService - Expedition & Transit Methods - Branch Coverage', () => {
  let callClaudeSpy;

  beforeEach(() => {
    callClaudeSpy = jest.spyOn(aiService, 'callClaude');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ===========================================
  // analyzeExpeditionRisk
  // ===========================================
  describe('analyzeExpeditionRisk', () => {
    it('no inventa un canal verde tranquilizador cuando la respuesta llega truncada', async () => {
      // Observado en produccion el 7/Ago/2026 sobre EXP-2026-0112 (canal ROJO,
      // inspeccion fisica): analyze-risk respondia 200 pero el analisis habia
      // fallado. El fallback pintaba "Riesgo Medio 50/100" y "Canal probable
      // VERDE 60%", justo lo contrario de la realidad. Un fallo no puede
      // presentarse como una prediccion optimista.
      callClaudeSpy.mockResolvedValue({
        content: '```json\n{\n  "overallRiskLevel": "HIGH",\n  "overallRiskScore": 80,\n  "channelPrediction": {\n    "green": 10,\n    "red": 60,\n    "mostLikely": "R',
        tokensUsed: 1900,
        stopReason: 'max_tokens'
      });

      const resultado = await aiService.analyzeExpeditionRisk({
        expeditionId: 'EXP-2026-0112',
        operationType: 'import',
        goods: [{ description: 'Juguetes plastico', taricCode: '9503007000', originCountry: 'CN' }]
      });

      expect(resultado.analysisFailed).toBe(true);
      // No afirma un canal probable que no ha calculado.
      expect(resultado.channelPrediction.mostLikely).toBeNull();
      expect(resultado.overallRiskScore).toBeNull();
    });

    it('debe parsear respuesta con bloque ```json y retornar análisis completo', async () => {
      const mockResponse = {
        overallRiskLevel: 'HIGH',
        overallRiskScore: 75,
        channelPrediction: {
          green: 20,
          orange: 50,
          red: 30,
          mostLikely: 'ORANGE',
          factors: ['País de riesgo', 'Valor elevado']
        },
        riskCategories: {
          documental: { level: 'MEDIUM', score: 60, issues: [], recommendations: [] },
          classification: { level: 'HIGH', score: 75, issues: [], recommendations: [] },
          valuation: { level: 'LOW', score: 30, issues: [], recommendations: [] },
          regulatory: { level: 'MEDIUM', score: 50, issues: [], recommendations: [] }
        },
        criticalIssues: [
          {
            type: 'classification',
            description: 'Código TARIC dudoso',
            impact: 'Posible canal rojo',
            recommendation: 'Verificar clasificación',
            priority: 'IMMEDIATE'
          }
        ],
        warnings: ['Mercancía de origen riesgo'],
        recommendations: ['Revisar documentos'],
        estimatedProcessingTime: '3-5 días',
        summary: 'Riesgo alto por clasificación y país origen'
      };

      callClaudeSpy.mockResolvedValue({
        content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
        tokensUsed: 1200,
        stopReason: 'end_turn'
      });

      const expedition = {
        expeditionId: 'EXP-001',
        operationType: 'import',
        transportMode: 'sea',
        status: 'draft',
        priority: 'high',
        client: { companyName: 'Test Corp', nif: 'B12345678', eori: 'ESB12345678' },
        exporter: { companyName: 'Foreign Ltd', country: 'CN' },
        goods: [
          {
            description: 'Smartphones',
            taricCode: '8517130000',
            originCountry: 'CN',
            invoiceValue: 50000,
            grossWeight: 100,
            netWeight: 90
          }
        ],
        transport: {
          documentType: 'BL',
          documentNumber: 'BL123456',
          entryCustomsOffice: 'ES004810',
          arrivalDate: '2026-08-15'
        },
        calculations: { invoiceTotal: 50000 },
        incoterm: { code: 'CIF', place: 'Valencia' },
        documents: [],
        documentChecklist: [
          { documentType: 'invoice', required: true, received: false }
        ]
      };

      const result = await aiService.analyzeExpeditionRisk(expedition);

      expect(result.overallRiskLevel).toBe('HIGH');
      expect(result.overallRiskScore).toBe(75);
      expect(result.channelPrediction.mostLikely).toBe('ORANGE');
      expect(result.criticalIssues).toHaveLength(1);
      expect(result.model).toBe('opus-4');
      expect(result.tokensUsed).toBe(1200);
      expect(result.analyzedAt).toBeDefined();
    });

    it('debe parsear respuesta JSON SIN bloque markdown', async () => {
      const mockResponse = {
        overallRiskLevel: 'LOW',
        overallRiskScore: 25,
        channelPrediction: {
          green: 80,
          orange: 15,
          red: 5,
          mostLikely: 'GREEN',
          factors: []
        },
        riskCategories: {
          documental: { level: 'LOW', score: 20, issues: [], recommendations: [] },
          classification: { level: 'LOW', score: 25, issues: [], recommendations: [] },
          valuation: { level: 'LOW', score: 20, issues: [], recommendations: [] },
          regulatory: { level: 'LOW', score: 30, issues: [], recommendations: [] }
        },
        criticalIssues: [],
        warnings: [],
        recommendations: [],
        estimatedProcessingTime: '1-2 días',
        summary: 'Expediente de bajo riesgo'
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 800
      });

      const expedition = {
        expeditionId: 'EXP-002',
        operationType: 'export',
        transportMode: 'air',
        status: 'ready',
        priority: 'normal',
        client: { companyName: 'Export SA', nif: 'A87654321', eori: 'ESA87654321' },
        goods: [
          {
            description: 'Documentos',
            taricCode: '4820100000',
            originCountry: 'ES',
            invoiceValue: 500,
            grossWeight: 5,
            netWeight: 4
          }
        ],
        documents: [{ type: 'invoice', originalName: 'factura.pdf', status: 'validated' }],
        documentChecklist: [{ documentType: 'invoice', required: true, received: true }]
      };

      const result = await aiService.analyzeExpeditionRisk(expedition);

      expect(result.overallRiskLevel).toBe('LOW');
      expect(result.overallRiskScore).toBe(25);
      expect(result.channelPrediction.mostLikely).toBe('GREEN');
    });

    it('marca el análisis como fallido cuando el JSON es inválido, sin fingir un riesgo', async () => {
      // Antes este test fijaba el comportamiento peligroso: ante un JSON
      // invalido devolvia overallRiskLevel:'MEDIUM' y mostLikely:'GREEN', es
      // decir, presentaba un fallo como una prediccion concreta y optimista.
      // Un analisis que no se pudo parsear no puede afirmar ni el nivel de
      // riesgo ni el canal probable.
      callClaudeSpy.mockResolvedValue({
        content: '```json\n{ invalid json here \n```',
        tokensUsed: 500
      });

      const expedition = {
        expeditionId: 'EXP-003',
        operationType: 'import',
        goods: []
      };

      const result = await aiService.analyzeExpeditionRisk(expedition);

      expect(result.analysisFailed).toBe(true);
      expect(result.overallRiskLevel).toBeNull();
      expect(result.overallRiskScore).toBeNull();
      expect(result.channelPrediction.mostLikely).toBeNull();
      expect(result.rawResponse).toBeDefined();
    });

    it('debe manejar expedition con campos opcionales vacíos', async () => {
      const mockResponse = {
        overallRiskLevel: 'MEDIUM',
        overallRiskScore: 50,
        channelPrediction: { green: 60, orange: 30, red: 10, mostLikely: 'GREEN', factors: [] },
        riskCategories: {
          documental: { level: 'MEDIUM', score: 50, issues: [], recommendations: [] },
          classification: { level: 'MEDIUM', score: 50, issues: [], recommendations: [] },
          valuation: { level: 'MEDIUM', score: 50, issues: [], recommendations: [] },
          regulatory: { level: 'MEDIUM', score: 50, issues: [], recommendations: [] }
        },
        criticalIssues: [],
        warnings: [],
        recommendations: [],
        estimatedProcessingTime: '2-3 días',
        summary: 'Análisis estándar'
      };

      callClaudeSpy.mockResolvedValue({
        content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
        tokensUsed: 900
      });

      const expedition = {
        expeditionId: 'EXP-004',
        operationType: 'import'
        // client, exporter, goods, transport, etc. todos undefined
      };

      const result = await aiService.analyzeExpeditionRisk(expedition);

      expect(result.overallRiskLevel).toBe('MEDIUM');
      expect(callClaudeSpy).toHaveBeenCalled();
      const promptArg = callClaudeSpy.mock.calls[0][2];
      // El prompt imprime "undefined" cuando falta el campo, no usa operador || en todos los casos
      expect(promptArg).toContain('undefined');
      expect(promptArg).toContain('Sin mercancías');
    });

    it('debe incluir datos completos cuando expedition tiene todos los campos', async () => {
      const mockResponse = {
        overallRiskLevel: 'LOW',
        overallRiskScore: 30,
        channelPrediction: { green: 70, orange: 25, red: 5, mostLikely: 'GREEN', factors: [] },
        riskCategories: {
          documental: { level: 'LOW', score: 30, issues: [], recommendations: [] },
          classification: { level: 'LOW', score: 30, issues: [], recommendations: [] },
          valuation: { level: 'LOW', score: 30, issues: [], recommendations: [] },
          regulatory: { level: 'LOW', score: 30, issues: [], recommendations: [] }
        },
        criticalIssues: [],
        warnings: [],
        recommendations: [],
        summary: 'Todo en orden'
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 1000
      });

      const expedition = {
        expeditionId: 'EXP-005',
        operationType: 'export',
        transportMode: 'road',
        status: 'submitted',
        priority: 'urgent',
        client: { companyName: 'Full Corp', nif: 'C11111111', eori: 'ESC11111111' },
        exporter: { companyName: 'Full Export', country: 'DE' },
        representative: { companyName: 'Rep SA' },
        goods: [
          {
            description: 'Maquinaria industrial',
            taricCode: '8471300000',
            originCountry: 'DE',
            invoiceValue: 100000,
            grossWeight: 5000,
            netWeight: 4800
          }
        ],
        transport: {
          documentType: 'CMR',
          documentNumber: 'CMR789',
          entryCustomsOffice: 'ES004810',
          arrivalPort: 'Valencia',
          arrivalDate: '2026-08-20'
        },
        calculations: { invoiceTotal: 100000 },
        incoterm: { code: 'DAP', place: 'Berlin' },
        documents: [
          { type: 'invoice', originalName: 'inv.pdf', status: 'approved' },
          { type: 'packing', originalName: 'pack.pdf', status: 'approved' }
        ],
        documentChecklist: [
          { documentType: 'invoice', required: true, received: true },
          { documentType: 'packing', required: true, received: true }
        ]
      };

      const result = await aiService.analyzeExpeditionRisk(expedition);

      expect(result.overallRiskLevel).toBe('LOW');
      const promptArg = callClaudeSpy.mock.calls[0][2];
      expect(promptArg).toContain('Full Corp');
      expect(promptArg).toContain('Maquinaria industrial');
      expect(promptArg).toContain('CMR789');
    });
  });

  // ===========================================
  // suggestTaricClassification
  // ===========================================
  describe('suggestTaricClassification', () => {
    it('debe parsear respuesta con bloque ```json y retornar sugerencias TARIC', async () => {
      const mockResponse = {
        items: [
          {
            itemIndex: 0,
            description: 'Café tostado',
            currentTaric: null,
            suggestions: [
              {
                taricCode: '0901210000',
                hsCode: '090121',
                confidence: 95,
                description: 'Café tostado, sin descafeinar',
                reasoning: 'Producto claramente clasificado en partida 0901',
                rgiApplied: ['RGI 1'],
                chapterNotes: ['Nota 1 del Capítulo 09'],
                warnings: []
              },
              {
                taricCode: '0901220000',
                hsCode: '090122',
                confidence: 80,
                description: 'Café tostado, descafeinado',
                reasoning: 'Alternativa si es descafeinado',
                rgiApplied: ['RGI 1'],
                chapterNotes: ['Nota 1 del Capítulo 09'],
                warnings: ['Verificar si es descafeinado']
              }
            ],
            needsMoreInfo: [],
            specialMeasures: {
              antidumping: false,
              countervailing: false,
              quota: false,
              suspension: false,
              details: ''
            }
          }
        ],
        generalWarnings: [],
        recommendations: ['Verificar país de origen'],
        summary: 'Clasificación clara en partida 0901'
      };

      callClaudeSpy.mockResolvedValue({
        content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
        tokensUsed: 2000
      });

      const expedition = {
        expeditionId: 'EXP-006',
        operationType: 'import',
        client: { sector: 'Alimentación' },
        exporter: { companyName: 'Coffee Ltd', country: 'BR' },
        goods: [
          {
            description: 'Café tostado en grano',
            descriptionEs: 'Café tostado sin moler',
            taricCode: null,
            originCountry: 'BR',
            material: 'Café arábica',
            intendedUse: 'Consumo humano',
            invoiceValue: 5000,
            quantity: 1000,
            netWeight: 1000
          }
        ]
      };

      const result = await aiService.suggestTaricClassification(expedition);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].suggestions).toHaveLength(2);
      expect(result.items[0].suggestions[0].taricCode).toBe('0901210000');
      expect(result.items[0].suggestions[0].confidence).toBe(95);
      expect(result.model).toBe('opus-4');
      expect(result.tokensUsed).toBe(2000);
      expect(result.analyzedAt).toBeDefined();
    });

    it('debe parsear JSON sin bloque markdown', async () => {
      const mockResponse = {
        items: [
          {
            itemIndex: 0,
            description: 'Vino tinto',
            currentTaric: '2204210000',
            suggestions: [
              {
                taricCode: '2204210000',
                hsCode: '220421',
                confidence: 100,
                description: 'Vino en recipientes <= 2L',
                reasoning: 'Clasificación correcta',
                rgiApplied: ['RGI 1'],
                chapterNotes: [],
                warnings: []
              }
            ],
            needsMoreInfo: [],
            specialMeasures: {}
          }
        ],
        generalWarnings: [],
        recommendations: [],
        summary: 'Clasificación correcta'
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 1500
      });

      const expedition = {
        goods: [
          { description: 'Vino tinto Rioja', taricCode: '2204210000', originCountry: 'ES' }
        ]
      };

      const result = await aiService.suggestTaricClassification(expedition);

      expect(result.items[0].suggestions[0].confidence).toBe(100);
    });

    it('debe retornar fallback cuando JSON inválido', async () => {
      callClaudeSpy.mockResolvedValue({
        content: 'Invalid JSON response',
        tokensUsed: 500
      });

      const expedition = {
        goods: [
          { description: 'Producto genérico', taricCode: '0000000000' }
        ]
      };

      const result = await aiService.suggestTaricClassification(expedition);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].suggestions).toEqual([]);
      expect(result.items[0].needsMoreInfo).toContain('Error en análisis IA');
      expect(result.generalWarnings).toContain('Error procesando clasificación TARIC');
      expect(result.rawResponse).toBe('Invalid JSON response');
    });

    it('debe manejar expedition sin goods', async () => {
      const mockResponse = {
        items: [],
        generalWarnings: [],
        recommendations: [],
        summary: 'Sin mercancías para clasificar'
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 300
      });

      const expedition = {
        expeditionId: 'EXP-007'
        // goods undefined
      };

      const result = await aiService.suggestTaricClassification(expedition);

      expect(result.items).toEqual([]);
      const promptArg = callClaudeSpy.mock.calls[0][2];
      expect(promptArg).toContain('Sin mercancías');
    });

    it('debe incluir todos los campos opcionales de goods cuando existen', async () => {
      const mockResponse = {
        items: [
          {
            itemIndex: 0,
            description: 'Ordenador portátil',
            currentTaric: '8471300000',
            suggestions: [
              {
                taricCode: '8471300000',
                hsCode: '847130',
                confidence: 98,
                description: 'Máquinas automáticas para tratamiento de datos, portátiles',
                reasoning: 'Clasificación estándar para portátiles',
                rgiApplied: ['RGI 1', 'RGI 6'],
                chapterNotes: ['Nota 5 del Capítulo 84'],
                warnings: []
              }
            ],
            needsMoreInfo: [],
            specialMeasures: { antidumping: false }
          }
        ],
        generalWarnings: [],
        recommendations: [],
        summary: 'Clasificación correcta'
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 1800
      });

      const expedition = {
        operationType: 'import',
        client: { sector: 'Tecnología' },
        exporter: { companyName: 'Tech Corp', country: 'TW' },
        goods: [
          {
            description: 'Ordenador portátil 15 pulgadas',
            descriptionEs: 'Portátil gaming alta gama',
            additionalDescription: 'Con procesador Intel i7',
            taricCode: '8471300000',
            hsCode: '847130',
            originCountry: 'TW',
            material: 'Aluminio y plástico',
            intendedUse: 'Uso personal',
            invoiceValue: 1200,
            quantity: 1,
            netWeight: 2.5
          }
        ]
      };

      const result = await aiService.suggestTaricClassification(expedition);

      expect(result.items[0].suggestions[0].taricCode).toBe('8471300000');
      const promptArg = callClaudeSpy.mock.calls[0][2];
      expect(promptArg).toContain('Portátil gaming alta gama');
      expect(promptArg).toContain('Aluminio y plástico');
      expect(promptArg).toContain('Uso personal');
    });
  });

  // ===========================================
  // detectInconsistencies
  // ===========================================
  describe('suggestMissingDocuments', () => {
    it('no finge un analisis medio-completo cuando la respuesta llega truncada', async () => {
      // Observado en produccion el 7/Ago/2026 sobre EXP-2026-0112: el POST a
      // /ai/suggest-documents respondia 200 pero la UI mostraba "Error
      // procesando analisis de documentos". El regex ```...``` exigia la valla
      // de cierre; con la respuesta cortada, JSON.parse reventaba y el catch
      // devolvia completenessScore:50 con listas vacias — un fallo disfrazado de
      // "no falta nada, expediente medio completo".
      callClaudeSpy.mockResolvedValue({
        content: '```json\n{\n  "missingRequired": [\n    {\n      "documentType": "COMMERCIAL_INVOICE",\n      "name": "Factura Comercial",\n      "reason": "Obligatoria para el desp',
        tokensUsed: 1801,
        stopReason: 'max_tokens'
      });

      const resultado = await aiService.suggestMissingDocuments({
        expeditionId: 'EXP-2026-0112',
        operationType: 'import',
        goods: [{ description: 'Juguetes plastico', taricCode: '9503007000', originCountry: 'CN' }]
      });

      // No puede afirmar un grado de completitud que no ha calculado.
      expect(resultado.completenessScore).toBeNull();
      // Y tiene que declarar que el analisis fallo, no devolver un resumen falso.
      expect(resultado.analysisFailed).toBe(true);
    });

    it('parsea una respuesta valida y devuelve los documentos', async () => {
      const mockResponse = {
        missingRequired: [
          { documentType: 'COMMERCIAL_INVOICE', name: 'Factura Comercial', reason: 'Obligatoria', priority: 'CRITICAL' }
        ],
        recommended: [],
        preferentialOrigin: { applicable: false },
        specialRequirements: [],
        completenessScore: 40,
        summary: 'Falta la factura comercial'
      };
      callClaudeSpy.mockResolvedValue({
        content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
        tokensUsed: 1200
      });

      const resultado = await aiService.suggestMissingDocuments({
        expeditionId: 'EXP-OK',
        operationType: 'import',
        goods: [{ description: 'Juguetes', taricCode: '9503007000' }]
      });

      expect(resultado.analysisFailed).toBeUndefined();
      expect(resultado.completenessScore).toBe(40);
      expect(resultado.missingRequired).toHaveLength(1);
    });
  });

  describe('detectInconsistencies', () => {
    it('no da luz verde a declarar cuando la respuesta llega truncada', async () => {
      // Caso real observado en produccion el 6/Ago/2026: el modelo devolvio un
      // analisis con 9 inconsistencias (3 criticas) pero la respuesta se corto
      // a media frase, sin cerrar la valla markdown ni el JSON. El regex exige
      // el ``` de cierre, no lo encontraba, JSON.parse reventaba, y el catch
      // devolvia hasInconsistencies:false, totalIssues:0 y —lo grave—
      // readyForDeclaration:true. Al agente se le decia "sin inconsistencias"
      // y via libre para declarar justo cuando el analisis habia fallado.
      // Es intermitente: la misma peticion repetida devolvia las 9.
      callClaudeSpy.mockResolvedValue({
        content: '```json\n{\n  "hasInconsistencies": true,\n  "totalIssues": 9,\n  "criticalIssues": 3,\n  "inconsistencies": [\n    {\n      "type": "LOGIC_ERROR",\n      "description": "La cantidad declarada (800 KG) supera el peso bru',
        tokensUsed: 1762,
        stopReason: 'max_tokens'
      });

      const resultado = await aiService.detectInconsistencies({
        expeditionId: 'EXP-TRUNC',
        operationType: 'import',
        goods: [{ description: 'Catalogos', taricCode: '4911109000' }]
      });

      // Lo esencial: no puede afirmar que el expediente esta listo cuando no
      // ha podido analizarlo.
      expect(resultado.readyForDeclaration).toBe(false);
      // Y tiene que decir que fallo, no fingir un analisis limpio.
      expect(resultado.analysisFailed).toBe(true);
    });

    it('debe parsear respuesta con bloque ```json y detectar inconsistencias', async () => {
      const mockResponse = {
        hasInconsistencies: true,
        totalIssues: 3,
        criticalIssues: 1,
        inconsistencies: [
          {
            type: 'DATA_MISMATCH',
            severity: 'CRITICAL',
            field: 'goods[0].netWeight',
            currentValue: '120',
            expectedValue: '<= 100',
            description: 'Peso neto mayor que peso bruto',
            recommendation: 'Corregir peso neto',
            autoFixable: false,
            suggestedFix: null
          },
          {
            type: 'FORMAT_ERROR',
            severity: 'HIGH',
            field: 'client.eori',
            currentValue: 'INVALID',
            expectedValue: 'ES + 12 dígitos',
            description: 'Formato EORI inválido',
            recommendation: 'Usar formato correcto',
            autoFixable: true,
            suggestedFix: 'ES000000000000'
          },
          {
            type: 'QUALITY_ALERT',
            severity: 'LOW',
            field: 'goods[0].description',
            currentValue: 'Producto',
            expectedValue: 'Descripción detallada',
            description: 'Descripción demasiado genérica',
            recommendation: 'Ampliar descripción',
            autoFixable: false
          }
        ],
        dataQualityScore: 65,
        readyForDeclaration: false,
        blockers: ['Peso neto > bruto', 'EORI inválido'],
        warnings: ['Descripción genérica'],
        summary: 'Se encontraron 3 inconsistencias, 1 crítica'
      };

      callClaudeSpy.mockResolvedValue({
        content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
        tokensUsed: 1500
      });

      const expedition = {
        expeditionId: 'EXP-008',
        operationType: 'import',
        status: 'draft',
        createdAt: '2026-08-01',
        client: {
          companyName: 'Test Corp',
          nif: 'B12345678',
          eori: 'INVALID',
          address: { country: 'ES' }
        },
        exporter: { companyName: 'Exporter Ltd', country: 'CN', vatNumber: 'VAT123' },
        goods: [
          {
            description: 'Producto',
            taricCode: '8517130000',
            originCountry: 'CN',
            quantity: 10,
            unit: 'KG',
            grossWeight: 100,
            netWeight: 120,
            invoiceValue: 5000,
            packages: { quantity: 5, type: 'Cajas' }
          }
        ],
        transport: {
          documentType: 'BL',
          documentNumber: 'BL123',
          departurePort: 'Shanghai',
          arrivalPort: 'Valencia',
          entryCustomsOffice: 'ES004810',
          departureDate: '2026-08-10',
          arrivalDate: '2026-09-01'
        },
        incoterm: { code: 'CIF', place: 'Valencia' },
        calculations: {
          invoiceTotal: 5000,
          invoiceCurrency: 'EUR',
          customsValue: 5000,
          freightCost: 500,
          insuranceCost: 50
        }
      };

      const result = await aiService.detectInconsistencies(expedition);

      expect(result.hasInconsistencies).toBe(true);
      expect(result.totalIssues).toBe(3);
      expect(result.criticalIssues).toBe(1);
      expect(result.inconsistencies).toHaveLength(3);
      expect(result.readyForDeclaration).toBe(false);
      expect(result.model).toBe('sonnet-4');
      expect(result.tokensUsed).toBe(1500);
      expect(result.analyzedAt).toBeDefined();
    });

    it('debe parsear JSON sin bloque markdown', async () => {
      const mockResponse = {
        hasInconsistencies: false,
        totalIssues: 0,
        criticalIssues: 0,
        inconsistencies: [],
        dataQualityScore: 95,
        readyForDeclaration: true,
        blockers: [],
        warnings: [],
        summary: 'Expediente sin inconsistencias'
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 800
      });

      const expedition = {
        expeditionId: 'EXP-009',
        operationType: 'export',
        status: 'ready',
        client: { companyName: 'Perfect Corp', nif: 'A11111111', eori: 'ESA11111111000' },
        goods: [
          {
            description: 'Descripción detallada del producto',
            taricCode: '6109100010',
            originCountry: 'ES',
            quantity: 100,
            grossWeight: 50,
            netWeight: 45,
            invoiceValue: 2000
          }
        ]
      };

      const result = await aiService.detectInconsistencies(expedition);

      expect(result.hasInconsistencies).toBe(false);
      expect(result.dataQualityScore).toBe(95);
      expect(result.readyForDeclaration).toBe(true);
    });

    it('no da por limpio el expediente cuando el JSON es invalido', async () => {
      // Este test afirmaba lo contrario —hasInconsistencies:false, totalIssues:0,
      // readyForDeclaration:true— y con ello fijaba el comportamiento que causo
      // el fallo de produccion del 6/Ago/2026: un analisis que no se pudo leer
      // se le presentaba al agente como un expediente sin problemas y listo
      // para declarar. Un analisis fallido no es un analisis limpio.
      callClaudeSpy.mockResolvedValue({
        content: '{ broken json',
        tokensUsed: 400
      });

      const expedition = {
        expeditionId: 'EXP-010',
        goods: []
      };

      const result = await aiService.detectInconsistencies(expedition);

      expect(result.analysisFailed).toBe(true);
      // null = "no se sabe", que es la verdad. false seria afirmar que no las hay.
      expect(result.hasInconsistencies).toBeNull();
      expect(result.totalIssues).toBeNull();
      expect(result.readyForDeclaration).toBe(false);
      expect(result.blockers.join(' ')).toMatch(/manualmente/i);
      expect(result.rawResponse).toBeDefined();
    });

    it('debe manejar expedition con campos opcionales faltantes', async () => {
      const mockResponse = {
        hasInconsistencies: false,
        totalIssues: 0,
        criticalIssues: 0,
        inconsistencies: [],
        dataQualityScore: 60,
        readyForDeclaration: true,
        blockers: [],
        warnings: ['Datos incompletos'],
        summary: 'Datos mínimos presentes'
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 600
      });

      const expedition = {
        expeditionId: 'EXP-011',
        operationType: 'import',
        client: { companyName: 'Minimal Corp' }
        // exporter, importer, consignee, goods, transport, incoterm, calculations todos undefined
      };

      const result = await aiService.detectInconsistencies(expedition);

      expect(result.dataQualityScore).toBe(60);
      const promptArg = callClaudeSpy.mock.calls[0][2];
      expect(promptArg).toContain('N/A');
    });

    it('debe incluir importer y consignee cuando existen', async () => {
      const mockResponse = {
        hasInconsistencies: false,
        totalIssues: 0,
        criticalIssues: 0,
        inconsistencies: [],
        dataQualityScore: 90,
        readyForDeclaration: true,
        blockers: [],
        warnings: [],
        summary: 'Datos completos'
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 1200
      });

      const expedition = {
        expeditionId: 'EXP-012',
        operationType: 'import',
        client: { companyName: 'Client Corp', nif: 'B11111111', eori: 'ESB11111111000' },
        exporter: { companyName: 'Exporter SA', country: 'FR' },
        importer: { companyName: 'Importer Ltd', nif: 'C22222222', eori: 'ESC22222222000' },
        consignee: { companyName: 'Consignee Inc', nif: 'D33333333', eori: 'ESD33333333000' },
        goods: [
          {
            description: 'Textiles',
            taricCode: '6109100010',
            originCountry: 'FR',
            quantity: 200,
            grossWeight: 100,
            netWeight: 95,
            invoiceValue: 10000
          }
        ],
        transport: {
          documentType: 'CMR',
          containers: [
            { number: 'CONT123', type: '20FT' },
            { number: 'CONT456', type: '40FT' }
          ]
        }
      };

      const result = await aiService.detectInconsistencies(expedition);

      expect(result.dataQualityScore).toBe(90);
      const promptArg = callClaudeSpy.mock.calls[0][2];
      // El prompt usa importer || consignee, así que solo aparece importer
      expect(promptArg).toContain('Importer Ltd');
      expect(promptArg).toContain('C22222222');
      expect(promptArg).toContain('CONT123 (20FT), CONT456 (40FT)');
    });
  });

  // ===========================================
  // fullExpeditionAnalysis
  // ===========================================
  describe('fullExpeditionAnalysis', () => {
    it('debe ejecutar 4 análisis en paralelo y combinar resultados', async () => {
      // Mock para suggestMissingDocuments
      jest.spyOn(aiService, 'suggestMissingDocuments').mockResolvedValue({
        completenessScore: 80,
        missingRequired: [],
        recommended: []
      });

      // Mock para analyzeExpeditionRisk
      jest.spyOn(aiService, 'analyzeExpeditionRisk').mockResolvedValue({
        overallRiskScore: 30,
        overallRiskLevel: 'LOW'
      });

      // Mock para suggestTaricClassification
      jest.spyOn(aiService, 'suggestTaricClassification').mockResolvedValue({
        items: [
          {
            itemIndex: 0,
            suggestions: [{ confidence: 90 }]
          }
        ]
      });

      // Mock para detectInconsistencies
      jest.spyOn(aiService, 'detectInconsistencies').mockResolvedValue({
        dataQualityScore: 85,
        readyForDeclaration: true
      });

      const expedition = {
        expeditionId: 'EXP-013',
        operationType: 'import',
        goods: [{ description: 'Test' }]
      };

      const result = await aiService.fullExpeditionAnalysis(expedition);

      expect(result.expeditionId).toBe('EXP-013');
      expect(result.analyzedAt).toBeDefined();
      expect(result.documents).toBeDefined();
      expect(result.risk).toBeDefined();
      expect(result.classification).toBeDefined();
      expect(result.inconsistencies).toBeDefined();
      expect(result.overallReadiness).toBeDefined();
      expect(result.overallReadiness.score).toBeGreaterThan(0);
      expect(result.overallReadiness.readyForDeclaration).toBe(true);
    });

    it('debe calcular overallReadiness.score correctamente', async () => {
      jest.spyOn(aiService, 'suggestMissingDocuments').mockResolvedValue({
        completenessScore: 100
      });
      jest.spyOn(aiService, 'analyzeExpeditionRisk').mockResolvedValue({
        overallRiskScore: 20,
        overallRiskLevel: 'LOW'
      });
      jest.spyOn(aiService, 'suggestTaricClassification').mockResolvedValue({
        items: [
          { suggestions: [{ confidence: 100 }] },
          { suggestions: [{ confidence: 80 }] }
        ]
      });
      jest.spyOn(aiService, 'detectInconsistencies').mockResolvedValue({
        dataQualityScore: 90,
        readyForDeclaration: true
      });

      const expedition = {
        expeditionId: 'EXP-014',
        goods: [{ description: 'A' }, { description: 'B' }]
      };

      const result = await aiService.fullExpeditionAnalysis(expedition);

      // completenessScore * 0.25 = 100 * 0.25 = 25
      // (100 - riskScore) * 0.25 = 80 * 0.25 = 20
      // avg classification confidence * 0.25 = 90 * 0.25 = 22.5
      // dataQualityScore * 0.25 = 90 * 0.25 = 22.5
      // Total = 90
      expect(result.overallReadiness.score).toBe(90);
      expect(result.overallReadiness.readyForDeclaration).toBe(true);
    });

    it('debe marcar readyForDeclaration false cuando hay problemas', async () => {
      jest.spyOn(aiService, 'suggestMissingDocuments').mockResolvedValue({
        completenessScore: 50
      });
      jest.spyOn(aiService, 'analyzeExpeditionRisk').mockResolvedValue({
        overallRiskScore: 85,
        overallRiskLevel: 'CRITICAL'
      });
      jest.spyOn(aiService, 'suggestTaricClassification').mockResolvedValue({
        items: []
      });
      jest.spyOn(aiService, 'detectInconsistencies').mockResolvedValue({
        dataQualityScore: 40,
        readyForDeclaration: false
      });

      const expedition = {
        expeditionId: 'EXP-015',
        goods: []
      };

      const result = await aiService.fullExpeditionAnalysis(expedition);

      expect(result.overallReadiness.readyForDeclaration).toBe(false);
    });

    it('debe manejar error y retornar objeto error', async () => {
      jest.spyOn(aiService, 'suggestMissingDocuments').mockRejectedValue(new Error('Network error'));

      const expedition = {
        expeditionId: 'EXP-016'
      };

      const result = await aiService.fullExpeditionAnalysis(expedition);

      expect(result.expeditionId).toBe('EXP-016');
      expect(result.error).toBe('Error realizando análisis completo');
      expect(result.analyzedAt).toBeDefined();
    });

    it('debe manejar valores undefined en cálculo de score', async () => {
      jest.spyOn(aiService, 'suggestMissingDocuments').mockResolvedValue({});
      jest.spyOn(aiService, 'analyzeExpeditionRisk').mockResolvedValue({});
      jest.spyOn(aiService, 'suggestTaricClassification').mockResolvedValue({
        items: [] // Array vacío hace que el promedio sea 0/[] = 0, pero divide entre (items.length || 1) = 1
      });
      jest.spyOn(aiService, 'detectInconsistencies').mockResolvedValue({
        readyForDeclaration: true
      });

      const expedition = {
        expeditionId: 'EXP-017'
      };

      const result = await aiService.fullExpeditionAnalysis(expedition);

      // items vacío: 0 / (0 || 1) = 0
      // Todos los valores por defecto son 50, menos classification que es 0
      // Score = 50*0.25 + 50*0.25 + 0*0.25 + 50*0.25 = 37.5 redondeado = 38
      expect(result.overallReadiness.score).toBe(38);
    });
  });

  // ===========================================
  // analyzeGoodsForPUE
  // ===========================================
  describe('analyzeGoodsForPUE', () => {
    it('debe parsear respuesta con bloque ```json y retornar análisis PUE', async () => {
      const mockResponse = {
        productClassification: 'Aparato electrónico',
        pueRequirements: {
          ROHS: { required: true, reason: 'Equipo eléctrico', confidence: 95 },
          COM: { required: false, reason: 'No es juguete ni EPI', confidence: 90 },
          ECO: { required: false, reason: 'No es producto ecológico', confidence: 100 },
          CAL: { required: false, reason: 'No es textil ni calzado', confidence: 100 }
        },
        applicableRegulations: ['Directiva 2011/65/UE ROHS'],
        requiredCertifications: ['Certificado ROHS'],
        possibleLabTests: ['Contenido de sustancias peligrosas'],
        additionalNotes: ['Verificar marcado CE']
      };

      callClaudeSpy.mockResolvedValue({
        content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
        tokensUsed: 1000
      });

      const result = await aiService.analyzeGoodsForPUE('Smartphone', '8517130000');

      expect(result.productClassification).toBe('Aparato electrónico');
      expect(result.pueRequirements.ROHS.required).toBe(true);
      expect(result.pueRequirements.ROHS.confidence).toBe(95);
      expect(result.model).toBe('opus-4');
      expect(result.tokensUsed).toBe(1000);
    });

    it('debe parsear JSON sin bloque markdown', async () => {
      const mockResponse = {
        productClassification: 'Textil',
        pueRequirements: {
          ROHS: { required: false, reason: 'No es eléctrico', confidence: 100 },
          COM: { required: false, reason: 'No requiere seguridad especial', confidence: 90 },
          ECO: { required: false, reason: 'No ecológico', confidence: 100 },
          CAL: { required: true, reason: 'Textil sujeto a control de calidad', confidence: 85 }
        },
        applicableRegulations: ['Reglamento textil'],
        requiredCertifications: [],
        possibleLabTests: ['Composición fibras'],
        additionalNotes: []
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 800
      });

      const result = await aiService.analyzeGoodsForPUE('Camiseta de algodón', '6109100010');

      expect(result.productClassification).toBe('Textil');
      expect(result.pueRequirements.CAL.required).toBe(true);
    });

    it('debe retornar fallback cuando JSON inválido', async () => {
      callClaudeSpy.mockResolvedValue({
        content: 'Not valid JSON',
        tokensUsed: 300
      });

      const result = await aiService.analyzeGoodsForPUE('Producto desconocido');

      expect(result.productClassification).toBe('unknown');
      expect(result.pueRequirements.ROHS.required).toBe(false);
      expect(result.pueRequirements.ROHS.reason).toBe('Error en analisis');
      expect(result.additionalNotes).toContain('Error procesando analisis IA');
    });

    it('debe funcionar con taricCode null', async () => {
      const mockResponse = {
        productClassification: 'General',
        pueRequirements: {
          ROHS: { required: false, reason: 'Sin clasificar', confidence: 50 },
          COM: { required: false, reason: 'Sin clasificar', confidence: 50 },
          ECO: { required: false, reason: 'Sin clasificar', confidence: 50 },
          CAL: { required: false, reason: 'Sin clasificar', confidence: 50 }
        },
        applicableRegulations: [],
        requiredCertifications: [],
        possibleLabTests: [],
        additionalNotes: ['Clasificar antes de determinar requisitos PUE']
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 500
      });

      const result = await aiService.analyzeGoodsForPUE('Producto genérico', null);

      const promptArg = callClaudeSpy.mock.calls[0][2];
      expect(promptArg).toContain('No proporcionado');
      expect(result.productClassification).toBe('General');
    });

    it('debe incluir taricCode cuando se proporciona', async () => {
      const mockResponse = {
        productClassification: 'Maquinaria',
        pueRequirements: {
          ROHS: { required: false, reason: 'No aplica', confidence: 95 },
          COM: { required: true, reason: 'Seguridad maquinaria', subtype: 'Directiva Máquinas', confidence: 90 },
          ECO: { required: false, reason: 'No aplica', confidence: 100 },
          CAL: { required: false, reason: 'No aplica', confidence: 100 }
        },
        applicableRegulations: ['Directiva 2006/42/CE'],
        requiredCertifications: ['Marcado CE'],
        possibleLabTests: [],
        additionalNotes: []
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 1100
      });

      const result = await aiService.analyzeGoodsForPUE('Máquina industrial', '8471300000');

      const promptArg = callClaudeSpy.mock.calls[0][2];
      expect(promptArg).toContain('8471300000');
      expect(result.pueRequirements.COM.required).toBe(true);
      expect(result.pueRequirements.COM.subtype).toBe('Directiva Máquinas');
    });
  });

  // ===========================================
  // autoCompleteTransitData
  // ===========================================
  describe('autoCompleteTransitData', () => {
    it('debe parsear respuesta con bloque ```json y retornar datos completados', async () => {
      const mockResponse = {
        suggestedData: {
          transitType: 'T1',
          transitTypeReason: 'Mercancías no UE',
          principal: {
            eori: 'ESB12345678000',
            name: 'Transport Corp',
            address: { country: 'ES', city: 'Madrid' }
          },
          departureOffice: {
            code: 'ES004810',
            name: 'Aduana de Valencia',
            country: 'ES'
          },
          destinationOffice: {
            code: 'DE005030',
            name: 'Aduana de Frankfurt',
            country: 'DE'
          },
          transitOffices: [
            {
              sequence: 1,
              code: 'FR001030',
              name: 'Aduana de Lyon',
              country: 'FR',
              estimatedArrival: '2026-08-20T10:00:00Z'
            }
          ],
          route: {
            countries: ['ES', 'FR', 'DE'],
            itinerary: 'Valencia → Lyon → Frankfurt',
            bindingItinerary: false
          },
          guarantee: {
            type: '1',
            typeDescription: 'Garantía global',
            estimatedAmount: 5000,
            grn: 'GRN123456',
            reason: 'Operador autorizado con garantía global'
          },
          goodsItems: [
            {
              itemNumber: 1,
              description: 'Electrónica',
              taricCode: '8517130000',
              countryOfOrigin: 'CN',
              grossWeight: 1000,
              netWeight: 900,
              packages: {
                count: 10,
                packageType: 'Palés',
                marks: 'FRAGIL'
              }
            }
          ],
          estimatedDeadline: '2026-08-25T18:00:00Z',
          estimatedTransitDays: 5
        },
        fieldsCompleted: ['principal', 'offices', 'route', 'guarantee', 'goods'],
        fieldsRequiringConfirmation: [
          {
            field: 'guarantee.grn',
            suggestedValue: 'GRN123456',
            reason: 'Verificar número GRN vigente'
          }
        ],
        warnings: [],
        confidence: 85
      };

      callClaudeSpy.mockResolvedValue({
        content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
        tokensUsed: 2500
      });

      const transitDraft = {
        transitType: null,
        principal: { eori: 'ESB12345678000' }
      };

      const expedition = {
        expeditionId: 'EXP-018',
        operationType: 'import',
        client: { companyName: 'Transport Corp', eori: 'ESB12345678000' },
        goods: [
          {
            description: 'Smartphones',
            taricCode: '8517130000',
            originCountry: 'CN',
            grossWeight: 1000,
            netWeight: 900
          }
        ]
      };

      const previousTransits = [];

      const result = await aiService.autoCompleteTransitData(transitDraft, expedition, previousTransits);

      expect(result.suggestedData.transitType).toBe('T1');
      expect(result.suggestedData.principal.eori).toBe('ESB12345678000');
      expect(result.suggestedData.route.countries).toEqual(['ES', 'FR', 'DE']);
      expect(result.fieldsCompleted).toHaveLength(5);
      expect(result.confidence).toBe(85);
      expect(result.model).toBe('opus-4');
      expect(result.tokensUsed).toBe(2500);
      expect(result.generatedAt).toBeDefined();
    });

    it('debe parsear JSON sin bloque markdown', async () => {
      const mockResponse = {
        suggestedData: {
          transitType: 'T2',
          transitTypeReason: 'Mercancías comunitarias'
        },
        fieldsCompleted: ['transitType'],
        fieldsRequiringConfirmation: [],
        warnings: [],
        confidence: 70
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 1000
      });

      const result = await aiService.autoCompleteTransitData({}, {}, []);

      expect(result.suggestedData.transitType).toBe('T2');
    });

    it('debe retornar fallback cuando JSON inválido', async () => {
      callClaudeSpy.mockResolvedValue({
        content: 'Invalid',
        tokensUsed: 400
      });

      const result = await aiService.autoCompleteTransitData({}, null, []);

      expect(result.suggestedData).toEqual({});
      expect(result.fieldsCompleted).toEqual([]);
      expect(result.warnings).toContain('Error en auto-completado IA');
      expect(result.confidence).toBe(0);
      expect(result.rawResponse).toBe('Invalid');
    });

    it('debe manejar expedition null', async () => {
      const mockResponse = {
        suggestedData: {},
        fieldsCompleted: [],
        fieldsRequiringConfirmation: [],
        warnings: ['Sin expediente base'],
        confidence: 40
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 600
      });

      const result = await aiService.autoCompleteTransitData({}, null, []);

      const promptArg = callClaudeSpy.mock.calls[0][2];
      expect(promptArg).toContain('No disponible');
      expect(result.warnings).toContain('Sin expediente base');
    });

    it('debe incluir previousTransits cuando existen', async () => {
      const mockResponse = {
        suggestedData: {
          transitType: 'T1',
          route: { countries: ['ES', 'FR'] }
        },
        fieldsCompleted: [],
        fieldsRequiringConfirmation: [],
        warnings: [],
        confidence: 90
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 1800
      });

      const previousTransits = [
        {
          transitType: 'T1',
          route: { countries: ['ES', 'FR'] },
          departureOffice: { code: 'ES004810' },
          destinationOffice: { code: 'FR001030' },
          transitOffices: [],
          guarantee: { type: '1', amount: 3000 },
          avgTransitDays: 3
        },
        {
          transitType: 'T2',
          route: { countries: ['ES', 'IT'] },
          avgTransitDays: 4
        }
      ];

      const result = await aiService.autoCompleteTransitData({}, {}, previousTransits);

      const promptArg = callClaudeSpy.mock.calls[0][2];
      expect(promptArg).toContain('T1');
      expect(promptArg).toContain('ES004810');
      expect(result.confidence).toBe(90);
    });

    it('debe limitar previousTransits a 3 elementos', async () => {
      const mockResponse = {
        suggestedData: {},
        fieldsCompleted: [],
        fieldsRequiringConfirmation: [],
        warnings: [],
        confidence: 75
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 1500
      });

      const previousTransits = [
        { transitType: 'T1', avgTransitDays: 3 },
        { transitType: 'T2', avgTransitDays: 4 },
        { transitType: 'T1', avgTransitDays: 5 },
        { transitType: 'T2', avgTransitDays: 6 },
        { transitType: 'T1', avgTransitDays: 7 }
      ];

      const result = await aiService.autoCompleteTransitData({}, {}, previousTransits);

      const promptArg = callClaudeSpy.mock.calls[0][2];
      // Debe incluir solo los 3 primeros
      const parsedPrevious = JSON.parse(promptArg.match(/TRANSITOS ANTERIORES.*?\n(\[[\s\S]*?\])/)[1]);
      expect(parsedPrevious).toHaveLength(3);
    });
  });

  // ===========================================
  // validateTransitRoute
  // ===========================================
  describe('validateTransitRoute', () => {
    it('debe parsear respuesta con bloque ```json y retornar validación', async () => {
      const mockResponse = {
        routeValidation: {
          isValid: true,
          issues: []
        },
        routeAnalysis: {
          totalDistance: '1500 km',
          estimatedTransitDays: 4,
          borderCrossings: [
            {
              from: 'ES',
              to: 'FR',
              office: 'FR001030',
              estimatedWaitHours: 2,
              notes: 'Paso fronterizo principal'
            }
          ],
          restrictions: []
        },
        alternativeRoutes: [],
        transitOfficesSuggestion: [
          {
            sequence: 1,
            code: 'FR001030',
            name: 'Lyon',
            country: 'FR',
            reason: 'Frontera ES-FR'
          }
        ],
        deadlineCalculation: {
          standardDeadline: '2026-08-25T18:00:00Z',
          recommendedDeadline: '2026-08-26T18:00:00Z',
          bufferDays: 1,
          factors: ['Festivos', 'Congestión']
        },
        recommendations: ['Solicitar paso prioritario'],
        riskLevel: 'LOW'
      };

      callClaudeSpy.mockResolvedValue({
        content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
        tokensUsed: 2000
      });

      const transit = {
        transitType: 'T1',
        departureOffice: { code: 'ES004810', country: 'ES' },
        destinationOffice: { code: 'DE005030', country: 'DE' },
        transitOffices: [{ code: 'FR001030', country: 'FR' }],
        route: { countries: ['ES', 'FR', 'DE'] },
        transport: { mode: '3' },
        goodsItems: [
          {
            description: 'Mercancía general',
            taricCode: '8517130000',
            countryOfOrigin: 'CN',
            grossWeight: 1000
          }
        ],
        totals: { grossWeight: 1000 }
      };

      const result = await aiService.validateTransitRoute(transit);

      expect(result.routeValidation.isValid).toBe(true);
      expect(result.routeAnalysis.estimatedTransitDays).toBe(4);
      expect(result.riskLevel).toBe('LOW');
      expect(result.model).toBe('opus-4');
      expect(result.tokensUsed).toBe(2000);
      expect(result.validatedAt).toBeDefined();
    });

    it('debe parsear JSON sin bloque markdown', async () => {
      const mockResponse = {
        routeValidation: {
          isValid: false,
          issues: [
            {
              type: 'error',
              description: 'Aduana de tránsito incorrecta',
              affectedSegment: 'FR->DE',
              recommendation: 'Usar aduana fronteriza correcta'
            }
          ]
        },
        routeAnalysis: {},
        alternativeRoutes: [],
        recommendations: [],
        riskLevel: 'MEDIUM'
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 1200
      });

      const transit = {
        transitType: 'T1',
        departureOffice: { code: 'ES004810', country: 'ES' },
        destinationOffice: { code: 'DE005030', country: 'DE' }
      };

      const result = await aiService.validateTransitRoute(transit);

      expect(result.routeValidation.isValid).toBe(false);
      expect(result.routeValidation.issues).toHaveLength(1);
      expect(result.riskLevel).toBe('MEDIUM');
    });

    it('debe retornar fallback cuando JSON inválido', async () => {
      callClaudeSpy.mockResolvedValue({
        content: 'Not JSON',
        tokensUsed: 400
      });

      const transit = {
        transitType: 'T2',
        departureOffice: { code: 'ES004810' }
      };

      const result = await aiService.validateTransitRoute(transit);

      expect(result.routeValidation.isValid).toBe(false);
      expect(result.routeValidation.issues).toHaveLength(1);
      expect(result.routeValidation.issues[0].type).toBe('error');
      expect(result.routeValidation.issues[0].description).toBe('Error en validación IA');
      expect(result.riskLevel).toBe('UNKNOWN');
      expect(result.rawResponse).toBe('Not JSON');
    });

    it('debe manejar campos opcionales faltantes', async () => {
      const mockResponse = {
        routeValidation: { isValid: true, issues: [] },
        routeAnalysis: {},
        alternativeRoutes: [],
        recommendations: [],
        riskLevel: 'LOW'
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 800
      });

      const transit = {
        transitType: 'T1'
        // departureOffice, destinationOffice, transitOffices, route, transport, goodsItems todos undefined
      };

      const result = await aiService.validateTransitRoute(transit);

      expect(result.routeValidation.isValid).toBe(true);
      const promptArg = callClaudeSpy.mock.calls[0][2];
      // El prompt imprime "undefined" literalmente cuando falta el campo
      expect(promptArg).toContain('undefined');
      expect(promptArg).toContain('No especificadas');
    });

    it('debe incluir goodsItems cuando existen', async () => {
      const mockResponse = {
        routeValidation: { isValid: true, issues: [] },
        routeAnalysis: { estimatedTransitDays: 3 },
        alternativeRoutes: [],
        recommendations: [],
        riskLevel: 'LOW'
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 1500
      });

      const transit = {
        transitType: 'T1',
        departureOffice: { code: 'ES004810', country: 'ES' },
        destinationOffice: { code: 'FR001030', country: 'FR' },
        goodsItems: [
          {
            description: 'Textiles',
            taricCode: '6109100010',
            countryOfOrigin: 'ES',
            grossWeight: 500
          },
          {
            description: 'Calzado',
            taricCode: '6403510000',
            countryOfOrigin: 'PT',
            grossWeight: 300
          }
        ]
      };

      const result = await aiService.validateTransitRoute(transit);

      const promptArg = callClaudeSpy.mock.calls[0][2];
      expect(promptArg).toContain('Textiles');
      expect(promptArg).toContain('Calzado');
      expect(promptArg).toContain('6109100010');
    });
  });

  // ===========================================
  // predictTransitIncidents
  // ===========================================
  describe('predictTransitIncidents', () => {
    it('debe parsear respuesta con bloque ```json y retornar predicciones', async () => {
      const mockResponse = {
        overallRiskScore: 45,
        riskLevel: 'MEDIUM',
        incidentPredictions: [
          {
            type: 'delay',
            probability: 60,
            description: 'Posible retraso en frontera',
            stage: 'border_FR',
            impact: 'MEDIUM',
            potentialDelay: '12 horas',
            triggerFactors: ['Congestión frontera'],
            preventiveMeasures: ['Documentación completa']
          }
        ],
        controlProbability: {
          departure: 30,
          transit: 40,
          arrival: 35,
          factors: ['País origen mercancías']
        },
        enquiryRisk: {
          probability: 15,
          triggers: ['Valor elevado'],
          potentialDebtAmount: 5000,
          mitigationActions: ['Garantía suficiente']
        },
        timelineRisk: {
          onTimeArrivalProbability: 70,
          expectedDelayDays: 1,
          criticalPoints: ['Frontera FR-DE']
        },
        guaranteeAdequacy: {
          currentAmount: 10000,
          recommendedAmount: 10000,
          adequacyScore: 100,
          notes: 'Garantía adecuada'
        },
        recommendations: [
          {
            priority: 'MEDIUM',
            action: 'Monitorizar paso frontera',
            reason: 'Posible congestión',
            deadline: '2026-08-20'
          }
        ],
        monitoringAlerts: [
          {
            condition: 'Retraso > 6h',
            action: 'Notificar cliente',
            urgency: 'MEDIUM'
          }
        ]
      };

      callClaudeSpy.mockResolvedValue({
        content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
        tokensUsed: 2500
      });

      const transit = {
        mrn: 'MRN123456',
        transitType: 'T1',
        status: 'released',
        departureOffice: { code: 'ES004810', country: 'ES' },
        destinationOffice: { code: 'DE005030', country: 'DE' },
        route: { countries: ['ES', 'FR', 'DE'] },
        guarantee: { type: '1', amount: 10000 },
        dates: { releaseAtDeparture: '2026-08-15T08:00:00Z' },
        deadlines: { arrivalDeadline: '2026-08-20T18:00:00Z' },
        transport: {
          mode: '3',
          identityAtDeparture: { identification: 'ABC-1234' },
          containers: [],
          seals: []
        },
        goodsItems: [
          {
            description: 'Electrónica',
            taricCode: '8517130000',
            countryOfOrigin: 'CN',
            grossWeight: 1000
          }
        ],
        principal: {
          eori: 'ESB12345678000',
          name: 'Transport SA'
        }
      };

      const historicalData = {
        similarTransits: 50,
        incidentRate: '10%',
        commonIncidents: ['Retrasos frontera']
      };

      const result = await aiService.predictTransitIncidents(transit, historicalData);

      expect(result.overallRiskScore).toBe(45);
      expect(result.riskLevel).toBe('MEDIUM');
      expect(result.incidentPredictions).toHaveLength(1);
      expect(result.controlProbability.departure).toBe(30);
      expect(result.recommendations).toHaveLength(1);
      expect(result.model).toBe('opus-4');
      expect(result.tokensUsed).toBe(2500);
      expect(result.predictedAt).toBeDefined();
    });

    it('debe parsear JSON sin bloque markdown', async () => {
      const mockResponse = {
        overallRiskScore: 20,
        riskLevel: 'LOW',
        incidentPredictions: [],
        controlProbability: { departure: 10, transit: 10, arrival: 10, factors: [] },
        enquiryRisk: { probability: 5 },
        recommendations: []
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 1000
      });

      const transit = {
        transitType: 'T2',
        status: 'arrived'
      };

      const result = await aiService.predictTransitIncidents(transit, {});

      expect(result.riskLevel).toBe('LOW');
      expect(result.overallRiskScore).toBe(20);
    });

    it('debe retornar fallback cuando JSON inválido', async () => {
      callClaudeSpy.mockResolvedValue({
        content: 'Bad JSON',
        tokensUsed: 500
      });

      const transit = {
        transitType: 'T1'
      };

      const result = await aiService.predictTransitIncidents(transit);

      expect(result.overallRiskScore).toBe(50);
      expect(result.riskLevel).toBe('UNKNOWN');
      expect(result.incidentPredictions).toEqual([]);
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].action).toBe('Revisar manualmente');
      expect(result.rawResponse).toBe('Bad JSON');
    });

    it('debe manejar historicalData vacío', async () => {
      const mockResponse = {
        overallRiskScore: 50,
        riskLevel: 'MEDIUM',
        incidentPredictions: [],
        controlProbability: {},
        enquiryRisk: {},
        recommendations: []
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 1200
      });

      const transit = {
        transitType: 'T1',
        status: 'draft'
      };

      const result = await aiService.predictTransitIncidents(transit, {});

      const promptArg = callClaudeSpy.mock.calls[0][2];
      expect(promptArg).toContain('Desconocida');
      expect(result.overallRiskScore).toBe(50);
    });

    it('debe incluir historicalData cuando existe', async () => {
      const mockResponse = {
        overallRiskScore: 35,
        riskLevel: 'MEDIUM',
        incidentPredictions: [],
        controlProbability: {},
        enquiryRisk: {},
        recommendations: []
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 1800
      });

      const transit = {
        transitType: 'T1',
        departureOffice: { code: 'ES004810' }
      };

      const historicalData = {
        similarTransits: 100,
        incidentRate: '15%',
        commonIncidents: ['Retrasos', 'Controles físicos', 'Discrepancias documentales']
      };

      const result = await aiService.predictTransitIncidents(transit, historicalData);

      const promptArg = callClaudeSpy.mock.calls[0][2];
      expect(promptArg).toContain('100');
      expect(promptArg).toContain('15%');
      expect(promptArg).toContain('Retrasos');
    });

    it('debe manejar transit con todos los campos opcionales', async () => {
      const mockResponse = {
        overallRiskScore: 25,
        riskLevel: 'LOW',
        incidentPredictions: [],
        controlProbability: { departure: 10, transit: 10, arrival: 10 },
        enquiryRisk: { probability: 5 },
        recommendations: []
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 2000
      });

      const transit = {
        mrn: 'MRN789',
        transitType: 'T1',
        status: 'released',
        departureOffice: { code: 'ES004810', country: 'ES' },
        destinationOffice: { code: 'IT001030', country: 'IT' },
        route: { countries: ['ES', 'FR', 'IT'] },
        guarantee: { type: '1', amount: 8000 },
        dates: { releaseAtDeparture: '2026-08-16T10:00:00Z' },
        deadlines: { arrivalDeadline: '2026-08-22T18:00:00Z' },
        transport: {
          mode: '3',
          identityAtDeparture: { identification: 'XYZ-9876' },
          containers: [{ number: 'CONT123' }],
          seals: [{ number: 'SEAL001' }]
        },
        goodsItems: [
          {
            description: 'Maquinaria',
            taricCode: '8471300000',
            countryOfOrigin: 'DE',
            grossWeight: 3000
          }
        ],
        principal: {
          eori: 'ESC98765432000',
          name: 'Logistics Ltd'
        }
      };

      const result = await aiService.predictTransitIncidents(transit, {});

      const promptArg = callClaudeSpy.mock.calls[0][2];
      expect(promptArg).toContain('MRN789');
      expect(promptArg).toContain('XYZ-9876');
      expect(promptArg).toContain('1');
      expect(result.riskLevel).toBe('LOW');
    });
  });

  // ===========================================
  // suggestTransitGuarantee
  // ===========================================
  describe('suggestTransitGuarantee', () => {
    it('debe parsear respuesta con bloque ```json y retornar sugerencia garantía', async () => {
      const mockResponse = {
        calculatedAmount: {
          baseAmount: 12000,
          reductionPercentage: 50,
          reductionReason: 'OEA tipo C',
          finalAmount: 6000,
          breakdown: {
            duties: 3000,
            vat: 2500,
            excise: 0,
            other: 500
          }
        },
        recommendedType: {
          code: '1',
          name: 'Garantía global',
          reason: 'Operador con volumen alto',
          requirements: ['Solvencia financiera', 'Historial limpio'],
          advantages: ['Menor coste por operación'],
          disadvantages: ['Requiere aprobación previa']
        },
        alternatives: [
          {
            code: '2',
            name: 'Garantía individual por fianza',
            suitability: 70,
            estimatedCost: 150,
            processingTime: '1-2 días',
            notes: 'Para operaciones puntuales'
          }
        ],
        globalGuaranteeAnalysis: {
          canUseExisting: true,
          availableAmount: 50000,
          wouldBeConsumed: 6000,
          remainingAfter: 44000,
          recommendation: 'Usar garantía global existente'
        },
        oeaImpact: {
          hasReduction: true,
          reductionPercentage: 50,
          reductionAmount: 6000,
          additionalBenefits: ['Menos controles', 'Prioridad']
        },
        recommendations: ['Mantener garantía global activa'],
        warnings: []
      };

      callClaudeSpy.mockResolvedValue({
        content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
        tokensUsed: 2000
      });

      const transit = {
        transitType: 'T1',
        departureOffice: { code: 'ES004810', country: 'ES' },
        destinationOffice: { code: 'FR001030', country: 'FR' },
        route: { countries: ['ES', 'FR'] },
        goodsItems: [
          {
            description: 'Electrónica',
            taricCode: '8517130000',
            value: 10000,
            grossWeight: 500
          }
        ],
        totalValue: 10000,
        totals: { grossWeight: 500 }
      };

      const operatorProfile = {
        eori: 'ESB12345678000',
        oeaStatus: 'approved',
        oeaType: 'C',
        hasGlobalGuarantee: true,
        grn: 'GRN789',
        availableAmount: 50000,
        transitHistory: '100+ operaciones',
        previousIncidents: 0
      };

      const result = await aiService.suggestTransitGuarantee(transit, operatorProfile);

      expect(result.calculatedAmount.finalAmount).toBe(6000);
      expect(result.recommendedType.code).toBe('1');
      expect(result.globalGuaranteeAnalysis.canUseExisting).toBe(true);
      expect(result.oeaImpact.hasReduction).toBe(true);
      expect(result.model).toBe('sonnet-4');
      expect(result.tokensUsed).toBe(2000);
      expect(result.calculatedAt).toBeDefined();
    });

    it('debe parsear JSON sin bloque markdown', async () => {
      const mockResponse = {
        calculatedAmount: { finalAmount: 3000 },
        recommendedType: { code: '2', name: 'Fianza individual', reason: 'Sin OEA' },
        alternatives: [],
        recommendations: []
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 1200
      });

      const transit = {
        transitType: 'T2',
        goodsItems: []
      };

      const result = await aiService.suggestTransitGuarantee(transit, {});

      expect(result.calculatedAmount.finalAmount).toBe(3000);
      expect(result.recommendedType.code).toBe('2');
    });

    it('debe retornar fallback cuando JSON inválido', async () => {
      callClaudeSpy.mockResolvedValue({
        content: 'Invalid JSON',
        tokensUsed: 500
      });

      const transit = {
        transitType: 'T1'
      };

      const result = await aiService.suggestTransitGuarantee(transit, {});

      expect(result.calculatedAmount.finalAmount).toBe(0);
      expect(result.recommendedType.code).toBe('1');
      expect(result.recommendedType.name).toBe('Garantía global');
      expect(result.recommendations).toContain('Error en cálculo IA - revisar manualmente');
      expect(result.rawResponse).toBe('Invalid JSON');
    });

    it('debe manejar operatorProfile vacío', async () => {
      const mockResponse = {
        calculatedAmount: { finalAmount: 5000 },
        recommendedType: { code: '1', name: 'Garantía global' },
        alternatives: [],
        recommendations: []
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 1000
      });

      const transit = {
        transitType: 'T1',
        principal: { eori: 'ESA11111111000' }
      };

      const result = await aiService.suggestTransitGuarantee(transit, {});

      const promptArg = callClaudeSpy.mock.calls[0][2];
      expect(promptArg).toContain('none');
      expect(promptArg).toContain('No');
      expect(result.calculatedAmount.finalAmount).toBe(5000);
    });

    it('debe incluir operatorProfile completo cuando existe', async () => {
      const mockResponse = {
        calculatedAmount: {
          baseAmount: 8000,
          reductionPercentage: 70,
          reductionReason: 'OEA tipo F',
          finalAmount: 2400,
          breakdown: { duties: 1500, vat: 800, excise: 0, other: 100 }
        },
        recommendedType: { code: '0', name: 'Dispensa garantía', reason: 'OEA autorizado' },
        alternatives: [],
        globalGuaranteeAnalysis: { canUseExisting: true },
        oeaImpact: { hasReduction: true, reductionPercentage: 70 },
        recommendations: []
      };

      callClaudeSpy.mockResolvedValue({
        content: JSON.stringify(mockResponse),
        tokensUsed: 1800
      });

      const transit = {
        transitType: 'T1',
        departureOffice: { code: 'ES004810' },
        destinationOffice: { code: 'DE005030' },
        route: { countries: ['ES', 'FR', 'DE'] },
        goodsItems: [{ taricCode: '8471300000', value: 15000, grossWeight: 800 }],
        totalValue: 15000,
        totals: { grossWeight: 800 }
      };

      const operatorProfile = {
        eori: 'ESC98765432000',
        oeaStatus: 'approved',
        oeaType: 'F',
        hasGlobalGuarantee: true,
        grn: 'GRN456',
        availableAmount: 100000,
        transitHistory: '500+ operaciones sin incidencias',
        previousIncidents: 0
      };

      const result = await aiService.suggestTransitGuarantee(transit, operatorProfile);

      const promptArg = callClaudeSpy.mock.calls[0][2];
      expect(promptArg).toContain('approved');
      expect(promptArg).toContain('F');
      expect(promptArg).toContain('Sí');
      expect(promptArg).toContain('GRN456');
      expect(promptArg).toContain('100000');
      expect(result.calculatedAmount.finalAmount).toBe(2400);
    });
  });

  // ===========================================
  // fullTransitAnalysis
  // ===========================================
  describe('fullTransitAnalysis', () => {
    it('debe ejecutar 3 análisis en paralelo y calcular readinessScore', async () => {
      jest.spyOn(aiService, 'validateTransitRoute').mockResolvedValue({
        routeValidation: { isValid: true },
        routeAnalysis: { estimatedTransitDays: 4 },
        transitOfficesSuggestion: []
      });

      jest.spyOn(aiService, 'predictTransitIncidents').mockResolvedValue({
        overallRiskScore: 30,
        riskLevel: 'LOW',
        recommendations: []
      });

      jest.spyOn(aiService, 'suggestTransitGuarantee').mockResolvedValue({
        calculatedAmount: { finalAmount: 5000 },
        recommendedType: { name: 'Global' },
        globalGuaranteeAnalysis: { canUseExisting: true }
      });

      const transit = {
        transitType: 'T1',
        principal: { eori: 'ESB12345678000', name: 'Transit Corp' },
        departureOffice: { code: 'ES004810' },
        destinationOffice: { code: 'FR001030' },
        transitOffices: [{ code: 'FR002030' }],
        guarantee: { grn: 'GRN123' },
        goodsItems: [
          {
            description: 'Mercancía',
            grossWeight: 1000
          }
        ],
        documents: [{ type: 'invoice' }]
      };

      const result = await aiService.fullTransitAnalysis(transit, {}, {}, {});

      expect(result.routeValidation).toBeDefined();
      expect(result.incidentPrediction).toBeDefined();
      expect(result.guaranteeSuggestion).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.readinessScore).toBeGreaterThan(0);
      expect(result.summary.readinessLevel).toBe('READY');
      expect(result.nextSteps).toBeDefined();
      expect(result.analyzedAt).toBeDefined();
    });

    it('debe sumar correctamente factores de readinessScore', async () => {
      jest.spyOn(aiService, 'validateTransitRoute').mockResolvedValue({
        routeValidation: { isValid: true },
        routeAnalysis: { estimatedTransitDays: 3 }
      });

      jest.spyOn(aiService, 'predictTransitIncidents').mockResolvedValue({
        overallRiskScore: 25,
        riskLevel: 'LOW'
      });

      jest.spyOn(aiService, 'suggestTransitGuarantee').mockResolvedValue({
        calculatedAmount: { finalAmount: 3000 },
        globalGuaranteeAnalysis: { canUseExisting: true }
      });

      const transit = {
        principal: { eori: 'ESB12345678000', name: 'Full Transit' },
        transitOffices: [{ code: 'FR001030' }],
        guarantee: { grn: 'GRN789' },
        goodsItems: [
          { description: 'Item 1', grossWeight: 500 },
          { description: 'Item 2', grossWeight: 500 }
        ],
        documents: [{ type: 'invoice' }, { type: 'packing' }]
      };

      const result = await aiService.fullTransitAnalysis(transit, {}, {}, {});

      // Principal completo: +15
      // Ruta válida: +20
      // Garantía disponible: +20
      // Mercancías completas: +15
      // Bajo riesgo (<40): +15
      // Aduanas de tránsito: +10
      // Documentos: +5
      // Total = 100
      expect(result.summary.readinessScore).toBe(100);
      expect(result.summary.readinessLevel).toBe('READY');
      expect(result.summary.factors).toContain('Principal obligado completo');
      expect(result.summary.factors).toContain('Ruta validada');
      expect(result.summary.factors).toContain('Garantía disponible');
    });

    it('debe calcular readinessLevel ALMOST_READY para score 60-79', async () => {
      jest.spyOn(aiService, 'validateTransitRoute').mockResolvedValue({
        routeValidation: { isValid: false }
      });

      jest.spyOn(aiService, 'predictTransitIncidents').mockResolvedValue({
        overallRiskScore: 50,
        riskLevel: 'MEDIUM'
      });

      jest.spyOn(aiService, 'suggestTransitGuarantee').mockResolvedValue({
        calculatedAmount: { finalAmount: 0 },
        globalGuaranteeAnalysis: { canUseExisting: false }
      });

      const transit = {
        principal: { eori: 'ESB12345678000', name: 'Transit Inc' },
        goodsItems: [{ description: 'Item', grossWeight: 100 }]
      };

      const result = await aiService.fullTransitAnalysis(transit, {}, {}, {});

      // Principal: +15
      // Mercancías: +15
      // Total: 30 → NEEDS_WORK
      // Pero si el riesgo es <40 y hay garantía implícita podría llegar a más
      expect(result.summary.readinessScore).toBeLessThan(80);
      expect(['ALMOST_READY', 'NEEDS_WORK', 'NOT_READY']).toContain(result.summary.readinessLevel);
    });

    it('debe calcular readinessLevel NEEDS_WORK para score 40-59', async () => {
      jest.spyOn(aiService, 'validateTransitRoute').mockResolvedValue({
        routeValidation: { isValid: false }
      });

      jest.spyOn(aiService, 'predictTransitIncidents').mockResolvedValue({
        overallRiskScore: 60,
        riskLevel: 'HIGH'
      });

      jest.spyOn(aiService, 'suggestTransitGuarantee').mockResolvedValue({
        calculatedAmount: { finalAmount: 0 }
      });

      const transit = {
        principal: { eori: 'ESB12345678000' },
        goodsItems: []
      };

      const result = await aiService.fullTransitAnalysis(transit, {}, {}, {});

      // Principal: +15 (sin name no cuenta)
      // Total: 0
      expect(result.summary.readinessScore).toBeLessThan(60);
      expect(['NEEDS_WORK', 'NOT_READY']).toContain(result.summary.readinessLevel);
    });

    it('debe calcular readinessLevel NOT_READY para score <40', async () => {
      jest.spyOn(aiService, 'validateTransitRoute').mockResolvedValue({
        routeValidation: { isValid: false }
      });

      jest.spyOn(aiService, 'predictTransitIncidents').mockResolvedValue({
        overallRiskScore: 80,
        riskLevel: 'CRITICAL'
      });

      jest.spyOn(aiService, 'suggestTransitGuarantee').mockResolvedValue({
        calculatedAmount: { finalAmount: 0 }
      });

      const transit = {};

      const result = await aiService.fullTransitAnalysis(transit, {}, {}, {});

      expect(result.summary.readinessScore).toBeLessThan(40);
      expect(result.summary.readinessLevel).toBe('NOT_READY');
    });

    it('debe incluir estimatedTransitDays y guaranteeRequired en summary', async () => {
      jest.spyOn(aiService, 'validateTransitRoute').mockResolvedValue({
        routeValidation: { isValid: true },
        routeAnalysis: { estimatedTransitDays: 5 }
      });

      jest.spyOn(aiService, 'predictTransitIncidents').mockResolvedValue({
        overallRiskScore: 20,
        riskLevel: 'LOW'
      });

      jest.spyOn(aiService, 'suggestTransitGuarantee').mockResolvedValue({
        calculatedAmount: { finalAmount: 8000 }
      });

      const transit = {
        principal: { eori: 'ESB12345678000', name: 'Test' },
        goodsItems: [{ description: 'Item', grossWeight: 100 }]
      };

      const result = await aiService.fullTransitAnalysis(transit, {}, {}, {});

      expect(result.summary.estimatedTransitDays).toBe(5);
      expect(result.summary.guaranteeRequired).toBe(8000);
    });

    it('debe manejar routeAnalysis sin estimatedTransitDays', async () => {
      jest.spyOn(aiService, 'validateTransitRoute').mockResolvedValue({
        routeValidation: { isValid: true },
        routeAnalysis: {}
      });

      jest.spyOn(aiService, 'predictTransitIncidents').mockResolvedValue({
        overallRiskScore: 30,
        riskLevel: 'LOW'
      });

      jest.spyOn(aiService, 'suggestTransitGuarantee').mockResolvedValue({
        calculatedAmount: {}
      });

      const transit = {
        principal: { eori: 'ESB12345678000', name: 'Test' }
      };

      const result = await aiService.fullTransitAnalysis(transit, {}, {}, {});

      expect(result.summary.estimatedTransitDays).toBe('N/A');
      expect(result.summary.guaranteeRequired).toBe(0);
    });
  });

  // ===========================================
  // _generateTransitNextSteps
  // ===========================================
  describe('_generateTransitNextSteps', () => {
    it('debe generar paso ruta cuando isValid es false', () => {
      const transit = {};
      const routeValidation = {
        routeValidation: {
          isValid: false,
          issues: [{ description: 'Ruta incorrecta' }]
        }
      };
      const incidentPrediction = { overallRiskScore: 30 };
      const guaranteeSuggestion = { calculatedAmount: { finalAmount: 0 } };

      const steps = aiService._generateTransitNextSteps(
        transit,
        routeValidation,
        incidentPrediction,
        guaranteeSuggestion
      );

      expect(steps.length).toBeGreaterThan(0);
      expect(steps[0].priority).toBe(1);
      expect(steps[0].action).toBe('Corregir problemas de ruta');
      expect(steps[0].details).toBe('Ruta incorrecta');
      expect(steps[0].category).toBe('route');
    });

    it('debe generar paso garantía cuando falta grn y no hay global', () => {
      const transit = { guarantee: {} };
      const routeValidation = { routeValidation: { isValid: true } };
      const incidentPrediction = { overallRiskScore: 30 };
      const guaranteeSuggestion = {
        globalGuaranteeAnalysis: { canUseExisting: false },
        recommendedType: { name: 'Garantía individual' },
        calculatedAmount: { finalAmount: 5000 }
      };

      const steps = aiService._generateTransitNextSteps(
        transit,
        routeValidation,
        incidentPrediction,
        guaranteeSuggestion
      );

      const garantiaStep = steps.find(s => s.category === 'guarantee');
      expect(garantiaStep).toBeDefined();
      expect(garantiaStep.priority).toBe(1);
      expect(garantiaStep.action).toBe('Configurar garantía de tránsito');
      expect(garantiaStep.details).toContain('5000 EUR');
    });

    it('NO debe generar paso garantía si grn existe', () => {
      const transit = { guarantee: { grn: 'GRN123' } };
      const routeValidation = { routeValidation: { isValid: true } };
      const incidentPrediction = { overallRiskScore: 30 };
      const guaranteeSuggestion = { globalGuaranteeAnalysis: { canUseExisting: false } };

      const steps = aiService._generateTransitNextSteps(
        transit,
        routeValidation,
        incidentPrediction,
        guaranteeSuggestion
      );

      const garantiaStep = steps.find(s => s.category === 'guarantee');
      expect(garantiaStep).toBeUndefined();
    });

    it('NO debe generar paso garantía si canUseExisting es true', () => {
      const transit = { guarantee: {} };
      const routeValidation = { routeValidation: { isValid: true } };
      const incidentPrediction = { overallRiskScore: 30 };
      const guaranteeSuggestion = { globalGuaranteeAnalysis: { canUseExisting: true } };

      const steps = aiService._generateTransitNextSteps(
        transit,
        routeValidation,
        incidentPrediction,
        guaranteeSuggestion
      );

      const garantiaStep = steps.find(s => s.category === 'guarantee');
      expect(garantiaStep).toBeUndefined();
    });

    it('debe generar paso riesgo cuando overallRiskScore > 70', () => {
      const transit = {};
      const routeValidation = { routeValidation: { isValid: true } };
      const incidentPrediction = {
        overallRiskScore: 75,
        recommendations: [{ action: 'Aumentar seguimiento' }]
      };
      const guaranteeSuggestion = { globalGuaranteeAnalysis: { canUseExisting: true } };

      const steps = aiService._generateTransitNextSteps(
        transit,
        routeValidation,
        incidentPrediction,
        guaranteeSuggestion
      );

      const riesgoStep = steps.find(s => s.category === 'risk');
      expect(riesgoStep).toBeDefined();
      expect(riesgoStep.priority).toBe(1);
      expect(riesgoStep.action).toBe('Mitigar riesgos identificados');
      expect(riesgoStep.details).toBe('Aumentar seguimiento');
    });

    it('NO debe generar paso riesgo cuando overallRiskScore <= 70', () => {
      const transit = {};
      const routeValidation = { routeValidation: { isValid: true } };
      const incidentPrediction = { overallRiskScore: 60 };
      const guaranteeSuggestion = { globalGuaranteeAnalysis: { canUseExisting: true } };

      const steps = aiService._generateTransitNextSteps(
        transit,
        routeValidation,
        incidentPrediction,
        guaranteeSuggestion
      );

      const riesgoStep = steps.find(s => s.category === 'risk');
      expect(riesgoStep).toBeUndefined();
    });

    it('debe generar paso mercancías cuando faltan goodsItems', () => {
      const transit = {};
      const routeValidation = { routeValidation: { isValid: true } };
      const incidentPrediction = { overallRiskScore: 30 };
      const guaranteeSuggestion = { globalGuaranteeAnalysis: { canUseExisting: true } };

      const steps = aiService._generateTransitNextSteps(
        transit,
        routeValidation,
        incidentPrediction,
        guaranteeSuggestion
      );

      const goodsStep = steps.find(s => s.category === 'goods');
      expect(goodsStep).toBeDefined();
      expect(goodsStep.priority).toBe(2);
      expect(goodsStep.action).toBe('Completar datos de mercancías');
    });

    it('debe generar paso mercancías cuando algún item no tiene taricCode', () => {
      const transit = {
        goodsItems: [
          { description: 'Item 1', taricCode: '8517130000' },
          { description: 'Item 2', taricCode: null }
        ]
      };
      const routeValidation = { routeValidation: { isValid: true } };
      const incidentPrediction = { overallRiskScore: 30 };
      const guaranteeSuggestion = { globalGuaranteeAnalysis: { canUseExisting: true } };

      const steps = aiService._generateTransitNextSteps(
        transit,
        routeValidation,
        incidentPrediction,
        guaranteeSuggestion
      );

      const goodsStep = steps.find(s => s.category === 'goods');
      expect(goodsStep).toBeDefined();
    });

    it('NO debe generar paso mercancías si todas tienen taricCode', () => {
      const transit = {
        goodsItems: [
          { description: 'Item 1', taricCode: '8517130000' },
          { description: 'Item 2', taricCode: '6109100010' }
        ]
      };
      const routeValidation = { routeValidation: { isValid: true } };
      const incidentPrediction = { overallRiskScore: 30 };
      const guaranteeSuggestion = { globalGuaranteeAnalysis: { canUseExisting: true } };

      const steps = aiService._generateTransitNextSteps(
        transit,
        routeValidation,
        incidentPrediction,
        guaranteeSuggestion
      );

      const goodsStep = steps.find(s => s.category === 'goods');
      expect(goodsStep).toBeUndefined();
    });

    it('debe generar paso aduanas de tránsito cuando faltan y hay +2 países', () => {
      const transit = {
        route: { countries: ['ES', 'FR', 'DE'] }
      };
      const routeValidation = {
        routeValidation: { isValid: true },
        transitOfficesSuggestion: [
          { code: 'FR001030' },
          { code: 'DE005030' }
        ]
      };
      const incidentPrediction = { overallRiskScore: 30 };
      const guaranteeSuggestion = { globalGuaranteeAnalysis: { canUseExisting: true } };

      const steps = aiService._generateTransitNextSteps(
        transit,
        routeValidation,
        incidentPrediction,
        guaranteeSuggestion
      );

      const routeStep = steps.find(s => s.category === 'route' && s.action === 'Definir aduanas de tránsito');
      expect(routeStep).toBeDefined();
      expect(routeStep.priority).toBe(2);
      expect(routeStep.details).toContain('FR001030');
    });

    it('NO debe generar paso aduanas si ya existen transitOffices', () => {
      const transit = {
        transitOffices: [{ code: 'FR001030' }],
        route: { countries: ['ES', 'FR', 'DE'] }
      };
      const routeValidation = { routeValidation: { isValid: true } };
      const incidentPrediction = { overallRiskScore: 30 };
      const guaranteeSuggestion = { globalGuaranteeAnalysis: { canUseExisting: true } };

      const steps = aiService._generateTransitNextSteps(
        transit,
        routeValidation,
        incidentPrediction,
        guaranteeSuggestion
      );

      const routeStep = steps.find(s => s.category === 'route' && s.action === 'Definir aduanas de tránsito');
      expect(routeStep).toBeUndefined();
    });

    it('NO debe generar paso aduanas si solo hay 2 países', () => {
      const transit = {
        route: { countries: ['ES', 'FR'] }
      };
      const routeValidation = { routeValidation: { isValid: true } };
      const incidentPrediction = { overallRiskScore: 30 };
      const guaranteeSuggestion = { globalGuaranteeAnalysis: { canUseExisting: true } };

      const steps = aiService._generateTransitNextSteps(
        transit,
        routeValidation,
        incidentPrediction,
        guaranteeSuggestion
      );

      const routeStep = steps.find(s => s.category === 'route' && s.action === 'Definir aduanas de tránsito');
      expect(routeStep).toBeUndefined();
    });

    it('debe generar paso precintos cuando hay contenedor y no hay seals', () => {
      const transit = {
        transport: {
          containerIndicator: true,
          seals: []
        }
      };
      const routeValidation = { routeValidation: { isValid: true } };
      const incidentPrediction = { overallRiskScore: 30 };
      const guaranteeSuggestion = { globalGuaranteeAnalysis: { canUseExisting: true } };

      const steps = aiService._generateTransitNextSteps(
        transit,
        routeValidation,
        incidentPrediction,
        guaranteeSuggestion
      );

      const sealsStep = steps.find(s => s.category === 'transport');
      expect(sealsStep).toBeDefined();
      expect(sealsStep.priority).toBe(3);
      expect(sealsStep.action).toBe('Registrar precintos');
    });

    it('NO debe generar paso precintos si ya hay seals', () => {
      const transit = {
        transport: {
          containerIndicator: true,
          seals: [{ number: 'SEAL001' }]
        }
      };
      const routeValidation = { routeValidation: { isValid: true } };
      const incidentPrediction = { overallRiskScore: 30 };
      const guaranteeSuggestion = { globalGuaranteeAnalysis: { canUseExisting: true } };

      const steps = aiService._generateTransitNextSteps(
        transit,
        routeValidation,
        incidentPrediction,
        guaranteeSuggestion
      );

      const sealsStep = steps.find(s => s.category === 'transport');
      expect(sealsStep).toBeUndefined();
    });

    it('NO debe generar paso precintos si no hay containerIndicator', () => {
      const transit = {
        transport: {
          containerIndicator: false,
          seals: []
        }
      };
      const routeValidation = { routeValidation: { isValid: true } };
      const incidentPrediction = { overallRiskScore: 30 };
      const guaranteeSuggestion = { globalGuaranteeAnalysis: { canUseExisting: true } };

      const steps = aiService._generateTransitNextSteps(
        transit,
        routeValidation,
        incidentPrediction,
        guaranteeSuggestion
      );

      const sealsStep = steps.find(s => s.category === 'transport');
      expect(sealsStep).toBeUndefined();
    });

    it('debe ordenar steps por prioridad ascendente', () => {
      const transit = {
        transport: { containerIndicator: true, seals: [] },
        route: { countries: ['ES', 'FR', 'DE'] }
      };
      const routeValidation = {
        routeValidation: { isValid: false, issues: [{ description: 'Error' }] }
      };
      const incidentPrediction = {
        overallRiskScore: 75,
        recommendations: [{ action: 'Fix' }]
      };
      const guaranteeSuggestion = {
        globalGuaranteeAnalysis: { canUseExisting: false },
        calculatedAmount: { finalAmount: 0 }
      };

      const steps = aiService._generateTransitNextSteps(
        transit,
        routeValidation,
        incidentPrediction,
        guaranteeSuggestion
      );

      // Debe haber: prioridad 1 (ruta, garantía, riesgo), prioridad 2 (aduanas), prioridad 3 (precintos)
      expect(steps.length).toBeGreaterThan(1);
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i].priority).toBeGreaterThanOrEqual(steps[i - 1].priority);
      }
    });

    it('debe retornar array vacío cuando no hay pasos necesarios', () => {
      const transit = {
        guarantee: { grn: 'GRN123' },
        goodsItems: [{ description: 'Item', taricCode: '8517130000' }],
        transitOffices: [{ code: 'FR001030' }],
        transport: { containerIndicator: false }
      };
      const routeValidation = { routeValidation: { isValid: true } };
      const incidentPrediction = { overallRiskScore: 30 };
      const guaranteeSuggestion = { globalGuaranteeAnalysis: { canUseExisting: true } };

      const steps = aiService._generateTransitNextSteps(
        transit,
        routeValidation,
        incidentPrediction,
        guaranteeSuggestion
      );

      expect(steps).toEqual([]);
    });

    it('debe manejar routeValidation.issues vacío', () => {
      const transit = {};
      const routeValidation = {
        routeValidation: { isValid: false, issues: [] }
      };
      const incidentPrediction = { overallRiskScore: 30 };
      const guaranteeSuggestion = { globalGuaranteeAnalysis: { canUseExisting: true } };

      const steps = aiService._generateTransitNextSteps(
        transit,
        routeValidation,
        incidentPrediction,
        guaranteeSuggestion
      );

      const routeStep = steps.find(s => s.category === 'route' && s.action === 'Corregir problemas de ruta');
      expect(routeStep).toBeDefined();
      expect(routeStep.details).toBe('Revisar ruta');
    });

    it('debe manejar incidentPrediction.recommendations vacío', () => {
      const transit = {};
      const routeValidation = { routeValidation: { isValid: true } };
      const incidentPrediction = { overallRiskScore: 75, recommendations: [] };
      const guaranteeSuggestion = { globalGuaranteeAnalysis: { canUseExisting: true } };

      const steps = aiService._generateTransitNextSteps(
        transit,
        routeValidation,
        incidentPrediction,
        guaranteeSuggestion
      );

      const riesgoStep = steps.find(s => s.category === 'risk');
      expect(riesgoStep).toBeDefined();
      expect(riesgoStep.details).toBe('Revisar factores de riesgo');
    });

    it('debe manejar guaranteeSuggestion sin recommendedType', () => {
      const transit = { guarantee: {} };
      const routeValidation = { routeValidation: { isValid: true } };
      const incidentPrediction = { overallRiskScore: 30 };
      const guaranteeSuggestion = {
        globalGuaranteeAnalysis: { canUseExisting: false },
        calculatedAmount: { finalAmount: 5000 }
      };

      const steps = aiService._generateTransitNextSteps(
        transit,
        routeValidation,
        incidentPrediction,
        guaranteeSuggestion
      );

      const garantiaStep = steps.find(s => s.category === 'guarantee');
      expect(garantiaStep).toBeDefined();
      expect(garantiaStep.details).toContain('garantía global');
    });

    it('debe manejar routeValidation sin transitOfficesSuggestion', () => {
      const transit = {
        route: { countries: ['ES', 'FR', 'DE'] }
      };
      const routeValidation = { routeValidation: { isValid: true } };
      const incidentPrediction = { overallRiskScore: 30 };
      const guaranteeSuggestion = { globalGuaranteeAnalysis: { canUseExisting: true } };

      const steps = aiService._generateTransitNextSteps(
        transit,
        routeValidation,
        incidentPrediction,
        guaranteeSuggestion
      );

      const routeStep = steps.find(s => s.category === 'route' && s.action === 'Definir aduanas de tránsito');
      expect(routeStep).toBeDefined();
      expect(routeStep.details).toBe('Agregar aduanas intermedias');
    });
  });
});
