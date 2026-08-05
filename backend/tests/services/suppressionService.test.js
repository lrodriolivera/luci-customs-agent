/**
 * suppressionService — lista de supresión de emails (bounces/quejas/bajas SES).
 *
 * Lógica de ramas pura sobre el modelo EmailSuppression, que usamos con Mongo EN
 * MEMORIA (real, sin mockear) para ejercitar sus estáticos isSuppressed()/
 * suppress()/deleteOne(). Cubre: permanent-vs-transient (expiresAt null vs +7d),
 * early returns por payload/email nulo, arrays de destinatarios vacíos, el
 * catch de isSuppressed (defaulting-to-allow) y remove por deletedCount.
 */

const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const svc = require('../../src/services/suppressionService');
const EmailSuppression = require('../../src/models/EmailSuppression');

usarBaseDeDatosEnMemoria({ limpiarEntreTests: true });

// ==================== recordBounce ====================
describe('recordBounce', () => {
  test('no hace nada si falta bounce o mail', async () => {
    await svc.recordBounce({});
    await svc.recordBounce({ bounce: {} });
    await svc.recordBounce({ mail: {} });
    expect(await EmailSuppression.countDocuments()).toBe(0);
  });

  test('bounce Permanent → BOUNCE_PERMANENT sin expiración', async () => {
    await svc.recordBounce({
      bounce: {
        bounceType: 'Permanent', bounceSubType: 'General',
        bouncedRecipients: [{ emailAddress: 'a@x.com', diagnosticCode: '550' }]
      },
      mail: { messageId: 'm1' }
    });
    const doc = await EmailSuppression.findOne({ email: 'a@x.com' });
    expect(doc.reason).toBe('BOUNCE_PERMANENT');
    expect(doc.expiresAt).toBeNull();
  });

  test('bounce Transient → BOUNCE_TRANSIENT con expiración futura', async () => {
    await svc.recordBounce({
      bounce: {
        bounceType: 'Transient', bounceSubType: 'MailboxFull',
        bouncedRecipients: [{ emailAddress: 'b@x.com' }]
      },
      mail: { messageId: 'm2' }
    });
    const doc = await EmailSuppression.findOne({ email: 'b@x.com' });
    expect(doc.reason).toBe('BOUNCE_TRANSIENT');
    expect(doc.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test('bouncedRecipients ausente → no lanza (array vacío por defecto)', async () => {
    await svc.recordBounce({ bounce: { bounceType: 'Permanent' }, mail: { messageId: 'm3' } });
    expect(await EmailSuppression.countDocuments()).toBe(0);
  });
});

// ==================== recordComplaint ====================
describe('recordComplaint', () => {
  test('no hace nada si falta complaint o mail', async () => {
    await svc.recordComplaint({});
    await svc.recordComplaint({ complaint: {} });
    expect(await EmailSuppression.countDocuments()).toBe(0);
  });

  test('complainedRecipients ausente → no lanza (array vacío por defecto)', async () => {
    await svc.recordComplaint({ complaint: { complaintFeedbackType: 'abuse' }, mail: { messageId: 'm5' } });
    expect(await EmailSuppression.countDocuments()).toBe(0);
  });

  test('queja → COMPLAINT sin expiración', async () => {
    await svc.recordComplaint({
      complaint: { complaintFeedbackType: 'abuse', complainedRecipients: [{ emailAddress: 'c@x.com' }] },
      mail: { messageId: 'm4' }
    });
    const doc = await EmailSuppression.findOne({ email: 'c@x.com' });
    expect(doc.reason).toBe('COMPLAINT');
    expect(doc.expiresAt).toBeNull();
  });
});

// ==================== recordUnsubscribe ====================
describe('recordUnsubscribe', () => {
  test('devuelve null si no hay email', async () => {
    expect(await svc.recordUnsubscribe(null)).toBeNull();
    expect(await EmailSuppression.countDocuments()).toBe(0);
  });

  test('suprime con reason UNSUBSCRIBE y source por defecto', async () => {
    const doc = await svc.recordUnsubscribe('d@x.com');
    expect(doc.reason).toBe('UNSUBSCRIBE');
    expect(doc.source).toBe('user-request');
  });

  test('respeta el source explícito', async () => {
    const doc = await svc.recordUnsubscribe('e@x.com', 'admin');
    expect(doc.source).toBe('admin');
  });
});

// ==================== isSuppressed ====================
describe('isSuppressed', () => {
  test('true si el email está suprimido', async () => {
    await svc.recordUnsubscribe('f@x.com');
    expect(await svc.isSuppressed('f@x.com')).toBe(true);
  });

  test('false si no está suprimido', async () => {
    expect(await svc.isSuppressed('libre@x.com')).toBe(false);
  });

  test('ante error del modelo, defaultea a permitir (false)', async () => {
    const spy = jest.spyOn(EmailSuppression, 'isSuppressed').mockRejectedValue(new Error('db down'));
    try {
      expect(await svc.isSuppressed('g@x.com')).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});

// ==================== remove ====================
describe('remove', () => {
  test('false si no hay email', async () => {
    expect(await svc.remove(null)).toBe(false);
  });

  test('true al borrar un email suprimido (normaliza a minúsculas/trim)', async () => {
    await svc.recordUnsubscribe('h@x.com');
    expect(await svc.remove('  H@X.COM ')).toBe(true);
    expect(await EmailSuppression.findOne({ email: 'h@x.com' })).toBeNull();
  });

  test('false si el email no estaba suprimido', async () => {
    expect(await svc.remove('inexistente@x.com')).toBe(false);
  });
});
