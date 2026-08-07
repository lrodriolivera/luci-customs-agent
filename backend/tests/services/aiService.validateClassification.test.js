/**
 * aiService.validateClassification: parseo de la respuesta del modelo.
 *
 * Bug observado en prod (7/Ago/2026) en la pestaña Avanzado/Básico de
 * Clasificación: el bloque "Codigo Validado" mostraba el JSON crudo con la
 * valla markdown (```json {"isValid":true,...}```) dentro de `reasoning`.
 *
 * Causa: validateClassification hacia JSON.parse(result.content) directo, sin
 * quitar la valla; el modelo casi siempre responde con ```json ... ```, asi
 * que JSON.parse reventaba y el catch devolvia reasoning = result.content (el
 * markdown entero). Se cambia a _parseJsonRespuesta, que quita la valla y
 * rescata truncados.
 */

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

const aiService = require('../../src/services/aiService');

describe('aiService.validateClassification', () => {
  let callClaudeSpy;

  beforeEach(() => {
    callClaudeSpy = jest.spyOn(aiService, 'callClaude');
  });

  afterEach(() => {
    callClaudeSpy.mockRestore();
  });

  test('parsea la respuesta aunque venga envuelta en una valla ```json', async () => {
    const respuesta = { isValid: true, confidence: 88, reasoning: 'La partida 9503 cubre juguetes', warnings: [] };
    callClaudeSpy.mockResolvedValue({
      content: '```json\n' + JSON.stringify(respuesta) + '\n```',
      tokensUsed: 300
    });

    const result = await aiService.validateClassification({
      taricCode: '9503002100', description: 'Juguete de plastico', origin: 'CN', value: 100
    });

    expect(result.isValid).toBe(true);
    expect(result.confidence).toBe(88);
    // Lo importante: reasoning es el texto limpio, NO el bloque markdown crudo.
    expect(result.reasoning).toBe('La partida 9503 cubre juguetes');
    expect(result.reasoning).not.toMatch(/```/);
    expect(result.reasoning).not.toMatch(/isValid/);
  });

  test('rescata una respuesta truncada sin fingir validez con el catch', async () => {
    // Truncada: sin ``` de cierre y JSON incompleto pero con el primer campo.
    callClaudeSpy.mockResolvedValue({
      content: '```json\n{\n  "isValid": false,\n  "confidence": 40,\n  "reasoning": "El codigo no corresponde',
      tokensUsed: 300,
      stopReason: 'max_tokens'
    });

    const result = await aiService.validateClassification({
      taricCode: '0000000000', description: 'x', origin: 'CN', value: 1
    });

    // _parseJsonRespuesta cierra el JSON y rescata el isValid real (false).
    expect(result.isValid).toBe(false);
    expect(result.reasoning).not.toMatch(/```/);
  });
});
