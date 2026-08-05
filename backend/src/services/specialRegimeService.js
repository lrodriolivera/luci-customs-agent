/**
 * Special Regime Service
 * Logica de negocio para regimenes aduaneros especiales
 *
 * Regimenes soportados:
 * - 51: Perfeccionamiento Activo
 * - 53: Importacion Temporal
 * - 71: Deposito Aduanero
 * - T1/T2/TIR: Transito
 */

const SpecialRegime = require('../models/SpecialRegime');
const Guarantee = require('../models/Guarantee');

/**
 * Carga el documento comprobando que pertenece a quien lo pide.
 * Las escrituras pasaban el id directo al servicio sin mirar owner.
 * Mismo error que cuando no existe, para no confirmar ids de otra cuenta.
 * Sin userId (jobs) no se comprueba; los documentos legacy sin owner pasan.
 */
async function _loadOwnedRegime(id, userId) {
  const doc = await SpecialRegime.findById(id);
  if (!doc) {
    throw new Error('Regimen no encontrado');
  }
  if (userId && doc.owner && String(doc.owner) !== String(userId)) {
    throw new Error('Regimen no encontrado');
  }
  return doc;
}


// Plazos maximos por defecto (en meses) segun CAU
const DEFAULT_DEADLINES = {
  '51': 12,   // Perfeccionamiento activo: 12 meses (prorrogable)
  '53': 24,   // Importacion temporal: 24 meses max
  '71': null, // Deposito aduanero: sin limite
  'T1': 0,    // Transito: segun ruta
  'T2': 0,
  'TIR': 0
};

// Tipos de arancel por codigo TARIC (simplificado para demo)
const TARIFF_RATES = {
  default: 0.05,      // 5% por defecto
  agricultural: 0.15, // 15% productos agricolas
  textile: 0.12,      // 12% textiles
  electronics: 0.03,  // 3% electronica
  vehicles: 0.10      // 10% vehiculos
};

