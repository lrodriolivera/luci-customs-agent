/**
 * aiService.callClaude — parseo de la respuesta de Bedrock Converse
 *
 * Cubre el contrato de lectura de `response.output.message.content`, que NO es
 * homogéneo entre modelos:
 *
 *  - Claude Sonnet 5 / Haiku 4.5 → content[0] es { text }
 *  - Claude Opus 5               → content[0] es { reasoningContent }, y el
 *                                  texto real viaja en un bloque POSTERIOR
 *
 * Opus 5 activa extended thinking por defecto en Bedrock, por lo que leer
 * content[0].text a ciegas devuelve undefined. Verificado empíricamente contra
 * us.anthropic.claude-opus-5 (06/Ago/2026).
 *
 * Frontera mockeada: únicamente el cliente Bedrock (red). callClaude se ejecuta
 * de verdad.
 */

const aiService = require('../../src/services/aiService');

/** Respuesta Converse con un único bloque de texto (Sonnet 5 / Haiku). */
const textOnlyResponse = (text) => ({
  output: { message: { role: 'assistant', content: [{ text }] } },
  usage: { inputTokens: 10, outputTokens: 5 },
  stopReason: 'end_turn'
});

/** Respuesta Converse de Opus 5: reasoningContent PRIMERO, texto después. */
const reasoningFirstResponse = (text) => ({
  output: {
    message: {
      role: 'assistant',
      content: [
        { reasoningContent: { reasoningText: { text: '', signature: 'CAISmxMK...' } } },
        { text }
      ]
    }
  },
  usage: { inputTokens: 49, outputTokens: 1039 },
  stopReason: 'end_turn'
});

describe('aiService.callClaude — extracción de texto por tipo de bloque', () => {
  let originalClient;

  beforeEach(() => {
    originalClient = aiService.client;
  });

  afterEach(() => {
    aiService.client = originalClient;
  });

  const stubClient = (response) => {
    aiService.client = { send: jest.fn().mockResolvedValue(response) };
  };

  it('devuelve el texto cuando el primer bloque es de texto (Sonnet 5)', async () => {
    stubClient(textOnlyResponse('7318 15 51 00'));

    const result = await aiService.callClaude('us.anthropic.claude-sonnet-5', 'sys', 'user');

    expect(result.content).toBe('7318 15 51 00');
  });

  it('devuelve el texto aunque reasoningContent ocupe el primer bloque (Opus 5)', async () => {
    stubClient(reasoningFirstResponse('7318 15 51 00'));

    const result = await aiService.callClaude('us.anthropic.claude-opus-5', 'sys', 'user');

    // Con la lectura ingenua content[0].text esto es undefined.
    expect(result.content).toBe('7318 15 51 00');
  });

  it('no expone el bloque de razonamiento como contenido', async () => {
    stubClient(reasoningFirstResponse('texto real'));

    const result = await aiService.callClaude('us.anthropic.claude-opus-5', 'sys', 'user');

    expect(result.content).not.toContain('CAISmxMK');
    expect(typeof result.content).toBe('string');
  });

  it('concatena varios bloques de texto en orden', async () => {
    stubClient({
      output: {
        message: {
          role: 'assistant',
          content: [{ text: 'parte uno ' }, { text: 'parte dos' }]
        }
      },
      usage: { inputTokens: 5, outputTokens: 5 },
      stopReason: 'end_turn'
    });

    const result = await aiService.callClaude('us.anthropic.claude-sonnet-5', 'sys', 'user');

    expect(result.content).toBe('parte uno parte dos');
  });

  it('devuelve cadena vacía si la respuesta solo trae razonamiento', async () => {
    stubClient({
      output: {
        message: {
          role: 'assistant',
          content: [{ reasoningContent: { reasoningText: { text: '', signature: 'x' } } }]
        }
      },
      usage: { inputTokens: 5, outputTokens: 900 },
      stopReason: 'max_tokens'
    });

    const result = await aiService.callClaude('us.anthropic.claude-opus-5', 'sys', 'user');

    // Truncado por maxTokens: sin texto, pero no debe romper aguas abajo.
    expect(result.content).toBe('');
  });

  it('propaga el conteo de tokens y el stopReason', async () => {
    stubClient(reasoningFirstResponse('ok'));

    const result = await aiService.callClaude('us.anthropic.claude-opus-5', 'sys', 'user');

    expect(result.tokensUsed).toBe(49 + 1039);
    expect(result.stopReason).toBe('end_turn');
  });
});
