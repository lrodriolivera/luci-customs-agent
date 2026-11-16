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

const { escapeRegex } = require('../utils/escapeRegex');
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
 * Pais de una aduana NCTS. El `country` declarado prevalece; cuando falta, se
 * deduce del prefijo ISO del propio codigo ('ES002901' -> 'ES',
 * 'DE004600' -> 'DE'). El campo es opcional en el modelo, asi que sin el
 * fallback los expedientes creados a mano o importados quedarian sin comprobar.
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

/**
 * Codigos de resultado de control que, por definicion, describen una mercancia
 * que NO llego conforme: A3 discrepancia menor, A4 discrepancia significativa,
 * B1 robo, B2 perdida, B3 destruccion. A1 (satisfactorio) y A2 (conforme con
 * observaciones) si son conformes.
 */
const _CODIGOS_CONTROL_NO_CONFORME = {
  A3: 'el control de destino se califico A3 (discrepancia menor)',
  A4: 'el control de destino se califico A4 (discrepancia significativa)',
  B1: 'el control de destino se califico B1 (robo)',
  B2: 'el control de destino se califico B2 (perdida)',
  B3: 'el control de destino se califico B3 (destruccion)'
};

/**
 * Motivo por el que la mercancia de este transito NO puede declararse conforme
 * en el CC044, o `null` si nada en el expediente lo contradice.
 *
 * El CC044 declara ante la aduana de destino si la mercancia llego conforme, y
 * de esa conformidad depende que se genere o no una deuda aduanera. Si el
 * control de destino anoto discrepancias -o se califico A3/A4/B*-, decir en el
 * mensaje que llego conforme contradice el propio expediente: seria una
 * declaracion falsa a la aduana firmada por el operador.
 *
 * Devuelve texto para que el error diga QUE discrepancia lo impide y no solo
 * que hay una; el operador tiene que poder decidir si notifica la descarga con
 * la discrepancia o corrige el control.
 */
function _motivoMercanciaNoConforme(transit) {
  const control = transit?.controlResult;
  if (!control) return null;

  const cuantas = control.discrepancies?.length || 0;
  if (cuantas > 0) {
    const primera = control.discrepancies[0];
    const detalle = [
      primera?.type,
      primera?.itemNumber ? `partida ${primera.itemNumber}` : null,
      primera?.declared && primera?.found ? `declarado ${primera.declared} / hallado ${primera.found}` : null
    ].filter(Boolean).join(', ');
    const resto = cuantas > 1 ? ` (y ${cuantas - 1} mas)` : '';
    // El codigo del control (A3, A4...) va en el mensaje porque es el dato con
    // el que la aduana y el operador identifican el control: sin el, el aviso
    // no se puede casar con el expediente.
    const codigo = control.type ? ` [control ${control.type}]` : '';
    return `el control de destino${codigo} anoto ${cuantas} discrepancia(s)`
      + (detalle ? `: ${detalle}${resto}` : resto);
  }

  return _CODIGOS_CONTROL_NO_CONFORME[control.type] || null;
}

/**
 * Tenant que presenta (firmante del CC013C/CC014C/CC170C): el del transito o,
 * si el transito no lo guarda (create no lo fija), el del usuario. Sin tenant,
 * aeatSubmitService responde 422 por falta de EORI del representante.
 */
async function _ctxAduanero(transit, userId) {
  let tenantId = transit.tenantId;
  if (!tenantId) {
    const user = await User.findById(userId).select('tenantId').lean();
    tenantId = user?.tenantId;
  }
  if (!tenantId) return {};
  const Tenant = require('../models/Tenant');
  const tenant = await Tenant.findById(tenantId).lean();
  return tenant ? { tenant } : {};
}

/** Anota el estado NCTS que devuelve la AEAT (solo los campos que trae). */
function _anotarNcts(transit, { estado, circuito, csv, csvDat } = {}) {
  const previo = transit.ncts?.toObject ? transit.ncts.toObject() : (transit.ncts || {});
  transit.ncts = {
    ...previo,
    ...(estado ? { estado } : {}),
    ...(circuito ? { circuito } : {}),
    ...(csv ? { csv } : {}),
    ...(csvDat ? { csvDat } : {}),
    actualizado: new Date()
  };
}

/** Plazo de llegada que fija la AEAT (AAAA-MM-DD), si lo da. */
function _plazoDeLlegada(transit, fecha) {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return;
  transit.deadlines = { ...(transit.deadlines?.toObject ? transit.deadlines.toObject() : transit.deadlines || {}), arrivalDeadline: new Date(`${fecha}T23:59:59Z`) };
}