const specialRegimeService = {
  /**
   * Crear nuevo regimen especial
   */
  async create(data, userId) {
    // Calcular fecha limite
    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    let deadlineDate;

    if (data.deadlineDate) {
      deadlineDate = new Date(data.deadlineDate);
    } else {
      // OJO: los transitos (T1/T2/TIR) tienen deadline 0 en la tabla y se
      // calculan por dias. Con `|| 12` ese 0 se convertia en 12 meses y la rama
      // de dias nunca se alcanzaba. Se distingue "cero" (transito, por dias),
      // "null" (deposito 71 sin limite -> fallback 12 meses, como antes) y
      // "no definido" (12 meses por defecto).
      const configured = DEFAULT_DEADLINES[data.regimeCode];
      if (configured === 0) {
        // Transito: usar dias
        deadlineDate = new Date(startDate);
        deadlineDate.setDate(deadlineDate.getDate() + (data.transitDays || 8));
      } else {
        const defaultMonths = (configured === undefined || configured === null) ? 12 : configured;
        deadlineDate = new Date(startDate);
        deadlineDate.setMonth(deadlineDate.getMonth() + defaultMonths);
      }
    }

    // Calcular derechos suspendidos para cada mercancia
    const goods = (data.goods || []).map(good => {
      const suspendedDuties = this.calculateSuspendedDuties(good, data.regimeCode);
      return { ...good, suspendedDuties };
    });

    const regime = new SpecialRegime({
      ...data,
      goods,
      owner: userId,
      startDate,
      deadlineDate,
      status: 'draft'
    });

    await regime.save();
    return regime;
  },

  /**
   * Calcular derechos suspendidos
   */
  calculateSuspendedDuties(good, regimeCode) {
    const customsValue = good.customsValue || 0;

    // Determinar tasa arancelaria (simplificado)
    const taricPrefix = (good.taricCode || '').substring(0, 2);
    let tariffRate = TARIFF_RATES.default;

    if (['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].includes(taricPrefix)) {
      tariffRate = TARIFF_RATES.agricultural;
    } else if (['50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63'].includes(taricPrefix)) {
      tariffRate = TARIFF_RATES.textile;
    } else if (['84', '85', '90'].includes(taricPrefix)) {
      tariffRate = TARIFF_RATES.electronics;
    } else if (['87'].includes(taricPrefix)) {
      tariffRate = TARIFF_RATES.vehicles;
    }

    const tariff = customsValue * tariffRate;
    const vat = (customsValue + tariff) * 0.21; // 21% IVA
    const excise = 0; // Impuestos especiales (solo para ciertos productos)

    return {
      tariff: Math.round(tariff * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      excise,
      total: Math.round((tariff + vat + excise) * 100) / 100
    };
  },

  /**
   * Autorizar regimen
   */
  async authorize(regimeId, authorizationData, userId) {
    const regime = await _loadOwnedRegime(regimeId, userId);

    if (!['draft', 'pending'].includes(regime.status)) {
      throw new Error('Solo se pueden autorizar regimenes en borrador o pendientes');
    }

    regime.authorization = {
      number: authorizationData.number || this.generateAuthNumber(regime.regimeCode),
      date: new Date(),
      expiryDate: authorizationData.expiryDate,
      controlOffice: authorizationData.controlOffice,
      holder: authorizationData.holder,
      conditions: authorizationData.conditions || []
    };

    regime.status = 'authorized';
    regime.statusHistory.push({
      status: 'authorized',
      timestamp: new Date(),
      user: userId,
      reason: 'Autorizacion concedida'
    });

    await regime.save();
    return regime;
  },

  /**
   * Generar numero de autorizacion
   */
  generateAuthNumber(regimeCode) {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `ES${regimeCode}${year}${random}`;
  },

  /**
   * Activar regimen (iniciar uso)
   */
  async activate(regimeId, userId) {
    const regime = await _loadOwnedRegime(regimeId, userId);

    if (regime.status !== 'authorized') {
      throw new Error('Solo se pueden activar regimenes autorizados');
    }

    // Verificar garantia si es requerida
    if (regime.totals.totalGuaranteed > 0 && !regime.guarantee?.guaranteeId) {
      throw new Error('Se requiere garantia para activar este regimen');
    }

    regime.status = 'active';
    regime.startDate = new Date();

    // Recalcular deadline desde la fecha de activacion
    if (DEFAULT_DEADLINES[regime.regimeCode] > 0) {
      regime.deadlineDate = new Date();
      regime.deadlineDate.setMonth(regime.deadlineDate.getMonth() + (regime.durationMonths || 12));
    }

    regime.statusHistory.push({
      status: 'active',
      timestamp: new Date(),
      user: userId,
      reason: 'Regimen activado'
    });

    await regime.save();
    return regime;
  },

  /**
   * Vincular garantia al regimen
   */
  async linkGuarantee(regimeId, guaranteeId, userId) {
    // Ambos extremos del vinculo se comprueban: sin esto se podia enganchar la
    // garantia de otro cliente a un regimen propio (consumiendo su saldo) o el
    // regimen ajeno a una garantia propia.
    const [regime, guarantee] = await Promise.all([
      _loadOwnedRegime(regimeId, userId),
      Guarantee.findById(guaranteeId)
    ]);

    if (!guarantee) throw new Error('Garantia no encontrada');
    if (userId && guarantee.owner && String(guarantee.owner) !== String(userId)) {
      throw new Error('Garantia no encontrada');
    }

    // Verificar que la garantia tiene saldo suficiente. El modelo Guarantee usa
    // availableAmount/consumedAmount (no un subdoc `balance`, que no existe).
    if (guarantee.availableAmount < regime.totals.totalGuaranteed) {
      throw new Error(`Saldo insuficiente en garantia. Disponible: ${guarantee.availableAmount}, Requerido: ${regime.totals.totalGuaranteed}`);
    }

    // Afectar importe en la garantia
    guarantee.consumedAmount += regime.totals.totalGuaranteed;
    guarantee.availableAmount = guarantee.totalAmount - guarantee.consumedAmount;

    guarantee.movements.push({
      type: 'consumption',
      amount: -regime.totals.totalGuaranteed,
      description: `Afectacion regimen ${regime.regimeCode} - ${regime.reference}`,
      balanceAfter: guarantee.availableAmount
    });

    await guarantee.save();

    // Actualizar regimen
    regime.guarantee = {
      guaranteeId: guarantee._id,
      grn: guarantee.grn,
      amount: regime.totals.totalGuaranteed,
      status: 'active'
    };

    regime.statusHistory.push({
      status: regime.status,
      timestamp: new Date(),
      user: userId,
      reason: `Garantia ${guarantee.reference} vinculada`
    });

    await regime.save();
    return { regime, guarantee };
  },

  /**
   * Solicitar prorroga
   */
  async requestExtension(regimeId, extensionData, userId) {
    const regime = await _loadOwnedRegime(regimeId, userId);

    if (regime.status !== 'active') {
      throw new Error('Solo se pueden prorrogar regimenes activos');
    }

    const newDeadline = new Date(extensionData.newDeadline);
    if (newDeadline <= regime.deadlineDate) {
      throw new Error('La nueva fecha debe ser posterior a la actual');
    }

    // Validar limite maximo segun tipo de regimen
    const maxExtension = this.getMaxExtension(regime);
    if (maxExtension && newDeadline > maxExtension) {
      throw new Error(`Fecha maxima de prorroga: ${maxExtension.toLocaleDateString()}`);
    }

    regime.extensions.push({
      requestDate: new Date(),
      grantedDate: new Date(),
      newDeadline,
      reason: extensionData.reason,
      approvedBy: extensionData.approvedBy || 'Sistema'
    });

    regime.deadlineDate = newDeadline;

    regime.statusHistory.push({
      status: regime.status,
      timestamp: new Date(),
      user: userId,
      reason: `Prorroga concedida hasta ${newDeadline.toLocaleDateString()}`
    });

    await regime.save();
    return regime;
  },

  /**
   * Obtener fecha maxima de prorroga
   */
  getMaxExtension(regime) {
    const startDate = new Date(regime.startDate);

    switch (regime.regimeCode) {
      case '51': // Perfeccionamiento activo: max 3 anos
        return new Date(startDate.setFullYear(startDate.getFullYear() + 3));
      case '53': // Importacion temporal: max 24 meses
        return new Date(startDate.setMonth(startDate.getMonth() + 24));
      case '71': // Deposito: sin limite
        return null;
      default:
        return null;
    }
  },

  /**
   * Ultimar regimen (discharge)
   */
  async discharge(regimeId, dischargeData, userId) {
    const regime = await _loadOwnedRegime(regimeId, userId);

    if (!regime.canBeDischarge()) {
      throw new Error('Este regimen no puede ser ultimado en su estado actual');
    }

    // Actualizar datos de ultimacion
    regime.discharge = {
      type: dischargeData.type,
      declarationRef: dischargeData.declarationRef,
      mrn: dischargeData.mrn,
      date: new Date(),
      notes: dischargeData.notes,
      documents: dischargeData.documents || []
    };

    regime.status = 'discharged';
    regime.dischargeDate = new Date();

    // Liberar garantia si existe
    if (regime.guarantee?.guaranteeId) {
      await this.releaseGuarantee(regime);
    }

    // Calcular derechos a pagar si es despacho a libre practica
    let dutiesPayable = null;
    if (dischargeData.type === 'release_free_circulation') {
      dutiesPayable = await this.calculateDischargedDuties(regime, dischargeData);
    }

    regime.statusHistory.push({
      status: 'discharged',
      timestamp: new Date(),
      user: userId,
      reason: `Ultimacion: ${dischargeData.type}`
    });

    await regime.save();
    return { regime, dutiesPayable };
  },

  /**
   * Liberar garantia vinculada
   */
  async releaseGuarantee(regime) {
    if (!regime.guarantee?.guaranteeId) return;

    const guarantee = await Guarantee.findById(regime.guarantee.guaranteeId);
    if (!guarantee) return;

    const amount = regime.guarantee.amount || 0;
    guarantee.consumedAmount = Math.max(0, guarantee.consumedAmount - amount);
    guarantee.availableAmount = guarantee.totalAmount - guarantee.consumedAmount;

    guarantee.movements.push({
      type: 'release',
      amount,
      description: `Liberacion regimen ${regime.reference}`,
      balanceAfter: guarantee.availableAmount
    });

    await guarantee.save();

    regime.guarantee.status = 'released';
  },

  /**
   * Calcular derechos en ultimacion a libre practica
   */
  async calculateDischargedDuties(regime, dischargeData) {
    // Para importacion temporal con exencion parcial
    if (regime.regimeCode === '53' && regime.subType === 'partial_relief') {
      const months = this.getMonthsInRegime(regime);
      const monthlyRate = regime.temporaryAdmission?.monthlyDutyPercent || 3;
      const accumulatedPercent = Math.min(months * monthlyRate, 100);
      const totalDuties = regime.totals.suspendedDuties + regime.totals.suspendedVAT;

      return {
        accumulatedPercent,
        totalDuties,
        payable: Math.round(totalDuties * (1 - accumulatedPercent / 100) * 100) / 100,
        monthsInRegime: months
      };
    }

    // Para otros regimenes, se pagan todos los derechos
    return {
      payable: regime.totals.suspendedDuties + regime.totals.suspendedVAT + regime.totals.suspendedExcise
    };
  },

  /**
   * Calcular meses en regimen
   */
  getMonthsInRegime(regime) {
    const start = new Date(regime.startDate);
    const end = regime.dischargeDate ? new Date(regime.dischargeDate) : new Date();
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return Math.max(1, months);
  },

  /**
   * Anadir mercancia al regimen
   */
  async addGoods(regimeId, goodsData, userId) {
    const regime = await _loadOwnedRegime(regimeId, userId);

    if (!['draft', 'authorized', 'active'].includes(regime.status)) {
      throw new Error('No se pueden anadir mercancias en el estado actual');
    }

    const suspendedDuties = this.calculateSuspendedDuties(goodsData, regime.regimeCode);
    const good = { ...goodsData, suspendedDuties };

    regime.goods.push(good);
    regime.calculateTotals();

    // Verificar si necesita mas garantia
    if (regime.guarantee?.guaranteeId && regime.status === 'active') {
      const additionalAmount = suspendedDuties.total;
      const guarantee = await Guarantee.findById(regime.guarantee.guaranteeId);

      if (guarantee && guarantee.availableAmount >= additionalAmount) {
        guarantee.consumedAmount += additionalAmount;
        guarantee.availableAmount = guarantee.totalAmount - guarantee.consumedAmount;
        regime.guarantee.amount += additionalAmount;
        await guarantee.save();
      } else {
        throw new Error('Garantia insuficiente para cubrir nueva mercancia');
      }
    }

    await regime.save();
    return regime;
  },

  /**
   * Registrar salida parcial de mercancia (para deposito)
   */
  async partialExit(regimeId, exitData, userId) {
    const regime = await _loadOwnedRegime(regimeId, userId);

    if (regime.regimeCode !== '71') {
      throw new Error('Salida parcial solo disponible para deposito aduanero');
    }

    // Encontrar la mercancia
    const goodIndex = regime.goods.findIndex(g => g._id.toString() === exitData.goodId);
    if (goodIndex === -1) {
      throw new Error('Mercancia no encontrada');
    }

    const good = regime.goods[goodIndex];
    if (exitData.quantity > good.quantity) {
      throw new Error('Cantidad a extraer excede el stock');
    }

    // Reducir cantidad
    good.quantity -= exitData.quantity;

    // Recalcular derechos proporcionales
    const proportion = good.quantity / (good.quantity + exitData.quantity);
    good.customsValue *= proportion;
    good.suspendedDuties = this.calculateSuspendedDuties(good, '71');

    // Si queda en 0, eliminar
    if (good.quantity === 0) {
      regime.goods.splice(goodIndex, 1);
    }

    regime.calculateTotals();

    // Liberar garantia proporcional
    if (regime.guarantee?.guaranteeId) {
      const releaseAmount = (1 - proportion) * (regime.guarantee.amount || 0);
      const guarantee = await Guarantee.findById(regime.guarantee.guaranteeId);
      if (guarantee) {
        guarantee.consumedAmount = Math.max(0, guarantee.consumedAmount - releaseAmount);
        guarantee.availableAmount = guarantee.totalAmount - guarantee.consumedAmount;
        regime.guarantee.amount -= releaseAmount;
        await guarantee.save();
      }
    }

    // Registrar en historial
    regime.statusHistory.push({
      status: regime.status,
      timestamp: new Date(),
      user: userId,
      reason: `Salida parcial: ${exitData.quantity} unidades de ${good.description}`
    });

    await regime.save();
    return regime;
  },

  /**
   * Actualizar estado de transito
   */
  async updateTransitStatus(regimeId, transitUpdate, userId) {
    const regime = await _loadOwnedRegime(regimeId, userId);

    if (!['T1', 'T2', 'TIR'].includes(regime.regimeCode)) {
      throw new Error('Esta operacion solo aplica a transitos');
    }

    // Actualizar llegada a oficina de transito
    if (transitUpdate.arrivalAtOffice) {
      const officeIndex = regime.transit.transitOffices.findIndex(
        o => o.code === transitUpdate.arrivalAtOffice.code
      );
      if (officeIndex !== -1) {
        regime.transit.transitOffices[officeIndex].actualArrival = new Date();
      }
    }

    // Registrar incidencia
    if (transitUpdate.incident) {
      regime.transit.incidents.push({
        date: new Date(),
        location: transitUpdate.incident.location,
        description: transitUpdate.incident.description,
        resolution: transitUpdate.incident.resolution
      });
    }

    // Verificar precintos a la llegada
    if (transitUpdate.sealsCheck) {
      for (const seal of regime.transit.seals) {
        const check = transitUpdate.sealsCheck.find(s => s.number === seal.number);
        if (check) {
          seal.intactOnArrival = check.intact;
        }
      }
    }

    await regime.save();
    return regime;
  },

  /**
   * Obtener regimenes con alerta (por expirar)
   */
  async getExpiringRegimes(userId, days = 30) {
    const now = new Date();
    const deadline = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return SpecialRegime.find({
      owner: userId,
      status: 'active',
      deadlineDate: { $lte: deadline, $gt: now }
    })
    .sort({ deadlineDate: 1 })
    .populate('expedition', 'expeditionId reference');
  },

  /**
   * Obtener estadisticas de regimenes
   */
  async getStats(userId, filters = {}) {
    const query = { owner: userId };

    if (filters.regimeCode) {
      query.regimeCode = filters.regimeCode;
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    const regimes = await SpecialRegime.find(query);

    const stats = {
      total: regimes.length,
      byRegime: {
        '51': { count: 0, label: 'Perfeccionamiento Activo', suspendedDuties: 0 },
        '53': { count: 0, label: 'Importacion Temporal', suspendedDuties: 0 },
        '71': { count: 0, label: 'Deposito Aduanero', suspendedDuties: 0 },
        'T1': { count: 0, label: 'Transito T1', suspendedDuties: 0 },
        'T2': { count: 0, label: 'Transito T2', suspendedDuties: 0 }
      },
      byStatus: {
        draft: 0,
        pending: 0,
        authorized: 0,
        active: 0,
        discharged: 0,
        expired: 0
      },
      totals: {
        customsValue: 0,
        suspendedDuties: 0,
        guaranteedAmount: 0
      },
      alerts: {
        expiringSoon: 0,
        expired: 0
      }
    };

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    for (const r of regimes) {
      // Por regimen
      if (stats.byRegime[r.regimeCode]) {
        stats.byRegime[r.regimeCode].count++;
        stats.byRegime[r.regimeCode].suspendedDuties += r.totals?.totalGuaranteed || 0;
      }

      // Por estado
      if (stats.byStatus[r.status] !== undefined) {
        stats.byStatus[r.status]++;
      }

      // Totales
      stats.totals.customsValue += r.totals?.customsValue || 0;
      stats.totals.suspendedDuties += r.totals?.suspendedDuties || 0;
      stats.totals.guaranteedAmount += r.guarantee?.amount || 0;

      // Alertas
      if (r.status === 'active') {
        if (r.deadlineDate <= now) {
          stats.alerts.expired++;
        } else if (r.deadlineDate <= in30Days) {
          stats.alerts.expiringSoon++;
        }
      }
    }

    return stats;
  },

  /**
   * Listar regimenes
   */
  async list(userId, filters = {}, options = {}) {
    const query = { owner: userId };

    if (filters.regimeCode) query.regimeCode = filters.regimeCode;
    if (filters.status) query.status = filters.status;
    if (filters.search) {
      query.$or = [
        { reference: { $regex: filters.search, $options: 'i' } },
        { 'authorization.number': { $regex: filters.search, $options: 'i' } },
        { 'declarant.name': { $regex: filters.search, $options: 'i' } }
      ];
    }

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const [regimes, total] = await Promise.all([
      SpecialRegime.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('expedition', 'expeditionId reference status')
        .populate('guarantee.guaranteeId', 'reference type balance'),
      SpecialRegime.countDocuments(query)
    ]);

    return {
      regimes,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  },

  /**
   * Obtener detalle de regimen
   */
  async getById(regimeId, userId) {
    const regime = await SpecialRegime.findOne({ _id: regimeId, owner: userId })
      .populate('expedition')
      .populate('guarantee.guaranteeId')
      .populate('statusHistory.user', 'name email');

    if (!regime) {
      throw new Error('Regimen no encontrado');
    }

    return regime;
  },

  /**
   * Actualizar regimen
   */
  async update(regimeId, updateData, userId) {
    const regime = await SpecialRegime.findOne({ _id: regimeId, owner: userId });
    if (!regime) {
      throw new Error('Regimen no encontrado');
    }

    // Solo permitir edicion en ciertos estados
    if (!['draft', 'pending'].includes(regime.status)) {
      throw new Error('Solo se pueden editar regimenes en borrador o pendientes');
    }

    // Campos actualizables
    const allowedFields = [
      'declarant', 'holder', 'entryCustomsOffice', 'exitCustomsOffice',
      'premises', 'durationMonths', 'inwardProcessing', 'temporaryAdmission',
      'customsWarehouse', 'transit', 'notes'
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        regime[field] = updateData[field];
      }
    }

    // Recalcular si hay cambios en mercancias
    if (updateData.goods) {
      regime.goods = updateData.goods.map(g => ({
        ...g,
        suspendedDuties: this.calculateSuspendedDuties(g, regime.regimeCode)
      }));
      regime.calculateTotals();
    }

    await regime.save();
    return regime;
  },

  /**
   * Eliminar regimen (solo borradores)
   */
  async delete(regimeId, userId) {
    const regime = await SpecialRegime.findOne({ _id: regimeId, owner: userId });
    if (!regime) {
      throw new Error('Regimen no encontrado');
    }

    if (regime.status !== 'draft') {
      throw new Error('Solo se pueden eliminar regimenes en borrador');
    }

    await regime.deleteOne();
    return { deleted: true };
  }
};

module.exports = specialRegimeService;
