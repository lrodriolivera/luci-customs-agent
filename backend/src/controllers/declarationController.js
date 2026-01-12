const { Expedition } = require('../models');
const logger = require('../config/logger');
const aiService = require('../services/aiService');
const h1Generator = require('../services/forms/h1Generator');
const aesGenerator = require('../services/forms/aesGenerator');
const h7Generator = require('../services/forms/h7Generator');
const aeatService = require('../services/aeatService');
const channelService = require('../services/channelService');

/**
 * Generar declaracion H1 (Importacion)
 * POST /api/declarations/h1/generate
 */
const generateH1 = async (req, res) => {
  try {
    const { expeditionId, regime, additionalProcedure, preference } = req.body;

    const expedition = await Expedition.findById(expeditionId)
      .populate('documents');

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    if (expedition.operationType !== 'import') {
      return res.status(400).json({
        success: false,
        error: 'H1 solo es aplicable para importaciones'
      });
    }

    // Verificar documentos minimos
    const requiredDocs = ['commercial_invoice', 'packing_list'];
    const transportDocs = ['bill_of_lading', 'air_waybill', 'cmr'];

    const hasRequiredDocs = requiredDocs.every(type =>
      expedition.documents.some(d => d.type === type && d.status === 'validated')
    );

    const hasTransportDoc = transportDocs.some(type =>
      expedition.documents.some(d => d.type === type)
    );

    if (!hasRequiredDocs || !hasTransportDoc) {
      return res.status(400).json({
        success: false,
        error: 'Faltan documentos obligatorios validados (factura, packing list, documento transporte)'
      });
    }

    // Verificar clasificacion
    const allClassified = expedition.goods.every(g => g.taricCode);
    if (!allClassified) {
      return res.status(400).json({
        success: false,
        error: 'Todos los items deben tener codigo TARIC asignado'
      });
    }

    // Generar H1 con IA
    const h1Data = await aiService.generateH1Declaration(expedition, {
      regime: regime || '40',
      additionalProcedure: additionalProcedure || '000',
      preference: preference || '100'
    });

    // Generar estructura H1 completa
    const h1Declaration = h1Generator.generate(expedition, h1Data);

    // Actualizar expediente
    expedition.declaration = {
      type: 'H1',
      declarationType: h1Data.declarationType || 'A',
      lrn: h1Declaration.lrn,
      regime: regime || '40',
      additionalProcedure: additionalProcedure || '000',
      preference: preference || '100',
      customsOffice: h1Data.customsOffice || expedition.transport?.entryCustomsOffice,
      declarationDate: new Date(),
      status: 'draft',
      xmlContent: h1Declaration.xml
    };

    expedition.status = 'declaration_draft';

    // Timeline
    expedition.timeline.push({
      action: 'h1_generated',
      description: 'Declaracion H1 generada automaticamente',
      userId: req.user._id,
      performedBy: req.user.name,
      metadata: { lrn: h1Declaration.lrn, regime }
    });

    await expedition.save();

    logger.info(`H1 generado: ${expedition.expeditionId}`);

    res.json({
      success: true,
      data: {
        declaration: expedition.declaration,
        h1Data: h1Declaration.data,
        warnings: h1Data.warnings,
        summary: h1Declaration.summary
      }
    });

  } catch (error) {
    logger.error('Error generando H1:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar declaracion H1'
    });
  }
};

/**
 * Generar declaracion AES (Exportacion)
 * POST /api/declarations/aes/generate
 */
