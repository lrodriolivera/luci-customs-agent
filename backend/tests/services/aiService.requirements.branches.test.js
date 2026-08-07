/**
 * Tests de cobertura de RAMAS para métodos de REQUISITOS y DECLARACIONES de aiService.js
 * Líneas ~1667 a ~3065 (métodos de requerimientos y declaraciones H1/AES)
 *
 * PATRÓN: aiService es singleton, spyOn callClaude para interceptar llamadas a Bedrock
 * sin mockear el código bajo prueba. Esto ejercita la lógica real del método
 * (construcción de prompt, extracción de JSON, parseo, fallback).
 */

const aiService = require('../../src/services/aiService');

// NO llamamos describe externo — cada test es independiente y Jest agregará las estadísticas

describe('aiService.requirements - generateRequirementResponse', () => {
  let callClaudeSpy;

  beforeEach(() => {
    // jest.config tiene restoreMocks:true, reinstalamos el spy en cada test
    callClaudeSpy = jest.spyOn(aiService, 'callClaude');
  });

  test('extrae JSON válido de bloque markdown', async () => {
    const mockResponse = {
      formalResponse: {
        header: { to: 'AEAT', reference: 'REQ-001', date: '2026-08-06', subject: 'Respuesta requerimiento' },
        body: 'Cuerpo de la respuesta formal.',
        closing: 'Atentamente',
        signature: 'Firma'
      },
      documentsToAttach: [{ documentType: 'factura', name: 'Factura comercial', purpose: 'Valor', mandatory: true, available: true }],
      legalArguments: [{ point: 'Clasificación', regulation: 'Art. 70 CAU', argument: 'Argumento técnico', strength: 'STRONG' }],
      keyPoints: ['Punto clave 1'],
      risks: [{ risk: 'Riesgo X', mitigation: 'Mitigación Y', severity: 'LOW' }],
      recommendedActions: ['Acción 1'],
      estimatedOutcome: { favorable: 85, factors: ['Factor A'] },
      summary: 'Resumen ejecutivo'
    };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 100,
      model: 'opus-4',
      stopReason: 'end_turn'
    });

    const requirement = {
      requirementNumber: 'REQ-001',
      requirementType: 'DOCUMENT_REQUEST',
      channel: 'orange',
      issuingAuthority: 'AEAT',
      subject: 'Solicitud factura',
      description: 'Falta factura comercial',
      requestedItems: [{ description: 'Factura', itemType: 'DOCUMENT', mandatory: true, provided: false }]
    };
    const expedition = { expeditionId: 'EXP-001', operationType: 'import', client: { companyName: 'Test', nif: 'B12345678', eori: 'ESB12345678' }, goods: [{ description: 'Café', taricCode: '0901210000', originCountry: 'CO', invoiceValue: 5000 }] };

    const result = await aiService.generateRequirementResponse(requirement, expedition);

    expect(result.formalResponse).toBeDefined();
    expect(result.formalResponse.header.reference).toBe('REQ-001');
    expect(result.documentsToAttach).toHaveLength(1);
    expect(result.legalArguments[0].strength).toBe('STRONG');
    expect(result.model).toBe('opus-4');
    expect(result.tokensUsed).toBe(100);
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(callClaudeSpy).toHaveBeenCalledTimes(1);
  });

  test('extrae JSON de bloque sin "json" en el delimitador', async () => {
    const mockResponse = { formalResponse: { body: 'Respuesta' }, summary: 'Ok' };
    callClaudeSpy.mockResolvedValue({
      content: '```\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 50
    });

    const requirement = { requirementNumber: 'R-001', requirementType: 'INFO', channel: 'green' };
    const expedition = { expeditionId: 'E-001', operationType: 'export' };

    const result = await aiService.generateRequirementResponse(requirement, expedition);

    expect(result.formalResponse.body).toBe('Respuesta');
    expect(result.summary).toBe('Ok');
  });

  test('fallback cuando content es JSON plano (sin markdown)', async () => {
    const mockResponse = { formalResponse: { body: 'Plano' }, summary: 'Plano' };
    callClaudeSpy.mockResolvedValue({
      content: JSON.stringify(mockResponse),
      tokensUsed: 30
    });

    const requirement = { requirementNumber: 'R-002', requirementType: 'OTHER', channel: 'red' };
    const expedition = { expeditionId: 'E-002', operationType: 'import' };

    const result = await aiService.generateRequirementResponse(requirement, expedition);

    expect(result.formalResponse.body).toBe('Plano');
    expect(result.summary).toBe('Plano');
  });

  test('fallback cuando JSON.parse falla (JSON inválido)', async () => {
    callClaudeSpy.mockResolvedValue({
      content: '```json\n{invalid json without closing brace\n```',
      tokensUsed: 20
    });

    const requirement = { requirementNumber: 'R-003', requirementType: 'ERROR', channel: 'orange' };
    const expedition = { expeditionId: 'E-003', operationType: 'import' };

    const result = await aiService.generateRequirementResponse(requirement, expedition);

    // Cae al bloque catch: devuelve estructura de fallback con rawResponse
    expect(result.formalResponse.body).toBe('```json\n{invalid json without closing brace\n```');
    expect(result.documentsToAttach).toEqual([]);
    expect(result.legalArguments).toEqual([]);
    expect(result.summary).toBe('Respuesta generada (formato libre)');
    expect(result.rawResponse).toBe('```json\n{invalid json without closing brace\n```');
  });

  test('cubre rama sin requestedItems (lista vacía)', async () => {
    const mockResponse = { formalResponse: { body: 'Ok' }, summary: 'Sin items' };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 10
    });

    const requirement = { requirementNumber: 'R-004', requirementType: 'INFO', channel: 'green' };
    const expedition = { expeditionId: 'E-004', operationType: 'import', client: {}, goods: [] };

    const result = await aiService.generateRequirementResponse(requirement, expedition);

    expect(result.formalResponse.body).toBe('Ok');
    expect(result.summary).toBe('Sin items');
  });

  test('cubre rama sin expedition.goods (undefined)', async () => {
    const mockResponse = { formalResponse: { body: 'Sin bienes' }, summary: 'Ok' };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 5
    });

    const requirement = { requirementNumber: 'R-005', requirementType: 'DOC', channel: 'orange' };
    const expedition = { expeditionId: 'E-005', operationType: 'export', client: { companyName: 'Test' } };

    const result = await aiService.generateRequirementResponse(requirement, expedition);

    expect(result.formalResponse.body).toBe('Sin bienes');
  });

  test('cubre rama sin client.eori (undefined)', async () => {
    const mockResponse = { formalResponse: { body: 'Sin EORI' }, summary: 'Ok' };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 5
    });

    const requirement = { requirementNumber: 'R-006', requirementType: 'X', channel: 'red' };
    const expedition = { expeditionId: 'E-006', operationType: 'import', client: { companyName: 'X', nif: 'X' } };

    const result = await aiService.generateRequirementResponse(requirement, expedition);

    expect(result.formalResponse.body).toBe('Sin EORI');
  });
});

