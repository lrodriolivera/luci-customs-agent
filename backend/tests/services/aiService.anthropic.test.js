/**
 * aiService con la API de Anthropic como proveedor principal y Bedrock de
 * respaldo (16/11/2026).
 */
jest.mock('../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
const mockEnviar = jest.fn();
jest.mock('../../src/services/anthropicProvider', () => ({
  crearClienteAnthropic: () => null,
  enviarConAnthropic: (...a) => mockEnviar(...a)
}));

const ai = require('../../src/services/aiService');

describe('aiService: Anthropic principal, Bedrock de respaldo', () => {
  const bedrock = { send: jest.fn() };
  const respuestaBedrock = { output: { message: { content: [{ text: 'desde Bedrock' }] } }, usage: { inputTokens: 1, outputTokens: 1 }, stopReason: 'end_turn' };
  let originales;

  beforeEach(() => {
    jest.clearAllMocks();
    originales = { client: ai.client, fallbackClient: ai.fallbackClient, anthropic: ai.anthropic };
    ai.client = bedrock;
    ai.fallbackClient = null;
    ai.anthropic = { tipo: 'anthropic' };
  });
  afterEach(() => Object.assign(ai, originales));

  test('con la API de Anthropic disponible responde ella y no se llama a Bedrock', async () => {
    mockEnviar.mockResolvedValue({ content: 'desde Anthropic', model: 'claude-opus-5-5', tokensUsed: 10, stopReason: 'end_turn' });
    const r = await ai.callClaude('global.anthropic.claude-opus-5', 'sistema', 'hola');
    expect(r.content).toBe('desde Anthropic');
    expect(mockEnviar.mock.calls[0][1]).toMatchObject({ modelId: 'global.anthropic.claude-opus-5' });
    expect(bedrock.send).not.toHaveBeenCalled();
  });

  test('si la API de Anthropic falla, la misma petición va a Bedrock', async () => {
    mockEnviar.mockRejectedValue(Object.assign(new Error('overloaded'), { name: 'InternalServerError' }));
    bedrock.send.mockResolvedValue(respuestaBedrock);
    const r = await ai.callClaude('global.anthropic.claude-sonnet-5', 'sistema', 'hola');
    expect(r.content).toBe('desde Bedrock');
    expect(bedrock.send).toHaveBeenCalledTimes(1);
  });

  test('sin Bedrock de respaldo, un fallo de la API se informa como error de IA', async () => {
    ai.client = null;
    mockEnviar.mockRejectedValue(new Error('timeout'));
    await expect(ai.callClaude('global.anthropic.claude-sonnet-5', 'sistema', 'hola')).rejects.toThrow('Error en servicio de IA');
  });

  test('solo con la API de Anthropic (sin Bedrock) no cae en el modo simulado', async () => {
    ai.client = null;
    mockEnviar.mockResolvedValue({ content: 'real', model: 'claude-sonnet-5-5', tokensUsed: 1, stopReason: 'end_turn' });
    const r = await ai.callClaude('global.anthropic.claude-sonnet-5', 'sistema', 'hola');
    expect(r.content).toBe('real');
  });
});
