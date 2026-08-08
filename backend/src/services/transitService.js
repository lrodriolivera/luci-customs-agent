/**
 * Transit Service (NCTS)
 * Servicio para gestion de operaciones de transito T1/T2/TIR
 */

const { Transit, Guarantee, Expedition } = require('../models');
const User = require('../models/User');
const { generarMRN } = require('../utils/mrnFormat');

/**
 * Carga una expedicion comprobando que es del tenant de quien la pide.
 * Sin esto se podia crear un documento a partir del expediente de otro cliente,
 * copiando sus mercancias, valores y datos de cliente. El tenant se resuelve
 * desde el userId que la funcion ya recibe.
 */
async function _loadOwnedExpedition(expeditionId, userId) {
  const expedition = await Expedition.findById(expeditionId);
  if (!expedition) {
    throw new Error('Expediente no encontrado');
  }
  if (userId && expedition.tenantId) {
    const user = await User.findById(userId).select('tenantId').lean();
    if (user?.tenantId && String(expedition.tenantId) !== String(user.tenantId)) {
      throw new Error('Expediente no encontrado');
    }
  }
  return expedition;
}

const aeatSubmitService = require('./aeat/aeatSubmitService');
const logger = require('../config/logger');

/**
 * Traduce los rechazos del CC007 que llegan en jerga interna de AEAT.
 *
 * El caso que se repite es el 856: "ADDS_No existe ninguna partida no anulada con
 * el transito asociado". Significa que en el recinto de destino no hay ninguna
 * declaracion sumaria de deposito temporal (G4/DSDT) que referencie el transito,
 * y eso no se arregla desde LUCI: lo declara el almacen al recibir la mercancia.
 * Sin esta traduccion el usuario solo ve un identificador ADDS y no sabe si el
 * fallo es suyo, nuestro o del almacen.
 *
 * Se CONSERVA el texto original de AEAT, que lleva el MRN y el recinto: es la
 * unica traza que permite reclamar al almacen o al despacho de destino.
 */
function _explicarRechazoCC007(errorAEAT) {
  const texto = errorAEAT || 'Error en respuesta CC007/AEAT';

  if (/ADDS_No existe ninguna partida/i.test(texto)) {
    return 'AEAT no encuentra en el recinto de destino ninguna declaracion sumaria '
      + 'de deposito temporal (G4/DSDT) que referencie este transito. La sumaria la '
      + 'presenta el almacen de destino al recibir la mercancia: hasta entonces la '
      + 'llegada no se puede notificar. Respuesta de AEAT: ' + texto;
  }

  return texto;
}

/**
 * Pais de una aduana NCTS. Los codigos llevan el pais como prefijo ISO
 * ('ES002901' -> 'ES', 'DE004600' -> 'DE'); el `country` declarado, cuando
 * viene, prevalece. En los datos reales viene vacio casi siempre, asi que
 * depender solo de el equivale a no comprobar nada.
 */
function _paisAduana(office) {
  if (office?.country) return String(office.country).toUpperCase();
  return /^[A-Z]{2}/.exec(String(office?.code || '').toUpperCase())?.[0] || null;
}

/**
 * La llegada y la descarga de un transito se notifican a la aduana del pais
 * DONDE TERMINA el transito, y LUCI solo habla con AEAT.
 *
 * Sin esta guarda LUCI enviaba el CC007/CC044 a AEAT para un transito con
 * destino en Hamburgo o Rotterdam. AEAT no es la aduana de destino de ese
 * transito, asi que el mensaje no puede prosperar, y el rechazo que devolvia
 * ("falta el numero de autorizacion del lugar de la mercancia") culpaba a un
 * campo del formulario: el operador lo rellenaria una y otra vez sin que
 * funcione nunca. Se corta antes de construir el XML y salir a la red.
 */
function _exigirDestinoEspanol(transit, mensaje) {
  const pais = _paisAduana(transit.destinationOffice);
  if (pais === 'ES') return;

  const donde = pais ? `en ${pais}` : 'fuera de Espana';
  throw new Error(
    `La aduana de destino ${transit.destinationOffice?.code || '(sin codigo)'} esta ${donde}: `
    + `el ${mensaje} se presenta ante la autoridad aduanera de destino por su propio sistema NCTS, `
    + 'no ante AEAT. LUCI solo puede notificarlo cuando el transito termina en una aduana espanola. '
    + 'Debe hacerlo el destinatario autorizado del pais de destino.'
  );
}

