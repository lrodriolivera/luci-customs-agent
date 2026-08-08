/**
 * aiService TARIC/CLASIFICACION/FEEDBACK: cobertura de ramas
 *
 * Métodos asignados (líneas ~5491-6489):
 * - improveClassificationWithFeedback (5491-5577)
 * - suggestBasedOnHistory (5582-5692)
 * - crossValidateWithRegulations (5697-5847)
 * - fullTaricAnalysis (5854-5959)
 * - recordClassificationFeedback (5965-6038)
 * - _consolidateTaricSuggestions (6044-6103) [HELPER PURO]
 * - _calculateFinalClassificationScore (6109-6162) [HELPER PURO]
 * - _generateClassificationNextSteps (6168-6248) [HELPER PURO]
 * - _generateClassificationAlerts (6254-6323) [HELPER PURO]
 * - getTaricCodeInfo (6331-6389)
 * - generateTreeLevel (6398-6472)
 * - mockResponse (6478-6485) [HELPER PURO]
 *
 * Estrategia: mockear callClaude SOLO cuando el método lo invoca. Los helpers
 * síncronos puros se prueban directamente. Cubrir TODAS las ramas: JSON válido/
 * inválido, con/sin bloque ```json, arrays vacíos/llenos, scores altos/bajos.
 */

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const aiService = require('../../src/services/aiService');

describe('improveClassificationWithFeedback: aprender de correcciones', () => {
  let callClaudeSpy;

  beforeEach(() => {
    callClaudeSpy = jest.spyOn(aiService, 'callClaude');
  });

  afterEach(() => {
    callClaudeSpy.mockRestore();
  });

  test('sin feedback previo, devuelve sugerencias sin ajuste', async () => {
    const jsonResponse = {
      improvedSuggestions: [
        {
          taricCode: '0901210000',
          hsCode: '090121',
          confidence: 95,
          confidenceAdjustment: '+0%',
          description: 'Café tostado, sin descafeinar',
          reasoning: 'Sin historial de feedback',
          feedbackInfluence: 'Ninguna',
          similarCasesFound: 0
        }
      ],
      learningInsights: {
        patternsIdentified: [],
        commonMistakes: [],
        confidenceFactors: []
      },
      feedbackSummary: {
        relevantCasesAnalyzed: 0,
        positiveConfirmations: 0,
        correctionsConsidered: 0,
        overallLearningImpact: 'NONE'
      },
      recommendations: []
    };

    callClaudeSpy.mockResolvedValue({
      content: `\`\`\`json\n${JSON.stringify(jsonResponse)}\n\`\`\``,
      tokensUsed: 500,
      model: 'opus-4',
      stopReason: 'end_turn'
    });

    const result = await aiService.improveClassificationWithFeedback(
      'Café tostado sin descafeinar',
      [{ taricCode: '0901210000', confidence: 90 }],
      []
    );

    expect(result.improvedSuggestions).toHaveLength(1);
    expect(result.improvedSuggestions[0].taricCode).toBe('0901210000');
    expect(result.feedbackSummary.overallLearningImpact).toBe('NONE');
    expect(result.model).toBe('opus-5');
    expect(result.tokensUsed).toBe(500);
    expect(result.analyzedAt).toBeDefined();
  });

  test('con feedback de correcciones, ajusta confianza hacia abajo', async () => {
    const jsonResponse = {
      improvedSuggestions: [
        {
          taricCode: '2204210000',
          hsCode: '220421',
          confidence: 75,
          confidenceAdjustment: '-10%',
          description: 'Vino tinto',
          reasoning: 'Historial muestra correcciones frecuentes',
          feedbackInfluence: 'Reducida por 2 correcciones similares',
          similarCasesFound: 2
        }
      ],
      learningInsights: {
        patternsIdentified: ['Confusión entre vino tinto/blanco'],
        commonMistakes: ['No considerar el proceso de elaboración'],
        confidenceFactors: ['Color del vino', 'Método de elaboración']
      },
      feedbackSummary: {
        relevantCasesAnalyzed: 2,
        positiveConfirmations: 0,
        correctionsConsidered: 2,
        overallLearningImpact: 'HIGH'
      },
      recommendations: [
        {
          type: 'verification',
          action: 'Verificar color y método de elaboración',
          reason: 'Historial de errores en esta categoría'
        }
      ]
    };

    callClaudeSpy.mockResolvedValue({
      content: JSON.stringify(jsonResponse), // SIN bloque ```json
      tokensUsed: 800
    });

    const feedbackHistory = [
      {
        originalDescription: 'Vino tinto Rioja',
        suggestedCode: '2204210000',
        wasCorrect: false,
        correctCode: '2204210010',
        notes: 'Faltaba subdivisión por DO'
      },
      {
        originalDescription: 'Vino tinto Ribera',
        suggestedCode: '2204210000',
        wasCorrect: false,
        correctCode: '2204210010',
        notes: 'Idem'
      }
    ];

    const result = await aiService.improveClassificationWithFeedback(
      'Vino tinto de mesa',
      [{ taricCode: '2204210000', confidence: 85 }],
      feedbackHistory
    );

    expect(result.improvedSuggestions[0].confidence).toBe(75);
    expect(result.feedbackSummary.correctionsConsidered).toBe(2);
    expect(result.learningInsights.commonMistakes).toContain('No considerar el proceso de elaboración');
    expect(result.recommendations).toHaveLength(1);
  });

  test('con confirmaciones positivas, aumenta confianza', async () => {
    const jsonResponse = {
      improvedSuggestions: [
        {
          taricCode: '8471300000',
          hsCode: '847130',
          confidence: 98,
          confidenceAdjustment: '+8%',
          description: 'Máquinas automáticas para tratamiento de datos portátiles',
          reasoning: 'Confirmado por 3 casos previos',
          feedbackInfluence: 'Aumentada por confirmaciones',
          similarCasesFound: 3
        }
      ],
      learningInsights: {
        patternsIdentified: ['Portátiles siempre a 847130'],
        commonMistakes: [],
        confidenceFactors: ['Confirmaciones múltiples']
      },
      feedbackSummary: {
        relevantCasesAnalyzed: 3,
        positiveConfirmations: 3,
        correctionsConsidered: 0,
        overallLearningImpact: 'HIGH'
      },
      recommendations: []
    };

    callClaudeSpy.mockResolvedValue({
      content: `\`\`\`\n${JSON.stringify(jsonResponse)}\n\`\`\``, // sin "json" en el bloque
      tokensUsed: 600
    });

    const feedbackHistory = [
      { originalDescription: 'Laptop HP', suggestedCode: '8471300000', wasCorrect: true },
      { originalDescription: 'MacBook Pro', suggestedCode: '8471300000', wasCorrect: true },
      { originalDescription: 'Dell Latitude', suggestedCode: '8471300000', wasCorrect: true }
    ];

    const result = await aiService.improveClassificationWithFeedback(
      'Portátil Lenovo Thinkpad',
      [{ taricCode: '8471300000', confidence: 90 }],
      feedbackHistory
    );

    expect(result.improvedSuggestions[0].confidence).toBe(98);
    expect(result.feedbackSummary.positiveConfirmations).toBe(3);
    expect(result.feedbackSummary.overallLearningImpact).toBe('HIGH');
  });

  test('JSON inválido activa el fallback', async () => {
    callClaudeSpy.mockResolvedValue({
      content: 'Esto no es JSON válido { malformado',
      tokensUsed: 100
    });

    const currentSuggestions = [{ taricCode: '6109100010', confidence: 80 }];
    const result = await aiService.improveClassificationWithFeedback(
      'Camiseta de algodón',
      currentSuggestions,
      []
    );

    expect(result.improvedSuggestions).toEqual(currentSuggestions);
    expect(result.error).toBe('Error procesando mejora con feedback');
    expect(result.rawResponse).toBeDefined();
    expect(result.feedbackSummary.overallLearningImpact).toBe('NONE');
  });

  test('sugerencias actuales vacías no bloquea', async () => {
    const jsonResponse = {
      improvedSuggestions: [],
      learningInsights: { patternsIdentified: [], commonMistakes: [], confidenceFactors: [] },
      feedbackSummary: {
        relevantCasesAnalyzed: 0,
        positiveConfirmations: 0,
        correctionsConsidered: 0,
        overallLearningImpact: 'NONE'
      },
      recommendations: []
    };

    callClaudeSpy.mockResolvedValue({
      content: `\`\`\`json\n${JSON.stringify(jsonResponse)}\n\`\`\``,
      tokensUsed: 200
    });

    const result = await aiService.improveClassificationWithFeedback(
      'Producto desconocido',
      [],
      []
    );

    expect(result.improvedSuggestions).toEqual([]);
    expect(result.feedbackSummary.overallLearningImpact).toBe('NONE');
  });
});

