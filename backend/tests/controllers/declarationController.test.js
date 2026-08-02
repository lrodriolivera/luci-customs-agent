/**
 * Tests para declarationController (estaba al 0%).
 *
 * submitDeclaration presenta declaraciones ante la AEAT: es la operacion con
 * mas consecuencia del producto. El foco esta en lo que no debe pasar nunca
 * —enviar dos veces la misma declaracion, enviar sin XML, tocar expedientes de
 * otro tenant— y en que la respuesta de AEAT se persista entera.
 */

const request = require('supertest');
const express = require('express');

const mockExpedition = { findById: jest.fn() };
const mockTenant = { findById: jest.fn() };
const mockSubmitH1 = jest.fn();
const mockSubmitAES = jest.fn();
const mockCancelH1 = jest.fn();

jest.mock('../../src/models', () => ({
  Expedition: mockExpedition,
  ChatMessage: { find: jest.fn() }
}));
jest.mock('../../src/models/Tenant', () => mockTenant);
jest.mock('../../src/services/aeat/aeatSubmitService', () => ({
  submitH1: (...a) => mockSubmitH1(...a),
  submitAES: (...a) => mockSubmitAES(...a),
  cancelH1: (...a) => mockCancelH1(...a)
}));
jest.mock('../../src/services/aiService', () => ({}));
jest.mock('../../src/services/aeatService', () => ({}));
jest.mock('../../src/services/channelService', () => ({}));
jest.mock('../../src/services/emailService', () => ({
  sendDeclarationRejected: jest.fn().mockResolvedValue(true),
  sendDeclarationAccepted: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../src/services/customs', () => ({
  CustomsServiceFactory: { getServiceForTenant: jest.fn() }
}));

const declarationController = require('../../src/controllers/declarationController');

const USER = { _id: 'u1', name: 'Tester', email: 'tester@strixai.es', tenantId: 't1' };

/** Expediente con declaracion lista para enviar. */
function expedienteListo(overrides = {}) {
  return {
    _id: 'e1',
    expeditionId: 'EXP-2026-0100',
    tenantId: 't1',
    status: 'documents_validated',
    timeline: [],
    declaration: {
      type: 'H1',
      xmlContent: '<xml>declaracion</xml>',
      status: 'draft',
      ...overrides.declaration
    },
    save: jest.fn().mockResolvedValue(true),
    ...overrides
  };
}

function app(user = USER) {
  const a = express();
  a.use(express.json());
  a.post('/api/declarations/:expeditionId/submit',
    (req, _res, next) => { req.user = user; req.tenantId = user.tenantId; next(); },
    declarationController.submitDeclaration);
  return a;
}