const transitService = {
  /**
   * Crear nuevo transito
   */
  async create(data, userId) {
    // Generar LRN si no existe
    if (!data.lrn) {
      data.lrn = this.generateLRN();
    }

    // El formulario de la UI manda los precintos en la raiz (`seals`) y el modelo
    // los guarda en `transport.seals`: Mongoose descartaba la clave desconocida sin
    // avisar y el precinto que escribia el usuario desaparecia, enviandose el
    // transito a AEAT sin precintos declarados. Se normaliza aqui para no depender
    // de que cada cliente de la API acierte con la forma anidada.
    if (Array.isArray(data.seals)) {
      const precintos = data.seals.filter(s => s?.number?.trim());
      data = { ...data, transport: { ...(data.transport || {}) } };
      if (!data.transport.seals?.length) {
        data.transport.seals = precintos;
        data.transport.sealCount = precintos.length;
      }
      delete data.seals;
    }

    // Vincular expedicion si existe
    if (data.expeditionId) {
      await _loadOwnedExpedition(data.expeditionId, userId);
    }

    // Validar garantia si se especifica.
    // Excepcion en entorno no-produccion (PRE/dev): permitir GRN sin registro local
    // porque AEAT PRE acepta una GRN de prueba compartida (26ES000280... de Jose Antonio).
    if (data.guarantee?.grn) {
      const isProduction = process.env.AEAT_ENVIRONMENT === 'production';
      const guarantee = await Guarantee.findOne({
        grn: data.guarantee.grn,
        owner: userId
      });
      if (!guarantee) {
        if (isProduction) {
          throw new Error('Garantia no encontrada');
        }
      } else if (guarantee.status !== 'active') {
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
   * Enviar declaracion a NCTS.
   *
   * Admite tambien `submitted`, que significa "el IE015 salio y aun no ha
   * llegado el IE028 con el MRN". Era un callejon sin salida: las seis
   * transiciones lo rechazaban, el borrado exige draft y la UI no ofrecia
   * ninguna accion, asi que un transito ahi no se podia ni mover ni retirar.
   * La salida correcta es reintentar el envio, no rehacer el expediente.
   */
  async submit(id, userId) {
    const transit = await Transit.findOne({ _id: id, owner: userId });

    if (!transit) {
      throw new Error('Transito no encontrado');
    }

    if (!['draft', 'submitted'].includes(transit.status)) {
      throw new Error('Solo se pueden enviar transitos en estado borrador o ya enviados sin respuesta de NCTS');
    }

    // Un `submitted` CON mrn es incoherente: si AEAT dio MRN, la declaracion
    // esta aceptada. Reenviarla la duplicaria en NCTS, asi que solo se corrige
    // el estado. Los seeds creaban exactamente este caso.
    if (transit.status === 'submitted' && transit.mrn) {
      transit.status = 'accepted';
      transit.dates.acceptance = transit.dates.acceptance || new Date();
      transit.statusHistory.push({
        status: 'accepted',
        timestamp: new Date(),
        user: userId,
        reason: `Ya tenia MRN ${transit.mrn} asignado por NCTS: no se reenvia la declaracion`
      });
      await transit.save();
      return transit;
    }

    // Validar campos requeridos
    this.validateForSubmission(transit);

    // Enviar a NCTS real via aeatSubmitService (IE015)
    const messageId = `MSG${Date.now()}`;
    transit.messages.push({
      type: 'IE015',
      direction: 'outbound',
      timestamp: new Date(),
      content: { lrn: transit.lrn },
      correlationId: messageId
    });

    const aeatResult = await aeatSubmitService.submitNCTS(transit);

    if (!aeatResult.success) {
      throw new Error(aeatResult.error || 'Error en respuesta NCTS/AEAT');
    }

    transit.mrn = aeatResult.mrn;
    transit.status = 'accepted';
    transit.dates.declaration = new Date();
    transit.dates.acceptance = new Date();

    transit.messages.push({
      type: 'IE028',
      direction: 'inbound',
      timestamp: new Date(),
      content: { mrn: aeatResult.mrn, lrn: transit.lrn, code: aeatResult.code },
      correlationId: messageId
    });

    transit.statusHistory.push({
      status: 'accepted',
      timestamp: new Date(),
      user: userId,
      reason: `MRN ${aeatResult.mrn} asignado por NCTS`
    });

    logger.info(`Transit ${transit.lrn} submitted: MRN ${aeatResult.mrn}`);

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

    // El IE029 (Release for Transit) es una AUTORIZACION que emite la aduana de
    // partida: no hay envio a AEAT en esta transicion, la genera LUCI para dejar
    // constancia del cambio de estado. Marcarlo `inbound` afirmaba que AEAT habia
    // liberado la mercancia, indistinguible del IE015/IE028 reales del expediente.
    transit.messages.push({
      type: 'IE029',
      timestamp: new Date(),
      content: { mrn: transit.mrn, releaseDate: new Date() },
      exchanged: false
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
   * Notificar llegada a aduana de destino (CC007 / IE160).
   *
   * Envia el mensaje a AEAT de verdad: si lo rechaza, NO se toca el estado. Antes
   * el controller tenia un segundo `notifyArrival` que pisaba a este, enviaba el
   * CC007 y respondia siempre `{success:true}`, asi que un rechazo de AEAT se
   * mostraba como llegada notificada y el transito se quedaba en `in_transit`.
   */
  async notifyArrival(id, data, userId) {
    const transit = await Transit.findOne({ _id: id, owner: userId });

    if (!transit) {
      throw new Error('Transito no encontrado');
    }

    if (!['released', 'in_transit'].includes(transit.status)) {
      throw new Error('Transito debe estar en camino para notificar llegada');
    }

    if (!transit.mrn) {
      throw new Error('El transito no tiene MRN: no se puede notificar la llegada');
    }

    _exigirDestinoEspanol(transit, 'aviso de llegada (CC007)');

    const arrivalDate = data.arrivalDate || new Date();

    const aeatResult = await aeatSubmitService.submitNCTSArrival({
      mrn: transit.mrn,
      officeOfDestination: transit.destinationOffice?.code || '',
      arrivalDate,
      traderEORI: transit.consignee?.eori || transit.principal?.eori || '',
      traderName: transit.consignee?.name || transit.principal?.name || '',
      // Datos de RECEPCION: los tres los exige el CC007 y ninguno se puede
      // deducir del tránsito, asi que se propagan si el tránsito los trae y es
      // aeatSubmitService quien pone los de PRE cuando faltan.
      authorisationNumber: transit.locationAuthorisationNumber || '',
      authorisationReference: transit.authorisationNumber || '',
      numeroSumariaRecepcion: transit.numeroSumariaRecepcion || ''
    });

    if (!aeatResult.success) {
      throw new Error(_explicarRechazoCC007(aeatResult.error));
    }

    // IE160 (Arrival Notification): el CC007 aceptado por AEAT.
    transit.messages.push({
      type: 'IE160',
      direction: 'outbound',
      timestamp: new Date(),
      content: {
        mrn: transit.mrn,
        arrivalDate,
        customsOffice: transit.destinationOffice.code
      }
    });

    transit.status = 'arrived';
    transit.dates.actualArrival = arrivalDate;

    transit.statusHistory.push({
      status: 'arrived',
      timestamp: new Date(),
      user: userId,
      office: transit.destinationOffice.code,
      reason: data.notes || 'Llegada notificada'
    });

    await transit.save();
    logger.info(`Transit ${transit.lrn} arrival notified: MRN ${transit.mrn}`);
    return transit;
  },

  /**
   * Notificar resultado de la descarga en destino (CC044 / IE044).
   *
   * Mismo criterio que notifyArrival: el estado solo avanza si AEAT acepta.
   */
  async notifyUnloading(id, data, userId) {
    const transit = await Transit.findOne({ _id: id, owner: userId });

    if (!transit) {
      throw new Error('Transito no encontrado');
    }

    if (!['arrived', 'control_requested'].includes(transit.status)) {
      throw new Error('Transito debe haber llegado a destino para notificar la descarga');
    }

    if (!transit.mrn) {
      throw new Error('El transito no tiene MRN: no se puede notificar la descarga');
    }

    _exigirDestinoEspanol(transit, 'resultado de la descarga (CC044)');

    const unloadingDate = data.unloadingDate || new Date();

    const aeatResult = await aeatSubmitService.submitNCTSUnloading({
      mrn: transit.mrn,
      officeOfDestination: transit.destinationOffice?.code || '',
      traderEORI: transit.consignee?.eori || transit.principal?.eori || '',
      unloadingDate,
      unloadingRemark: data.remark || '',
      sealsOk: data.sealsOk !== false,
      goodsConform: data.goodsConform !== false,
      goodsDiscrepancies: data.discrepancies || []
    });

    if (!aeatResult.success) {
      throw new Error(aeatResult.error || 'Error en respuesta CC044/AEAT');
    }

    transit.messages.push({
      type: 'IE044',
      direction: 'outbound',
      timestamp: new Date(),
      content: {
        mrn: transit.mrn,
        unloadingDate,
        sealsOk: data.sealsOk !== false,
        goodsConform: data.goodsConform !== false,
        discrepancies: data.discrepancies || []
      }
    });

    transit.status = 'unloaded';
    transit.dates.unloadingNotification = unloadingDate;

    transit.statusHistory.push({
      status: 'unloaded',
      timestamp: new Date(),
      user: userId,
      office: transit.destinationOffice.code,
      reason: data.remark || 'Descarga notificada'
    });

    await transit.save();
    logger.info(`Transit ${transit.lrn} unloading notified: MRN ${transit.mrn}`);
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

    // Resultado de control anotado en local: no sale ningun IE143 por la red en
    // esta transicion, asi que queda marcado como no intercambiado.
    transit.messages.push({
      type: 'IE143',
      direction: 'outbound',
      timestamp: new Date(),
      content: transit.controlResult,
      exchanged: false
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

    // `unloaded` (CC044 aceptado) tambien es un estado de destino: si no se
    // admitia, notificar la descarga dejaba el transito en un callejon sin salida
    // porque la UI ya no ofrecia ninguna accion.
    if (!['arrived', 'unloaded', 'control_requested'].includes(transit.status)) {
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

    // La solicitud de busqueda se registra en local; el IE118 a la aduana de
    // partida no se emite todavia, de ahi `exchanged: false`.
    transit.messages.push({
      type: 'IE118',
      direction: 'outbound',
      timestamp: new Date(),
      content: {
        mrn: transit.mrn,
        reason: transit.enquiry.reason
      },
      exchanged: false
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
    if (!transit.goodsItems?.length) {
      errors.push('Debe incluir al menos una mercancia');
    } else {
      // Una partida vacia pasaba este filtro y AEAT la rechazaba con el patron de
      // <ent:grossMass> ("El elemento no cumple con el formato exigido. Patron:
      // ([1-9]\d*(\.\d+)?)|(0\.\d*[1-9]\d*)"), un texto que no nombra ningun campo.
      // Se valida aqui para que el error diga que partida y que dato falta.
      transit.goodsItems.forEach((item, i) => {
        const n = item.itemNumber || i + 1;
        if (!item.description?.trim()) errors.push(`Partida ${n}: descripcion de la mercancia requerida`);
        if (!item.taricCode?.trim()) errors.push(`Partida ${n}: codigo TARIC requerido`);
        if (!(Number(item.grossWeight) > 0)) errors.push(`Partida ${n}: peso bruto debe ser mayor que 0`);
      });
    }

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
   * Generar MRN (simulado). Delega en el generador comun para que cumpla
   * siempre el patron de AEAT: `Math.random().toString(36)` devuelve cadenas de
   * longitud variable y de vez en cuando salia un MRN de 17 caracteres, que el
   * organismo rechaza con un error que no nombra el campo.
   */
  generateMRN(countryCode = 'ES') {
    return generarMRN({ pais: countryCode });
  }
};

module.exports = transitService;