describe('suggestBasedOnHistory: precedentes del cliente', () => {
  let callClaudeSpy;

  beforeEach(() => {
    callClaudeSpy = jest.spyOn(aiService, 'callClaude');
  });

  afterEach(() => {
    callClaudeSpy.mockRestore();
  });

  test('sin historial, marca el producto como nuevo', async () => {
    const jsonResponse = {
      historicalAnalysis: {
        similarProductsFound: 0,
        mostUsedCodes: [],
        patternDetected: false,
        patternDescription: 'Sin datos históricos'
      },
      suggestions: [],
      clientProfileFit: {
        isTypicalProduct: false,
        sectorAlignment: 'LOW',
        recommendation: 'Análisis manual recomendado'
      },
      precedents: [],
      warnings: [],
      newProductAlert: {
        isNew: true,
        message: 'Primer producto de este tipo para el cliente'
      }
    };

    callClaudeSpy.mockResolvedValue({
      content: `\`\`\`json\n${JSON.stringify(jsonResponse)}\n\`\`\``,
      tokensUsed: 400
    });

    const result = await aiService.suggestBasedOnHistory(
      'Camisetas de algodón',
      [],
      { sector: 'Textiles' }
    );

    expect(result.historicalAnalysis.similarProductsFound).toBe(0);
    expect(result.newProductAlert.isNew).toBe(true);
    expect(result.clientProfileFit.sectorAlignment).toBe('LOW');
    expect(result.model).toBe('opus-5');
    expect(result.analyzedAt).toBeDefined();
  });

  test('con historial de 3 productos similares, propone el código más usado', async () => {
    const jsonResponse = {
      historicalAnalysis: {
        similarProductsFound: 3,
        mostUsedCodes: [
          { taricCode: '6109100010', frequency: 3, successRate: 100, lastUsed: '2026-08-01' }
        ],
        patternDetected: true,
        patternDescription: 'Cliente importa frecuentemente textiles de algodón'
      },
      suggestions: [
        {
          taricCode: '6109100010',
          hsCode: '610910',
          confidence: 95,
          source: 'historical',
          description: 'Camisetas de punto de algodón',
          reasoning: 'Código usado 3 veces con 100% de éxito',
          historicalSuccess: {
            timesUsed: 3,
            acceptedWithoutIssues: 3,
            inspected: 0,
            corrected: 0
          },
          riskAssessment: 'LOW'
        }
      ],
      clientProfileFit: {
        isTypicalProduct: true,
        sectorAlignment: 'HIGH',
        recommendation: 'Producto típico del cliente, clasificación confiable'
      },
      precedents: [
        { description: 'Camisetas polo algodón', taricCode: '6109100010', date: '2026-07-15', outcome: 'aceptado' },
        { description: 'Camisetas cuello redondo', taricCode: '6109100010', date: '2026-07-20', outcome: 'aceptado' },
        { description: 'Camisetas manga larga', taricCode: '6109100010', date: '2026-08-01', outcome: 'aceptado' }
      ],
      warnings: [],
      newProductAlert: { isNew: false }
    };

    callClaudeSpy.mockResolvedValue({
      content: JSON.stringify(jsonResponse), // sin bloque markdown
      tokensUsed: 800
    });

    const historicalClassifications = [
      { description: 'Camisetas polo algodón', taricCode: '6109100010', classifiedAt: '2026-07-15', status: 'aceptado' },
      { description: 'Camisetas cuello redondo', taricCode: '6109100010', classifiedAt: '2026-07-20', status: 'aceptado' },
      { description: 'Camisetas manga larga', taricCode: '6109100010', classifiedAt: '2026-08-01', status: 'aceptado' }
    ];

    const result = await aiService.suggestBasedOnHistory(
      'Camisetas básicas de algodón',
      historicalClassifications,
      { sector: 'Textiles', frequentProducts: ['camisetas', 'pantalones'] }
    );

    expect(result.historicalAnalysis.similarProductsFound).toBe(3);
    expect(result.historicalAnalysis.patternDetected).toBe(true);
    expect(result.suggestions[0].taricCode).toBe('6109100010');
    expect(result.suggestions[0].historicalSuccess.acceptedWithoutIssues).toBe(3);
    expect(result.clientProfileFit.isTypicalProduct).toBe(true);
    expect(result.precedents).toHaveLength(3);
  });

  test('producto atípico para el sector del cliente', async () => {
    const jsonResponse = {
      historicalAnalysis: {
        similarProductsFound: 0,
        mostUsedCodes: [],
        patternDetected: false
      },
      suggestions: [
        {
          taricCode: '8471300000',
          hsCode: '847130',
          confidence: 60,
          source: 'new',
          description: 'Portátiles',
          reasoning: 'Sin precedentes, clasificación nueva',
          riskAssessment: 'MEDIUM'
        }
      ],
      clientProfileFit: {
        isTypicalProduct: false,
        sectorAlignment: 'LOW',
        recommendation: 'Producto fuera del sector habitual, requiere revisión'
      },
      precedents: [],
      warnings: ['Producto no alineado con el perfil del cliente'],
      newProductAlert: { isNew: true, message: 'Categoría nueva para el cliente' }
    };

    callClaudeSpy.mockResolvedValue({
      content: `\`\`\`\n${JSON.stringify(jsonResponse)}\n\`\`\``,
      tokensUsed: 500
    });

    const result = await aiService.suggestBasedOnHistory(
      'Portátiles para oficina',
      [],
      { sector: 'Textiles', frequentProducts: ['camisetas', 'pantalones'] }
    );

    expect(result.clientProfileFit.sectorAlignment).toBe('LOW');
    expect(result.warnings).toContain('Producto no alineado con el perfil del cliente');
    expect(result.newProductAlert.isNew).toBe(true);
  });

  test('JSON inválido activa el fallback', async () => {
    callClaudeSpy.mockResolvedValue({
      content: '{ invalid json',
      tokensUsed: 50
    });

    const result = await aiService.suggestBasedOnHistory(
      'Producto X',
      [],
      {}
    );

    expect(result.historicalAnalysis.similarProductsFound).toBe(0);
    expect(result.suggestions).toEqual([]);
    expect(result.warnings).toContain('Error procesando análisis histórico');
    expect(result.newProductAlert.isNew).toBe(true);
    expect(result.rawResponse).toBeDefined();
  });
});

