const mongoose = require('mongoose');
const { Expedition } = require('../models');
const logger = require('../config/logger');
const aiService = require('../services/aiService');
const { ensureSameTenant, filtroTenantOPlataforma } = require('../utils/tenantGuard');
const h1Generator = require('../services/forms/h1Generator');
const aesGenerator = require('../services/forms/aesGenerator');
const h7Generator = require('../services/forms/h7Generator');
const Tenant = require('../models/Tenant');
const { ErrorValidacion, exigirIdentificacion } = require('../services/forms/identificadorAduanero');
const { cambioDelExpediente } = require('../services/divisas/cambioDelExpediente');
const { verificarSumariaConAeat, esGrupaje, CODIGO_ERROR: CODIGO_GRUPAJE } = require('../services/forms/grupajeLcl');

/** Sin grupaje y sin sumaria registrada no hay nada que comprobar ni que consultar. */
const hayQueComprobarSumaria = (expedition) =>
  esGrupaje(expedition) || Boolean(String(expedition?.transport?.summaryDeclaration?.number || '').trim());

/**
 * Comprueba la declaracion sumaria del expediente antes del H1: la consulta en
 * la AEAT y, en un grupaje (LCL), decide si se puede seguir. El resultado de la
 * consulta se guarda en el expediente aunque acabe en bloqueo, para que el
 * agente vea lo que respondio la AEAT.
 *
 * @returns {Promise<string|null>} motivo del bloqueo, o null si se puede seguir
 */
const comprobarSumaria = async (expedition, tenant) => {
  const resultado = await verificarSumariaConAeat(expedition, {
    consultar: (referencia) => aeatSubmitService.consultarSumaria(expedition, referencia, { tenant })
  });

  if (resultado.consulta && expedition.transport?.summaryDeclaration) {
    expedition.transport.summaryDeclaration.aeat = resultado.consulta;
    await Expedition.updateOne(
      { _id: expedition._id },
      { $set: { 'transport.summaryDeclaration.aeat': resultado.consulta } }
    );
  }
  if (resultado.aviso) logger.warn(`[Sumaria] ${expedition.expeditionId}: ${resultado.aviso}`);

  return resultado.bloqueo;
};

/** Lanza ErrorValidacion (422) si la sumaria impide seguir con el H1. */
const exigirSumaria = async (expedition, tenant) => {
  const bloqueo = await comprobarSumaria(expedition, tenant);
  if (bloqueo) throw new ErrorValidacion(bloqueo, { code: CODIGO_GRUPAJE });
};
const aeatSubmitService = require('../services/aeat/aeatSubmitService');
const channelService = require('../services/channelService');

/**
 * Tenant del expediente: de el salen el declarante y su EORI. Se carga una vez
 * por peticion (ensureSameTenant ya comprobo que el expediente es del usuario).
 */
const tenantDelExpediente = (expedition) =>
  expedition?.tenantId ? Tenant.findById(expedition.tenantId).lean() : null;

/**
 * Un EORI que falta no es un 500: es 422 con el mensaje que dice donde
 * completarlo. Devuelve true si respondio.
 */
const responderSiFaltaIdentificacion = (res, error) => {
  if (!(error instanceof ErrorValidacion)) return false;
  res.status(422).json({
    success: false,
    error: error.message,
    code: error.code,
    quien: error.quien || null,
    // Lista de datos por completar (H1 CAU).
    faltan: error.faltan || undefined
  });
  return true;
};

const AMBITOS_AUTORIZACION = ['global', 'OCRE', 'OSRE'];

/** Datos del expediente que solo existen para presentar el H1. */
const datosH1De = (expedition) => ({
  invoiceNumber: expedition.invoiceNumber || '',
  vehicleNationality: expedition.transport?.vehicleNationality || '',
  dispatchAuthorizationScope: expedition.representative?.dispatchAuthorizationScope || 'OSRE'
});

/**
 * Que falta para presentar el H1 de un expediente, sin enviar nada.
 * GET /api/declarations/:expeditionId/h1/requisitos
 */
const getH1Requirements = async (req, res) => {
  try {
    const expedition = await Expedition.findById(req.params.expeditionId);
    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;
    const tenant = await tenantDelExpediente(expedition);
    const servicio = aeatSubmitService.servicioH1(tenant);

    let faltan = [];
    try {
      await aeatSubmitService.prepararH1Cau(expedition, { tenant });
    } catch (error) {
      if (!(error instanceof ErrorValidacion)) throw error;
      faltan = error.faltan || [error.message];
    }
    res.json({ success: true, data: { servicio, listo: faltan.length === 0, faltan, datos: datosH1De(expedition) } });
  } catch (error) {
    logger.error('Error comprobando los datos del H1:', error);
    res.status(500).json({ success: false, error: 'Error al comprobar los datos del H1' });
  }
};

/**
 * Guarda los datos del expediente que solo se usan al presentar el H1.
 * PUT /api/declarations/:expeditionId/h1/datos
 */