const generateAES = async (req, res) => {
  try {
    const { expeditionId, exportType } = req.body;

    const expedition = await Expedition.findById(expeditionId)
      .populate('documents');

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    if (expedition.operationType !== 'export') {
      return res.status(400).json({
        success: false,
        error: 'AES solo es aplicable para exportaciones'
      });
    }

    // Generar AES con IA
    const aesData = await aiService.generateAESDeclaration(expedition, {
      exportType: exportType || '10'
    });

    // Generar estructura AES completa
    const aesDeclaration = aesGenerator.generate(expedition, aesData);

    // Actualizar expediente
    expedition.declaration = {
      type: 'AES',
      declarationType: aesData.declarationType || 'EX',
      lrn: aesDeclaration.lrn,
      regime: exportType || '10',
      customsOffice: aesData.customsOffice,
      declarationDate: new Date(),
      status: 'draft',
      xmlContent: aesDeclaration.xml
    };

    expedition.status = 'declaration_draft';

    // Timeline
    expedition.timeline.push({
      action: 'aes_generated',
      description: 'Declaracion AES generada automaticamente',
      userId: req.user._id,
      performedBy: req.user.name,
      metadata: { lrn: aesDeclaration.lrn }
    });

    await expedition.save();

    logger.info(`AES generado: ${expedition.expeditionId}`);

    res.json({
      success: true,
      data: {
        declaration: expedition.declaration,
        aesData: aesDeclaration.data,
        warnings: aesData.warnings
      }
    });

  } catch (error) {
    logger.error('Error generando AES:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar declaracion AES'
    });
  }
};

/**
 * Obtener XML de declaracion
 * GET /api/declarations/:expeditionId/xml
 */
const getXML = async (req, res) => {
  try {
    const { expeditionId } = req.params;

    const expedition = await Expedition.findById(expeditionId);

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    if (!expedition.declaration || !expedition.declaration.xmlContent) {
      return res.status(404).json({
        success: false,
        error: 'No hay declaracion generada para este expediente'
      });
    }

    res.set('Content-Type', 'application/xml');
    res.set('Content-Disposition', `attachment; filename="${expedition.expeditionId}_${expedition.declaration.type}.xml"`);
    res.send(expedition.declaration.xmlContent);

  } catch (error) {
    logger.error('Error obteniendo XML:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener XML de declaracion'
    });
  }
};

/**
 * Actualizar declaracion manualmente
 * PUT /api/declarations/:expeditionId
 */
const updateDeclaration = async (req, res) => {
  try {
    const { expeditionId } = req.params;
    const updates = req.body;

    const expedition = await Expedition.findById(expeditionId);

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    if (!expedition.declaration) {
      return res.status(404).json({
        success: false,
        error: 'No hay declaracion para actualizar'
      });
    }

    // Campos actualizables
    const allowedFields = [
      'regime', 'additionalProcedure', 'preference', 'customsOffice',
      'declarationType'
    ];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        expedition.declaration[field] = updates[field];
      }
    });

    // Regenerar XML si hay cambios
    if (Object.keys(updates).length > 0) {
      if (expedition.declaration.type === 'H1') {
        const h1Declaration = h1Generator.generate(expedition, {
          ...expedition.declaration,
          ...updates
        });
        expedition.declaration.xmlContent = h1Declaration.xml;
      } else if (expedition.declaration.type === 'AES') {
        const aesDeclaration = aesGenerator.generate(expedition, {
          ...expedition.declaration,
          ...updates
        });
        expedition.declaration.xmlContent = aesDeclaration.xml;
      }
    }

    // Timeline
    expedition.timeline.push({
      action: 'declaration_updated',
      description: 'Declaracion actualizada manualmente',
      userId: req.user._id,
      performedBy: req.user.name,
      metadata: { updates }
    });

    await expedition.save();

    res.json({
      success: true,
      data: expedition.declaration
    });

  } catch (error) {
    logger.error('Error actualizando declaracion:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar declaracion'
    });
  }
};

/**
 * Enviar declaracion a AEAT
 * POST /api/declarations/:expeditionId/submit
 *
 * Este endpoint envia la declaracion H1/AES a AEAT via Web Services
 * En modo demo (sin certificado configurado), simula la respuesta
 */
