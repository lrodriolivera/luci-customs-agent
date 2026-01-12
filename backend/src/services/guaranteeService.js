/**
 * Guarantee Service
 * Servicio para gestion de garantias aduaneras
 *
 * Funcionalidades:
 * - Gestion de garantias (CGU, individuales, depositos, avales)
 * - Calculo automatico de garantia requerida
 * - Control de saldo y consumos
 * - Alertas de vencimiento y saldo bajo
 * - Integracion con operaciones aduaneras
 */
const { Guarantee, Expedition } = require('../models');
const logger = require('../config/logger');

// Configuracion de tasas de garantia por regimen
const GUARANTEE_RATES = {
  // Transito
  transit: {
    T1: { rate: 100, description: 'Transito externo - 100% derechos' },
    T2: { rate: 100, description: 'Transito interno - 100% derechos' },
    TIR: { rate: 100, description: 'Transito TIR' }
  },
  // Deposito aduanero
  customs_warehouse: {
    public: { rate: 100, description: 'Deposito publico - 100% derechos' },
    private: { rate: 100, description: 'Deposito privado - 100% derechos' },
    type_A: { rate: 100, description: 'Tipo A - Responsabilidad depositario' },
    type_B: { rate: 100, description: 'Tipo B - Responsabilidad depositante' }
  },
  // Importacion temporal
  temporary_import: {
    partial_relief: { rate: 3, description: '3% mensual de derechos' },  // 3% por mes
    total_relief: { rate: 100, description: '100% derechos (exencion total)' }
  },
  // Perfeccionamiento
  inward_processing: {
    suspension: { rate: 100, description: 'Suspension - 100% derechos' },
    drawback: { rate: 0, description: 'Devolucion - sin garantia' }
  },
  // Pago diferido
  duty_deferment: {
    monthly: { rate: 100, description: 'Pago mensual diferido' }
  }
};

// Reduccion por OEA
const OEA_REDUCTIONS = {
  'AEOC': 0.70,  // 30% reduccion para OEA-C
  'AEOF': 0.70,  // 30% reduccion para OEA-F
  'AEOS': 0.50,  // 50% reduccion para OEA-S (seguridad)
  'AEOCF': 0.50  // 50% reduccion para OEA combinado
};

class GuaranteeService {

  /**
   * Crear nueva garantia
   */
  async createGuarantee(data, userId) {
    try {
      // Validar fechas
      const validFrom = new Date(data.validFrom);
      const validUntil = new Date(data.validUntil);

      if (validUntil <= validFrom) {
        throw new Error('Fecha de fin debe ser posterior a fecha de inicio');
      }

      if (validUntil <= new Date()) {
        throw new Error('Fecha de fin debe ser futura');
      }

      const guarantee = new Guarantee({
        ...data,
        owner: userId,
        status: 'draft',
        consumedAmount: 0,
        availableAmount: data.totalAmount
      });

      await guarantee.save();

      logger.info(`Garantia creada: ${guarantee.reference}`);

      return {
        success: true,
        data: guarantee
      };

    } catch (error) {
      logger.error('Error creating guarantee:', error);
      throw error;
    }
  }

  /**
   * Activar garantia (tras aprobacion AEAT)
   */
  async activateGuarantee(guaranteeId, grn, authData, userId) {
    const guarantee = await Guarantee.findById(guaranteeId);
    if (!guarantee) {
      throw new Error('Garantia no encontrada');
    }

    if (guarantee.status !== 'draft' && guarantee.status !== 'pending') {
      throw new Error(`No se puede activar garantia en estado ${guarantee.status}`);
    }

    // Verificar vigencia
    const now = new Date();
    if (guarantee.validFrom > now) {
      guarantee.status = 'pending';  // Aun no vigente
    } else if (guarantee.validUntil <= now) {
      throw new Error('Garantia ya expirada');
    } else {
      guarantee.status = 'active';
    }

    guarantee.grn = grn;
    guarantee.aeatAuthorization = {
      authNumber: authData.authNumber,
      authDate: authData.authDate || new Date(),
      customsOffice: authData.customsOffice,
      notes: authData.notes
    };

    guarantee.statusHistory.push({
      status: guarantee.status,
      timestamp: new Date(),
      user: userId,
      reason: `Activada con GRN ${grn}`
    });

    await guarantee.save();

    logger.info(`Garantia ${guarantee.reference} activada con GRN ${grn}`);

    return {
      success: true,
      data: guarantee
    };
  }

