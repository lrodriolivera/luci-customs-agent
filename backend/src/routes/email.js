const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const suppressionService = require('../services/suppressionService');
const unsubscribeToken = require('../utils/unsubscribeToken');
const { verifySnsMessage } = require('../utils/snsVerify');

router.post('/internal/ses-feedback',
  express.text({ type: ['text/plain', 'application/json'], limit: '256kb' }),
  async (req, res) => {
    let msg;
    try {
      msg = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      return res.status(400).send('invalid body');
    }
    if (!msg || typeof msg !== 'object') return res.status(400).send('invalid body');

    const valid = await verifySnsMessage(msg);
    if (!valid) {
      logger.warn('SNS message rejected (invalid signature)', { type: msg.Type });
      return res.status(403).send('invalid signature');
    }

    if (msg.Type === 'SubscriptionConfirmation') {
      try {
        const https = require('https');
        await new Promise((resolve, reject) => {
          https.get(msg.SubscribeURL, (r) => {
            r.statusCode === 200 ? resolve() : reject(new Error(`subscribe ${r.statusCode}`));
            r.resume();
          }).on('error', reject);
        });
        logger.info('SNS subscription confirmed', { topicArn: msg.TopicArn });
        return res.status(200).send('confirmed');
      } catch (err) {
        logger.error('SNS subscription confirmation failed', { error: err.message });
        return res.status(500).send('confirmation failed');
      }
    }

    if (msg.Type === 'Notification') {
      try {
        const payload = JSON.parse(msg.Message);
        if (payload.notificationType === 'Bounce' || payload.eventType === 'Bounce') {
          await suppressionService.recordBounce(payload);
        } else if (payload.notificationType === 'Complaint' || payload.eventType === 'Complaint') {
          await suppressionService.recordComplaint(payload);
        } else {
          logger.debug('Unhandled SES event', { type: payload.notificationType || payload.eventType });
        }
        return res.status(200).send('ok');
      } catch (err) {
        logger.error('SES feedback processing failed', { error: err.message });
        return res.status(500).send('processing failed');
      }
    }

    return res.status(200).send('ignored');
  }
);

router.get('/unsubscribe', async (req, res) => {
  const { token } = req.query;
  const email = unsubscribeToken.verify(token);
  if (!email) {
    return res.status(400).type('html').send(htmlPage(
      'Enlace inválido',
      '<p>Este enlace ha expirado o no es válido. Si quiere darse de baja, responda al email original o contacte con soporte.</p>'
    ));
  }
  try {
    await suppressionService.recordUnsubscribe(email, 'user-request');
    res.type('html').send(htmlPage(
      'Suscripción cancelada',
      `<p>La dirección <strong>${escapeHtml(email)}</strong> ha sido eliminada de futuros envíos transaccionales.</p>
       <p style="color:#6c757d;font-size:13px;margin-top:16px;">Seguirá recibiendo notificaciones legales obligatorias relacionadas con sus declaraciones aduaneras.</p>`
    ));
  } catch (err) {
    logger.error('Unsubscribe failed', { error: err.message });
    res.status(500).type('html').send(htmlPage('Error', '<p>No se pudo procesar la solicitud. Intente más tarde.</p>'));
  }
});

router.post('/unsubscribe', async (req, res) => {
  const token = (req.query && req.query.token) || (req.body && req.body.token);
  const email = unsubscribeToken.verify(token);
  if (!email) return res.status(400).json({ success: false, error: 'invalid token' });
  await suppressionService.recordUnsubscribe(email, 'user-request');
  res.status(200).json({ success: true });
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function htmlPage(title, body) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${title} - LUCI</title>
<style>body{font-family:Arial,sans-serif;max-width:560px;margin:64px auto;padding:32px;background:#f4f6f9;color:#212529}
.card{background:#fff;padding:32px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
h1{color:#0284c7;margin-top:0;font-size:22px}</style></head>
<body><div class="card"><h1>${title}</h1>${body}</div></body></html>`;
}

module.exports = router;