const submitDeclaration = async (req, res) => {
  try {
    const { expeditionId } = req.params;

    const expedition = await Expedition.findById(expeditionId);

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    if (!expedition.declaration || !expedition.declaration.xmlContent) {
      return res.status(400).json({
        success: false,
        error: 'No hay declaracion generada para enviar. Primero genere el H1/AES.'
      });
    }

    if (expedition.declaration.status === 'submitted') {
      return res.status(400).json({
        success: false,
        error: `Declaracion ya enviada. MRN: ${expedition.declaration.mrn}`
      });
    }

    // Enviar a AEAT usando el servicio de integracion
    logger.info(`Enviando declaracion ${expedition.declaration.type} a AEAT...`);

    const aeatResponse = await aeatService.submitH1(
      expedition.declaration.xmlContent,
      {
        expeditionId: expedition.expeditionId,
        declarationType: expedition.declaration.type
      }
    );

    if (!aeatResponse.success) {
      return res.status(400).json({
        success: false,
        error: aeatResponse.message || 'Error en respuesta de AEAT',
        aeatResponse
      });
    }

    // Actualizar declaracion con respuesta AEAT
    expedition.declaration.status = 'submitted';
    expedition.declaration.mrn = aeatResponse.mrn;
    expedition.declaration.submittedAt = new Date();
    expedition.declaration.acceptanceDate = aeatResponse.acceptanceDate;
    expedition.declaration.channel = aeatResponse.channel;

    // Guardar respuesta completa de AEAT
    expedition.declaration.aeatResponse = {
      responseCode: aeatResponse.aeatResponse?.code,
      responseDescription: aeatResponse.aeatResponse?.description,
      timestamp: aeatResponse.aeatResponse?.timestamp,
      simulated: aeatResponse.simulated || false
    };

    // Actualizar status del expediente segun canal
    const statusByChannel = {
      green: 'green_channel',
      orange: 'orange_channel',
      red: 'red_channel'
    };
    expedition.status = statusByChannel[aeatResponse.channel] || 'declaration_submitted';

    // Timeline - envio a AEAT
    if (!expedition.timeline) expedition.timeline = [];
    expedition.timeline.push({
      action: 'declaration_submitted',
      description: `Declaracion ${expedition.declaration.type} enviada a AEAT`,
      userId: req.user?._id,
      performedBy: req.user?.name || 'Sistema',
      timestamp: new Date(),
      metadata: {
        mrn: aeatResponse.mrn,
        channel: aeatResponse.channel,
        simulated: aeatResponse.simulated
      }
    });

    await expedition.save();

    // Procesar canal asignado (crear requerimientos automaticos, generar levante, etc.)
    let channelResult = null;
    try {
      channelResult = await channelService.processChannelAssignment(
        expedition._id,
        aeatResponse.channel,
        aeatResponse,
        req.user
      );
      logger.info(`Channel processed: ${aeatResponse.channel}`, channelResult);
    } catch (channelError) {
      logger.error('Error processing channel:', channelError);
      // No interrumpimos el flujo, el canal se puede procesar manualmente
    }

    logger.info(`Declaracion enviada: ${expedition.expeditionId} - MRN: ${aeatResponse.mrn} - Canal: ${aeatResponse.channel}`);

    // Mensaje segun canal
    const channelMessages = {
      green: 'CANAL VERDE - Levante autorizado. Mercancia puede retirarse.',
      orange: 'CANAL NARANJA - Revision documental requerida. Pendiente de validacion.',
      red: 'CANAL ROJO - Inspeccion fisica requerida. Mercancia retenida.'
    };

    // Recargar expediente para obtener datos actualizados del channelService
    const updatedExpedition = await Expedition.findById(expedition._id);

    res.json({
      success: true,
      data: {
        mrn: aeatResponse.mrn,
        lrn: updatedExpedition.declaration.lrn,
        channel: aeatResponse.channel,
        channelDescription: channelMessages[aeatResponse.channel],
        status: updatedExpedition.status,
        declaration: updatedExpedition.declaration,
        duties: aeatResponse.duties,
        estimatedRelease: aeatResponse.estimatedRelease,
        simulated: aeatResponse.simulated,
        message: aeatResponse.simulated
          ? `[MODO DEMO] ${channelMessages[aeatResponse.channel]}`
          : channelMessages[aeatResponse.channel],
        // Datos adicionales del procesamiento de canal
        channelProcessing: channelResult ? {
          actions: channelResult.actions,
          requirementId: channelResult.requirementId,
          requirementNumber: channelResult.requirementNumber,
          levanteNumber: channelResult.levanteNumber,
          levanteDate: channelResult.levanteDate,
          pendingCertificates: channelResult.pendingCertificates
        } : null
      }
    });

  } catch (error) {
    logger.error('Error enviando declaracion a AEAT:', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar declaracion: ' + error.message
    });
  }
};