describe('aiService.requirements - analyzeRequestedDocuments', () => {
  let callClaudeSpy;

  beforeEach(() => {
    callClaudeSpy = jest.spyOn(aiService, 'callClaude');
  });

  test('extrae JSON válido con análisis documental completo', async () => {
    const mockResponse = {
      documentAnalysis: [{ requestedItem: 'Factura', documentType: 'invoice', description: 'Documento comercial', purpose: 'Valoración', issuedBy: 'Exportador', howToObtain: 'Solicitar', typicalTimeframe: '1 día', alternatives: [], alreadyAvailable: true, availableDocument: 'factura.pdf', priority: 'CRITICAL', tips: ['Verificar fecha'] }],
      missingCritical: [],
      availableToUse: ['factura.pdf'],
      clientActions: [{ action: 'Firmar', document: 'contrato', deadline: '5 días' }],
      agentActions: [{ action: 'Revisar', document: 'certificado' }],
      estimatedCompletionTime: '2 días',
      completenessScore: 90,
      summary: 'Documentación casi completa'
    };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 150
    });

    const requirement = { requirementType: 'DOC', channel: 'orange', issuingAuthority: 'AEAT', requestedItems: [{ description: 'Factura', itemType: 'DOC', documentType: 'invoice', mandatory: true, provided: true }] };
    const expedition = { operationType: 'import', transportMode: 'sea', goods: [{ description: 'Vino', taricCode: '2204210000', originCountry: 'FR' }], documents: [{ type: 'invoice', originalName: 'factura.pdf', status: 'approved' }] };

    const result = await aiService.analyzeRequestedDocuments(requirement, expedition);

    expect(result.documentAnalysis).toHaveLength(1);
    expect(result.documentAnalysis[0].alreadyAvailable).toBe(true);
    expect(result.completenessScore).toBe(90);
    expect(result.model).toBe('sonnet-4');
    expect(result.tokensUsed).toBe(150);
    expect(result.analyzedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('extrae JSON plano sin delimitadores markdown', async () => {
    const mockResponse = { documentAnalysis: [], completenessScore: 50, summary: 'Sin análisis' };
    callClaudeSpy.mockResolvedValue({
      content: JSON.stringify(mockResponse),
      tokensUsed: 20
    });

    const requirement = { requirementType: 'INFO', channel: 'green' };
    const expedition = { operationType: 'export' };

    const result = await aiService.analyzeRequestedDocuments(requirement, expedition);

    expect(result.documentAnalysis).toEqual([]);
    expect(result.completenessScore).toBe(50);
  });

  test('fallback cuando JSON es inválido', async () => {
    callClaudeSpy.mockResolvedValue({
      content: '```json\n{broken\n```',
      tokensUsed: 10
    });

    const requirement = { requirementType: 'X', channel: 'red' };
    const expedition = { operationType: 'import' };

    const result = await aiService.analyzeRequestedDocuments(requirement, expedition);

    expect(result.documentAnalysis).toEqual([]);
    expect(result.completenessScore).toBe(50);
    expect(result.summary).toBe('Error procesando análisis documental');
    expect(result.rawResponse).toBe('```json\n{broken\n```');
  });

  test('cubre rama sin expedition.documents (undefined)', async () => {
    const mockResponse = { documentAnalysis: [], summary: 'Sin docs' };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 5
    });

    const requirement = { requirementType: 'D', channel: 'orange' };
    const expedition = { operationType: 'import', goods: [] };

    const result = await aiService.analyzeRequestedDocuments(requirement, expedition);

    expect(result.documentAnalysis).toEqual([]);
  });

  test('cubre rama sin requestedItems (undefined)', async () => {
    const mockResponse = { documentAnalysis: [], summary: 'Ok' };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 5
    });

    const requirement = { requirementType: 'X', channel: 'green' };
    const expedition = { operationType: 'export' };

    const result = await aiService.analyzeRequestedDocuments(requirement, expedition);

    expect(result.documentAnalysis).toEqual([]);
  });
});

describe('aiService.requirements - suggestLegalArguments', () => {
  let callClaudeSpy;

  beforeEach(() => {
    callClaudeSpy = jest.spyOn(aiService, 'callClaude');
  });

  test('extrae argumentación legal completa', async () => {
    const mockResponse = {
      mainArguments: [{ topic: 'CLASSIFICATION', title: 'Defensa TARIC', argument: 'Argumento técnico', legalBasis: [{ regulation: 'CAU', article: '70', quote: 'Texto', application: 'Aplica' }], supportingEvidence: ['Prueba 1'], strength: 'STRONG', counterarguments: ['Contra 1'], rebuttals: ['Rebatir 1'] }],
      proceduralArguments: [{ argument: 'Plazo', legalBasis: 'Art. X', applicability: 'Siempre' }],
      mitigatingFactors: [{ factor: 'Buena fe', relevance: 'Alta', howToPresent: 'Documentación' }],
      precedents: [{ case: 'C-123/20', summary: 'Resumen', applicability: 'Alta' }],
      recommendedStrategy: { approach: 'COLLABORATIVE', reasoning: 'Mejor resultado', keyPoints: ['Punto 1'] },
      warningsAndRisks: [{ warning: 'Riesgo X', risk: 'Descripción', recommendation: 'Acción' }],
      summary: 'Argumentación sólida'
    };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 200
    });

    const requirement = { requirementNumber: 'R-001', requirementType: 'CLASSIFICATION', channel: 'red', subject: 'TARIC', description: 'Discrepancia clasificación', legalBasis: 'Art. 56 CAU' };
    const expedition = { operationType: 'import', declaration: { regime: '40', preference: '100' }, incoterm: { code: 'CIF' }, goods: [{ description: 'Portátil', taricCode: '8471300000', originCountry: 'CN', invoiceValue: 10000 }] };

    const result = await aiService.suggestLegalArguments(requirement, expedition);

    expect(result.mainArguments).toHaveLength(1);
    expect(result.mainArguments[0].strength).toBe('STRONG');
    expect(result.recommendedStrategy.approach).toBe('COLLABORATIVE');
    expect(result.model).toBe('opus-4');
    expect(result.tokensUsed).toBe(200);
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('fallback cuando JSON es inválido', async () => {
    callClaudeSpy.mockResolvedValue({
      content: '```json\n{ invalid json\n```',
      tokensUsed: 10
    });

    const requirement = { requirementNumber: 'R-002', requirementType: 'X', channel: 'orange', subject: 'Y', description: 'Z' };
    const expedition = { operationType: 'export' };

    const result = await aiService.suggestLegalArguments(requirement, expedition);

    expect(result.mainArguments).toEqual([]);
    expect(result.proceduralArguments).toEqual([]);
    expect(result.summary).toBe('Error generando argumentación');
    expect(result.rawResponse).toBe('```json\n{ invalid json\n```');
  });

  test('cubre rama sin legalBasis en requirement', async () => {
    const mockResponse = { mainArguments: [], summary: 'Sin base legal' };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 5
    });

    const requirement = { requirementNumber: 'R-003', requirementType: 'INFO', channel: 'green', subject: 'A', description: 'B' };
    const expedition = { operationType: 'import', goods: [] };

    const result = await aiService.suggestLegalArguments(requirement, expedition);

    expect(result.mainArguments).toEqual([]);
  });

  test('cubre rama sin expedition.goods (undefined)', async () => {
    const mockResponse = { mainArguments: [], summary: 'Sin bienes' };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 5
    });

    const requirement = { requirementNumber: 'R-004', requirementType: 'X', channel: 'red' };
    const expedition = { operationType: 'export', declaration: { regime: '10' } };

    const result = await aiService.suggestLegalArguments(requirement, expedition);

    expect(result.mainArguments).toEqual([]);
  });
});

