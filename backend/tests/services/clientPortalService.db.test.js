/**
 * clientPortalService contra Mongo en memoria (modelos Expedition/Payment/
 * ChatMessage reales). Este servicio NO tiene I/O externo (ni red, ni IA, ni
 * email): toda su logica -generacion de expedientes self-service, checklists por
 * tipo de operacion, estadisticas del cliente, documentos firmados, pagos
 * pendientes- se ejercita de verdad contra la BD efimera. NUNCA produccion.
 *
 * Se cubre en particular el aislamiento por cliente/organizacion en getClientStats
 * y getClientHistory (no debe mezclar expedientes de otro email/organizationId).
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

const { Expedition, Payment, ChatMessage } = require('../../src/models');
const service = require('../../src/services/clientPortalService');

// --- Helpers -----------------------------------------------------------------

// El ExpeditionSchema usa tenantId (ref Tenant), no organizationId. Usamos
// tenantId en los fixtures para que el aislamiento se ejerza de verdad.
const TENANT_A = new mongoose.Types.ObjectId();
const TENANT_B = new mongoose.Types.ObjectId();

// Crea un expediente accesible por portal (token activo). extra sobreescribe.
async function crearExpedientePortal({ token, orgId = TENANT_A, email = 'cliente@empresa.com', status = 'draft', extra = {} } = {}) {
  const portalToken = token || require('uuid').v4();
  return Expedition.create({
    expeditionId: `IMP-${Math.floor(Math.random() * 1e6)}`,
    tenantId: orgId,
    operationType: 'import',
    transportMode: 'maritime',
    status,
    client: {
      companyName: 'Importadora SL',
      nif: 'B12345678',
      contact: { name: 'Ana', email, phone: '600000000' }
    },
    clientPortal: { token: portalToken, isActive: true, createdAt: new Date() },
    ...extra
  });
}

async function crearPagoCompletado({ portalToken, orgId = TENANT_A, paymentId = `PAY-${Math.floor(Math.random() * 1e6)}` }) {
  return Payment.create({
    organizationId: orgId,
    paymentId,
    portalToken,
    status: 'completed',
    paidAt: new Date(),
    subtotal: 100,
    totalAmount: 121,
    items: [{ description: 'Aranceles', type: 'duty', amount: 100 }]
  });
}

describe('clientPortalService (BD real)', () => {
  usarBaseDeDatosEnMemoria();

  // --- helpers puros ---------------------------------------------------------

  describe('helpers puros', () => {
    it('generateExpeditionId usa el prefijo segun el tipo', () => {
      expect(service.generateExpeditionId('import')).toMatch(/^IMP-/);
      expect(service.generateExpeditionId('export')).toMatch(/^EXP-/);
      expect(service.generateExpeditionId('transit')).toMatch(/^TRA-/);
      expect(service.generateExpeditionId('otro')).toMatch(/^TRA-/); // fallback
    });

    it('getOperationTypeName traduce los tipos conocidos', () => {
      expect(service.getOperationTypeName('import')).toBe('Importacion');
      expect(service.getOperationTypeName('export')).toBe('Exportacion');
      expect(service.getOperationTypeName('transit')).toBe('Transito');
      expect(service.getOperationTypeName('desconocido')).toBe('desconocido');
    });

    it('generateDocumentChecklist devuelve el checklist correcto por tipo', () => {
      const imp = service.generateDocumentChecklist('import');
      expect(imp.some(d => d.documentType === 'bill_of_lading' && d.required)).toBe(true);
      expect(imp.some(d => d.documentType === 'certificate_origin')).toBe(true);

      const exp = service.generateDocumentChecklist('export');
      expect(exp.some(d => d.documentType === 'export_license')).toBe(true);

      const tra = service.generateDocumentChecklist('transit');
      expect(tra).toHaveLength(3);

      const base = service.generateDocumentChecklist('otro');
      expect(base).toHaveLength(2); // solo factura + packing list
    });

    it('getCertificateName traduce los certificados conocidos', () => {
      expect(service.getCertificateName('eur1')).toBe('Certificado EUR.1');
      expect(service.getCertificateName('form_a')).toBe('Form A (SGP)');
      expect(service.getCertificateName('xxx')).toBe('Certificado');
    });
  });

  // --- createExpeditionFromPortal --------------------------------------------

  describe('createExpeditionFromPortal', () => {
    it('crea el expediente, el token de portal y el mensaje de bienvenida', async () => {
      const result = await service.createExpeditionFromPortal(
        TENANT_A,
        { companyName: 'Nueva SL', taxId: 'B99999999', eoriNumber: 'ESB99999999', email: 'nuevo@empresa.com', contactName: 'Luis' },
        { operationType: 'import', originCountry: 'CN', goods: [{ description: 'Camisetas', quantity: 50, value: 1000 }] }
      );

      expect(result.expeditionId).toMatch(/^IMP-/);
      expect(result.portalToken).toBeTruthy();
      expect(result.status).toBe('draft');
      expect(result.documentChecklist.length).toBeGreaterThan(0);

      // persistido de verdad
      const exp = await Expedition.findByPortalToken(result.portalToken);
      expect(exp).not.toBeNull();
      expect(exp.client.companyName).toBe('Nueva SL');
      // regresion del bug: nif/eori se mapean y persisten (antes se descartaban
      // por escribirse como taxId/eoriNumber, y el save fallaba por nif requerido)
      expect(exp.client.nif).toBe('B99999999');
      expect(exp.client.eori).toBe('ESB99999999');
      expect(exp.goods[0].description).toBe('Camisetas');

      // mensaje de bienvenida
      const msgs = await ChatMessage.find({ expedition: exp._id });
      expect(msgs).toHaveLength(1);
      expect(msgs[0].sender).toBe('luci');
    });

    it('lanza error si falta companyName', async () => {
      await expect(
        service.createExpeditionFromPortal(TENANT_A, {}, { operationType: 'import' })
      ).rejects.toThrow(/Company name is required/);
    });

    it('lanza error si falta operationType', async () => {
      await expect(
        service.createExpeditionFromPortal(TENANT_A, { companyName: 'X' }, {})
      ).rejects.toThrow(/Operation type is required/);
    });
  });

  // --- updateExpeditionFromPortal --------------------------------------------

  describe('updateExpeditionFromPortal', () => {
    it('actualiza solo los campos permitidos en un expediente draft', async () => {
      const exp = await crearExpedientePortal({ status: 'draft' });

      const actualizado = await service.updateExpeditionFromPortal(exp.clientPortal.token, {
        clientNotes: 'Nota del cliente',
        incoterm: { code: 'FOB', place: 'Shanghai' }, // incoterm es objeto {code,place} en el schema
        status: 'completed' // NO permitido -> se ignora
      });

      expect(actualizado.clientNotes).toBe('Nota del cliente');
      expect(actualizado.incoterm.code).toBe('FOB');
      expect(actualizado.status).toBe('draft'); // no cambio
    });

    it('lanza error si el expediente no esta en draft', async () => {
      const exp = await crearExpedientePortal({ status: 'pending_documents' });
      await expect(
        service.updateExpeditionFromPortal(exp.clientPortal.token, { clientNotes: 'x' })
      ).rejects.toThrow(/Cannot modify/);
    });

    it('lanza error si el token no existe', async () => {
      await expect(
        service.updateExpeditionFromPortal('token-inexistente', {})
      ).rejects.toThrow(/not found/);
    });
  });

  // --- submitExpedition ------------------------------------------------------

  describe('submitExpedition', () => {
    it('rechaza el envio si faltan documentos requeridos', async () => {
      const exp = await crearExpedientePortal({
        status: 'draft',
        extra: {
          documentChecklist: [
            { documentType: 'commercial_invoice', documentName: 'Factura', required: true, received: false }
          ]
        }
      });

      await expect(
        service.submitExpedition(exp.clientPortal.token)
      ).rejects.toThrow(/Documentos requeridos faltantes/);
    });

    it('envia el expediente cuando estan todos los documentos requeridos', async () => {
      const exp = await crearExpedientePortal({
        status: 'draft',
        extra: {
          documentChecklist: [
            { documentType: 'commercial_invoice', documentName: 'Factura', required: true, received: true },
            { documentType: 'certificate_origin', documentName: 'Origen', required: false, received: false }
          ]
        }
      });

      const resultado = await service.submitExpedition(exp.clientPortal.token);
      expect(resultado.status).toBe('pending_documents');

      // mensaje de sistema anadido
      const msgs = await ChatMessage.find({ expedition: exp._id, messageType: 'system' });
      expect(msgs.length).toBeGreaterThanOrEqual(1);
    });

    it('lanza error si el expediente ya no es draft', async () => {
      const exp = await crearExpedientePortal({ status: 'pending_documents' });
      await expect(
        service.submitExpedition(exp.clientPortal.token)
      ).rejects.toThrow(/already submitted/);
    });
  });

  // --- getClientStats / getExpeditionStats / calculateClientStats ------------

  describe('getClientStats', () => {
    it('agrega estadisticas de TODOS los expedientes del mismo email y organizacion', async () => {
      const email = 'multi@empresa.com';
      const token = require('uuid').v4();
      // 3 del cliente en TENANT_A (1 completado), 1 del mismo email pero TENANT_B
      await crearExpedientePortal({ token, email, status: 'completed', extra: { completedAt: new Date(), createdAt: new Date('2026-01-01') } });
      await crearExpedientePortal({ email, status: 'draft' });
      await crearExpedientePortal({ email, status: 'declaration_submitted' });
      await crearExpedientePortal({ email, orgId: TENANT_B, status: 'draft' });

      const stats = await service.getClientStats(token);

      expect(stats.clientEmail).toBe(email);
      expect(stats.summary.totalExpeditions).toBe(3); // no cuenta el de TENANT_B
      expect(stats.summary.completedExpeditions).toBe(1);
      expect(stats.byOperationType.import).toBe(3);
    });

    it('cae a getExpeditionStats cuando el expediente no tiene email de contacto', async () => {
      const token = require('uuid').v4();
      await Expedition.create({
        expeditionId: 'IMP-NOEMAIL',
        tenantId: TENANT_A,
        operationType: 'import',
        transportMode: 'maritime',
        status: 'draft',
        client: { companyName: 'Sin contacto', nif: 'B1' },
        clientPortal: { token, isActive: true }
      });

      const stats = await service.getClientStats(token);
      expect(stats.currentExpedition.expeditionId).toBe('IMP-NOEMAIL');
      expect(stats.totals.totalExpeditions).toBe(1);
    });

    it('lanza error si el token no existe', async () => {
      await expect(service.getClientStats('nope')).rejects.toThrow(/not found/);
    });
  });

  describe('calculateClientStats', () => {
    it('calcula totales financieros, canal verde y volumen mensual', () => {
      const expeditions = [
        { expeditionId: 'E1', operationType: 'import', status: 'completed', createdAt: new Date('2026-03-01'), completedAt: new Date('2026-03-06'), declaration: { channel: 'green' }, calculations: { totalDuties: 100, totalVat: 21 } },
        { expeditionId: 'E2', operationType: 'export', status: 'draft', createdAt: new Date('2026-03-10'), declaration: { channel: 'red' }, calculations: { totalDuties: 50, totalVat: 10 } }
      ];

      const stats = service.calculateClientStats(expeditions, 'x@y.com');
      expect(stats.financial.totalDuties).toBe(150);
      expect(stats.financial.totalVat).toBe(31);
      expect(stats.financial.totalPaid).toBe(181);
      expect(stats.byChannel.green).toBe(1);
      expect(stats.byChannel.red).toBe(1);
      expect(stats.channelAnalysis.greenChannelRate).toBe(50);
      expect(stats.summary.avgProcessingDays).toBe(5);
      expect(stats.monthlyVolume[0].count).toBe(2);
    });
  });

  // --- getClientHistory ------------------------------------------------------

  describe('getClientHistory', () => {
    it('devuelve el historial del cliente acotado por organizacion y email', async () => {
      const email = 'hist@empresa.com';
      await crearExpedientePortal({ email, status: 'completed' });
      await crearExpedientePortal({ email, status: 'draft' });
      await crearExpedientePortal({ email, orgId: TENANT_B }); // otra org

      const result = await service.getClientHistory(TENANT_A, email, {});
      expect(result.total).toBe(2);
      expect(result.expeditions).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it('aplica el filtro por status', async () => {
      const email = 'hist2@empresa.com';
      await crearExpedientePortal({ email, status: 'completed' });
      await crearExpedientePortal({ email, status: 'draft' });

      const result = await service.getClientHistory(TENANT_A, email, { status: 'completed' });
      expect(result.total).toBe(1);
    });
  });

  // --- getSignedDocuments ----------------------------------------------------

  describe('getSignedDocuments', () => {
    it('incluye levante, copia de declaracion y recibo de pago', async () => {
      const token = require('uuid').v4();
      const exp = await crearExpedientePortal({
        token,
        status: 'levante',
        extra: {
          declaration: { mrn: '25ES0028001234', status: 'accepted', type: 'H1', levanteDate: new Date(), acceptanceDate: new Date() }
        }
      });
      await crearPagoCompletado({ portalToken: token });

      const result = await service.getSignedDocuments(token);
      const tipos = result.documents.map(d => d.type);
      expect(tipos).toContain('levante');
      expect(tipos).toContain('declaration');
      expect(tipos).toContain('payment_receipt');
    });

    it('no incluye levante si el expediente no esta en levante/completed', async () => {
      const token = require('uuid').v4();
      await crearExpedientePortal({ token, status: 'draft', extra: { declaration: { mrn: 'M', status: 'pending' } } });

      const result = await service.getSignedDocuments(token);
      expect(result.documents.some(d => d.type === 'levante')).toBe(false);
    });
  });

  // --- generateLevanteDocument / generateDeclarationCopy ---------------------

  describe('generacion de documentos', () => {
    it('generateLevanteDocument devuelve la estructura del levante', async () => {
      const token = require('uuid').v4();
      await crearExpedientePortal({
        token,
        status: 'levante',
        extra: { declaration: { mrn: '25ES0028009999', type: 'H1', levanteDate: new Date() }, goods: [{ itemNumber: 1, description: 'X', quantity: 1, unit: 'KG', invoiceValue: 10 }] }
      });

      const doc = await service.generateLevanteDocument(token);
      expect(doc.type).toBe('levante');
      expect(doc.mrn).toBe('25ES0028009999');
      expect(doc.client.name).toBe('Importadora SL');
    });

    it('generateLevanteDocument lanza error sin MRN', async () => {
      const token = require('uuid').v4();
      await crearExpedientePortal({ token, status: 'levante', extra: { declaration: {} } });
      await expect(service.generateLevanteDocument(token)).rejects.toThrow(/No MRN available/);
    });

    it('generateDeclarationCopy devuelve la estructura de la declaracion', async () => {
      const token = require('uuid').v4();
      await crearExpedientePortal({ token, extra: { declaration: { mrn: 'M', lrn: 'L', type: 'H1', status: 'accepted' } } });

      const doc = await service.generateDeclarationCopy(token);
      expect(doc.type).toBe('declaration');
      expect(doc.mrn).toBe('M');
      expect(doc.declarant.name).toBe('Importadora SL');
    });
  });

  // --- getPendingPayments ----------------------------------------------------

  describe('getPendingPayments', () => {
    it('devuelve sin pagos pendientes cuando no hay importe calculado', async () => {
      const token = require('uuid').v4();
      await crearExpedientePortal({ token });

      const result = await service.getPendingPayments(token);
      expect(result.hasPendingPayment).toBe(false);
    });

    it('devuelve el desglose cuando hay importe y no hay pago previo', async () => {
      const token = require('uuid').v4();
      await crearExpedientePortal({
        token,
        extra: { calculations: { totalToPay: 300, totalDuties: 200, totalVat: 100 } }
      });

      const result = await service.getPendingPayments(token);
      expect(result.hasPendingPayment).toBe(true);
      expect(result.needsPaymentCreation).toBe(true);
      expect(result.breakdown.total).toBe(300);
      expect(result.breakdown.duties).toBe(200);
    });

    it('devuelve pagado cuando calculations.paid es true', async () => {
      const token = require('uuid').v4();
      const paidAt = new Date();
      await crearExpedientePortal({
        token,
        extra: { calculations: { totalToPay: 300, paid: true, paidAt } }
      });

      const result = await service.getPendingPayments(token);
      expect(result.hasPendingPayment).toBe(false);
      expect(result.message).toMatch(/ya ha sido realizado/);
    });
  });
});
