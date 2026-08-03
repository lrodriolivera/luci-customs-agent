/**
 * Inspection Service
 * Servicio para coordinación de inspecciones físicas y documentales
 *
 * Funcionalidades:
 * - Programación de inspecciones
 * - Coordinación con recintos aduaneros
 * - Gestión de resultados y actas
 * - Seguimiento de muestras
 */

const Inspection = require('../models/Inspection');
const User = require('../models/User');
const Expedition = require('../models/Expedition');
const Deadline = require('../models/Deadline');
const deadlineService = require('./deadlineService');
const logger = require('../config/logger');

/**
 * Carga el documento comprobando que es del tenant de quien lo pide.
 * El tenantId se anadio al schema y se derivo de la expedicion, que es su
 * unico dueno posible. Mismo error que cuando no existe, para no confirmar
 * ids de otro tenant. Sin userId (jobs) no se comprueba; los documentos
 * legacy sin tenantId siguen pasando.
 */
async function _loadOwnedInspection(id, userId) {
  const doc = await Inspection.findById(id);
  if (!doc) {
    throw new Error('Inspección no encontrada');
  }
  // El tenant se resuelve desde el usuario en vez de exigirlo en las 19 firmas
  // y sus 47 llamadores. Una consulta extra por operacion de escritura, que es
  // asumible frente a propagar el parametro por toda la cadena.
  if (userId && doc.tenantId) {
    const user = await User.findById(userId).select('tenantId').lean();
    if (user?.tenantId && String(doc.tenantId) !== String(user.tenantId)) {
      throw new Error('Inspección no encontrada');
    }
  }
  return doc;
}


// Tipos de inspección y sus características
const INSPECTION_TYPES = {
  physical: {
    name: 'Inspección Física',
    authority: 'AEAT',
    channel: 'red',
    estimatedDuration: 120, // minutos
    requirements: ['Presencia mercancía', 'Documentación original', 'Representante autorizado']
  },
  documentary: {
    name: 'Revisión Documental',
    authority: 'AEAT',
    channel: 'orange',
    estimatedDuration: 30,
    requirements: ['Documentación completa']
  },
  scanner: {
    name: 'Escáner',
    authority: 'AEAT',
    channel: 'red',
    estimatedDuration: 45,
    requirements: ['Contenedor/vehículo disponible']
  },
  soivre: {
    name: 'Inspección SOIVRE',
    authority: 'SOIVRE',
    channel: 'yellow',
    estimatedDuration: 60,
    requirements: ['Muestra disponible', 'Documentación técnica']
  },
  mapa: {
    name: 'Inspección Veterinaria/Fitosanitaria',
    authority: 'MAPA',
    channel: 'yellow',
    estimatedDuration: 90,
    requirements: ['Documentación sanitaria', 'Acceso a mercancía']
  },
  sanidad: {
    name: 'Inspección Sanitaria',
    authority: 'SANIDAD',
    channel: 'yellow',
    estimatedDuration: 60,
    requirements: ['Certificados sanitarios', 'Muestras si requerido']
  },
  miterd: {
    name: 'Inspección MITERD',
    authority: 'MITERD',
    channel: 'yellow',
    estimatedDuration: 45,
    requirements: ['Documentación ambiental', 'Permisos CITES si aplica']
  },
  combined: {
    name: 'Inspección Combinada',
    authority: 'MULTIPLE',
    channel: 'red',
    estimatedDuration: 180,
    requirements: ['Todos los documentos', 'Coordinación multiagencia']
  },
  post_clearance: {
    name: 'Inspección Post-Despacho',
    authority: 'AEAT',
    channel: null,
    estimatedDuration: 240,
    requirements: ['Acceso a instalaciones', 'Registros contables']
  },
  random: {
    name: 'Inspección Aleatoria',
    authority: 'AEAT',
    channel: null,
    estimatedDuration: 60,
    requirements: ['Según tipo determinado']
  }
};