/**
 * La GRN ha de ser una garantia propia y activa (en PRE/dev se admite una GRN
 * sin registro local: AEAT PRE acepta una de prueba compartida).
 */
async function _validarGarantia(grn, userId) {
  const isProduction = process.env.AEAT_ENVIRONMENT === 'production';
  const guarantee = await Guarantee.findOne({ grn, owner: userId });
  if (!guarantee) {
    if (isProduction) throw new Error('Garantia no encontrada');
  } else if (guarantee.status !== 'active') {
    throw new Error('Garantia no esta activa');
  }
}

async function _cargarPropio(id, userId) {
  const transit = await Transit.findOne({ _id: id, owner: userId });
  if (!transit) throw new Error('Transito no encontrado');
  return transit;
}

/**
 * Campos que una modificacion (CC013C) puede cambiar. La guia NCTS6 v1.21
 * (11.1) prohibe cambiar el tipo de declaracion adicional, la seguridad, la
 * aduana de partida, el titular y el representante; los campos de sistema
 * (MRN, LRN, estado, mensajes...) no son datos de la declaracion.
 */
const _MODIFICABLES_CC013 = [
  'transitType', 'destinationOffice', 'transitOffices', 'guarantee', 'transport', 'goodsItems',
  'consigneeEORI', 'consigneeName', 'consignee', 'authorisationNumber', 'locationAuthorisationNumber',
  'placeOfLoading', 'referenceNumberUCR', 'route', 'principal', 'notes'
];