describe('crossValidateWithRegulations: validación normativa', () => {
  let callClaudeSpy;

  beforeEach(() => {
    callClaudeSpy = jest.spyOn(aiService, 'callClaude');
  });

  afterEach(() => {
    callClaudeSpy.mockRestore();
  });

  test('clasificación válida confirmada por RGI', async () => {
    const jsonResponse = {
      validationResult: {
        isValid: true,
        validationScore: 95,
        overallAssessment: 'CONFIRMED'
      },
      rgiAnalysis: {
        rgi1_description: { applies: true, assessment: 'Cumple RGI 1' },
        rgi2_incomplete: { applies: false },
        rgi3_specific: { applies: false },
        rgi6_subheading: { applies: true, assessment: 'Subpartida correcta' },
        conclusionRGI: 'Clasificación cumple con RGI 1 y 6'
      },
      chapterNotes: {
        sectionNotes: ['Nota de sección aplicable'],
        chapterNotes: ['Nota de capítulo 09'],
        exclusions: [],
        inclusions: ['Café tostado incluido']
      },
      specialMeasures: {
        antidumping: { applies: false },
        countervailing: { applies: false },
        quota: { applies: false },
        suspension: { applies: false },
        safeguard: { applies: false }
      },
      documentationRequirements: [],
      alternativeClassifications: [],
      bindingInformation: {
        relevantIAVs: [],
        recommendation: 'No requiere IAV'
      },
      riskFactors: [],
      finalRecommendation: {
        proceed: true,
        confidence: 95,
        actions: [],
        summary: 'Clasificación válida y confirmada'
      }
    };

    callClaudeSpy.mockResolvedValue({
      content: `\`\`\`json\n${JSON.stringify(jsonResponse)}\n\`\`\``,
      tokensUsed: 1200
    });

    const result = await aiService.crossValidateWithRegulations(
      { taricCode: '0901210000', confidence: 90 },
      { description: 'Café tostado sin descafeinar', material: 'Café', origin: 'Colombia' }
    );

    expect(result.validationResult.isValid).toBe(true);
    expect(result.validationResult.overallAssessment).toBe('CONFIRMED');
    expect(result.rgiAnalysis.conclusionRGI).toContain('Clasificación cumple');
    expect(result.finalRecommendation.proceed).toBe(true);
    expect(result.model).toBe('opus-5');
    expect(result.validatedAt).toBeDefined();
  });

  test('clasificación con medidas antidumping aplicables', async () => {
    const jsonResponse = {
      validationResult: {
        isValid: true,
        validationScore: 85,
        overallAssessment: 'LIKELY_CORRECT'
      },
      rgiAnalysis: {
        rgi1_description: { applies: true, assessment: 'Cumple' },
        conclusionRGI: 'Correcta'
      },
      chapterNotes: { sectionNotes: [], chapterNotes: [], exclusions: [], inclusions: [] },
      specialMeasures: {
        antidumping: {
          applies: true,
          details: 'Derechos antidumping del 25% para origen China',
          regulation: 'Reg. (UE) 2024/123'
        },
        countervailing: { applies: false },
        quota: { applies: false },
        suspension: { applies: false },
        safeguard: { applies: false }
      },
      documentationRequirements: [
        { document: 'Certificado de origen', code: 'C501', mandatory: true, reason: 'Verificar origen por antidumping' }
      ],
      alternativeClassifications: [],
      bindingInformation: { relevantIAVs: [], recommendation: 'Consultar AEAT si dudas' },
      riskFactors: [
        { factor: 'Antidumping aplicable', severity: 'HIGH', mitigation: 'Verificar origen y aranceles adicionales' }
      ],
      finalRecommendation: {
        proceed: true,
        confidence: 85,
        actions: ['Verificar origen', 'Calcular aranceles adicionales'],
        summary: 'Válida pero con medidas especiales'
      }
    };

    callClaudeSpy.mockResolvedValue({
      content: JSON.stringify(jsonResponse),
      tokensUsed: 1500
    });

    const result = await aiService.crossValidateWithRegulations(
      { taricCode: '8471300000', confidence: 85 },
      { description: 'Portátiles', origin: 'China' }
    );

    expect(result.specialMeasures.antidumping.applies).toBe(true);
    expect(result.specialMeasures.antidumping.details).toContain('25%');
    expect(result.documentationRequirements).toHaveLength(1);
    expect(result.riskFactors[0].severity).toBe('HIGH');
    expect(result.finalRecommendation.actions).toContain('Verificar origen');
  });

  test('clasificación con cuota arancelaria', async () => {
    const jsonResponse = {
      validationResult: {
        isValid: true,
        validationScore: 90,
        overallAssessment: 'CONFIRMED'
      },
      rgiAnalysis: { conclusionRGI: 'Correcta' },
      chapterNotes: { sectionNotes: [], chapterNotes: [], exclusions: [], inclusions: [] },
      specialMeasures: {
        antidumping: { applies: false },
        countervailing: { applies: false },
        quota: {
          applies: true,
          quotaNumber: '09.1234',
          currentStatus: 'Disponible 45% restante'
        },
        suspension: { applies: false },
        safeguard: { applies: false }
      },
      documentationRequirements: [
        { document: 'Certificado de cuota', code: 'C600', mandatory: true, reason: 'Acceso a cuota arancelaria' }
      ],
      alternativeClassifications: [],
      bindingInformation: { relevantIAVs: [], recommendation: 'No necesario' },
      riskFactors: [
        { factor: 'Disponibilidad de cuota', severity: 'MEDIUM', mitigation: 'Verificar disponibilidad actual antes de importar' }
      ],
      finalRecommendation: {
        proceed: true,
        confidence: 90,
        actions: ['Verificar disponibilidad de cuota en AEAT'],
        summary: 'Válida, atención a cuota'
      }
    };

    callClaudeSpy.mockResolvedValue({
      content: `\`\`\`\n${JSON.stringify(jsonResponse)}\n\`\`\``,
      tokensUsed: 1300
    });

    const result = await aiService.crossValidateWithRegulations(
      { taricCode: '2204210000', confidence: 88 },
      { description: 'Vino tinto', origin: 'Chile' }
    );

    expect(result.specialMeasures.quota.applies).toBe(true);
    expect(result.specialMeasures.quota.quotaNumber).toBe('09.1234');
    expect(result.documentationRequirements).toHaveLength(1);
    expect(result.finalRecommendation.actions).toContain('Verificar disponibilidad de cuota en AEAT');
  });

  test('clasificación incorrecta según RGI', async () => {
    const jsonResponse = {
      validationResult: {
        isValid: false,
        validationScore: 30,
        overallAssessment: 'LIKELY_INCORRECT'
      },
      rgiAnalysis: {
        rgi1_description: { applies: false, assessment: 'No cumple con descripción específica' },
        rgi3_specific: { applies: true, assessment: 'Debería aplicar RGI 3 para resolver' },
        conclusionRGI: 'Clasificación incorrecta, revisar RGI 3'
      },
      chapterNotes: { sectionNotes: [], chapterNotes: ['Exclusión aplicable'], exclusions: ['Excluye este tipo'], inclusions: [] },
      specialMeasures: {},
      documentationRequirements: [],
      alternativeClassifications: [
        {
          taricCode: '6109900010',
          reasoning: 'Material distinto al declarado',
          differentiatingFactor: 'Composición fibra',
          probability: 75
        }
      ],
      bindingInformation: { relevantIAVs: [], recommendation: 'Solicitar IAV para confirmar' },
      riskFactors: [
        { factor: 'Clasificación incorrecta', severity: 'HIGH', mitigation: 'Reclasificar según RGI 3' }
      ],
      finalRecommendation: {
        proceed: false,
        confidence: 30,
        actions: ['Revisar composición del producto', 'Considerar 6109900010'],
        summary: 'Clasificación probablemente incorrecta'
      }
    };

    callClaudeSpy.mockResolvedValue({
      content: `\`\`\`json\n${JSON.stringify(jsonResponse)}\n\`\`\``,
      tokensUsed: 1400
    });

    const result = await aiService.crossValidateWithRegulations(
      { taricCode: '6109100010', confidence: 65 },
      { description: 'Camiseta de fibra sintética', material: 'poliéster' }
    );

    expect(result.validationResult.isValid).toBe(false);
    expect(result.validationResult.overallAssessment).toBe('LIKELY_INCORRECT');
    expect(result.alternativeClassifications).toHaveLength(1);
    expect(result.alternativeClassifications[0].probability).toBe(75);
    expect(result.finalRecommendation.proceed).toBe(false);
  });

  test('clasificación requiere revisión (NEEDS_REVIEW)', async () => {
    const jsonResponse = {
      validationResult: {
        isValid: true,
        validationScore: 70,
        overallAssessment: 'NEEDS_REVIEW'
      },
      rgiAnalysis: { conclusionRGI: 'Ambigua, requiere más información' },
      chapterNotes: { sectionNotes: [], chapterNotes: [], exclusions: [], inclusions: [] },
      specialMeasures: {},
      documentationRequirements: [],
      alternativeClassifications: [
        { taricCode: '9503007000', reasoning: 'Podría ser juguete', differentiatingFactor: 'Uso final', probability: 40 }
      ],
      bindingInformation: { relevantIAVs: [], recommendation: 'IAV recomendada' },
      riskFactors: [
        { factor: 'Ambigüedad en clasificación', severity: 'MEDIUM', mitigation: 'Revisar uso final del producto' }
      ],
      finalRecommendation: {
        proceed: false,
        confidence: 70,
        actions: ['Determinar uso final', 'Considerar solicitar IAV'],
        summary: 'Requiere revisión manual'
      }
    };

    callClaudeSpy.mockResolvedValue({
      content: JSON.stringify(jsonResponse),
      tokensUsed: 1100
    });

    const result = await aiService.crossValidateWithRegulations(
      { taricCode: '8471300000', confidence: 70 },
      { description: 'Dispositivo electrónico educativo', use: 'Aprendizaje infantil' }
    );

    expect(result.validationResult.overallAssessment).toBe('NEEDS_REVIEW');
    expect(result.alternativeClassifications).toHaveLength(1);
    expect(result.finalRecommendation.proceed).toBe(false);
    expect(result.finalRecommendation.actions).toContain('Considerar solicitar IAV');
  });

  test('JSON inválido activa el fallback', async () => {
    callClaudeSpy.mockResolvedValue({
      content: 'malformed { json',
      tokensUsed: 200
    });

    const result = await aiService.crossValidateWithRegulations(
      { taricCode: '0901210000' },
      { description: 'Café' }
    );

    expect(result.validationResult.isValid).toBe(false);
    expect(result.validationResult.overallAssessment).toBe('NEEDS_REVIEW');
    expect(result.riskFactors).toHaveLength(1);
    expect(result.riskFactors[0].severity).toBe('HIGH');
    expect(result.finalRecommendation.proceed).toBe(false);
    expect(result.rawResponse).toBeDefined();
  });
});