  /**
   * Calcular garantia requerida para operacion
   */
  calculateRequiredGuarantee(params) {
    const {
      regime,          // 'transit', 'customs_warehouse', etc.
      subType,         // 'T1', 'public', etc.
      customsValue,    // Valor en aduana
      dutyAmount,      // Aranceles calculados
      vatAmount,       // IVA calculado
      duration,        // Duracion en meses (para temp. import)
      oeaStatus        // Estado OEA del operador
    } = params;

    let baseAmount = 0;
    let rate = 100;
    let description = '';

    // Obtener tasa segun regimen
    if (GUARANTEE_RATES[regime] && GUARANTEE_RATES[regime][subType]) {
      const config = GUARANTEE_RATES[regime][subType];
      rate = config.rate;
      description = config.description;
    }

    // Calcular base: aranceles + IVA
    const totalDuties = (dutyAmount || 0) + (vatAmount || 0);

    // Para importacion temporal, calcular por meses
    if (regime === 'temporary_import' && subType === 'partial_relief') {
      baseAmount = totalDuties * (rate / 100) * (duration || 1);
    } else {
      baseAmount = totalDuties * (rate / 100);
    }

    // Aplicar reduccion OEA si aplica
    let finalAmount = baseAmount;
    let oeaReduction = 0;

    if (oeaStatus && OEA_REDUCTIONS[oeaStatus]) {
      const reductionFactor = OEA_REDUCTIONS[oeaStatus];
      oeaReduction = baseAmount * (1 - reductionFactor);
      finalAmount = baseAmount * reductionFactor;
    }

    // Minimo 100 EUR
    finalAmount = Math.max(100, Math.round(finalAmount * 100) / 100);

    return {
      regime,
      subType,
      description,
      baseAmount: Math.round(baseAmount * 100) / 100,
      rate,
      oeaStatus,
      oeaReduction: Math.round(oeaReduction * 100) / 100,
      finalAmount,
      breakdown: {
        customsValue,
        dutyAmount: dutyAmount || 0,
        vatAmount: vatAmount || 0,
        totalDuties,
        duration: duration || null
      }
    };
  }

  /**
   * Consumir garantia para operacion
   */
  async consumeGuarantee(guaranteeId, amount, reference, description, userId) {
    const guarantee = await Guarantee.findById(guaranteeId);
    if (!guarantee) {
      throw new Error('Garantia no encontrada');
    }

    try {
      const newBalance = guarantee.consume(amount, reference, description, userId);
      await guarantee.save();

      logger.info(`Garantia ${guarantee.reference}: consumo de ${amount} EUR. Disponible: ${newBalance} EUR`);

      return {
        success: true,
        data: {
          reference: guarantee.reference,
          consumed: amount,
          availableAmount: newBalance,
          consumedAmount: guarantee.consumedAmount,
          totalAmount: guarantee.totalAmount
        }
      };

    } catch (error) {
      logger.error(`Error consuming guarantee ${guarantee.reference}:`, error);
      throw error;
    }
  }

  /**
   * Liberar garantia (operacion finalizada)
   */
  async releaseGuarantee(guaranteeId, amount, reference, description, userId) {
    const guarantee = await Guarantee.findById(guaranteeId);
    if (!guarantee) {
      throw new Error('Garantia no encontrada');
    }

    const newBalance = guarantee.release(amount, reference, description, userId);
    await guarantee.save();

    logger.info(`Garantia ${guarantee.reference}: liberacion de ${amount} EUR. Disponible: ${newBalance} EUR`);

    return {
      success: true,
      data: {
        reference: guarantee.reference,
        released: amount,
        availableAmount: newBalance,
        consumedAmount: guarantee.consumedAmount,
        totalAmount: guarantee.totalAmount
      }
    };
  }

  /**
   * Buscar garantia adecuada para operacion
   */
  async findSuitableGuarantee(userId, amount, usage = 'general') {
    return Guarantee.findSuitableGuarantee(userId, amount, usage);
  }

