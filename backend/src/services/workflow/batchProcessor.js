/**
 * Batch Processor Service
 * Procesamiento por lotes de declaraciones y operaciones
 * Fase 6.6 - LUCI Customs Agent
 *
 * Permite procesar multiples declaraciones de forma masiva:
 * - Importar desde archivo Excel/CSV
 * - Validar en lote
 * - Enviar declaraciones masivas
 * - Reportes de resultados
 */

const logger = require('../../config/logger');
const { Expedition } = require('../../models');
const { workflowEvents } = require('./eventEmitter');

// ==================== Batch Job Status ====================

const BATCH_STATUS = {
  PENDING: 'pending',
  VALIDATING: 'validating',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  COMPLETED_WITH_ERRORS: 'completed_with_errors',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

// In-memory storage for batch jobs (use Redis in production)
const batchJobs = new Map();

// ==================== Batch Processor Class ====================

class BatchProcessor {
  constructor() {
    this.maxConcurrent = 10;         // Max declaraciones procesandose simultaneamente
    this.maxBatchSize = 500;         // Max items por lote
    this.retryAttempts = 3;
    this.retryDelayMs = 5000;
  }

  /**
   * Crear nuevo trabajo de lote
   */
  async createBatchJob(organizationId, userId, items, options = {}) {
    const jobId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (items.length > this.maxBatchSize) {
      throw new Error(`Batch size exceeds maximum of ${this.maxBatchSize} items`);
    }

    const job = {
      id: jobId,
      organizationId,
      createdBy: userId,
      createdAt: new Date(),
      status: BATCH_STATUS.PENDING,
      type: options.type || 'declaration',
      options: {
        validateOnly: options.validateOnly || false,
        stopOnError: options.stopOnError || false,
        scheduledFor: options.scheduledFor || null,
        notifyOnComplete: options.notifyOnComplete !== false
      },
      items: items.map((item, index) => ({
        index,
        data: item,
        status: 'pending',
        result: null,
        error: null,
        attempts: 0
      })),
      stats: {
        total: items.length,
        pending: items.length,
        processing: 0,
        completed: 0,
        failed: 0,
        skipped: 0
      },
      startedAt: null,
      completedAt: null,
      logs: []
    };

    batchJobs.set(jobId, job);
    this.addLog(job, 'info', `Batch job created with ${items.length} items`);

    logger.info(`BatchProcessor: Created job ${jobId} with ${items.length} items`);

    return job;
  }

  /**
   * Iniciar procesamiento de un lote
   */
  async startBatchJob(jobId) {
    const job = batchJobs.get(jobId);
    if (!job) {
      throw new Error('Batch job not found');
    }

    if (job.status !== BATCH_STATUS.PENDING) {
      throw new Error(`Cannot start job in status: ${job.status}`);
    }

    // Verificar si esta programado para despues
    if (job.options.scheduledFor && new Date(job.options.scheduledFor) > new Date()) {
      this.scheduleJob(job);
      return job;
    }

    // Iniciar procesamiento
    job.status = BATCH_STATUS.VALIDATING;
    job.startedAt = new Date();
    this.addLog(job, 'info', 'Batch processing started');

    // Ejecutar en background
    this.processJob(job).catch(error => {
      logger.error(`BatchProcessor: Job ${jobId} failed:`, error);
      job.status = BATCH_STATUS.FAILED;
      job.error = error.message;
      this.addLog(job, 'error', `Job failed: ${error.message}`);
    });

    return job;
  }

  /**
   * Programar job para ejecucion futura
   */
  scheduleJob(job) {
    const delay = new Date(job.options.scheduledFor) - new Date();
    job.scheduledTimeout = setTimeout(() => {
      this.startBatchJob(job.id);
    }, delay);

    this.addLog(job, 'info', `Job scheduled for ${job.options.scheduledFor}`);
  }

  /**
   * Procesar un trabajo de lote
   */
  async processJob(job) {
    // Fase 1: Validacion
    this.addLog(job, 'info', 'Starting validation phase');
    await this.validateItems(job);

    const validItems = job.items.filter(item => item.status === 'validated');

    if (validItems.length === 0) {
      job.status = BATCH_STATUS.FAILED;
      this.addLog(job, 'error', 'No valid items to process');
      return;
    }

    // Si solo es validacion, terminar aqui
    if (job.options.validateOnly) {
      job.status = BATCH_STATUS.COMPLETED;
      job.completedAt = new Date();
      this.addLog(job, 'info', `Validation complete: ${validItems.length}/${job.items.length} valid`);
      return;
    }

    // Fase 2: Procesamiento
    job.status = BATCH_STATUS.PROCESSING;
    this.addLog(job, 'info', `Starting processing phase with ${validItems.length} items`);

    await this.processItems(job);

    // Determinar estado final
    const hasErrors = job.stats.failed > 0;
    job.status = hasErrors ? BATCH_STATUS.COMPLETED_WITH_ERRORS : BATCH_STATUS.COMPLETED;
    job.completedAt = new Date();

    const duration = (job.completedAt - job.startedAt) / 1000;
    this.addLog(job, 'info',
      `Processing complete in ${duration}s: ${job.stats.completed} success, ${job.stats.failed} failed`
    );

    // Notificar si esta configurado
    if (job.options.notifyOnComplete) {
      await this.notifyCompletion(job);
    }
  }

  /**
   * Validar items del lote
   */
  async validateItems(job) {
    for (const item of job.items) {
      try {
        const validationResult = await this.validateItem(item.data, job.type);

        if (validationResult.valid) {
          item.status = 'validated';
          item.validationResult = validationResult;
        } else {
          item.status = 'validation_failed';
          item.error = validationResult.errors.join(', ');
          job.stats.failed += 1;
          job.stats.pending -= 1;
        }
      } catch (error) {
        item.status = 'validation_error';
        item.error = error.message;
        job.stats.failed += 1;
        job.stats.pending -= 1;
      }
    }
  }

  /**
   * Validar un item individual
   */
  async validateItem(data, type) {
    const errors = [];

    switch (type) {
      case 'declaration':
      case 'h1':
        // Validar campos requeridos para declaracion H1
        if (!data.expeditionId && !data.client) {
          errors.push('Se requiere expeditionId o datos del cliente');
        }
        if (!data.goods || data.goods.length === 0) {
          errors.push('Se requiere al menos una mercancia');
        }
        if (!data.originCountry) {
          errors.push('Pais de origen es requerido');
        }
        // Validar codigo TARIC
        if (data.goods) {
          for (const good of data.goods) {
            if (!good.taricCode || good.taricCode.length < 8) {
              errors.push(`Codigo TARIC invalido para: ${good.description || 'mercancia'}`);
            }
          }
        }
        break;

      case 'h7':
        // Validar H7 (bajo valor)
        if (!data.goods || data.goods.length === 0) {
          errors.push('Se requiere al menos una mercancia');
        }
        if (data.totalValue && data.totalValue > 150) {
          errors.push('El valor total para H7 no puede exceder 150 EUR');
        }
        break;

      case 'transit':
        if (!data.departureCustoms) {
          errors.push('Aduana de partida es requerida');
        }
        if (!data.destinationCustoms) {
          errors.push('Aduana de destino es requerida');
        }
        break;

      default:
        errors.push(`Tipo de batch desconocido: ${type}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Procesar items validados
   */
  async processItems(job) {
    const validItems = job.items.filter(item => item.status === 'validated');

    // Procesar en chunks para controlar concurrencia
    const chunks = this.chunkArray(validItems, this.maxConcurrent);

    for (const chunk of chunks) {
      if (job.status === BATCH_STATUS.CANCELLED) {
        break;
      }

      await Promise.all(chunk.map(item => this.processItem(item, job)));
    }
  }

  /**
   * Procesar un item individual
   */
  async processItem(item, job) {
    item.status = 'processing';
    item.startedAt = new Date();
    job.stats.processing += 1;
    job.stats.pending -= 1;

    let lastError;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        item.attempts = attempt;

        const result = await this.executeItem(item.data, job.type, job.organizationId);

        item.status = 'completed';
        item.result = result;
        item.completedAt = new Date();
        job.stats.completed += 1;
        job.stats.processing -= 1;

        // Emitir evento de item procesado
        workflowEvents.emitWorkflowEvent('batch.item_processed', {
          jobId: job.id,
          itemIndex: item.index,
          result
        }, {
          organizationId: job.organizationId
        });

        return;

      } catch (error) {
        lastError = error;
        this.addLog(job, 'warn', `Item ${item.index} attempt ${attempt} failed: ${error.message}`);

        if (attempt < this.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelayMs));
        }
      }
    }

    // Todas las tentativas fallaron
    item.status = 'failed';
    item.error = lastError.message;
    item.completedAt = new Date();
    job.stats.failed += 1;
    job.stats.processing -= 1;

    // Si debe parar en error
    if (job.options.stopOnError) {
      job.status = BATCH_STATUS.FAILED;
      this.addLog(job, 'error', 'Stopped due to stopOnError option');
    }
  }

  /**
   * Ejecutar procesamiento de un item
   */
  async executeItem(data, type, organizationId) {
    switch (type) {
      case 'declaration':
      case 'h1':
        return await this.createDeclaration(data, organizationId);

      case 'h7':
        return await this.createH7Declaration(data, organizationId);

      case 'transit':
        return await this.createTransit(data, organizationId);

      default:
        throw new Error(`Unknown batch type: ${type}`);
    }
  }

  /**
   * Crear declaracion (H1)
   */
  async createDeclaration(data, organizationId) {
    // Aqui se integraria con el servicio de declaraciones
    // Por ahora, crear expediente basico

    const expedition = new Expedition({
      expeditionId: `EXP-BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      operationType: data.operationType || 'import',
      status: 'pending_validation',
      organizationId,
      client: data.client || {},
      goods: data.goods || [],
      origin: { country: data.originCountry },
      destination: { country: 'ES' },
      transport: data.transport || {},
      incoterm: data.incoterm || 'CIF',
      createdBy: 'batch_processor',
      timeline: [{
        action: 'created',
        description: 'Expediente creado via procesamiento por lotes',
        performedBy: 'system'
      }]
    });

    await expedition.save();

    return {
      expeditionId: expedition.expeditionId,
      _id: expedition._id,
      status: expedition.status
    };
  }

  /**
   * Crear declaracion H7
   */
  async createH7Declaration(data, organizationId) {
    const { H7Declaration } = require('../../models');

    const h7 = new H7Declaration({
      organizationId,
      status: 'draft',
      goods: data.goods || [],
      totalValue: data.totalValue,
      sender: data.sender || {},
      recipient: data.recipient || {},
      createdBy: 'batch_processor'
    });

    await h7.save();

    return {
      h7Id: h7._id,
      status: h7.status
    };
  }

  /**
   * Crear transito
   */
  async createTransit(data, organizationId) {
    const { Transit } = require('../../models');

    const transit = new Transit({
      organizationId,
      status: 'draft',
      transitType: data.transitType || 'T1',
      departureCustoms: data.departureCustoms,
      destinationCustoms: data.destinationCustoms,
      goods: data.goods || [],
      createdBy: 'batch_processor'
    });

    await transit.save();

    return {
      transitId: transit._id,
      mrn: transit.mrn,
      status: transit.status
    };
  }

  /**
   * Notificar finalizacion del lote
   */
  async notifyCompletion(job) {
    workflowEvents.emitWorkflowEvent('batch.completed', {
      jobId: job.id,
      stats: job.stats,
      duration: (job.completedAt - job.startedAt) / 1000
    }, {
      organizationId: job.organizationId
    });
  }

  // ==================== Job Management ====================

  /**
   * Obtener estado de un trabajo
   */
  getJobStatus(jobId) {
    const job = batchJobs.get(jobId);
    if (!job) return null;

    return {
      id: job.id,
      status: job.status,
      stats: job.stats,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      options: job.options,
      logs: job.logs.slice(-20) // Ultimos 20 logs
    };
  }

  /**
   * Obtener detalle completo de un trabajo
   */
  getJobDetail(jobId) {
    return batchJobs.get(jobId);
  }

  /**
   * Cancelar trabajo
   */
  cancelJob(jobId) {
    const job = batchJobs.get(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.status === BATCH_STATUS.COMPLETED || job.status === BATCH_STATUS.FAILED) {
      throw new Error('Cannot cancel finished job');
    }

    job.status = BATCH_STATUS.CANCELLED;
    job.completedAt = new Date();

    if (job.scheduledTimeout) {
      clearTimeout(job.scheduledTimeout);
    }

    this.addLog(job, 'warn', 'Job cancelled by user');

    return job;
  }

  /**
   * Listar trabajos de una organizacion
   */
  listJobs(organizationId, options = {}) {
    const { status, limit = 50 } = options;

    let jobs = Array.from(batchJobs.values())
      .filter(job => job.organizationId.toString() === organizationId.toString());

    if (status) {
      jobs = jobs.filter(job => job.status === status);
    }

    return jobs
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map(job => ({
        id: job.id,
        status: job.status,
        type: job.type,
        stats: job.stats,
        createdAt: job.createdAt,
        completedAt: job.completedAt
      }));
  }

  /**
   * Limpiar trabajos antiguos
   */
  cleanupOldJobs(maxAgeHours = 24) {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    for (const [jobId, job] of batchJobs) {
      if (job.completedAt && job.completedAt < cutoff) {
        batchJobs.delete(jobId);
      }
    }
  }

  // ==================== Helpers ====================

  addLog(job, level, message) {
    job.logs.push({
      timestamp: new Date(),
      level,
      message
    });
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Instancia singleton
const batchProcessor = new BatchProcessor();

// Limpieza periodica de jobs antiguos (cada hora)
setInterval(() => {
  batchProcessor.cleanupOldJobs(24);
}, 60 * 60 * 1000);

module.exports = batchProcessor;