describe('aiService.requirements - analyzeRequirementRisk', () => {
  let callClaudeSpy;

  beforeEach(() => {
    callClaudeSpy = jest.spyOn(aiService, 'callClaude');
  });

  test('analiza riesgo completo con predicción de resolución', async () => {
    const mockResponse = {
      riskLevel: 'MEDIUM',
      riskScore: 55,
      resolutionPrediction: { favorable: 70, partialFavorable: 20, unfavorable: 10, mostLikely: 'LEVANTE', confidence: 75 },
      timeEstimate: { bestCase: '3 días', typical: '7 días', worstCase: '14 días' },
      riskFactors: [{ factor: 'Falta documento', impact: 'HIGH', mitigation: 'Solicitar al cliente', currentStatus: 'PENDING' }],
      positiveFactors: [{ factor: 'Operador OEA', impact: 'Favorece' }],
      potentialConsequences: { dutyAdjustment: { likely: false }, penalties: { likely: false }, delays: { estimatedDays: 5, impact: 'Bajo' } },
      recommendations: [{ action: 'Completar documentación', priority: 'HIGH', expectedImpact: 'Reduce riesgo', deadline: '2 días' }],
      appealOptions: { available: true, types: ['Recurso reposición'], deadlines: ['1 mes'], recommendations: 'Solo si desfavorable' },
      summary: 'Riesgo moderado'
    };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 180
    });

    const requirement = { requirementNumber: 'R-001', requirementType: 'DOC', channel: 'orange', status: 'pending', daysUntilDeadline: 10, responses: [], requestedItems: [{ description: 'Certificado', mandatory: true, provided: false }], timeline: [{ action: 'recibido', description: 'Requerimiento recibido' }] };
    const expedition = { operationType: 'import', calculations: { invoiceTotal: 25000 }, declaration: { regime: '40' }, status: 'customs', goods: [{ description: 'Camisetas', taricCode: '6109100010', originCountry: 'BD' }] };

    const result = await aiService.analyzeRequirementRisk(requirement, expedition);

    expect(result.riskLevel).toBe('MEDIUM');
    expect(result.riskScore).toBe(55);
    expect(result.resolutionPrediction.mostLikely).toBe('LEVANTE');
    expect(result.model).toBe('sonnet-4');
    expect(result.tokensUsed).toBe(180);
    expect(result.analyzedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('fallback cuando JSON es inválido', async () => {
    callClaudeSpy.mockResolvedValue({
      content: '```json\n{invalid\n```',
      tokensUsed: 10
    });

    const requirement = { requirementNumber: 'R-002', requirementType: 'X', channel: 'red', status: 'active' };
    const expedition = { operationType: 'export' };

    const result = await aiService.analyzeRequirementRisk(requirement, expedition);

    expect(result.riskLevel).toBe('MEDIUM');
    expect(result.riskScore).toBe(50);
    expect(result.resolutionPrediction.mostLikely).toBe('LEVANTE');
    expect(result.summary).toBe('Error analizando riesgo');
    expect(result.rawResponse).toBe('```json\n{invalid\n```');
  });

  test('cubre rama sin requestedItems (undefined)', async () => {
    const mockResponse = { riskLevel: 'LOW', riskScore: 20, resolutionPrediction: { mostLikely: 'LEVANTE' }, summary: 'Bajo riesgo' };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 5
    });

    const requirement = { requirementNumber: 'R-003', requirementType: 'INFO', channel: 'green', status: 'resolved' };
    const expedition = { operationType: 'import', goods: [] };

    const result = await aiService.analyzeRequirementRisk(requirement, expedition);

    expect(result.riskLevel).toBe('LOW');
  });

  test('cubre rama sin timeline (undefined)', async () => {
    const mockResponse = { riskLevel: 'HIGH', riskScore: 80, resolutionPrediction: { mostLikely: 'SANCION' }, summary: 'Alto riesgo' };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 5
    });

    const requirement = { requirementNumber: 'R-004', requirementType: 'SANCION', channel: 'red', status: 'escalated' };
    const expedition = { operationType: 'export' };

    const result = await aiService.analyzeRequirementRisk(requirement, expedition);

    expect(result.riskLevel).toBe('HIGH');
  });
});