/**
 * Generar H1 directamente (modo demo - sin validaciones estrictas)
 * POST /api/declarations/h1/generate-direct
 */
const generateH1Direct = async (req, res) => {
  try {
    const { expeditionId, regime, additionalProcedure, preference } = req.body;

    const expedition = await Expedition.findById(expeditionId);

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    if (expedition.operationType !== 'import') {
      return res.status(400).json({
        success: false,
        error: 'H1 solo es aplicable para importaciones'
      });
    }

    // Calcular totales si no existen
    if (!expedition.goodsSummary || !expedition.goodsSummary.totalValue) {
      expedition.goodsSummary = {
        totalItems: expedition.goods?.length || 0,
        totalPackages: expedition.goods?.reduce((sum, g) => sum + (g.packages?.quantity || 1), 0) || 0,
        totalGrossWeight: expedition.goods?.reduce((sum, g) => sum + (g.grossWeight || 0), 0) || 0,
        totalNetWeight: expedition.goods?.reduce((sum, g) => sum + (g.netWeight || 0), 0) || 0,
        totalValue: expedition.goods?.reduce((sum, g) => sum + (g.invoiceValue || 0), 0) || 0
      };
    }

    // Generar H1 directamente con h1Generator
    const h1Declaration = h1Generator.generate(expedition, {
      regime: regime || expedition.declaration?.regime || '40',
      additionalProcedure: additionalProcedure || '000',
      preference: preference || expedition.declaration?.preference || '100'
    });

    // Actualizar expediente
    expedition.declaration = {
      type: 'H1',
      declarationType: 'A',
      lrn: h1Declaration.lrn,
      regime: regime || '40',
      additionalProcedure: additionalProcedure || '000',
      preference: preference || '100',
      customsOffice: h1Declaration.data.declarationHeader.customsOfficePresentation,
      declarationDate: new Date(),
      status: 'draft',
      xmlContent: h1Declaration.xml,
      h1Data: h1Declaration.data
    };

    expedition.status = 'ready_for_declaration';

    // Timeline
    if (!expedition.timeline) expedition.timeline = [];
    expedition.timeline.push({
      action: 'h1_generated',
      description: 'Declaracion H1 generada',
      userId: req.user?._id,
      performedBy: req.user?.name || 'Sistema',
      timestamp: new Date(),
      metadata: { lrn: h1Declaration.lrn, regime: regime || '40' }
    });

    await expedition.save();

    logger.info(`H1 generado (directo): ${expedition.expeditionId} - LRN: ${h1Declaration.lrn}`);

    res.json({
      success: true,
      data: {
        declaration: expedition.declaration,
        h1Data: h1Declaration.data,
        xml: h1Declaration.xml,
        summary: h1Declaration.summary,
        warnings: []
      }
    });

  } catch (error) {
    logger.error('Error generando H1 directo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar declaracion H1: ' + error.message
    });
  }
};

/**
 * Obtener resumen de declaracion
 * GET /api/declarations/:expeditionId/summary
 */