function _cambiosCC013(transit, data = {}) {
  const prohibido = (que) => new Error(`${que} no se puede modificar en una predeclaración (guía NCTS6 11.1): si es incorrecto, anule y presente otra`);
  if (data.additionalDeclarationType !== undefined && data.additionalDeclarationType !== transit.additionalDeclarationType) {
    throw prohibido('El tipo de declaración adicional');
  }
  if (data.departureOffice?.code !== undefined && data.departureOffice.code !== transit.departureOffice?.code) {
    throw prohibido('La aduana de partida');
  }
  if (data.principal?.eori !== undefined && data.principal.eori !== transit.principal?.eori) {
    throw prohibido('El titular del tránsito (EORI)');
  }
  if (data.representative !== undefined || data.securityIndicator !== undefined) {
    throw prohibido('El representante o el indicador de seguridad');
  }
  const cambios = {};
  for (const campo of _MODIFICABLES_CC013) {
    if (data[campo] !== undefined) cambios[campo] = data[campo];
  }
  if (cambios.principal) {
    const actual = transit.principal?.toObject ? transit.principal.toObject() : (transit.principal || {});
    cambios.principal = { ...actual, ...cambios.principal, eori: actual.eori };
  }
  if (Object.keys(cambios).length === 0) {
    throw new Error('No hay ningún cambio que enviar en la modificación');
  }
  return cambios;
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
      await _validarGarantia(data.guarantee.grn, userId);
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
        { mrn: { $regex: escapeRegex(filters.search), $options: 'i' } },
        { lrn: { $regex: escapeRegex(filters.search), $options: 'i' } },
        { reference: { $regex: escapeRegex(filters.search), $options: 'i' } },
        { 'principal.name': { $regex: escapeRegex(filters.search), $options: 'i' } }
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
      // El controlador responde "Declaracion enviada" segun este flag: por este
      // camino NO sale nada a AEAT, y decir lo contrario seria una afirmacion
      // falsa sobre una gestion aduanera.
      transit.$locals.declaracionEnviada = false;
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
    // Una predeclaracion (D) nace en PA: no esta admitida ni data la sumaria
    // hasta el CC170C (guia NCTS6 4.4.1). Marcarla `accepted` ofreceria liberar
    // una mercancia que la aduana aun no ha visto.
    const predeclaracion = aeatResult.estadoNcts === 'PA'
      || (!aeatResult.estadoNcts && transit.additionalDeclarationType === 'D');
    transit.status = predeclaracion ? 'prelodged' : 'accepted';
    transit.dates.declaration = new Date();
    if (!predeclaracion) transit.dates.acceptance = new Date();
    _anotarNcts(transit, { estado: aeatResult.estadoNcts, circuito: aeatResult.circuitoNcts });
    _plazoDeLlegada(transit, aeatResult.fechaLimiteLlegada);

    transit.messages.push({
      type: 'IE028',
      direction: 'inbound',
      timestamp: new Date(),
      content: { mrn: aeatResult.mrn, lrn: transit.lrn, code: aeatResult.code },
      correlationId: messageId
    });

    transit.statusHistory.push({
      status: transit.status,
      timestamp: new Date(),
      user: userId,
      reason: predeclaracion
        ? `Predeclaración admitida con MRN ${aeatResult.mrn}: falta presentar la mercancía (CC170C)`
        : `MRN ${aeatResult.mrn} asignado por NCTS`
    });

    logger.info(`Transit ${transit.lrn} submitted: MRN ${aeatResult.mrn}`);

    await transit.save();
    transit.$locals.declaracionEnviada = true;
    return transit;
  },

  /**
   * Presentar la mercancia de una predeclaracion en la aduana de partida
   * (CC170C). Solo en PA. Si la AEAT la admite, la declaracion pasa de D a A,
   * data la sumaria y queda en PG, PD o DE: en LUCI, `accepted` con ese estado.
   */
  async presentGoods(id, data = {}, userId) {
    const transit = await _cargarPropio(id, userId);
    if (transit.status !== 'prelodged') {
      throw new Error('Solo se presenta la mercancía de una predeclaración (estado NCTS PA)');
    }
    const opciones = data.locationAuthorisationNumber ? { locationAuthorisationNumber: String(data.locationAuthorisationNumber).trim().toUpperCase() } : {};
    const r = await aeatSubmitService.submitNCTSPresentation(transit, opciones, await _ctxAduanero(transit, userId));
    if (!r.success) throw new Error(r.error || 'La AEAT no admitió la presentación (CC170C)');

    if (opciones.locationAuthorisationNumber) transit.locationAuthorisationNumber = opciones.locationAuthorisationNumber;
    transit.additionalDeclarationType = 'A';
    transit.status = 'accepted';
    transit.dates.acceptance = new Date();
    _anotarNcts(transit, { estado: r.estado, circuito: r.circuito, csv: r.csv, csvDat: r.csvDat });
    _plazoDeLlegada(transit, r.fechas?.limiteLlegada);
    transit.messages.push({
      type: 'IE170', direction: 'outbound', timestamp: new Date(),
      content: { mrn: transit.mrn, lrn: transit.lrn, estado: r.estado, circuito: r.circuito, csv: r.csv, codigo: r.codigoRespuesta }
    });
    transit.statusHistory.push({
      status: 'accepted', timestamp: new Date(), user: userId, office: transit.departureOffice?.code,
      reason: `Mercancía presentada (CC170C): estado NCTS ${r.estado || 'desconocido'}${r.circuito ? `, circuito ${r.circuito}` : ''}`
    });
    await transit.save();
    logger.info(`Transit ${transit.lrn} presented (CC170C): MRN ${transit.mrn} -> ${r.estado}`);
    return transit;
  },

  /**
   * Modificar una predeclaracion (CC013C). Solo en PA. El mensaje lleva la
   * declaracion entera con los cambios; el expediente solo se actualiza si la
   * AEAT los admite.
   */
  async amend(id, data = {}, userId) {
    const transit = await _cargarPropio(id, userId);
    if (transit.status !== 'prelodged') {
      throw new Error('Solo se puede modificar una predeclaración (estado NCTS PA): una declaración admitida no se modifica');
    }
    const cambios = _cambiosCC013(transit, data);
    if (cambios.guarantee?.grn && cambios.guarantee.grn !== transit.guarantee?.grn) {
      await _validarGarantia(cambios.guarantee.grn, userId);
    }
    // Los cambios se aplican y validan contra el modelo ANTES de enviar: si no,
    // un dato que Mongoose no acepta saldria a la AEAT y el save posterior
    // fallaria con la modificacion ya admitida (AEAT y LUCI desincronizados).
    // Si algo falla, el documento se descarta sin guardar.
    transit.set(cambios);
    try {
      await transit.validate();
    } catch (e) {
      throw new Error(`La modificación no es válida: ${e.message}`);
    }
    const propuesta = transit.toObject();
    this.validateForSubmission(propuesta);

    const r = await aeatSubmitService.submitNCTSAmendment(propuesta, await _ctxAduanero(transit, userId));
    if (!r.success) throw new Error(r.error || 'La AEAT no admitió la modificación (CC013C)');

    _anotarNcts(transit, { estado: r.estado, csv: r.csv });
    transit.messages.push({
      type: 'IE013', direction: 'outbound', timestamp: new Date(),
      content: { mrn: transit.mrn, campos: Object.keys(cambios), estado: r.estado, csv: r.csv, codigo: r.codigoRespuesta }
    });
    transit.statusHistory.push({
      status: transit.status, timestamp: new Date(), user: userId,
      reason: `Predeclaración modificada (CC013C): ${Object.keys(cambios).join(', ')}`
    });
    await transit.save();
    logger.info(`Transit ${transit.lrn} amended (CC013C): MRN ${transit.mrn}`);
    return transit;
  },

  /**
   * Solicitar la invalidacion (CC014C). Por servicio web solo en PA o PG
   * (guia NCTS6 10.1); en PD o DE hay que pedirla en la aduana por registro.
   */
  async invalidate(id, data = {}, userId) {
    const transit = await _cargarPropio(id, userId);
    const estadoNcts = transit.ncts?.estado;
    const admite = transit.status === 'prelodged' || (transit.status === 'accepted' && estadoNcts === 'PG');
    if (!admite) {
      throw new Error('La AEAT solo admite la anulación por servicio web de una predeclaración (PA) o de una declaración pendiente de '
        + `garantía extranjera (PG)${estadoNcts ? `; este tránsito está en ${estadoNcts}` : ''}. Para anularla hay que solicitarlo `
        + 'en la aduana de partida por registro (guía NCTS6, 4.4.2.2).');
    }
    const motivo = String(data.motivo ?? '').trim();
    if (!motivo) throw new Error('Indique el motivo de la anulación: la AEAT lo exige');

    const r = await aeatSubmitService.submitNCTSInvalidation(transit, { motivo }, await _ctxAduanero(transit, userId));
    if (!r.success) throw new Error(r.error || 'La AEAT no admitió la anulación (CC014C)');

    transit.status = 'cancelled';
    _anotarNcts(transit, { estado: r.estado, csv: r.csv });
    transit.messages.push({
      type: 'IE014', direction: 'outbound', timestamp: new Date(),
      content: { mrn: transit.mrn, motivo, estado: r.estado, csv: r.csv, fecha: r.fechas?.invalidacion, codigo: r.codigoRespuesta }
    });
    transit.statusHistory.push({
      status: 'cancelled', timestamp: new Date(), user: userId,
      reason: `Anulado en la AEAT (CC014C, estado ${r.estado || 'desconocido'}): ${motivo}`
    });
    await transit.save();
    logger.info(`Transit ${transit.lrn} invalidated (CC014C): MRN ${transit.mrn} -> ${r.estado}`);
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

    // La conformidad de precintos NO se afirma sin comprobarla: es la
    // declaracion con la que el destinatario autorizado responde ante la aduana
    // de la integridad de la mercancia. El boton de la UI llama sin datos, asi
    // que `data.sealsOk` es undefined y el valor por defecto salia como `true`.
    // El modelo ya guarda `transport.seals[].intactOnArrival` y ya tenia
    // `checkSeals()` para leerlo, sin ningun punto de llamada.
    const revisionPrecintos = transit.checkSeals();
    if (!revisionPrecintos.valid && data.sealsOk === true) {
      const rotos = revisionPrecintos.issues.map((i) => i.sealNumber).join(', ');
      throw new Error(
        `No se puede declarar en el CC044 que los precintos estan conformes: ${rotos} `
        + 'consta como roto o manipulado. Corrija el estado del precinto o notifique '
        + 'la descarga con la discrepancia.'
      );
    }
    const sealsOk = revisionPrecintos.valid && data.sealsOk !== false;

    // Lo mismo con la conformidad de la MERCANCIA: `data.goodsConform !== false`
    // salia `true` con el boton de la UI, que llama sin datos. Si el control de
    // destino anoto discrepancias o se califico de A3/A4/B*, declararla conforme
    // contradice el propio expediente — y sobre esa conformidad se decide si hay
    // deuda aduanera.
    const motivoNoConforme = _motivoMercanciaNoConforme(transit);
    if (motivoNoConforme && data.goodsConform === true) {
      throw new Error(
        'No se puede declarar en el CC044 que la mercancia llego conforme: '
        + `${motivoNoConforme}. Notifique la descarga con la discrepancia.`
      );
    }
    const goodsConform = !motivoNoConforme && data.goodsConform !== false;

    // Las discrepancias del control viajan en el CC044 si el llamante no aporta
    // otras: declarar "no conforme" sin decir en que consiste deja a la aduana
    // sin lo que necesita para resolver.
    const discrepancias = data.discrepancies?.length
      ? data.discrepancies
      : (transit.controlResult?.discrepancies || []).map((d) => ({
        itemNumber: d.itemNumber,
        type: d.type,
        declared: d.declared,
        found: d.found,
        action: d.action
      }));

    const aeatResult = await aeatSubmitService.submitNCTSUnloading({
      mrn: transit.mrn,
      officeOfDestination: transit.destinationOffice?.code || '',
      traderEORI: transit.consignee?.eori || transit.principal?.eori || '',
      unloadingDate,
      unloadingRemark: data.remark || '',
      sealsOk,
      goodsConform,
      goodsDiscrepancies: discrepancias
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
        sealsOk,
        goodsConform,
        discrepancies: discrepancias
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
