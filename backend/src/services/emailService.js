/**
 * Servicio de Email - Notificaciones via Nodemailer
 */

const nodemailer = require('nodemailer');
const logger = require('../config/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.fromAddress = process.env.EMAIL_FROM || 'LUCI Aduanas <noreply@luci-customs.com>';
    this.initialized = false;
  }

  /**
   * Inicializar transporter
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Verificar configuracion
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
        logger.warn('Email service no configurado - emails no se enviaran');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      // Verificar conexion
      await this.transporter.verify();
      this.initialized = true;
      logger.info('Email service inicializado correctamente');

    } catch (error) {
      logger.error('Error inicializando email service:', error.message);
    }
  }

  /**
   * Enviar email
   */
  async sendEmail(to, subject, html, text = null) {
    await this.initialize();

    if (!this.transporter) {
      logger.warn(`Email no enviado (no configurado): ${to} - ${subject}`);
      return { success: false, reason: 'not_configured' };
    }

    try {
      const result = await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        html,
        text: text || this.htmlToText(html)
      });

      logger.info(`Email enviado: ${to} - ${subject}`);
      return { success: true, messageId: result.messageId };

    } catch (error) {
      logger.error(`Error enviando email a ${to}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enviar link del portal al cliente
   */
  async sendPortalLink(email, companyName, portalUrl, expeditionId, operationType) {
    const opType = operationType === 'import' ? 'importacion' : 'exportacion';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a365d; color: white; padding: 20px; text-align: center; }
    .header h1 { margin: 0; }
    .content { padding: 20px; background: #f7fafc; }
    .button { display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #718096; }
    .highlight { background: #ebf8ff; padding: 15px; border-left: 4px solid #3182ce; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>LUCI - STRIX AI</h1>
    </div>
    <div class="content">
      <p>Estimado/a <strong>${companyName}</strong>,</p>

      <p>Le informamos que hemos iniciado el tramite de <strong>${opType}</strong> para su expediente <strong>${expeditionId}</strong>.</p>

      <div class="highlight">
        <p><strong>Para completar el despacho aduanero, necesitamos que nos facilite la documentacion requerida.</strong></p>
        <p>Hemos preparado un portal personalizado donde podra:</p>
        <ul>
          <li>Ver el listado de documentos necesarios</li>
          <li>Subir los documentos de forma segura</li>
          <li>Consultar el estado de su tramite</li>
          <li>Chatear con LUCI, nuestro asistente virtual</li>
        </ul>
      </div>

      <p style="text-align: center;">
        <a href="${portalUrl}" class="button">Acceder al Portal de Documentacion</a>
      </p>

      <p><strong>Link de acceso:</strong><br>
      <a href="${portalUrl}">${portalUrl}</a></p>

      <p>Este enlace es unico para su operacion y puede compartirlo con las personas de su organizacion que necesiten subir documentos.</p>

      <p>Si tiene alguna duda, puede usar el chat del portal o contactarnos directamente.</p>

      <p>Saludos cordiales,<br>
      <strong>Equipo de Aduanas - STRIX AI</strong></p>
    </div>
    <div class="footer">
      <p>Este email ha sido enviado automaticamente por LUCI, el agente aduanero inteligente de STRIX AI.</p>
      <p>STRIX AI | Comercio Exterior</p>
    </div>
  </div>
</body>
</html>`;

    return this.sendEmail(
      email,
      `[${expeditionId}] Documentacion requerida para ${opType}`,
      html
    );
  }

  /**
   * Notificar documento recibido
   */
  async sendDocumentReceivedNotification(agentEmail, expeditionId, documentType, clientName) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; }
    .container { max-width: 500px; margin: 0 auto; padding: 20px; }
    .alert { background: #c6f6d5; border-left: 4px solid #38a169; padding: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="alert">
      <h3>Nuevo documento recibido</h3>
      <p><strong>Expediente:</strong> ${expeditionId}</p>
      <p><strong>Cliente:</strong> ${clientName}</p>
      <p><strong>Documento:</strong> ${documentType}</p>
    </div>
    <p>Acceda al dashboard de LUCI para revisar el documento.</p>
  </div>
</body>
</html>`;

    return this.sendEmail(
      agentEmail,
      `[${expeditionId}] Nuevo documento: ${documentType}`,
      html
    );
  }

  /**
   * Notificar declaracion lista
   */
  async sendDeclarationReadyNotification(email, expeditionId, declarationType) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; }
    .container { max-width: 500px; margin: 0 auto; padding: 20px; }
    .alert { background: #bee3f8; border-left: 4px solid #3182ce; padding: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="alert">
      <h3>Declaracion ${declarationType} lista para revision</h3>
      <p><strong>Expediente:</strong> ${expeditionId}</p>
      <p>La declaracion ha sido generada automaticamente y esta pendiente de su aprobacion.</p>
    </div>
    <p>Acceda al dashboard de LUCI para revisar y enviar la declaracion.</p>
  </div>
</body>
</html>`;

    return this.sendEmail(
      email,
      `[${expeditionId}] Declaracion ${declarationType} lista para aprobacion`,
      html
    );
  }

  /**
   * Notificar cambio de canal (naranja/rojo)
   */
  async sendChannelNotification(email, expeditionId, channel, mrn) {
    const channelInfo = {
      orange: { color: '#ed8936', name: 'NARANJA', desc: 'revision documental' },
      red: { color: '#e53e3e', name: 'ROJO', desc: 'inspeccion fisica' }
    };

    const info = channelInfo[channel];
    if (!info) return;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; }
    .container { max-width: 500px; margin: 0 auto; padding: 20px; }
    .alert { background: #fffaf0; border-left: 4px solid ${info.color}; padding: 15px; }
    .channel { color: ${info.color}; font-weight: bold; font-size: 18px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="alert">
      <h3>Declaracion asignada a circuito <span class="channel">${info.name}</span></h3>
      <p><strong>Expediente:</strong> ${expeditionId}</p>
      <p><strong>MRN:</strong> ${mrn}</p>
      <p>La declaracion ha sido seleccionada para ${info.desc}.</p>
    </div>
    <p>Le mantendremos informado sobre el resultado.</p>
  </div>
</body>
</html>`;

    return this.sendEmail(
      email,
      `[${expeditionId}] Circuito ${info.name} - ${mrn}`,
      html
    );
  }

  /**
   * Email de bienvenida al registrarse
   */
  async sendWelcomeEmail(email, name, companyName) {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
      .container{max-width:600px;margin:0 auto;padding:20px}
      .header{background:#0284c7;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0}
      .header h1{margin:0}
      .content{padding:20px;background:#f7fafc}
      .highlight{background:#ebf8ff;padding:15px;border-left:4px solid #0284c7;margin:15px 0}
      .footer{padding:20px;text-align:center;font-size:12px;color:#718096}
    </style></head><body><div class="container">
      <div class="header"><h1>LUCI - STRIX AI</h1><p>Bienvenido a bordo</p></div>
      <div class="content">
        <p>Hola <strong>${name}</strong>,</p>
        <p>Tu cuenta para <strong>${companyName}</strong> ha sido creada exitosamente en LUCI, el agente aduanero inteligente.</p>
        <div class="highlight">
          <p><strong>Tu plan actual: Starter (gratuito)</strong></p>
          <ul><li>Hasta 5 usuarios</li><li>100 declaraciones/mes</li><li>Asistente IA incluido</li></ul>
        </div>
        <p>Ya puedes iniciar sesion y comenzar a gestionar tus operaciones aduaneras.</p>
        <p>Saludos cordiales,<br><strong>Equipo LUCI - STRIX AI</strong></p>
      </div>
      <div class="footer"><p>STRIX AI SL | Agente Aduanero Inteligente</p></div>
    </div></body></html>`;
    return this.sendEmail(email, 'Bienvenido a LUCI - Tu cuenta esta lista', html);
  }

  /**
   * Email de reset de contrasena
   */
  async sendPasswordResetEmail(email, name, resetUrl) {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
      .container{max-width:600px;margin:0 auto;padding:20px}
      .header{background:#0284c7;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0}
      .header h1{margin:0}
      .content{padding:20px;background:#f7fafc}
      .button{display:inline-block;background:#0284c7;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;margin:20px 0}
      .warning{background:#fffaf0;padding:15px;border-left:4px solid #ed8936;margin:15px 0}
      .footer{padding:20px;text-align:center;font-size:12px;color:#718096}
    </style></head><body><div class="container">
      <div class="header"><h1>LUCI - STRIX AI</h1></div>
      <div class="content">
        <p>Hola <strong>${name}</strong>,</p>
        <p>Hemos recibido una solicitud para restablecer tu contrasena.</p>
        <p style="text-align:center"><a href="${resetUrl}" class="button">Restablecer Contrasena</a></p>
        <div class="warning">
          <p><strong>Este enlace expira en 1 hora.</strong></p>
          <p>Si no solicitaste este cambio, puedes ignorar este email.</p>
        </div>
        <p>Saludos cordiales,<br><strong>Equipo LUCI - STRIX AI</strong></p>
      </div>
      <div class="footer"><p>STRIX AI SL | Agente Aduanero Inteligente</p></div>
    </div></body></html>`;
    return this.sendEmail(email, 'Restablecer contrasena - LUCI', html);
  }

  /**
   * Convertir HTML basico a texto plano
   */
  htmlToText(html) {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = new EmailService();