const getDeclarationSummary = async (req, res) => {
  try {
    const { expeditionId } = req.params;

    const expedition = await Expedition.findById(expeditionId);

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    if (!expedition.declaration) {
      return res.status(404).json({
        success: false,
        error: 'No hay declaracion para este expediente'
      });
    }

    // Calcular totales
    const totals = {
      items: expedition.goods.length,
      totalValue: expedition.goodsSummary.totalValue,
      totalDuties: expedition.goods.reduce((sum, g) => sum + (g.dutyAmount || 0), 0),
      totalVat: expedition.goods.reduce((sum, g) => sum + (g.vatAmount || 0), 0),
      totalTaxes: 0
    };
    totals.totalTaxes = totals.totalDuties + totals.totalVat;

    const summary = {
      expeditionId: expedition.expeditionId,
      declarationType: expedition.declaration.type,
      mrn: expedition.declaration.mrn,
      lrn: expedition.declaration.lrn,
      status: expedition.declaration.status,
      channel: expedition.declaration.channel,
      regime: expedition.declaration.regime,
      preference: expedition.declaration.preference,
      importer: expedition.importer?.companyName || expedition.client.companyName,
      exporter: expedition.exporter?.companyName,
      customsOffice: expedition.declaration.customsOffice,
      dates: {
        declaration: expedition.declaration.declarationDate,
        submitted: expedition.declaration.submittedAt,
        acceptance: expedition.declaration.acceptanceDate,
        levante: expedition.declaration.levanteDate
      },
      totals,
      goods: expedition.goods.map((g, i) => ({
        item: i + 1,
        description: g.description,
        taricCode: g.taricCode,
        origin: g.originCountry,
        value: g.invoiceValue,
        weight: g.netWeight,
        duty: g.dutyAmount,
        vat: g.vatAmount
      }))
    };

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    logger.error('Error obteniendo resumen:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener resumen de declaracion'
    });
  }
};

/**
 * Verificar elegibilidad para H7
 * GET /api/declarations/h7/check-eligibility/:expeditionId
 */
const checkH7Eligibility = async (req, res) => {
  try {
    const { expeditionId } = req.params;

    const expedition = await Expedition.findById(expeditionId);

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    const eligibility = h7Generator.isEligibleForH7(expedition);

    res.json({
      success: true,
      data: {
        expeditionId: expedition.expeditionId,
        eligible: eligibility.eligible,
        reason: eligibility.reason,
        currentValue: expedition.goodsSummary?.totalValue || 0,
        valueLimit: 150,
        operationType: expedition.operationType,
        hasIOSS: !!expedition.ecommerce?.iossNumber
      }
    });

  } catch (error) {
    logger.error('Error verificando elegibilidad H7:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar elegibilidad H7'
    });
  }
};

/**
 * Generar declaracion H7 (bajo valor)
 * POST /api/declarations/h7/generate
 */
const generateH7 = async (req, res) => {
  try {
    const { expeditionId, iossNumber, customsOffice, forceGenerate } = req.body;

    const expedition = await Expedition.findById(expeditionId)
      .populate('documents');

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    if (expedition.operationType !== 'import') {
      return res.status(400).json({
        success: false,
        error: 'H7 solo es aplicable para importaciones'
      });
    }

    // Verificar elegibilidad
    const eligibility = h7Generator.isEligibleForH7(expedition);
    if (!eligibility.eligible && !forceGenerate) {
      return res.status(400).json({
        success: false,
        error: eligibility.reason,
        eligibility
      });
    }

    // Calcular totales si no existen
    if (!expedition.goodsSummary || !expedition.goodsSummary.totalValue) {
      expedition.goodsSummary = {
        totalItems: expedition.goods?.length || 0,
        totalPackages: expedition.goods?.reduce((sum, g) => sum + (g.packages?.quantity || 1), 0) || 0,
        totalGrossWeight: expedition.goods?.reduce((sum, g) => sum + (g.grossWeight || 0), 0) || 0,
        totalNetWeight: expedition.goods?.reduce((sum, g) => sum + (g.netWeight || 0), 0) || 0,
        totalValue: expedition.goods?.reduce((sum, g) => sum + (g.invoiceValue || 0), 0) || 0
      };
    }

    // Generar H7
    const h7Declaration = h7Generator.generate(expedition, {
      iossNumber: iossNumber || expedition.ecommerce?.iossNumber,
      customsOffice,
      forceGenerate
    });

    // Actualizar expediente
    expedition.declaration = {
      type: 'H7',
      declarationType: h7Declaration.data.declarationType,
      lrn: h7Declaration.lrn,
      regime: h7Declaration.data.h7Type,
      customsOffice: h7Declaration.data.declarationHeader.customsOffice,
      declarationDate: new Date(),
      status: 'draft',
      xmlContent: h7Declaration.xml,
      h7Data: h7Declaration.data,
      vatCalculation: h7Declaration.data.vatCalculation
    };

    // Guardar datos IOSS si se proporcionaron
    if (iossNumber && !expedition.ecommerce) {
      expedition.ecommerce = { iossNumber };
    } else if (iossNumber) {
      expedition.ecommerce.iossNumber = iossNumber;
    }

    expedition.status = 'ready_for_declaration';

    // Timeline
    if (!expedition.timeline) expedition.timeline = [];
    expedition.timeline.push({
      action: 'h7_generated',
      description: 'Declaracion H7 (bajo valor) generada',
      userId: req.user?._id,
      performedBy: req.user?.name || 'Sistema',
      timestamp: new Date(),
      metadata: {
        lrn: h7Declaration.lrn,
        hasIOSS: !!h7Declaration.data.iossData,
        intrinsicValue: h7Declaration.data.shipment.intrinsicValue
      }
    });

    await expedition.save();

    logger.info(`H7 generado: ${expedition.expeditionId} - LRN: ${h7Declaration.lrn}`);

    res.json({
      success: true,
      data: {
        declaration: expedition.declaration,
        h7Data: h7Declaration.data,
        summary: h7Declaration.summary,
        eligibility: h7Declaration.eligibility,
        xml: h7Declaration.xml
      }
    });

  } catch (error) {
    logger.error('Error generando H7:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar declaracion H7: ' + error.message
    });
  }
};

