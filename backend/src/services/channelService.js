/**
 * Channel Service
 * Servicio para gestion de circuitos de inspeccion AEAT
 *
 * Circuitos:
 * - VERDE: Levante automatico, mercancia puede retirarse
 * - AMARILLO: Certificados pendientes, esperar documentacion
 * - NARANJA: Revision documental, se crea requerimiento automatico
 * - ROJO: Inspeccion fisica, se programa cita con aduana
 */

const logger = require('../config/logger');
const { Expedition, Requirement, Document } = require('../models');
const emailService = require('./emailService');

// Configuracion de canales
const CHANNEL_CONFIG = {
  green: {
    code: 'green',
    label: 'Canal Verde',
    description: 'Levante automatico',
    action: 'release',
    createRequirement: false,
    notifyClient: true,
    expeditionStatus: 'green_channel'
  },
  yellow: {
    code: 'yellow',
    label: 'Canal Amarillo',
    description: 'Certificados pendientes',
    action: 'await_certificates',
    createRequirement: false,
    notifyClient: true,
    expeditionStatus: 'yellow_channel'
  },
  orange: {
    code: 'orange',
    label: 'Canal Naranja',
    description: 'Revision documental',
    action: 'documentary_review',
    createRequirement: true,
    notifyClient: true,
    expeditionStatus: 'orange_channel'
  },
  red: {
    code: 'red',
    label: 'Canal Rojo',
    description: 'Inspeccion fisica',
    action: 'physical_inspection',
    createRequirement: true,
    notifyClient: true,
    expeditionStatus: 'red_channel'
  }
};

// Tipos de documentos que pueden estar pendientes en canal amarillo
const REQUIRED_CERTIFICATES = {
  sanitary: { code: 'sanitary_certificate', name: 'Certificado Sanitario', authority: 'SANIDAD' },
  phytosanitary: { code: 'phytosanitary_certificate', name: 'Certificado Fitosanitario', authority: 'MAPA' },
  veterinary: { code: 'veterinary_certificate', name: 'Certificado Veterinario', authority: 'MAPA' },
  soivre: { code: 'soivre_certificate', name: 'Certificado SOIVRE', authority: 'SOIVRE' },
  origin: { code: 'certificate_of_origin', name: 'Certificado de Origen', authority: 'AEAT' },
  eur1: { code: 'eur1', name: 'Certificado EUR.1', authority: 'AEAT' },
  forma: { code: 'form_a', name: 'Form A (SPG)', authority: 'AEAT' },
  atr: { code: 'atr', name: 'Certificado ATR', authority: 'AEAT' },
  cites: { code: 'cites_permit', name: 'Permiso CITES', authority: 'MITERD' },
  reach: { code: 'reach_declaration', name: 'Declaracion REACH', authority: 'MITERD' }
};

class ChannelService {
  constructor() {
    logger.info('Channel Service initialized');
  }

  /**
   * Procesar asignacion de canal despues de envio a AEAT
   * @param {string} expeditionId - ID del expediente
   * @param {string} channel - Canal asignado (green, yellow, orange, red)
   * @param {object} aeatResponse - Respuesta completa de AEAT
   * @param {object} user - Usuario que realiza la operacion
   */
  async processChannelAssignment(expeditionId, channel, aeatResponse, user) {
    logger.info(`Processing channel assignment: ${channel} for expedition ${expeditionId}`);

    const expedition = await Expedition.findById(expeditionId);
    if (!expedition) {
      throw new Error('Expediente no encontrado');
    }

    const channelConfig = CHANNEL_CONFIG[channel];
    if (!channelConfig) {
      throw new Error(`Canal no reconocido: ${channel}`);
    }

    let result = {
      channel,
      channelConfig,
      actions: []
    };

    // Procesar segun tipo de canal
    switch (channel) {
      case 'green':
        result = await this._processGreenChannel(expedition, aeatResponse, user);
        break;
      case 'yellow':
        result = await this._processYellowChannel(expedition, aeatResponse, user);
        break;
      case 'orange':
        result = await this._processOrangeChannel(expedition, aeatResponse, user);
        break;
      case 'red':
        result = await this._processRedChannel(expedition, aeatResponse, user);
        break;
    }

    // Actualizar estado del expediente
    expedition.status = channelConfig.expeditionStatus;
    expedition.declaration.channel = channel;
    expedition.declaration.channelAssignedAt = new Date();

    // Agregar evento al timeline
    expedition.timeline.push({
      action: 'channel_assigned',
      description: `Canal asignado: ${channelConfig.label} - ${channelConfig.description}`,
      userId: user?._id,
      performedBy: user?.name || 'Sistema',
      timestamp: new Date(),
      metadata: {
        channel,
        mrn: expedition.declaration.mrn,
        ...result
      }
    });

    await expedition.save();

    // Notificar al cliente si corresponde
    if (channelConfig.notifyClient) {
      await this._notifyClient(expedition, channel, result);
    }

    return result;
  }

