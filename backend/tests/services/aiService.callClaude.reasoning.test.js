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

describe('aiService.callClaude — presupuesto de tokens por modelo', () => {
  let originalClient;

  beforeEach(() => { originalClient = aiService.client; });
  afterEach(() => { aiService.client = originalClient; });

  const captureCommand = () => {
    const send = jest.fn().mockResolvedValue(textOnlyResponse('ok'));
    aiService.client = { send };
    return send;
  };

  it('reserva presupuesto extra en Opus, que razona antes de responder', async () => {
    const send = captureCommand();

    await aiService.callClaude('us.anthropic.claude-opus-5', 'sys', 'user');

    const { maxTokens } = send.mock.calls[0][0].input.inferenceConfig;
    // Medido: 1039 tokens de razonamiento en una clasificacion TARIC corta.
    expect(maxTokens).toBeGreaterThanOrEqual(8192);
  });

  it('mantiene el presupuesto por defecto en modelos sin razonamiento', async () => {
    const send = captureCommand();

    await aiService.callClaude('us.anthropic.claude-sonnet-5', 'sys', 'user');

    expect(send.mock.calls[0][0].input.inferenceConfig.maxTokens).toBe(4096);
  });

  it('respeta el maxTokens explicito del llamante', async () => {
    const send = captureCommand();

    await aiService.callClaude('us.anthropic.claude-opus-5', 'sys', 'user', { maxTokens: 2000 });

    expect(send.mock.calls[0][0].input.inferenceConfig.maxTokens).toBe(2000);
  });
});

describe('aiService.callClaude — nivel de esfuerzo en Opus', () => {
  let originalClient;

  beforeEach(() => { originalClient = aiService.client; });
  afterEach(() => { aiService.client = originalClient; });

  const captureCommand = () => {
    const send = jest.fn().mockResolvedValue(textOnlyResponse('ok'));
    aiService.client = { send };
    return send;
  };

  const effortOf = (send) =>
    send.mock.calls[0][0].input.additionalModelRequestFields?.output_config?.effort;

  it('pide esfuerzo medio en Opus, que por defecto razona de mas', async () => {
    // Medido: 8.164 tokens de salida en 'high' frente a 6.277 en 'medium',
    // sin perder ninguna casilla obligatoria del DUA.
    const send = captureCommand();

    await aiService.callClaude('global.anthropic.claude-opus-5', 'sys', 'user');

    expect(effortOf(send)).toBe('medium');
  });

  it('no fija esfuerzo en modelos que no razonan por defecto', async () => {
    const send = captureCommand();

    await aiService.callClaude('global.anthropic.claude-sonnet-5', 'sys', 'user');

    expect(effortOf(send)).toBeUndefined();
  });

  it('respeta el esfuerzo que pida el llamante', async () => {
    const send = captureCommand();

    await aiService.callClaude('global.anthropic.claude-opus-5', 'sys', 'user', { effort: 'high' });

    expect(effortOf(send)).toBe('high');
  });
});

describe('aiService.callClaude — reintento con backoff ante errores transitorios', () => {
  let originalClient, originalFallback, envPrev;

  beforeEach(() => {
    originalClient = aiService.client;
    originalFallback = aiService.fallbackClient;
    // Sin fallback para que el error transitorio llegue al bucle de reintentos,
    // no a la cuenta de fallback. Sin espera real (base 0).
    aiService.fallbackClient = null;
    envPrev = { base: process.env.BEDROCK_RETRY_BASE_MS, max: process.env.BEDROCK_MAX_RETRIES };
    process.env.BEDROCK_RETRY_BASE_MS = '0';
    process.env.BEDROCK_RETRY_MAX_MS = '0';
  });

  afterEach(() => {
    aiService.client = originalClient;
    aiService.fallbackClient = originalFallback;
    if (envPrev.base === undefined) delete process.env.BEDROCK_RETRY_BASE_MS; else process.env.BEDROCK_RETRY_BASE_MS = envPrev.base;
    if (envPrev.max === undefined) delete process.env.BEDROCK_MAX_RETRIES; else process.env.BEDROCK_MAX_RETRIES = envPrev.max;
  });

  const throttling = () => Object.assign(new Error('Too many requests'), { name: 'ThrottlingException' });
  const ok = () => ({
    output: { message: { role: 'assistant', content: [{ text: 'ok' }] } },
    usage: { inputTokens: 1, outputTokens: 1 }, stopReason: 'end_turn'
  });

  it('reintenta un error transitorio y devuelve el exito del segundo intento', async () => {
    const send = jest.fn()
      .mockRejectedValueOnce(throttling())
      .mockResolvedValueOnce(ok());
    aiService.client = { send };

    const result = await aiService.callClaude('us.anthropic.claude-sonnet-5', 'sys', 'user');

    expect(result.content).toBe('ok');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('reintenta un 503 aunque el error no tenga name reconocible', async () => {
    const err503 = Object.assign(new Error('Service Unavailable'), { $metadata: { httpStatusCode: 503 } });
    const send = jest.fn()
      .mockRejectedValueOnce(err503)
      .mockRejectedValueOnce(err503)
      .mockResolvedValueOnce(ok());
    aiService.client = { send };
    process.env.BEDROCK_MAX_RETRIES = '3';

    const result = await aiService.callClaude('us.anthropic.claude-sonnet-5', 'sys', 'user');

    expect(result.content).toBe('ok');
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('NO reintenta un error no transitorio (validacion) y lanza de inmediato', async () => {
    const validation = Object.assign(new Error('bad input'), { name: 'ValidationException', $metadata: { httpStatusCode: 400 } });
    const send = jest.fn().mockRejectedValue(validation);
    aiService.client = { send };

    await expect(aiService.callClaude('us.anthropic.claude-sonnet-5', 'sys', 'user'))
      .rejects.toThrow('Error en servicio de IA');
    // Un solo intento: no se reintenta un 400.
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('agota los reintentos y lanza si el error transitorio persiste', async () => {
    const send = jest.fn().mockRejectedValue(throttling());
    aiService.client = { send };
    process.env.BEDROCK_MAX_RETRIES = '3';

    await expect(aiService.callClaude('us.anthropic.claude-sonnet-5', 'sys', 'user'))
      .rejects.toThrow('Error en servicio de IA');
    // 3 intentos en total (el original + 2 reintentos).
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('respeta BEDROCK_MAX_RETRIES=1 (sin reintentos)', async () => {
    const send = jest.fn().mockRejectedValue(throttling());
    aiService.client = { send };
    process.env.BEDROCK_MAX_RETRIES = '1';

    await expect(aiService.callClaude('us.anthropic.claude-sonnet-5', 'sys', 'user'))
      .rejects.toThrow('Error en servicio de IA');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('el reintento coexiste con el fallback: la cuenta prestada responde en el mismo intento', async () => {
    // Fallo a nivel de cuenta en la principal → se prueba la de fallback dentro
    // del MISMO intento, sin gastar reintentos. Se preserva el comportamiento
    // previo al reintento.
    const principalSend = jest.fn().mockRejectedValue(throttling());
    const fallbackSend = jest.fn().mockResolvedValue(ok());
    aiService.client = { send: principalSend };
    aiService.fallbackClient = { send: fallbackSend };

    const result = await aiService.callClaude('us.anthropic.claude-sonnet-5', 'sys', 'user');

    expect(result.content).toBe('ok');
    expect(principalSend).toHaveBeenCalledTimes(1);
    expect(fallbackSend).toHaveBeenCalledTimes(1);
  });
});