describe('declarationController.submitDeclaration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTenant.findById.mockResolvedValue({ customsConfig: { country: 'ES' } });
    mockSubmitH1.mockResolvedValue({
      success: true, mrn: '26ES00280112345678', channel: 'green', code: '0', csv: 'CSV123'
    });
  });

  describe('guardas antes de enviar a Hacienda', () => {
    test('404 si el expediente es de otro tenant', async () => {
      // No debe revelarse que existe: ensureSameTenant responde 404, no 403.
      mockExpedition.findById.mockResolvedValue(expedienteListo({ tenantId: 't2' }));

      const res = await request(app()).post('/api/declarations/e1/submit');

      expect(res.status).toBe(404);
      expect(mockSubmitH1).not.toHaveBeenCalled();
    });

    test('400 si no hay XML generado', async () => {
      mockExpedition.findById.mockResolvedValue(
        expedienteListo({ declaration: { type: 'H1', xmlContent: null } })
      );

      const res = await request(app()).post('/api/declarations/e1/submit');

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/No hay declaracion generada/);
      expect(mockSubmitH1).not.toHaveBeenCalled();
    });

    test('no reenvia una declaracion ya presentada', async () => {
      // Enviar dos veces crearia una declaracion duplicada ante la AEAT.
      mockExpedition.findById.mockResolvedValue(expedienteListo({
        declaration: { type: 'H1', xmlContent: '<xml/>', status: 'submitted', mrn: '26ES111' }
      }));

      const res = await request(app()).post('/api/declarations/e1/submit');

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/ya enviada/);
      expect(res.body.error).toContain('26ES111');
      expect(mockSubmitH1).not.toHaveBeenCalled();
    });
  });

  describe('envio correcto', () => {
    test('persiste MRN, canal y estado tras la aceptacion', async () => {
      const exp = expedienteListo();
      mockExpedition.findById.mockResolvedValue(exp);

      const res = await request(app()).post('/api/declarations/e1/submit');

      expect(res.status).toBe(200);
      expect(exp.declaration.mrn).toBe('26ES00280112345678');
      expect(exp.declaration.status).toBe('submitted');
      expect(exp.declaration.channel).toBe('green');
      expect(exp.save).toHaveBeenCalled();
    });

    test('el canal de AEAT determina el estado del expediente', async () => {
      for (const [channel, estado] of [['green','green_channel'], ['orange','orange_channel'], ['red','red_channel']]) {
        jest.clearAllMocks();
        mockTenant.findById.mockResolvedValue({ customsConfig: { country: 'ES' } });
        mockSubmitH1.mockResolvedValue({ success: true, mrn: 'M', channel, code: '0' });
        const exp = expedienteListo();
        mockExpedition.findById.mockResolvedValue(exp);

        await request(app()).post('/api/declarations/e1/submit');

        expect(exp.status).toBe(estado);
      }
    });

    test('guarda el CSV, que es el justificante ante la AEAT', async () => {
      const exp = expedienteListo();
      mockExpedition.findById.mockResolvedValue(exp);

      await request(app()).post('/api/declarations/e1/submit');

      expect(exp.declaration.aeatResponse.csv).toBe('CSV123');
      expect(exp.declaration.aeatResponse.simulated).toBe(false);
    });

    test('deja traza en el timeline con MRN y usuario', async () => {
      const exp = expedienteListo();
      mockExpedition.findById.mockResolvedValue(exp);

      await request(app()).post('/api/declarations/e1/submit');

      const evento = exp.timeline.find(t => t.action === 'declaration_submitted');
      expect(evento).toBeDefined();
      expect(evento.metadata.mrn).toBe('26ES00280112345678');
      expect(evento.userId).toBe('u1');
    });

    test('usa el builder AES cuando el tipo es AES', async () => {
      mockSubmitAES.mockResolvedValue({ success: true, mrn: 'AES1', channel: 'green', code: '0' });
      mockExpedition.findById.mockResolvedValue(expedienteListo({
        declaration: { type: 'AES', xmlContent: '<xml/>', status: 'draft' }
      }));

      await request(app()).post('/api/declarations/e1/submit');

      expect(mockSubmitAES).toHaveBeenCalled();
      expect(mockSubmitH1).not.toHaveBeenCalled();
    });
  });

  describe('rechazo de AEAT', () => {
    test('400 con el error y sin marcar la declaracion como enviada', async () => {
      mockSubmitH1.mockResolvedValue({ success: false, error: 'EORI no valido', code: '4404' });
      const exp = expedienteListo();
      mockExpedition.findById.mockResolvedValue(exp);

      const res = await request(app()).post('/api/declarations/e1/submit');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('EORI no valido');
      // Lo importante: el expediente no queda como presentado.
      expect(exp.declaration.status).not.toBe('submitted');
      expect(exp.declaration.mrn).toBeUndefined();
    });

    test('un fallo al enviar el email de rechazo no rompe la respuesta', async () => {
      const emailService = require('../../src/services/emailService');
      emailService.sendDeclarationRejected.mockRejectedValue(new Error('SMTP caido'));
      mockSubmitH1.mockResolvedValue({ success: false, error: 'Rechazada' });
      mockExpedition.findById.mockResolvedValue(expedienteListo());

      const res = await request(app()).post('/api/declarations/e1/submit');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Rechazada');
    });
  });
});