/**
 * Enviar H7 a AEAT
 * POST /api/declarations/h7/submit/:expeditionId
 */
const submitH7 = async (req, res) => {
  try {
    const { expeditionId } = req.params;

    const expedition = await Expedition.findById(expeditionId);

    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: 'Expediente no encontrado'
      });
    }

    if (!expedition.declaration || expedition.declaration.type !== 'H7') {
      return res.status(400).json({
        success: false,
        error: 'No hay declaracion H7 generada. Primero genere el H7.'
      });
    }

    if (expedition.declaration.status === 'submitted') {
      return res.status(400).json({
        success: false,
        error: `H7 ya enviado. MRN: ${expedition.declaration.mrn}`
      });
    }

    // Para H7, simulamos respuesta rapida de AEAT
    // En produccion esto iria al endpoint real de AEAT para H7
    logger.info(`Enviando H7 a AEAT...`);

    const hasIOSS = !!expedition.declaration.h7Data?.iossData;
    const vatToPay = expedition.declaration.vatCalculation?.totalToPay || 0;

    // Simular respuesta AEAT para H7
    const aeatResponse = {
      success: true,
      mrn: `H7${new Date().getFullYear()}ES${Math.random().toString(36).substring(2, 12).toUpperCase()}`,
      acceptanceDate: new Date(),
      // H7 con IOSS generalmente obtiene canal verde
      channel: hasIOSS ? 'green' : (vatToPay > 0 ? 'yellow' : 'green'),
      simulated: true,
      h7Specific: {
        clearanceTime: hasIOSS ? '< 1 hora' : '1-4 horas',
        vatStatus: hasIOSS ? 'Pagado via IOSS' : 'Pendiente de pago',
        dutyStatus: 'Exento (valor <= 150 EUR)'
      }
    };

    // Actualizar declaracion
    expedition.declaration.status = 'submitted';
    expedition.declaration.mrn = aeatResponse.mrn;
    expedition.declaration.submittedAt = new Date();
    expedition.declaration.acceptanceDate = aeatResponse.acceptanceDate;
    expedition.declaration.channel = aeatResponse.channel;
    expedition.declaration.aeatResponse = {
      responseCode: '00',
      responseDescription: 'H7 aceptado',
      timestamp: new Date(),
      simulated: true,
      h7Data: aeatResponse.h7Specific
    };

    // Actualizar status del expediente
    if (aeatResponse.channel === 'green') {
      expedition.status = 'green_channel';
      // Generar levante automatico para H7 verde
      expedition.declaration.levanteDate = new Date();
      expedition.declaration.levanteNumber = `LEV${aeatResponse.mrn}`;
    } else {
      expedition.status = 'yellow_channel';
    }

    // Timeline
    expedition.timeline.push({
      action: 'h7_submitted',
      description: `H7 enviado a AEAT - Canal ${aeatResponse.channel.toUpperCase()}`,
      userId: req.user?._id,
      performedBy: req.user?.name || 'Sistema',
      timestamp: new Date(),
      metadata: {
        mrn: aeatResponse.mrn,
        channel: aeatResponse.channel,
        hasIOSS,
        vatToPay,
        simulated: true
      }
    });

    await expedition.save();

    logger.info(`H7 enviado: ${expedition.expeditionId} - MRN: ${aeatResponse.mrn} - Canal: ${aeatResponse.channel}`);

    // Mensajes segun canal
    const channelMessages = {
      green: 'CANAL VERDE - Despacho inmediato. Paquete puede ser entregado.',
      yellow: 'CANAL AMARILLO - Pendiente pago IVA. Mercancia retenida hasta liquidacion.'
    };

    res.json({
      success: true,
      data: {
        mrn: aeatResponse.mrn,
        lrn: expedition.declaration.lrn,
        channel: aeatResponse.channel,
        channelDescription: channelMessages[aeatResponse.channel],
        status: expedition.status,
        declaration: expedition.declaration,
        h7Details: aeatResponse.h7Specific,
        vatToPay,
        levanteNumber: expedition.declaration.levanteNumber,
        simulated: true,
        message: `[MODO DEMO] ${channelMessages[aeatResponse.channel]}`
      }
    });

  } catch (error) {
    logger.error('Error enviando H7 a AEAT:', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar H7: ' + error.message
    });
  }
};

