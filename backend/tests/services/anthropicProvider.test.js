jest.mock('../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const { crearClienteAnthropic, enviarConAnthropic, parametrosDesdeConverse, modeloAnthropicPara, FormatoNoSoportado } = require('../../src/services/anthropicProvider');
const ANTHROPIC = require('../../src/config/anthropicModels');

const PDF = Buffer.from('%PDF-1.4 prueba');
const entrada = (extra = {}) => ({
  modelId: 'global.anthropic.claude-opus-5',
  system: [{ text: 'Eres LUCI.' }],
  messages: [{ role: 'user', content: [{ text: 'Clasifica: sábanas de algodón' }] }],
  additionalModelRequestFields: { output_config: { effort: 'medium' } },
  inferenceConfig: { maxTokens: 8192 },
  ...extra
});

/** Cliente falso con la forma del SDK: messages.stream(params).finalMessage(). */
const clienteFalso = (mensaje) => {
  const stream = jest.fn(() => ({ finalMessage: async () => mensaje }));
  return { messages: { stream }, stream };
};

describe('crearClienteAnthropic', () => {
  test('sin clave no hay cliente (se usa Bedrock)', () => {
    expect(crearClienteAnthropic({})).toBeNull();
    expect(crearClienteAnthropic({ ANTHROPIC_API_KEY: '  ' })).toBeNull();
  });
  test('con clave crea el cliente del SDK', () => {
    expect(typeof crearClienteAnthropic({ ANTHROPIC_API_KEY: 'sk-ant-prueba' }).messages.stream).toBe('function');
  });
});

describe('modeloAnthropicPara', () => {
  test.each([
    ['global.anthropic.claude-opus-5', ANTHROPIC.OPUS],
    ['global.anthropic.claude-sonnet-5', ANTHROPIC.SONNET],
    ['us.anthropic.claude-haiku-5', ANTHROPIC.HAIKU]
  ])('%s -> %s', (bedrock, api) => expect(modeloAnthropicPara(bedrock)).toBe(api));
});

describe('parametrosDesdeConverse', () => {
  test('system, effort, max_tokens y texto', () => {
    expect(parametrosDesdeConverse(entrada())).toEqual({
      model: ANTHROPIC.OPUS, max_tokens: 16000, system: 'Eres LUCI.', output_config: { effort: 'medium' },
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Clasifica: sábanas de algodón' }] }]
    });
  });

  test('imagen y PDF van en base64; un txt como documento de texto', () => {
    const p = parametrosDesdeConverse(entrada({ messages: [{ role: 'user', content: [
      { image: { format: 'jpeg', source: { bytes: Buffer.from('jpg') } } },
      { document: { format: 'pdf', name: 'factura', source: { bytes: PDF } } },
      { document: { format: 'txt', name: 'notas', source: { bytes: Buffer.from('hola') } } },
      { text: 'Lee la factura' }
    ] }] }));
    expect(p.messages[0].content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: Buffer.from('jpg').toString('base64') } },
      { type: 'document', title: 'factura', source: { type: 'base64', media_type: 'application/pdf', data: PDF.toString('base64') } },
      { type: 'document', title: 'notas', source: { type: 'text', media_type: 'text/plain', data: 'hola' } },
      { type: 'text', text: 'Lee la factura' }
    ]);
  });

  test('Word o Excel no los admite la API: se avisa para usar Bedrock', () => {
    expect(() => parametrosDesdeConverse(entrada({ messages: [{ role: 'user', content: [{ document: { format: 'docx', name: 'x', source: { bytes: PDF } } }] }] })))
      .toThrow(FormatoNoSoportado);
  });

  test('un max_tokens mayor que el mínimo se respeta', () => {
    expect(parametrosDesdeConverse(entrada({ inferenceConfig: { maxTokens: 32000 } })).max_tokens).toBe(32000);
  });

  test('sin effort ni system no los envía', () => {
    const p = parametrosDesdeConverse({ modelId: 'global.anthropic.claude-sonnet-5', messages: [], inferenceConfig: {} });
    expect(p).toEqual({ model: ANTHROPIC.SONNET, max_tokens: 16000, messages: [] });
  });
});

describe('enviarConAnthropic', () => {
  test('usa streaming y devuelve la respuesta con la forma de Bedrock', async () => {
    const c = clienteFalso({ model: 'claude-opus-5-5', stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 },
      content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"codigo":' }, { type: 'text', text: '"6302100000"}' }] });

    const r = await enviarConAnthropic(c, entrada());

    expect(c.stream).toHaveBeenCalledWith(expect.objectContaining({ model: ANTHROPIC.OPUS, max_tokens: 16000 }));
    expect(r).toEqual({ content: '{"codigo":"6302100000"}', model: 'claude-opus-5-5', tokensUsed: 150, stopReason: 'end_turn' });
  });

  test('un rechazo se trata como fallo (para pasar a Bedrock), nunca como respuesta vacía', async () => {
    const c = clienteFalso({ stop_reason: 'refusal', stop_details: { category: 'cyber' }, content: [], usage: {} });
    await expect(enviarConAnthropic(c, entrada())).rejects.toThrow('rechazó la petición (cyber)');
  });
});