  /**
   * Canal Verde - Levante automatico
   */
  async _processGreenChannel(expedition, aeatResponse, user) {
    logger.info(`Processing GREEN channel for ${expedition.expeditionId}`);

    // Registrar fecha de levante
    expedition.declaration.levanteDate = new Date();
    expedition.declaration.levanteNumber = this._generateLevanteNumber(expedition);

    // Generar documento de levante
    const levanteDoc = await this._generateLevanteDocument(expedition);

    return {
      channel: 'green',
      success: true,
      levanteDate: expedition.declaration.levanteDate,
      levanteNumber: expedition.declaration.levanteNumber,
      levanteDocument: levanteDoc,
      actions: ['Levante generado', 'Mercancia puede retirarse'],
      message: 'CANAL VERDE - Levante autorizado. La mercancia puede retirarse del recinto aduanero.'
    };
  }

  /**
   * Canal Amarillo - Certificados pendientes
   */
  async _processYellowChannel(expedition, aeatResponse, user) {
    logger.info(`Processing YELLOW channel for ${expedition.expeditionId}`);

    // Identificar certificados faltantes basado en la mercancia
    const pendingCertificates = await this._identifyPendingCertificates(expedition);

    // Guardar certificados pendientes en el expediente
    expedition.pendingCertificates = pendingCertificates;

    return {
      channel: 'yellow',
      success: true,
      pendingCertificates,
      actions: pendingCertificates.map(c => `Pendiente: ${c.name}`),
      message: `CANAL AMARILLO - Pendiente recibir ${pendingCertificates.length} certificado(s). Una vez recibidos, se reevaluara automaticamente.`
    };
  }

  /**
   * Canal Naranja - Revision documental
   */
  async _processOrangeChannel(expedition, aeatResponse, user) {
    logger.info(`Processing ORANGE channel for ${expedition.expeditionId}`);

    // Crear requerimiento automatico
    const requirement = await this._createDocumentaryRequirement(expedition, aeatResponse, user);

    return {
      channel: 'orange',
      success: true,
      requirementId: requirement._id,
      requirementNumber: requirement.requirementNumber,
      deadline: requirement.deadline,
      requestedItems: requirement.requestedItems,
      actions: [
        'Requerimiento documental creado',
        `Numero: ${requirement.requirementNumber}`,
        `Plazo: ${requirement.deadline?.toLocaleDateString() || 'No especificado'}`
      ],
      message: 'CANAL NARANJA - Revision documental requerida. Se ha creado un requerimiento con los documentos solicitados.'
    };
  }

  /**
   * Canal Rojo - Inspeccion fisica
   */
  async _processRedChannel(expedition, aeatResponse, user) {
    logger.info(`Processing RED channel for ${expedition.expeditionId}`);

    // Crear requerimiento de inspeccion fisica
    const requirement = await this._createPhysicalInspectionRequirement(expedition, aeatResponse, user);

    return {
      channel: 'red',
      success: true,
      requirementId: requirement._id,
      requirementNumber: requirement.requirementNumber,
      inspectionType: 'physical',
      schedulingRequired: true,
      actions: [
        'Inspeccion fisica requerida',
        'Mercancia retenida en recinto',
        'Programar cita con inspector'
      ],
      message: 'CANAL ROJO - Inspeccion fisica requerida. La mercancia permanecera en el recinto aduanero hasta completar la inspeccion.'
    };
  }

