/**
 * AEAT Status Monitor Service
 * Fase 6.1.5-6.1.6 - LUCI Customs Agent
 *
 * Monitoreo inteligente de declaraciones con análisis LUCI
 * - Polling automático de estados
 * - Notificaciones proactivas
 * - Análisis predictivo de circuitos
 * - Alertas de plazos
 */

const EventEmitter = require('events');
const logger = require('../../config/logger');
const aeatRealService = require('./aeatRealService');

class AEATStatusMonitorService extends EventEmitter {
  constructor() {
    super();

    // Declaraciones en seguimiento
    this.trackedDeclarations = new Map();

    // Configuración de polling
    this.pollingConfig = {
      intervalMs: parseInt(process.env.AEAT_POLLING_INTERVAL) || 60000, // 1 minuto
      maxRetries: 3,
      enabled: false
    };

    // Historial de estados para análisis
    this.statusHistory = new Map();

    // Patrones para análisis predictivo LUCI
    this.channelPatterns = {
      highRiskCountries: ['CN', 'HK', 'TR', 'IN', 'BD'],
      highRiskTaricChapters: ['61', '62', '63', '64', '42', '85', '95'],
      highValueThreshold: 50000,
      suspiciousPatterns: ['multiple_shipments_same_day', 'value_variance_high', 'unusual_origin']
    };

    // Plazos legales (días)
    this.legalDeadlines = {
      orangeChannelResponse: 10,
      redChannelInspection: 5,
      appealDeadline: 30,
      rectificationDeadline: 3,
      temporaryStorageMax: 90
    };

    this.pollingInterval = null;
  }

  // ============== SEGUIMIENTO DE DECLARACIONES ==============

  /**
   * Agregar declaración al seguimiento
   */
  trackDeclaration(mrn, declarationType, metadata = {}) {
    const tracking = {
      mrn,
      type: declarationType,
      addedAt: new Date().toISOString(),
      lastChecked: null,
      currentStatus: 'PENDING',
      channel: null,
      statusHistory: [],
      metadata,
      alerts: [],
      luciPredictions: null
    };

    this.trackedDeclarations.set(mrn, tracking);

    logger.info(`StatusMonitor: Agregada declaración al seguimiento`, { mrn, type: declarationType });

    // Generar predicción LUCI inicial
    this._generateInitialPrediction(tracking);

    return {
      success: true,
      mrn,
      message: 'Declaración agregada al seguimiento',
      tracking
    };
  }

  /**
   * Remover declaración del seguimiento
   */
  untrackDeclaration(mrn) {
    const existed = this.trackedDeclarations.delete(mrn);

    return {
      success: existed,
      mrn,
      message: existed ? 'Declaración removida del seguimiento' : 'Declaración no encontrada'
    };
  }

  /**
   * Obtener estado de declaración
   */
  getTrackedDeclaration(mrn) {
    return this.trackedDeclarations.get(mrn);
  }

  /**
   * Listar declaraciones en seguimiento
   */
  listTrackedDeclarations(filters = {}) {
    let declarations = Array.from(this.trackedDeclarations.values());

    // Aplicar filtros
    if (filters.type) {
      declarations = declarations.filter(d => d.type === filters.type);
    }
    if (filters.status) {
      declarations = declarations.filter(d => d.currentStatus === filters.status);
    }
    if (filters.channel) {
      declarations = declarations.filter(d => d.channel === filters.channel);
    }
    if (filters.hasAlerts) {
      declarations = declarations.filter(d => d.alerts.length > 0);
    }

    // Ordenar por última actualización
    declarations.sort((a, b) => new Date(b.lastChecked || 0) - new Date(a.lastChecked || 0));

    // Generar análisis LUCI del portfolio
    const luciAnalysis = this._analyzePortfolio(declarations);

    return {
      total: declarations.length,
      declarations,
      summary: {
        byType: this._groupBy(declarations, 'type'),
        byStatus: this._groupBy(declarations, 'currentStatus'),
        byChannel: this._groupBy(declarations, 'channel'),
        withAlerts: declarations.filter(d => d.alerts.length > 0).length
      },
      luciAnalysis
    };
  }

  // ============== POLLING Y ACTUALIZACIÓN ==============