describe('aiService.requirements - fullRequirementAnalysis', () => {
  let callClaudeSpy;

  beforeEach(() => {
    callClaudeSpy = jest.spyOn(aiService, 'callClaude');
  });

  test('ejecuta análisis completo en paralelo y agrega resultados', async () => {
    // Mock de 4 llamadas paralelas: generateRequirementResponse, analyzeRequestedDocuments, suggestLegalArguments, analyzeRequirementRisk
    const responseData = { formalResponse: { body: 'Respuesta' }, documentsToAttach: [], legalArguments: [{ strength: 'WEAK' }], keyPoints: [], risks: [], recommendedActions: [], estimatedOutcome: { favorable: 60, factors: [] }, summary: 'R' };
    const documentsData = { documentAnalysis: [], missingCritical: ['Factura'], availableToUse: [], clientActions: [{ action: 'Enviar factura' }], agentActions: [], completenessScore: 40, summary: 'Incompleto' };
    const argumentsData = { mainArguments: [], proceduralArguments: [], mitigatingFactors: [], precedents: [], recommendedStrategy: {}, warningsAndRisks: [], summary: 'Sin argumentos' };
    const riskData = { riskLevel: 'CRITICAL', riskScore: 90, resolutionPrediction: { favorable: 20, mostLikely: 'RECHAZO', confidence: 80 }, riskFactors: [{ factor: 'Alto', impact: 'HIGH' }], positiveFactors: [], potentialConsequences: {}, recommendations: [{ action: 'Urgente', priority: 'IMMEDIATE' }], summary: 'Riesgo crítico' };

    // El método hace 4 llamadas paralelas — configuramos el spy para que devuelva respuestas distintas
    callClaudeSpy
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(responseData) + '\n```', tokensUsed: 100 })
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(documentsData) + '\n```', tokensUsed: 50 })
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(argumentsData) + '\n```', tokensUsed: 80 })
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(riskData) + '\n```', tokensUsed: 70 });

    const requirement = { requirementNumber: 'R-FULL-001', requirementType: 'COMPREHENSIVE', channel: 'red', status: 'active', requestedItems: [{ description: 'Doc X', mandatory: true, provided: false }] };
    const expedition = { expeditionId: 'E-FULL-001', operationType: 'import', client: { companyName: 'TestFull', nif: 'X' }, goods: [{ description: 'Test', taricCode: '0901210000' }] };

    const result = await aiService.fullRequirementAnalysis(requirement, expedition);

    expect(result.requirementNumber).toBe('R-FULL-001');
    expect(result.analyzedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.response.formalResponse.body).toBe('Respuesta');
    expect(result.documents.completenessScore).toBe(40);
    expect(result.arguments.summary).toBe('Sin argumentos');
    expect(result.risk.riskLevel).toBe('CRITICAL');
    expect(result.overallReadiness).toBeDefined();
    expect(result.overallReadiness.readyToRespond).toBe(false); // completenessScore < 70 Y riskLevel === 'CRITICAL'
    expect(result.overallReadiness.estimatedOutcome).toBe('RECHAZO');
    expect(result.overallReadiness.nextSteps).toBeDefined();
    expect(callClaudeSpy).toHaveBeenCalledTimes(4);
  });

  test('cubre rama readyToRespond=true cuando completenessScore ≥70 y riskLevel ≠ CRITICAL', async () => {
    const responseData = { formalResponse: {}, estimatedOutcome: { favorable: 80 }, summary: 'Ok' };
    const documentsData = { completenessScore: 75, summary: 'Ok' };
    const argumentsData = { summary: 'Ok' };
    const riskData = { riskLevel: 'LOW', riskScore: 10, resolutionPrediction: { mostLikely: 'LEVANTE' }, summary: 'Bajo' };

    callClaudeSpy
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(responseData) + '\n```', tokensUsed: 10 })
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(documentsData) + '\n```', tokensUsed: 10 })
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(argumentsData) + '\n```', tokensUsed: 10 })
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(riskData) + '\n```', tokensUsed: 10 });

    const requirement = { requirementNumber: 'R-READY', requirementType: 'X', channel: 'green' };
    const expedition = { expeditionId: 'E-READY', operationType: 'export' };

    const result = await aiService.fullRequirementAnalysis(requirement, expedition);

    expect(result.overallReadiness.readyToRespond).toBe(true);
    expect(result.overallReadiness.score).toBeGreaterThan(50);
  });

  test('cubre rama de error en catch y devuelve objeto con error', async () => {
    // Forzamos un error rechazando la primera llamada
    callClaudeSpy.mockRejectedValueOnce(new Error('Bedrock timeout'));

    const requirement = { requirementNumber: 'R-ERROR', requirementType: 'ERR', channel: 'red' };
    const expedition = { expeditionId: 'E-ERROR', operationType: 'import' };

    const result = await aiService.fullRequirementAnalysis(requirement, expedition);

    expect(result.requirementNumber).toBe('R-ERROR');
    expect(result.error).toBe('Error realizando análisis completo');
    expect(result.analyzedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('verifica _generateRequirementNextSteps con varios tipos de acciones', async () => {
    const responseData = { formalResponse: {}, legalArguments: [{ strength: 'WEAK' }], estimatedOutcome: { favorable: 50 }, summary: 'R' };
    const documentsData = { missingCritical: ['Doc A', 'Doc B'], clientActions: [{ action: 'Acción cliente' }], completenessScore: 30, summary: 'D' };
    const argumentsData = { summary: 'A' };
    const riskData = { riskLevel: 'HIGH', riskScore: 70, riskFactors: [{ factor: 'F1', impact: 'HIGH' }, { factor: 'F2', impact: 'LOW' }], recommendations: [{ action: 'Inmediata', priority: 'IMMEDIATE' }], resolutionPrediction: { mostLikely: 'X' }, summary: 'RK' };

    callClaudeSpy
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(responseData) + '\n```', tokensUsed: 10 })
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(documentsData) + '\n```', tokensUsed: 10 })
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(argumentsData) + '\n```', tokensUsed: 10 })
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(riskData) + '\n```', tokensUsed: 10 });

    const requirement = { requirementNumber: 'R-STEPS', requirementType: 'X', channel: 'orange' };
    const expedition = { expeditionId: 'E-STEPS', operationType: 'import' };

    const result = await aiService.fullRequirementAnalysis(requirement, expedition);

    // Verificamos que nextSteps se generó con los 5 tipos esperados
    expect(result.overallReadiness.nextSteps).toBeDefined();
    // Debe incluir: DOCUMENTS (missingCritical), CLIENT (clientActions), RISK (riskLevel HIGH), LEGAL (WEAK), URGENT (IMMEDIATE)
    expect(result.overallReadiness.nextSteps.length).toBeGreaterThan(0);
    const types = result.overallReadiness.nextSteps.map(s => s.type);
    expect(types).toContain('DOCUMENTS');
    expect(types).toContain('CLIENT');
    expect(types).toContain('RISK');
    expect(types).toContain('LEGAL');
    expect(types).toContain('URGENT');
    // Verificamos que están ordenados por priority
    for (let i = 1; i < result.overallReadiness.nextSteps.length; i++) {
      expect(result.overallReadiness.nextSteps[i].priority).toBeGreaterThanOrEqual(result.overallReadiness.nextSteps[i - 1].priority);
    }
  });
});