  /**
   * Crear requerimiento documental automatico (Canal Naranja)
   */
  async _createDocumentaryRequirement(expedition, aeatResponse, user) {
    // Determinar documentos solicitados basado en el tipo de mercancia
    const requestedItems = this._determineRequestedDocuments(expedition, 'documentary');

    // Calcular deadline (normalmente 10 dias habiles)
    const deadline = this._calculateDeadline(10);

    const requirement = new Requirement({
      expeditionId: expedition._id,
      mrn: expedition.declaration.mrn,
      requirementType: 'documentary',
      issuingAuthority: 'AEAT',
      channel: 'orange',
      status: 'pending',
      subject: `Revision Documental - ${expedition.expeditionId}`,
      description: aeatResponse.aeatResponse?.description ||
        'Se requiere revision de la documentacion presentada. Por favor, aporte los documentos indicados.',
      deadline,
      requestedItems,
      priority: 'high',
      createdBy: user?._id,
      timeline: [{
        event: 'created',
        description: 'Requerimiento creado automaticamente por asignacion de canal naranja',
        userId: user?._id,
        performedBy: user?.name || 'Sistema',
        timestamp: new Date()
      }]
    });

    await requirement.save();

    logger.info(`Documentary requirement created: ${requirement.requirementNumber}`);

    return requirement;
  }

  /**
   * Crear requerimiento de inspeccion fisica (Canal Rojo)
   */
  async _createPhysicalInspectionRequirement(expedition, aeatResponse, user) {
    const requestedItems = this._determineRequestedDocuments(expedition, 'physical');

    const deadline = this._calculateDeadline(5); // Inspecciones tienen plazo mas corto

    const requirement = new Requirement({
      expeditionId: expedition._id,
      mrn: expedition.declaration.mrn,
      requirementType: 'physical',
      issuingAuthority: 'AEAT',
      channel: 'red',
      status: 'pending',
      subject: `Inspeccion Fisica - ${expedition.expeditionId}`,
      description: 'Inspeccion fisica requerida por la autoridad aduanera. Se debe programar cita en el recinto.',
      deadline,
      requestedItems,
      priority: 'critical',
      physicalInspection: {
        scheduled: false,
        inspectionType: aeatResponse.inspectionType || 'complete',
        location: {
          recintoCode: expedition.transport?.recintoCode || 'ESVAL1234',
          name: expedition.transport?.recintoName || 'Puerto de Valencia',
          address: expedition.transport?.recintoAddress
        }
      },
      createdBy: user?._id,
      timeline: [{
        event: 'created',
        description: 'Requerimiento creado automaticamente por asignacion de canal rojo',
        userId: user?._id,
        performedBy: user?.name || 'Sistema',
        timestamp: new Date()
      }]
    });

    await requirement.save();

    logger.info(`Physical inspection requirement created: ${requirement.requirementNumber}`);

    return requirement;
  }

  /**
   * Determinar documentos solicitados segun tipo de requerimiento y mercancia
   */
  _determineRequestedDocuments(expedition, requirementType) {
    const items = [];

    // Documentos base siempre solicitados en revision documental
    if (requirementType === 'documentary') {
      items.push({
        itemType: 'document',
        code: 'N380',
        description: 'Factura comercial',
        mandatory: true,
        provided: this._hasDocument(expedition, 'commercial_invoice')
      });

      items.push({
        itemType: 'document',
        code: 'N714',
        description: 'Packing List (Lista de contenido)',
        mandatory: true,
        provided: this._hasDocument(expedition, 'packing_list')
      });

      items.push({
        itemType: 'document',
        code: 'N785',
        description: 'Conocimiento de embarque / AWB / CMR',
        mandatory: true,
        provided: this._hasDocument(expedition, ['bill_of_lading', 'air_waybill', 'cmr'])
      });

      // Verificar si necesita certificado de origen
      if (this._requiresOriginCertificate(expedition)) {
        items.push({
          itemType: 'document',
          code: 'U069',
          description: 'Certificado de origen',
          mandatory: expedition.declaration.preference !== '100',
          provided: this._hasDocument(expedition, 'certificate_of_origin')
        });
      }

      // Agregar documentos especificos segun TARIC
      const taricSpecificDocs = this._getTaricSpecificDocuments(expedition);
      items.push(...taricSpecificDocs);
    }

    // Documentos para inspeccion fisica
    if (requirementType === 'physical') {
      items.push({
        itemType: 'presence',
        code: 'PHYSICAL',
        description: 'Presencia de la mercancia en recinto',
        mandatory: true,
        provided: false
      });

      items.push({
        itemType: 'document',
        code: 'N380',
        description: 'Factura comercial original',
        mandatory: true,
        provided: false
      });

      items.push({
        itemType: 'action',
        code: 'CITA',
        description: 'Programar cita con inspector',
        mandatory: true,
        provided: false
      });
    }

    return items;
  }