describe('fullTaricAnalysis: análisis completo combinado', () => {
  let callClaudeSpy;
  let classifyProductSpy;
  let suggestBasedOnHistorySpy;
  let improveClassificationWithFeedbackSpy;
  let crossValidateWithRegulationsSpy;

  beforeEach(() => {
    callClaudeSpy = jest.spyOn(aiService, 'callClaude');
    classifyProductSpy = jest.spyOn(aiService, 'classifyProduct');
    suggestBasedOnHistorySpy = jest.spyOn(aiService, 'suggestBasedOnHistory');
    improveClassificationWithFeedbackSpy = jest.spyOn(aiService, 'improveClassificationWithFeedback');
    crossValidateWithRegulationsSpy = jest.spyOn(aiService, 'crossValidateWithRegulations');
  });

  afterEach(() => {
    callClaudeSpy.mockRestore();
    classifyProductSpy.mockRestore();
    suggestBasedOnHistorySpy.mockRestore();
    improveClassificationWithFeedbackSpy.mockRestore();
    crossValidateWithRegulationsSpy.mockRestore();
  });

  test('sin historial ni feedback, solo clasificación base', async () => {
    classifyProductSpy.mockResolvedValue([
      { taricCode: '0901210000', confidence: 85, reasoning: 'Café tostado' }
    ]);

    suggestBasedOnHistorySpy.mockResolvedValue({
      historicalAnalysis: { similarProductsFound: 0 },
      suggestions: [],
      tokensUsed: 400
    });

    const result = await aiService.fullTaricAnalysis(
      { description: 'Café tostado sin descafeinar' },
      { validateWithRegulations: false }
    );

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].taricCode).toBe('0901210000');
    expect(result.finalAssessment.recommendedCode).toBe('0901210000');
    expect(result.finalAssessment.readyToUse).toBeDefined();
    expect(result.analysis.baseSuggestions).toBeDefined();
    expect(result.analysis.historicalAnalysis).toBeDefined();
    expect(result.analysis.feedbackLearning).toBeNull();
    expect(result.analysis.regulationValidation).toBeNull();
    expect(result.model).toBe('opus-5-combined');
  });

  test('con historial y feedback, consolida tres fuentes', async () => {
    classifyProductSpy.mockResolvedValue([
      { taricCode: '6109100010', confidence: 80 }
    ]);

    suggestBasedOnHistorySpy.mockResolvedValue({
      historicalAnalysis: { similarProductsFound: 2 },
      suggestions: [
        { taricCode: '6109100010', confidence: 85, historicalSuccess: { timesUsed: 2 } }
      ],
      tokensUsed: 500
    });

    improveClassificationWithFeedbackSpy.mockResolvedValue({
      improvedSuggestions: [
        { taricCode: '6109100010', confidence: 88, feedbackInfluence: 'Confirmado' }
      ],
      feedbackSummary: { overallLearningImpact: 'MEDIUM' },
      tokensUsed: 600
    });

    const result = await aiService.fullTaricAnalysis(
      { description: 'Camisetas de algodón' },
      {
        historicalClassifications: [
          { description: 'Camisetas polo', taricCode: '6109100010' },
          { description: 'Camisetas cuello redondo', taricCode: '6109100010' }
        ],
        feedbackHistory: [
          { originalDescription: 'Camisetas básicas', suggestedCode: '6109100010', wasCorrect: true }
        ],
        validateWithRegulations: false
      }
    );

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].taricCode).toBe('6109100010');
    expect(result.suggestions[0].sources).toContain('base');
    expect(result.suggestions[0].sources).toContain('history');
    expect(result.suggestions[0].sources).toContain('feedback');
    expect(result.analysis.feedbackLearning).not.toBeNull();
    expect(result.finalAssessment.confidence).toBeGreaterThan(80);
  });

  test('con validación normativa activada, ejecuta crossValidate', async () => {
    classifyProductSpy.mockResolvedValue([
      { taricCode: '0901210000', confidence: 90 }
    ]);

    suggestBasedOnHistorySpy.mockResolvedValue({
      historicalAnalysis: { similarProductsFound: 0 },
      suggestions: [],
      tokensUsed: 300
    });

    crossValidateWithRegulationsSpy.mockResolvedValue({
      validationResult: { isValid: true, overallAssessment: 'CONFIRMED' },
      tokensUsed: 1200
    });

    const result = await aiService.fullTaricAnalysis(
      { description: 'Café tostado', material: 'Café', origin: 'Colombia' },
      { validateWithRegulations: true }
    );

    expect(result.analysis.regulationValidation).not.toBeNull();
    expect(result.analysis.regulationValidation.validationResult.isValid).toBe(true);
    expect(result.finalAssessment.readyToUse).toBe(true);
    expect(crossValidateWithRegulationsSpy).toHaveBeenCalled();
  });

  test('sin sugerencias, devuelve error gracefully', async () => {
    classifyProductSpy.mockResolvedValue([]);
    suggestBasedOnHistorySpy.mockResolvedValue({
      historicalAnalysis: { similarProductsFound: 0 },
      suggestions: [],
      tokensUsed: 200
    });

    const result = await aiService.fullTaricAnalysis(
      { description: 'Producto desconocido' },
      { validateWithRegulations: false }
    );

    expect(result.suggestions).toEqual([]);
    expect(result.finalAssessment.recommendedCode).toBeNull();
    expect(result.finalAssessment.confidence).toBe(0);
    expect(result.nextSteps).toHaveLength(1);
    expect(result.nextSteps[0].action).toContain('más información');
  });

  test('error en análisis devuelve estructura de error', async () => {
    classifyProductSpy.mockRejectedValue(new Error('API timeout'));

    const result = await aiService.fullTaricAnalysis(
      { description: 'Producto X' }
    );

    expect(result.error).toBe('Error realizando análisis completo de clasificación');
    expect(result.suggestions).toEqual([]);
    expect(result.nextSteps[0].priority).toBe(1);
    expect(result.nextSteps[0].action).toContain('manualmente');
  });

  test('calcula tokensUsed sumando todas las llamadas', async () => {
    classifyProductSpy.mockResolvedValue([
      { taricCode: '0901210000', confidence: 85 }
    ]);

    suggestBasedOnHistorySpy.mockResolvedValue({
      suggestions: [],
      tokensUsed: 400
    });

    improveClassificationWithFeedbackSpy.mockResolvedValue({
      improvedSuggestions: [],
      tokensUsed: 300
    });

    crossValidateWithRegulationsSpy.mockResolvedValue({
      validationResult: { isValid: true },
      tokensUsed: 1200
    });

    const result = await aiService.fullTaricAnalysis(
      { description: 'Café' },
      { feedbackHistory: [{ wasCorrect: true }], validateWithRegulations: true }
    );

    // baseSuggestions es un array sin tokensUsed, cuenta 0
    expect(result.tokensUsed).toBe(1900); // 0 + 400 + 300 + 1200
  });

  test('omite la validacion normativa cuando se agota el presupuesto de tiempo', async () => {
    // El analisis encadena varias llamadas a Bedrock y el proxy corta a ~100s
    // (524). Con el presupuesto agotado se saltan las llamadas restantes y se
    // devuelve lo ya calculado, en vez de arriesgar el timeout. Forzamos el
    // agotamiento con presupuesto 0.
    const budgetPrev = process.env.FULL_ANALYSIS_BUDGET_MS;
    process.env.FULL_ANALYSIS_BUDGET_MS = '0';

    classifyProductSpy.mockResolvedValue([
      { taricCode: '9503002100', confidence: 80, reasoning: 'Juguete' }
    ]);
    suggestBasedOnHistorySpy.mockResolvedValue({ suggestions: [], tokensUsed: 100 });

    const result = await aiService.fullTaricAnalysis(
      { description: 'Juguete de plastico' },
      { validateWithRegulations: true }
    );

    // No se llamo a la validacion normativa (la mas cara).
    expect(crossValidateWithRegulationsSpy).not.toHaveBeenCalled();
    // Se marca para que la UI pueda avisar / ofrecer reintento.
    expect(result.validationSkipped).toBe(true);
    // Aun asi devuelve las sugerencias ya obtenidas, no un error.
    expect(result.suggestions).toHaveLength(1);
    expect(result.finalAssessment.recommendedCode).toBe('9503002100');

    if (budgetPrev === undefined) delete process.env.FULL_ANALYSIS_BUDGET_MS;
    else process.env.FULL_ANALYSIS_BUDGET_MS = budgetPrev;
  });

  test('con presupuesto suficiente si ejecuta la validacion normativa', async () => {
    const budgetPrev = process.env.FULL_ANALYSIS_BUDGET_MS;
    process.env.FULL_ANALYSIS_BUDGET_MS = '600000'; // 10 min, no se agota

    classifyProductSpy.mockResolvedValue([{ taricCode: '9503002100', confidence: 80 }]);
    suggestBasedOnHistorySpy.mockResolvedValue({ suggestions: [], tokensUsed: 100 });
    crossValidateWithRegulationsSpy.mockResolvedValue({ validationResult: { isValid: true }, tokensUsed: 200 });

    const result = await aiService.fullTaricAnalysis(
      { description: 'Juguete de plastico' },
      { validateWithRegulations: true }
    );

    expect(crossValidateWithRegulationsSpy).toHaveBeenCalled();
    expect(result.validationSkipped).toBe(false);
    expect(result.analysis.regulationValidation).not.toBeNull();

    if (budgetPrev === undefined) delete process.env.FULL_ANALYSIS_BUDGET_MS;
    else process.env.FULL_ANALYSIS_BUDGET_MS = budgetPrev;
  });
});

