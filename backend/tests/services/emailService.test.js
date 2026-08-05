/**
 * emailService: suite completa de tests
 *
 * El servicio gestiona envío de emails transaccionales vía SES o SMTP.
 * Fronteras mockeadas: nodemailer transport, logger, suppressionService, AWS SES.
 * El servicio real se carga y ejecuta toda su lógica.
 *
 * NOTA: emailService exporta un singleton (new EmailService()), por lo que se
 * inicializa UNA SOLA VEZ al cargarse el módulo. Los tests de inicialización
 * verifican el comportamiento del constructor, y los tests funcionales usan
 * el servicio ya inicializado.
 */

// Mock de logger (frontera externa)
jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock de suppressionService (frontera externa, opcional)
jest.mock('../../src/services/suppressionService', () => ({
  isSuppressed: jest.fn()
}));

// Mock de nodemailer (frontera externa)
const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({
  sendMail: mockSendMail
}));

jest.mock('nodemailer', () => ({
  createTransport: mockCreateTransport
}));

// Mock de AWS SES SDK (frontera externa)
const mockSend = jest.fn();
const mockSESClient = jest.fn(function() {
  this.send = mockSend;
});

jest.mock('@aws-sdk/client-ses', () => ({
  SESClient: mockSESClient,
  SendEmailCommand: jest.fn(function(params) {
    return params;
  }),
  SendRawEmailCommand: jest.fn(function(params) {
    return params;
  })
}));

// Configurar entorno ANTES de cargar el servicio
process.env.SMTP_HOST = 'smtp.example.com';
process.env.SMTP_USER = 'user@example.com';
process.env.SMTP_PASS = 'password';
process.env.SMTP_PORT = '587';
process.env.JWT_SECRET = 'test-secret-for-unsubscribe';
process.env.FRONTEND_URL = 'https://test.luci.es';

// Cargar el servicio UNA VEZ (es singleton)
const emailService = require('../../src/services/emailService');
const logger = require('../../src/config/logger');
const suppressionService = require('../../src/services/suppressionService');

// Helper para decodificar contenido HTML del mensaje raw
function decodeHtmlFromRaw(raw) {
  // El HTML está en la segunda parte base64 (después del text/html)
  const htmlMatch = raw.match(/Content-Type: text\/html[^\r\n]*\r\nContent-Transfer-Encoding: base64\r\n\r\n([\s\S]+?)\r\n------/);
  if (htmlMatch) {
    return Buffer.from(htmlMatch[1].replace(/\r\n/g, ''), 'base64').toString('utf8');
  }
  // Si no hay HTML, buscar text/plain
  const textMatch = raw.match(/Content-Type: text\/plain[^\r\n]*\r\nContent-Transfer-Encoding: base64\r\n\r\n([\s\S]+?)\r\n------/);
  if (textMatch) {
    return Buffer.from(textMatch[1].replace(/\r\n/g, ''), 'base64').toString('utf8');
  }
  return raw; // fallback
}