  /**
   * Vincular garantia a expediente
   */
  async linkToExpedition(guaranteeId, expeditionId, amount, userId) {
    const guarantee = await Guarantee.findById(guaranteeId);
    if (!guarantee) {
      throw new Error('Garantia no encontrada');
    }

    // Verificar disponibilidad
    if (amount > guarantee.availableAmount) {
      throw new Error(`Importe ${amount} EUR excede disponible ${guarantee.availableAmount} EUR`);
    }

    // Consumir
    guarantee.consume(
      amount,
      { type: 'expedition', id: expeditionId },
      `Vinculacion a expediente`,
      userId
    );

    // Vincular
    guarantee.linkExpedition(expeditionId, amount);

    await guarantee.save();

    // Actualizar expediente
    await Expedition.findByIdAndUpdate(expeditionId, {
      $set: {
        'guarantee.id': guaranteeId,
        'guarantee.amount': amount,
        'guarantee.status': 'active'
      }
    });

    logger.info(`Garantia ${guarantee.reference} vinculada a expediente ${expeditionId} por ${amount} EUR`);

    return {
      success: true,
      data: guarantee
    };
  }

  /**
   * Liberar garantia de expediente
   */
  async releaseFromExpedition(guaranteeId, expeditionId, userId) {
    const guarantee = await Guarantee.findById(guaranteeId);
    if (!guarantee) {
      throw new Error('Garantia no encontrada');
    }

    // Buscar vinculacion
    const link = guarantee.linkedExpeditions.find(
      le => le.expedition.toString() === expeditionId.toString() && le.status === 'active'
    );

    if (!link) {
      throw new Error('Expediente no vinculado a esta garantia');
    }

    // Liberar
    guarantee.release(
      link.amount,
      { type: 'expedition', id: expeditionId },
      `Liberacion de expediente`,
      userId
    );

    // Actualizar vinculacion
    guarantee.unlinkExpedition(expeditionId);

    await guarantee.save();

    // Actualizar expediente
    await Expedition.findByIdAndUpdate(expeditionId, {
      $set: {
        'guarantee.status': 'released'
      }
    });

    logger.info(`Garantia ${guarantee.reference} liberada de expediente ${expeditionId}`);

    return {
      success: true,
      data: guarantee
    };
  }

  /**
   * Obtener garantias activas del usuario
   */
  async getActiveGuarantees(userId) {
    return Guarantee.getActiveByOwner(userId);
  }

  /**
   * Obtener estadisticas de garantias
   */
  async getStats(userId) {
    return Guarantee.getStats(userId);
  }