describe('recordClassificationFeedback: grabar aprendizajes', () => {
  let callClaudeSpy;

  beforeEach(() => {
    callClaudeSpy = jest.spyOn(aiService, 'callClaude');
  });

  afterEach(() => {
    callClaudeSpy.mockRestore();
  });

  test('feedback de clasificación correcta', async () => {
    const jsonResponse = {
      feedbackAnalysis: {
        wasCorrect: true,
        errorType: 'none',
        rootCause: 'N/A',
        correctInterpretation: 'Clasificación acertada'
      },
      learningRules: [
        { rule: 'Confirmar patrón para café tostado', trigger: 'Producto: café', action: 'Usar 0901210000' }
      ],
      patternUpdate: {
        keywords: ['café', 'tostado', 'sin descafeinar'],
        exclusions: [],
        confidenceAdjustment: '+5%'
      },
      processImprovement: {
        suggestion: 'Mantener enfoque en origen y proceso',
        impact: 'Confirmación del método actual'
      },
      similarCasesImpact: 'Refuerza confianza en clasificaciones de café'
    };

    callClaudeSpy.mockResolvedValue({
      content: `\`\`\`json\n${JSON.stringify(jsonResponse)}\n\`\`\``,
      tokensUsed: 400
    });

    const result = await aiService.recordClassificationFeedback(
      {
        suggestedCode: '0901210000',
        description: 'Café tostado sin descafeinar',
        confidence: 95
      },
      {
        wasCorrect: true,
        notes: 'Aceptado por AEAT sin problemas',
        userId: 'user123'
      }
    );

    expect(result.feedbackAnalysis.wasCorrect).toBe(true);
    expect(result.feedbackAnalysis.errorType).toBe('none');
    expect(result.learningRules).toHaveLength(1);
    expect(result.patternUpdate.confidenceAdjustment).toBe('+5%');
    expect(result.feedbackId).toBeDefined();
    expect(result.feedbackId).toMatch(/^fb_/);
    expect(result.recordedAt).toBeDefined();
    expect(result.model).toBe('sonnet-5');
  });

  test('feedback de clasificación incorrecta - error de material', async () => {
    const jsonResponse = {
      feedbackAnalysis: {
        wasCorrect: false,
        errorType: 'material',
        rootCause: 'No consideró mezcla de materiales',
        correctInterpretation: 'Debe ser código para textiles mixtos'
      },
      learningRules: [
        {
          rule: 'Verificar composición en textiles',
          trigger: 'Producto textil con más de un material',
          action: 'Clasificar según material predominante o código mixto'
        }
      ],
      patternUpdate: {
        keywords: ['algodón', 'poliéster', 'mezcla'],
        exclusions: ['100% algodón'],
        confidenceAdjustment: '-10%'
      },
      processImprovement: {
        suggestion: 'Preguntar composición detallada antes de clasificar',
        impact: 'Reducción de errores en textiles mixtos'
      },
      similarCasesImpact: 'Requiere revisión de otras clasificaciones de textiles mixtos'
    };

    callClaudeSpy.mockResolvedValue({
      content: JSON.stringify(jsonResponse),
      tokensUsed: 500
    });

    const result = await aiService.recordClassificationFeedback(
      {
        suggestedCode: '6109100010',
        description: 'Camiseta de algodón',
        confidence: 85
      },
      {
        wasCorrect: false,
        correctCode: '6109900010',
        notes: 'Era mezcla de algodón/poliéster 60/40',
        userId: 'user123'
      }
    );

    expect(result.feedbackAnalysis.wasCorrect).toBe(false);
    expect(result.feedbackAnalysis.errorType).toBe('material');
    expect(result.patternUpdate.confidenceAdjustment).toBe('-10%');
    expect(result.learningRules).toHaveLength(1);
    expect(result.processImprovement.suggestion).toContain('composición');
  });

  test('feedback de error por aplicación incorrecta de RGI', async () => {
    const jsonResponse = {
      feedbackAnalysis: {
        wasCorrect: false,
        errorType: 'rgi_application',
        rootCause: 'No aplicó RGI 3(c) correctamente',
        correctInterpretation: 'Debía clasificar por orden de partidas'
      },
      learningRules: [
        { rule: 'Aplicar RGI 3(c) cuando hay varias partidas posibles', trigger: 'Múltiples partidas', action: 'Elegir última en orden numérico' }
      ],
      patternUpdate: {
        keywords: [],
        exclusions: [],
        confidenceAdjustment: '-15%'
      },
      processImprovement: {
        suggestion: 'Enfatizar RGI 3 en productos complejos',
        impact: 'Mejora en productos con múltiples clasificaciones posibles'
      },
      similarCasesImpact: 'Revisar casos donde se ignoró RGI 3'
    };

    callClaudeSpy.mockResolvedValue({
      content: `\`\`\`\n${JSON.stringify(jsonResponse)}\n\`\`\``,
      tokensUsed: 450
    });

    const result = await aiService.recordClassificationFeedback(
      {
        suggestedCode: '9503007000',
        description: 'Muñeco de colección',
        confidence: 70
      },
      {
        wasCorrect: false,
        correctCode: '9503009900',
        notes: 'Debía aplicar RGI 3(c)'
      }
    );

    expect(result.feedbackAnalysis.errorType).toBe('rgi_application');
    expect(result.feedbackAnalysis.rootCause).toContain('RGI 3(c)');
    expect(result.patternUpdate.confidenceAdjustment).toBe('-15%');
  });

  test('JSON inválido activa el fallback', async () => {
    callClaudeSpy.mockResolvedValue({
      content: '{ invalid',
      tokensUsed: 50
    });

    const result = await aiService.recordClassificationFeedback(
      { suggestedCode: '0901210000', description: 'Café', confidence: 90 },
      { wasCorrect: false, correctCode: '0901220000' }
    );

    expect(result.feedbackAnalysis.errorType).toBe('unknown');
    expect(result.learningRules).toEqual([]);
    expect(result.feedbackId).toBeDefined();
    expect(result.rawResponse).toBeDefined();
  });
});

describe('_consolidateTaricSuggestions: consolidar múltiples fuentes (HELPER PURO)', () => {
  test('sin sugerencias de ninguna fuente, devuelve array vacío', () => {
    const result = aiService._consolidateTaricSuggestions([], [], []);
    expect(result).toEqual([]);
  });

  test('una sugerencia base sola conserva su confianza y fuente', () => {
    const result = aiService._consolidateTaricSuggestions(
      [{ taricCode: '0901210000', hsCode: '090121', confidence: 85, reasoning: 'Café tostado' }],
      [],
      []
    );

    expect(result).toHaveLength(1);
    expect(result[0].taricCode).toBe('0901210000');
    expect(result[0].confidence).toBe(85);
    expect(result[0].sources).toEqual(['base']);
  });

  test('sugerencia base + historial del mismo código aumenta confianza +10', () => {
    const result = aiService._consolidateTaricSuggestions(
      [{ taricCode: '6109100010', confidence: 80 }],
      [{ taricCode: '6109100010', confidence: 85, historicalSuccess: { timesUsed: 3 } }],
      []
    );

    expect(result).toHaveLength(1);
    expect(result[0].taricCode).toBe('6109100010');
    expect(result[0].confidence).toBe(90); // 80 + 10
    expect(result[0].sources).toEqual(['base', 'history']);
    expect(result[0].historicalSuccess).toBeDefined();
  });

  test('sugerencia base + feedback del mismo código usa confianza ajustada', () => {
    const result = aiService._consolidateTaricSuggestions(
      [{ taricCode: '0901210000', confidence: 85 }],
      [],
      [{ taricCode: '0901210000', confidence: 92, feedbackInfluence: 'Confirmado por 2 casos' }]
    );

    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(92); // usa la del feedback
    expect(result[0].sources).toEqual(['base', 'feedback']);
    expect(result[0].feedbackInfluence).toBe('Confirmado por 2 casos');
  });

  test('tres fuentes del mismo código combina todo', () => {
    const result = aiService._consolidateTaricSuggestions(
      [{ taricCode: '8471300000', confidence: 80, reasoning: 'Portátil' }],
      [{ taricCode: '8471300000', confidence: 85 }],
      [{ taricCode: '8471300000', confidence: 88, feedbackInfluence: 'Alta confianza' }]
    );

    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(88); // feedback override
    expect(result[0].sources).toEqual(['base', 'history', 'feedback']);
  });

  test('múltiples códigos distintos se ordenan por confianza descendente', () => {
    const result = aiService._consolidateTaricSuggestions(
      [
        { taricCode: '0901210000', confidence: 70 },
        { taricCode: '0901220000', confidence: 85 },
        { taricCode: '0901110000', confidence: 60 }
      ],
      [],
      []
    );

    expect(result).toHaveLength(3);
    expect(result[0].taricCode).toBe('0901220000'); // confidence 85
    expect(result[1].taricCode).toBe('0901210000'); // confidence 70
    expect(result[2].taricCode).toBe('0901110000'); // confidence 60
  });

  test('limita a máximo 5 sugerencias', () => {
    const baseSuggestions = Array.from({ length: 8 }, (_, i) => ({
      taricCode: `090121000${i}`,
      confidence: 90 - i * 5
    }));

    const result = aiService._consolidateTaricSuggestions(baseSuggestions, [], []);

    expect(result).toHaveLength(5);
    expect(result[0].confidence).toBe(90); // más alta
    expect(result[4].confidence).toBe(70); // quinta más alta
  });

  test('historial solo (sin base) se incluye', () => {
    const result = aiService._consolidateTaricSuggestions(
      [],
      [{ taricCode: '6109100010', confidence: 88, historicalSuccess: { timesUsed: 5 } }],
      []
    );

    expect(result).toHaveLength(1);
    expect(result[0].sources).toEqual(['history']);
  });

  test('feedback solo (sin base) se incluye', () => {
    const result = aiService._consolidateTaricSuggestions(
      [],
      [],
      [{ taricCode: '2204210000', confidence: 91, feedbackInfluence: 'Corregido 3 veces' }]
    );

    expect(result).toHaveLength(1);
    expect(result[0].sources).toEqual(['feedback']);
  });

  test('base con campo code en vez de taricCode se normaliza', () => {
    const result = aiService._consolidateTaricSuggestions(
      [{ code: '0901210000', confidence: 85 }],
      [],
      []
    );

    expect(result).toHaveLength(1);
    expect(result[0].taricCode).toBe('0901210000');
  });

  test('sugerencias sin código se ignoran', () => {
    const result = aiService._consolidateTaricSuggestions(
      [{ confidence: 85, reasoning: 'Sin código' }],
      [{ taricCode: null, confidence: 80 }],
      [{ taricCode: undefined, confidence: 90 }]
    );

    expect(result).toEqual([]);
  });

  test('confianza nunca supera 100 con boost de historial', () => {
    const result = aiService._consolidateTaricSuggestions(
      [{ taricCode: '0901210000', confidence: 95 }],
      [{ taricCode: '0901210000', confidence: 90 }],
      []
    );

    expect(result[0].confidence).toBe(100); // Math.min(100, 95 + 10)
  });

  test('historial sin coincidencia en base se agrega como nuevo código', () => {
    const result = aiService._consolidateTaricSuggestions(
      [{ taricCode: '0901210000', confidence: 80 }],
      [{ taricCode: '0901220000', confidence: 85, historicalSuccess: { timesUsed: 2 } }],
      []
    );

    expect(result).toHaveLength(2);
    expect(result.find(r => r.taricCode === '0901220000')).toBeDefined();
    expect(result.find(r => r.taricCode === '0901220000').sources).toEqual(['history']);
  });
});