describe('aiService.declarations - validateDeclarationBeforeSubmit', () => {
  let callClaudeSpy;

  beforeEach(() => {
    callClaudeSpy = jest.spyOn(aiService, 'callClaude');
  });

  test('valida declaración H1 completa y readyToSubmit', async () => {
    const mockResponse = {
      isValid: true,
      readyToSubmit: true,
      validationScore: 95,
      errors: [],
      warnings: [{ code: 'WARN_001', field: 'x', message: 'Advertencia menor', recommendation: 'Ok' }],
      missingDocuments: [],
      fieldValidations: { eori: { valid: true }, taricCodes: { valid: true }, values: { valid: true }, weights: { valid: true }, regime: { valid: true }, customsOffice: { valid: true } },
      summary: 'Declaración válida'
    };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 150
    });

    const expedition = {
      expeditionId: 'EXP-H1-001',
      declaration: { lrn: 'LRN123', regime: '40', additionalProcedure: '000', preference: '100', customsOffice: 'ES001000', status: 'draft' },
      client: { companyName: 'Import SA', nif: 'B12345678', eori: 'ESB12345678' },
      exporter: { companyName: 'Export Ltd', country: 'CN' },
      goods: [{ description: 'Portátil', taricCode: '8471300000', originCountry: 'CN', invoiceValue: 1200, netWeight: 2.5, grossWeight: 3.0, packages: { quantity: 1, type: 'BOX' } }],
      transportMode: 'sea',
      transport: { documentType: 'BL', documentNumber: 'BL123', entryCustomsOffice: 'ES001000' },
      incoterm: { code: 'CIF', place: 'Shanghai' },
      calculations: { invoiceTotal: 1200 }
    };

    const result = await aiService.validateDeclarationBeforeSubmit(expedition, 'H1');

    expect(result.isValid).toBe(true);
    expect(result.readyToSubmit).toBe(true);
    expect(result.validationScore).toBe(95);
    expect(result.errors).toHaveLength(0);
    expect(result.model).toBe('opus-4');
    expect(result.tokensUsed).toBe(150);
    expect(result.validatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('valida declaración AES (exportación)', async () => {
    const mockResponse = {
      isValid: true,
      readyToSubmit: true,
      validationScore: 90,
      errors: [],
      warnings: [],
      missingDocuments: [],
      fieldValidations: { eori: { valid: true }, taricCodes: { valid: true } },
      summary: 'AES válida'
    };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 100
    });

    const expedition = {
      expeditionId: 'EXP-AES-001',
      declaration: { lrn: 'AES-LRN', regime: '10', status: 'draft' },
      client: { companyName: 'Export SA', nif: 'B87654321', eori: 'ESB87654321' },
      goods: [{ description: 'Vino', taricCode: '2204210000', originCountry: 'ES', invoiceValue: 5000, netWeight: 100, grossWeight: 120 }],
      transportMode: 'road',
      incoterm: { code: 'EXW' }
    };

    const result = await aiService.validateDeclarationBeforeSubmit(expedition, 'AES');

    expect(result.isValid).toBe(true);
    expect(result.validationScore).toBe(90);
  });

  test('detecta errores bloqueantes y readyToSubmit=false', async () => {
    const mockResponse = {
      isValid: false,
      readyToSubmit: false,
      validationScore: 40,
      errors: [
        { code: 'ERR_EORI', field: 'client.eori', message: 'EORI inválido', severity: 'BLOCKING', regulation: 'Art. 1 CAU', fix: 'Corregir formato' },
        { code: 'ERR_TARIC', field: 'goods.0.taricCode', message: 'TARIC incompleto', severity: 'BLOCKING', regulation: 'Art. 56', fix: 'Completar 10 dígitos' }
      ],
      warnings: [],
      missingDocuments: ['factura'],
      fieldValidations: { eori: { valid: false, message: 'Formato incorrecto' }, taricCodes: { valid: false, message: 'Incompleto' } },
      summary: 'Declaración con errores bloqueantes'
    };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 120
    });

    const expedition = {
      expeditionId: 'EXP-ERR',
      declaration: { regime: '40' },
      client: { companyName: 'Test', nif: 'INVALID', eori: 'WRONG' },
      goods: [{ description: 'Test', taricCode: '0901' }]
    };

    const result = await aiService.validateDeclarationBeforeSubmit(expedition, 'H1');

    expect(result.isValid).toBe(false);
    expect(result.readyToSubmit).toBe(false);
    expect(result.validationScore).toBe(40);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].severity).toBe('BLOCKING');
  });

  test('fallback cuando JSON es inválido', async () => {
    callClaudeSpy.mockResolvedValue({
      content: '```json\n{broken\n```',
      tokensUsed: 10
    });

    const expedition = { expeditionId: 'E-FALLBACK', declaration: {} };

    const result = await aiService.validateDeclarationBeforeSubmit(expedition, 'H1');

    expect(result.isValid).toBe(true);
    expect(result.readyToSubmit).toBe(true);
    expect(result.validationScore).toBe(70);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].code).toBe('WARN_AI');
    expect(result.summary).toBe('No se pudo completar la validación automática');
    expect(result.rawResponse).toBe('```json\n{broken\n```');
  });

  test('cubre rama sin goods (undefined)', async () => {
    const mockResponse = { isValid: true, readyToSubmit: true, validationScore: 60, errors: [], warnings: [], missingDocuments: [], fieldValidations: {}, summary: 'Sin bienes' };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 5
    });

    const expedition = { expeditionId: 'E-NO-GOODS', declaration: {}, client: { companyName: 'X' } };

    const result = await aiService.validateDeclarationBeforeSubmit(expedition, 'H1');

    expect(result.isValid).toBe(true);
  });

  test('cubre rama sin declaration.lrn (undefined)', async () => {
    const mockResponse = { isValid: true, readyToSubmit: true, validationScore: 80, errors: [], warnings: [], missingDocuments: [], fieldValidations: {}, summary: 'Ok' };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 5
    });

    const expedition = { expeditionId: 'E-NO-LRN', client: { companyName: 'X' }, goods: [] };

    const result = await aiService.validateDeclarationBeforeSubmit(expedition, 'H1');

    expect(result.isValid).toBe(true);
  });
});

describe('aiService.declarations - detectDeclarationErrors', () => {
  let callClaudeSpy;

  beforeEach(() => {
    callClaudeSpy = jest.spyOn(aiService, 'callClaude');
  });

  test('detecta errores comunes de formato, coherencia y clasificación', async () => {
    const mockResponse = {
      totalErrors: 3,
      blockingErrors: 1,
      errors: [
        { category: 'FORMAT', severity: 'BLOCKING', field: 'client.eori', currentValue: 'X', issue: 'Formato incorrecto', expectedValue: 'ESEORI', aeatErrorCode: '1180', fix: 'Corregir', autoFixable: false },
        { category: 'COHERENCE', severity: 'HIGH', field: 'goods.0.netWeight', currentValue: '150', issue: 'Peso neto > bruto', expectedValue: '<= 100', aeatErrorCode: '2004', fix: 'Revisar', autoFixable: false },
        { category: 'CLASSIFICATION', severity: 'MEDIUM', field: 'goods.0.taricCode', currentValue: '0901', issue: 'TARIC incompleto', expectedValue: '0901210000', aeatErrorCode: '4404', fix: 'Completar', autoFixable: true }
      ],
      riskOfRejection: 75,
      commonMistakesDetected: ['EORI inválido', 'Peso inconsistente'],
      recommendations: ['Corregir EORI', 'Revisar pesos'],
      summary: '3 errores detectados'
    };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 140
    });

    const expedition = {
      expeditionId: 'E-ERR',
      declaration: { regime: '40', preference: '100' },
      client: { companyName: 'Test', nif: 'B12345678', eori: 'X' },
      exporter: { companyName: 'Exp', country: 'CN' },
      goods: [{ description: 'Test', taricCode: '0901', originCountry: 'CN', invoiceValue: 1000, netWeight: 150, grossWeight: 100, packages: { quantity: 1, type: 'BOX' } }],
      transportMode: 'air',
      transport: { documentNumber: 'AWB123', entryCustomsOffice: 'ES001000' }
    };

    const result = await aiService.detectDeclarationErrors(expedition, 'H1');

    expect(result.totalErrors).toBe(3);
    expect(result.blockingErrors).toBe(1);
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0].severity).toBe('BLOCKING');
    expect(result.riskOfRejection).toBe(75);
    expect(result.model).toBe('sonnet-4');
    expect(result.tokensUsed).toBe(140);
    expect(result.analyzedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('fallback cuando JSON es inválido', async () => {
    callClaudeSpy.mockResolvedValue({
      content: '```json\n{invalid\n```',
      tokensUsed: 10
    });

    const expedition = { expeditionId: 'E-FALLBACK', declaration: {}, client: {} };

    const result = await aiService.detectDeclarationErrors(expedition, 'H1');

    expect(result.totalErrors).toBe(0);
    expect(result.blockingErrors).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.riskOfRejection).toBe(20);
    expect(result.summary).toBe('Error procesando detección de errores');
    expect(result.rawResponse).toBe('```json\n{invalid\n```');
  });

  test('cubre rama sin goods (undefined)', async () => {
    const mockResponse = { totalErrors: 0, blockingErrors: 0, errors: [], riskOfRejection: 10, commonMistakesDetected: [], recommendations: [], summary: 'Sin errores' };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 5
    });

    const expedition = { expeditionId: 'E-NO-GOODS', declaration: {}, client: {} };

    const result = await aiService.detectDeclarationErrors(expedition, 'H1');

    expect(result.totalErrors).toBe(0);
  });

  test('cubre rama sin transport (undefined)', async () => {
    const mockResponse = { totalErrors: 0, blockingErrors: 0, errors: [], riskOfRejection: 5, commonMistakesDetected: [], recommendations: [], summary: 'Ok' };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 5
    });

    const expedition = { expeditionId: 'E-NO-TRANSPORT', declaration: {}, client: {}, goods: [] };

    const result = await aiService.detectDeclarationErrors(expedition, 'H1');

    expect(result.totalErrors).toBe(0);
  });
});