const updateH1Data = async (req, res) => {
  try {
    const expedition = await Expedition.findById(req.params.expeditionId);
    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    const { invoiceNumber, vehicleNationality, dispatchAuthorizationScope } = req.body || {};
    const errores = [];
    if (invoiceNumber !== undefined && (typeof invoiceNumber !== 'string' || invoiceNumber.trim().length > 70)) {
      errores.push('El número de factura admite hasta 70 caracteres');
    }
    if (vehicleNationality !== undefined && vehicleNationality !== '' && !/^[A-Za-z]{2}$/.test(String(vehicleNationality))) {
      errores.push('La nacionalidad del medio de transporte es un código de país de dos letras');
    }
    if (dispatchAuthorizationScope !== undefined && !AMBITOS_AUTORIZACION.includes(dispatchAuthorizationScope)) {
      errores.push('Tipo de autorización de despacho no válido');
    }
    if (errores.length > 0) return res.status(400).json({ success: false, error: errores.join('. ') });

    // Solo se tocan estos campos: el resto del transporte y del representante queda como esta.
    if (invoiceNumber !== undefined) expedition.set('invoiceNumber', invoiceNumber.trim());
    if (vehicleNationality !== undefined) expedition.set('transport.vehicleNationality', String(vehicleNationality).toUpperCase());
    if (dispatchAuthorizationScope !== undefined) expedition.set('representative.dispatchAuthorizationScope', dispatchAuthorizationScope);
    await expedition.save();

    res.json({ success: true, data: datosH1De(expedition) });
  } catch (error) {
    logger.error('Error guardando los datos del H1:', error);
    res.status(500).json({ success: false, error: 'Error al guardar los datos del H1' });
  }
};

/**
 * Estado en la AEAT de un H1 presentado por el servicio CAU.
 * GET /api/declarations/:expeditionId/h1/estado
 *
 * Solo lectura en la AEAT. En el expediente se guarda lo que responde y se
 * actualizan el circuito y la fecha de levante cuando la AEAT ya los da.
 */
const getH1Status = async (req, res) => {
  try {
    const expedition = await Expedition.findById(req.params.expeditionId);
    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;
    const mrn = expedition.declaration?.mrn;
    if (!mrn) return res.status(400).json({ success: false, error: 'La declaración todavía no tiene MRN: no se ha presentado' });
    if (expedition.declaration?.aeatResponse?.servicio !== 'CC415AV1') {
      return res.status(400).json({ success: false, error: 'Esta declaración no se presentó por el servicio CAU: su estado no se puede consultar aquí' });
    }

    const { rawResponse, ...consulta } = await aeatSubmitService.consultarH1Cau(mrn);
    if (!consulta.success) {
      return res.status(consulta.tipo === 'fault' ? 502 : 404).json({ success: false, error: consulta.error, tipo: consulta.tipo });
    }

    expedition.declaration.aeatResponse = { ...expedition.declaration.aeatResponse, consulta: { ...consulta, consultadoEn: new Date() } };
    expedition.markModified('declaration.aeatResponse');
    if (consulta.estado.channel) expedition.declaration.channel = consulta.estado.channel;
    if (consulta.estado.fechaLevante) expedition.declaration.levanteDate = new Date(consulta.estado.fechaLevante);
    await expedition.save();

    res.json({ success: true, data: consulta });
  } catch (error) {
    logger.error('Error consultando el estado del H1:', error);
    res.status(500).json({ success: false, error: 'Error al consultar el estado del H1 en la AEAT' });
  }
};

// Un mensaje preparado y sin respuesta se reenvia tal cual durante este plazo;
// pasado, se prepara uno nuevo (la AEAT conserva el historico unos 15 dias).
const VIGENCIA_ENVIO_CAU_MS = 24 * 60 * 60 * 1000;

/**
 * Presenta el H1 por el servicio CAU (CC415AV1) con reenvio seguro: el mensaje
 * se guarda ANTES de enviarlo. Si la respuesta no llega (corte de red, fallo
 * del servidor), el siguiente intento reenvia el mismo mensaje y la AEAT, que
 * lo reconoce por su identificador, no registra la declaracion dos veces.
 */
async function presentarH1Cau(expedition) {
  let envio = expedition.declaration.cauEnvio;
  const pendiente = envio && !envio.respondido && envio.requestXML
    && (Date.now() - new Date(envio.preparedAt).getTime()) < VIGENCIA_ENVIO_CAU_MS;
  if (!pendiente) {
    envio = { ...(await aeatSubmitService.prepararH1Cau(expedition)), respondido: false };
    expedition.declaration.cauEnvio = envio;
    expedition.markModified('declaration.cauEnvio');
    await expedition.save();
  }

  const resultado = await aeatSubmitService.enviarH1Cau(envio.requestXML);

  // Con respuesta de la AEAT (admision o rechazo) el mensaje queda cerrado; un
  // fallo del servidor lo deja pendiente para reenviarlo igual.
  if (!(resultado.tipo === 'fault' && resultado.reintentable)) {
    expedition.declaration.cauEnvio = { ...envio, respondido: true, respondidoAt: new Date(), resultado: resultado.tipo };
    expedition.markModified('declaration.cauEnvio');
    if (!resultado.success) await expedition.save();
  }
  return { ...resultado, lrn: resultado.lrn || envio.lrn };
}

/**
 * Generar declaracion H1 (Importacion)
 * POST /api/declarations/h1/generate
 */
