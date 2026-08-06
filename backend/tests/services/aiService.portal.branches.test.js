/**
 * Portal & Analytics AI Methods Branch Coverage
 * Meta: cada método ≥85% cobertura de ramas
 * NO se mockea el código bajo prueba, SOLO callClaude
 */

const aiService = require('../../src/services/aiService');

describe('AIService - Portal Cliente', () => {
  let claudeSpy;

  beforeEach(() => {
    claudeSpy = jest.spyOn(aiService, 'callClaude');
  });

  afterEach(() => {
    claudeSpy.mockRestore();
  });

  describe('enhancedPortalChat', () => {
    test('procesa mensaje con expediente completo y bloque JSON válido', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"intent":"status_query","intentConfidence":95,"response":{"message":"Su expediente está en proceso","tone":"informative","language":"es"},"faqMatch":{"matched":false},"suggestedActions":[],"expeditionInsights":{"statusExplanation":"Documentos recibidos"},"escalationNeeded":{"needed":false},"followUpQuestions":[]}\n```',
        tokensUsed: 100
      });

      const expedition = {
        expeditionId: 'EXP-001',
        operationType: 'import',
        status: 'documents_received',
        createdAt: '2026-08-01',
        client: { companyName: 'Test Corp', contact: { email: 'test@example.com' } },
        documentChecklist: [
          { documentName: 'Factura', required: true, received: true },
          { documentName: 'Packing List', required: true, received: false }
        ],
        documentCompletion: 50,
        goods: [{ description: 'Café en grano' }],
        transportMode: 'sea',
        incoterm: 'FOB'
      };

      const clientProfile = {
        companyName: 'Test Corp',
        email: 'test@example.com',
        operationHistory: 12,
        experienceLevel: 'advanced'
      };

      const conversationHistory = [
        { sender: 'user', content: 'Hola' },
        { sender: 'bot', content: '¿En qué puedo ayudarle?' }
      ];

      const result = await aiService.enhancedPortalChat(
        '¿Cuál es el estado?',
        expedition,
        conversationHistory,
        clientProfile
      );

      expect(result.intent).toBe('status_query');
      expect(result.intentConfidence).toBe(95);
      expect(result.response.message).toContain('en proceso');
      expect(result.model).toBe('sonnet-4');
      expect(result.tokensUsed).toBe(100);
      expect(result.generatedAt).toBeDefined();
    });

    test('procesa mensaje sin bloque JSON (content directo)', async () => {
      claudeSpy.mockResolvedValue({
        content: '{"intent":"greeting","response":{"message":"Hola, ¿en qué puedo ayudarle?","tone":"helpful"}}',
        tokensUsed: 50
      });

      const result = await aiService.enhancedPortalChat('Hola', {}, []);

      expect(result.intent).toBe('greeting');
      expect(result.response.message).toContain('ayudarle');
    });

    test('maneja JSON inválido y devuelve fallback', async () => {
      claudeSpy.mockResolvedValue({
        content: 'Respuesta no parseada sin JSON',
        tokensUsed: 30
      });

      const result = await aiService.enhancedPortalChat('mensaje', {}, []);

      expect(result.intent).toBe('other');
      expect(result.response.message).toBe('Respuesta no parseada sin JSON');
      expect(result.response.tone).toBe('helpful');
      expect(result.suggestedActions).toEqual([]);
      expect(result.escalationNeeded.needed).toBe(false);
    });

    test('maneja expediente sin client, sin documentChecklist, sin goods', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"intent":"other","response":{"message":"Sin contexto","tone":"informative"}}\n```',
        tokensUsed: 20
      });

      const expeditionMinimal = {
        expeditionId: 'EXP-MIN'
      };

      const result = await aiService.enhancedPortalChat('test', expeditionMinimal);

      expect(result.intent).toBe('other');
      expect(claudeSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.stringContaining('No especificada'),
        expect.any(Object)
      );
    });

    test('maneja conversationHistory vacío', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"intent":"faq","response":{"message":"FAQ"}}\n```',
        tokensUsed: 10
      });

      const result = await aiService.enhancedPortalChat('test', {}, []);

      expect(result.intent).toBe('faq');
      expect(claudeSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.stringContaining('Sin historial previo'),
        expect.any(Object)
      );
    });

    test('maneja clientProfile vacío (sin campos)', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"intent":"other","response":{"message":"Ok"}}\n```',
        tokensUsed: 5
      });

      const result = await aiService.enhancedPortalChat('test', {});

      expect(claudeSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.stringContaining('No especificada'),
        expect.any(Object)
      );
    });
  });

  describe('detectAndRespondFAQ', () => {
    test('maneja question con context explícito', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"isFAQ":true,"matchedFAQs":[],"response":{"answer":"Ok"}}\n```',
        tokensUsed: 10
      });

      const result = await aiService.detectAndRespondFAQ('test', { operationType: 'export', status: 'completed' });
      expect(result.isFAQ).toBe(true);
    });

    test('detecta FAQ con matchedFAQs y respuesta', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"isFAQ":true,"matchedFAQs":[{"faqNumber":2,"matchScore":90,"originalQuestion":"¿Cuánto tiempo tarda el despacho?"}],"response":{"answer":"Depende del canal asignado","additionalInfo":"Canal verde: 24h","relatedTopics":["canales"]},"needsHumanReview":false,"confidence":90}\n```',
        tokensUsed: 120
      });

      const result = await aiService.detectAndRespondFAQ(
        '¿Cuánto tarda?',
        { operationType: 'import', status: 'in_progress' }
      );

      expect(result.isFAQ).toBe(true);
      expect(result.matchedFAQs).toHaveLength(1);
      expect(result.matchedFAQs[0].matchScore).toBe(90);
      expect(result.response.answer).toContain('canal');
      expect(result.confidence).toBe(90);
      expect(result.model).toBe('sonnet-4');
    });

    test('detecta FAQ sin bloque JSON (directo)', async () => {
      claudeSpy.mockResolvedValue({
        content: '{"isFAQ":false,"matchedFAQs":[],"response":{"answer":"No aplica"},"needsHumanReview":true,"confidence":10}',
        tokensUsed: 40
      });

      const result = await aiService.detectAndRespondFAQ('Pregunta rara', {});

      expect(result.isFAQ).toBe(false);
      expect(result.needsHumanReview).toBe(true);
    });

    test('maneja JSON inválido y devuelve fallback', async () => {
      claudeSpy.mockResolvedValue({
        content: 'Error en respuesta',
        tokensUsed: 5
      });

      const result = await aiService.detectAndRespondFAQ('test', {});

      expect(result.isFAQ).toBe(false);
      expect(result.matchedFAQs).toEqual([]);
      expect(result.response.answer).toBe('No pude procesar la pregunta');
      expect(result.needsHumanReview).toBe(true);
      expect(result.confidence).toBe(0);
    });

    test('maneja context sin operationType y sin status', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"isFAQ":false,"matchedFAQs":[],"response":{"answer":"N/A"}}\n```',
        tokensUsed: 10
      });

      const result = await aiService.detectAndRespondFAQ('test', {});

      expect(claudeSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.stringContaining('general'),
        expect.any(Object)
      );
    });
  });

  describe('generateSmartNotification', () => {
    test('genera notificación completa con todos los campos', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"notification":{"title":"Documento validado","message":"Su factura ha sido aprobada","shortMessage":"Factura aprobada","detailedMessage":"La factura comercial ha sido validada y aceptada"},"metadata":{"urgency":"MEDIUM","category":"success","icon":"check"},"callToAction":{"text":"Ver documento","url":"/portal/documents/1","required":false},"channels":{"email":true,"sms":false,"push":true,"portal":true},"scheduling":{"sendImmediately":true,"reason":"Evento importante"}}\n```',
        tokensUsed: 150
      });

      const event = {
        type: 'document_validated',
        description: 'Factura validada',
        data: { documentId: 'DOC-001' },
        timestamp: '2026-08-06T10:00:00Z'
      };

      const expedition = {
        expeditionId: 'EXP-001',
        status: 'documents_received',
        operationType: 'import',
        goods: [{ description: 'Textiles' }],
        client: { companyName: 'TextilCorp' }
      };

      const clientPreferences = {
        language: 'es',
        detailLevel: 'high',
        channels: ['email', 'portal']
      };

      const result = await aiService.generateSmartNotification(event, expedition, clientPreferences);

      expect(result.notification.title).toBe('Documento validado');
      expect(result.notification.shortMessage).toBeTruthy();
      expect(result.metadata.urgency).toBe('MEDIUM');
      expect(result.callToAction.url).toContain('/portal');
      expect(result.channels.email).toBe(true);
      expect(result.eventType).toBe('document_validated');
      expect(result.expeditionId).toBe('EXP-001');
      expect(result.generatedAt).toBeDefined();
    });

    test('genera notificación sin bloque JSON', async () => {
      claudeSpy.mockResolvedValue({
        content: '{"notification":{"title":"Alerta","message":"Mensaje"},"metadata":{"urgency":"LOW","category":"info"}}',
        tokensUsed: 50
      });

      const result = await aiService.generateSmartNotification(
        { type: 'action_required' },
        { expeditionId: 'E2' }
      );

      expect(result.notification.title).toBe('Alerta');
      expect(result.expeditionId).toBe('E2');
    });

    test('maneja JSON inválido con fallback y event CON description', async () => {
      claudeSpy.mockResolvedValue({
        content: 'Error al parsear',
        tokensUsed: 10
      });

      const event = { type: 'status_change', description: 'Cambio de estado' };
      const expedition = { expeditionId: 'E3' };

      const result = await aiService.generateSmartNotification(event, expedition);

      expect(result.notification.title).toBe('Actualización de expediente');
      expect(result.notification.message).toContain('Cambio de estado');
      expect(result.metadata.urgency).toBe('MEDIUM');
      expect(result.channels.portal).toBe(true);
      expect(result.channels.email).toBe(true);
    });

    test('maneja JSON inválido con fallback y event SIN description', async () => {
      claudeSpy.mockResolvedValue({
        content: 'Error parsing',
        tokensUsed: 5
      });

      const event = { type: 'other' };
      const expedition = { expeditionId: 'E5' };

      const result = await aiService.generateSmartNotification(event, expedition);

      expect(result.notification.message).toBe('Hay novedades en su expediente');
    });

    test('maneja event CON description (rama event.description truthy)', async () => {
      claudeSpy.mockResolvedValue({
        content: 'Error',
        tokensUsed: 5
      });

      const event = { type: 'test', description: 'Descripción presente' };
      const result = await aiService.generateSmartNotification(event, {});

      expect(result.notification.message).toBe('Descripción presente');
    });

    test('maneja event sin description, sin data, sin timestamp', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"notification":{"title":"Sin datos"}}\n```',
        tokensUsed: 5
      });

      const result = await aiService.generateSmartNotification({ type: 'other' }, {});

      expect(claudeSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.stringContaining('No especificada'),
        expect.any(Object)
      );
    });

    test('maneja clientPreferences sin campos', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"notification":{"title":"Ok"}}\n```',
        tokensUsed: 5
      });

      const result = await aiService.generateSmartNotification(
        { type: 'test' },
        {},
        {}
      );

      expect(claudeSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.stringContaining('email, portal'),
        expect.any(Object)
      );
    });
  });

  describe('generateClientExpeditionSummary', () => {
    test('genera resumen completo con todos los campos', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"summary":{"headline":"Importación en proceso","statusExplanation":"Documentos recibidos, esperando validación","progressPercentage":60,"progressDescription":"60% completado"},"keyInfo":{"whatIsHappening":"Validando documentos","whatYouNeedToDo":"Esperar validación","estimatedCompletion":"2 días","nextMilestone":"Asignación de canal"},"documents":{"completed":["Factura"],"pending":["Certificado"],"urgent":[]},"costs":{"estimated":500,"breakdown":[{"concept":"Aranceles","amount":400}],"paymentStatus":"Pendiente"},"timeline":[{"date":"2026-08-01","event":"Recepción","status":"completed"}],"alerts":[{"type":"info","message":"Todo en orden"}],"faqs":[{"question":"¿Qué sigue?","answer":"Esperar validación"}]}\n```',
        tokensUsed: 200
      });

      const expedition = {
        expeditionId: 'EXP-001',
        operationType: 'import',
        status: 'documents_received',
        createdAt: '2026-08-01',
        client: { companyName: 'Test SA', nif: 'B12345678' },
        goods: [
          { description: 'Café', quantity: 100, unit: 'kg', weight: { gross: 110 }, value: 5000 }
        ],
        transportMode: 'sea',
        transport: { documentNumber: 'BL-123', arrivalDate: '2026-08-10' },
        documentChecklist: [
          { documentName: 'Factura', received: true, validated: true },
          { documentName: 'Certificado', received: false }
        ],
        documentCompletion: 60,
        declaration: { mrn: 'MRN-001', channel: 'orange', regime: '4000' },
        timeline: [
          { action: 'received', description: 'Documentos recibidos' }
        ]
      };

      const options = {
        detailLevel: 'high',
        includeCosts: true,
        language: 'es'
      };

      const result = await aiService.generateClientExpeditionSummary(expedition, options);

      expect(result.summary.headline).toContain('Importación');
      expect(result.summary.progressPercentage).toBe(60);
      expect(result.keyInfo.whatIsHappening).toBeTruthy();
      expect(result.documents.completed).toContain('Factura');
      expect(result.costs.estimated).toBe(500);
      expect(result.timeline).toHaveLength(1);
      expect(result.expeditionId).toBe('EXP-001');
      expect(result.generatedAt).toBeDefined();
    });

    test('genera resumen sin bloque JSON', async () => {
      claudeSpy.mockResolvedValue({
        content: '{"summary":{"headline":"Estado general","statusExplanation":"Ok","progressPercentage":30}}',
        tokensUsed: 50
      });

      const result = await aiService.generateClientExpeditionSummary(
        { expeditionId: 'E2', status: 'pending' },
        {}
      );

      expect(result.summary.headline).toBe('Estado general');
      expect(result.summary.progressPercentage).toBe(30);
    });

    test('maneja JSON inválido con fallback y documentCompletion presente', async () => {
      claudeSpy.mockResolvedValue({
        content: 'Respuesta cruda sin JSON',
        tokensUsed: 10
      });

      const expedition = {
        expeditionId: 'E3',
        status: 'completed',
        documentCompletion: 100
      };

      const result = await aiService.generateClientExpeditionSummary(expedition);

      expect(result.summary.headline).toBe('Resumen de expediente');
      expect(result.summary.statusExplanation).toContain('completed');
      expect(result.summary.progressPercentage).toBe(100);
      expect(result.keyInfo).toEqual({});
      expect(result.documents.pending).toEqual([]);
      expect(result.rawResponse).toBe('Respuesta cruda sin JSON');
    });

    test('maneja JSON inválido con documentCompletion undefined', async () => {
      claudeSpy.mockResolvedValue({
        content: 'Error',
        tokensUsed: 5
      });

      const expedition = { expeditionId: 'E4', status: 'pending' };
      const result = await aiService.generateClientExpeditionSummary(expedition);

      expect(result.summary.progressPercentage).toBe(0);
    });

    test('maneja goods con weight.gross y value presentes', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"summary":{"headline":"Con valores"}}\n```',
        tokensUsed: 10
      });

      const expedition = {
        expeditionId: 'E-VAL',
        goods: [
          { description: 'Producto', quantity: 10, unit: 'kg', weight: { gross: 50 }, value: 1000 }
        ]
      };

      const result = await aiService.generateClientExpeditionSummary(expedition);
      expect(result.summary.headline).toBe('Con valores');
    });

    test('maneja goods sin weight.gross y sin value', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"summary":{"headline":"Sin valores"}}\n```',
        tokensUsed: 10
      });

      const expedition = {
        expeditionId: 'E-NA',
        goods: [
          { description: 'Producto sin datos', quantity: 5, unit: 'pcs' }
        ]
      };

      const result = await aiService.generateClientExpeditionSummary(expedition);
      expect(claudeSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.stringMatching(/N\/A.*N\/A/s),
        expect.any(Object)
      );
    });

    test('maneja expedition sin goods, sin documentChecklist, sin timeline', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"summary":{"headline":"Mínimo"}}\n```',
        tokensUsed: 5
      });

      const result = await aiService.generateClientExpeditionSummary({
        expeditionId: 'MIN'
      });

      expect(claudeSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.stringContaining('No especificadas'),
        expect.any(Object)
      );
    });

    test('maneja options sin campos', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"summary":{"headline":"Test"}}\n```',
        tokensUsed: 5
      });

      const result = await aiService.generateClientExpeditionSummary({ expeditionId: 'X' });

      expect(claudeSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.stringContaining('normal'),
        expect.any(Object)
      );
    });
  });

  describe('fullPortalAnalysis', () => {
    test('ejecuta análisis completo con notificaciones y acciones', async () => {
      claudeSpy
        .mockResolvedValueOnce({
          content: '```json\n{"summary":{"headline":"En proceso"},"keyInfo":{},"documents":{"pending":[],"completed":[]}}\n```',
          tokensUsed: 100
        })
        .mockResolvedValueOnce({
          content: '```json\n{"isFAQ":true,"matchedFAQs":[],"response":{"answer":"Estado activo"}}\n```',
          tokensUsed: 50
        });

      const expedition = {
        expeditionId: 'EXP-001',
        operationType: 'import',
        status: 'documents_received',
        documentChecklist: [
          { documentName: 'Factura', required: true, received: true },
          { documentName: 'Packing', required: true, received: false }
        ],
        documentCompletion: 75
      };

      const clientProfile = { operationHistory: 8 };

      const result = await aiService.fullPortalAnalysis(expedition, clientProfile, {});

      expect(result.summary).toBeDefined();
      expect(result.faqResources.isFAQ).toBe(true);
      expect(result.pendingNotifications).toHaveLength(1);
      expect(result.pendingNotifications[0].type).toBe('document_required');
      expect(result.clientInsights.satisfactionScore).toBeGreaterThanOrEqual(70);
      expect(result.clientInsights.engagementLevel).toBe('HIGH');
      expect(result.supportOptions.chatAvailable).toBe(true);
      expect(result.analyzedAt).toBeDefined();
    });

    test('genera notificación de pago pendiente cuando status=pending_payment', async () => {
      claudeSpy
        .mockResolvedValueOnce({
          content: '```json\n{"summary":{"headline":"Pago pendiente"}}\n```',
          tokensUsed: 50
        })
        .mockResolvedValueOnce({
          content: '```json\n{"isFAQ":false}\n```',
          tokensUsed: 20
        });

      const expedition = {
        expeditionId: 'E2',
        operationType: 'export',
        status: 'pending_payment',
        documentChecklist: []
      };

      const result = await aiService.fullPortalAnalysis(expedition);

      expect(result.pendingNotifications.some(n => n.type === 'payment_due')).toBe(true);
      const paymentNotif = result.pendingNotifications.find(n => n.type === 'payment_due');
      expect(paymentNotif.urgency).toBe('HIGH');
    });

    test('calcula satisfactionScore con todos los bonos', async () => {
      claudeSpy
        .mockResolvedValueOnce({
          content: '```json\n{"summary":{"headline":"Completado"}}\n```',
          tokensUsed: 30
        })
        .mockResolvedValueOnce({
          content: '```json\n{"isFAQ":false}\n```',
          tokensUsed: 10
        });

      const expedition = {
        expeditionId: 'E3',
        status: 'completed',
        documentCompletion: 100,
        documentChecklist: []
      };

      const result = await aiService.fullPortalAnalysis(expedition, {});

      // 70 base + 10 (completion>=80) + 15 (completed) + 5 (no pending) = 100
      expect(result.clientInsights.satisfactionScore).toBe(100);
    });

    test('genera notificación HIGH cuando hay más de 2 docs pendientes', async () => {
      claudeSpy
        .mockResolvedValueOnce({
          content: '```json\n{"summary":{}}\n```',
          tokensUsed: 20
        })
        .mockResolvedValueOnce({
          content: '```json\n{"isFAQ":false}\n```',
          tokensUsed: 10
        });

      const expedition = {
        expeditionId: 'E4',
        status: 'in_progress',
        documentChecklist: [
          { documentName: 'D1', required: true, received: false },
          { documentName: 'D2', required: true, received: false },
          { documentName: 'D3', required: true, received: false }
        ]
      };

      const result = await aiService.fullPortalAnalysis(expedition);

      expect(result.pendingNotifications[0].urgency).toBe('HIGH');
      expect(result.pendingNotifications[0].message).toContain('3 documento(s)');
    });

    test('maneja expedition sin documentChecklist (undefined)', async () => {
      claudeSpy
        .mockResolvedValueOnce({
          content: '```json\n{"summary":{}}\n```',
          tokensUsed: 10
        })
        .mockResolvedValueOnce({
          content: '```json\n{"isFAQ":false}\n```',
          tokensUsed: 5
        });

      const expedition = { expeditionId: 'E5', status: 'pending' };
      const result = await aiService.fullPortalAnalysis(expedition);

      expect(result.pendingNotifications).toEqual([]);
    });
  });

  describe('_generateClientRecommendedActions', () => {
    test('genera acción de subir documentos cuando hay pendientes', () => {
      const expedition = { status: 'in_progress' };
      const pendingDocs = [
        { documentName: 'Factura' },
        { documentName: 'Packing' }
      ];

      const result = aiService._generateClientRecommendedActions(expedition, pendingDocs);

      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe(1);
      expect(result[0].action).toContain('Subir documentos');
      expect(result[0].description).toContain('Factura');
      expect(result[0].url).toBe('/portal/documents');
    });

    test('genera acción de pago cuando status=pending_payment', () => {
      const expedition = { status: 'pending_payment' };
      const pendingDocs = [];

      const result = aiService._generateClientRecommendedActions(expedition, pendingDocs);

      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe(1);
      expect(result[0].action).toContain('Realizar pago');
      expect(result[0].url).toBe('/portal/payments');
    });

    test('genera acción de esperar validación cuando status=documents_received', () => {
      const expedition = { status: 'documents_received' };
      const pendingDocs = [];

      const result = aiService._generateClientRecommendedActions(expedition, pendingDocs);

      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe(2);
      expect(result[0].action).toContain('Esperar validación');
      expect(result[0].url).toBe(null);
    });

    test('genera "Todo en orden" cuando no hay pendientes ni acciones', () => {
      const expedition = { status: 'completed' };
      const pendingDocs = [];

      const result = aiService._generateClientRecommendedActions(expedition, pendingDocs);

      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe(3);
      expect(result[0].action).toContain('Todo en orden');
      expect(result[0].url).toBe(null);
    });

    test('ordena acciones por prioridad ascendente', () => {
      const expedition = { status: 'pending_payment' };
      const pendingDocs = [{ documentName: 'Doc' }];

      const result = aiService._generateClientRecommendedActions(expedition, pendingDocs);

      // Ambas priority=1, debería mantener orden de inserción
      expect(result[0].priority).toBeLessThanOrEqual(result[1].priority);
    });
  });

  describe('generateAutomaticInsights', () => {
    test('genera insights completos con todas las secciones', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"executiveSummary":"Rendimiento estable","keyInsights":[{"id":"i1","type":"trend","title":"Volumen creciente","description":"Aumento del 15%","impact":"HIGH","metric":"volume","value":"150","change":"+15%","recommendation":"Mantener","priority":1}],"trends":{"positive":[{"metric":"efficiency","trend":"up"}],"negative":[],"neutral":[]},"anomalies":[{"metric":"cost","expected":"100","actual":"120","deviation":"20%","possibleCauses":["Tipo cambio"],"recommendedAction":"Revisar"}],"opportunities":[{"area":"Automation","description":"Reducir tiempos","potentialImpact":"HIGH","effort":"MEDIUM","timeframe":"3 meses"}],"risks":[{"risk":"Retrasos","probability":"MEDIUM","impact":"HIGH","mitigation":"Buffer"}],"recommendations":[{"priority":1,"action":"Automatizar","rationale":"Eficiencia","expectedOutcome":"Reducción 20%","kpiImpact":["time"]}],"nextPeriodForecast":{"volumeExpected":"200","keyFactors":["Demanda"],"confidence":85}}\n```',
        tokensUsed: 300
      });

      const analyticsData = {
        volume: 150,
        efficiency: 92,
        cost: 120
      };

      const context = {
        period: 'Julio 2026',
        operationType: 'import',
        comparison: true
      };

      const result = await aiService.generateAutomaticInsights(analyticsData, context);

      expect(result.executiveSummary).toContain('Rendimiento');
      expect(result.keyInsights).toHaveLength(1);
      expect(result.keyInsights[0].impact).toBe('HIGH');
      expect(result.trends.positive).toHaveLength(1);
      expect(result.anomalies).toHaveLength(1);
      expect(result.opportunities).toHaveLength(1);
      expect(result.risks).toHaveLength(1);
      expect(result.recommendations).toHaveLength(1);
      expect(result.nextPeriodForecast.confidence).toBe(85);
      expect(result.model).toBe('opus-4');
      expect(result.generatedAt).toBeDefined();
    });

    test('procesa insights sin bloque JSON', async () => {
      claudeSpy.mockResolvedValue({
        content: '{"executiveSummary":"Ok","keyInsights":[],"trends":{"positive":[],"negative":[],"neutral":[]},"anomalies":[],"recommendations":[]}',
        tokensUsed: 50
      });

      const result = await aiService.generateAutomaticInsights({ data: 1 });

      expect(result.executiveSummary).toBe('Ok');
      expect(result.keyInsights).toEqual([]);
    });

    test('maneja JSON inválido con fallback', async () => {
      claudeSpy.mockResolvedValue({
        content: 'Error de parsing',
        tokensUsed: 10
      });

      const result = await aiService.generateAutomaticInsights({});

      expect(result.executiveSummary).toBe('Error al generar insights');
      expect(result.keyInsights).toEqual([]);
      expect(result.trends.positive).toEqual([]);
      expect(result.anomalies).toEqual([]);
      expect(result.recommendations).toEqual([]);
      expect(result.rawResponse).toBe('Error de parsing');
    });

    test('maneja context sin campos', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"executiveSummary":"Sin contexto"}\n```',
        tokensUsed: 5
      });

      const result = await aiService.generateAutomaticInsights({ x: 1 });

      expect(claudeSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.stringContaining('Último mes'),
        expect.any(Object)
      );
    });
  });

  describe('detectAnomaliesAI', () => {
    test('detecta anomalías con summary y alertas', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"anomaliesDetected":true,"anomalyCount":2,"overallHealthScore":65,"anomalies":[{"id":"a1","metric":"response_time","type":"spike","severity":"HIGH","anomalyScore":85,"description":"Tiempo respuesta elevado","expectedValue":"2s","actualValue":"8s","deviation":"300%","direction":"negative","detectedAt":"2026-08-06","duration":"2h","probableCauses":[{"cause":"Carga alta","probability":80,"evidence":"CPU 90%"}],"relatedMetrics":["cpu"],"businessImpact":"Retrasos","recommendedActions":[{"action":"Escalar","urgency":"IMMEDIATE","expectedEffect":"Reducir carga"}]},{"id":"a2","metric":"error_rate","type":"spike","severity":"CRITICAL","anomalyScore":95,"description":"Errores elevados"}],"patterns":{"seasonal":[],"cyclical":[],"trend":[]},"correlationBreaks":[{"metrics":["m1","m2"],"expectedCorrelation":"0.8","actualCorrelation":"0.2","significance":"Alta"}],"alertsGenerated":[{"level":"CRITICAL","message":"Error crítico","metric":"error_rate","threshold":"5%"}],"summary":{"criticalCount":1,"highCount":1,"mediumCount":0,"lowCount":0,"requiresImmediateAttention":true,"topPriority":"Resolver errores críticos"}}\n```',
        tokensUsed: 400
      });

      const data = {
        response_time: 8,
        error_rate: 12
      };

      const thresholds = {
        response_time: 3,
        error_rate: 5
      };

      const result = await aiService.detectAnomaliesAI(data, thresholds);

      expect(result.anomaliesDetected).toBe(true);
      expect(result.anomalyCount).toBe(2);
      expect(result.overallHealthScore).toBe(65);
      expect(result.anomalies).toHaveLength(2);
      expect(result.anomalies[0].severity).toBe('HIGH');
      expect(result.anomalies[0].probableCauses).toHaveLength(1);
      expect(result.correlationBreaks).toHaveLength(1);
      expect(result.alertsGenerated).toHaveLength(1);
      expect(result.summary.criticalCount).toBe(1);
      expect(result.summary.requiresImmediateAttention).toBe(true);
      expect(result.model).toBe('opus-4');
      expect(result.analyzedAt).toBeDefined();
    });

    test('procesa sin bloque JSON', async () => {
      claudeSpy.mockResolvedValue({
        content: '{"anomaliesDetected":false,"anomalyCount":0,"anomalies":[],"summary":{"requiresImmediateAttention":false}}',
        tokensUsed: 30
      });

      const result = await aiService.detectAnomaliesAI({ ok: true }, {});

      expect(result.anomaliesDetected).toBe(false);
      expect(result.anomalyCount).toBe(0);
    });

    test('maneja JSON inválido con fallback', async () => {
      claudeSpy.mockResolvedValue({
        content: 'Error inesperado',
        tokensUsed: 5
      });

      const result = await aiService.detectAnomaliesAI({}, {});

      expect(result.anomaliesDetected).toBe(false);
      expect(result.anomalyCount).toBe(0);
      expect(result.anomalies).toEqual([]);
      expect(result.summary.requiresImmediateAttention).toBe(false);
      expect(result.rawResponse).toBe('Error inesperado');
    });

    test('maneja thresholds vacío', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"anomaliesDetected":false}\n```',
        tokensUsed: 5
      });

      const result = await aiService.detectAnomaliesAI({ data: 1 });

      expect(claudeSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.stringContaining('UMBRALES CONFIGURADOS'),
        expect.any(Object)
      );
    });
  });

  describe('predictTrendsAI', () => {
    test('predice tendencias con todos los campos', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"predictions":[{"metric":"volume","currentValue":100,"predictions":[{"date":"2026-08-10","predicted":110,"lowerBound":105,"upperBound":115,"confidence":90}],"trend":"increasing","trendStrength":75,"seasonalPattern":"Verano alto","expectedChange":"+10%"}],"keyPredictions":{"volumeChange":"+10%","revenueChange":"+5%","efficiencyChange":"+2%","riskChange":"Estable"},"inflectionPoints":[{"date":"2026-08-15","metric":"volume","type":"peak","description":"Máximo esperado","confidence":80}],"externalFactors":[{"factor":"Demanda","impact":"HIGH","direction":"positive","description":"Incremento demanda"}],"scenarios":{"optimistic":{"description":"Mejor caso","keyMetrics":{"volume":120},"probability":30},"baseline":{"description":"Caso base","keyMetrics":{"volume":110},"probability":50},"pessimistic":{"description":"Peor caso","keyMetrics":{"volume":90},"probability":20}},"recommendations":[{"scenario":"baseline","action":"Mantener capacidad","timing":"Inmediato"}],"modelConfidence":85,"limitations":["Datos limitados","Externos impredecibles"]}\n```',
        tokensUsed: 500
      });

      const historicalData = {
        volume: [100, 105, 102, 108],
        revenue: [5000, 5200, 5100, 5400]
      };

      const horizon = 15;

      const result = await aiService.predictTrendsAI(historicalData, horizon);

      expect(result.predictions).toHaveLength(1);
      expect(result.predictions[0].trend).toBe('increasing');
      expect(result.predictions[0].predictions).toHaveLength(1);
      expect(result.keyPredictions.volumeChange).toBe('+10%');
      expect(result.inflectionPoints).toHaveLength(1);
      expect(result.externalFactors).toHaveLength(1);
      expect(result.scenarios.optimistic.probability).toBe(30);
      expect(result.scenarios.baseline.probability).toBe(50);
      expect(result.scenarios.pessimistic.probability).toBe(20);
      expect(result.recommendations).toHaveLength(1);
      expect(result.modelConfidence).toBe(85);
      expect(result.limitations).toHaveLength(2);
      expect(result.horizon).toBe(15);
      expect(result.model).toBe('opus-4');
      expect(result.predictedAt).toBeDefined();
    });

    test('procesa sin bloque JSON', async () => {
      claudeSpy.mockResolvedValue({
        content: '{"predictions":[],"modelConfidence":0}',
        tokensUsed: 20
      });

      const result = await aiService.predictTrendsAI({ data: [] }, 30);

      expect(result.predictions).toEqual([]);
      expect(result.modelConfidence).toBe(0);
    });

    test('maneja JSON inválido con fallback', async () => {
      claudeSpy.mockResolvedValue({
        content: 'Error en predicción',
        tokensUsed: 10
      });

      const result = await aiService.predictTrendsAI({}, 30);

      expect(result.predictions).toEqual([]);
      expect(result.modelConfidence).toBe(0);
      expect(result.rawResponse).toBe('Error en predicción');
    });

    test('usa horizon por defecto 30 cuando no se especifica', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"predictions":[]}\n```',
        tokensUsed: 5
      });

      const result = await aiService.predictTrendsAI({ data: 1 });

      expect(claudeSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.stringContaining('HORIZONTE DE PREDICCIÓN: 30 días'),
        expect.any(Object)
      );
      expect(result.horizon).toBe(30);
    });

    test('usa horizon especificado', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"predictions":[]}\n```',
        tokensUsed: 5
      });

      const result = await aiService.predictTrendsAI({ data: 1 }, 60);

      expect(claudeSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.stringContaining('60 días'),
        expect.any(Object)
      );
      expect(result.horizon).toBe(60);
    });
  });

  describe('generateExecutiveReport', () => {
    test('genera reporte ejecutivo completo', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"title":"Reporte Mensual","subtitle":"Julio 2026","executiveSummary":{"overview":"Crecimiento sostenido","highlights":["Volumen +15%","Eficiencia +5%"],"concerns":["Costos subieron"],"outlook":"Positivo"},"keyMetrics":[{"name":"Volumen","value":"150","change":"+15%","trend":"up","status":"good","interpretation":"Crecimiento fuerte"}],"sections":[{"title":"Operaciones","content":"Análisis operativo","metrics":[],"charts":[{"type":"line","title":"Tendencia","description":"Volumen mensual","dataKeys":["volume"]}],"insights":["Insight 1"]}],"comparativeAnalysis":{"vsLastPeriod":{"summary":"Mejora general","improvements":["Eficiencia"],"declines":[]},"vsTarget":{"summary":"Por encima","achieved":["Volumen"],"missed":[]}},"strategicRecommendations":[{"priority":1,"area":"Automation","recommendation":"Automatizar proceso X","rationale":"Reduce tiempo 30%","expectedImpact":"HIGH","timeline":"Q3 2026","resources":"2 dev"}],"riskAssessment":{"overallRisk":"LOW","risks":[{"risk":"Disponibilidad","likelihood":"LOW","impact":"MEDIUM","mitigation":"Backup"}]},"nextSteps":[{"action":"Implementar","owner":"IT","deadline":"2026-09-01","priority":"HIGH"}],"appendix":{"methodology":"Análisis cuantitativo","dataSources":["ERP","Analytics"],"definitions":{"Eficiencia":"Tiempo/unidad"}}}\n```',
        tokensUsed: 600
      });

      const analyticsData = {
        volume: 150,
        efficiency: 95,
        revenue: 50000
      };

      const options = {
        period: 'Julio 2026',
        audience: 'Dirección',
        focus: 'Operaciones',
        includeComparison: true,
        language: 'es'
      };

      const result = await aiService.generateExecutiveReport(analyticsData, options);

      expect(result.title).toBe('Reporte Mensual');
      expect(result.subtitle).toBe('Julio 2026');
      expect(result.executiveSummary.overview).toBeTruthy();
      expect(result.executiveSummary.highlights).toHaveLength(2);
      expect(result.keyMetrics).toHaveLength(1);
      expect(result.sections).toHaveLength(1);
      expect(result.comparativeAnalysis.vsLastPeriod.improvements).toHaveLength(1);
      expect(result.strategicRecommendations).toHaveLength(1);
      expect(result.riskAssessment.overallRisk).toBe('LOW');
      expect(result.nextSteps).toHaveLength(1);
      expect(result.appendix.methodology).toBeTruthy();
      expect(result.model).toBe('opus-4');
      expect(result.generatedAt).toBeDefined();
    });

    test('procesa sin bloque JSON', async () => {
      claudeSpy.mockResolvedValue({
        content: '{"title":"Reporte","executiveSummary":{"overview":"Ok"},"keyMetrics":[],"sections":[]}',
        tokensUsed: 50
      });

      const result = await aiService.generateExecutiveReport({ data: 1 });

      expect(result.title).toBe('Reporte');
      expect(result.executiveSummary.overview).toBe('Ok');
    });

    test('maneja JSON inválido con fallback', async () => {
      claudeSpy.mockResolvedValue({
        content: 'Error al generar reporte',
        tokensUsed: 10
      });

      const result = await aiService.generateExecutiveReport({});

      expect(result.title).toBe('Reporte Ejecutivo');
      expect(result.executiveSummary.overview).toBe('Error al generar reporte');
      expect(result.keyMetrics).toEqual([]);
      expect(result.sections).toEqual([]);
      expect(result.rawResponse).toBe('Error al generar reporte');
    });

    test('maneja options sin campos', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"title":"Default"}\n```',
        tokensUsed: 5
      });

      const result = await aiService.generateExecutiveReport({ x: 1 });

      expect(claudeSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.stringContaining('Último mes'),
        expect.any(Object)
      );
    });
  });

  describe('analyzeKPIDeviations', () => {
    test('analiza desviaciones con todos los campos', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"overallPerformance":{"score":65,"status":"AT_RISK","summary":"Algunos KPIs desviados"},"deviations":[{"kpiId":"k1","kpiName":"Tiempo despacho","currentValue":48,"targetValue":24,"deviation":"100%","deviationType":"above","severity":"HIGH","trend":"worsening","rootCauses":[{"cause":"Carga alta","confidence":80,"evidence":"Backlog +50%","controllable":true}],"relatedKPIs":["k2"],"businessImpact":{"area":"Operaciones","description":"Retrasos","financialImpact":"5000 EUR/mes"},"correctiveActions":[{"action":"Contratar personal","owner":"HR","deadline":"2026-09-01","expectedRecovery":"50%","effort":"HIGH","priority":1}],"estimatedRecoveryTime":"2 meses"}],"kpiInterdependencies":[{"primaryKPI":"k1","dependentKPIs":["k2","k3"],"relationship":"Cascada","cascadeRisk":"Alto"}],"quickWins":[{"action":"Optimizar cola","kpisAffected":["k1"],"effort":"LOW","impact":"MEDIUM","timeline":"1 semana"}],"strategicInitiatives":[{"initiative":"Automatización","objective":"Reducir tiempo 50%","kpisTargeted":["k1"],"timeline":"Q4 2026","investmentRequired":"20K EUR"}],"monitoringPlan":{"reviewFrequency":"Semanal","escalationThresholds":{"k1":72},"keyMilestones":["Review Q3"]}}\n```',
        tokensUsed: 500
      });

      const kpiData = {
        k1: { name: 'Tiempo despacho', current: 48 }
      };

      const targets = {
        k1: 24
      };

      const result = await aiService.analyzeKPIDeviations(kpiData, targets);

      expect(result.overallPerformance.score).toBe(65);
      expect(result.overallPerformance.status).toBe('AT_RISK');
      expect(result.deviations).toHaveLength(1);
      expect(result.deviations[0].severity).toBe('HIGH');
      expect(result.deviations[0].rootCauses).toHaveLength(1);
      expect(result.deviations[0].correctiveActions).toHaveLength(1);
      expect(result.kpiInterdependencies).toHaveLength(1);
      expect(result.quickWins).toHaveLength(1);
      expect(result.strategicInitiatives).toHaveLength(1);
      expect(result.monitoringPlan.reviewFrequency).toBe('Semanal');
      expect(result.model).toBe('sonnet-4');
      expect(result.analyzedAt).toBeDefined();
    });

    test('procesa sin bloque JSON', async () => {
      claudeSpy.mockResolvedValue({
        content: '{"overallPerformance":{"score":80,"status":"ON_TRACK"},"deviations":[],"quickWins":[]}',
        tokensUsed: 30
      });

      const result = await aiService.analyzeKPIDeviations({ k1: 10 }, { k1: 10 });

      expect(result.overallPerformance.status).toBe('ON_TRACK');
      expect(result.deviations).toEqual([]);
    });

    test('maneja JSON inválido con fallback', async () => {
      claudeSpy.mockResolvedValue({
        content: 'Error en análisis',
        tokensUsed: 10
      });

      const result = await aiService.analyzeKPIDeviations({}, {});

      expect(result.overallPerformance.score).toBe(0);
      expect(result.overallPerformance.status).toBe('UNKNOWN');
      expect(result.deviations).toEqual([]);
      expect(result.quickWins).toEqual([]);
      expect(result.rawResponse).toBe('Error en análisis');
    });

    test('maneja targets vacío', async () => {
      claudeSpy.mockResolvedValue({
        content: '```json\n{"overallPerformance":{"score":50}}\n```',
        tokensUsed: 5
      });

      const result = await aiService.analyzeKPIDeviations({ x: 1 });

      expect(claudeSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.stringContaining('OBJETIVOS/TARGETS'),
        expect.any(Object)
      );
    });
  });

  describe('fullAnalyticsAnalysis', () => {
    test('ejecuta análisis completo en paralelo con todas las métricas', async () => {
      claudeSpy
        .mockResolvedValueOnce({
          content: '```json\n{"executiveSummary":"Ok","keyInsights":[{"priority":1}],"trends":{"positive":[]},"anomalies":[],"opportunities":[],"risks":[{"risk":"X","probability":"HIGH","impact":"HIGH","mitigation":"Y"}],"recommendations":[{"priority":2}]}\n```',
          tokensUsed: 100
        })
        .mockResolvedValueOnce({
          content: '```json\n{"anomaliesDetected":true,"anomalyCount":2,"anomalies":[{"severity":"CRITICAL","metric":"m1","description":"Desc1","recommendedActions":[{"action":"Fix"}]},{"severity":"HIGH","metric":"m2","description":"Desc2"}],"summary":{"criticalCount":1,"highCount":1,"mediumCount":0}}\n```',
          tokensUsed: 150
        })
        .mockResolvedValueOnce({
          content: '```json\n{"predictions":[],"modelConfidence":70}\n```',
          tokensUsed: 50
        });

      const analyticsData = {
        metrics: { volume: 100, efficiency: 90 },
        historical: [100, 105, 102]
      };

      const options = {
        thresholds: { volume: 120 },
        horizon: 20
      };

      const result = await aiService.fullAnalyticsAnalysis(analyticsData, options);

      expect(result.insights).toBeDefined();
      expect(result.anomalies).toBeDefined();
      expect(result.trends).toBeDefined();
      expect(result.summary.healthScore).toBeLessThan(100);
      // healthScore = 100 - 1*20 - 1*10 = 70
      expect(result.summary.healthScore).toBe(70);
      expect(result.summary.healthStatus).toBe('WARNING');
      expect(result.summary.totalInsights).toBe(1);
      expect(result.summary.totalAnomalies).toBe(2);
      expect(result.consolidatedAlerts).toHaveLength(3);
      expect(result.consolidatedAlerts[0].type).toBe('anomaly');
      expect(result.consolidatedAlerts[2].type).toBe('risk');
      expect(result.topPriorities).toBeDefined();
      expect(result.analyzedAt).toBeDefined();
    });

    test('calcula healthScore con múltiples anomalías', async () => {
      claudeSpy
        .mockResolvedValueOnce({
          content: '```json\n{"keyInsights":[],"risks":[]}\n```',
          tokensUsed: 20
        })
        .mockResolvedValueOnce({
          content: '```json\n{"anomaliesDetected":true,"anomalyCount":5,"anomalies":[],"summary":{"criticalCount":2,"highCount":2,"mediumCount":1}}\n```',
          tokensUsed: 30
        })
        .mockResolvedValueOnce({
          content: '```json\n{"predictions":[]}\n```',
          tokensUsed: 10
        });

      const result = await aiService.fullAnalyticsAnalysis({});

      // 100 - 2*20 - 2*10 - 1*5 = 100 - 40 - 20 - 5 = 35
      expect(result.summary.healthScore).toBe(35);
      expect(result.summary.healthStatus).toBe('CRITICAL');
    });

    test('healthScore no baja de 0', async () => {
      claudeSpy
        .mockResolvedValueOnce({
          content: '```json\n{"keyInsights":[]}\n```',
          tokensUsed: 10
        })
        .mockResolvedValueOnce({
          content: '```json\n{"anomaliesDetected":true,"anomalyCount":10,"anomalies":[],"summary":{"criticalCount":10}}\n```',
          tokensUsed: 20
        })
        .mockResolvedValueOnce({
          content: '```json\n{"predictions":[]}\n```',
          tokensUsed: 10
        });

      const result = await aiService.fullAnalyticsAnalysis({});

      expect(result.summary.healthScore).toBe(0);
      expect(result.summary.healthStatus).toBe('CRITICAL');
    });

    test('healthScore 80+ = HEALTHY', async () => {
      claudeSpy
        .mockResolvedValueOnce({
          content: '```json\n{"keyInsights":[]}\n```',
          tokensUsed: 10
        })
        .mockResolvedValueOnce({
          content: '```json\n{"anomaliesDetected":false,"anomalyCount":0,"anomalies":[]}\n```',
          tokensUsed: 10
        })
        .mockResolvedValueOnce({
          content: '```json\n{"predictions":[]}\n```',
          tokensUsed: 10
        });

      const result = await aiService.fullAnalyticsAnalysis({});

      expect(result.summary.healthScore).toBe(100);
      expect(result.summary.healthStatus).toBe('HEALTHY');
    });

    test('filtra solo anomalías CRITICAL y HIGH en consolidatedAlerts', async () => {
      claudeSpy
        .mockResolvedValueOnce({
          content: '```json\n{"keyInsights":[],"risks":[]}\n```',
          tokensUsed: 10
        })
        .mockResolvedValueOnce({
          content: '```json\n{"anomaliesDetected":true,"anomalyCount":4,"anomalies":[{"severity":"CRITICAL","description":"C1"},{"severity":"HIGH","description":"H1"},{"severity":"MEDIUM","description":"M1"},{"severity":"LOW","description":"L1"}]}\n```',
          tokensUsed: 30
        })
        .mockResolvedValueOnce({
          content: '```json\n{"predictions":[]}\n```',
          tokensUsed: 10
        });

      const result = await aiService.fullAnalyticsAnalysis({});

      const anomalyAlerts = result.consolidatedAlerts.filter(a => a.type === 'anomaly');
      expect(anomalyAlerts).toHaveLength(2);
      expect(anomalyAlerts[0].severity).toBe('CRITICAL');
      expect(anomalyAlerts[1].severity).toBe('HIGH');
    });

    test('filtra solo risks con HIGH probability o impact', async () => {
      claudeSpy
        .mockResolvedValueOnce({
          content: '```json\n{"keyInsights":[],"risks":[{"risk":"R1","probability":"HIGH","impact":"LOW"},{"risk":"R2","probability":"LOW","impact":"HIGH"},{"risk":"R3","probability":"MEDIUM","impact":"MEDIUM"}]}\n```',
          tokensUsed: 30
        })
        .mockResolvedValueOnce({
          content: '```json\n{"anomaliesDetected":false,"anomalyCount":0,"anomalies":[]}\n```',
          tokensUsed: 10
        })
        .mockResolvedValueOnce({
          content: '```json\n{"predictions":[]}\n```',
          tokensUsed: 10
        });

      const result = await aiService.fullAnalyticsAnalysis({});

      const riskAlerts = result.consolidatedAlerts.filter(a => a.type === 'risk');
      expect(riskAlerts).toHaveLength(2);
    });

    test('maneja insights y anomalies sin campos opcionales', async () => {
      claudeSpy
        .mockResolvedValueOnce({
          content: '```json\n{"keyInsights":[]}\n```',
          tokensUsed: 10
        })
        .mockResolvedValueOnce({
          content: '```json\n{"anomaliesDetected":false}\n```',
          tokensUsed: 10
        })
        .mockResolvedValueOnce({
          content: '```json\n{"predictions":[]}\n```',
          tokensUsed: 10
        });

      const result = await aiService.fullAnalyticsAnalysis({});

      expect(result.summary.totalInsights).toBe(0);
      expect(result.summary.totalAnomalies).toBe(0);
      expect(result.consolidatedAlerts).toHaveLength(0);
    });
  });

  describe('_extractTopPriorities', () => {
    test('extrae anomalías críticas con prioridad 1', () => {
      const insights = { recommendations: [], risks: [] };
      const anomalies = {
        anomalies: [
          {
            severity: 'CRITICAL',
            metric: 'error_rate',
            description: 'Errores críticos',
            recommendedActions: [{ action: 'Investigar' }]
          }
        ]
      };

      const result = aiService._extractTopPriorities(insights, anomalies);

      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe(1);
      expect(result[0].type).toBe('anomaly');
      expect(result[0].title).toContain('Anomalía crítica');
      expect(result[0].description).toContain('Errores críticos');
      expect(result[0].action).toBe('Investigar');
    });

    test('extrae recommendations con priority<=2', () => {
      const insights = {
        recommendations: [
          { priority: 1, action: 'Acción 1', rationale: 'Razón 1', expectedOutcome: 'Resultado 1' },
          { priority: 2, action: 'Acción 2', rationale: 'Razón 2', expectedOutcome: 'Resultado 2' },
          { priority: 3, action: 'Acción 3', rationale: 'Razón 3', expectedOutcome: 'Resultado 3' }
        ],
        risks: []
      };
      const anomalies = {};

      const result = aiService._extractTopPriorities(insights, anomalies);

      expect(result).toHaveLength(2);
      expect(result[0].priority).toBe(1);
      expect(result[1].priority).toBe(2);
      expect(result[0].type).toBe('recommendation');
    });

    test('extrae risks con impact=HIGH', () => {
      const insights = {
        recommendations: [],
        risks: [
          { risk: 'Riesgo 1', impact: 'HIGH', mitigation: 'Mitigación 1' },
          { risk: 'Riesgo 2', impact: 'MEDIUM', mitigation: 'Mitigación 2' }
        ]
      };
      const anomalies = {};

      const result = aiService._extractTopPriorities(insights, anomalies);

      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe(2);
      expect(result[0].type).toBe('risk');
      expect(result[0].title).toContain('Riesgo: Riesgo 1');
      expect(result[0].description).toBe('Mitigación 1');
    });

    test('ordena por prioridad ascendente y limita a 5', () => {
      const insights = {
        recommendations: [
          { priority: 5, action: 'R5' },
          { priority: 1, action: 'R1' },
          { priority: 2, action: 'R2' }
        ],
        risks: [
          { risk: 'Risk1', impact: 'HIGH', mitigation: 'M1' },
          { risk: 'Risk2', impact: 'HIGH', mitigation: 'M2' }
        ]
      };
      const anomalies = {
        anomalies: [
          { severity: 'CRITICAL', metric: 'M1', description: 'D1' },
          { severity: 'CRITICAL', metric: 'M2', description: 'D2' }
        ]
      };

      const result = aiService._extractTopPriorities(insights, anomalies);

      expect(result).toHaveLength(5);
      expect(result[0].priority).toBe(1);
      expect(result[4].priority).toBeGreaterThanOrEqual(result[3].priority);
    });

    test('maneja anomaly sin recommendedActions', () => {
      const insights = { recommendations: [], risks: [] };
      const anomalies = {
        anomalies: [
          { severity: 'CRITICAL', metric: 'M', description: 'D' }
        ]
      };

      const result = aiService._extractTopPriorities(insights, anomalies);

      expect(result[0].action).toBe('Investigar inmediatamente');
    });

    test('maneja insights sin fields opcionales', () => {
      const insights = {};
      const anomalies = {};

      const result = aiService._extractTopPriorities(insights, anomalies);

      expect(result).toEqual([]);
    });
  });
});
