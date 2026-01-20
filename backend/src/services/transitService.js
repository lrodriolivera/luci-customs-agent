/**
 * Transit Service (NCTS)
 * Servicio para gestion de operaciones de transito T1/T2/TIR
 */

const { Transit, Guarantee, Expedition } = require('../models');

const transitService = {
  /**
   * Crear nuevo transito
   */
  async create(data, userId) {
    // Generar LRN si no existe
    if (!data.lrn) {
      data.lrn = this.generateLRN();
    }

    // Vincular expedicion si existe
    if (data.expeditionId) {
      const expedition = await Expedition.findById(data.expeditionId);
      if (!expedition) {
        throw new Error('Expediente no encontrado');
      }
    }

    // Validar garantia si se especifica
    if (data.guarantee?.grn) {
      const guarantee = await Guarantee.findOne({
        grn: data.guarantee.grn,
        owner: userId
      });
      if (!guarantee) {
        throw new Error('Garantia no encontrada');
      }
      if (guarantee.status !== 'active') {
        throw new Error('Garantia no esta activa');
      }
    }

    const transit = new Transit({
      ...data,
      owner: userId,
      statusHistory: [{
        status: 'draft',
        timestamp: new Date(),
        user: userId,
        reason: 'Creacion inicial'
      }]
    });

    await transit.save();
    return transit;
  },

  /**
   * Listar transitos
   */
  async list(userId, filters = {}, options = {}) {
    const query = { owner: userId };

    if (filters.transitType) query.transitType = filters.transitType;
    if (filters.status) query.status = filters.status;
    if (filters.search) {
      query.$or = [
        { mrn: { $regex: filters.search, $options: 'i' } },
        { lrn: { $regex: filters.search, $options: 'i' } },
        { reference: { $regex: filters.search, $options: 'i' } },
        { 'principal.name': { $regex: filters.search, $options: 'i' } }
      ];
    }

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const [transits, total] = await Promise.all([
      Transit.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('expeditionId', 'reference clientName')
        .lean(),
      Transit.countDocuments(query)
    ]);

    return {
      transits,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  },

  /**
   * Obtener transito por ID
   */
  async getById(id, userId) {
    const transit = await Transit.findOne({ _id: id, owner: userId })
      .populate('expeditionId')
      .populate('statusHistory.user', 'name email');

    if (!transit) {
      throw new Error('Transito no encontrado');
    }

    return transit;
  },

  /**
   * Actualizar transito
   */
  async update(id, data, userId) {
    const transit = await Transit.findOne({ _id: id, owner: userId });

    if (!transit) {
      throw new Error('Transito no encontrado');
    }

    // Solo permitir edicion en estado draft
    if (transit.status !== 'draft') {
      throw new Error('Solo se pueden editar transitos en estado borrador');
    }

    // Campos no editables
    delete data.mrn;
    delete data.lrn;
    delete data.owner;
    delete data.statusHistory;
    delete data.messages;

    Object.assign(transit, data);
    await transit.save();

    return transit;
  },

  /**
   * Eliminar transito (solo borradores)
   */
  async delete(id, userId) {
    const transit = await Transit.findOne({ _id: id, owner: userId });

    if (!transit) {
      throw new Error('Transito no encontrado');
    }

    if (transit.status !== 'draft') {
      throw new Error('Solo se pueden eliminar transitos en estado borrador');
    }

    await Transit.deleteOne({ _id: id });
    return true;
  },

  /**
   * Enviar declaracion a NCTS
   */
  async submit(id, userId) {
    const transit = await Transit.findOne({ _id: id, owner: userId });

    if (!transit) {
      throw new Error('Transito no encontrado');
    }

    if (transit.status !== 'draft') {
      throw new Error('Solo se pueden enviar transitos en estado borrador');
    }

    // Validar campos requeridos
    this.validateForSubmission(transit);

    // Simular envio NCTS (IE015)
    const messageId = `MSG${Date.now()}`;
    transit.messages.push({
      type: 'IE015',
      direction: 'outbound',
      timestamp: new Date(),
      content: { lrn: transit.lrn },
      correlationId: messageId
    });

    // Simular respuesta positiva (IE028 - MRN asignado)
    const mrn = this.generateMRN(transit.departureOffice.country);
    transit.mrn = mrn;
    transit.status = 'accepted';
    transit.dates.declaration = new Date();
    transit.dates.acceptance = new Date();

    transit.messages.push({
      type: 'IE028',
      direction: 'inbound',
      timestamp: new Date(),
      content: { mrn, lrn: transit.lrn },
      correlationId: messageId
    });

    transit.statusHistory.push({
      status: 'accepted',
      timestamp: new Date(),
      user: userId,
      reason: 'MRN asignado por NCTS'
    });

    await transit.save();
    return transit;
  },

  /**
   * Liberar mercancias en aduana de partida
   */
  async releaseAtDeparture(id, userId) {
    const transit = await Transit.findOne({ _id: id, owner: userId });

    if (!transit) {
      throw new Error('Transito no encontrado');
    }

    if (transit.status !== 'accepted') {
      throw new Error('Transito debe estar aceptado para liberar');
    }

    // Simular mensaje IE029 (Release for Transit)
    transit.messages.push({
      type: 'IE029',
      direction: 'inbound',
      timestamp: new Date(),
      content: { mrn: transit.mrn, releaseDate: new Date() }
    });

    transit.status = 'released';
    transit.dates.releaseAtDeparture = new Date();

    // Calcular deadline de llegada
    transit.deadlines.arrivalDeadline = transit.calculateDeadline();

    transit.statusHistory.push({
      status: 'released',
      timestamp: new Date(),
      user: userId,
      reason: 'Mercancias liberadas en aduana de partida'
    });

    await transit.save();
    return transit;
  },

  /**
   * Iniciar transito (mercancias en camino)
   */
  async startTransit(id, userId) {
    const transit = await Transit.findOne({ _id: id, owner: userId });

    if (!transit) {
      throw new Error('Transito no encontrado');
    }

    if (transit.status !== 'released') {
      throw new Error('Transito debe estar liberado para iniciar');
    }

    transit.status = 'in_transit';
    transit.statusHistory.push({
      status: 'in_transit',
      timestamp: new Date(),
      user: userId,
      reason: 'Transito iniciado'
    });

    await transit.save();
    return transit;
  },

  /**
   * Notificar llegada a aduana de destino
   */
  async notifyArrival(id, data, userId) {
    const transit = await Transit.findOne({ _id: id, owner: userId });

    if (!transit) {
      throw new Error('Transito no encontrado');
    }

    if (!['released', 'in_transit'].includes(transit.status)) {
      throw new Error('Transito debe estar en camino para notificar llegada');
    }

    // Simular mensaje IE160 (Arrival Notification)
    transit.messages.push({
      type: 'IE160',
      direction: 'outbound',
      timestamp: new Date(),
      content: {
        mrn: transit.mrn,
        arrivalDate: data.arrivalDate || new Date(),
        customsOffice: transit.destinationOffice.code
      }
    });

    transit.status = 'arrived';
    transit.dates.actualArrival = data.arrivalDate || new Date();

    transit.statusHistory.push({
      status: 'arrived',
      timestamp: new Date(),
      user: userId,
      office: transit.destinationOffice.code,
      reason: data.notes || 'Llegada notificada'
    });

    await transit.save();
    return transit;
  },

  /**
   * Registrar resultado de control
   */
  async recordControlResult(id, data, userId) {
    const transit = await Transit.findOne({ _id: id, owner: userId });

    if (!transit) {
      throw new Error('Transito no encontrado');
    }

    if (transit.status !== 'arrived') {
      throw new Error('Transito debe haber llegado para registrar control');
    }

    transit.controlResult = {
      performed: true,
      type: data.type,
      date: data.date || new Date(),
      officer: data.officer,
      observations: data.observations,
      discrepancies: data.discrepancies || []
    };

    // Verificar precintos
    if (data.seals) {
      for (const sealData of data.seals) {
        const seal = transit.transport.seals.find(s => s.number === sealData.number);
        if (seal) {
          seal.intactOnArrival = sealData.intact;
        }
      }
    }

    // Simular mensaje IE143 (Control Results)
    transit.messages.push({
      type: 'IE143',
      direction: 'outbound',
      timestamp: new Date(),
      content: transit.controlResult
    });

    // Si hay discrepancias significativas
    if (data.type === 'A4' || data.type?.startsWith('B')) {
      transit.status = 'discrepancy';
      transit.statusHistory.push({
        status: 'discrepancy',
        timestamp: new Date(),
        user: userId,
        reason: `Control resultado: ${data.type}`
      });
    } else {
      transit.status = 'control_requested';
      transit.dates.controlCompletion = new Date();
    }

    await transit.save();
    return transit;
  },

  /**
   * Liberar mercancias en destino
   */
  async releaseGoods(id, userId) {
    const transit = await Transit.findOne({ _id: id, owner: userId });

    if (!transit) {
      throw new Error('Transito no encontrado');
    }

    if (!['arrived', 'control_requested'].includes(transit.status)) {
      throw new Error('Transito debe estar en destino para liberar mercancias');
    }

    transit.status = 'goods_released';
    transit.dates.goodsRelease = new Date();

    transit.statusHistory.push({
      status: 'goods_released',
      timestamp: new Date(),
      user: userId,
      reason: 'Mercancias liberadas en destino'
    });

    await transit.save();
    return transit;
  },

  /**
   * Completar transito
   */
  async complete(id, userId) {
    const transit = await Transit.findOne({ _id: id, owner: userId });

    if (!transit) {
      throw new Error('Transito no encontrado');
    }

    if (transit.status !== 'goods_released') {
      throw new Error('Transito debe tener mercancias liberadas para completar');
    }

    transit.status = 'completed';
    transit.dates.completion = new Date();

    transit.statusHistory.push({
      status: 'completed',
      timestamp: new Date(),
      user: userId,
      reason: 'Transito completado satisfactoriamente'
    });

    await transit.save();
    return transit;
  },

  /**
   * Iniciar procedimiento de busqueda (enquiry)
   */
  async initiateEnquiry(id, data, userId) {
    const transit = await Transit.findOne({ _id: id, owner: userId });

    if (!transit) {
      throw new Error('Transito no encontrado');
    }

    // Solo si esta vencido o hay discrepancia
    if (!transit.isOverdue() && transit.status !== 'discrepancy') {
      throw new Error('Solo se puede iniciar busqueda para transitos vencidos o con discrepancias');
    }

    transit.enquiry = {
      initiated: true,
      initiatedDate: new Date(),
      reason: data.reason || 'Plazo de llegada excedido',
      status: 'pending',
      responses: []
    };

    transit.status = 'enquiry';
    transit.deadlines.enquiryStart = new Date();

    // Simular mensaje IE118 (Enquiry Request)
    transit.messages.push({
      type: 'IE118',
      direction: 'outbound',
      timestamp: new Date(),
      content: {
        mrn: transit.mrn,
        reason: transit.enquiry.reason
      }
    });

    transit.statusHistory.push({
      status: 'enquiry',
      timestamp: new Date(),
      user: userId,
      reason: data.reason || 'Procedimiento de busqueda iniciado'
    });

    await transit.save();
    return transit;
  },

  /**
   * Registrar paso por aduana de transito
   */
  async recordTransitOfficePassage(id, data, userId) {
    const transit = await Transit.findOne({ _id: id, owner: userId });

    if (!transit) {
      throw new Error('Transito no encontrado');
    }

    const office = transit.transitOffices.find(o => o.code === data.officeCode);
    if (!office) {
      throw new Error('Aduana de transito no encontrada en la ruta');
    }

    office.actualArrival = data.arrivalDate || new Date();
    office.status = data.issue ? 'issue' : 'passed';

    await transit.save();
    return transit;
  },

  /**
   * Obtener transitos vencidos
   */
  async getOverdue(userId) {
    return Transit.find({
      owner: userId,
      status: { $in: ['released', 'in_transit'] },
      'deadlines.arrivalDeadline': { $lt: new Date() }
    }).sort({ 'deadlines.arrivalDeadline': 1 });
  },

  /**
   * Obtener estadisticas
   */
  async getStats(userId, filters = {}) {
    return Transit.getStats(userId, filters);
  },

  /**
   * Validar transito para envio
   */
  validateForSubmission(transit) {
    const errors = [];

    if (!transit.transitType) errors.push('Tipo de transito requerido');
    if (!transit.departureOffice?.code) errors.push('Aduana de partida requerida');
    if (!transit.destinationOffice?.code) errors.push('Aduana de destino requerida');
    if (!transit.principal?.eori) errors.push('EORI del principal obligado requerido');
    if (!transit.transport?.mode) errors.push('Modo de transporte requerido');
    if (!transit.goodsItems?.length) errors.push('Debe incluir al menos una mercancia');

    // Validar garantia para T1
    if (transit.transitType === 'T1' && !transit.guarantee?.type) {
      errors.push('Garantia requerida para transito T1');
    }

    if (errors.length > 0) {
      throw new Error(`Validacion fallida: ${errors.join(', ')}`);
    }

    return true;
  },

  /**
   * Generar LRN
   */
  generateLRN() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `LRN${timestamp}${random}`;
  },

  /**
   * Generar MRN (simulado)
   */
  generateMRN(countryCode = 'ES') {
    const year = new Date().getFullYear().toString().slice(-2);
    const country = countryCode.toUpperCase();
    const random = Math.random().toString(36).substring(2, 15).toUpperCase();
    return `${year}${country}${random}`.substring(0, 18);
  }
};

module.exports = transitService;