describe('_calculateFinalClassificationScore: puntuación final (HELPER PURO)', () => {
  test('sin sugerencias, devuelve confianza 0', () => {
    const result = aiService._calculateFinalClassificationScore(null, null, null, null);
    expect(result.confidence).toBe(0);
    expect(result.factors).toEqual(['Sin sugerencias disponibles']);
  });

  test('sugerencia con confidence 80 sin otros factores', () => {
    const result = aiService._calculateFinalClassificationScore(
      { taricCode: '0901210000', confidence: 80 },
      null,
      null,
      null
    );

    expect(result.confidence).toBe(80);
    expect(result.factors).toEqual([]);
  });

  test('con 3 productos históricos similares, boost +9%', () => {
    const historyAnalysis = {
      historicalAnalysis: { similarProductsFound: 3 }
    };

    const result = aiService._calculateFinalClassificationScore(
      { confidence: 70 },
      historyAnalysis,
      null,
      null
    );

    expect(result.confidence).toBe(79); // 70 + 9
    expect(result.factors).toContain('+9% por 3 precedentes históricos');
  });

  test('con 10 productos históricos, boost limitado a +15%', () => {
    const historyAnalysis = {
      historicalAnalysis: { similarProductsFound: 10 }
    };

    const result = aiService._calculateFinalClassificationScore(
      { confidence: 70 },
      historyAnalysis,
      null,
      null
    );

    expect(result.confidence).toBe(85); // 70 + 15 (max)
    expect(result.factors).toContain('+15% por 10 precedentes históricos');
  });

  test('feedback con impacto HIGH suma +10%', () => {
    const feedbackAnalysis = {
      feedbackSummary: { overallLearningImpact: 'HIGH' }
    };

    const result = aiService._calculateFinalClassificationScore(
      { confidence: 75 },
      null,
      feedbackAnalysis,
      null
    );

    expect(result.confidence).toBe(85); // 75 + 10
    expect(result.factors).toContain('+10% por aprendizaje de feedback relevante');
  });

  test('feedback con correcciones resta -5%', () => {
    const feedbackAnalysis = {
      feedbackSummary: { overallLearningImpact: 'MEDIUM', correctionsConsidered: 2 }
    };

    const result = aiService._calculateFinalClassificationScore(
      { confidence: 80 },
      null,
      feedbackAnalysis,
      null
    );

    expect(result.confidence).toBe(75); // 80 - 5
    expect(result.factors).toContain('-5% por correcciones históricas en productos similares');
  });

  test('validación CONFIRMED suma +15%', () => {
    const regulationValidation = {
      validationResult: { overallAssessment: 'CONFIRMED' }
    };

    const result = aiService._calculateFinalClassificationScore(
      { confidence: 80 },
      null,
      null,
      regulationValidation
    );

    expect(result.confidence).toBe(95); // 80 + 15
    expect(result.factors).toContain('+15% por validación normativa confirmada');
  });

  test('validación LIKELY_CORRECT suma +5%', () => {
    const regulationValidation = {
      validationResult: { overallAssessment: 'LIKELY_CORRECT' }
    };

    const result = aiService._calculateFinalClassificationScore(
      { confidence: 80 },
      null,
      null,
      regulationValidation
    );

    expect(result.confidence).toBe(85); // 80 + 5
    expect(result.factors).toContain('+5% por validación normativa probable');
  });

  test('validación NEEDS_REVIEW resta -10%', () => {
    const regulationValidation = {
      validationResult: { overallAssessment: 'NEEDS_REVIEW' }
    };

    const result = aiService._calculateFinalClassificationScore(
      { confidence: 80 },
      null,
      null,
      regulationValidation
    );

    expect(result.confidence).toBe(70); // 80 - 10
    expect(result.factors).toContain('-10% por necesidad de revisión normativa');
  });

  test('validación LIKELY_INCORRECT resta -25%', () => {
    const regulationValidation = {
      validationResult: { overallAssessment: 'LIKELY_INCORRECT' }
    };

    const result = aiService._calculateFinalClassificationScore(
      { confidence: 80 },
      null,
      null,
      regulationValidation
    );

    expect(result.confidence).toBe(55); // 80 - 25
    expect(result.factors).toContain('-25% por probable error según normativa');
  });

  test('3 fuentes coinciden suma +10%', () => {
    const result = aiService._calculateFinalClassificationScore(
      { confidence: 70, sources: ['base', 'history', 'feedback'] },
      null,
      null,
      null
    );

    expect(result.confidence).toBe(80); // 70 + 10
    expect(result.factors).toContain('+10% por confirmación de múltiples fuentes');
  });

  test('2 fuentes coinciden suma +5%', () => {
    const result = aiService._calculateFinalClassificationScore(
      { confidence: 70, sources: ['base', 'history'] },
      null,
      null,
      null
    );

    expect(result.confidence).toBe(75); // 70 + 5
    expect(result.factors).toContain('+5% por confirmación de 2 fuentes');
  });

  test('combinación de todos los factores positivos', () => {
    const result = aiService._calculateFinalClassificationScore(
      { confidence: 70, sources: ['base', 'history', 'feedback'] },
      { historicalAnalysis: { similarProductsFound: 3 } },
      { feedbackSummary: { overallLearningImpact: 'HIGH' } },
      { validationResult: { overallAssessment: 'CONFIRMED' } }
    );

    // 70 + 9 (history) + 10 (feedback) + 15 (validation) + 10 (3 sources) = 114 → 100 (capped)
    expect(result.confidence).toBe(100);
    expect(result.factors).toHaveLength(4);
  });

  test('confianza nunca baja de 0', () => {
    const result = aiService._calculateFinalClassificationScore(
      { confidence: 20 },
      null,
      { feedbackSummary: { correctionsConsidered: 2 } },
      { validationResult: { overallAssessment: 'LIKELY_INCORRECT' } }
    );

    // 20 - 5 (corrections) - 25 (likely incorrect) = -10 → 0
    expect(result.confidence).toBe(0);
  });
});

describe('_generateClassificationNextSteps: próximos pasos (HELPER PURO)', () => {
  test('sin sugerencias, prioridad 1 pedir más información', () => {
    const result = aiService._generateClassificationNextSteps([], null, null, null);

    expect(result).toHaveLength(1);
    expect(result[0].priority).toBe(1);
    expect(result[0].action).toContain('más información');
  });

  test('confianza <70, prioridad 1 revisión manual', () => {
    const result = aiService._generateClassificationNextSteps(
      [{ taricCode: '0901210000', confidence: 65 }],
      null,
      null,
      null
    );

    expect(result[0].priority).toBe(1);
    expect(result[0].action).toContain('Revisar manualmente');
    expect(result[0].reason).toContain('65%');
  });

  test('sin validación normativa, prioridad 2 ejecutarla', () => {
    const result = aiService._generateClassificationNextSteps(
      [{ taricCode: '0901210000', confidence: 80 }],
      null,
      null,
      null
    );

    const validationStep = result.find(s => s.action.includes('validación cruzada'));
    expect(validationStep).toBeDefined();
    expect(validationStep.priority).toBe(2);
  });

  test('validación con NEEDS_REVIEW, prioridad 1 revisar advertencias', () => {
    const regulationValidation = {
      validationResult: { overallAssessment: 'NEEDS_REVIEW' },
      finalRecommendation: { summary: 'Requiere atención manual' }
    };

    const result = aiService._generateClassificationNextSteps(
      [{ taricCode: '0901210000', confidence: 75 }],
      null,
      null,
      regulationValidation
    );

    const reviewStep = result.find(s => s.action.includes('Revisar advertencias'));
    expect(reviewStep).toBeDefined();
    expect(reviewStep.priority).toBe(1);
  });

  test('documentos obligatorios, prioridad 2 prepararlos', () => {
    const regulationValidation = {
      validationResult: { overallAssessment: 'CONFIRMED' },
      documentationRequirements: [
        { document: 'Certificado de origen', mandatory: true },
        { document: 'Factura comercial', mandatory: true },
        { document: 'Packing list', mandatory: false }
      ]
    };

    const result = aiService._generateClassificationNextSteps(
      [{ confidence: 85 }],
      null,
      null,
      regulationValidation
    );

    const docStep = result.find(s => s.action.includes('documento(s) obligatorio(s)'));
    expect(docStep).toBeDefined();
    expect(docStep.action).toContain('2 documento(s)');
    expect(docStep.reason).toContain('Certificado de origen');
  });

  test('antidumping o cuota, prioridad 1 verificar medidas', () => {
    const regulationValidation = {
      validationResult: { overallAssessment: 'CONFIRMED' },
      specialMeasures: {
        antidumping: { applies: true, details: 'Derechos 25%' },
        quota: { applies: false }
      }
    };

    const result = aiService._generateClassificationNextSteps(
      [{ confidence: 85 }],
      null,
      null,
      regulationValidation
    );

    const measureStep = result.find(s => s.action.includes('medidas especiales'));
    expect(measureStep).toBeDefined();
    expect(measureStep.priority).toBe(1);
  });

  test('producto nuevo para cliente, prioridad 3 documentar', () => {
    const historyAnalysis = {
      newProductAlert: { isNew: true }
    };

    const result = aiService._generateClassificationNextSteps(
      [{ confidence: 85 }],
      historyAnalysis,
      null,
      null
    );

    const docStep = result.find(s => s.action.includes('Documentar clasificación'));
    expect(docStep).toBeDefined();
    expect(docStep.priority).toBe(3);
  });

  test('confianza <85 o alternativas >1, prioridad 3 IAV', () => {
    const regulationValidation = {
      validationResult: { overallAssessment: 'LIKELY_CORRECT' },
      alternativeClassifications: [
        { taricCode: '0901220000', probability: 40 },
        { taricCode: '0901110000', probability: 30 }
      ]
    };

    const result = aiService._generateClassificationNextSteps(
      [{ confidence: 82 }],
      null,
      null,
      regulationValidation
    );

    const iavStep = result.find(s => s.action.includes('IAV'));
    expect(iavStep).toBeDefined();
    expect(iavStep.priority).toBe(3);
  });

  test('múltiples pasos se ordenan por prioridad', () => {
    const regulationValidation = {
      validationResult: { overallAssessment: 'NEEDS_REVIEW' },
      documentationRequirements: [{ document: 'Cert', mandatory: true }],
      specialMeasures: { antidumping: { applies: true } }
    };

    const result = aiService._generateClassificationNextSteps(
      [{ confidence: 65 }],
      { newProductAlert: { isNew: true } },
      null,
      regulationValidation
    );

    expect(result.length).toBeGreaterThan(1);
    // verificar que está ordenado por prioridad
    for (let i = 1; i < result.length; i++) {
      expect(result[i].priority).toBeGreaterThanOrEqual(result[i - 1].priority);
    }
  });

  test('solo cuota sin antidumping también alerta', () => {
    const regulationValidation = {
      specialMeasures: {
        antidumping: { applies: false },
        quota: { applies: true, quotaNumber: '09.1234' }
      }
    };

    const result = aiService._generateClassificationNextSteps(
      [{ confidence: 85 }],
      null,
      null,
      regulationValidation
    );

    const measureStep = result.find(s => s.action.includes('medidas especiales'));
    expect(measureStep).toBeDefined();
  });
});