describe('aiService.declarations - suggestRegimeAndPreference', () => {
  let callClaudeSpy;

  beforeEach(() => {
    callClaudeSpy = jest.spyOn(aiService, 'callClaude');
  });

  test('sugiere régimen y preferencia óptimos con alternativas', async () => {
    const mockResponse = {
      recommendedRegime: { code: '40', name: 'Despacho libre práctica', confidence: 90, reasoning: 'Régimen estándar', requirements: ['Factura'], benefits: ['Levante rápido'], documents: ['factura'] },
      alternativeRegimes: [{ code: '42', name: 'Libre práctica + intra', confidence: 70, reasoning: 'Cliente intra', requirements: ['Autorización'], applicableIf: 'Cliente intracomunitario' }],
      recommendedPreference: { code: '300', name: 'Acuerdo preferencial', confidence: 85, reasoning: 'Origen UE', potentialSavings: '5%', requiredCertificate: 'EUR1', requirements: ['Certificado EUR.1'] },
      alternativePreferences: [{ code: '100', name: 'Terceros países', confidence: 50 }],
      specialConsiderations: [{ type: 'ANTIDUMPING', description: 'Medida activa', impact: 'Arancel adicional', recommendation: 'Verificar' }],
      estimatedDuties: { withRecommendedPreference: '2%', withoutPreference: '7%', estimatedSavings: '250 EUR' },
      warnings: ['Advertencia X'],
      summary: 'Preferencia aplicable'
    };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 160
    });

    const expedition = {
      expeditionId: 'E-REG',
      operationType: 'import',
      client: { companyName: 'Import', nif: 'B12345678', address: { country: 'ES' }, isIntraEU: false, hasOEA: false },
      exporter: { companyName: 'Export', country: 'FR' },
      goods: [{ description: 'Vino', taricCode: '2204210000', originCountry: 'FR', invoiceValue: 5000, intendedUse: 'reventa' }],
      documents: [{ type: 'invoice', status: 'approved' }],
      incoterm: { code: 'DAP' }
    };

    const result = await aiService.suggestRegimeAndPreference(expedition);

    expect(result.recommendedRegime.code).toBe('40');
    expect(result.recommendedPreference.code).toBe('300');
    expect(result.alternativeRegimes).toHaveLength(1);
    expect(result.estimatedDuties.estimatedSavings).toBe('250 EUR');
    expect(result.model).toBe('opus-4');
    expect(result.tokensUsed).toBe(160);
    expect(result.analyzedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('fallback cuando JSON es inválido', async () => {
    callClaudeSpy.mockResolvedValue({
      content: '```json\n{invalid\n```',
      tokensUsed: 10
    });

    const expedition = { expeditionId: 'E-FALLBACK', operationType: 'import', client: {} };

    const result = await aiService.suggestRegimeAndPreference(expedition);

    expect(result.recommendedRegime.code).toBe('40');
    expect(result.recommendedPreference.code).toBe('100');
    expect(result.warnings).toEqual(['Error en análisis IA']);
    expect(result.summary).toBe('No se pudo completar el análisis de régimen');
    expect(result.rawResponse).toBe('```json\n{invalid\n```');
  });

  test('cubre rama sin goods (undefined)', async () => {
    const mockResponse = { recommendedRegime: { code: '40', confidence: 80 }, recommendedPreference: { code: '100', confidence: 80 }, alternativeRegimes: [], alternativePreferences: [], specialConsiderations: [], warnings: [], summary: 'Sin bienes' };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 5
    });

    const expedition = { expeditionId: 'E-NO-GOODS', operationType: 'export', client: {} };

    const result = await aiService.suggestRegimeAndPreference(expedition);

    expect(result.recommendedRegime.code).toBe('40');
  });

  test('cubre rama sin documents (undefined)', async () => {
    const mockResponse = { recommendedRegime: { code: '40', confidence: 80 }, recommendedPreference: { code: '100', confidence: 80 }, alternativeRegimes: [], alternativePreferences: [], specialConsiderations: [], warnings: [], summary: 'Sin docs' };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 5
    });

    const expedition = { expeditionId: 'E-NO-DOCS', operationType: 'import', client: {}, goods: [] };

    const result = await aiService.suggestRegimeAndPreference(expedition);

    expect(result.recommendedRegime.code).toBe('40');
  });
});

describe('aiService.declarations - predictDeclarationChannel', () => {
  let callClaudeSpy;

  beforeEach(() => {
    callClaudeSpy = jest.spyOn(aiService, 'callClaude');
  });

  test('predice canal verde con alta probabilidad', async () => {
    const mockResponse = {
      prediction: { channel: 'GREEN', probability: { green: 85, orange: 10, red: 5 }, confidence: 90 },
      riskFactors: [],
      positiveFactors: [{ factor: 'Operador OEA', impact: 'Favorece canal verde' }],
      potentialInspections: { documentCheck: { probability: 10, documentsLikelyReviewed: [], estimatedTime: '1 día' }, physicalInspection: { probability: 5, inspectionType: 'SCANNER', estimatedTime: '2 días', estimatedCost: '150 EUR' } },
      recommendations: [{ action: 'Ninguna', impact: 'Ya óptimo', priority: 'LOW' }],
      historicalComparison: { similarDeclarations: 'Similar a anteriores', typicalChannel: 'verde' },
      estimatedProcessingTime: { greenChannel: '< 1 hora', orangeChannel: '1-3 días', redChannel: '3-7 días' },
      summary: 'Alta probabilidad canal verde'
    };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 150
    });

    const expedition = {
      expeditionId: 'E-GREEN',
      client: { companyName: 'OEA Ltd', eori: 'ESB12345678', isFirstImport: false, hasOEA: true },
      exporter: { companyName: 'Exp', country: 'DE' },
      goods: [{ description: 'Portátil', taricCode: '8471300000', originCountry: 'DE', invoiceValue: 1000, netWeight: 2 }],
      calculations: { invoiceTotal: 1000 },
      declaration: { regime: '40', preference: '100', customsOffice: 'ES001000' },
      documents: [{ type: 'invoice' }]
    };

    const result = await aiService.predictDeclarationChannel(expedition, 'H1');

    expect(result.prediction.channel).toBe('GREEN');
    expect(result.prediction.probability.green).toBe(85);
    expect(result.positiveFactors).toHaveLength(1);
    expect(result.model).toBe('opus-4');
    expect(result.tokensUsed).toBe(150);
    expect(result.predictedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('predice canal rojo por mercancía sensible', async () => {
    const mockResponse = {
      prediction: { channel: 'RED', probability: { green: 10, orange: 30, red: 60 }, confidence: 85 },
      riskFactors: [{ factor: 'Textil de China', impact: 'HIGH', affectsChannel: 'RED', mitigation: 'Documentación completa' }],
      positiveFactors: [],
      potentialInspections: { physicalInspection: { probability: 80, inspectionType: 'COMPLETA', estimatedTime: '5 días', estimatedCost: '500 EUR' } },
      recommendations: [{ action: 'Preparar docs adicionales', impact: 'Reduce riesgo', priority: 'HIGH' }],
      estimatedProcessingTime: { greenChannel: '< 1 hora', orangeChannel: '1-3 días', redChannel: '3-7 días' },
      summary: 'Alta probabilidad canal rojo'
    };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 130
    });

    const expedition = {
      expeditionId: 'E-RED',
      client: { companyName: 'Import', eori: 'ESB87654321', isFirstImport: true, hasOEA: false },
      exporter: { companyName: 'China Exp', country: 'CN' },
      goods: [{ description: 'Camisetas', taricCode: '6109100010', originCountry: 'CN', invoiceValue: 500, netWeight: 10 }],
      calculations: { invoiceTotal: 500 },
      declaration: { regime: '40', preference: '100' },
      documents: []
    };

    const result = await aiService.predictDeclarationChannel(expedition, 'H1');

    expect(result.prediction.channel).toBe('RED');
    expect(result.prediction.probability.red).toBe(60);
    expect(result.riskFactors).toHaveLength(1);
  });

  test('fallback cuando JSON es inválido', async () => {
    callClaudeSpy.mockResolvedValue({
      content: '```json\n{invalid\n```',
      tokensUsed: 10
    });

    const expedition = { expeditionId: 'E-FALLBACK', client: {} };

    const result = await aiService.predictDeclarationChannel(expedition, 'H1');

    expect(result.prediction.channel).toBe('GREEN');
    expect(result.prediction.probability.green).toBe(60);
    expect(result.prediction.confidence).toBe(50);
    expect(result.summary).toBe('Error procesando predicción');
    expect(result.rawResponse).toBe('```json\n{invalid\n```');
  });

  test('cubre rama sin goods (undefined)', async () => {
    const mockResponse = { prediction: { channel: 'GREEN', probability: { green: 50, orange: 30, red: 20 }, confidence: 50 }, riskFactors: [], positiveFactors: [], potentialInspections: {}, recommendations: [], summary: 'Sin bienes' };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 5
    });

    const expedition = { expeditionId: 'E-NO-GOODS', client: {} };

    const result = await aiService.predictDeclarationChannel(expedition, 'H1');

    expect(result.prediction.channel).toBe('GREEN');
  });

  test('cubre rama sin documents (undefined)', async () => {
    const mockResponse = { prediction: { channel: 'ORANGE', probability: { green: 30, orange: 50, red: 20 }, confidence: 60 }, riskFactors: [], positiveFactors: [], potentialInspections: {}, recommendations: [], summary: 'Sin docs' };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 5
    });

    const expedition = { expeditionId: 'E-NO-DOCS', client: {}, goods: [] };

    const result = await aiService.predictDeclarationChannel(expedition, 'H1');

    expect(result.prediction.channel).toBe('ORANGE');
  });
});

