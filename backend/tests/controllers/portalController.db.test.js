/**
 * portalController — portal PUBLICO del cliente, autorizado por token (no por
 * tenant): findByPortalToken es la puerta de acceso. Cubre seguimiento del
 * expediente, chat con LUCI, subida de documentos y los endpoints IA. Logica de
 * negocio de cara al cliente.
 *
 * FRONTERAS mockeadas SOLO aiService (Bedrock): generateChatResponse,
 * enhancedPortalChat, detectAndRespondFAQ, generateClientExpeditionSummary,
 * generateSmartNotification, fullPortalAnalysis. El modelo Expedition y
 * ChatMessage NO se mockean: Mongo real en memoria, de modo que
 * findByPortalToken, los statics de chat (getConversation/markAsRead/
 * getUnreadCount), los subdocumentos y save() se ejecutan de verdad. El propio
 * portalController NO se mockea.
 *
 * jest.config tiene resetMocks:true -> los fakes se reinstalan en beforeEach.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/services/aiService', () => ({
  generateChatResponse: jest.fn(),
  enhancedPortalChat: jest.fn(),
  detectAndRespondFAQ: jest.fn(),
  generateClientExpeditionSummary: jest.fn(),
  generateSmartNotification: jest.fn(),
  fullPortalAnalysis: jest.fn()
}));

const portalController = require('../../src/controllers/portalController');
const aiService = require('../../src/services/aiService');
const { Expedition, ChatMessage } = require('../../src/models');

usarBaseDeDatosEnMemoria();

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.body = undefined;
  res.downloaded = undefined;
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  res.download = jest.fn((path, name) => { res.downloaded = { path, name }; return res; });
  return res;
}
const mockReq = ({ params = {}, body = {}, query = {}, file } = {}) => ({ params, body, query, file });
const fakeFile = () => ({
  filename: 'stored.pdf', originalname: 'factura.pdf', path: '/tmp/stored.pdf',
  size: 1024, mimetype: 'application/pdf'
});

beforeEach(() => {
  aiService.generateChatResponse.mockResolvedValue({
    message: 'Hola, soy LUCI', model: 'claude', tokensUsed: 50, confidence: 0.9, sources: []
  });
  aiService.enhancedPortalChat.mockResolvedValue({
    response: { message: 'respuesta contextual' }, model: 'claude', tokensUsed: 60,
    intent: 'status_query', intentConfidence: 0.8, suggestedActions: [], escalationNeeded: false
  });
  aiService.detectAndRespondFAQ.mockResolvedValue({ isFAQ: true, answer: 'Es una FAQ' });
  aiService.generateClientExpeditionSummary.mockResolvedValue({ summary: 'resumen' });
  aiService.generateSmartNotification.mockResolvedValue({ title: 'Aviso', body: 'texto' });
  aiService.fullPortalAnalysis.mockResolvedValue({ analysis: 'completo' });
});

// Crea un expediente accesible por su token de portal.
async function sembrarExp(over = {}) {
  return Expedition.create({
    operationType: 'import', transportMode: 'maritime',
    client: { companyName: 'Cliente SL', nif: 'B12345678', contact: { email: 'c@cliente.es' } },
    status: 'pending_documents',
    ...over
  });
}
const TOKEN_INEXISTENTE = 'token-que-no-existe';

describe('getByToken', () => {
  test('404 si el token no corresponde a ningun expediente', async () => {
    const res = mockRes();
    await portalController.getByToken(mockReq({ params: { token: TOKEN_INEXISTENTE } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('expone el seguimiento al cliente sin filtrar datos internos', async () => {
    // La pestaña "Estado" del portal se veia vacia: clientView no incluia el
    // timeline, asi que un expediente con 8 eventos le llegaba al cliente con
    // cero. Pero el timeline no se puede volcar tal cual: portal_link_sent
    // lleva el correo del destinatario y ai_analysis la puntuacion interna del
    // analisis. Solo salen los hitos que son del cliente.
    const exp = await sembrarExp({});
    exp.timeline = [
      { action: 'expedition_created', description: 'Expediente creado', timestamp: new Date() },
      { action: 'portal_link_sent', description: 'Link del portal enviado a cliente@ejemplo.es', timestamp: new Date() },
      { action: 'document_uploaded', description: 'Documento commercial_invoice subido por el cliente', timestamp: new Date() },
      { action: 'ai_analysis', description: 'Análisis IA completado - Puntuación: 70%', timestamp: new Date() }
    ];
    await exp.save();
    const token = exp.clientPortal.token;

    const res = mockRes();
    await portalController.getByToken(mockReq({ params: { token } }), res);

    const timeline = res.body.data.timeline;
    const acciones = timeline.map(t => t.action);

    expect(acciones).toContain('expedition_created');
    expect(acciones).toContain('document_uploaded');

    // Lo que NO debe salir del despacho.
    expect(acciones).not.toContain('portal_link_sent');
    expect(acciones).not.toContain('ai_analysis');
    const texto = JSON.stringify(timeline);
    expect(texto).not.toMatch(/cliente@ejemplo\.es/);
    expect(texto).not.toMatch(/Puntuaci/);
  });

  test('devuelve la vista de cliente e incrementa el contador de visitas', async () => {
    const exp = await sembrarExp({
      goods: [{ itemNumber: 1, description: 'Zapatos', quantity: 10, invoiceValue: 500 }],
      documentChecklist: [{ documentType: 'commercial_invoice', required: true, received: false }]
    });
    const token = exp.clientPortal.token;
    const res = mockRes();
    await portalController.getByToken(mockReq({ params: { token } }), res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.expeditionId).toBe(exp.expeditionId);
    expect(res.body.data.client.companyName).toBe('Cliente SL');
    expect(res.body.data.goods).toHaveLength(1);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.clientPortal.viewCount).toBe(1);
    expect(guardado.clientPortal.lastViewedAt).toBeInstanceOf(Date);
  });
});

describe('getChatHistory', () => {
  test('404 token invalido', async () => {
    const res = mockRes();
    await portalController.getChatHistory(mockReq({ params: { token: TOKEN_INEXISTENTE } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('devuelve los mensajes de la conversacion', async () => {
    const exp = await sembrarExp();
    await ChatMessage.create({ expedition: exp._id, sender: 'client', content: 'Hola', messageType: 'text' });
    await ChatMessage.create({ expedition: exp._id, sender: 'luci', content: 'Buenas', messageType: 'text' });
    const res = mockRes();
    await portalController.getChatHistory(mockReq({ params: { token: exp.clientPortal.token } }), res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.messages).toHaveLength(2);
    expect(res.body.data.expeditionId).toBe(exp.expeditionId);
  });
});

describe('sendMessage', () => {
  test('404 token invalido', async () => {
    const res = mockRes();
    await portalController.sendMessage(mockReq({ params: { token: TOKEN_INEXISTENTE }, body: { content: 'x' } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('guarda el mensaje del cliente, genera la respuesta de LUCI y la persiste', async () => {
    const exp = await sembrarExp();
    const res = mockRes();
    await portalController.sendMessage(
      mockReq({ params: { token: exp.clientPortal.token }, body: { content: '¿Como va mi envio?' } }), res);

    expect(aiService.generateChatResponse).toHaveBeenCalled();
    expect(res.body.data.clientMessage.content).toBe('¿Como va mi envio?');
    expect(res.body.data.luciResponse.content).toBe('Hola, soy LUCI');
    // Ambos mensajes deben quedar persistidos.
    const mensajes = await ChatMessage.find({ expedition: exp._id }).sort({ createdAt: 1 });
    expect(mensajes.map(m => m.sender)).toEqual(expect.arrayContaining(['client', 'luci']));
  });

  test('500 si aiService lanza (el mensaje del cliente ya se guardo antes)', async () => {
    aiService.generateChatResponse.mockRejectedValue(new Error('bedrock down'));
    const exp = await sembrarExp();
    const res = mockRes();
    await portalController.sendMessage(
      mockReq({ params: { token: exp.clientPortal.token }, body: { content: 'hola' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('uploadDocument', () => {
  test('400 si no hay archivo', async () => {
    const exp = await sembrarExp();
    const res = mockRes();
    await portalController.uploadDocument(
      mockReq({ params: { token: exp.clientPortal.token }, body: { documentType: 'commercial_invoice' } }), res);
    expect(res.statusCode).toBe(400);
  });

  test('404 token invalido', async () => {
    const res = mockRes();
    await portalController.uploadDocument(
      mockReq({ params: { token: TOKEN_INEXISTENTE }, file: fakeFile(), body: { documentType: 'commercial_invoice' } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('adjunta el documento y avanza a documents_received si estaban todos', async () => {
    const exp = await sembrarExp({
      status: 'pending_documents',
      documentChecklist: [{ documentType: 'commercial_invoice', required: true, received: false }]
    });
    const res = mockRes();
    await portalController.uploadDocument(
      mockReq({ params: { token: exp.clientPortal.token }, file: fakeFile(), body: { documentType: 'commercial_invoice' } }), res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('documents_received');
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.documents).toHaveLength(1);
    expect(guardado.documentChecklist[0].received).toBe(true);
    // Debe haberse creado el mensaje de chat de documento recibido.
    const chat = await ChatMessage.find({ expedition: exp._id, messageType: 'document_received' });
    expect(chat).toHaveLength(1);
  });
});

describe('getDocument', () => {
  test('404 si el documento no existe', async () => {
    const exp = await sembrarExp();
    const res = mockRes();
    await portalController.getDocument(
      mockReq({ params: { token: exp.clientPortal.token, docId: new mongoose.Types.ObjectId().toString() } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('descarga el documento existente', async () => {
    const exp = await sembrarExp({
      documents: [{ type: 'commercial_invoice', fileName: 'f.pdf', filePath: '/tmp/f.pdf', originalName: 'f.pdf' }]
    });
    const res = mockRes();
    await portalController.getDocument(
      mockReq({ params: { token: exp.clientPortal.token, docId: exp.documents[0]._id.toString() } }), res);
    expect(res.downloaded).toEqual({ path: '/tmp/f.pdf', name: 'f.pdf' });
  });
});

describe('getUnreadCount', () => {
  test('404 token invalido', async () => {
    const res = mockRes();
    await portalController.getUnreadCount(mockReq({ params: { token: TOKEN_INEXISTENTE } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('cuenta los mensajes no leidos del agente hacia el cliente', async () => {
    const exp = await sembrarExp();
    await ChatMessage.create({ expedition: exp._id, sender: 'agent', content: 'ping', messageType: 'text', isRead: false });
    const res = mockRes();
    await portalController.getUnreadCount(mockReq({ params: { token: exp.clientPortal.token } }), res);
    expect(res.body.success).toBe(true);
    expect(res.body.data.unreadCount).toBeGreaterThanOrEqual(1);
  });
});

describe('endpoints IA', () => {
  test('aiEnhancedChat 400 sin message', async () => {
    const exp = await sembrarExp();
    const res = mockRes();
    await portalController.aiEnhancedChat(mockReq({ params: { token: exp.clientPortal.token }, body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  test('aiEnhancedChat guarda ambos mensajes y devuelve el intent', async () => {
    const exp = await sembrarExp();
    const res = mockRes();
    await portalController.aiEnhancedChat(
      mockReq({ params: { token: exp.clientPortal.token }, body: { message: '¿que falta?' } }), res);
    expect(aiService.enhancedPortalChat).toHaveBeenCalled();
    expect(res.body.data.intent).toBe('status_query');
    const mensajes = await ChatMessage.find({ expedition: exp._id });
    expect(mensajes).toHaveLength(2);
  });

  test('aiDetectFAQ 400 sin question', async () => {
    const exp = await sembrarExp();
    const res = mockRes();
    await portalController.aiDetectFAQ(mockReq({ params: { token: exp.clientPortal.token }, body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  test('aiDetectFAQ devuelve el resultado del servicio', async () => {
    const exp = await sembrarExp();
    const res = mockRes();
    await portalController.aiDetectFAQ(
      mockReq({ params: { token: exp.clientPortal.token }, body: { question: '¿que es un DUA?' } }), res);
    expect(res.body.data.isFAQ).toBe(true);
  });

  test('aiGetSummary 404 token invalido', async () => {
    const res = mockRes();
    await portalController.aiGetSummary(mockReq({ params: { token: TOKEN_INEXISTENTE } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('aiGetSummary pasa las opciones y devuelve el resumen', async () => {
    const exp = await sembrarExp();
    const res = mockRes();
    await portalController.aiGetSummary(
      mockReq({ params: { token: exp.clientPortal.token }, query: { detailLevel: 'detailed', includeCosts: 'true' } }), res);
    expect(aiService.generateClientExpeditionSummary).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ detailLevel: 'detailed', includeCosts: true, language: 'es' })
    );
    expect(res.body.data.summary).toBe('resumen');
  });

  test('aiGenerateNotification 400 si falta event.type', async () => {
    const exp = await sembrarExp();
    const res = mockRes();
    await portalController.aiGenerateNotification(
      mockReq({ params: { token: exp.clientPortal.token }, body: { event: {} } }), res);
    expect(res.statusCode).toBe(400);
  });

  test('aiGenerateNotification devuelve la notificacion', async () => {
    const exp = await sembrarExp();
    const res = mockRes();
    await portalController.aiGenerateNotification(
      mockReq({ params: { token: exp.clientPortal.token }, body: { event: { type: 'arrival' } } }), res);
    expect(res.body.data.title).toBe('Aviso');
  });

  test('aiFullAnalysis 404 token invalido', async () => {
    const res = mockRes();
    await portalController.aiFullAnalysis(mockReq({ params: { token: TOKEN_INEXISTENTE } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('aiFullAnalysis devuelve el analisis', async () => {
    const exp = await sembrarExp();
    const res = mockRes();
    await portalController.aiFullAnalysis(mockReq({ params: { token: exp.clientPortal.token } }), res);
    expect(res.body.data.analysis).toBe('completo');
  });
});