describe('_generateClassificationAlerts: alertas (HELPER PURO)', () => {
  test('sin sugerencias, alerta ERROR', () => {
    const result = aiService._generateClassificationAlerts([], null, null);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('ERROR');
    expect(result[0].message).toContain('No se pudieron generar');
  });

  test('confianza <50, alerta WARNING clasificación manual', () => {
    const result = aiService._generateClassificationAlerts(
      [{ taricCode: '0901210000', confidence: 45 }],
      null,
      null
    );

    const lowConfAlert = result.find(a => a.type === 'WARNING' && a.message.includes('muy baja'));
    expect(lowConfAlert).toBeDefined();
    expect(lowConfAlert.action).toContain('manual');
  });

  test('dos códigos con diferencia <10, alerta INFO evaluar diferencia', () => {
    const result = aiService._generateClassificationAlerts(
      [
        { taricCode: '0901210000', confidence: 85 },
        { taricCode: '0901220000', confidence: 82 }
      ],
      null,
      null
    );

    const closeAlert = result.find(a => a.message.includes('confianza similar'));
    expect(closeAlert).toBeDefined();
    expect(closeAlert.type).toBe('INFO');
    expect(closeAlert.action).toContain('0901210000');
    expect(closeAlert.action).toContain('0901220000');
  });

  test('antidumping aplicable, alerta WARNING', () => {
    const regulationValidation = {
      specialMeasures: {
        antidumping: { applies: true, details: 'Derechos 25% para China' }
      }
    };

    const result = aiService._generateClassificationAlerts(
      [{ confidence: 85 }],
      regulationValidation,
      null
    );

    const antidumpingAlert = result.find(a => a.message.includes('antidumping'));
    expect(antidumpingAlert).toBeDefined();
    expect(antidumpingAlert.type).toBe('WARNING');
    expect(antidumpingAlert.action).toContain('25%');
  });

  test('cuota aplicable, alerta INFO', () => {
    const regulationValidation = {
      specialMeasures: {
        quota: { applies: true, quotaNumber: '09.1234' }
      }
    };

    const result = aiService._generateClassificationAlerts(
      [{ confidence: 85 }],
      regulationValidation,
      null
    );

    const quotaAlert = result.find(a => a.message.includes('cuota'));
    expect(quotaAlert).toBeDefined();
    expect(quotaAlert.type).toBe('INFO');
    expect(quotaAlert.action).toContain('09.1234');
  });

  test('producto atípico para sector, alerta INFO', () => {
    const historyAnalysis = {
      clientProfileFit: { sectorAlignment: 'LOW' }
    };

    const result = aiService._generateClassificationAlerts(
      [{ confidence: 85 }],
      null,
      historyAnalysis
    );

    const atypicalAlert = result.find(a => a.message.includes('atípico'));
    expect(atypicalAlert).toBeDefined();
    expect(atypicalAlert.type).toBe('INFO');
  });

  test('clasificaciones alternativas con probabilidad >30, alerta INFO', () => {
    const regulationValidation = {
      alternativeClassifications: [
        { taricCode: '0901220000', probability: 40 },
        { taricCode: '0901110000', probability: 35 }
      ]
    };

    const result = aiService._generateClassificationAlerts(
      [{ confidence: 85 }],
      regulationValidation,
      null
    );

    const altAlert = result.find(a => a.message.includes('alternativa'));
    expect(altAlert).toBeDefined();
    expect(altAlert.message).toContain('2 clasificación(es)');
  });

  test('confianza 55 no genera alerta de muy baja', () => {
    const result = aiService._generateClassificationAlerts(
      [{ confidence: 55 }],
      null,
      null
    );

    const lowConfAlert = result.find(a => a.message.includes('muy baja'));
    expect(lowConfAlert).toBeUndefined();
  });

  test('diferencia de confianza 15 no genera alerta de similar', () => {
    const result = aiService._generateClassificationAlerts(
      [
        { taricCode: '0901210000', confidence: 85 },
        { taricCode: '0901220000', confidence: 70 }
      ],
      null,
      null
    );

    const closeAlert = result.find(a => a.message.includes('similar'));
    expect(closeAlert).toBeUndefined();
  });

  test('múltiples alertas se acumulan', () => {
    const result = aiService._generateClassificationAlerts(
      [
        { taricCode: '0901210000', confidence: 48 },
        { taricCode: '0901220000', confidence: 45 }
      ],
      {
        specialMeasures: { antidumping: { applies: true, details: 'AD 20%' } },
        alternativeClassifications: [{ probability: 35 }]
      },
      { clientProfileFit: { sectorAlignment: 'LOW' } }
    );

    expect(result.length).toBeGreaterThanOrEqual(4); // low conf + antidumping + atípico + alternativas
  });
});