describe('aiService.declarations - fullDeclarationAnalysis', () => {
  let callClaudeSpy;

  beforeEach(() => {
    callClaudeSpy = jest.spyOn(aiService, 'callClaude');
  });

  test('ejecuta análisis completo de declaración en paralelo y agrega resultados', async () => {
    const validationData = { isValid: true, readyToSubmit: true, validationScore: 90, errors: [], warnings: [], missingDocuments: [], fieldValidations: {}, summary: 'Ok' };
    const errorsData = { totalErrors: 0, blockingErrors: 0, errors: [], riskOfRejection: 10, commonMistakesDetected: [], recommendations: [], summary: 'Sin errores' };
    const regimeData = { recommendedRegime: { code: '40', confidence: 85 }, alternativeRegimes: [], recommendedPreference: { code: '100', confidence: 80 }, alternativePreferences: [], specialConsiderations: [], warnings: [], summary: 'Régimen OK' };
    const channelData = { prediction: { channel: 'GREEN', probability: { green: 80, orange: 15, red: 5 }, confidence: 90 }, riskFactors: [], positiveFactors: [], potentialInspections: {}, recommendations: [], estimatedProcessingTime: { greenChannel: '< 1 hora', orangeChannel: '1-3 días', redChannel: '3-7 días' }, summary: 'Verde' };

    callClaudeSpy
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(validationData) + '\n```', tokensUsed: 50 })
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(errorsData) + '\n```', tokensUsed: 40 })
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(regimeData) + '\n```', tokensUsed: 60 })
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(channelData) + '\n```', tokensUsed: 70 });

    const expedition = { expeditionId: 'E-FULL-DECL', operationType: 'import', declaration: {}, client: { companyName: 'Test' }, goods: [{ description: 'Test', taricCode: '0901210000' }] };

    const result = await aiService.fullDeclarationAnalysis(expedition, 'H1');

    expect(result.expeditionId).toBe('E-FULL-DECL');
    expect(result.declarationType).toBe('H1');
    expect(result.analyzedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.validation.isValid).toBe(true);
    expect(result.errors.totalErrors).toBe(0);
    expect(result.regime.recommendedRegime.code).toBe('40');
    expect(result.channel.prediction.channel).toBe('GREEN');
    expect(result.overallReadiness).toBeDefined();
    expect(result.overallReadiness.readyToSubmit).toBe(true); // validation.readyToSubmit && errors.blockingErrors === 0
    expect(result.overallReadiness.estimatedChannel).toBe('GREEN');
    expect(result.overallReadiness.estimatedProcessingTime).toBe('< 1 hora');
    expect(result.overallReadiness.score).toBeGreaterThan(0);
    expect(result.nextSteps).toBeDefined();
    expect(callClaudeSpy).toHaveBeenCalledTimes(4);
  });

  test('cubre rama readyToSubmit=false cuando hay errores bloqueantes', async () => {
    const validationData = { isValid: false, readyToSubmit: false, validationScore: 40, errors: [], warnings: [], missingDocuments: ['factura'], fieldValidations: {}, summary: 'Errores' };
    const errorsData = { totalErrors: 2, blockingErrors: 1, errors: [{ severity: 'BLOCKING' }], riskOfRejection: 70, commonMistakesDetected: [], recommendations: [], summary: 'Errores' };
    const regimeData = { recommendedRegime: { code: '40', confidence: 70 }, recommendedPreference: { code: '100', confidence: 70 }, alternativeRegimes: [], summary: 'Ok' };
    const channelData = { prediction: { channel: 'RED', probability: { green: 20, orange: 30, red: 50 }, confidence: 80 }, riskFactors: [], recommendations: [], estimatedProcessingTime: {}, summary: 'Rojo' };

    callClaudeSpy
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(validationData) + '\n```', tokensUsed: 10 })
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(errorsData) + '\n```', tokensUsed: 10 })
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(regimeData) + '\n```', tokensUsed: 10 })
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(channelData) + '\n```', tokensUsed: 10 });

    const expedition = { expeditionId: 'E-NOT-READY', operationType: 'import', client: {} };

    const result = await aiService.fullDeclarationAnalysis(expedition, 'H1');

    expect(result.overallReadiness.readyToSubmit).toBe(false);
    expect(result.overallReadiness.estimatedChannel).toBe('RED');
  });

  test('cubre rama de error en catch', async () => {
    callClaudeSpy.mockRejectedValueOnce(new Error('Network error'));

    const expedition = { expeditionId: 'E-ERROR', operationType: 'export', client: {} };

    const result = await aiService.fullDeclarationAnalysis(expedition, 'AES');

    expect(result.expeditionId).toBe('E-ERROR');
    expect(result.declarationType).toBe('AES');
    expect(result.error).toBe('Error realizando análisis completo');
    expect(result.analyzedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('verifica _generateDeclarationNextSteps con varios tipos de acciones', async () => {
    const validationData = { isValid: false, readyToSubmit: false, validationScore: 50, errors: [], warnings: [{ code: 'W1' }, { code: 'W2' }], missingDocuments: ['factura', 'certificado'], fieldValidations: {}, summary: 'Falta docs' };
    const errorsData = { totalErrors: 2, blockingErrors: 1, errors: [{ severity: 'BLOCKING' }, { severity: 'HIGH' }], riskOfRejection: 60, commonMistakesDetected: [], recommendations: [], summary: 'Errores' };
    const regimeData = { recommendedRegime: { code: '40', confidence: 70 }, alternativeRegimes: [{ code: '42', confidence: 85, name: 'Mejor alternativa' }], recommendedPreference: { code: '100', confidence: 70 }, alternativePreferences: [], summary: 'Régimen' };
    const channelData = { prediction: { channel: 'ORANGE', probability: { green: 30, orange: 50, red: 20 }, confidence: 70 }, riskFactors: [], recommendations: [{ action: 'Acción canal', priority: 'HIGH' }], estimatedProcessingTime: {}, summary: 'Naranja' };

    callClaudeSpy
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(validationData) + '\n```', tokensUsed: 10 })
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(errorsData) + '\n```', tokensUsed: 10 })
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(regimeData) + '\n```', tokensUsed: 10 })
      .mockResolvedValueOnce({ content: '```json\n' + JSON.stringify(channelData) + '\n```', tokensUsed: 10 });

    const expedition = { expeditionId: 'E-STEPS', operationType: 'import', client: {} };

    const result = await aiService.fullDeclarationAnalysis(expedition, 'H1');

    expect(result.nextSteps).toBeDefined();
    // Debe incluir: BLOCKING (errors.blockingErrors > 0), DOCUMENTS (missingDocuments.length > 0), OPTIMIZATION (alternativa mejor), CHANNEL (canal != GREEN), WARNING (warnings.length > 0)
    expect(result.nextSteps.length).toBeGreaterThan(0);
    const types = result.nextSteps.map(s => s.type);
    expect(types).toContain('BLOCKING');
    expect(types).toContain('DOCUMENTS');
    expect(types).toContain('OPTIMIZATION');
    expect(types).toContain('CHANNEL');
    expect(types).toContain('WARNING');
    // Verificamos ordenación por priority
    for (let i = 1; i < result.nextSteps.length; i++) {
      expect(result.nextSteps[i].priority).toBeGreaterThanOrEqual(result.nextSteps[i - 1].priority);
    }
  });
});

