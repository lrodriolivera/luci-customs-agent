/**
 * El asistente LUCI tambien responde sobre el uso de la plataforma.
 *
 * UAT 12/Nov/2026: la agente pregunto al chat flotante "como podemos pasar un
 * link al cliente para que nos anexe la factura comercial" y LUCI contesto que
 * su especializacion era el ambito tecnico-normativo y que revisara el manual o
 * contactara con soporte. El system prompt del asistente solo hablaba de
 * normativa y no tenia ninguna informacion de la aplicacion.
 *
 * El cliente de IA esta simulado: se comprueba lo que se envia al modelo.
 */
jest.mock('../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const aiService = require('../../src/services/aiService');
const { GUIA_LUCI, seccionesGuia } = require('../../src/services/ayuda/guiaLuci');

const PREGUNTA_ENLACE = 'como podemos pasar un link al cliente para que nos anexe la factura comercial';

describe('asistente LUCI: preguntas aduaneras y de uso de la plataforma', () => {
  let spy;

  beforeEach(() => {
    spy = jest.spyOn(aiService, 'callClaude').mockResolvedValue({ content: 'respuesta', tokensUsed: 10 });
  });

  afterEach(() => jest.restoreAllMocks());

  test('askLuci envia la guia de LUCI en el system prompt', async () => {
    await aiService.askLuci(PREGUNTA_ENLACE, 'es');

    const systemPrompt = spy.mock.calls[0][1];
    expect(systemPrompt).toContain(GUIA_LUCI);
  });

  test('el system prompt pide responder de aduanas Y de uso de LUCI, sin mandar a soporte si esta en la guia', async () => {
    await aiService.askLuci(PREGUNTA_ENLACE, 'es');

    const systemPrompt = spy.mock.calls[0][1];
    expect(systemPrompt).toMatch(/uso de LUCI/i);
    expect(systemPrompt).toMatch(/normativa aduanera/i);
    expect(systemPrompt).toMatch(/no (le )?remitas a soporte/i);
    expect(systemPrompt).toMatch(/no existe/i);
    expect(systemPrompt).toMatch(/no inventes/i);
  });

  test('la pregunta del enlace al cliente llega con la seccion del portal del cliente', async () => {
    await aiService.askLuci(PREGUNTA_ENLACE, 'es');

    const systemPrompt = spy.mock.calls[0][1];
    const portal = seccionesGuia().find(s => s.id === 'portal-cliente');
    expect(systemPrompt).toContain(portal.texto);
    // La pregunta del usuario va intacta como mensaje.
    expect(spy.mock.calls[0][2]).toContain(PREGUNTA_ENLACE);
  });

  test('respeta el idioma pedido', async () => {
    await aiService.askLuci(PREGUNTA_ENLACE, 'en');
    expect(spy.mock.calls[0][1]).toMatch(/Always respond in English/);
  });

  test('el chat del expediente con contexto de agente tambien lleva la guia', async () => {
    await aiService.generateChatResponse(PREGUNTA_ENLACE, null, [], 'agent', 'es');
    expect(spy.mock.calls[0][1]).toContain(GUIA_LUCI);
  });

  test('el chat con el cliente (portal) no recibe la guia interna de los agentes', async () => {
    await aiService.generateChatResponse('hola, que documentos necesito?', null, [], 'client', 'es');
    expect(spy.mock.calls[0][1]).not.toContain(GUIA_LUCI);
  });

  test('los prompts de analitica no cargan la guia', async () => {
    // La guia solo tiene sentido en la conversacion con el agente; inyectarla en
    // prompts de analisis encareceria cada llamada sin aportar nada.
    await aiService.generateAutomaticInsights({ a: 1 }, {}).catch(() => {});
    expect(spy).toHaveBeenCalled();
    spy.mock.calls.forEach(c => expect(c[1]).not.toContain(GUIA_LUCI));
  });
});
