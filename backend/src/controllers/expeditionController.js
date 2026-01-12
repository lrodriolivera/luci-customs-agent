const { Expedition, ChatMessage } = require('../models');
const logger = require('../config/logger');
const documentChecklists = require('../utils/documentChecklists');
const emailService = require('../services/emailService');

/**
 * Crear nuevo expediente
 * POST /api/expeditions
 */
const create = async (req, res) => {
  try {
    let {
      operationType,
      transportMode,
      client,
      exporter,
      importer,
      consignee,
      goods,
      transport,
      incoterm,
      incotermPlace,
      priority,
      clientReference,
      internalNotes
    } = req.body;

    // Transform client structure if needed (frontend sends flat structure)
    if (client) {
      // Map frontend client structure to backend expected structure
      const transformedClient = {
        companyName: client.companyName,
        nif: client.nif?.toUpperCase(),
        eori: client.eori || (client.nif ? `ES${client.nif.toUpperCase()}` : ''),
        address: client.address ? {
          street: client.address,
          city: client.city || '',
          postalCode: client.postalCode || '',
          country: client.country || 'ES'
        } : undefined,
        contact: {
          name: client.contactPerson || client.contact?.name || '',
          email: client.email || client.contact?.email || '',
          phone: client.phone || client.contact?.phone || ''
        }
      };
      client = transformedClient;
    }

    // Transform consignee structure if needed (frontend sends flat structure with string address)
    if (consignee) {
      const transformedConsignee = {
        companyName: consignee.companyName || undefined,
        nif: consignee.nif || undefined,
        eori: consignee.eori || undefined,
        // Only set address if it's a non-empty string or object
        address: (consignee.address && typeof consignee.address === 'string') ? {
          street: consignee.address,
          city: consignee.city || '',
          postalCode: consignee.postalCode || '',
          country: consignee.country || ''
        } : (consignee.address && typeof consignee.address === 'object') ? consignee.address : undefined
      };
      // Remove undefined fields
      Object.keys(transformedConsignee).forEach(key => {
        if (transformedConsignee[key] === undefined || transformedConsignee[key] === '') {
          delete transformedConsignee[key];
        }
      });
      consignee = Object.keys(transformedConsignee).length > 0 ? transformedConsignee : undefined;
    }

    // Transform importer structure similarly
    if (importer && importer.address && typeof importer.address === 'string') {
      importer = {
        ...importer,
        address: importer.address ? {
          street: importer.address,
          city: importer.city || '',
          postalCode: importer.postalCode || '',
          country: importer.country || ''
        } : undefined
      };
    }

    // Transform incoterm if sent as string
    if (typeof incoterm === 'string') {
      incoterm = {
        code: incoterm,
        place: incotermPlace || ''
      };
    }

    // Transform goods - add itemNumber if missing
    if (goods && Array.isArray(goods)) {
      goods = goods.map((item, index) => ({
        ...item,
        itemNumber: item.itemNumber || index + 1,
        description: item.description || '',
        quantity: parseFloat(item.quantity) || 1,
        invoiceValue: parseFloat(item.invoiceValue) || 0,
        netWeight: parseFloat(item.netWeight) || 0,
        grossWeight: parseFloat(item.grossWeight) || 0,
        originCountry: item.originCountry?.toUpperCase() || ''
      }));
    }

    // Crear expediente
    const expedition = new Expedition({
      operationType,
      transportMode,
      client,
      exporter,
      importer,
      consignee,
      goods: goods || [],
      transport: transport || {},
      incoterm: incoterm || {},
      priority: priority || 'normal',
      clientReference,
      internalNotes,
      status: 'draft',
      createdBy: req.user._id,
      assignedTo: req.user._id,
      representative: {
        companyName: req.user.profile?.company || 'Stock Logistic',
        nif: req.user.profile?.eoriNumber?.replace('ES', '') || '',
        eori: req.user.profile?.eoriNumber || '',
        representationType: 'indirect'
      }
    });

    // Generar checklist de documentos automaticamente
    const checklist = documentChecklists.getChecklist(
      operationType,
      transportMode,
      goods
    );
    expedition.documentChecklist = checklist;

    // Agregar evento al timeline
    expedition.timeline.push({
      action: 'expedition_created',
      description: 'Expediente creado',
      userId: req.user._id,
      performedBy: req.user.name
    });

    await expedition.save();

    logger.info(`Expediente creado: ${expedition.expeditionId} por ${req.user.email}`);

    res.status(201).json({
      success: true,
      data: expedition
    });

  } catch (error) {
    logger.error('Error creando expediente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear expediente'
    });
  }
};

/**
 * Listar expedientes
 * GET /api/expeditions
 */