  /**
   * Iniciar polling automático
   */
  startPolling(certificateId, password) {
    if (this.pollingInterval) {
      logger.warn('StatusMonitor: Polling ya está activo');
      return { success: false, message: 'Polling ya está activo' };
    }

    this.pollingConfig.enabled = true;
    this.pollingConfig.certificateId = certificateId;
    this.pollingConfig.password = password;

    this.pollingInterval = setInterval(
      () => this._pollAllDeclarations(),
      this.pollingConfig.intervalMs
    );

    logger.info('StatusMonitor: Polling iniciado', {
      interval: this.pollingConfig.intervalMs,
      declarations: this.trackedDeclarations.size
    });

    return {
      success: true,
      message: 'Polling iniciado',
      intervalMs: this.pollingConfig.intervalMs,
      trackedCount: this.trackedDeclarations.size
    };
  }

  /**
   * Detener polling
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.pollingConfig.enabled = false;

      logger.info('StatusMonitor: Polling detenido');

      return { success: true, message: 'Polling detenido' };
    }

    return { success: false, message: 'Polling no estaba activo' };
  }

  /**
   * Actualizar estado de una declaración específica
   */
  async refreshDeclarationStatus(mrn, certificateId, password) {
    const tracking = this.trackedDeclarations.get(mrn);

    if (!tracking) {
      return {
        success: false,
        error: 'Declaración no encontrada en seguimiento'
      };
    }

    try {
      logger.info(`StatusMonitor: Actualizando estado de ${mrn}`);

      // Consultar estado en AEAT
      const result = await aeatRealService.queryDeclarationStatus(
        mrn,
        tracking.type,
        certificateId,
        password
      );

      if (result.success) {
        const previousStatus = tracking.currentStatus;
        const previousChannel = tracking.channel;

        // Actualizar tracking
        tracking.lastChecked = new Date().toISOString();
        tracking.currentStatus = result.status;
        tracking.channel = result.channel || tracking.channel;

        // Agregar al historial
        tracking.statusHistory.push({
          timestamp: tracking.lastChecked,
          status: result.status,
          channel: result.channel,
          messages: result.messages
        });

        // Detectar cambios y generar alertas
        if (previousStatus !== result.status || previousChannel !== result.channel) {
          const changeAnalysis = await this._analyzeStatusChange(
            tracking,
            previousStatus,
            result.status,
            previousChannel,
            result.channel
          );

          if (changeAnalysis.alerts.length > 0) {
            tracking.alerts.push(...changeAnalysis.alerts);
            this.emit('statusChange', { mrn, tracking, changeAnalysis });
          }
        }

        // Actualizar predicciones LUCI
        tracking.luciPredictions = await this._updatePredictions(tracking, result);

        return {
          success: true,
          mrn,
          tracking,
          changed: previousStatus !== result.status || previousChannel !== result.channel,
          luciAnalysis: tracking.luciPredictions
        };
      }

      return result;

    } catch (error) {
      logger.error(`StatusMonitor: Error actualizando ${mrn}`, { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ============== ANÁLISIS LUCI ==============

  /**
   * Generar predicción inicial de canal
   */
  async _generateInitialPrediction(tracking) {
    const metadata = tracking.metadata;

    // Factores de riesgo
    const riskFactors = [];
    let riskScore = 0;

    // País de origen
    if (metadata.originCountry && this.channelPatterns.highRiskCountries.includes(metadata.originCountry)) {
      riskFactors.push({
        factor: 'País de origen de alto riesgo',
        country: metadata.originCountry,
        impact: 15
      });
      riskScore += 15;
    }

    // Código TARIC
    if (metadata.taricCode) {
      const chapter = metadata.taricCode.substring(0, 2);
      if (this.channelPatterns.highRiskTaricChapters.includes(chapter)) {
        riskFactors.push({
          factor: 'Categoría de producto sensible',
          chapter,
          impact: 10
        });
        riskScore += 10;
      }
    }

    // Valor declarado
    if (metadata.customsValue && metadata.customsValue > this.channelPatterns.highValueThreshold) {
      riskFactors.push({
        factor: 'Valor alto declarado',
        value: metadata.customsValue,
        threshold: this.channelPatterns.highValueThreshold,
        impact: 12
      });
      riskScore += 12;
    }

    // Primera operación con este proveedor
    if (metadata.firstTimeSupplier) {
      riskFactors.push({
        factor: 'Primera operación con proveedor',
        impact: 8
      });
      riskScore += 8;
    }

    // Calcular probabilidades de canal
    const channelProbabilities = this._calculateChannelProbabilities(riskScore);

    tracking.luciPredictions = {
      generatedAt: new Date().toISOString(),
      riskScore,
      riskLevel: riskScore < 15 ? 'low' : riskScore < 30 ? 'medium' : 'high',
      riskFactors,
      channelProbabilities,
      recommendations: this._generateRiskRecommendations(riskFactors, channelProbabilities),
      confidence: Math.min(95, 70 + (Object.keys(metadata).length * 3))
    };

    return tracking.luciPredictions;
  }

  /**
   * Calcular probabilidades de canal basado en riesgo
   */
  _calculateChannelProbabilities(riskScore) {
    // Modelo simplificado basado en score de riesgo
    // En producción: usar modelo ML entrenado con datos históricos

    if (riskScore < 10) {
      return { green: 0.92, orange: 0.06, red: 0.02, yellow: 0.00 };
    } else if (riskScore < 20) {
      return { green: 0.78, orange: 0.16, red: 0.04, yellow: 0.02 };
    } else if (riskScore < 35) {
      return { green: 0.55, orange: 0.32, red: 0.10, yellow: 0.03 };
    } else if (riskScore < 50) {
      return { green: 0.30, orange: 0.45, red: 0.20, yellow: 0.05 };
    } else {
      return { green: 0.15, orange: 0.40, red: 0.40, yellow: 0.05 };
    }
  }

  /**
   * Generar recomendaciones basadas en riesgo
   */
  _generateRiskRecommendations(riskFactors, probabilities) {
    const recommendations = [];

    // Si alta probabilidad de canal naranja/rojo
    if (probabilities.orange + probabilities.red > 0.25) {
      recommendations.push({
        priority: 'high',
        action: 'Preparar documentación adicional',
        details: 'Alta probabilidad de control. Tener listos: facturas originales, certificados de origen, documentos de transporte.'
      });
    }

    // Recomendaciones específicas por factor de riesgo
    for (const factor of riskFactors) {
      if (factor.factor.includes('País de origen')) {
        recommendations.push({
          priority: 'medium',
          action: 'Verificar certificado de origen',
          details: `Operaciones desde ${factor.country} suelen requerir verificación de origen.`
        });
      }

      if (factor.factor.includes('Valor alto')) {
        recommendations.push({
          priority: 'medium',
          action: 'Preparar justificación de valor',
          details: 'Tener disponible: factura pro-forma, contratos, precios de referencia de mercado.'
        });
      }

      if (factor.factor.includes('producto sensible')) {
        recommendations.push({
          priority: 'high',
          action: 'Verificar requisitos específicos',
          details: 'El capítulo arancelario puede requerir licencias, certificados o controles específicos.'
        });
      }
    }

    // Recomendación general si bajo riesgo
    if (probabilities.green > 0.80) {
      recommendations.push({
        priority: 'info',
        action: 'Operación de bajo riesgo',
        details: 'Alta probabilidad de levante automático. Mantener documentación archivada por si acaso.'
      });
    }

    return recommendations;
  }

  /**
   * Analizar cambio de estado
   */
  async _analyzeStatusChange(tracking, prevStatus, newStatus, prevChannel, newChannel) {
    const alerts = [];
    const analysis = {
      statusChange: { from: prevStatus, to: newStatus },
      channelChange: { from: prevChannel, to: newChannel },
      timestamp: new Date().toISOString()
    };

    // Alerta de canal naranja
    if (newChannel === 'orange' && prevChannel !== 'orange') {
      const deadline = this._calculateDeadline(this.legalDeadlines.orangeChannelResponse);

      alerts.push({
        type: 'channel_orange',
        level: 'warning',
        title: 'Canal naranja asignado',
        message: `La declaración ${tracking.mrn} requiere documentación adicional`,
        deadline: deadline.toISOString(),
        daysRemaining: this.legalDeadlines.orangeChannelResponse,
        actions: [
          'Revisar requerimiento en bandeja de entrada',
          'Preparar documentación solicitada',
          'Responder antes del plazo'
        ]
      });
    }

    // Alerta de canal rojo
    if (newChannel === 'red' && prevChannel !== 'red') {
      const deadline = this._calculateDeadline(this.legalDeadlines.redChannelInspection);

      alerts.push({
        type: 'channel_red',
        level: 'critical',
        title: 'Reconocimiento físico requerido',
        message: `La declaración ${tracking.mrn} ha sido asignada a inspección física`,
        deadline: deadline.toISOString(),
        daysRemaining: this.legalDeadlines.redChannelInspection,
        actions: [
          'Contactar con recinto aduanero',
          'Coordinar fecha de inspección',
          'Preparar mercancía para reconocimiento',
          'Tener documentación original disponible'
        ]
      });
    }

    // Alerta de levante
    if (newStatus === 'RELEASED') {
      alerts.push({
        type: 'released',
        level: 'success',
        title: 'Levante concedido',
        message: `La declaración ${tracking.mrn} ha sido despachada`,
        actions: [
          'Proceder con retirada de mercancía',
          'Archivar documentación',
          'Notificar al cliente'
        ]
      });
    }

    // Alerta de rechazo
    if (newStatus === 'REJECTED') {
      alerts.push({
        type: 'rejected',
        level: 'critical',
        title: 'Declaración rechazada',
        message: `La declaración ${tracking.mrn} ha sido rechazada por AEAT`,
        deadline: this._calculateDeadline(this.legalDeadlines.rectificationDeadline).toISOString(),
        actions: [
          'Revisar motivo de rechazo',
          'Corregir errores identificados',
          'Presentar nueva declaración'
        ]
      });
    }

    analysis.alerts = alerts;
    analysis.requiresAction = alerts.some(a => a.level === 'warning' || a.level === 'critical');

    return analysis;
  }

  /**
   * Actualizar predicciones con nuevo estado
   */
  async _updatePredictions(tracking, result) {
    const predictions = tracking.luciPredictions || {};

    // Actualizar con datos reales
    if (result.channel) {
      predictions.actualChannel = result.channel;
      predictions.predictionAccuracy = this._evaluatePrediction(predictions, result.channel);
    }

    // Análisis de siguiente paso
    predictions.nextStepAnalysis = this._analyzeNextStep(tracking, result);

    // Estimación de tiempo restante
    predictions.estimatedCompletion = this._estimateCompletion(tracking, result);

    predictions.lastUpdated = new Date().toISOString();

    return predictions;
  }

  /**
   * Evaluar precisión de predicción
   */
  _evaluatePrediction(predictions, actualChannel) {
    if (!predictions.channelProbabilities) return null;

    const predicted = Object.entries(predictions.channelProbabilities)
      .sort((a, b) => b[1] - a[1])[0][0];

    return {
      predictedChannel: predicted,
      actualChannel,
      correct: predicted === actualChannel,
      confidence: predictions.channelProbabilities[actualChannel] * 100
    };
  }

  /**
   * Analizar siguiente paso
   */
  _analyzeNextStep(tracking, result) {
    const status = result.status;
    const channel = result.channel;

    if (status === 'RELEASED') {
      return {
        step: 'Completado',
        description: 'Declaración procesada completamente',
        actions: ['Archivar documentación', 'Cerrar expediente']
      };
    }

    if (channel === 'green') {
      return {
        step: 'Esperar levante',
        description: 'Canal verde asignado, levante inminente',
        estimatedTime: '1-4 horas',
        actions: ['Monitorear estado']
      };
    }

    if (channel === 'orange') {
      return {
        step: 'Responder requerimiento',
        description: 'Documentación adicional requerida',
        deadline: this._calculateDeadline(this.legalDeadlines.orangeChannelResponse),
        actions: [
          'Consultar bandeja de entrada',
          'Preparar documentos solicitados',
          'Enviar respuesta'
        ]
      };
    }

    if (channel === 'red') {
      return {
        step: 'Coordinar inspección',
        description: 'Reconocimiento físico programado',
        deadline: this._calculateDeadline(this.legalDeadlines.redChannelInspection),
        actions: [
          'Contactar recinto aduanero',
          'Preparar mercancía',
          'Asistir a inspección'
        ]
      };
    }

    return {
      step: 'Pendiente',
      description: 'Esperando procesamiento AEAT',
      actions: ['Continuar monitoreo']
    };
  }

  /**
   * Estimar tiempo de completitud
   */
  _estimateCompletion(tracking, result) {
    const channel = result.channel;

    const estimates = {
      green: { min: 1, max: 4, unit: 'hours' },
      orange: { min: 2, max: 10, unit: 'days' },
      red: { min: 3, max: 15, unit: 'days' },
      yellow: { min: 1, max: 5, unit: 'days' }
    };

    const estimate = estimates[channel] || { min: 1, max: 30, unit: 'days' };

    return {
      channel,
      estimate,
      message: `Estimado: ${estimate.min}-${estimate.max} ${estimate.unit}`,
      note: channel === 'green' ?
        'Levante automático esperado' :
        'Tiempo depende de respuesta a requerimientos'
    };
  }

  /**
   * Analizar portfolio de declaraciones
   */
  _analyzePortfolio(declarations) {
    if (declarations.length === 0) {
      return {
        status: 'empty',
        message: 'No hay declaraciones en seguimiento'
      };
    }

    const analysis = {
      status: 'active',
      totalDeclarations: declarations.length,
      summary: {
        pendingAction: declarations.filter(d => d.alerts.some(a => a.level === 'warning' || a.level === 'critical')).length,
        inGreen: declarations.filter(d => d.channel === 'green').length,
        inOrange: declarations.filter(d => d.channel === 'orange').length,
        inRed: declarations.filter(d => d.channel === 'red').length,
        completed: declarations.filter(d => d.currentStatus === 'RELEASED').length
      },
      alerts: [],
      recommendations: []
    };

    // Alertas urgentes
    const urgent = declarations.filter(d =>
      d.alerts.some(a => a.level === 'critical' && a.daysRemaining && a.daysRemaining <= 3)
    );

    if (urgent.length > 0) {
      analysis.alerts.push({
        level: 'critical',
        message: `${urgent.length} declaración(es) con plazos urgentes`,
        declarations: urgent.map(d => d.mrn)
      });
    }

    // Recomendaciones
    if (analysis.summary.inOrange > 0) {
      analysis.recommendations.push({
        priority: 'high',
        action: `Gestionar ${analysis.summary.inOrange} declaración(es) en canal naranja`,
        details: 'Revisar requerimientos y preparar documentación'
      });
    }

    if (analysis.summary.inRed > 0) {
      analysis.recommendations.push({
        priority: 'critical',
        action: `Coordinar ${analysis.summary.inRed} inspección(es) física(s)`,
        details: 'Contactar recintos aduaneros urgentemente'
      });
    }

    // Estadísticas de predicción
    const withPredictions = declarations.filter(d => d.luciPredictions?.predictionAccuracy);
    if (withPredictions.length >= 5) {
      const accuracy = withPredictions.filter(d => d.luciPredictions.predictionAccuracy.correct).length / withPredictions.length;
      analysis.predictionStats = {
        total: withPredictions.length,
        accuracy: (accuracy * 100).toFixed(1) + '%',
        message: `LUCI acertó el canal en ${(accuracy * 100).toFixed(0)}% de las declaraciones`
      };
    }

    return analysis;
  }

  // ============== UTILIDADES ==============

  async _pollAllDeclarations() {
    if (!this.pollingConfig.enabled || this.trackedDeclarations.size === 0) {
      return;
    }

    logger.info(`StatusMonitor: Polling ${this.trackedDeclarations.size} declaraciones`);

    for (const [mrn, tracking] of this.trackedDeclarations) {
      // No consultar declaraciones completadas
      if (tracking.currentStatus === 'RELEASED' || tracking.currentStatus === 'REJECTED') {
        continue;
      }

      try {
        await this.refreshDeclarationStatus(
          mrn,
          this.pollingConfig.certificateId,
          this.pollingConfig.password
        );

        // Pequeño delay entre consultas para no saturar AEAT
        await this._delay(500);

      } catch (error) {
        logger.error(`StatusMonitor: Error polling ${mrn}`, { error: error.message });
      }
    }
  }

  _calculateDeadline(days) {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + days);
    return deadline;
  }

  _groupBy(items, key) {
    return items.reduce((acc, item) => {
      const value = item[key] || 'unknown';
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtener información del servicio
   */
  getInfo() {
    return {
      service: 'AEAT Status Monitor Service',
      version: '6.1.0',
      pollingEnabled: this.pollingConfig.enabled,
      pollingInterval: this.pollingConfig.intervalMs,
      trackedDeclarations: this.trackedDeclarations.size,
      features: [
        'Seguimiento automático de declaraciones',
        'Predicción de canal con LUCI',
        'Alertas de plazos',
        'Notificaciones de cambio de estado',
        'Análisis de portfolio'
      ]
    };
  }

  /**
   * Obtener alertas activas
   */
  getActiveAlerts() {
    const alerts = [];

    for (const [mrn, tracking] of this.trackedDeclarations) {
      for (const alert of tracking.alerts) {
        if (alert.level === 'critical' || alert.level === 'warning') {
          alerts.push({
            mrn,
            type: tracking.type,
            ...alert
          });
        }
      }
    }

    // Ordenar por nivel y fecha
    alerts.sort((a, b) => {
      const levelOrder = { critical: 0, warning: 1, info: 2, success: 3 };
      return (levelOrder[a.level] || 99) - (levelOrder[b.level] || 99);
    });

    return {
      total: alerts.length,
      critical: alerts.filter(a => a.level === 'critical').length,
      warning: alerts.filter(a => a.level === 'warning').length,
      alerts
    };
  }
}

module.exports = new AEATStatusMonitorService();
