/**
 * aiService.callClaude — fallback a una segunda cuenta de Bedrock
 *
 * La cuenta principal puede quedarse sin servicio por motivos que no dependen
 * del codigo: cuota agotada (ThrottlingException), suspension por impago
 * (AccessDeniedException) o caida de region. Para eso existe una cuenta
 * secundaria opcional.
 *
 * Reglas que se fijan aqui:
 *  - Solo se reintenta ante fallos de INFRAESTRUCTURA de la cuenta. Un error de
 *    validacion (modelo mal escrito, prompt invalido) fallaria igual en la
 *    segunda cuenta: reintentarlo solo dobla la latencia.
 *  - Sin cuenta secundaria configurada el comportamiento no cambia.
 *
 * Frontera mockeada: unicamente los clientes Bedrock (red).
 */

const aiService = require('../../src/services/aiService');

const okResponse = (text) => ({
  output: { message: { role: 'assistant', content: [{ text }] } },
  usage: { inputTokens: 10, outputTokens: 5 },
  stopReason: 'end_turn'
});

/** Reproduce la forma de los errores del SDK de AWS (llevan .name). */
const awsError = (name, message) => Object.assign(new Error(message || name), { name });

describe('aiService.callClaude — fallback entre cuentas', () => {
  let original;
  let envPrev;

  beforeEach(() => {
    original = { client: aiService.client, fallbackClient: aiService.fallbackClient };
    // Los errores transitorios (ThrottlingException) ahora disparan el reintento
    // con backoff. Sin esto, los tests que agotan ambas cuentas esperarian varios
    // segundos reales por reintento y colgarian la bateria. Espera 0.
    envPrev = { base: process.env.BEDROCK_RETRY_BASE_MS, max: process.env.BEDROCK_RETRY_MAX_MS };
    process.env.BEDROCK_RETRY_BASE_MS = '0';
    process.env.BEDROCK_RETRY_MAX_MS = '0';
  });

  afterEach(() => {
    aiService.client = original.client;
    aiService.fallbackClient = original.fallbackClient;
    if (envPrev.base === undefined) delete process.env.BEDROCK_RETRY_BASE_MS; else process.env.BEDROCK_RETRY_BASE_MS = envPrev.base;
    if (envPrev.max === undefined) delete process.env.BEDROCK_RETRY_MAX_MS; else process.env.BEDROCK_RETRY_MAX_MS = envPrev.max;
  });

  it('no toca la cuenta secundaria si la principal responde', async () => {
    const fallbackSend = jest.fn();
    aiService.client = { send: jest.fn().mockResolvedValue(okResponse('desde la principal')) };
    aiService.fallbackClient = { send: fallbackSend };

    const result = await aiService.callClaude('us.anthropic.claude-opus-5', 'sys', 'user');

    expect(result.content).toBe('desde la principal');
    expect(fallbackSend).not.toHaveBeenCalled();
  });

  it('reintenta en la secundaria cuando la principal esta limitada por cuota', async () => {
    aiService.client = { send: jest.fn().mockRejectedValue(awsError('ThrottlingException')) };
    aiService.fallbackClient = { send: jest.fn().mockResolvedValue(okResponse('desde la secundaria')) };

    const result = await aiService.callClaude('us.anthropic.claude-opus-5', 'sys', 'user');

    expect(result.content).toBe('desde la secundaria');
  });

  it('reintenta en la secundaria cuando la principal pierde el acceso', async () => {
    // Caso real: la cuenta se suspende por impago a mitad de jornada.
    aiService.client = { send: jest.fn().mockRejectedValue(awsError('AccessDeniedException')) };
    aiService.fallbackClient = { send: jest.fn().mockResolvedValue(okResponse('rescatado')) };

    const result = await aiService.callClaude('us.anthropic.claude-sonnet-5', 'sys', 'user');

    expect(result.content).toBe('rescatado');
  });

  it('NO reintenta ante un error de validacion: fallaria igual en la otra cuenta', async () => {
    const fallbackSend = jest.fn();
    aiService.client = { send: jest.fn().mockRejectedValue(awsError('ValidationException')) };
    aiService.fallbackClient = { send: fallbackSend };

    await expect(
      aiService.callClaude('modelo-inexistente', 'sys', 'user')
    ).rejects.toThrow();

    expect(fallbackSend).not.toHaveBeenCalled();
  });

  it('propaga el fallo si tambien cae la secundaria', async () => {
    aiService.client = { send: jest.fn().mockRejectedValue(awsError('ThrottlingException')) };
    aiService.fallbackClient = { send: jest.fn().mockRejectedValue(awsError('ThrottlingException')) };

    await expect(
      aiService.callClaude('us.anthropic.claude-opus-5', 'sys', 'user')
    ).rejects.toThrow();
  });

  it('sin cuenta secundaria configurada, el error de la principal se propaga', async () => {
    aiService.client = { send: jest.fn().mockRejectedValue(awsError('ThrottlingException')) };
    aiService.fallbackClient = null;

    await expect(
      aiService.callClaude('us.anthropic.claude-opus-5', 'sys', 'user')
    ).rejects.toThrow();
  });

  it('envia a la secundaria exactamente el mismo comando', async () => {
    const fallbackSend = jest.fn().mockResolvedValue(okResponse('ok'));
    aiService.client = { send: jest.fn().mockRejectedValue(awsError('ThrottlingException')) };
    aiService.fallbackClient = { send: fallbackSend };

    await aiService.callClaude('us.anthropic.claude-opus-5', 'prompt sistema', 'mensaje');

    const enviado = fallbackSend.mock.calls[0][0].input;
    expect(enviado.modelId).toBe('us.anthropic.claude-opus-5');
    expect(enviado.system[0].text).toBe('prompt sistema');
    expect(enviado.messages[0].content[0].text).toBe('mensaje');
  });
});