describe('emailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });
    mockSend.mockResolvedValue({ MessageId: 'ses-message-id' });
    suppressionService.isSuppressed.mockResolvedValue(false);
  });

  describe('Verificación de inicialización del servicio', () => {
    test('servicio está correctamente inicializado con SMTP', () => {
      expect(emailService.smtpTransport).toBeDefined();
      expect(emailService.smtpTransport.sendMail).toBeDefined();
      expect(emailService.fromEmail).toBeDefined();
      expect(emailService.appUrl).toBe('https://test.luci.es');
    });

    test('propiedades del servicio tienen valores correctos', () => {
      // Verificar configuración del servicio
      expect(emailService.appUrl).toBe('https://test.luci.es');
      expect(typeof emailService.fromEmail).toBe('string');
      expect(emailService.fromEmail.length).toBeGreaterThan(0);
    });
  });

  describe('sendEmail - envío básico vía SMTP', () => {
    test('envía email con sintaxis de 3 parámetros (to, subject, html)', async () => {
      const result = await emailService.sendEmail(
        'test@example.com',
        'Test Subject',
        '<p>Test HTML</p>'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockSendMail).toHaveBeenCalledWith({
        raw: expect.any(String),
        envelope: {
          from: expect.any(String),
          to: ['test@example.com']
        }
      });
    });

    test('envía email con sintaxis de objeto {to, subject, html, text}', async () => {
      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test plain text'
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockSendMail).toHaveBeenCalled();
    });

    test('soporta array de destinatarios', async () => {
      const result = await emailService.sendEmail(
        ['test1@example.com', 'test2@example.com'],
        'Test Subject',
        '<p>Test HTML</p>'
      );

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith({
        raw: expect.any(String),
        envelope: {
          from: expect.any(String),
          to: ['test1@example.com', 'test2@example.com']
        }
      });
    });

    test('usa subject como texto plano si no hay html ni text', async () => {
      const result = await emailService.sendEmail(
        'test@example.com',
        'Just a subject',
        null
      );

      expect(result.success).toBe(true);
      // Verificar que el mensaje raw contiene el subject como texto
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      expect(rawCall).toContain('Just a subject');
    });

    test('filtra destinatarios suprimidos', async () => {
      suppressionService.isSuppressed.mockImplementation(async (email) => {
        return email === 'suppressed@example.com';
      });

      const result = await emailService.sendEmail(
        ['ok@example.com', 'suppressed@example.com'],
        'Test',
        '<p>Test</p>'
      );

      expect(result.success).toBe(true);
      expect(result.skipped).toEqual(['suppressed@example.com']);
      expect(mockSendMail).toHaveBeenCalledWith({
        raw: expect.any(String),
        envelope: {
          from: expect.any(String),
          to: ['ok@example.com']
        }
      });
    });

    test('retorna error si todos los destinatarios están suprimidos', async () => {
      suppressionService.isSuppressed.mockResolvedValue(true);

      const result = await emailService.sendEmail(
        'suppressed@example.com',
        'Test',
        '<p>Test</p>'
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('suppressed');
      expect(result.skipped).toEqual(['suppressed@example.com']);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    test('maneja errores del transport SMTP', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP connection failed'));

      const result = await emailService.sendEmail(
        'test@example.com',
        'Test',
        '<p>Test</p>'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP connection failed');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Email send error'),
        expect.any(Object)
      );
    });

    test('maneja errores del suppressionService sin bloquear envío', async () => {
      suppressionService.isSuppressed.mockRejectedValue(
        new Error('Database error')
      );

      const result = await emailService.sendEmail(
        'test@example.com',
        'Test',
        '<p>Test</p>'
      );

      // El error en suppressionService no debe impedir el envío
      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();
    });

    test('incluye destinatarios omitidos en resultado', async () => {
      suppressionService.isSuppressed.mockImplementation(async (email) => {
        return email.startsWith('blocked');
      });

      const result = await emailService.sendEmail(
        ['ok@example.com', 'blocked1@example.com', 'blocked2@example.com'],
        'Test',
        '<p>Test</p>'
      );

      expect(result.success).toBe(true);
      expect(result.skipped).toEqual(['blocked1@example.com', 'blocked2@example.com']);
    });
  });

  describe('_buildRawMessage', () => {
    test('construye mensaje MIME multipart con text y html', () => {
      const raw = emailService._buildRawMessage({
        from: 'LUCI <noreply@strixai.es>',
        to: ['test@example.com'],
        subject: 'Test Subject',
        html: '<p>HTML content</p>',
        text: 'Plain text content'
      });

      expect(raw).toContain('From: LUCI <noreply@strixai.es>');
      expect(raw).toContain('To: test@example.com');
      expect(raw).toContain('Subject: Test Subject');
      expect(raw).toContain('MIME-Version: 1.0');
      expect(raw).toContain('Content-Type: multipart/alternative');
      expect(raw).toContain('List-Unsubscribe:');
      expect(raw).toContain('List-Unsubscribe-Post: List-Unsubscribe=One-Click');
      expect(raw).toContain('text/plain; charset=UTF-8');
      expect(raw).toContain('text/html; charset=UTF-8');
    });

    test('incluye List-Unsubscribe con URL y mailto', () => {
      const raw = emailService._buildRawMessage({
        from: 'LUCI <noreply@strixai.es>',
        to: ['test@example.com'],
        subject: 'Test',
        html: '<p>Test</p>'
      });

      expect(raw).toContain('List-Unsubscribe: <mailto:unsubscribe@strixai.es');
      expect(raw).toContain('https://test.luci.es/api/email/unsubscribe?token=');
    });

    test('incluye headers de bulk email', () => {
      const raw = emailService._buildRawMessage({
        from: 'LUCI <noreply@strixai.es>',
        to: ['test@example.com'],
        subject: 'Test',
        html: '<p>Test</p>'
      });

      expect(raw).toContain('Precedence: bulk');
      expect(raw).toContain('Auto-Submitted: auto-generated');
    });

    test('maneja múltiples destinatarios en header To', () => {
      const raw = emailService._buildRawMessage({
        from: 'LUCI <noreply@strixai.es>',
        to: ['test1@example.com', 'test2@example.com'],
        subject: 'Test',
        html: '<p>Test</p>'
      });

      expect(raw).toContain('To: test1@example.com, test2@example.com');
    });

    test('codifica contenido HTML en base64 con líneas de 76 caracteres', () => {
      const longHtml = '<p>' + 'A'.repeat(200) + '</p>';
      const raw = emailService._buildRawMessage({
        from: 'LUCI <noreply@strixai.es>',
        to: ['test@example.com'],
        subject: 'Test',
        html: longHtml
      });

      expect(raw).toContain('Content-Transfer-Encoding: base64');
      // Verificar que hay saltos de línea en el base64 (líneas de 76)
      const lines = raw.split('\r\n');
      const base64Lines = lines.filter(l => /^[A-Za-z0-9+/=]{50,}$/.test(l));
      expect(base64Lines.some(l => l.length <= 76)).toBe(true);
    });

    test('omite parte text si no se proporciona', () => {
      const raw = emailService._buildRawMessage({
        from: 'LUCI <noreply@strixai.es>',
        to: ['test@example.com'],
        subject: 'Test',
        html: '<p>HTML only</p>'
      });

      // Debe tener html pero sin duplicar text/plain
      expect(raw).toContain('text/html; charset=UTF-8');
      const textPlainMatches = (raw.match(/text\/plain/g) || []).length;
      expect(textPlainMatches).toBe(0);
    });

    test('omite parte html si no se proporciona', () => {
      const raw = emailService._buildRawMessage({
        from: 'LUCI <noreply@strixai.es>',
        to: ['test@example.com'],
        subject: 'Test',
        text: 'Plain text only'
      });

      expect(raw).toContain('text/plain; charset=UTF-8');
      const textHtmlMatches = (raw.match(/text\/html/g) || []).length;
      expect(textHtmlMatches).toBe(0);
    });
  });

  describe('_encodeHeader', () => {
    test('no codifica headers ASCII simples', () => {
      const result = emailService._encodeHeader('Simple ASCII Subject');
      expect(result).toBe('Simple ASCII Subject');
    });

    test('codifica headers con caracteres no-ASCII en quoted-printable', () => {
      const result = emailService._encodeHeader('Declaración rechazada');
      expect(result).toContain('=?UTF-8?B?');
      expect(result).toContain('?=');
    });

    test('codifica emojis y caracteres Unicode', () => {
      const result = emailService._encodeHeader('Test 🚀 Emoji');
      expect(result).toContain('=?UTF-8?B?');
    });
  });

  describe('Plantillas HTML y helpers', () => {
    test('_wrapHtml envuelve contenido en plantilla corporativa', () => {
      const html = emailService._wrapHtml('<p>Content</p>');

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="es">');
      expect(html).toContain('LUCI');
      expect(html).toContain('Agente de Aduanas Inteligente');
      expect(html).toContain('STRIX AI SL');
      expect(html).toContain('<p>Content</p>');
    });

    test('_badge genera badge verde', () => {
      const badge = emailService._badge('green', 'APROBADO');

      expect(badge).toContain('#dcfce7'); // bg verde
      expect(badge).toContain('#166534'); // fg verde
      expect(badge).toContain('APROBADO');
    });

    test('_badge genera badge naranja', () => {
      const badge = emailService._badge('orange', 'PENDIENTE');

      expect(badge).toContain('#ffedd5'); // bg naranja
      expect(badge).toContain('#9a3412'); // fg naranja
      expect(badge).toContain('PENDIENTE');
    });

    test('_badge genera badge rojo', () => {
      const badge = emailService._badge('red', 'RECHAZADO');

      expect(badge).toContain('#fee2e2'); // bg rojo
      expect(badge).toContain('#991b1b'); // fg rojo
      expect(badge).toContain('RECHAZADO');
    });

    test('_badge genera badge azul', () => {
      const badge = emailService._badge('blue', 'INFO');

      expect(badge).toContain('#dbeafe'); // bg azul
      expect(badge).toContain('#1e40af'); // fg azul
      expect(badge).toContain('INFO');
    });

    test('_badge usa color gris por defecto para color desconocido', () => {
      const badge = emailService._badge('unknown', 'OTRO');

      expect(badge).toContain('#f3f4f6'); // bg gris
      expect(badge).toContain('#374151'); // fg gris
      expect(badge).toContain('OTRO');
    });
  });

  describe('sendDeclarationSubmitted', () => {
    test('envía notificación de declaración enviada', async () => {
      const result = await emailService.sendDeclarationSubmitted(
        'user@example.com',
        {
          expeditionId: 'EXP123',
          declarationType: 'H7',
          lrn: 'LRN456'
        }
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      expect(rawCall).toContain('Subject: Declaracion H7 enviada - EXP123');
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).toContain('EXP123');
      expect(decoded).toContain('H7');
      expect(decoded).toContain('LRN456');
    });

    test('maneja LRN ausente con N/A', async () => {
      const result = await emailService.sendDeclarationSubmitted(
        'user@example.com',
        {
          expeditionId: 'EXP123',
          declarationType: 'H1'
        }
      );

      expect(result.success).toBe(true);
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).toContain('N/A');
    });
  });

  describe('sendDeclarationAccepted', () => {
    test('envía notificación de declaración aceptada con canal verde', async () => {
      const result = await emailService.sendDeclarationAccepted(
        'user@example.com',
        {
          mrn: '26ES00000012345678',
          channel: 'green',
          expeditionId: 'EXP123',
          declarationType: 'H7'
        }
      );

      expect(result.success).toBe(true);
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).toContain('26ES00000012345678');
      expect(decoded).toContain('EXP123');
      expect(decoded).toContain('CANAL VERDE');
      expect(decoded).toContain('puede retirarse inmediatamente');
    });

    test('no incluye mensaje de retirada inmediata para canal naranja', async () => {
      const result = await emailService.sendDeclarationAccepted(
        'user@example.com',
        {
          mrn: '26ES00000012345678',
          channel: 'orange',
          expeditionId: 'EXP123'
        }
      );

      expect(result.success).toBe(true);
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).not.toContain('puede retirarse inmediatamente');
      expect(decoded).toContain('CANAL NARANJA');
    });

    test('usa H1 por defecto si no se especifica tipo', async () => {
      const result = await emailService.sendDeclarationAccepted(
        'user@example.com',
        {
          mrn: '26ES00000012345678',
          channel: 'green',
          expeditionId: 'EXP123'
        }
      );

      expect(result.success).toBe(true);
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).toContain('H1');
    });
  });

  describe('sendDeclarationRejected', () => {
    test('envía notificación de declaración rechazada con detalles', async () => {
      const result = await emailService.sendDeclarationRejected(
        'user@example.com',
        {
          expeditionId: 'EXP123',
          declarationType: 'H7',
          errorCode: '1180',
          errorDetails: 'Código TARIC inválido'
        }
      );

      expect(result.success).toBe(true);
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).toContain('EXP123');
      expect(decoded).toContain('1180');
      expect(decoded).toContain('TARIC inválido');
    });

    test('maneja ausencia de código de error', async () => {
      const result = await emailService.sendDeclarationRejected(
        'user@example.com',
        {
          expeditionId: 'EXP123',
          errorDetails: 'Error genérico'
        }
      );

      expect(result.success).toBe(true);
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).not.toContain('Codigo Error');
      expect(decoded).toContain('Error genérico');
    });

    test('muestra mensaje por defecto si no hay detalles', async () => {
      const result = await emailService.sendDeclarationRejected(
        'user@example.com',
        { expeditionId: 'EXP123' }
      );

      expect(result.success).toBe(true);
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).toContain('Sin detalles disponibles');
    });
  });

  describe('sendChannelAssigned', () => {
    test('envía notificación de canal naranja con instrucciones por defecto', async () => {
      const result = await emailService.sendChannelAssigned('user@example.com', {
        mrn: '26ES00000012345678',
        channel: 'orange',
        expeditionId: 'EXP123'
      });

      expect(result.success).toBe(true);
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).toContain('CANAL NARANJA');
      expect(decoded).toContain('revision documental');
      expect(decoded).toContain('factura comercial');
    });

    test('envía notificación de canal rojo con instrucciones por defecto', async () => {
      const result = await emailService.sendChannelAssigned('user@example.com', {
        mrn: '26ES00000012345678',
        channel: 'red',
        expeditionId: 'EXP123'
      });

      expect(result.success).toBe(true);
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).toContain('CANAL ROJO');
      expect(decoded).toContain('Inspeccion Fisica');
      expect(decoded).toContain('permanecera retenida');
    });

    test('usa instrucciones personalizadas si se proporcionan', async () => {
      const result = await emailService.sendChannelAssigned('user@example.com', {
        mrn: '26ES00000012345678',
        channel: 'orange',
        expeditionId: 'EXP123',
        instructions: 'Instrucciones específicas del inspector'
      });

      expect(result.success).toBe(true);
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).toContain('Instrucciones específicas del inspector');
      expect(decoded).not.toContain('factura comercial');
    });
  });

  describe('sendCorrectionRequired', () => {
    test('envía notificación de corrección con lista de correcciones', async () => {
      const result = await emailService.sendCorrectionRequired(
        'user@example.com',
        {
          mrn: '26ES00000012345678',
          expeditionId: 'EXP123',
          corrections: [
            'Corregir peso neto del artículo 2',
            'Actualizar valor estadístico'
          ],
          deadline: '2026-08-10'
        }
      );

      expect(result.success).toBe(true);
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).toContain('26ES00000012345678');
      expect(decoded).toContain('peso neto');
      expect(decoded).toContain('valor estadístico');
      expect(decoded).toContain('2026-08-10');
    });

    test('maneja ausencia de deadline', async () => {
      const result = await emailService.sendCorrectionRequired(
        'user@example.com',
        {
          mrn: '26ES00000012345678',
          expeditionId: 'EXP123',
          corrections: ['Corrección 1']
        }
      );

      expect(result.success).toBe(true);
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).not.toContain('Plazo');
    });

    test('muestra mensaje por defecto si no hay correcciones', async () => {
      const result = await emailService.sendCorrectionRequired(
        'user@example.com',
        {
          mrn: '26ES00000012345678',
          expeditionId: 'EXP123'
        }
      );

      expect(result.success).toBe(true);
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).toContain('Sin detalles');
    });
  });

  describe('sendPortalLink', () => {
    test('envía enlace de portal para importación', async () => {
      const result = await emailService.sendPortalLink(
        'client@example.com',
        'ACME Corp',
        'https://portal.luci.es/abc123',
        'EXP123',
        'import'
      );

      expect(result.success).toBe(true);
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).toContain('ACME Corp');
      expect(decoded).toContain('importacion');
      expect(decoded).toContain('EXP123');
      expect(decoded).toContain('https://portal.luci.es/abc123');
    });

    test('envía enlace de portal para exportación', async () => {
      const result = await emailService.sendPortalLink(
        'client@example.com',
        'ACME Corp',
        'https://portal.luci.es/xyz789',
        'EXP456',
        'export'
      );

      expect(result.success).toBe(true);
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).toContain('exportacion');
    });
  });

  describe('sendWelcomeEmail', () => {
    test('envía email de bienvenida', async () => {
      const result = await emailService.sendWelcomeEmail(
        'newuser@example.com',
        'Juan Pérez',
        'ACME Corp'
      );

      expect(result.success).toBe(true);
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).toContain('Bienvenido a LUCI');
      expect(decoded).toContain('Juan Pérez');
      expect(decoded).toContain('ACME Corp');
      expect(decoded).toContain('https://test.luci.es');
    });
  });

  describe('sendPasswordResetEmail', () => {
    test('envía email de reset de contraseña', async () => {
      const result = await emailService.sendPasswordResetEmail(
        'user@example.com',
        'María García',
        'https://luci.es/reset/token123'
      );

      expect(result.success).toBe(true);
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).toContain('Restablecer Contrasena');
      expect(decoded).toContain('María García');
      expect(decoded).toContain('https://luci.es/reset/token123');
      expect(decoded).toContain('expira en 1 hora');
    });
  });

  describe('sendDocumentReceivedNotification', () => {
    test('notifica recepción de documento al agente', async () => {
      const result = await emailService.sendDocumentReceivedNotification(
        'agent@strixai.es',
        'EXP123',
        'Factura Comercial',
        'ACME Corp'
      );

      expect(result.success).toBe(true);
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).toContain('Nuevo Documento Recibido');
      expect(decoded).toContain('EXP123');
      expect(decoded).toContain('Factura Comercial');
      expect(decoded).toContain('ACME Corp');
    });
  });

  describe('sendDeclarationReadyNotification', () => {
    test('notifica que declaración está lista para aprobación', async () => {
      const result = await emailService.sendDeclarationReadyNotification(
        'agent@strixai.es',
        'EXP123',
        'H7'
      );

      expect(result.success).toBe(true);
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).toContain('Declaracion Lista');
      expect(decoded).toContain('EXP123');
      expect(decoded).toContain('H7');
      expect(decoded).toContain('pendiente de aprobacion');
    });
  });

  describe('sendChannelNotification (legacy)', () => {
    test('delega en sendChannelAssigned para compatibilidad', async () => {
      const result = await emailService.sendChannelNotification(
        'user@example.com',
        'EXP123',
        'orange',
        '26ES00000012345678'
      );

      expect(result.success).toBe(true);
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).toContain('26ES00000012345678');
      expect(decoded).toContain('CANAL NARANJA');
    });
  });

  describe('sendTestEmail', () => {
    test('envía email de prueba con configuración del servicio', async () => {
      const result = await emailService.sendTestEmail('admin@strixai.es');

      expect(result.success).toBe(true);
      const rawCall = mockSendMail.mock.calls[0][0].raw;
      const decoded = decodeHtmlFromRaw(rawCall);
      expect(decoded).toContain('Test Email');
      // Verificar que incluye información de configuración
      expect(decoded).toMatch(/Region|From|Timestamp/);
    });
  });

  describe('htmlToText', () => {
    test('elimina etiquetas HTML', () => {
      const html = '<p>Texto <strong>importante</strong></p>';
      const text = emailService.htmlToText(html);

      expect(text).toBe('Texto importante');
    });

    test('elimina bloques style', () => {
      const html = '<style>body{color:red;}</style><p>Contenido</p>';
      const text = emailService.htmlToText(html);

      expect(text).toBe('Contenido');
    });

    test('normaliza espacios múltiples', () => {
      const html = '<p>Texto   con    espacios     múltiples</p>';
      const text = emailService.htmlToText(html);

      expect(text).toBe('Texto con espacios múltiples');
    });

    test('trim de espacios al inicio y final', () => {
      const html = '   <p>Contenido</p>   ';
      const text = emailService.htmlToText(html);

      expect(text).toBe('Contenido');
    });
  });

  describe('_filterSuppressed', () => {
    test('retorna todos los destinatarios si ninguno está suprimido', async () => {
      suppressionService.isSuppressed.mockResolvedValue(false);

      const result = await emailService._filterSuppressed([
        'user1@example.com',
        'user2@example.com'
      ]);

      expect(result).toEqual(['user1@example.com', 'user2@example.com']);
    });

    test('filtra destinatarios suprimidos', async () => {
      suppressionService.isSuppressed.mockImplementation(async (email) => {
        return email === 'blocked@example.com';
      });

      const result = await emailService._filterSuppressed([
        'ok@example.com',
        'blocked@example.com',
        'also-ok@example.com'
      ]);

      expect(result).toEqual(['ok@example.com', 'also-ok@example.com']);
    });

    test('incluye destinatario si suppressionService lanza error', async () => {
      suppressionService.isSuppressed.mockRejectedValue(
        new Error('Database error')
      );

      const result = await emailService._filterSuppressed(['user@example.com']);

      expect(result).toEqual(['user@example.com']);
    });

    test('retorna array vacío si todos están suprimidos', async () => {
      suppressionService.isSuppressed.mockResolvedValue(true);

      const result = await emailService._filterSuppressed([
        'blocked1@example.com',
        'blocked2@example.com'
      ]);

      expect(result).toEqual([]);
    });
  });

  describe('Envío vía SES simulado', () => {
    test('usa SES cuando sesClient está disponible', async () => {
      // Simular que el servicio tiene sesClient (aunque en realidad usa SMTP por la configuración)
      // Este test verifica la rama de código de SES
      const originalSmtpTransport = emailService.smtpTransport;
      const originalSesClient = emailService.sesClient;

      // Limpiar mock explícitamente antes de usar
      mockSend.mockClear();
      mockSend.mockResolvedValue({ MessageId: 'ses-test-id' });

      // Temporalmente simular que tiene SES y no SMTP
      emailService.smtpTransport = null;
      emailService.sesClient = { send: mockSend };

      const result = await emailService.sendEmail(
        'test@example.com',
        'Test Subject',
        '<p>Test HTML</p>'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('ses-test-id');
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Email sent:')
      );

      // Restaurar
      emailService.smtpTransport = originalSmtpTransport;
      emailService.sesClient = originalSesClient;
    });

    test('maneja errores de SES', async () => {
      const originalSmtpTransport = emailService.smtpTransport;
      const originalSesClient = emailService.sesClient;

      mockSend.mockClear();
      mockSend.mockRejectedValue(new Error('SES quota exceeded'));

      emailService.smtpTransport = null;
      emailService.sesClient = { send: mockSend };

      const result = await emailService.sendEmail(
        'test@example.com',
        'Test',
        '<p>Test</p>'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('SES quota exceeded');
      expect(logger.error).toHaveBeenCalled();

      emailService.smtpTransport = originalSmtpTransport;
      emailService.sesClient = originalSesClient;
    });
  });

  describe('Casos edge de inicialización', () => {
    test('parseAddress maneja email sin formato especial', () => {
      // Función interna parseAddress - testeada indirectamente
      // pero podemos verificar el comportamiento con fromEmail
      expect(emailService.fromEmail).toBeTruthy();
      expect(typeof emailService.fromEmail).toBe('string');
    });

    test('servicio puede operar sin sesClient ni smtpTransport', async () => {
      const originalSmtpTransport = emailService.smtpTransport;
      const originalSesClient = emailService.sesClient;

      emailService.smtpTransport = null;
      emailService.sesClient = null;

      const result = await emailService.sendEmail(
        'test@example.com',
        'Test',
        '<p>Test</p>'
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_configured');

      emailService.smtpTransport = originalSmtpTransport;
      emailService.sesClient = originalSesClient;
    });
  });
});