  /**
   * Obtener alertas pendientes
   */
  async getPendingAlerts(userId) {
    const guarantees = await Guarantee.find({
      owner: userId,
      'alerts.acknowledged': false
    });

    const alerts = [];
    for (const g of guarantees) {
      for (const alert of g.alerts) {
        if (!alert.acknowledged) {
          alerts.push({
            guaranteeId: g._id,
            guaranteeReference: g.reference,
            guaranteeName: g.name,
            ...alert.toObject()
          });
        }
      }
    }

    return alerts.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Reconocer alerta
   */
  async acknowledgeAlert(guaranteeId, alertId, userId) {
    const guarantee = await Guarantee.findById(guaranteeId);
    if (!guarantee) {
      throw new Error('Garantia no encontrada');
    }

    const alert = guarantee.alerts.id(alertId);
    if (!alert) {
      throw new Error('Alerta no encontrada');
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();

    await guarantee.save();

    return { success: true };
  }

  /**
   * Renovar garantia
   */
  async renewGuarantee(guaranteeId, newValidUntil, newAmount, userId) {
    const guarantee = await Guarantee.findById(guaranteeId);
    if (!guarantee) {
      throw new Error('Garantia no encontrada');
    }

    const oldValidUntil = guarantee.validUntil;
    const oldAmount = guarantee.totalAmount;

    guarantee.validUntil = new Date(newValidUntil);

    if (newAmount && newAmount !== oldAmount) {
      const difference = newAmount - oldAmount;
      guarantee.totalAmount = newAmount;
      guarantee.availableAmount = guarantee.totalAmount - guarantee.consumedAmount;

      guarantee.movements.push({
        type: 'adjustment',
        amount: difference,
        description: `Renovacion: ajuste de ${oldAmount} EUR a ${newAmount} EUR`,
        balanceAfter: guarantee.availableAmount,
        createdBy: userId
      });
    }

    // Reactivar si estaba expirada
    if (guarantee.status === 'expired') {
      guarantee.status = 'active';
    }

    // Limpiar alertas de expiracion
    guarantee.alerts = guarantee.alerts.filter(a =>
      a.type !== 'expiring' && a.type !== 'expired'
    );

    guarantee.notes.push({
      text: `Renovada: vigencia extendida de ${oldValidUntil.toLocaleDateString('es-ES')} a ${guarantee.validUntil.toLocaleDateString('es-ES')}`,
      createdBy: userId
    });

    await guarantee.save();

    logger.info(`Garantia ${guarantee.reference} renovada hasta ${newValidUntil}`);

    return {
      success: true,
      data: guarantee
    };
  }

  /**
   * Suspender garantia
   */
  async suspendGuarantee(guaranteeId, reason, userId) {
    const guarantee = await Guarantee.findById(guaranteeId);
    if (!guarantee) {
      throw new Error('Garantia no encontrada');
    }

    guarantee.status = 'suspended';
    guarantee.statusHistory.push({
      status: 'suspended',
      timestamp: new Date(),
      user: userId,
      reason
    });

    await guarantee.save();

    logger.warn(`Garantia ${guarantee.reference} suspendida: ${reason}`);

    return {
      success: true,
      data: guarantee
    };
  }

  /**
   * Cancelar garantia
   */
  async cancelGuarantee(guaranteeId, reason, userId) {
    const guarantee = await Guarantee.findById(guaranteeId);
    if (!guarantee) {
      throw new Error('Garantia no encontrada');
    }

    // Verificar que no tenga consumos activos
    if (guarantee.consumedAmount > 0) {
      throw new Error(`No se puede cancelar garantia con ${guarantee.consumedAmount} EUR consumidos. Libere primero las operaciones vinculadas.`);
    }

    guarantee.status = 'cancelled';
    guarantee.statusHistory.push({
      status: 'cancelled',
      timestamp: new Date(),
      user: userId,
      reason
    });

    await guarantee.save();

    logger.info(`Garantia ${guarantee.reference} cancelada: ${reason}`);

    return {
      success: true,
      data: guarantee
    };
  }

  /**
   * Verificar garantias por vencer (para cron job)
   */
  async checkExpiringGuarantees() {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const expiringGuarantees = await Guarantee.find({
      status: 'active',
      validUntil: { $lte: in30Days, $gt: now }
    });

    for (const guarantee of expiringGuarantees) {
      await guarantee.checkAlerts();
      await guarantee.save();
    }

    // Marcar expiradas
    const expiredGuarantees = await Guarantee.find({
      status: 'active',
      validUntil: { $lte: now }
    });

    for (const guarantee of expiredGuarantees) {
      guarantee.status = 'expired';
      guarantee.alerts.push({
        type: 'expired',
        message: 'Garantia ha expirado'
      });
      await guarantee.save();
      logger.warn(`Garantia ${guarantee.reference} expirada automaticamente`);
    }

    return {
      expiring: expiringGuarantees.length,
      expired: expiredGuarantees.length
    };
  }

  /**
   * Generar informe de garantias
   */
  async generateReport(userId, params = {}) {
    const { startDate, endDate, type, status } = params;

    const query = { owner: userId };

    if (type) query.type = type;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const guarantees = await Guarantee.find(query)
      .populate('linkedExpeditions.expedition', 'reference status')
      .sort({ createdAt: -1 });

    // Calcular totales
    const totals = {
      count: guarantees.length,
      totalAmount: 0,
      consumedAmount: 0,
      availableAmount: 0,
      byType: {},
      byStatus: {},
      movements: {
        consumptions: 0,
        releases: 0
      }
    };

    for (const g of guarantees) {
      totals.totalAmount += g.totalAmount;
      totals.consumedAmount += g.consumedAmount;
      totals.availableAmount += g.availableAmount;

      totals.byType[g.type] = (totals.byType[g.type] || 0) + 1;
      totals.byStatus[g.status] = (totals.byStatus[g.status] || 0) + 1;

      for (const m of g.movements) {
        if (m.type === 'consumption') totals.movements.consumptions += Math.abs(m.amount);
        if (m.type === 'release') totals.movements.releases += m.amount;
      }
    }

    return {
      guarantees,
      totals,
      generatedAt: new Date()
    };
  }
}

module.exports = new GuaranteeService();