const list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      operationType,
      transportMode,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      assignedTo
    } = req.query;

    // Construir query
    const query = {};

    if (status) {
      query.status = { $in: status.split(',') };
    }
    if (operationType) {
      query.operationType = operationType;
    }
    if (transportMode) {
      query.transportMode = transportMode;
    }
    if (assignedTo) {
      query.assignedTo = assignedTo;
    }
    if (search) {
      query.$or = [
        { expeditionId: new RegExp(search, 'i') },
        { 'client.companyName': new RegExp(search, 'i') },
        { 'client.nif': new RegExp(search, 'i') },
        { clientReference: new RegExp(search, 'i') }
      ];
    }

    // Si no es admin, solo ver sus expedientes
    if (req.user.role !== 'admin') {
      query.$or = [
        { assignedTo: req.user._id },
        { createdBy: req.user._id }
      ];
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const expeditions = await Expedition.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('assignedTo', 'name email')
      .lean();

    const total = await Expedition.countDocuments(query);

    // Agregar conteo de documentos y mensajes no leidos
    const expeditionsWithStats = await Promise.all(
      expeditions.map(async (exp) => {
        const unreadMessages = await ChatMessage.getUnreadCount(exp._id, 'agent');
        return {
          ...exp,
          documentCompletion: calculateDocumentCompletion(exp.documentChecklist),
          unreadMessages
        };
      })
    );

    res.json({
      success: true,
      data: {
        expeditions: expeditionsWithStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Error listando expedientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al listar expedientes'
    });
  }
};

/**
 * Obtener expediente por ID
 * GET /api/expeditions/:id
 */
const getById = async (req, res) => {
  try {
    const expedition = await Expedition.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('documents.uploadedBy', 'name')
      .populate('documents.validatedBy', 'name');

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    res.json({
      success: true,
      data: expedition
    });

  } catch (error) {
    logger.error('Error obteniendo expediente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener expediente'
    });
  }
};

/**
 * Actualizar expediente
 * PUT /api/expeditions/:id
 */
const update = async (req, res) => {
  try {
    const expedition = await Expedition.findById(req.params.id);

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    // Campos actualizables
    const allowedUpdates = [
      'client', 'exporter', 'importer', 'consignee', 'representative',
      'goods', 'transport', 'incoterm', 'priority', 'status',
      'clientReference', 'supplierReference', 'internalNotes', 'clientNotes',
      'estimatedArrival', 'assignedTo'
    ];

    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Si cambia el status, agregar al timeline
    if (updates.status && updates.status !== expedition.status) {
      expedition.timeline.push({
        action: 'status_change',
        description: `Estado cambiado de ${expedition.status} a ${updates.status}`,
        userId: req.user._id,
        performedBy: req.user.name,
        metadata: { oldStatus: expedition.status, newStatus: updates.status }
      });
    }

    Object.assign(expedition, updates);
    await expedition.save();

    logger.info(`Expediente actualizado: ${expedition.expeditionId}`);

    res.json({
      success: true,
      data: expedition
    });

  } catch (error) {
    logger.error('Error actualizando expediente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar expediente'
    });
  }
};

/**
 * Eliminar expediente
 * DELETE /api/expeditions/:id
 */
const remove = async (req, res) => {
  try {
    const expedition = await Expedition.findById(req.params.id);

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    // Solo se pueden eliminar expedientes en estado draft o cancelled
    if (!['draft', 'cancelled'].includes(expedition.status)) {
      return res.status(400).json({
        success: false,
        error: 'Solo se pueden eliminar expedientes en estado borrador o cancelado'
      });
    }

    await expedition.deleteOne();

    logger.info(`Expediente eliminado: ${expedition.expeditionId}`);

    res.json({
      success: true,
      message: 'Expediente eliminado correctamente'
    });

  } catch (error) {
    logger.error('Error eliminando expediente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar expediente'
    });
  }
};

/**
 * Obtener checklist de documentos
 * GET /api/expeditions/:id/checklist
 */
const getChecklist = async (req, res) => {
  try {
    const expedition = await Expedition.findById(req.params.id);

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    // Si no tiene checklist, generarlo
    if (!expedition.documentChecklist || expedition.documentChecklist.length === 0) {
      const checklist = documentChecklists.getChecklist(
        expedition.operationType,
        expedition.transportMode,
        expedition.goods
      );
      expedition.documentChecklist = checklist;
      await expedition.save();
    }

    // Definiciones de nombres de documentos
    const DOCUMENT_DEFINITIONS = {
      commercial_invoice: 'Factura Comercial',
      packing_list: 'Packing List',
      bill_of_lading: 'Bill of Lading (BL)',
      air_waybill: 'Air Waybill (AWB)',
      cmr: 'CMR',
      dispatch_authorization: 'Autorizacion Despacho',
      certificate_origin: 'Certificado Origen',
      eur1: 'EUR.1',
      atr: 'ATR',
      form_a: 'Form A / REX',
      sanitary_certificate: 'Certificado Sanitario',
      phytosanitary_certificate: 'Certificado Fitosanitario',
      veterinary_certificate: 'Certificado Veterinario',
      insurance_certificate: 'Certificado Seguro'
    };

    // Mapear a formato esperado por frontend
    const checklistForFrontend = expedition.documentChecklist.map(item => ({
      name: item.documentName || item.displayName || DOCUMENT_DEFINITIONS[item.documentType] || item.documentType,
      documentType: item.documentType,
      required: item.required,
      uploaded: item.received || false,
      documentId: item.documentId || null
    }));

    res.json({
      success: true,
      data: {
        checklist: checklistForFrontend,
        expeditionId: expedition.expeditionId
      }
    });

  } catch (error) {
    logger.error('Error obteniendo checklist:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener checklist'
    });
  }
};