const generateH1 = async (req, res) => {
  try {
    const { expeditionId, regime, additionalProcedure, preference } = req.body;

    const expedition = await Expedition.findById(expeditionId)
      .populate('documents');

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

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

    // Sin EORI de declarante o de cliente no se gasta la IA ni se genera XML (422).
    const tenant = await tenantDelExpediente(expedition);
    exigirIdentificacion(expedition, tenant);

    // Grupaje (LCL): sin la sumaria de la desconsolidacion no hay H1 (422).
    if (hayQueComprobarSumaria(expedition)) await exigirSumaria(expedition, tenant);

    // Generar H1 con IA
    const h1Data = await aiService.generateH1Declaration(expedition, {
      regime: regime || '40',
      additionalProcedure: additionalProcedure || '000',
      preference: preference || '100'
    });

    // Un DUA con peso, importe o bultos a cero es una declaracion incorrecta
    // ante la AEAT, pero el XML sale sintacticamente valido: sin esta comproba-
    // cion se presentaba con valor cero y sin un solo aviso.
    const totalesInvalidos = h1Generator.totalesNoDeclarables(expedition);
    if (totalesInvalidos) {
      return res.status(400).json({ success: false, error: totalesInvalidos });
    }

    // Generar estructura H1 completa
    // Divisa de la factura y tipo oficial del mes (422 si la divisa no lo tiene).
    const cambio = await cambioDelExpediente(expedition);
    const h1Declaration = h1Generator.generate(expedition, h1Data, { tenant, cambio });

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
    if (responderSiFaltaIdentificacion(res, error)) return;
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

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    if (expedition.operationType !== 'export') {
      return res.status(400).json({
        success: false,
        error: 'AES solo es aplicable para exportaciones'
      });
    }

    // Sin EORI de declarante o de cliente no se gasta la IA ni se genera XML (422).
    const tenant = await tenantDelExpediente(expedition);
    exigirIdentificacion(expedition, tenant);

    // Generar AES con IA
    const aesData = await aiService.generateAESDeclaration(expedition, {
      exportType: exportType || '10'
    });

    // Generar estructura AES completa
    const aesDeclaration = aesGenerator.generate(expedition, aesData, { tenant });

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
    if (responderSiFaltaIdentificacion(res, error)) return;
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

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

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

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

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
      const tenant = await tenantDelExpediente(expedition);
      if (expedition.declaration.type === 'H1') {
        const h1Declaration = h1Generator.generate(expedition, {
          ...expedition.declaration,
          ...updates
        }, { tenant, cambio: await cambioDelExpediente(expedition) });
        expedition.declaration.xmlContent = h1Declaration.xml;
      } else if (expedition.declaration.type === 'AES') {
        const aesDeclaration = aesGenerator.generate(expedition, {
          ...expedition.declaration,
          ...updates
        }, { tenant });
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
    if (responderSiFaltaIdentificacion(res, error)) return;
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

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

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

    // Grupaje (LCL): la sumaria pudo cambiarse o quitarse despues de generar el
    // H1. Se vuelve a comprobar justo antes de presentar; no admite excepcion.
    if (expedition.declaration.type !== 'AES' && hayQueComprobarSumaria(expedition)) {
      const bloqueoGrupaje = await comprobarSumaria(expedition, await tenantDelExpediente(expedition));
      if (bloqueoGrupaje) {
        return res.status(422).json({ success: false, error: bloqueoGrupaje, code: CODIGO_GRUPAJE });
      }
    }

    // Enviar a AEAT real via aeatSubmitService (or multi-country factory)
    logger.info(`Enviando declaracion ${expedition.declaration.type}...`);

    const { CustomsServiceFactory } = require('../services/customs');
    const Tenant = require('../models/Tenant');

    const tenant = await Tenant.findById(expedition.tenantId);
    const country = tenant?.customsConfig?.country || 'ES';
    const type = expedition.declaration.type;

    // H1 por el mensaje CAU (CC415AV1) o por el DUA anterior, segun el tenant.
    const usaCau = country === 'ES' && type !== 'AES' && aeatSubmitService.servicioH1(tenant) === 'cau';

    let aeatResult;
    if (country === 'ES') {
      // Existing AEAT code (backward compatible)
      if (type === 'AES') {
        aeatResult = await aeatSubmitService.submitAES(expedition);
      } else if (usaCau) {
        aeatResult = await presentarH1Cau(expedition);
      } else {
        aeatResult = await aeatSubmitService.submitH1(expedition);
      }
    } else {
      // Multi-country via factory
      const customsService = CustomsServiceFactory.getServiceForTenant(tenant);
      aeatResult = await customsService.submitDeclaration(expedition, type);
    }

    if (!aeatResult.success) {
      // Non-blocking rejection email
      try {
        const emailService = require('../services/emailService');
        if (req.user?.email) {
          emailService.sendDeclarationRejected(req.user.email, {
            expeditionId: expedition.expeditionId,
            declarationType: expedition.declaration.type,
            errorDetails: aeatResult.error,
            errorCode: aeatResult.code
          }).catch(e => logger.warn('Email rechazo no enviado:', e.message));
        }
      } catch (e) { /* silent */ }

      return res.status(400).json({
        success: false,
        error: aeatResult.error || 'Error en respuesta de AEAT',
        aeatResponse: aeatResult
      });
    }

    // Normalizar respuesta para compatibilidad
    // En el CAU la fecha de admision y el circuito los da la AEAT. Sin analisis
    // de riesgos no hay circuito: no se supone verde.
    const fechaAdmision = usaCau && aeatResult.fechaAdmision ? new Date(aeatResult.fechaAdmision) : new Date();
    const aeatResponse = {
      success: true,
      mrn: aeatResult.mrn || aeatResult.numeroRegistro,
      channel: usaCau ? (aeatResult.channel || null) : aeatResult.channel,
      acceptanceDate: fechaAdmision,
      simulated: false,
      liquidacion: aeatResult.liquidacion,
      certificados: aeatResult.certificados
    };

    // Actualizar declaracion con respuesta AEAT
    expedition.declaration.status = 'submitted';
    expedition.declaration.mrn = aeatResponse.mrn;
    expedition.declaration.submittedAt = new Date();
    expedition.declaration.acceptanceDate = fechaAdmision;
    if (usaCau) {
      expedition.declaration.channel = aeatResponse.channel || undefined;
      // El LRN con el que la AEAT registro la declaracion.
      expedition.declaration.lrn = aeatResult.lrn || expedition.declaration.lrn;
    } else {
      expedition.declaration.channel = aeatResult.channel || 'green';
    }

    // Guardar respuesta completa de AEAT
    expedition.declaration.aeatResponse = {
      responseCode: usaCau ? aeatResult.operacionRegistrada : aeatResult.code,
      responseDescription: aeatResult.estado || 'Aceptada',
      timestamp: new Date(),
      csv: aeatResult.csv,
      simulated: false,
      // Lo que liquida la AEAT y los certificados que exige cada organismo (H1 CAU).
      ...(usaCau ? { servicio: 'CC415AV1', circuito: aeatResult.circuito, liquidacion: aeatResult.liquidacion, certificados: aeatResult.certificados } : {})
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
    // En el H1 el circuito amarillo significa «pendiente de certificados de otros
    // organismos»; el tratamiento amarillo de channelService es el del H7 (IVA
    // pendiente) y no se aplica. Sin circuito tampoco hay nada que procesar.
    const procesarCanal = aeatResponse.channel && !(usaCau && aeatResponse.channel === 'yellow');
    let channelResult = null;
    if (procesarCanal) try {
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

    // Non-blocking email notifications
    try {
      const emailService = require('../services/emailService');
      const userEmail = req.user?.email;
      if (userEmail) {
        // Declaration accepted email
        emailService.sendDeclarationAccepted(userEmail, {
          mrn: aeatResponse.mrn,
          channel: aeatResponse.channel,
          expeditionId: expedition.expeditionId,
          declarationType: expedition.declaration.type
        }).catch(e => logger.warn('Email declaracion aceptada no enviado:', e.message));

        // Channel-specific email for orange/red
        if (aeatResponse.channel === 'orange' || aeatResponse.channel === 'red') {
          emailService.sendChannelAssigned(userEmail, {
            mrn: aeatResponse.mrn,
            channel: aeatResponse.channel,
            expeditionId: expedition.expeditionId
          }).catch(e => logger.warn('Email canal asignado no enviado:', e.message));
        }
      }
    } catch (e) { /* silent - email should never break declaration flow */ }

    // Mensaje segun canal
    const channelMessages = {
      null: 'Declaración registrada. La AEAT todavía no ha asignado circuito.',
      yellow: 'CIRCUITO AMARILLO - Pendiente de certificados de otros organismos.',
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
        liquidacion: aeatResponse.liquidacion,
        certificados: aeatResponse.certificados,
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
    // Datos que faltan (EORI, datos del H1): 422 con lo que hay que completar.
    if (responderSiFaltaIdentificacion(res, error)) return;
    logger.error('Error enviando declaracion a AEAT:', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar declaracion: ' + error.message
    });
  }
};

/**
 * Valida el body de /h1/generate-direct.
 *
 * declarationValidators.generateH1 (la ruta hermana /h1/generate) exige
 * expeditionId como ObjectId y por eso no sirve aqui: el modo formulario de
 * esta ruta crea el expediente EN el propio request, sin id previo. Por eso
 * esta ruta llevaba "sin validaciones estrictas" en el comentario -- ningun
 * campo del formulario (descripcion, TARIC, destinatario) se comprobaba antes
 * de guardarlo, así que un campo vacio o mal escrito quedaba en el expediente
 * en silencio en vez de bloquear la creacion.
 *
 * Devuelve un array de mensajes de error; vacio si el body es valido.
 */
function validateH1DirectBody(body) {
  const errores = [];

  if (body.expeditionId) {
    if (!mongoose.Types.ObjectId.isValid(body.expeditionId)) {
      errores.push('ID de expediente invalido');
    }
    return errores;
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    errores.push('Debe incluir al menos un articulo (items)');
  } else {
    body.items.forEach((item, i) => {
      if (!item?.description || !String(item.description).trim()) {
        errores.push(`Artículo ${i + 1}: falta la descripción`);
      }
      if (item?.taricCode && !/^\d{6,10}$/.test(String(item.taricCode))) {
        errores.push(`Artículo ${i + 1}: código TARIC inválido (${item.taricCode})`);
      }
    });
  }

  if (!body.recipient?.name || !String(body.recipient.name).trim()) {
    errores.push('El destinatario requiere nombre');
  }
  if (!body.recipient?.eori && !body.recipient?.nif) {
    errores.push('El destinatario requiere EORI o NIF');
  }
  if (!body.sender?.name || !String(body.sender.name).trim()) {
    errores.push('El remitente requiere nombre');
  }

  return errores;
}

/**
 * Generar H1 directamente (modo clasico con expediente existente, o modo
 * formulario que crea el expediente en el propio request)
 * POST /api/declarations/h1/generate-direct
 */
const generateH1Direct = async (req, res) => {
  try {
    const body = req.body;

    const erroresValidacion = validateH1DirectBody(body);
    if (erroresValidacion.length > 0) {
      return res.status(400).json({ success: false, error: erroresValidacion.join('; '), errors: erroresValidacion });
    }

    let expedition;

    if (body.expeditionId) {
      // Modo clasico: usar expediente existente
      expedition = await Expedition.findById(body.expeditionId);
      // Sin esto se podria generar un H1 sobre el expediente de otro tenant
      // pasando su id en el body. ensureSameTenant ya cubre el 404.
      if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;
    } else {
      // Modo directo desde formulario H1: crear expediente automaticamente
      const tenantId = req.user?.tenantId;
      const expId = `EXP-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;

      // Mapear items del formulario a goods del expediente
      const goods = (body.items || []).map((item, idx) => ({
        itemNumber: idx + 1,
        description: item.description || '',
        taricCode: (item.taricCode || '').padEnd(10, '0'),
        hsCode: (item.taricCode || '').substring(0, 6),
        originCountry: item.countryOfOrigin || body.dispatchCountry?.code || '',
        quantity: parseInt(item.supplementaryUnits) || parseInt(item.packageCount) || 1,
        unit: 'KG',
        grossWeight: parseFloat(item.grossWeight) || 0,
        netWeight: parseFloat(item.netWeight) || 0,
        supplementaryUnits: item.supplementaryUnits || '',
        invoiceValue: parseFloat(item.itemPrice) || 0,
        currency: body.currency || 'EUR',
        statisticalValue: parseFloat(item.statisticalValue) || parseFloat(item.itemPrice) || 0,
        packages: {
          quantity: parseInt(item.packageCount) || 1,
          type: item.packageType || 'CT',
          marks: item.marks || 'N/M'
        },
        dutyRate: 0,
        dutyAmount: 0,
        vatRate: 21,
        vatAmount: 0
      }));

      // Calcular totales
      const totalGrossWeight = goods.reduce((s, g) => s + g.grossWeight, 0);
      const totalNetWeight = goods.reduce((s, g) => s + g.netWeight, 0);
      const totalValue = goods.reduce((s, g) => s + g.invoiceValue, 0);
      const totalPackages = goods.reduce((s, g) => s + g.packages.quantity, 0);

      // Determinar transporte
      const transportModeMap = { '1': 'maritime', '2': 'rail', '3': 'road', '4': 'air', '5': 'postal' };

      expedition = new Expedition({
        expeditionId: expId,
        tenantId,
        country: 'ES',
        operationType: 'import',
        transportMode: transportModeMap[body.borderTransportMode] || 'air',
        status: 'documents_validated',
        priority: 'normal',
        client: {
          companyName: body.recipient?.name || '',
          nif: (body.recipient?.eori || '').replace(/^ES/, ''),
          eori: body.recipient?.eori || '',
          address: {
            street: body.recipient?.address || '',
            city: body.recipient?.city || '',
            postalCode: body.recipient?.postalCode || '',
            country: body.recipient?.country || 'ES'
          }
        },
        exporter: {
          companyName: body.sender?.name || '',
          address: body.sender?.address || '',
          city: body.sender?.city || '',
          country: body.sender?.country || ''
        },
        goods,
        goodsSummary: {
          totalItems: goods.length,
          totalPackages,
          totalGrossWeight,
          totalNetWeight,
          totalValue
        },
        calculations: {
          invoiceTotal: parseFloat(body.totalInvoiceAmount) || totalValue,
          invoiceCurrency: body.currency || 'EUR',
          exchangeRate: parseFloat(body.exchangeRate) || 1,
          invoiceTotalEur: parseFloat(body.totalInvoiceAmount) || totalValue,
          customsValue: parseFloat(body.totalStatisticalValue) || parseFloat(body.totalInvoiceAmount) || totalValue,
          totalDuties: (body.taxes || []).filter(t => t.classCode === 'A00').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0),
          totalVat: (body.taxes || []).filter(t => t.classCode === 'B00').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0),
          totalTaxes: (body.taxes || []).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
        },
        transport: {
          documentNumber: body.referenceNumber || '',
          vehicleId: body.transportIdAtDeparture || '',
          vehicleNationality: body.borderTransportNationality || '',
          arrivalPort: body.customsOffice || ''
        },
        declaration: {
          type: 'H1',
          declarationType: body.declarationAdditional || 'A',
          regime: (body.items?.[0]?.procedure || '4000').substring(0, 2),
          additionalProcedure: (body.items?.[0]?.procedure || '4000').substring(2, 4),
          preference: body.items?.[0]?.preference || '100',
          customsOffice: body.customsOffice || 'ES002801',
          status: 'draft'
        },
        timeline: [{
          action: 'expedition_created',
          description: 'Expediente creado desde formulario H1 directo',
          userId: req.user?._id,
          performedBy: req.user?.name || 'Sistema',
          timestamp: new Date()
        }]
      });

      await expedition.save();
      logger.info(`Expediente creado desde H1 directo: ${expId}`);
    }

    if (expedition.operationType !== 'import') {
      return res.status(400).json({ success: false, error: 'H1 solo es aplicable para importaciones' });
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

    const regime = body.items?.[0]?.procedure?.substring(0, 2) || expedition.declaration?.regime || '40';
    const additionalProcedure = body.items?.[0]?.procedure?.substring(2, 4) || expedition.declaration?.additionalProcedure || '00';
    const preference = body.items?.[0]?.preference || expedition.declaration?.preference || '100';

    // Grupaje (LCL): sin la sumaria de la desconsolidacion no hay H1 (422).
    if (hayQueComprobarSumaria(expedition)) {
      await exigirSumaria(expedition, await tenantDelExpediente(expedition));
    }

    const totalesInvalidosDirecto = h1Generator.totalesNoDeclarables(expedition);
    if (totalesInvalidosDirecto) {
      return res.status(400).json({ success: false, error: totalesInvalidosDirecto });
    }

    // Generar H1 directamente con h1Generator
    const tenant = await tenantDelExpediente(expedition);
    const h1Declaration = h1Generator.generate(expedition, {
      regime,
      additionalProcedure,
      preference
    }, { tenant, cambio: await cambioDelExpediente(expedition) });

    // Actualizar expediente
    expedition.declaration = {
      type: 'H1',
      declarationType: body.declarationAdditional || 'A',
      lrn: h1Declaration.lrn,
      regime,
      additionalProcedure,
      preference,
      customsOffice: h1Declaration.data.declarationHeader?.customsOfficePresentation || body.customsOffice || 'ES002801',
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
      metadata: { lrn: h1Declaration.lrn, regime }
    });

    await expedition.save();

    logger.info(`H1 generado (directo): ${expedition.expeditionId} - LRN: ${h1Declaration.lrn}`);

    res.json({
      success: true,
      data: {
        _id: expedition._id,
        id: expedition._id,
        expeditionId: expedition.expeditionId,
        declaration: expedition.declaration,
        h1Data: h1Declaration.data,
        xml: h1Declaration.xml,
        summary: h1Declaration.summary,
        warnings: []
      }
    });

  } catch (error) {
    if (responderSiFaltaIdentificacion(res, error)) return;
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

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

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

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

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

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

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
    const tenant = await tenantDelExpediente(expedition);
    const h7Declaration = h7Generator.generate(expedition, {
      iossNumber: iossNumber || expedition.iossNumber || expedition.ecommerce?.iossNumber,
      customsOffice,
      forceGenerate
    }, { tenant });

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

    // Guardar el numero IOSS en el campo declarado del schema. Antes se escribia
    // a expedition.ecommerce.iossNumber, pero el schema de Expedition es estricto
    // y NO declara `ecommerce`: la asignacion se descartaba silenciosamente al
    // guardar y el IOSS del body nunca se persistia. El campo real es
    // expedition.iossNumber (declarado en el modelo).
    if (iossNumber) {
      expedition.iossNumber = iossNumber;
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
    if (responderSiFaltaIdentificacion(res, error)) return;
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

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

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

    // Este envio NO esta conectado con la AEAT. Antes fabricaba un MRN al azar,
    // asignaba canal y concedia el levante sin haber presentado nada: un
    // despacho que no existe. Se rechaza sin tocar el expediente; el H7 se
    // presenta por el servicio real (/api/aeat-real/declarations/h7/submit).
    logger.warn(`Envio de H7 desde el expediente rechazado: no conectado con la AEAT (${expedition.expeditionId})`);
    return res.status(501).json({
      success: false,
      code: 'H7_SUBMIT_NOT_CONNECTED',
      error: 'El envío del H7 desde el expediente no está conectado con la AEAT. No se ha presentado nada. Presente el H7 desde la pantalla de declaraciones H7.'
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

    // Sin el tenant las estadisticas agregan las expediciones de TODOS los
    // clientes. filtroTenantOPlataforma: tambien con un usuario sin tenant (legacy).
    const query = { 'declaration.type': 'H7', ...filtroTenantOPlataforma(req.user) };

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

// ===========================================
// AI ENDPOINTS - H1/AES DECLARATIONS
// ===========================================

/**
 * Validar declaración antes de envío con IA
 * POST /api/declarations/:expeditionId/ai/validate
 */
const aiValidateDeclaration = async (req, res) => {
  try {
    const { expeditionId } = req.params;
    const { declarationType } = req.body;

    const expedition = await Expedition.findById(expeditionId)
      .populate('documents');

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    const type = declarationType || expedition.declaration?.type || 'H1';
    logger.info(`AI: Validando declaración ${type} para ${expedition.expeditionId}`);

    const validation = await aiService.validateDeclarationBeforeSubmit(expedition, type);

    res.json({
      success: true,
      data: validation
    });

  } catch (error) {
    logger.error('Error en AI validate declaration:', error);
    res.status(500).json({
      success: false,
      error: 'Error al validar declaración'
    });
  }
};

/**
 * Detectar errores comunes con IA
 * POST /api/declarations/:expeditionId/ai/detect-errors
 */
const aiDetectErrors = async (req, res) => {
  try {
    const { expeditionId } = req.params;
    const { declarationType } = req.body;

    const expedition = await Expedition.findById(expeditionId)
      .populate('documents');

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    const type = declarationType || expedition.declaration?.type || 'H1';
    logger.info(`AI: Detectando errores en declaración ${type} para ${expedition.expeditionId}`);

    const errors = await aiService.detectDeclarationErrors(expedition, type);

    res.json({
      success: true,
      data: errors
    });

  } catch (error) {
    logger.error('Error en AI detect errors:', error);
    res.status(500).json({
      success: false,
      error: 'Error al detectar errores'
    });
  }
};

/**
 * Sugerir régimen y preferencia con IA
 * POST /api/declarations/:expeditionId/ai/suggest-regime
 */
const aiSuggestRegime = async (req, res) => {
  try {
    const { expeditionId } = req.params;

    const expedition = await Expedition.findById(expeditionId)
      .populate('documents');

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    if (expedition.operationType !== 'import') {
      return res.status(400).json({
        success: false,
        error: 'Sugerencia de régimen solo disponible para importaciones'
      });
    }

    logger.info(`AI: Sugiriendo régimen para ${expedition.expeditionId}`);

    const suggestion = await aiService.suggestRegimeAndPreference(expedition);

    res.json({
      success: true,
      data: suggestion
    });

  } catch (error) {
    logger.error('Error en AI suggest regime:', error);
    res.status(500).json({
      success: false,
      error: 'Error al sugerir régimen'
    });
  }
};

/**
 * Predecir canal de despacho con IA
 * POST /api/declarations/:expeditionId/ai/predict-channel
 */
const aiPredictChannel = async (req, res) => {
  try {
    const { expeditionId } = req.params;
    const { declarationType } = req.body;

    const expedition = await Expedition.findById(expeditionId)
      .populate('documents');

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    const type = declarationType || expedition.declaration?.type || 'H1';
    logger.info(`AI: Prediciendo canal para ${expedition.expeditionId}`);

    const prediction = await aiService.predictDeclarationChannel(expedition, type);

    // Guardar predicción en el expediente
    if (!expedition.aiAnalysis) expedition.aiAnalysis = {};
    expedition.aiAnalysis.channelPrediction = {
      ...prediction,
      predictedAt: new Date()
    };
    await expedition.save();

    res.json({
      success: true,
      data: prediction
    });

  } catch (error) {
    logger.error('Error en AI predict channel:', error);
    res.status(500).json({
      success: false,
      error: 'Error al predecir canal'
    });
  }
};

/**
 * Análisis completo de declaración con IA
 * POST /api/declarations/:expeditionId/ai/full-analysis
 */
const aiFullDeclarationAnalysis = async (req, res) => {
  try {
    const { expeditionId } = req.params;
    const { declarationType } = req.body;

    const expedition = await Expedition.findById(expeditionId)
      .populate('documents');

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    const type = declarationType || expedition.declaration?.type ||
                 (expedition.operationType === 'import' ? 'H1' : 'AES');

    logger.info(`AI: Análisis completo de declaración ${type} para ${expedition.expeditionId}`);

    const analysis = await aiService.fullDeclarationAnalysis(expedition, type);

    // Guardar análisis en el expediente
    if (!expedition.aiAnalysis) expedition.aiAnalysis = {};
    expedition.aiAnalysis.declarationAnalysis = {
      ...analysis,
      analyzedAt: new Date()
    };
    expedition.aiAnalysis.lastAnalysisAt = new Date();
    await expedition.save();

    // Registrar en timeline
    expedition.timeline.push({
      action: 'ai_declaration_analysis',
      description: `Análisis IA de declaración ${type} - Puntuación: ${analysis.overallReadiness?.score}%`,
      userId: req.user?._id,
      performedBy: 'LUCI AI',
      metadata: {
        readinessScore: analysis.overallReadiness?.score,
        estimatedChannel: analysis.overallReadiness?.estimatedChannel,
        blockingErrors: analysis.errors?.blockingErrors || 0
      }
    });
    await expedition.save();

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    logger.error('Error en AI full declaration analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Error al realizar análisis completo'
    });
  }
};

/**
 * Obtener último análisis IA de declaración
 * GET /api/declarations/:expeditionId/ai/analysis
 */
const getAiDeclarationAnalysis = async (req, res) => {
  try {
    const { expeditionId } = req.params;

    const expedition = await Expedition.findById(expeditionId)
      .select('expeditionId declaration aiAnalysis tenantId'); // BUG FIX: incluir tenantId para que ensureSameTenant funcione

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    res.json({
      success: true,
      data: {
        expeditionId: expedition.expeditionId,
        declarationType: expedition.declaration?.type,
        declarationStatus: expedition.declaration?.status,
        analysis: expedition.aiAnalysis?.declarationAnalysis || null,
        channelPrediction: expedition.aiAnalysis?.channelPrediction || null,
        hasAnalysis: !!expedition.aiAnalysis?.declarationAnalysis
      }
    });

  } catch (error) {
    logger.error('Error obteniendo análisis IA de declaración:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener análisis'
    });
  }
};

/**
 * Aplicar sugerencias de régimen/preferencia
 * POST /api/declarations/:expeditionId/ai/apply-regime
 */
const applyRegimeSuggestion = async (req, res) => {
  try {
    const { expeditionId } = req.params;
    const { regime, additionalProcedure, preference } = req.body;

    const expedition = await Expedition.findById(expeditionId);

    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    if (!expedition.declaration) {
      // Si no hay declaración, crear una básica
      expedition.declaration = {
        type: expedition.operationType === 'import' ? 'H1' : 'AES',
        status: 'draft'
      };
    }

    // Actualizar régimen y preferencia
    if (regime) expedition.declaration.regime = regime;
    if (additionalProcedure) expedition.declaration.additionalProcedure = additionalProcedure;
    if (preference) expedition.declaration.preference = preference;

    // Registrar en timeline
    expedition.timeline.push({
      action: 'regime_updated',
      description: `Régimen/preferencia actualizado: ${regime || expedition.declaration.regime}/${preference || expedition.declaration.preference}`,
      userId: req.user?._id,
      performedBy: req.user?.name || 'Sistema',
      metadata: { regime, additionalProcedure, preference, source: 'ai_suggestion' }
    });

    await expedition.save();

    logger.info(`Régimen aplicado: ${expedition.expeditionId} -> ${regime}/${preference}`);

    res.json({
      success: true,
      data: {
        regime: expedition.declaration.regime,
        additionalProcedure: expedition.declaration.additionalProcedure,
        preference: expedition.declaration.preference,
        message: 'Régimen y preferencia actualizados correctamente'
      }
    });

  } catch (error) {
    logger.error('Error aplicando régimen:', error);
    res.status(500).json({
      success: false,
      error: 'Error al aplicar sugerencia de régimen'
    });
  }
};

/**
 * Cancel H1 declaration
 * POST /api/declarations/:expeditionId/cancel
 */
const cancelDeclaration = async (req, res) => {
  try {
    const { Expedition } = require('../models');
    const aeatSubmitService = require('../services/aeat/aeatSubmitService');

    const expedition = await Expedition.findById(req.params.expeditionId);

    // Anular es irreversible y esta ruta solo exige el permiso
    // canApproveDeclarations, que es de tenant: sin esta comprobacion, quien lo
    // tenga podria anular ante la AEAT la declaracion de otro cliente conociendo
    // su expeditionId. ensureSameTenant ya devuelve 404 si no existe.
    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    if (!expedition.declaration?.mrn) {
      return res.status(400).json({ success: false, error: 'La declaracion no tiene MRN asignado' });
    }

    const result = await aeatSubmitService.cancelH1({
      mrn: expedition.declaration.mrn,
      reason: req.body.reason || '0',
      declaranteNIF: expedition.representative?.nif || '',
      aduanaDespacho: expedition.declaration?.customsOffice || ''
    });

    // Los expedientes antiguos pueden no tener timeline; sin esto el push
    // lanzaria y la anulacion ya enviada a AEAT no quedaria registrada.
    if (!expedition.timeline) expedition.timeline = [];
    expedition.timeline.push({
      action: 'declaration_cancelled',
      description: `Anulacion enviada a AEAT. ${result.success ? 'Aceptada' : 'Rechazada: ' + result.error}`,
      performedBy: req.user?.name,
      userId: req.user?._id,
      metadata: { aeatResponse: result }
    });

    if (result.success) {
      expedition.status = 'cancelled';
      expedition.declaration.cancelledAt = new Date();
    }

    await expedition.save();

    res.json({ success: true, data: result });
  } catch (error) {
    // El detalle va al log, no al cliente: error.message puede llevar rutas,
    // cadenas de conexion o respuestas crudas de AEAT.
    logger.error('Error cancelling declaration:', error);
    res.status(500).json({ success: false, error: 'Error al anular la declaracion' });
  }
};

/**
 * Consultar en la AEAT la declaracion sumaria registrada en el expediente
 * POST /api/declarations/:expeditionId/summary-declaration/verify
 *
 * No genera ni presenta nada: devuelve si el H1 podria seguir y lo que
 * respondio la AEAT, y lo deja guardado en el expediente.
 */
const verifySummaryDeclaration = async (req, res) => {
  try {
    const expedition = await Expedition.findById(req.params.expeditionId);
    if (!ensureSameTenant(expedition, req, res, { resource: 'Expediente' })) return;

    if (!String(expedition.transport?.summaryDeclaration?.number || '').trim()) {
      return res.status(400).json({ success: false, error: 'El expediente no tiene declaracion sumaria registrada' });
    }

    const tenant = await tenantDelExpediente(expedition);
    const resultado = await verificarSumariaConAeat(expedition, {
      consultar: (referencia) => aeatSubmitService.consultarSumaria(expedition, referencia, { tenant })
    });

    if (resultado.consulta) {
      await Expedition.updateOne(
        { _id: expedition._id },
        { $set: { 'transport.summaryDeclaration.aeat': resultado.consulta } }
      );
    }

    res.json({
      success: true,
      data: {
        blocked: Boolean(resultado.bloqueo),
        reason: resultado.bloqueo,
        warning: resultado.aviso,
        aeat: resultado.consulta
      }
    });
  } catch (error) {
    if (responderSiFaltaIdentificacion(res, error)) return;
    logger.error('Error consultando la declaracion sumaria:', error);
    res.status(500).json({ success: false, error: 'Error al consultar la declaracion sumaria' });
  }
};

module.exports = {
  verifySummaryDeclaration,
  generateH1,
  generateH1Direct,
  getH1Requirements,
  updateH1Data,
  getH1Status,
  validateH1DirectBody,
  generateAES,
  getXML,
  updateDeclaration,
  submitDeclaration,
  getDeclarationSummary,
  cancelDeclaration,
  // H7 endpoints
  checkH7Eligibility,
  generateH7,
  submitH7,
  getH7Stats,
  // AI endpoints
  aiValidateDeclaration,
  aiDetectErrors,
  aiSuggestRegime,
  aiPredictChannel,
  aiFullDeclarationAnalysis,
  getAiDeclarationAnalysis,
  applyRegimeSuggestion
};
