/**
 * La agente envia al cliente el H1 admitido con los datos del modelo 031 (pago
 * previo al levante). Decision del 17/Nov/2026: no es automatico; lo envia la
 * agente tras revisar la liquidacion, y queda registrado.
 */
const { Expedition } = require('../models');
const logger = require('../config/logger');
const emailService = require('../services/emailService');
const { ensureSameTenant } = require('../utils/tenantGuard');
const { pagoTributosDe } = require('../services/portal/pagoTributos');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DIAS_PORTAL = 30;

/**
 * POST /api/expeditions/:id/enviar-pago-031   body: { email? }
 * 409 si no es pago previo con el H1 admitido; 400 sin correo valido;
 * 502 si el correo no sale (no se registra como enviado).
 */
const enviarPago031 = async (req, res) => {
  try {
    const expedition = await Expedition.findById(req.params.id);
    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    const pago = pagoTributosDe(expedition);
    if (!pago?.modelo031) {
      return res.status(409).json({ success: false, error: 'Solo se envía con pago previo al levante (A), el H1 admitido y el importe liquidado por la AEAT' });
    }

    const email = String(req.body?.email || expedition.client?.contact?.email || '').trim();
    if (!EMAIL.test(email)) {
      return res.status(400).json({ success: false, error: 'Falta un correo válido del cliente' });
    }

    if (expedition.clientPortal?.expiresAt && expedition.clientPortal.expiresAt < new Date()) {
      expedition.clientPortal.token = require('uuid').v4();
      expedition.clientPortal.expiresAt = new Date(Date.now() + DIAS_PORTAL * 24 * 60 * 60 * 1000);
    }

    const envio = await emailService.sendPago031(email, {
      companyName: expedition.client?.companyName,
      expeditionId: expedition.expeditionId,
      portalUrl: expedition.portalUrl,
      mrn: pago.modelo031.referencia,
      importe: pago.modelo031.importe,
      limiteDePago: pago.modelo031.limiteDePago
    });
    // emailService no lanza si falla: devuelve { success: false }.
    if (!envio || envio.success === false) {
      logger.warn(`Pago 031 no enviado: ${expedition.expeditionId}: ${envio?.reason || envio?.error || 'motivo desconocido'}`);
      return res.status(502).json({ success: false, error: 'No se pudo enviar el correo al cliente' });
    }

    const enviadoEl = new Date();
    expedition.communications.push({
      type: 'email',
      subject: 'H1 admitido: pago de tributos (modelo 031)',
      content: `Importe ${pago.modelo031.importe} EUR, MRN ${pago.modelo031.referencia}, enlace al portal`,
      sentAt: enviadoEl,
      sentTo: email,
      sentBy: req.user._id
    });
    expedition.timeline.push({
      action: 'payment_031_sent',
      description: `H1 admitido y datos del modelo 031 enviados al cliente (${email})`,
      userId: req.user._id,
      performedBy: req.user.name,
      metadata: { mrn: pago.modelo031.referencia, importe: pago.modelo031.importe }
    });
    await expedition.save();

    logger.info(`Pago 031 enviado: ${expedition.expeditionId}`);
    res.json({ success: true, data: { sentTo: email, sentAt: enviadoEl.toISOString() } });
  } catch (error) {
    logger.error('Error enviando el pago 031 al cliente:', error);
    res.status(500).json({ success: false, error: 'Error al enviar el correo al cliente' });
  }
};

module.exports = { enviarPago031 };