// Ubicaciones de inspección comunes
const INSPECTION_LOCATIONS = {
  ports: [
    { code: 'ESBCN', name: 'Puerto de Barcelona', city: 'Barcelona', type: 'port' },
    { code: 'ESVLC', name: 'Puerto de Valencia', city: 'Valencia', type: 'port' },
    { code: 'ESALG', name: 'Puerto de Algeciras', city: 'Algeciras', type: 'port' },
    { code: 'ESBIO', name: 'Puerto de Bilbao', city: 'Bilbao', type: 'port' },
    { code: 'ESLPA', name: 'Puerto de Las Palmas', city: 'Las Palmas', type: 'port' }
  ],
  airports: [
    { code: 'LEMD', name: 'Aeropuerto Madrid-Barajas', city: 'Madrid', type: 'airport' },
    { code: 'LEBL', name: 'Aeropuerto Barcelona-El Prat', city: 'Barcelona', type: 'airport' },
    { code: 'LEZG', name: 'Aeropuerto Zaragoza', city: 'Zaragoza', type: 'airport' }
  ],
  customs_offices: [
    { code: 'ES002801', name: 'Aduana de Madrid', city: 'Madrid', type: 'customs_office' },
    { code: 'ES000801', name: 'Aduana de Barcelona', city: 'Barcelona', type: 'customs_office' },
    { code: 'ES004601', name: 'Aduana de Valencia', city: 'Valencia', type: 'customs_office' }
  ]
};

// Resultados posibles y acciones asociadas
const INSPECTION_RESULTS = {
  approved: {
    label: 'Aprobada',
    actions: ['levante'],
    nextSteps: 'Proceder con levante de mercancía'
  },
  approved_conditions: {
    label: 'Aprobada con condiciones',
    actions: ['levante', 'documentation_request'],
    nextSteps: 'Levante condicionado a presentación de documentación adicional'
  },
  rejected: {
    label: 'Rechazada',
    actions: ['retention', 'penalty', 'return'],
    nextSteps: 'Evaluar opciones: recurso, devolución o destrucción'
  },
  partial: {
    label: 'Resultado parcial',
    actions: ['additional_inspection', 'laboratory_analysis'],
    nextSteps: 'Esperar resultados adicionales'
  },
  pending_analysis: {
    label: 'Pendiente de análisis',
    actions: ['laboratory_analysis'],
    nextSteps: 'Esperar resultados de laboratorio'
  },
  pending_documents: {
    label: 'Pendiente de documentos',
    actions: ['documentation_request'],
    nextSteps: 'Presentar documentación requerida'
  },
  referred: {
    label: 'Derivada a otra autoridad',
    actions: ['referral'],
    nextSteps: 'Coordinación con autoridad competente'
  }
};

class InspectionService {
  /**
   * Obtener configuración de tipo de inspección
   */
  getInspectionTypeConfig(type) {
    return INSPECTION_TYPES[type] || null;
  }

  /**
   * Crear una nueva inspección
   */
  async create(data, userId = null) {
    try {
      const typeConfig = this.getInspectionTypeConfig(data.inspectionType);

      const inspectionData = {
        ...data,
        scheduling: {
          ...data.scheduling,
          estimatedDuration: data.scheduling?.estimatedDuration || typeConfig?.estimatedDuration || 60
        },
        authority: {
          ...data.authority,
          type: data.authority?.type || typeConfig?.authority || 'AEAT'
        },
        createdBy: userId
      };

      // El tenant se hereda de la expedicion inspeccionada, nunca del payload:
      // sin esto la inspeccion nace sin dueno y el guard la deja pasar.
      if (!inspectionData.tenantId && inspectionData.expeditionId) {
        const exp = await Expedition.findById(inspectionData.expeditionId).select('tenantId').lean();
        if (exp?.tenantId) inspectionData.tenantId = exp.tenantId;
      }

      const inspection = new Inspection(inspectionData);
      await inspection.save();

      // Crear deadline si hay fecha programada
      if (inspection.scheduling?.scheduledDate) {
        await deadlineService.createFromInspection(inspection, userId);
      }

      logger.info(`Inspección creada: ${inspection.inspectionNumber}`);
      return inspection;
    } catch (error) {
      logger.error('Error creando inspección:', error);
      throw error;
    }
  }

  /**
   * Crear inspección desde requerimiento
   */
  async createFromRequirement(requirement, inspectionType = 'physical', userId = null) {
    const inspection = await this.create({
      inspectionType,
      expeditionId: requirement.expeditionId,
      requirementId: requirement._id,
      mrn: requirement.mrn,
      lrn: requirement.lrn,
      status: 'requested',
      location: requirement.physicalInspection?.location || {},
      scheduling: {
        requestedDate: requirement.physicalInspection?.scheduledDate
      },
      inspector: requirement.inspector || {},
      authority: {
        type: requirement.issuingAuthority || 'AEAT'
      },
      client: requirement.client || {},
      priority: requirement.priority || 'normal'
    }, userId);

    return inspection;
  }