  /**
   * Verificar si el expediente tiene un tipo de documento
   */
  _hasDocument(expedition, docTypes) {
    if (!expedition.documents || expedition.documents.length === 0) {
      return false;
    }

    const types = Array.isArray(docTypes) ? docTypes : [docTypes];
    return expedition.documents.some(doc =>
      types.includes(doc.type) && doc.status === 'validated'
    );
  }

  /**
   * Verificar si requiere certificado de origen
   */
  _requiresOriginCertificate(expedition) {
    // Si tiene preferencia arancelaria distinta de 100 (terceros paises)
    if (expedition.declaration?.preference && expedition.declaration.preference !== '100') {
      return true;
    }

    // Verificar origen de los goods
    const nonEUOrigins = expedition.goods?.filter(g => {
      const country = g.originCountry;
      const euCountries = ['ES', 'FR', 'DE', 'IT', 'PT', 'NL', 'BE', 'AT', 'PL', 'SE', 'DK', 'FI', 'IE', 'GR', 'CZ', 'RO', 'HU', 'SK', 'BG', 'HR', 'SI', 'LT', 'LV', 'EE', 'CY', 'LU', 'MT'];
      return !euCountries.includes(country);
    });

    return nonEUOrigins?.length > 0;
  }

  /**
   * Obtener documentos especificos segun TARIC
   */
  _getTaricSpecificDocuments(expedition) {
    const items = [];
    const taricCodes = expedition.goods?.map(g => g.taricCode) || [];

    // Productos que requieren certificado sanitario (capitulos 02-05, 15-23)
    const sanitaryChapters = ['02', '03', '04', '05', '15', '16', '17', '18', '19', '20', '21', '22', '23'];
    if (taricCodes.some(t => t && sanitaryChapters.includes(t.substring(0, 2)))) {
      items.push({
        itemType: 'document',
        code: 'C620',
        description: 'Certificado Sanitario / Veterinario',
        mandatory: true,
        provided: false,
        authority: 'MAPA'
      });
    }

    // Productos que requieren certificado fitosanitario (capitulo 06-14)
    const phytoChapters = ['06', '07', '08', '09', '10', '11', '12', '13', '14'];
    if (taricCodes.some(t => t && phytoChapters.includes(t.substring(0, 2)))) {
      items.push({
        itemType: 'document',
        code: 'C633',
        description: 'Certificado Fitosanitario',
        mandatory: true,
        provided: false,
        authority: 'MAPA'
      });
    }

    // Productos textiles (capitulos 50-63)
    const textileChapters = ['50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63'];
    if (taricCodes.some(t => t && textileChapters.includes(t.substring(0, 2)))) {
      items.push({
        itemType: 'document',
        code: 'Y923',
        description: 'Composicion del producto textil',
        mandatory: true,
        provided: false
      });
    }

    // Productos electronicos (capitulo 85)
    if (taricCodes.some(t => t && t.substring(0, 2) === '85')) {
      items.push({
        itemType: 'document',
        code: 'C057',
        description: 'Declaracion CE de conformidad',
        mandatory: false,
        provided: false
      });
    }

    return items;
  }

  /**
   * Identificar certificados pendientes para canal amarillo
   */
  async _identifyPendingCertificates(expedition) {
    const pending = [];

    // Analizar los TARIC para determinar certificados requeridos
    const taricDocs = this._getTaricSpecificDocuments(expedition);

    for (const doc of taricDocs) {
      if (!doc.provided) {
        pending.push({
          code: doc.code,
          name: doc.description,
          authority: doc.authority || 'AEAT',
          mandatory: doc.mandatory
        });
      }
    }

    // Verificar certificado de origen si aplica
    if (this._requiresOriginCertificate(expedition) &&
        !this._hasDocument(expedition, 'certificate_of_origin')) {
      pending.push({
        code: 'U069',
        name: 'Certificado de Origen',
        authority: 'AEAT',
        mandatory: true
      });
    }

    return pending;
  }

  /**
   * Calcular deadline en dias habiles
   */
  _calculateDeadline(businessDays) {
    const deadline = new Date();
    let daysAdded = 0;

    while (daysAdded < businessDays) {
      deadline.setDate(deadline.getDate() + 1);
      // Saltar fines de semana
      if (deadline.getDay() !== 0 && deadline.getDay() !== 6) {
        daysAdded++;
      }
    }

    return deadline;
  }

