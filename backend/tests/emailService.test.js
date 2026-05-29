jest.mock('@aws-sdk/client-ses', () => {
  const sendMock = jest.fn();
  class SESClient { constructor() {} send(cmd) { return sendMock(cmd); } }
  class SendEmailCommand { constructor(p) { this.input = p; this.kind = 'send'; } }
  class SendRawEmailCommand { constructor(p) { this.input = p; this.kind = 'raw'; } }
  return { SESClient, SendEmailCommand, SendRawEmailCommand, __sendMock: sendMock };
});

jest.mock('../src/services/suppressionService', () => ({
  isSuppressed: jest.fn().mockResolvedValue(false)
}));

describe('emailService', () => {
  let emailService;
  let sesMock;
  let suppressionService;

  beforeAll(() => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIATEST';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret';
    process.env.SES_REGION = 'us-east-1';
    process.env.SES_FROM_EMAIL = 'noreply@strixai.es';
    process.env.UNSUBSCRIBE_SECRET = 'test-unsubscribe-secret-32chars-min-length-XXXX';
    sesMock = require('@aws-sdk/client-ses').__sendMock;
    suppressionService = require('../src/services/suppressionService');
    emailService = require('../src/services/emailService');
  });

  beforeEach(() => {
    sesMock.mockReset().mockResolvedValue({ MessageId: 'mid-123' });
    suppressionService.isSuppressed.mockReset().mockResolvedValue(false);
  });

  test('sends raw email with List-Unsubscribe headers and configuration set', async () => {
    const result = await emailService.sendEmail('user@example.com', 'Hola', '<p>Hola</p>', 'Hola');
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('mid-123');
    expect(sesMock).toHaveBeenCalledTimes(1);
    const cmd = sesMock.mock.calls[0][0];
    expect(cmd.kind).toBe('raw');
    expect(cmd.input.ConfigurationSetName).toBe('luci-feedback-v1');
    const raw = cmd.input.RawMessage.Data.toString();
    expect(raw).toContain('List-Unsubscribe: <mailto:unsubscribe@strixai.es');
    expect(raw).toContain('List-Unsubscribe-Post: List-Unsubscribe=One-Click');
    expect(raw).toContain('Content-Type: multipart/alternative');
    expect(raw).toContain('To: user@example.com');
    expect(raw).toContain('From: LUCI <noreply@strixai.es>');
    expect(raw).toContain('Content-Transfer-Encoding: base64');
  });

  test('skips suppressed recipients', async () => {
    suppressionService.isSuppressed.mockImplementation((e) => Promise.resolve(e === 'bounced@example.com'));
    const result = await emailService.sendEmail(['ok@example.com', 'bounced@example.com'], 'Test', '<p>x</p>');
    expect(result.success).toBe(true);
    expect(result.skipped).toEqual(['bounced@example.com']);
    const raw = sesMock.mock.calls[0][0].input.RawMessage.Data.toString();
    expect(raw).toContain('To: ok@example.com');
    expect(raw).not.toContain('bounced@example.com');
  });

  test('returns suppressed when all recipients blocked', async () => {
    suppressionService.isSuppressed.mockResolvedValue(true);
    const result = await emailService.sendEmail('blocked@example.com', 'Test', '<p>x</p>');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('suppressed');
    expect(sesMock).not.toHaveBeenCalled();
  });

  test('handles UTF-8 subject and body via base64', async () => {
    await emailService.sendEmail('user@example.com', 'Declaración aceptada', '<p>Importación con éxito</p>');
    const raw = sesMock.mock.calls[0][0].input.RawMessage.Data.toString();
    expect(raw).toMatch(/Subject: =\?UTF-8\?B\?/);
  });
});