  /**
   * Obtener inspección por ID
   */
  async getById(id) {
    return Inspection.findById(id)
      .populate('expeditionId', 'reference clientName')
      .populate('requirementId', 'requirementNumber')
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email');
  }

  /**
   * Obtener inspección por número
   */
  async getByNumber(inspectionNumber) {
    return Inspection.findOne({ inspectionNumber })
      .populate('expeditionId', 'reference clientName')
      .populate('assignedTo', 'name email');
  }

  /**
   * Listar inspecciones con filtros
   */
  async list(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'scheduling.scheduledDate',
      sortOrder = 'asc'
    } = options;

    const query = { ...filters };

    const [inspections, total] = await Promise.all([
      Inspection.find(query)
        .populate('expeditionId', 'reference clientName')
        .populate('assignedTo', 'name email')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Inspection.countDocuments(query)
    ]);

    return {
      inspections,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Obtener inspecciones programadas para una fecha
   */
  async getScheduledForDate(date) {
    return Inspection.findScheduledForDate(date)
      .populate('expeditionId', 'reference clientName')
      .populate('assignedTo', 'name email');
  }

  /**
   * Obtener inspecciones pendientes
   */
  async getPending(userId = null) {
    return Inspection.findPending(userId)
      .populate('expeditionId', 'reference clientName')
      .populate('assignedTo', 'name email');
  }

  /**
   * Obtener inspecciones de hoy
   */
  async getToday() {
    const today = new Date();
    return this.getScheduledForDate(today);
  }

  /**
   * Obtener calendario de inspecciones
   */
  async getCalendar(startDate, endDate, filters = {}) {
    const inspections = await Inspection.getCalendar(startDate, endDate, filters);

    // Agrupar por fecha
    const grouped = {};
    inspections.forEach(insp => {
      if (insp.scheduling?.scheduledDate) {
        const dateKey = insp.scheduling.scheduledDate.toISOString().split('T')[0];
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(insp);
      }
    });

    return {
      inspections,
      grouped,
      startDate,
      endDate
    };
  }

  /**
   * Programar inspección
   */
  async schedule(id, schedulingData, userId = null) {
    const inspection = await _loadOwnedInspection(id, userId);

    await inspection.schedule(schedulingData, userId);

    // Crear/actualizar deadline
    await deadlineService.createFromInspection(inspection, userId);

    logger.info(`Inspección programada: ${inspection.inspectionNumber} para ${schedulingData.scheduledDate}`);
    return inspection;
  }

  /**
   * Confirmar inspección
   */
  async confirm(id, confirmationNumber, userId = null) {
    const inspection = await _loadOwnedInspection(id, userId);

    await inspection.confirm(confirmationNumber, userId);

    logger.info(`Inspección confirmada: ${inspection.inspectionNumber}`);
    return inspection;
  }

  /**
   * Iniciar inspección
   */
  async start(id, userId = null) {
    const inspection = await _loadOwnedInspection(id, userId);

    await inspection.start(userId);

    logger.info(`Inspección iniciada: ${inspection.inspectionNumber}`);
    return inspection;
  }

  /**
   * Completar inspección
   */
  async complete(id, resultData, userId = null) {
    const inspection = await _loadOwnedInspection(id, userId);

    await inspection.complete(resultData, userId);

    // Completar deadline asociado
    const deadline = await Deadline.findOne({
      'references.inspectionId': id,
      status: { $nin: ['completed', 'cancelled'] }
    });
    if (deadline) {
      await deadline.complete(userId, `Inspección completada: ${resultData.result}`);
    }

    logger.info(`Inspección completada: ${inspection.inspectionNumber} - ${resultData.result}`);
    return inspection;
  }

  /**
   * Añadir participante
   */
  async addParticipant(id, participantData, userId) {
    const inspection = await _loadOwnedInspection(id, userId);

    await inspection.addParticipant(participantData);
    return inspection;
  }

  /**
   * Añadir evidencia (foto, documento)
   */
  async addEvidence(id, evidenceData, userId) {
    const inspection = await _loadOwnedInspection(id, userId);

    await inspection.addEvidence(evidenceData);
    logger.info(`Evidencia añadida a inspección: ${inspection.inspectionNumber}`);
    return inspection;
  }

  /**
   * Añadir item inspeccionado
   */
  async addInspectedItem(id, itemData, userId) {
    const inspection = await _loadOwnedInspection(id, userId);

    await inspection.addInspectedItem(itemData);
    return inspection;
  }

  /**
   * Registrar hallazgo/discrepancia
   */
  async registerFinding(id, findingData, userId = null) {
    const inspection = await _loadOwnedInspection(id, userId);

    inspection.findings = {
      ...inspection.findings,
      ...findingData,
      discrepanciesFound: true
    };

    inspection.timeline.push({
      action: 'finding_registered',
      description: findingData.discrepancySummary || 'Hallazgo registrado',
      performedBy: userId
    });

    await inspection.save();
    logger.info(`Hallazgo registrado en inspección: ${inspection.inspectionNumber}`);
    return inspection;
  }

  /**
   * Añadir muestra tomada
   */
  async addSample(id, sampleData, userId) {
    const inspection = await _loadOwnedInspection(id, userId);

    inspection.samples.push({
      ...sampleData,
      sentAt: sampleData.sentAt || new Date()
    });

    await inspection.save();
    logger.info(`Muestra añadida a inspección: ${inspection.inspectionNumber}`);
    return inspection;
  }

  /**
   * Actualizar resultado de muestra
   */
  async updateSampleResult(id, sampleId, resultData, userId) {
    const inspection = await _loadOwnedInspection(id, userId);

    const sample = inspection.samples.id(sampleId);
    if (!sample) {
      throw new Error('Muestra no encontrada');
    }

    Object.assign(sample, {
      ...resultData,
      resultReceivedAt: new Date()
    });

    await inspection.save();
    return inspection;
  }

  /**
   * Generar acta de inspección
   */
  async generateReport(id, reportData, userId = null) {
    const inspection = await _loadOwnedInspection(id, userId);

    // Generar número de acta
    const year = new Date().getFullYear();
    const reportNumber = `ACT-${inspection.inspectionNumber}-${Date.now()}`;

    await inspection.generateReport({
      reportNumber,
      ...reportData
    }, userId);

    logger.info(`Acta generada para inspección: ${inspection.inspectionNumber}`);
    return inspection;
  }

  /**
   * Añadir acción resultante
   */
  async addResultingAction(id, actionData, userId) {
    const inspection = await _loadOwnedInspection(id, userId);

    await inspection.addResultingAction(actionData);
    return inspection;
  }

  /**
   * Cancelar inspección
   */
  async cancel(id, reason, userId = null) {
    const inspection = await _loadOwnedInspection(id, userId);

    inspection.status = 'cancelled';
    inspection.internalNotes = (inspection.internalNotes || '') + `\nCancelada: ${reason}`;

    inspection.timeline.push({
      action: 'cancelled',
      description: `Inspección cancelada: ${reason}`,
      performedBy: userId
    });

    await inspection.save();

    // Cancelar deadline asociado
    const deadline = await Deadline.findOne({
      'references.inspectionId': id,
      status: { $nin: ['completed', 'cancelled'] }
    });
    if (deadline) {
      await deadline.cancel(reason, userId);
    }

    logger.info(`Inspección cancelada: ${inspection.inspectionNumber}`);
    return inspection;
  }

  /**
   * Reprogramar inspección
   */
  async reschedule(id, newSchedulingData, reason, userId = null) {
    const inspection = await _loadOwnedInspection(id, userId);

    const oldDate = inspection.scheduling?.scheduledDate;

    inspection.scheduling = {
      ...inspection.scheduling,
      ...newSchedulingData
    };
    inspection.status = 'scheduled';

    inspection.timeline.push({
      action: 'rescheduled',
      description: `Reprogramada de ${oldDate} a ${newSchedulingData.scheduledDate}: ${reason}`,
      performedBy: userId,
      metadata: { oldDate, newDate: newSchedulingData.scheduledDate, reason }
    });

    await inspection.save();

    // Actualizar deadline
    await deadlineService.createFromInspection(inspection, userId);

    logger.info(`Inspección reprogramada: ${inspection.inspectionNumber}`);
    return inspection;
  }

  /**
   * Obtener estadísticas
   */
  async getStats(filters = {}) {
    return Inspection.getStats(filters);
  }

  /**
   * Obtener resumen del dashboard
   */
  async getDashboard(userId = null) {
    const filters = userId ? { assignedTo: userId } : {};

    const [stats, today, pending, recentCompleted] = await Promise.all([
      this.getStats(filters),
      this.getToday(),
      this.getPending(userId),
      Inspection.find({
        ...filters,
        status: 'completed',
        'execution.completedAt': { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }).sort({ 'execution.completedAt': -1 }).limit(10)
    ]);

    return {
      stats,
      today,
      pending: pending.slice(0, 10),
      recentCompleted,
      summary: {
        scheduledToday: stats.scheduledToday,
        totalPending: (stats.byStatus.requested || 0) +
                      (stats.byStatus.scheduled || 0) +
                      (stats.byStatus.confirmed || 0),
        inProgress: stats.byStatus.in_progress || 0,
        completedThisWeek: recentCompleted.length
      }
    };
  }

  /**
   * Obtener ubicaciones disponibles
   */
  getLocations() {
    return INSPECTION_LOCATIONS;
  }

  /**
   * Obtener tipos de inspección
   */
  getInspectionTypes() {
    return Object.entries(INSPECTION_TYPES).map(([key, value]) => ({
      value: key,
      label: value.name,
      ...value
    }));
  }

  /**
   * Obtener resultados posibles
   */
  getInspectionResults() {
    return Object.entries(INSPECTION_RESULTS).map(([key, value]) => ({
      value: key,
      ...value
    }));
  }

  /**
   * Preparar checklist de inspección
   */
  getInspectionChecklist(inspectionType) {
    const typeConfig = INSPECTION_TYPES[inspectionType];
    if (!typeConfig) return [];

    return {
      requirements: typeConfig.requirements,
      generalItems: [
        'Verificar identidad del inspector',
        'Confirmar número de inspección',
        'Tener documentación original disponible',
        'Verificar acceso a mercancía',
        'Preparar copia de declaración',
        'Tener sellos/precintos accesibles',
        'Cámara/teléfono para fotografías',
        'Formulario de acta disponible'
      ],
      specificItems: this.getSpecificChecklistItems(inspectionType)
    };
  }

  /**
   * Obtener items específicos de checklist según tipo
   */
  getSpecificChecklistItems(inspectionType) {
    const items = {
      physical: [
        'Verificar contenedor/bultos coinciden con declaración',
        'Comprobar estado de precintos',
        'Contar unidades/bultos',
        'Verificar marcas y etiquetado',
        'Tomar fotografías de mercancía',
        'Verificar peso si hay báscula'
      ],
      scanner: [
        'Confirmar contenedor disponible para escáner',
        'Verificar que no hay restricciones de escaneo',
        'Preparar documentación de contenido'
      ],
      soivre: [
        'Tener documentación técnica del producto',
        'Preparar muestras si es requerido',
        'Verificar marcado CE si aplica',
        'Documentación de conformidad'
      ],
      mapa: [
        'Certificado sanitario de origen',
        'DSVC si aplica',
        'Documentación veterinaria/fitosanitaria',
        'Identificación de lotes'
      ],
      sanidad: [
        'Certificados sanitarios',
        'Etiquetado nutricional si aplica',
        'Registro sanitario de productos',
        'Documentación de trazabilidad'
      ],
      miterd: [
        'Permisos CITES si aplica',
        'Documentación de residuos si aplica',
        'Ficha de datos de seguridad',
        'Autorización de sustancias químicas'
      ]
    };

    return items[inspectionType] || [];
  }

  /**
   * Obtener información del servicio
   */
  getInfo() {
    return {
      service: 'Inspection Service',
      version: '1.0.0',
      inspectionTypes: Object.keys(INSPECTION_TYPES).length,
      locations: {
        ports: INSPECTION_LOCATIONS.ports.length,
        airports: INSPECTION_LOCATIONS.airports.length,
        customs_offices: INSPECTION_LOCATIONS.customs_offices.length
      }
    };
  }
}

module.exports = new InspectionService();
