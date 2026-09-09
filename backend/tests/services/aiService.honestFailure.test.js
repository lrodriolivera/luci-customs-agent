/**
 * aiService — catches que antes fabricaban un veredicto favorable cuando la
 * respuesta de la IA no se podia interpretar (JSON invalido). El patron era
 * siempre el mismo: isValid/approved/channel positivo con una confianza media
 * ("50", "70", "80") en vez de fallar honestamente. Corregido en los 4
 * metodos de este archivo: validateENSBeforeSubmit, predictENSRejection,
 * predictInspectionOutcome (PUE), recommendGuaranteeType.
 *
 * Frontera mockeada: unicamente el cliente Bedrock (via jest.spyOn de
 * callClaude, que ya es el patron establecido en este archivo de tests).
 */

const aiService = require('../../src/services/aiService');

describe('aiService.validateENSBeforeSubmit — fallback honesto', () => {
  let callClaudeSpy;
  beforeEach(() => { callClaudeSpy = jest.spyOn(aiService, 'callClaude'); });
  afterEach(() => { callClaudeSpy.mockRestore(); });

  test('JSON invalido no puede dar isValid:true/readyToSubmit:true', async () => {
    callClaudeSpy.mockResolvedValue({ content: '```json\n{roto\n```', tokensUsed: 10 });

    const result = await aiService.validateENSBeforeSubmit({ reference: 'ENS-1' });

    expect(result.isValid).toBe(false);
    expect(result.readyToSubmit).toBe(false);
    expect(result.overallScore).toBe(0);
    expect(result.analysisFailed).toBe(true);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].severity).toBe('ERROR');
  });
});

describe('aiService.predictENSRejection — fallback honesto', () => {
  let callClaudeSpy;
  beforeEach(() => { callClaudeSpy = jest.spyOn(aiService, 'callClaude'); });
  afterEach(() => { callClaudeSpy.mockRestore(); });

  test('JSON invalido no puede dar rejectionProbability:15 / riskLevel:LOW', async () => {
    callClaudeSpy.mockResolvedValue({ content: '```json\n{roto\n```', tokensUsed: 10 });

    const result = await aiService.predictENSRejection({ reference: 'ENS-1' });

    expect(result.rejectionProbability).toBeNull();
    expect(result.documentalInspectionProbability).toBeNull();
    expect(result.physicalInspectionProbability).toBeNull();
    expect(result.riskLevel).toBe('UNKNOWN');
    expect(result.confidence).toBe(0);
    expect(result.analysisFailed).toBe(true);
  });
});

describe('aiService.predictInspectionOutcome (PUE) — fallback honesto', () => {
  let callClaudeSpy;
  beforeEach(() => { callClaudeSpy = jest.spyOn(aiService, 'callClaude'); });
  afterEach(() => { callClaudeSpy.mockRestore(); });

  test('JSON invalido no puede dar mostLikelyOutcome:APPROVED con 60% de aprobacion', async () => {
    callClaudeSpy.mockResolvedValue({ content: '```json\n{roto\n```', tokensUsed: 10 });

    const result = await aiService.predictInspectionOutcome({ pueType: 'ROHS', reference: 'PUE-1' });

    expect(result.mostLikelyOutcome).toBe('UNKNOWN');
    expect(result.predictions.approved).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.estimatedResolutionDays).toBeNull();
    expect(result.analysisFailed).toBe(true);
  });
});

describe('aiService.recommendGuaranteeType — fallback honesto', () => {
  let callClaudeSpy;
  beforeEach(() => { callClaudeSpy = jest.spyOn(aiService, 'callClaude'); });
  afterEach(() => { callClaudeSpy.mockRestore(); });

  test('JSON invalido no puede recomendar garantia individual con 70% de confianza', async () => {
    callClaudeSpy.mockResolvedValue({ content: '```json\n{roto\n```', tokensUsed: 10 });

    const result = await aiService.recommendGuaranteeType({ companyName: 'X' }, {});

    expect(result.recommendedType).toBeNull();
    expect(result.analysisFailed).toBe(true);
    expect(result.summary).toBe('Error generando recomendación');
  });
});
