/**
 * Tests para actionHandlers.js
 * Suite completa de tests para todos los handlers de acciones de workflow
 */

const mongoose = require('mongoose');
const { actionHandlers } = require('../../../src/services/workflow/actionHandlers');
const { Expedition, Deadline, Requirement, ChatMessage } = require('../../../src/models');
const { usarBaseDeDatosEnMemoria } = require('../../helpers/memoryDb');
const emailService = require('../../../src/services/emailService');
const axios = require('axios');

// Mockear fronteras de I/O (NUNCA el código bajo prueba)
jest.mock('../../../src/services/emailService');
jest.mock('axios');
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('actionHandlers', () => {
  // Base de datos real en memoria para tests honestos
  usarBaseDeDatosEnMemoria();

  beforeEach(async () => {
    // Limpiar BD y resetear mocks (jest.config.js tiene resetMocks:true)
    await Expedition.deleteMany({});
    await Deadline.deleteMany({});
    await Requirement.deleteMany({});
    await ChatMessage.deleteMany({});

    // Reinstalar implementaciones mock después del resetMocks
    emailService.sendEmail = jest.fn().mockResolvedValue({ success: true, messageId: 'mock-id-123' });
    axios.mockResolvedValue({ status: 200, data: { ok: true } });
  });

  // ==================== send_email ====================

  describe('send_email', () => {
    it('debe enviar email a un único destinatario', async () => {
      const config = {
        emailTo: 'test@example.com',
        emailSubject: 'Asunto de prueba',
        emailBody: 'Cuerpo del email',
        emailTemplate: null
      };

      const execution = {
        actionResults: [{ actionId: 'action-1' }],
        addActionLog: jest.fn()
      };

      const result = await actionHandlers.send_email(config, {}, execution);

      expect(result.sent).toBe(true);
      expect(result.recipients).toEqual(['test@example.com']);
      expect(result.messageId).toBe('mock-id-123');
      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: ['test@example.com'],
        subject: 'Asunto de prueba',
        body: 'Cuerpo del email',
        template: null
      });
      expect(execution.addActionLog).toHaveBeenCalled();
    });

    it('debe enviar email a múltiples destinatarios', async () => {
      const config = {
        emailTo: ['uno@example.com', 'dos@example.com'],
        emailSubject: 'Múltiples destinatarios',
        emailBody: 'Texto',
        emailTemplate: null
      };

      const execution = {
        actionResults: [{ actionId: 'action-2' }],
        addActionLog: jest.fn()
      };

      const result = await actionHandlers.send_email(config, {}, execution);

      expect(result.sent).toBe(true);
      expect(result.recipients).toEqual(['uno@example.com', 'dos@example.com']);
      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: ['uno@example.com', 'dos@example.com'],
        subject: 'Múltiples destinatarios',
        body: 'Texto',
        template: null
      });
    });

    it('debe incluir plantilla cuando se proporciona', async () => {
      const config = {
        emailTo: 'cliente@example.com',
        emailSubject: 'Con plantilla',
        emailBody: 'Texto del cuerpo',
        emailTemplate: 'declaracion_accepted'
      };

      const execution = {
        actionResults: [{ actionId: 'action-3' }],
        addActionLog: jest.fn()
      };

      await actionHandlers.send_email(config, {}, execution);

      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: ['cliente@example.com'],
        subject: 'Con plantilla',
        body: 'Texto del cuerpo',
        template: 'declaracion_accepted'
      });
    });

    /**
     * `sendEmail` no lanza cuando falla: devuelve `{success:false}`. El handler
     * devolvia `sent: true` de todas formas, y ese valor se guarda en el
     * `actionResults` de la ejecucion, asi que el historial del workflow
     * afirmaba haber avisado al cliente de un correo que nunca salio.
     */
    it.each([
      ['no hay SMTP/SES configurado', { success: false, reason: 'not_configured' }],
      ['el destinatario esta suprimido', { success: false, reason: 'suppressed' }],
      ['el envio falla', { success: false, error: 'Connection timeout' }]
    ])('no debe reportar sent:true cuando %s', async (_caso, resultadoEnvio) => {
      emailService.sendEmail = jest.fn().mockResolvedValue(resultadoEnvio);

      const execution = {
        actionResults: [{ actionId: 'action-fallo' }],
        addActionLog: jest.fn()
      };

      await expect(
        actionHandlers.send_email(
          { emailTo: 'test@example.com', emailSubject: 'Asunto', emailBody: 'Cuerpo', emailTemplate: null },
          {},
          execution
        )
      ).rejects.toThrow(/email/i);
    });
  });

  // ==================== send_notification ====================

  describe('send_notification', () => {
    it('debe enviar notificación del sistema y devolver shape correcto', async () => {
      const config = {
        notificationTitle: 'Alerta importante',
        notificationBody: 'Descripción de la notificación',
        notificationPriority: 'high'
      };

      const result = await actionHandlers.send_notification(config, {}, {});

      expect(result.sent).toBe(true);
      expect(result.title).toBe('Alerta importante');
      expect(result.priority).toBe('high');
    });

    it('debe funcionar sin prioridad explícita', async () => {
      const config = {
        notificationTitle: 'Sin prioridad',
        notificationBody: 'Cuerpo'
      };

      const result = await actionHandlers.send_notification(config, {}, {});

      expect(result.sent).toBe(true);
      expect(result.title).toBe('Sin prioridad');
      expect(result.priority).toBeUndefined();
    });
  });

  // ==================== send_portal_message ====================

  describe('send_portal_message', () => {
    it('debe crear mensaje del portal con messageContent', async () => {
      // Crear expedición real en BD
      const expedition = await Expedition.create({
        operationType: 'import',
        transportMode: 'maritime',
        client: { companyName: 'Test Co', nif: 'B12345678' },
        goods: [{ itemNumber: 1, description: 'Producto', quantity: 10, invoiceValue: 1000 }],
        tenantId: new mongoose.Types.ObjectId()
      });

      const config = {
        messageContent: 'Este es el contenido del mensaje'
      };

      const context = {
        entityId: expedition._id
      };

      const result = await actionHandlers.send_portal_message(config, context, {});

      expect(result.sent).toBe(true);
      expect(result.messageId).toBeDefined();

      // Verificar que se creó realmente en BD
      const mensaje = await ChatMessage.findById(result.messageId);
      expect(mensaje).not.toBeNull();
      expect(mensaje.content).toBe('Este es el contenido del mensaje');
      expect(mensaje.sender).toBe('luci'); // Corregido: 'system' no es válido
      expect(mensaje.senderInfo.name).toBe('LUCI (Automatico)');
      expect(mensaje.senderInfo.email).toBe('luci@strixai.es');
      expect(mensaje.messageType).toBe('system'); // Corregido: 'system_notification' no es válido
      expect(mensaje.expedition.toString()).toBe(expedition._id.toString());
    });

    it('debe usar notificationBody como fallback si no hay messageContent', async () => {
      const expedition = await Expedition.create({
        operationType: 'export',
        transportMode: 'air',
        client: { companyName: 'Test Export', nif: 'C87654321' },
        goods: [{ itemNumber: 1, description: 'Item', quantity: 5, invoiceValue: 500 }],
        tenantId: new mongoose.Types.ObjectId()
      });

      const config = {
        notificationBody: 'Fallback desde notificationBody'
      };

      const context = {
        entityId: expedition._id
      };

      const result = await actionHandlers.send_portal_message(config, context, {});

      const mensaje = await ChatMessage.findById(result.messageId);
      expect(mensaje.content).toBe('Fallback desde notificationBody');
    });

    it('debe lanzar error si no hay entityId en el contexto', async () => {
      const config = { messageContent: 'Test' };
      const context = {}; // Sin entityId

      await expect(
        actionHandlers.send_portal_message(config, context, {})
      ).rejects.toThrow('No entity ID available for portal message');
    });
  });

  // ==================== update_status ====================

  describe('update_status', () => {
    it('debe actualizar estado de una expedición', async () => {
      const expedition = await Expedition.create({
        operationType: 'import',
        transportMode: 'road',
        client: { companyName: 'Cliente Test', nif: 'D11111111' },
        goods: [{ itemNumber: 1, description: 'Mercancía', quantity: 3, invoiceValue: 300 }],
        status: 'draft', // Valor válido del enum
        tenantId: new mongoose.Types.ObjectId()
      });

      const config = { newStatus: 'pending_documents' }; // Valor válido
      const context = {
        entityType: 'expedition',
        entityId: expedition._id
      };

      const result = await actionHandlers.update_status(config, context, {});

      expect(result.previousStatus).toBe('draft');
      expect(result.newStatus).toBe('pending_documents');
      expect(result.entityId).toEqual(expedition._id);

      // Verificar actualización real en BD
      const actualizada = await Expedition.findById(expedition._id);
      expect(actualizada.status).toBe('pending_documents');
      expect(actualizada.timeline).toHaveLength(1);
      expect(actualizada.timeline[0].action).toBe('status_change');
      expect(actualizada.timeline[0].description).toContain('draft');
      expect(actualizada.timeline[0].description).toContain('pending_documents');
      expect(actualizada.timeline[0].performedBy).toBeNull(); // Corregido: null en lugar de 'workflow'
    });

    it('debe actualizar estado de un requirement', async () => {
      const expedition = await Expedition.create({
        operationType: 'import',
        transportMode: 'maritime',
        client: { companyName: 'Test', nif: 'E22222222' },
        goods: [{ itemNumber: 1, description: 'Test', quantity: 1, invoiceValue: 100 }],
        tenantId: new mongoose.Types.ObjectId()
      });

      const requirement = await Requirement.create({
        expeditionId: expedition._id,
        mrn: 'MRN123456789',
        requirementType: 'documentary',
        channel: 'orange',
        subject: 'Requerimiento de prueba',
        description: 'Descripción',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'pending',
        tenantId: expedition.tenantId
      });

      const config = { newStatus: 'in_progress' };
      const context = {
        entityType: 'requirement',
        entityId: requirement._id
      };

      const result = await actionHandlers.update_status(config, context, {});

      expect(result.previousStatus).toBe('pending');
      expect(result.newStatus).toBe('in_progress');

      const actualizado = await Requirement.findById(requirement._id);
      expect(actualizado.status).toBe('in_progress');
      expect(actualizado.timeline).toHaveLength(1);
    });

    it('debe lanzar error si no hay entityType o entityId', async () => {
      const config = { newStatus: 'nuevo' };
      const context = { entityType: 'expedition' }; // Falta entityId

      await expect(
        actionHandlers.update_status(config, context, {})
      ).rejects.toThrow('No entity context available for status update');
    });

    it('debe lanzar error si entityType es desconocido', async () => {
      const config = { newStatus: 'test' };
      const context = {
        entityType: 'tipo_inexistente',
        entityId: new mongoose.Types.ObjectId()
      };

      await expect(
        actionHandlers.update_status(config, context, {})
      ).rejects.toThrow('Unknown entity type: tipo_inexistente');
    });

    it('debe lanzar error si la entidad no existe', async () => {
      const config = { newStatus: 'test' };
      const context = {
        entityType: 'expedition',
        entityId: new mongoose.Types.ObjectId() // ID que no existe
      };

      await expect(
        actionHandlers.update_status(config, context, {})
      ).rejects.toThrow(/Entity not found/);
    });

    it('debe actualizar status incluso si no existe timeline', async () => {
      // Crear expedition sin timeline (aunque el schema lo incluye por defecto)
      const expedition = await Expedition.create({
        operationType: 'transit',
        transportMode: 'rail',
        client: { companyName: 'Sin Timeline', nif: 'F33333333' },
        goods: [{ itemNumber: 1, description: 'Item', quantity: 2, invoiceValue: 200 }],
        status: 'draft', // Válido
        tenantId: new mongoose.Types.ObjectId()
      });

      // Eliminar timeline explícitamente
      expedition.timeline = undefined;
      await expedition.save();

      const config = { newStatus: 'completed' }; // Válido
      const context = {
        entityType: 'expedition',
        entityId: expedition._id
      };

      const result = await actionHandlers.update_status(config, context, {});

      expect(result.newStatus).toBe('completed');

      // Verificar que no lanzó error
      const actualizada = await Expedition.findById(expedition._id);
      expect(actualizada.status).toBe('completed');
    });
  });

  // ==================== update_field ====================

  describe('update_field', () => {
    it('debe actualizar un campo específico de una expedición', async () => {
      const expedition = await Expedition.create({
        operationType: 'import',
        transportMode: 'maritime',
        client: { companyName: 'Test Update', nif: 'G44444444' },
        goods: [{ itemNumber: 1, description: 'Item', quantity: 1, invoiceValue: 100 }],
        priority: 'normal',
        tenantId: new mongoose.Types.ObjectId()
      });

      const config = {
        fieldPath: 'priority',
        fieldValue: 'high'
      };

      const context = {
        entityType: 'expedition',
        entityId: expedition._id
      };

      const result = await actionHandlers.update_field(config, context, {});

      expect(result.fieldPath).toBe('priority');
      expect(result.fieldValue).toBe('high');
      expect(result.updated).toBe(true);

      // Verificar actualización real
      const actualizada = await Expedition.findById(expedition._id);
      expect(actualizada.priority).toBe('high');
    });

    it('debe actualizar campos anidados con notación de punto', async () => {
      const expedition = await Expedition.create({
        operationType: 'export',
        transportMode: 'air',
        client: { companyName: 'Original', nif: 'H55555555' },
        goods: [{ itemNumber: 1, description: 'Goods', quantity: 1, invoiceValue: 100 }],
        tenantId: new mongoose.Types.ObjectId()
      });

      const config = {
        fieldPath: 'client.companyName',
        fieldValue: 'Nombre Actualizado'
      };

      const context = {
        entityType: 'expedition',
        entityId: expedition._id
      };

      await actionHandlers.update_field(config, context, {});

      const actualizada = await Expedition.findById(expedition._id);
      expect(actualizada.client.companyName).toBe('Nombre Actualizado');
    });

    it('debe lanzar error si no hay contexto de entidad', async () => {
      const config = { fieldPath: 'status', fieldValue: 'test' };
      const context = {};

      await expect(
        actionHandlers.update_field(config, context, {})
      ).rejects.toThrow('No entity context available for field update');
    });

    it('debe lanzar error si entityType es desconocido', async () => {
      const config = { fieldPath: 'status', fieldValue: 'test' };
      const context = {
        entityType: 'tipo_desconocido',
        entityId: new mongoose.Types.ObjectId()
      };

      await expect(
        actionHandlers.update_field(config, context, {})
      ).rejects.toThrow('Unknown entity type: tipo_desconocido');
    });
  });

  // ==================== add_tag ====================

  describe('add_tag', () => {
    // NOTA: El modelo Expedition NO tiene campo 'tags' en su schema actual.
    // Los handlers add_tag y remove_tag ejecutan $addToSet y $pull sobre el campo tags,
    // que Mongoose acepta pero no persiste si el campo no está definido en el schema.
    // Estos tests verifican que los handlers NO lanzan error y devuelven el shape correcto.

    it('debe ejecutar sin error aunque tags no esté en el schema', async () => {
      const expedition = await Expedition.create({
        operationType: 'import',
        transportMode: 'postal',
        client: { companyName: 'Tag Test', nif: 'J66666666' },
        goods: [{ itemNumber: 1, description: 'Item', quantity: 1, invoiceValue: 50 }],
        tenantId: new mongoose.Types.ObjectId()
      });

      const config = { tag: 'urgente' };
      const context = { entityId: expedition._id };

      const result = await actionHandlers.add_tag(config, context, {});

      expect(result.tag).toBe('urgente');
      expect(result.added).toBe(true);

      // No verificamos que el tag esté en BD porque el campo no existe en el schema
    });

    it('debe lanzar error si no hay entityId', async () => {
      const config = { tag: 'test' };
      const context = {};

      await expect(
        actionHandlers.add_tag(config, context, {})
      ).rejects.toThrow('No entity ID available');
    });
  });

  // ==================== remove_tag ====================

  describe('remove_tag', () => {
    it('debe ejecutar sin error aunque tags no esté en el schema', async () => {
      const expedition = await Expedition.create({
        operationType: 'import',
        transportMode: 'maritime',
        client: { companyName: 'Remove Test', nif: 'L88888888' },
        goods: [{ itemNumber: 1, description: 'Item', quantity: 1, invoiceValue: 100 }],
        tenantId: new mongoose.Types.ObjectId()
      });

      const config = { tag: 'urgente' };
      const context = { entityId: expedition._id };

      const result = await actionHandlers.remove_tag(config, context, {});

      expect(result.tag).toBe('urgente');
      expect(result.removed).toBe(true);
    });

    it('debe lanzar error si no hay entityId', async () => {
      const config = { tag: 'test' };
      const context = {};

      await expect(
        actionHandlers.remove_tag(config, context, {})
      ).rejects.toThrow('No entity ID available');
    });
  });

  // ==================== add_note ====================

  describe('add_note', () => {
    it('debe agregar nota al timeline de una expedición', async () => {
      const expedition = await Expedition.create({
        operationType: 'transit',
        transportMode: 'multimodal',
        client: { companyName: 'Nota Test', nif: 'N00000000' },
        goods: [{ itemNumber: 1, description: 'Item', quantity: 1, invoiceValue: 100 }],
        tenantId: new mongoose.Types.ObjectId()
      });

      const config = {
        noteContent: 'Esta es una nota importante',
        noteVisibility: 'internal'
      };

      const context = { entityId: expedition._id };

      const result = await actionHandlers.add_note(config, context, {});

      expect(result.noteAdded).toBe(true);
      expect(result.visibility).toBe('internal');

      const actualizada = await Expedition.findById(expedition._id);
      const ultimaNota = actualizada.timeline[actualizada.timeline.length - 1];
      expect(ultimaNota.action).toBe('note_added');
      expect(ultimaNota.description).toBe('Esta es una nota importante');
      expect(ultimaNota.performedBy).toBe('workflow');
      expect(ultimaNota.metadata.visibility).toBe('internal');
    });

    it('debe usar visibilidad por defecto si no se especifica', async () => {
      const expedition = await Expedition.create({
        operationType: 'import',
        transportMode: 'maritime',
        client: { companyName: 'Default Visibility', nif: 'P11111110' },
        goods: [{ itemNumber: 1, description: 'Test', quantity: 1, invoiceValue: 100 }],
        tenantId: new mongoose.Types.ObjectId()
      });

      const config = { noteContent: 'Nota sin visibilidad explícita' };
      const context = { entityId: expedition._id };

      const result = await actionHandlers.add_note(config, context, {});

      expect(result.visibility).toBeUndefined();

      const actualizada = await Expedition.findById(expedition._id);
      const nota = actualizada.timeline[actualizada.timeline.length - 1];
      expect(nota.metadata.visibility).toBe('internal');
    });

    it('debe lanzar error si no hay entityId', async () => {
      const config = { noteContent: 'Test' };
      const context = {};

      await expect(
        actionHandlers.add_note(config, context, {})
      ).rejects.toThrow('No entity ID available');
    });

    it('debe lanzar error si la expedición no existe', async () => {
      const config = { noteContent: 'Test' };
      const context = { entityId: new mongoose.Types.ObjectId() };

      await expect(
        actionHandlers.add_note(config, context, {})
      ).rejects.toThrow('Expedition not found');
    });
  });

  // ==================== create_deadline ====================

  describe('create_deadline', () => {
    it('debe crear deadline con todos los campos', async () => {
      const expedition = await Expedition.create({
        operationType: 'import',
        transportMode: 'air',
        client: { companyName: 'Deadline Test', nif: 'Q22222220' },
        goods: [{ itemNumber: 1, description: 'Item', quantity: 1, invoiceValue: 100 }],
        tenantId: new mongoose.Types.ObjectId()
      });

      const config = {
        deadlineType: 'payment_deadline', // Valor válido del enum
        deadlineDays: 10,
        deadlineTitle: 'Pago de aranceles'
      };

      const context = {
        entityId: expedition._id,
        workflow: { organizationId: new mongoose.Types.ObjectId() }
      };

      const result = await actionHandlers.create_deadline(config, context, {});

      expect(result.deadlineId).toBeDefined();
      expect(result.dueDate).toBeDefined();

      // Verificar creación en BD
      const deadline = await Deadline.findById(result.deadlineId);
      expect(deadline).not.toBeNull();
      expect(deadline.deadlineType).toBe('payment_deadline');
      expect(deadline.category).toBe('other'); // El handler hardcodea 'other' (corregido del bug 'workflow')
      expect(deadline.title).toBe('Pago de aranceles');
      expect(deadline.references.expeditionId.toString()).toBe(expedition._id.toString());
      expect(deadline.status).toBe('pending');
      expect(deadline.source).toBe('automatic');

      // Verificar que dueDate es +10 días desde ahora
      const ahora = new Date();
      const esperado = new Date(ahora.getTime() + 10 * 24 * 60 * 60 * 1000);
      const diff = Math.abs(deadline.dueDate.getTime() - esperado.getTime());
      expect(diff).toBeLessThan(5000); // Tolerancia de 5 segundos
    });

    it('debe usar valores por defecto', async () => {
      const expedition = await Expedition.create({
        operationType: 'export',
        transportMode: 'road',
        client: { companyName: 'Default Deadline', nif: 'R33333330' },
        goods: [{ itemNumber: 1, description: 'Test', quantity: 1, invoiceValue: 100 }],
        tenantId: new mongoose.Types.ObjectId()
      });

      const config = {}; // Sin config explícita
      const context = { entityId: expedition._id };

      const result = await actionHandlers.create_deadline(config, context, {});

      const deadline = await Deadline.findById(result.deadlineId);
      expect(deadline.deadlineType).toBe('other'); // Default del handler ('other' es válido en el enum)
      expect(deadline.category).toBe('other'); // 'workflow' era inválido; corregido a 'other'
      expect(deadline.title).toBe('Deadline creado por workflow');

      // Verificar 7 días por defecto
      const ahora = new Date();
      const esperado = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
      const diff = Math.abs(deadline.dueDate.getTime() - esperado.getTime());
      expect(diff).toBeLessThan(5000);
    });
  });

  // ==================== call_webhook ====================

  describe('call_webhook', () => {
    it('debe llamar webhook con método POST', async () => {
      axios.mockResolvedValueOnce({ status: 200, data: { success: true, received: 'ok' } });

      const config = {
        webhookUrl: 'https://api.example.com/webhook',
        webhookMethod: 'POST',
        webhookHeaders: { 'X-Custom': 'header-value' },
        webhookBody: { custom: 'data' },
        webhookTimeout: 5000
      };

      const context = {
        trigger: { event: 'declaration_accepted' },
        entityType: 'expedition',
        entityId: new mongoose.Types.ObjectId(),
        entity: { expeditionId: 'EXP-123' }
      };

      const execution = {
        executionId: 'exec-456',
        actionResults: [{ actionId: 'webhook-1' }],
        addActionLog: jest.fn()
      };

      const result = await actionHandlers.call_webhook(config, context, execution);

      expect(result.statusCode).toBe(200);
      expect(result.responseData).toEqual({ success: true, received: 'ok' });

      expect(axios).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://api.example.com/webhook',
        headers: {
          'Content-Type': 'application/json',
          'X-Workflow-Execution': 'exec-456',
          'X-Custom': 'header-value'
        },
        data: { custom: 'data' },
        timeout: 5000
      });

      expect(execution.addActionLog).toHaveBeenCalled();
    });

    it('debe usar cuerpo por defecto si no se proporciona webhookBody', async () => {
      axios.mockResolvedValueOnce({ status: 200, data: {} });

      const config = {
        webhookUrl: 'https://api.example.com/default',
        webhookMethod: 'POST'
      };

      const context = {
        trigger: { event: 'test_event' },
        entityType: 'expedition',
        entityId: new mongoose.Types.ObjectId(),
        entity: { data: 'test' }
      };

      const execution = {
        executionId: 'exec-789',
        actionResults: [{ actionId: 'webhook-2' }],
        addActionLog: jest.fn()
      };

      await actionHandlers.call_webhook(config, context, execution);

      const llamada = axios.mock.calls[0][0];
      expect(llamada.data.event).toBe('test_event');
      expect(llamada.data.entityType).toBe('expedition');
      expect(llamada.data.timestamp).toBeDefined();
    });

    it('debe usar valores por defecto para método y timeout', async () => {
      axios.mockResolvedValueOnce({ status: 200, data: {} });

      const config = {
        webhookUrl: 'https://api.example.com/defaults'
      };

      const execution = {
        actionResults: [{ actionId: 'webhook-3' }],
        addActionLog: jest.fn()
      };

      await actionHandlers.call_webhook(config, {}, execution);

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          timeout: 30000
        })
      );
    });

    it('debe lanzar error si no hay webhookUrl', async () => {
      const config = {};
      const execution = {
        actionResults: [{ actionId: 'webhook-fail' }],
        addActionLog: jest.fn()
      };

      await expect(
        actionHandlers.call_webhook(config, {}, execution)
      ).rejects.toThrow('Webhook URL is required');
    });

    it('debe propagar errores de red', async () => {
      axios.mockRejectedValueOnce(new Error('Network timeout'));

      const config = { webhookUrl: 'https://api.example.com/fail' };
      const execution = {
        actionResults: [{ actionId: 'webhook-error' }],
        addActionLog: jest.fn()
      };

      await expect(
        actionHandlers.call_webhook(config, {}, execution)
      ).rejects.toThrow('Network timeout');
    });
  });

  // ==================== call_api ====================

  describe('call_api', () => {
    it('debe llamar API con método GET', async () => {
      axios.mockResolvedValueOnce({ status: 200, data: { result: 'success' } });

      const config = {
        apiUrl: 'https://api.example.com/data',
        apiMethod: 'GET',
        apiHeaders: { 'Authorization': 'Bearer token123' },
        apiTimeout: 10000
      };

      const result = await actionHandlers.call_api(config, {}, {});

      expect(result.statusCode).toBe(200);
      expect(result.data).toEqual({ result: 'success' });

      expect(axios).toHaveBeenCalledWith({
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: { 'Authorization': 'Bearer token123' },
        data: undefined,
        timeout: 10000
      });
    });

    it('debe llamar API con método POST y cuerpo', async () => {
      axios.mockResolvedValueOnce({ status: 201, data: { id: 123 } });

      const config = {
        apiUrl: 'https://api.example.com/create',
        apiMethod: 'POST',
        apiBody: { name: 'Test', value: 42 },
        apiTimeout: 5000
      };

      const result = await actionHandlers.call_api(config, {}, {});

      expect(result.statusCode).toBe(201);
      expect(result.data).toEqual({ id: 123 });

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: { name: 'Test', value: 42 }
        })
      );
    });

    it('debe usar valores por defecto', async () => {
      axios.mockResolvedValueOnce({ status: 200, data: {} });

      const config = {
        apiUrl: 'https://api.example.com/default'
      };

      await actionHandlers.call_api(config, {}, {});

      expect(axios).toHaveBeenCalledWith({
        method: 'GET',
        url: 'https://api.example.com/default',
        headers: {},
        data: undefined,
        timeout: 30000
      });
    });
  });

  // ==================== wait ====================

  describe('wait', () => {
    it('debe esperar el tiempo especificado', async () => {
      const config = { waitSeconds: 0.1 }; // 100ms para que el test sea rápido

      const execution = {
        actionResults: [{ actionId: 'wait-1' }],
        addActionLog: jest.fn()
      };

      const inicio = Date.now();
      const result = await actionHandlers.wait(config, {}, execution);
      const duracion = Date.now() - inicio;

      expect(result.waited).toBe(0.1);
      expect(duracion).toBeGreaterThanOrEqual(90); // Tolerancia
      expect(duracion).toBeLessThan(200);
      expect(execution.addActionLog).toHaveBeenCalledWith(
        'wait-1',
        'info',
        'Waiting 0.1 seconds'
      );
    });

    it('debe retornar inmediatamente si waitSeconds es 0', async () => {
      const config = { waitSeconds: 0 };

      const execution = {
        actionResults: [{ actionId: 'wait-2' }],
        addActionLog: jest.fn()
      };

      const inicio = Date.now();
      const result = await actionHandlers.wait(config, {}, execution);
      const duracion = Date.now() - inicio;

      expect(result.waited).toBe(0);
      expect(duracion).toBeLessThan(50);
      expect(execution.addActionLog).not.toHaveBeenCalled();
    });

    it('debe retornar inmediatamente si no hay waitSeconds', async () => {
      const config = {};

      const execution = {
        actionResults: [{ actionId: 'wait-3' }],
        addActionLog: jest.fn()
      };

      const result = await actionHandlers.wait(config, {}, execution);

      expect(result.waited).toBeUndefined();
      expect(execution.addActionLog).not.toHaveBeenCalled();
    });
  });

  // run_ml_prediction, generate_recommendation y trigger_workflow se cubren en
  // actionHandlers.ml.test.js: cargan sus dependencias por require() dinámico
  // (../ml, ../../models, ./workflowEngine) y se prueban con mocks estáticos SIN
  // Mongo real, evitando el cuelgue de jest.doMock + conexión Mongoose persistente.
});
