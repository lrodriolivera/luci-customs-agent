/**
 * Client Portal Service
 * Phase 6.7: Portal Cliente Avanzado
 * Advanced client portal features: self-service, stats, signed documents
 */

const logger = require('../config/logger');
const { Expedition, Payment, ChatMessage } = require('../models');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

class ClientPortalService {
  constructor() {
    this.uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads');
    this.signedDocsDir = path.join(this.uploadsDir, 'signed');
  }

  // ==================== Self-Service Operations ====================

  /**
   * Create new expedition from client portal (self-service)
   */
  async createExpeditionFromPortal(organizationId, clientData, operationData) {
    // Validate required fields
    if (!clientData.companyName) {
      throw new Error('Company name is required');
    }
    if (!operationData.operationType) {
      throw new Error('Operation type is required');
    }

    // Generate expedition ID
    const expeditionId = this.generateExpeditionId(operationData.operationType);

    // Generate portal token
    const portalToken = uuidv4();

    const expedition = new Expedition({
      expeditionId,
      organizationId,
      operationType: operationData.operationType,
      transportMode: operationData.transportMode || 'maritime',
      status: 'draft',

      // Client info
      client: {
        companyName: clientData.companyName,
        taxId: clientData.taxId,
        eoriNumber: clientData.eoriNumber,
        contact: {
          name: clientData.contactName,
          email: clientData.email,
          phone: clientData.phone
        },
        address: clientData.address || {}
      },

      // Operation details
      origin: {
        country: operationData.originCountry
      },
      destination: {
        country: operationData.destinationCountry || 'ES'
      },
      incoterm: operationData.incoterm || 'CIF',

      // Transport info (if provided)
      transport: operationData.transport || {},

      // Goods (basic info for now)
      goods: (operationData.goods || []).map((good, index) => ({
        itemNumber: index + 1,
        description: good.description,
        quantity: good.quantity || 1,
        unit: good.unit || 'KG',
        invoiceValue: good.value || 0,
        currency: good.currency || 'EUR',
        originCountry: good.originCountry || operationData.originCountry
      })),

      // Document checklist based on operation type
      documentChecklist: this.generateDocumentChecklist(operationData.operationType),

      // Portal configuration
      clientPortal: {
        token: portalToken,
        accessUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/portal/${portalToken}`,
        isActive: true,
        createdAt: new Date(),
        viewCount: 0
      },

      // Client notes
      clientNotes: operationData.notes,

      // Timeline
      timeline: [{
        action: 'created',
        description: 'Expediente creado por cliente via self-service',
        performedBy: 'client',
        metadata: {
          clientEmail: clientData.email,
          source: 'portal_self_service'
        }
      }],

      // Mark as created by client
      createdBy: 'portal_self_service'
    });

    await expedition.save();

    // Create welcome chat message
    const welcomeMessage = new ChatMessage({
      expedition: expedition._id,
      sender: 'luci',
      senderInfo: {
        name: 'LUCI',
        email: 'luci@strixai.es'
      },
      content: `¡Bienvenido! He creado el expediente ${expeditionId} para su operacion de ${this.getOperationTypeName(operationData.operationType)}.\n\nPuede subir los documentos necesarios en la seccion "Documentos". Estoy aqui para ayudarle con cualquier consulta.`,
      messageType: 'text'
    });
    await welcomeMessage.save();

    logger.info(`Self-service expedition created: ${expeditionId} by ${clientData.email}`);

    return {
      expeditionId: expedition.expeditionId,
      portalToken,
      portalUrl: expedition.clientPortal.accessUrl,
      status: expedition.status,
      documentChecklist: expedition.documentChecklist
    };
  }

  /**
   * Generate expedition ID
   */
  generateExpeditionId(operationType) {
    const prefix = operationType === 'import' ? 'IMP' : operationType === 'export' ? 'EXP' : 'TRA';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Get operation type display name
   */
  getOperationTypeName(type) {
    const names = {
      import: 'Importacion',
      export: 'Exportacion',
      transit: 'Transito'
    };
    return names[type] || type;
  }

  /**
   * Generate document checklist based on operation type
   */
  generateDocumentChecklist(operationType) {
    const baseChecklist = [
      { documentType: 'commercial_invoice', documentName: 'Factura Comercial', required: true },
      { documentType: 'packing_list', documentName: 'Packing List', required: true }
    ];

    const importChecklist = [
      ...baseChecklist,
      { documentType: 'bill_of_lading', documentName: 'Bill of Lading / AWB / CMR', required: true },
      { documentType: 'certificate_origin', documentName: 'Certificado de Origen', required: false, conditional: true, condition: 'Si aplica preferencia' }
    ];

    const exportChecklist = [
      ...baseChecklist,
      { documentType: 'bill_of_lading', documentName: 'Bill of Lading / AWB / CMR', required: false },
      { documentType: 'export_license', documentName: 'Licencia de Exportacion', required: false, conditional: true, condition: 'Si producto controlado' }
    ];

    const transitChecklist = [
      ...baseChecklist,
      { documentType: 'bill_of_lading', documentName: 'Documento de Transporte', required: true }
    ];

    switch (operationType) {
      case 'import':
        return importChecklist;
      case 'export':
        return exportChecklist;
      case 'transit':
        return transitChecklist;
      default:
        return baseChecklist;
    }
  }

  /**
   * Update expedition from portal
   */
  async updateExpeditionFromPortal(portalToken, updates) {
    const expedition = await Expedition.findByPortalToken(portalToken);
    if (!expedition) {
      throw new Error('Expedition not found');
    }

    // Only allow updates on draft expeditions
    if (expedition.status !== 'draft') {
      throw new Error('Cannot modify expedition in current status');
    }

    // Allowed fields for client update
    const allowedFields = ['clientNotes', 'goods', 'transport', 'incoterm'];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        expedition[field] = updates[field];
      }
    }

    // Update client contact if provided
    if (updates.contact) {
      expedition.client.contact = {
        ...expedition.client.contact,
        ...updates.contact
      };
    }

    expedition.timeline.push({
      action: 'updated',
      description: 'Expediente actualizado por cliente',
      performedBy: 'client'
    });

    await expedition.save();

    return expedition;
  }

  /**
   * Submit expedition for processing
   */
  async submitExpedition(portalToken) {
    const expedition = await Expedition.findByPortalToken(portalToken);
    if (!expedition) {
      throw new Error('Expedition not found');
    }

    if (expedition.status !== 'draft') {
      throw new Error('Expedition already submitted');
    }

    // Check if minimum required documents are uploaded
    const requiredDocs = expedition.documentChecklist.filter(d => d.required);
    const receivedRequiredDocs = requiredDocs.filter(d => d.received);

    if (receivedRequiredDocs.length < requiredDocs.length) {
      const missing = requiredDocs
        .filter(d => !d.received)
        .map(d => d.documentName);

      throw new Error(`Documentos requeridos faltantes: ${missing.join(', ')}`);
    }

    expedition.status = 'pending_documents';
    expedition.timeline.push({
      action: 'submitted',
      description: 'Expediente enviado para procesamiento por cliente',
      performedBy: 'client'
    });

    await expedition.save();

    // Notify chat
    const submitMessage = new ChatMessage({
      expedition: expedition._id,
      sender: 'luci',
      content: 'He recibido su expediente. Estoy revisando la documentacion y le notificare si necesito algo adicional.',
      messageType: 'system'
    });
    await submitMessage.save();

    logger.info(`Expedition submitted: ${expedition.expeditionId}`);

    return expedition;
  }

  // ==================== Client Statistics ====================

  /**
   * Get client statistics by portal token
   */
  async getClientStats(portalToken) {
    const expedition = await Expedition.findByPortalToken(portalToken);
    if (!expedition) {
      throw new Error('Expedition not found');
    }

    // Get all expeditions for this client email
    const clientEmail = expedition.client?.contact?.email;
    if (!clientEmail) {
      return this.getExpeditionStats(expedition);
    }

    // Get all client's expeditions
    const expeditions = await Expedition.find({
      'client.contact.email': clientEmail,
      organizationId: expedition.organizationId
    }).sort({ createdAt: -1 });

    return this.calculateClientStats(expeditions, clientEmail);
  }

  /**
   * Get statistics for a single expedition
   */
  getExpeditionStats(expedition) {
    const now = new Date();
    const createdAt = new Date(expedition.createdAt);
    const daysInProcess = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

    return {
      currentExpedition: {
        expeditionId: expedition.expeditionId,
        status: expedition.status,
        operationType: expedition.operationType,
        createdAt: expedition.createdAt,
        daysInProcess,
        documentCompletion: expedition.documentCompletion || 0
      },
      totals: {
        totalExpeditions: 1,
        completedExpeditions: expedition.status === 'completed' ? 1 : 0,
        pendingExpeditions: expedition.status !== 'completed' ? 1 : 0
      }
    };
  }

  /**
   * Calculate statistics for all client expeditions
   */
  calculateClientStats(expeditions, clientEmail) {
    const now = new Date();

    // Status counts
    const statusCounts = {};
    let totalDuties = 0;
    let totalVat = 0;
    let avgProcessingDays = 0;
    let completedCount = 0;

    const byOperationType = {
      import: 0,
      export: 0,
      transit: 0
    };

    const byChannel = {
      green: 0,
      orange: 0,
      red: 0
    };

    const recentExpeditions = [];
    const monthlyVolume = {};

    for (const exp of expeditions) {
      // Status counts
      statusCounts[exp.status] = (statusCounts[exp.status] || 0) + 1;

      // Operation type counts
      if (byOperationType[exp.operationType] !== undefined) {
        byOperationType[exp.operationType]++;
      }

      // Channel counts
      if (exp.declaration?.channel) {
        byChannel[exp.declaration.channel]++;
      }

      // Financial totals
      if (exp.calculations) {
        totalDuties += exp.calculations.dutyTotal || 0;
        totalVat += exp.calculations.vatTotal || 0;
      }

      // Processing time for completed
      if (exp.status === 'completed' && exp.completedAt) {
        const processingDays = Math.floor(
          (new Date(exp.completedAt) - new Date(exp.createdAt)) / (1000 * 60 * 60 * 24)
        );
        avgProcessingDays += processingDays;
        completedCount++;
      }

      // Monthly volume
      const monthKey = `${exp.createdAt.getFullYear()}-${String(exp.createdAt.getMonth() + 1).padStart(2, '0')}`;
      monthlyVolume[monthKey] = (monthlyVolume[monthKey] || 0) + 1;

      // Recent expeditions (last 10)
      if (recentExpeditions.length < 10) {
        recentExpeditions.push({
          expeditionId: exp.expeditionId,
          operationType: exp.operationType,
          status: exp.status,
          createdAt: exp.createdAt,
          mrn: exp.declaration?.mrn
        });
      }
    }

    // Calculate average processing time
    if (completedCount > 0) {
      avgProcessingDays = Math.round(avgProcessingDays / completedCount);
    }

    // Calculate green channel rate
    const totalChanneled = byChannel.green + byChannel.orange + byChannel.red;
    const greenChannelRate = totalChanneled > 0
      ? Math.round((byChannel.green / totalChanneled) * 100)
      : 0;

    return {
      clientEmail,
      summary: {
        totalExpeditions: expeditions.length,
        completedExpeditions: statusCounts['completed'] || 0,
        pendingExpeditions: expeditions.length - (statusCounts['completed'] || 0),
        avgProcessingDays
      },
      financial: {
        totalDuties,
        totalVat,
        totalPaid: totalDuties + totalVat,
        currency: 'EUR'
      },
      byOperationType,
      byChannel,
      channelAnalysis: {
        greenChannelRate,
        totalInspected: byChannel.orange + byChannel.red
      },
      byStatus: statusCounts,
      monthlyVolume: Object.entries(monthlyVolume)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 12)
        .map(([month, count]) => ({ month, count })),
      recentExpeditions
    };
  }

  /**
   * Get client history by email
   */
  async getClientHistory(organizationId, clientEmail, options = {}) {
    const { limit = 50, skip = 0, status, operationType } = options;

    const query = {
      organizationId,
      'client.contact.email': clientEmail
    };

    if (status) query.status = status;
    if (operationType) query.operationType = operationType;

    const expeditions = await Expedition.find(query)
      .select('expeditionId operationType status createdAt declaration.mrn declaration.channel client.companyName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Expedition.countDocuments(query);

    return {
      expeditions: expeditions.map(exp => ({
        expeditionId: exp.expeditionId,
        operationType: exp.operationType,
        status: exp.status,
        mrn: exp.declaration?.mrn,
        channel: exp.declaration?.channel,
        createdAt: exp.createdAt
      })),
      total,
      hasMore: skip + expeditions.length < total
    };
  }

  // ==================== Signed Documents ====================

  /**
   * Get signed/official documents for download
   */
  async getSignedDocuments(portalToken) {
    const expedition = await Expedition.findByPortalToken(portalToken);
    if (!expedition) {
      throw new Error('Expedition not found');
    }

    const signedDocs = [];

    // Check for levante (customs release)
    if (expedition.status === 'levante' || expedition.status === 'completed') {
      if (expedition.declaration?.mrn) {
        signedDocs.push({
          type: 'levante',
          name: 'Documento de Levante',
          description: 'Autorizacion de despacho aduanero',
          mrn: expedition.declaration.mrn,
          date: expedition.declaration.levanteDate,
          available: true,
          downloadUrl: `/api/portal/${portalToken}/signed-documents/levante`
        });
      }
    }

    // Check for declaration copy
    if (expedition.declaration?.status === 'accepted') {
      signedDocs.push({
        type: 'declaration',
        name: 'Copia de Declaracion',
        description: `DUA ${expedition.declaration.type || 'H1'}`,
        mrn: expedition.declaration.mrn,
        date: expedition.declaration.acceptanceDate,
        available: true,
        downloadUrl: `/api/portal/${portalToken}/signed-documents/declaration`
      });
    }

    // Check for payment receipts
    const payments = await Payment.find({
      portalToken,
      status: 'completed'
    });

    for (const payment of payments) {
      signedDocs.push({
        type: 'payment_receipt',
        name: 'Recibo de Pago',
        description: `Pago ${payment.paymentId}`,
        reference: payment.paymentId,
        date: payment.paidAt,
        amount: payment.totalAmount,
        available: true,
        downloadUrl: payment.stripe?.receiptUrl || `/api/portal/${portalToken}/signed-documents/payment/${payment.paymentId}`
      });
    }

    // Check for certificates
    const certificates = expedition.documents.filter(doc =>
      ['certificate_origin', 'eur1', 'eur_med', 'atr', 'form_a'].includes(doc.type) &&
      doc.status === 'validated'
    );

    for (const cert of certificates) {
      signedDocs.push({
        type: 'certificate',
        name: this.getCertificateName(cert.type),
        description: cert.originalName,
        date: cert.validatedAt,
        available: true,
        downloadUrl: `/api/portal/${portalToken}/documents/${cert._id}`
      });
    }

    return {
      expeditionId: expedition.expeditionId,
      mrn: expedition.declaration?.mrn,
      documents: signedDocs
    };
  }

  /**
   * Get certificate display name
   */
  getCertificateName(type) {
    const names = {
      certificate_origin: 'Certificado de Origen',
      eur1: 'Certificado EUR.1',
      eur_med: 'Certificado EUR-MED',
      atr: 'Certificado ATR',
      form_a: 'Form A (SGP)'
    };
    return names[type] || 'Certificado';
  }

  /**
   * Generate levante document PDF
   */
  async generateLevanteDocument(portalToken) {
    const expedition = await Expedition.findByPortalToken(portalToken);
    if (!expedition) {
      throw new Error('Expedition not found');
    }

    if (!expedition.declaration?.mrn) {
      throw new Error('No MRN available');
    }

    // In a real implementation, this would generate a PDF
    // For now, return structured data that can be rendered
    return {
      type: 'levante',
      title: 'DOCUMENTO DE LEVANTE',
      expeditionId: expedition.expeditionId,
      mrn: expedition.declaration.mrn,
      declarationType: expedition.declaration.type,
      customsOffice: expedition.declaration.customsOffice || 'ES002800',
      acceptanceDate: expedition.declaration.acceptanceDate,
      levanteDate: expedition.declaration.levanteDate,
      client: {
        name: expedition.client.companyName,
        taxId: expedition.client.taxId,
        eori: expedition.client.eoriNumber
      },
      goods: expedition.goods.map(g => ({
        description: g.description,
        quantity: g.quantity,
        unit: g.unit,
        taricCode: g.taricCode,
        origin: g.originCountry
      })),
      totals: {
        invoiceValue: expedition.calculations?.invoiceTotalEur,
        duties: expedition.calculations?.dutyTotal,
        vat: expedition.calculations?.vatTotal,
        total: expedition.calculations?.totalToPay
      },
      generatedAt: new Date(),
      disclaimer: 'Documento generado electronicamente. Verificable en sede electronica AEAT.'
    };
  }

  /**
   * Generate declaration copy
   */
  async generateDeclarationCopy(portalToken) {
    const expedition = await Expedition.findByPortalToken(portalToken);
    if (!expedition) {
      throw new Error('Expedition not found');
    }

    return {
      type: 'declaration',
      title: `DECLARACION ADUANERA ${expedition.declaration?.type || 'H1'}`,
      mrn: expedition.declaration?.mrn,
      lrn: expedition.declaration?.lrn,
      regime: expedition.declaration?.regime,
      status: expedition.declaration?.status,
      submittedAt: expedition.declaration?.submittedAt,
      acceptanceDate: expedition.declaration?.acceptanceDate,
      customsOffice: expedition.declaration?.customsOffice,
      declarant: {
        name: expedition.client.companyName,
        taxId: expedition.client.taxId,
        eori: expedition.client.eoriNumber
      },
      items: expedition.goods.length,
      generatedAt: new Date()
    };
  }

  // ==================== Payment Integration ====================

  /**
   * Get pending payments for portal
   */
  async getPendingPayments(portalToken) {
    const expedition = await Expedition.findByPortalToken(portalToken);
    if (!expedition) {
      throw new Error('Expedition not found');
    }

    // Check if there's a calculated amount to pay
    if (!expedition.calculations?.totalToPay || expedition.calculations.totalToPay <= 0) {
      return {
        hasPendingPayment: false,
        message: 'No hay pagos pendientes para este expediente'
      };
    }

    // Check if already paid
    if (expedition.calculations?.paid) {
      return {
        hasPendingPayment: false,
        message: 'El pago ya ha sido realizado',
        paidAt: expedition.calculations.paidAt
      };
    }

    // Check for existing pending payment
    const existingPayment = await Payment.findOne({
      'items.expeditionId': expedition._id,
      status: { $in: ['pending', 'processing'] }
    });

    if (existingPayment) {
      return {
        hasPendingPayment: true,
        payment: existingPayment.toClientSummary(),
        paymentId: existingPayment.paymentId
      };
    }

    // Return calculation breakdown
    return {
      hasPendingPayment: true,
      needsPaymentCreation: true,
      breakdown: {
        duties: expedition.calculations.dutyTotal || 0,
        vat: expedition.calculations.vatTotal || 0,
        specialTaxes: expedition.calculations.specialTaxTotal || 0,
        total: expedition.calculations.totalToPay,
        currency: 'EUR'
      },
      expeditionId: expedition._id
    };
  }
}

module.exports = new ClientPortalService();