/**
 * Obtener estadisticas H7
 * GET /api/declarations/h7/stats
 */
const getH7Stats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const query = { 'declaration.type': 'H7' };

    if (startDate || endDate) {
      query['declaration.declarationDate'] = {};
      if (startDate) query['declaration.declarationDate'].$gte = new Date(startDate);
      if (endDate) query['declaration.declarationDate'].$lte = new Date(endDate);
    }

    const expeditions = await Expedition.find(query);

    const stats = {
      total: expeditions.length,
      byStatus: {
        draft: 0,
        submitted: 0
      },
      byChannel: {
        green: 0,
        yellow: 0
      },
      withIOSS: 0,
      withoutIOSS: 0,
      totalValue: 0,
      totalVATCollected: 0,
      averageValue: 0,
      averageClearanceTime: 'N/A'
    };

    expeditions.forEach(exp => {
      // Por status
      const status = exp.declaration?.status || 'draft';
      if (stats.byStatus[status] !== undefined) stats.byStatus[status]++;

      // Por canal
      const channel = exp.declaration?.channel;
      if (channel && stats.byChannel[channel] !== undefined) stats.byChannel[channel]++;

      // IOSS
      if (exp.declaration?.h7Data?.iossData) {
        stats.withIOSS++;
      } else {
        stats.withoutIOSS++;
      }

      // Valores
      const value = exp.declaration?.h7Data?.shipment?.intrinsicValue || 0;
      stats.totalValue += value;

      const vat = exp.declaration?.vatCalculation?.vatAmount || 0;
      stats.totalVATCollected += vat;
    });

    stats.averageValue = stats.total > 0 ? (stats.totalValue / stats.total).toFixed(2) : 0;

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error obteniendo estadisticas H7:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadisticas H7'
    });
  }
};

module.exports = {
  generateH1,
  generateH1Direct,
  generateAES,
  getXML,
  updateDeclaration,
  submitDeclaration,
  getDeclarationSummary,
  // H7 endpoints
  checkH7Eligibility,
  generateH7,
  submitH7,
  getH7Stats
};