describe('aiService.declarations - suggestMissingDocuments', () => {
  let callClaudeSpy;

  beforeEach(() => {
    callClaudeSpy = jest.spyOn(aiService, 'callClaude');
  });

  test('sugiere documentos faltantes con prioridad y preferencias', async () => {
    const mockResponse = {
      missingRequired: [
        { documentType: 'invoice', name: 'Factura comercial', reason: 'Obligatoria para valoración', regulation: 'Art. 70 CAU', priority: 'CRITICAL' },
        { documentType: 'packing_list', name: 'Packing list', reason: 'Detalle bultos', regulation: 'N/A', priority: 'HIGH' }
      ],
      recommended: [{ documentType: 'cert_quality', name: 'Certificado calidad', reason: 'Mejora inspección', benefit: 'Reduce riesgo canal rojo' }],
      preferentialOrigin: { applicable: true, originCountry: 'DE', availablePreferences: ['EUR1', 'REX'], recommendedDocument: 'EUR1', potentialSavings: 'Ahorro 5%' },
      specialRequirements: [{ type: 'SANITARY', description: 'Control sanitario', documents: ['cert_sanit'], authority: 'AECOSAN' }],
      completenessScore: 60,
      summary: 'Faltan documentos críticos'
    };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 140
    });

    const expedition = {
      expeditionId: 'E-DOCS',
      operationType: 'import',
      transportMode: 'sea',
      incoterm: { code: 'CIF', place: 'Rotterdam' },
      client: { companyName: 'Import', nif: 'B12345678', eori: 'ESB12345678' },
      exporter: { companyName: 'Export DE', country: 'DE' },
      goods: [{ description: 'Alimentos', taricCode: '2204210000', originCountry: 'DE', invoiceValue: 10000, netWeight: 500 }],
      documentChecklist: [{ documentType: 'invoice', required: true, received: false }],
      documents: []
    };

    const result = await aiService.suggestMissingDocuments(expedition);

    expect(result.missingRequired).toHaveLength(2);
    expect(result.missingRequired[0].priority).toBe('CRITICAL');
    expect(result.recommended).toHaveLength(1);
    expect(result.preferentialOrigin.applicable).toBe(true);
    expect(result.preferentialOrigin.recommendedDocument).toBe('EUR1');
    expect(result.specialRequirements).toHaveLength(1);
    expect(result.completenessScore).toBe(60);
    expect(result.model).toBe('opus-4');
    expect(result.tokensUsed).toBe(140);
  });

  test('marca el análisis como fallido cuando el JSON es inválido, sin fingir completitud', async () => {
    // Antes este test fijaba el fallback peligroso: completenessScore:50 con
    // listas vacias, que la UI pintaba como "no falta nada, expediente medio
    // completo". Un analisis que no se pudo parsear no puede afirmar un grado
    // de completitud. Observado en produccion (EXP-2026-0112) como "200 pero
    // Error procesando analisis de documentos".
    callClaudeSpy.mockResolvedValue({
      content: '```json\n{invalid\n```',
      tokensUsed: 10
    });

    const expedition = { expeditionId: 'E-FALLBACK', operationType: 'export', client: {} };

    const result = await aiService.suggestMissingDocuments(expedition);

    expect(result.analysisFailed).toBe(true);
    expect(result.missingRequired).toEqual([]);
    expect(result.recommended).toEqual([]);
    expect(result.preferentialOrigin.applicable).toBe(false);
    expect(result.completenessScore).toBeNull();
    expect(result.rawResponse).toBe('```json\n{invalid\n```');
  });

  test('cubre rama sin goods (undefined)', async () => {
    const mockResponse = { missingRequired: [], recommended: [], preferentialOrigin: { applicable: false }, specialRequirements: [], completenessScore: 30, summary: 'Sin bienes' };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 5
    });

    const expedition = { expeditionId: 'E-NO-GOODS', operationType: 'import', client: {} };

    const result = await aiService.suggestMissingDocuments(expedition);

    expect(result.missingRequired).toEqual([]);
  });

  test('cubre rama sin documentChecklist (undefined)', async () => {
    const mockResponse = { missingRequired: [], recommended: [], preferentialOrigin: { applicable: false }, specialRequirements: [], completenessScore: 50, summary: 'Sin checklist' };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 5
    });

    const expedition = { expeditionId: 'E-NO-CHECKLIST', operationType: 'export', client: {}, goods: [] };

    const result = await aiService.suggestMissingDocuments(expedition);

    expect(result.missingRequired).toEqual([]);
  });

  test('cubre rama sin documents (undefined)', async () => {
    const mockResponse = { missingRequired: [], recommended: [], preferentialOrigin: { applicable: false }, specialRequirements: [], completenessScore: 50, summary: 'Sin docs subidos' };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      tokensUsed: 5
    });

    const expedition = { expeditionId: 'E-NO-UPLOADED', operationType: 'import', client: {}, goods: [], documentChecklist: [] };

    const result = await aiService.suggestMissingDocuments(expedition);

    expect(result.missingRequired).toEqual([]);
  });
});