/**
 * Regenerar checklist de documentos
 * POST /api/expeditions/:id/checklist
 */
const regenerateChecklist = async (req, res) => {
  try {
    const expedition = await Expedition.findById(req.params.id);

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    const checklist = documentChecklists.getChecklist(
      expedition.operationType,
      expedition.transportMode,
      expedition.goods
    );

    // Mantener estado de documentos ya recibidos
    const existingDocs = {};
    expedition.documentChecklist.forEach(item => {
      if (item.received) {
        existingDocs[item.documentType] = item;
      }
    });

    expedition.documentChecklist = checklist.map(item => {
      if (existingDocs[item.documentType]) {
        return { ...item, ...existingDocs[item.documentType] };
      }
      return item;
    });

    await expedition.save();

    res.json({
      success: true,
      data: expedition.documentChecklist
    });

  } catch (error) {
    logger.error('Error regenerando checklist:', error);
    res.status(500).json({
      success: false,
      error: 'Error al regenerar checklist'
    });
  }
};

/**
 * Enviar link del portal al cliente
 * POST /api/expeditions/:id/send-portal-link
 */
const sendPortalLink = async (req, res) => {
  try {
    const expedition = await Expedition.findById(req.params.id);

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    const clientEmail = req.body.email || expedition.client.contact?.email;

    if (!clientEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email del cliente no proporcionado'
      });
    }

    // Regenerar token si ha expirado
    if (expedition.clientPortal.expiresAt && expedition.clientPortal.expiresAt < new Date()) {
      expedition.clientPortal.token = require('uuid').v4();
      expedition.clientPortal.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias
    }

    // Enviar email
    await emailService.sendPortalLink(
      clientEmail,
      expedition.client.companyName,
      expedition.portalUrl,
      expedition.expeditionId,
      expedition.operationType
    );

    // Registrar en comunicaciones
    expedition.communications.push({
      type: 'email',
      subject: 'Link de acceso al portal de documentacion',
      content: `Portal link enviado a ${clientEmail}`,
      sentAt: new Date(),
      sentTo: clientEmail,
      sentBy: req.user._id
    });

    // Timeline
    expedition.timeline.push({
      action: 'portal_link_sent',
      description: `Link del portal enviado a ${clientEmail}`,
      userId: req.user._id,
      performedBy: req.user.name
    });

    await expedition.save();

    logger.info(`Portal link enviado: ${expedition.expeditionId} -> ${clientEmail}`);

    res.json({
      success: true,
      message: 'Link enviado correctamente',
      portalUrl: expedition.portalUrl
    });

  } catch (error) {
    logger.error('Error enviando portal link:', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar link del portal'
    });
  }
};

/**
 * Obtener estadisticas
 * GET /api/expeditions/stats
 */
const getStats = async (req, res) => {
  try {
    const userId = req.user.role === 'admin' ? null : req.user._id;
    const stats = await Expedition.getStats(userId);

    // Estadisticas adicionales
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query = userId ? { assignedTo: userId } : {};

    const [createdToday, pendingDocuments, readyForDeclaration] = await Promise.all([
      Expedition.countDocuments({ ...query, createdAt: { $gte: today } }),
      Expedition.countDocuments({ ...query, status: 'pending_documents' }),
      Expedition.countDocuments({ ...query, status: 'ready_for_declaration' })
    ]);

    res.json({
      success: true,
      data: {
        byStatus: stats,
        summary: {
          createdToday,
          pendingDocuments,
          readyForDeclaration,
          total: Object.values(stats).reduce((a, b) => a + b, 0)
        }
      }
    });

  } catch (error) {
    logger.error('Error obteniendo estadisticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadisticas'
    });
  }
};

// Utilidades
function calculateDocumentCompletion(checklist) {
  if (!checklist || checklist.length === 0) return 0;
  const required = checklist.filter(d => d.required);
  if (required.length === 0) return 100;
  const received = required.filter(d => d.received).length;
  return Math.round((received / required.length) * 100);
}

module.exports = {
  create,
  list,
  getById,
  update,
  remove,
  getChecklist,
  regenerateChecklist,
  sendPortalLink,
  getStats
};
