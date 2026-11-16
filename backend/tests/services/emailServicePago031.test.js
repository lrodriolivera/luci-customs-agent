const emailService = require('../../src/services/emailService');

describe('emailService.sendPago031', () => {
  test('escapa los datos del cliente y pone importe, MRN, enlace y la espera del justificante', async () => {
    const espia = jest.spyOn(emailService, 'sendEmail').mockResolvedValue({ success: true });
    await emailService.sendPago031('c@x.es', { companyName: '<script>x</script>', expeditionId: 'EXP-1', portalUrl: 'https://aduanas.strixai.ai/portal/abc', mrn: '26ES1', importe: 1704.96, limiteDePago: null });
    const [, asunto, html] = espia.mock.calls[0];
    expect(asunto).toContain('modelo 031');
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('1704,96 €');
    expect(html).toContain('26ES1');
    expect(html).toContain('https://aduanas.strixai.ai/portal/abc');
    expect(html).toContain('a la espera del justificante de pago');
    espia.mockRestore();
  });
});