describe('getTaricCodeInfo: información de código TARIC', () => {
  let callClaudeSpy;

  beforeEach(() => {
    callClaudeSpy = jest.spyOn(aiService, 'callClaude');
  });

  afterEach(() => {
    callClaudeSpy.mockRestore();
  });

  test('código válido devuelve información completa', async () => {
    const jsonResponse = {
      code: '0901210000',
      description: 'Café tostado, sin descafeinar',
      description_es: 'Café tostado, sin descafeinar',
      chapter: '09',
      chapterDescription: 'Café, té, yerba mate y especias',
      heading: '0901',
      headingDescription: 'Café, incluso tostado o descafeinado',
      subheading: '090121',
      subheadingDescription: 'Café tostado, sin descafeinar',
      hierarchy: [
        { level: 'Capítulo', code: '09', description: 'Café, té, yerba mate y especias' },
        { level: 'Partida', code: '0901', description: 'Café, incluso tostado o descafeinado' },
        { level: 'Subpartida', code: '090121', description: 'Café tostado, sin descafeinar' }
      ],
      dutyRate: '7.5%',
      notes: 'Nota de capítulo 09: incluye café procesado',
      measures: [],
      examples: ['Café tostado en grano', 'Café tostado molido'],
      relatedCodes: ['0901220000', '0901110000']
    };

    callClaudeSpy.mockResolvedValue({
      content: `\`\`\`json\n${JSON.stringify(jsonResponse)}\n\`\`\``,
      tokensUsed: 800
    });

    const result = await aiService.getTaricCodeInfo('0901210000');

    expect(result.code).toBe('0901210000');
    expect(result.description).toBe('Café tostado, sin descafeinar');
    expect(result.chapter).toBe('09');
    expect(result.hierarchy).toHaveLength(3);
    expect(result.dutyRate).toBe('7.5%');
    expect(result.examples).toHaveLength(2);
  });

  test('código con medidas especiales', async () => {
    const jsonResponse = {
      code: '8471300000',
      description: 'Máquinas automáticas para tratamiento de datos portátiles',
      chapter: '84',
      chapterDescription: 'Reactores nucleares, calderas, máquinas',
      heading: '8471',
      headingDescription: 'Máquinas automáticas para tratamiento de datos',
      hierarchy: [],
      dutyRate: '0%',
      notes: '',
      measures: ['Antidumping 25% origen China', 'Vigilancia estadística'],
      examples: ['Laptops', 'Notebooks', 'Ultrabooks'],
      relatedCodes: ['8471410000', '8471490000']
    };

    callClaudeSpy.mockResolvedValue({
      content: JSON.stringify(jsonResponse),
      tokensUsed: 600
    });

    const result = await aiService.getTaricCodeInfo('8471300000');

    expect(result.measures).toHaveLength(2);
    expect(result.measures[0]).toContain('Antidumping');
    expect(result.dutyRate).toBe('0%');
  });

  test('código inválido devuelve valid:false', async () => {
    const jsonResponse = {
      code: '9999999999',
      valid: false,
      description: 'Código no válido o no encontrado',
      suggestion: 'Verificar el código ingresado'
    };

    callClaudeSpy.mockResolvedValue({
      content: `\`\`\`\n${JSON.stringify(jsonResponse)}\n\`\`\``,
      tokensUsed: 200
    });

    const result = await aiService.getTaricCodeInfo('9999999999');

    expect(result.valid).toBe(false);
    expect(result.description).toContain('no válido');
  });

  test('JSON inválido activa fallback con texto', async () => {
    callClaudeSpy.mockResolvedValue({
      content: 'El código 0901210000 corresponde a café tostado sin descafeinar...',
      tokensUsed: 100
    });

    const result = await aiService.getTaricCodeInfo('0901210000');

    expect(result.code).toBe('0901210000');
    expect(result.description).toBeDefined();
    expect(result.source).toBe('ai_text');
  });

  test('respuesta sin bloque markdown se parsea igual', async () => {
    const jsonResponse = {
      code: '2204210000',
      description: 'Vino tinto con DOP',
      chapter: '22',
      hierarchy: []
    };

    callClaudeSpy.mockResolvedValue({
      content: JSON.stringify(jsonResponse),
      tokensUsed: 400
    });

    const result = await aiService.getTaricCodeInfo('2204210000');

    expect(result.code).toBe('2204210000');
    expect(result.description).toBe('Vino tinto con DOP');
  });
});

describe('generateTreeLevel: generar nodos del árbol TARIC', () => {
  let callClaudeSpy;

  beforeEach(() => {
    callClaudeSpy = jest.spyOn(aiService, 'callClaude');
  });

  afterEach(() => {
    callClaudeSpy.mockRestore();
  });

  test('headings (4 dígitos) para capítulo 09', async () => {
    const jsonResponse = [
      { code: '0901', description: 'Café, incluso tostado o descafeinado; cáscara y cascarilla de café' },
      { code: '0902', description: 'Té, incluso aromatizado' },
      { code: '0903', description: 'Yerba mate' },
      { code: '0904', description: 'Pimienta del género Piper' }
    ];

    callClaudeSpy.mockResolvedValue({
      content: `\`\`\`json\n${JSON.stringify(jsonResponse)}\n\`\`\``,
      tokensUsed: 600
    });

    const result = await aiService.generateTreeLevel('09', 'headings');

    expect(result).toHaveLength(4);
    expect(result[0].code).toBe('0901');
    expect(result[0].code).toHaveLength(4);
    expect(result.every(r => r.code.startsWith('09'))).toBe(true);
  });

  test('subheadings (6 dígitos) para partida 0807', async () => {
    const jsonResponse = [
      { code: '080711', description: 'Sandías' },
      { code: '080712', description: 'Papayas' }
    ];

    callClaudeSpy.mockResolvedValue({
      content: JSON.stringify(jsonResponse),
      tokensUsed: 400
    });

    const result = await aiService.generateTreeLevel('0807', 'subheadings');

    expect(result).toHaveLength(2);
    expect(result[0].code).toHaveLength(6);
    expect(result[0].code).toBe('080711');
  });

  test('cnCodes (8 dígitos) para subpartida 080711', async () => {
    const jsonResponse = [
      { code: '08071100', description: 'Sandías, frescas' }
    ];

    callClaudeSpy.mockResolvedValue({
      content: `\`\`\`\n${JSON.stringify(jsonResponse)}\n\`\`\``,
      tokensUsed: 300
    });

    const result = await aiService.generateTreeLevel('080711', 'cnCodes');

    expect(result).toHaveLength(1);
    expect(result[0].code).toHaveLength(8);
    expect(result[0].code).toBe('08071100');
  });

  test('taricCodes (10 dígitos) incluyen dutyRate y vatRate', async () => {
    const jsonResponse = [
      { code: '0807110000', description: 'Sandías, frescas', dutyRate: 8.8, vatRate: 10 }
    ];

    callClaudeSpy.mockResolvedValue({
      content: JSON.stringify(jsonResponse),
      tokensUsed: 300
    });

    const result = await aiService.generateTreeLevel('08071100', 'taricCodes');

    expect(result).toHaveLength(1);
    expect(result[0].code).toHaveLength(10);
    expect(result[0].dutyRate).toBe(8.8);
    expect(result[0].vatRate).toBe(10);
  });

  test('filtra códigos que no empiezan con parentCode', async () => {
    const jsonResponse = [
      { code: '0901', description: 'Café' },
      { code: '1001', description: 'Trigo' }, // no empieza con 09
      { code: '0902', description: 'Té' }
    ];

    callClaudeSpy.mockResolvedValue({
      content: `\`\`\`json\n${JSON.stringify(jsonResponse)}\n\`\`\``,
      tokensUsed: 500
    });

    const result = await aiService.generateTreeLevel('09', 'headings');

    expect(result).toHaveLength(2);
    expect(result.find(r => r.code === '1001')).toBeUndefined();
  });

  test('filtra códigos sin description', async () => {
    const jsonResponse = [
      { code: '0901', description: 'Café' },
      { code: '0902' }, // sin description
      { code: '0903', description: 'Yerba mate' }
    ];

    callClaudeSpy.mockResolvedValue({
      content: JSON.stringify(jsonResponse),
      tokensUsed: 400
    });

    const result = await aiService.generateTreeLevel('09', 'headings');

    expect(result).toHaveLength(2);
    expect(result.find(r => r.code === '0902')).toBeUndefined();
  });

  test('filtra códigos con longitud incorrecta', async () => {
    const jsonResponse = [
      { code: '0901', description: 'Café' },
      { code: '09012', description: 'Código de 5 dígitos' }, // debería ser 4
      { code: '0902', description: 'Té' }
    ];

    callClaudeSpy.mockResolvedValue({
      content: `\`\`\`json\n${JSON.stringify(jsonResponse)}\n\`\`\``,
      tokensUsed: 400
    });

    const result = await aiService.generateTreeLevel('09', 'headings');

    expect(result).toHaveLength(2);
    expect(result.find(r => r.code === '09012')).toBeUndefined();
  });

  test('nivel inválido lanza error', async () => {
    await expect(
      aiService.generateTreeLevel('09', 'invalidLevel')
    ).rejects.toThrow('Nivel no valido: invalidLevel');
  });

  test('JSON inválido devuelve array vacío', async () => {
    callClaudeSpy.mockResolvedValue({
      content: '{ invalid json',
      tokensUsed: 100
    });

    const result = await aiService.generateTreeLevel('09', 'headings');

    expect(result).toEqual([]);
  });

  test('respuesta no es array devuelve vacío', async () => {
    callClaudeSpy.mockResolvedValue({
      content: JSON.stringify({ code: '0901', description: 'Café' }),
      tokensUsed: 200
    });

    const result = await aiService.generateTreeLevel('09', 'headings');

    expect(result).toEqual([]);
  });

  test('parentCode con espacios o puntos se normaliza', async () => {
    const jsonResponse = [
      { code: '0901', description: 'Café' },
      { code: '0902', description: 'Té' }
    ];

    callClaudeSpy.mockResolvedValue({
      content: JSON.stringify(jsonResponse),
      tokensUsed: 400
    });

    const result = await aiService.generateTreeLevel('09 ', 'headings');

    expect(result).toHaveLength(2);
  });
});

describe('mockResponse: respuesta simulada (HELPER PURO)', () => {
  test('devuelve contenido mock con prefijo [MODO DEMO]', () => {
    const result = aiService.mockResponse('Clasifica este producto');

    expect(result.content).toContain('[MODO DEMO]');
    expect(result.content).toContain('respuesta simulada');
    expect(result.model).toBe('mock');
    expect(result.tokensUsed).toBe(0);
    expect(result.stopReason).toBe('end_turn');
  });

  test('trunca mensaje largo a 100 caracteres', () => {
    const longMessage = 'a'.repeat(200);
    const result = aiService.mockResponse(longMessage);

    expect(result.content).toContain('a'.repeat(100));
    expect(result.content).not.toContain('a'.repeat(101));
    expect(result.content).toContain('...');
  });

  test('mensaje corto se incluye completo', () => {
    const result = aiService.mockResponse('Hola');

    expect(result.content).toContain('Hola');
  });

  test('incluye instrucción sobre configurar ANTHROPIC_API_KEY', () => {
    const result = aiService.mockResponse('test');

    expect(result.content).toContain('ANTHROPIC_API_KEY');
  });
});
