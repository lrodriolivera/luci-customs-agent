/**
 * Email Service - Amazon SES + Nodemailer fallback
 * Transactional email service for LUCI Customs Agent
 */

const logger = require('../config/logger');

let SESClient, SendEmailCommand;
try {
  const ses = require('@aws-sdk/client-ses');
  SESClient = ses.SESClient;
  SendEmailCommand = ses.SendEmailCommand;
} catch (e) {
  logger.warn('AWS SES SDK not installed - email via SES unavailable');
}

const BRAND_COLOR = '#0284c7'; // bg-luci
const APP_NAME = 'LUCI';

class EmailService {
  constructor() {
    this.sesClient = null;
    this.fromEmail = process.env.SES_FROM_EMAIL || 'noreply@strixai.es';
    this.appUrl = process.env.FRONTEND_URL || 'https://aduanas.strixai.es';

    // Initialize SES if credentials available
    if (SESClient && process.env.AWS_ACCESS_KEY_ID) {
      this.sesClient = new SESClient({
        region: process.env.AWS_REGION || 'eu-west-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      });
      logger.info('Email service: SES initialized');
    } else {
      logger.warn('Email service: SES not configured, emails will be logged only');
    }
  }

  /**
   * Send email via SES
   * Supports both: sendEmail(to, subject, html) and sendEmail({to, subject, html, text})
   */
  async sendEmail(toOrObj, subject, html, text) {
    // Support old-style 3-arg call: sendEmail(to, subject, html)
    let to, emailHtml, emailText;
    if (typeof toOrObj === 'object' && toOrObj !== null && !Array.isArray(toOrObj)) {
      to = toOrObj.to;
      subject = toOrObj.subject;
      emailHtml = toOrObj.html;
      emailText = toOrObj.text;
    } else {
      to = toOrObj;
      emailHtml = html;
      emailText = text;
    }

    if (!this.sesClient) {
      logger.warn(`Email not sent (SES not configured): to=${to}, subject=${subject}`);
      return { success: false, reason: 'not_configured' };
    }

    const params = {
      Source: `${APP_NAME} <${this.fromEmail}>`,
      Destination: {
        ToAddresses: Array.isArray(to) ? to : [to]
      },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {}
      }
    };

    if (emailHtml) params.Message.Body.Html = { Data: emailHtml, Charset: 'UTF-8' };
    if (emailText) params.Message.Body.Text = { Data: emailText, Charset: 'UTF-8' };
    if (!emailHtml && !emailText) {
      params.Message.Body.Text = { Data: subject, Charset: 'UTF-8' };
    }

    try {
      const result = await this.sesClient.send(new SendEmailCommand(params));
      logger.info(`Email sent: to=${to}, subject=${subject}, messageId=${result.MessageId}`);
      return { success: true, messageId: result.MessageId };
    } catch (error) {
      logger.error(`SES send error: ${error.message}`, { to, subject });
      return { success: false, error: error.message };
    }
  }

  // --------------- HTML Layout ---------------

  _wrapHtml(content) {
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background-color:${BRAND_COLOR};padding:24px 32px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;letter-spacing:1px;">LUCI</h1>
          <p style="margin:4px 0 0;color:#bae6fd;font-size:12px;">Agente de Aduanas Inteligente</p>
        </td></tr>
        <tr><td style="padding:32px;">${content}</td></tr>
        <tr><td style="background-color:#f8f9fa;padding:16px 32px;text-align:center;border-top:1px solid #e9ecef;">
          <p style="margin:0;color:#6c757d;font-size:12px;">LUCI - Agente de Aduanas Inteligente</p>
          <p style="margin:4px 0 0;color:#adb5bd;font-size:11px;">STRIX AI SL &bull; Este email fue enviado automaticamente</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }

  _badge(color, text) {
    const colors = {
      green: { bg: '#dcfce7', fg: '#166534' },
      orange: { bg: '#ffedd5', fg: '#9a3412' },
      red: { bg: '#fee2e2', fg: '#991b1b' },
      blue: { bg: '#dbeafe', fg: '#1e40af' }
    };
    const c = colors[color] || { bg: '#f3f4f6', fg: '#374151' };
    return `<span style="display:inline-block;padding:4px 12px;border-radius:12px;background-color:${c.bg};color:${c.fg};font-weight:bold;font-size:13px;">${text}</span>`;
  }

  // --------------- Declaration Templates ---------------

  /**
   * Declaration submitted to AEAT
   */
  async sendDeclarationSubmitted(userEmail, data) {
    const { expeditionId, declarationType, lrn } = data;
    const subject = `Declaracion ${declarationType} enviada - ${expeditionId}`;
    const html = this._wrapHtml(`
      <h2 style="color:${BRAND_COLOR};margin-top:0;">Declaracion Enviada a AEAT</h2>
      <p style="color:#495057;">Su declaracion ha sido enviada correctamente a la AEAT.</p>
      <table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #dee2e6;border-radius:4px;margin:16px 0;">
        <tr style="background-color:#f8f9fa;"><td style="font-weight:bold;color:#495057;border-bottom:1px solid #dee2e6;">Expediente</td><td style="color:#212529;border-bottom:1px solid #dee2e6;">${expeditionId}</td></tr>
        <tr><td style="font-weight:bold;color:#495057;border-bottom:1px solid #dee2e6;">Tipo</td><td style="color:#212529;border-bottom:1px solid #dee2e6;">${declarationType}</td></tr>
        <tr style="background-color:#f8f9fa;"><td style="font-weight:bold;color:#495057;">LRN</td><td style="color:#212529;">${lrn || 'N/A'}</td></tr>
      </table>
      <p style="color:#6c757d;font-size:13px;">Recibira una notificacion cuando AEAT procese la declaracion.</p>
    `);
    return this.sendEmail(userEmail, subject, html, `Declaracion ${declarationType} enviada. Expediente: ${expeditionId}. LRN: ${lrn || 'N/A'}`);
  }

  /**
   * Declaration accepted with MRN and channel
   */
  async sendDeclarationAccepted(userEmail, data) {
    const { mrn, channel, expeditionId, declarationType } = data;
    const channelLabels = { green: 'CANAL VERDE - Levante autorizado', orange: 'CANAL NARANJA - Revision documental', red: 'CANAL ROJO - Inspeccion fisica' };
    const subject = `Declaracion aceptada - MRN: ${mrn}`;
    const html = this._wrapHtml(`
      <h2 style="color:#166534;margin-top:0;">Declaracion Aceptada por AEAT</h2>
      <p style="color:#495057;">Su declaracion ha sido aceptada. Detalles:</p>
      <table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #dee2e6;border-radius:4px;margin:16px 0;">
        <tr style="background-color:#f8f9fa;"><td style="font-weight:bold;color:#495057;border-bottom:1px solid #dee2e6;">MRN</td><td style="color:#212529;border-bottom:1px solid #dee2e6;font-weight:bold;">${mrn}</td></tr>
        <tr><td style="font-weight:bold;color:#495057;border-bottom:1px solid #dee2e6;">Expediente</td><td style="color:#212529;border-bottom:1px solid #dee2e6;">${expeditionId}</td></tr>
        <tr style="background-color:#f8f9fa;"><td style="font-weight:bold;color:#495057;border-bottom:1px solid #dee2e6;">Tipo</td><td style="color:#212529;border-bottom:1px solid #dee2e6;">${declarationType || 'H1'}</td></tr>
        <tr><td style="font-weight:bold;color:#495057;">Canal</td><td>${this._badge(channel, channelLabels[channel] || channel)}</td></tr>
      </table>
      ${channel === 'green' ? '<p style="color:#166534;font-weight:bold;">La mercancia puede retirarse inmediatamente.</p>' : ''}
      <div style="text-align:center;margin:24px 0;"><a href="${this.appUrl}" style="background-color:${BRAND_COLOR};color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block;">Ver en LUCI</a></div>
    `);
    return this.sendEmail(userEmail, subject, html, `Declaracion aceptada. MRN: ${mrn}. Canal: ${channel}. Expediente: ${expeditionId}`);
  }

  /**
   * Declaration rejected by AEAT
   */
  async sendDeclarationRejected(userEmail, data) {
    const { expeditionId, declarationType, errorDetails, errorCode } = data;
    const subject = `Declaracion rechazada - ${expeditionId}`;
    const html = this._wrapHtml(`
      <h2 style="color:#dc3545;margin-top:0;">Declaracion Rechazada por AEAT</h2>
      <p style="color:#495057;">La declaracion ha sido rechazada. Revise los errores y vuelva a enviar.</p>
      <table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #dee2e6;border-radius:4px;margin:16px 0;">
        <tr style="background-color:#f8f9fa;"><td style="font-weight:bold;color:#495057;border-bottom:1px solid #dee2e6;">Expediente</td><td style="color:#212529;border-bottom:1px solid #dee2e6;">${expeditionId}</td></tr>
        <tr><td style="font-weight:bold;color:#495057;border-bottom:1px solid #dee2e6;">Tipo</td><td style="color:#212529;border-bottom:1px solid #dee2e6;">${declarationType || 'H1'}</td></tr>
        ${errorCode ? `<tr style="background-color:#f8f9fa;"><td style="font-weight:bold;color:#495057;border-bottom:1px solid #dee2e6;">Codigo Error</td><td style="color:#dc3545;border-bottom:1px solid #dee2e6;">${errorCode}</td></tr>` : ''}
        <tr><td style="font-weight:bold;color:#495057;">Detalles</td><td style="color:#dc3545;">${errorDetails || 'Sin detalles disponibles'}</td></tr>
      </table>
      <p style="color:#495057;"><strong>Accion requerida:</strong> Corrija los errores y vuelva a enviar.</p>
      <div style="text-align:center;margin:24px 0;"><a href="${this.appUrl}" style="background-color:${BRAND_COLOR};color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block;">Ir a LUCI</a></div>
    `);
    return this.sendEmail(userEmail, subject, html, `Declaracion rechazada. Expediente: ${expeditionId}. Error: ${errorDetails || errorCode || 'Sin detalles'}`);
  }

  /**
   * Channel assigned (orange/red) - inspection instructions
   */
  async sendChannelAssigned(userEmail, data) {
    const { mrn, channel, expeditionId, instructions } = data;
    const isOrange = channel === 'orange';
    const channelLabel = isOrange ? 'CANAL NARANJA - Revision Documental' : 'CANAL ROJO - Inspeccion Fisica';
    const subject = `${isOrange ? 'Revision documental' : 'Inspeccion fisica'} requerida - MRN: ${mrn}`;
    const defaultInstructions = isOrange
      ? 'La AEAT ha solicitado revision documental. Prepare la documentacion soporte (factura comercial, certificado origen, documento de transporte).'
      : 'La AEAT ha ordenado inspeccion fisica. La mercancia permanecera retenida hasta completar la inspeccion.';
    const html = this._wrapHtml(`
      <h2 style="color:${isOrange ? '#9a3412' : '#991b1b'};margin-top:0;">${channelLabel}</h2>
      <p style="color:#495057;">Se ha asignado un canal de control a su declaracion.</p>
      <table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #dee2e6;border-radius:4px;margin:16px 0;">
        <tr style="background-color:#f8f9fa;"><td style="font-weight:bold;color:#495057;border-bottom:1px solid #dee2e6;">MRN</td><td style="color:#212529;border-bottom:1px solid #dee2e6;font-weight:bold;">${mrn}</td></tr>
        <tr><td style="font-weight:bold;color:#495057;border-bottom:1px solid #dee2e6;">Expediente</td><td style="color:#212529;border-bottom:1px solid #dee2e6;">${expeditionId}</td></tr>
        <tr style="background-color:#f8f9fa;"><td style="font-weight:bold;color:#495057;">Canal</td><td>${this._badge(channel, channelLabel)}</td></tr>
      </table>
      <div style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:16px;margin:16px 0;border-radius:0 4px 4px 0;">
        <p style="margin:0;color:#92400e;font-weight:bold;">Instrucciones:</p>
        <p style="margin:8px 0 0;color:#78350f;">${instructions || defaultInstructions}</p>
      </div>
      <div style="text-align:center;margin:24px 0;"><a href="${this.appUrl}" style="background-color:${BRAND_COLOR};color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block;">Ver detalles en LUCI</a></div>
    `);
    return this.sendEmail(userEmail, subject, html, `${channelLabel}. MRN: ${mrn}. ${instructions || defaultInstructions}`);
  }

  /**
   * Correction required (NL)
   */
  async sendCorrectionRequired(userEmail, data) {
    const { mrn, expeditionId, corrections, deadline } = data;
    const subject = `Correccion requerida - MRN: ${mrn}`;
    const corrList = (corrections || []).map(c => `<li style="margin:4px 0;color:#495057;">${c}</li>`).join('') || '<li>Sin detalles</li>';
    const html = this._wrapHtml(`
      <h2 style="color:#9a3412;margin-top:0;">Correccion Requerida</h2>
      <p style="color:#495057;">La AEAT ha solicitado correcciones en su declaracion.</p>
      <table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #dee2e6;border-radius:4px;margin:16px 0;">
        <tr style="background-color:#f8f9fa;"><td style="font-weight:bold;color:#495057;border-bottom:1px solid #dee2e6;">MRN</td><td style="color:#212529;border-bottom:1px solid #dee2e6;font-weight:bold;">${mrn}</td></tr>
        <tr><td style="font-weight:bold;color:#495057;border-bottom:1px solid #dee2e6;">Expediente</td><td style="color:#212529;border-bottom:1px solid #dee2e6;">${expeditionId}</td></tr>
        ${deadline ? `<tr style="background-color:#f8f9fa;"><td style="font-weight:bold;color:#495057;">Plazo</td><td style="color:#dc3545;font-weight:bold;">${deadline}</td></tr>` : ''}
      </table>
      <div style="background-color:#fef2f2;border-left:4px solid #ef4444;padding:16px;margin:16px 0;border-radius:0 4px 4px 0;">
        <p style="margin:0;color:#991b1b;font-weight:bold;">Correcciones solicitadas:</p>
        <ul style="margin:8px 0 0;padding-left:20px;">${corrList}</ul>
      </div>
      <div style="text-align:center;margin:24px 0;"><a href="${this.appUrl}" style="background-color:${BRAND_COLOR};color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block;">Corregir en LUCI</a></div>
    `);
    return this.sendEmail(userEmail, subject, html, `Correccion requerida. MRN: ${mrn}. Expediente: ${expeditionId}`);
  }

  // --------------- Existing Templates (kept for backward compat) ---------------

  /**
   * Send client portal link
   */
  async sendPortalLink(email, companyName, portalUrl, expeditionId, operationType) {
    const opType = operationType === 'import' ? 'importacion' : 'exportacion';
    const html = this._wrapHtml(`
      <h2 style="color:${BRAND_COLOR};margin-top:0;">Portal de Documentacion</h2>
      <p style="color:#495057;">Estimado/a <strong>${companyName}</strong>,</p>
      <p style="color:#495057;">Hemos iniciado el tramite de <strong>${opType}</strong> para su expediente <strong>${expeditionId}</strong>.</p>
      <div style="background-color:#ebf8ff;border-left:4px solid ${BRAND_COLOR};padding:16px;margin:16px 0;border-radius:0 4px 4px 0;">
        <p style="margin:0;color:#1e40af;font-weight:bold;">Necesitamos su documentacion</p>
        <p style="margin:8px 0 0;color:#1e40af;">Acceda al portal para ver los documentos requeridos, subirlos y consultar el estado.</p>
      </div>
      <div style="text-align:center;margin:24px 0;"><a href="${portalUrl}" style="background-color:${BRAND_COLOR};color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block;">Acceder al Portal</a></div>
      <p style="color:#6c757d;font-size:13px;">Este enlace es unico para su operacion y expira en 30 dias.</p>
    `);
    return this.sendEmail(email, `[${expeditionId}] Documentacion requerida para ${opType}`, html);
  }

  /**
   * Welcome email
   */
  async sendWelcomeEmail(email, name, companyName) {
    const html = this._wrapHtml(`
      <h2 style="color:${BRAND_COLOR};margin-top:0;">Bienvenido a LUCI</h2>
      <p style="color:#495057;">Hola <strong>${name}</strong>,</p>
      <p style="color:#495057;">Tu cuenta para <strong>${companyName}</strong> ha sido creada exitosamente en LUCI, el agente aduanero inteligente.</p>
      <div style="text-align:center;margin:24px 0;"><a href="${this.appUrl}" style="background-color:${BRAND_COLOR};color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block;">Acceder a LUCI</a></div>
      <p style="color:#6c757d;font-size:13px;">Si tienes alguna pregunta, contacta con tu administrador.</p>
    `);
    return this.sendEmail(email, 'Bienvenido a LUCI - Tu cuenta esta lista', html);
  }

  /**
   * Password reset email
   */
  async sendPasswordResetEmail(email, name, resetUrl) {
    const html = this._wrapHtml(`
      <h2 style="color:${BRAND_COLOR};margin-top:0;">Restablecer Contrasena</h2>
      <p style="color:#495057;">Hola <strong>${name}</strong>,</p>
      <p style="color:#495057;">Hemos recibido una solicitud para restablecer tu contrasena.</p>
      <div style="text-align:center;margin:24px 0;"><a href="${resetUrl}" style="background-color:${BRAND_COLOR};color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block;">Restablecer Contrasena</a></div>
      <p style="color:#6c757d;font-size:13px;">Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este email.</p>
    `);
    return this.sendEmail(email, 'Restablecer contrasena - LUCI', html);
  }

  /**
   * Document received notification
   */
  async sendDocumentReceivedNotification(agentEmail, expeditionId, documentType, clientName) {
    const html = this._wrapHtml(`
      <h2 style="color:${BRAND_COLOR};margin-top:0;">Nuevo Documento Recibido</h2>
      <table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #dee2e6;border-radius:4px;margin:16px 0;">
        <tr style="background-color:#f8f9fa;"><td style="font-weight:bold;color:#495057;border-bottom:1px solid #dee2e6;">Expediente</td><td style="color:#212529;border-bottom:1px solid #dee2e6;">${expeditionId}</td></tr>
        <tr><td style="font-weight:bold;color:#495057;border-bottom:1px solid #dee2e6;">Cliente</td><td style="color:#212529;border-bottom:1px solid #dee2e6;">${clientName}</td></tr>
        <tr style="background-color:#f8f9fa;"><td style="font-weight:bold;color:#495057;">Documento</td><td style="color:#212529;">${documentType}</td></tr>
      </table>
      <div style="text-align:center;margin:24px 0;"><a href="${this.appUrl}" style="background-color:${BRAND_COLOR};color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block;">Revisar en LUCI</a></div>
    `);
    return this.sendEmail(agentEmail, `[${expeditionId}] Nuevo documento: ${documentType}`, html);
  }

  /**
   * Declaration ready notification
   */
  async sendDeclarationReadyNotification(email, expeditionId, declarationType) {
    const html = this._wrapHtml(`
      <h2 style="color:${BRAND_COLOR};margin-top:0;">Declaracion Lista</h2>
      <p style="color:#495057;">La declaracion <strong>${declarationType}</strong> del expediente <strong>${expeditionId}</strong> ha sido generada y esta pendiente de aprobacion.</p>
      <div style="text-align:center;margin:24px 0;"><a href="${this.appUrl}" style="background-color:${BRAND_COLOR};color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block;">Revisar y Enviar</a></div>
    `);
    return this.sendEmail(email, `[${expeditionId}] Declaracion ${declarationType} lista para aprobacion`, html);
  }

  /**
   * Channel notification (legacy compat)
   */
  async sendChannelNotification(email, expeditionId, channel, mrn) {
    return this.sendChannelAssigned(email, { mrn, channel, expeditionId });
  }

  /**
   * Test email
   */
  async sendTestEmail(toEmail) {
    const html = this._wrapHtml(`
      <h2 style="color:${BRAND_COLOR};margin-top:0;">Test Email</h2>
      <p style="color:#495057;">Este es un email de prueba del servicio de notificaciones de LUCI.</p>
      <p style="color:#495057;">Si recibes este email, la configuracion de SES es correcta.</p>
      <table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #dee2e6;border-radius:4px;margin:16px 0;">
        <tr style="background-color:#f8f9fa;"><td style="font-weight:bold;color:#495057;border-bottom:1px solid #dee2e6;">Region</td><td style="color:#212529;border-bottom:1px solid #dee2e6;">${process.env.AWS_REGION || 'eu-west-1'}</td></tr>
        <tr><td style="font-weight:bold;color:#495057;border-bottom:1px solid #dee2e6;">From</td><td style="color:#212529;border-bottom:1px solid #dee2e6;">${this.fromEmail}</td></tr>
        <tr style="background-color:#f8f9fa;"><td style="font-weight:bold;color:#495057;">Timestamp</td><td style="color:#212529;">${new Date().toISOString()}</td></tr>
      </table>
    `);
    return this.sendEmail(toEmail, `[TEST] LUCI Email Service - ${new Date().toISOString()}`, html, 'Test email from LUCI');
  }

  /**
   * Convert HTML to plain text (fallback)
   */
  htmlToText(html) {
    return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }
}

module.exports = new EmailService();