  /**
   * Generar numero de levante
   */
  _generateLevanteNumber(expedition) {
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `LEV${year}${random}`;
  }

  /**
   * Generar documento de levante
   */
  async _generateLevanteDocument(expedition) {
    // En una implementacion real, esto generaria un PDF con el levante oficial
    const levanteData = {
      levanteNumber: expedition.declaration.levanteNumber,
      mrn: expedition.declaration.mrn,
      expeditionId: expedition.expeditionId,
      importer: expedition.client?.companyName,
      importerEori: expedition.client?.eori,
      customsOffice: expedition.declaration.customsOffice,
      releaseDate: new Date().toISOString(),
      goods: expedition.goods?.map((g, i) => ({
        item: i + 1,
        description: g.description,
        taric: g.taricCode,
        packages: g.packages?.quantity,
        weight: g.grossWeight
      })),
      signature: {
        authority: 'Agencia Estatal de Administracion Tributaria',
        office: expedition.declaration.customsOffice,
        date: new Date().toISOString()
      }
    };

    logger.info(`Levante document generated: ${levanteData.levanteNumber}`);

    return levanteData;
  }

  /**
   * Notificar al cliente sobre el resultado del canal
   */
  async _notifyClient(expedition, channel, result) {
    try {
      const client = expedition.client;
      if (!client?.contact?.email) {
        logger.warn(`No client email for notification: ${expedition.expeditionId}`);
        return;
      }

      const channelConfig = CHANNEL_CONFIG[channel];
      const subject = `[LUCI] ${channelConfig.label} - Expediente ${expedition.expeditionId}`;

      let body = `Estimado cliente,\n\n`;
      body += `Le informamos que su expediente ${expedition.expeditionId} ha sido asignado a ${channelConfig.label}.\n\n`;
      body += `${result.message}\n\n`;

      if (result.actions && result.actions.length > 0) {
        body += `Acciones:\n`;
        result.actions.forEach(action => {
          body += `- ${action}\n`;
        });
      }

      body += `\nMRN: ${expedition.declaration.mrn}\n`;
      body += `\nPuede consultar el estado en nuestro portal de cliente.\n`;
      body += `\nAtentamente,\nLUCI - Agente de Aduanas Digital`;

      await emailService.sendEmail({
        to: client.contact.email,
        subject,
        text: body
      });

      logger.info(`Client notified about ${channel} channel: ${client.contact.email}`);

    } catch (error) {
      logger.error('Error notifying client:', error);
      // No lanzamos el error para no interrumpir el flujo principal
    }
  }

  /**
   * Reevaluar canal amarillo cuando se reciben certificados
   */
  async reevaluateYellowChannel(expeditionId, user) {
    const expedition = await Expedition.findById(expeditionId).populate('documents');

    if (!expedition || expedition.declaration?.channel !== 'yellow') {
      throw new Error('Expediente no encontrado o no esta en canal amarillo');
    }

    // Verificar si ya estan todos los certificados
    const pendingCerts = await this._identifyPendingCertificates(expedition);

    if (pendingCerts.length === 0) {
      // Todos los certificados recibidos - cambiar a verde
      expedition.declaration.channel = 'green';
      expedition.status = 'green_channel';
      expedition.declaration.levanteDate = new Date();
      expedition.declaration.levanteNumber = this._generateLevanteNumber(expedition);

      expedition.timeline.push({
        action: 'channel_upgraded',
        description: 'Canal actualizado de AMARILLO a VERDE - Todos los certificados recibidos',
        userId: user?._id,
        performedBy: user?.name || 'Sistema',
        timestamp: new Date()
      });

      await expedition.save();

      // Notificar levante
      await this._notifyClient(expedition, 'green', {
        message: 'Sus certificados han sido verificados. LEVANTE AUTORIZADO.'
      });

      return {
        success: true,
        newChannel: 'green',
        message: 'Certificados verificados. Levante autorizado.'
      };
    }

    return {
      success: false,
      stillPending: pendingCerts,
      message: `Aun faltan ${pendingCerts.length} certificado(s)`
    };
  }

  /**
   * Obtener configuracion de un canal
   */
  getChannelConfig(channel) {
    return CHANNEL_CONFIG[channel] || null;
  }

  /**
   * Obtener todos los canales
   */
  getAllChannels() {
    return CHANNEL_CONFIG;
  }
}

module.exports = new ChannelService();
