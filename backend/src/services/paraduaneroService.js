/**
 * Paraduanero Service
 * Servicio para gestion de controles paraduaneros
 *
 * Determina automaticamente que controles aplican segun:
 * - Codigo TARIC de la mercancia
 * - Pais de origen
 * - Tipo de operacion (import/export)
 * - Uso final declarado
 */

const logger = require('../config/logger');
const { Expedition, ParaduaneroControl, Document } = require('../models');

/**
 * Carga un control paraduanero comprobando que pertenece a quien lo pide.
 * Mismo error que cuando no existe, para no confirmar ids de otra cuenta.
 * Sin userId (jobs) no se comprueba; los legacy sin createdBy pasan.
 */
async function _loadOwnedControl(id, userId) {
  const doc = await ParaduaneroControl.findById(id);
  if (!doc) {
    throw new Error('Control no encontrado');
  }
  if (userId && doc.createdBy && String(doc.createdBy) !== String(userId)) {
    throw new Error('Control no encontrado');
  }
  return doc;
}


// Reglas de controles por capitulo TARIC
const TARIC_CONTROL_RULES = {
  // Capitulo 01: Animales vivos
  '01': {
    controls: ['MAPA'],
    subType: 'veterinary',
    documents: [
      { code: 'C620', name: 'Certificado Veterinario', mandatory: true },
      { code: 'N851', name: 'DVCE (Documento Veterinario Comun de Entrada)', mandatory: true }
    ],
    inspection: true,
    notes: 'Control veterinario obligatorio'
  },

  // Capitulo 02-05: Carnes, pescados, lacteos, huevos
  '02': { controls: ['SANIDAD', 'MAPA'], subType: 'veterinary', documents: [
    { code: 'C620', name: 'Certificado Sanitario Veterinario', mandatory: true },
    { code: 'N851', name: 'DVCE', mandatory: true }
  ], inspection: true },
  '03': { controls: ['SANIDAD', 'MAPA'], subType: 'food_safety', documents: [
    { code: 'C620', name: 'Certificado Sanitario', mandatory: true }
  ], inspection: true },
  '04': { controls: ['SANIDAD', 'MAPA'], subType: 'veterinary', documents: [
    { code: 'C620', name: 'Certificado Veterinario', mandatory: true }
  ], inspection: true },
  '05': { controls: ['MAPA'], subType: 'veterinary', documents: [
    { code: 'C620', name: 'Certificado Sanitario', mandatory: false }
  ], inspection: false },

  // Capitulo 06-14: Productos vegetales
  '06': { controls: ['MAPA'], subType: 'phytosanitary', documents: [
    { code: 'C633', name: 'Certificado Fitosanitario', mandatory: true }
  ], inspection: true, notes: 'Plantas vivas - control fitosanitario' },
  '07': { controls: ['MAPA', 'SANIDAD'], subType: 'phytosanitary', documents: [
    { code: 'C633', name: 'Certificado Fitosanitario', mandatory: true }
  ], inspection: true },
  '08': { controls: ['MAPA', 'SANIDAD'], subType: 'phytosanitary', documents: [
    { code: 'C633', name: 'Certificado Fitosanitario', mandatory: true }
  ], inspection: true },
  '09': { controls: ['SANIDAD'], subType: 'food_safety', documents: [
    { code: 'C620', name: 'Certificado Sanitario', mandatory: false }
  ], inspection: false },
  '10': { controls: ['MAPA'], subType: 'phytosanitary', documents: [
    { code: 'C633', name: 'Certificado Fitosanitario', mandatory: true }
  ], inspection: false },
  '11': { controls: ['SANIDAD'], subType: 'food_safety', documents: [], inspection: false },
  '12': { controls: ['MAPA'], subType: 'phytosanitary', documents: [
    { code: 'C633', name: 'Certificado Fitosanitario', mandatory: false }
  ], inspection: false },

  // Capitulos 15-24: Productos alimenticios procesados
  '15': { controls: ['SANIDAD'], subType: 'food_safety', documents: [], inspection: false },
  '16': { controls: ['SANIDAD'], subType: 'food_safety', documents: [
    { code: 'C620', name: 'Certificado Sanitario', mandatory: true }
  ], inspection: true },
  '17': { controls: ['SANIDAD'], subType: 'food_safety', documents: [], inspection: false },
  '18': { controls: ['SANIDAD'], subType: 'food_safety', documents: [], inspection: false },
  '19': { controls: ['SANIDAD'], subType: 'food_safety', documents: [], inspection: false },
  '20': { controls: ['SANIDAD'], subType: 'food_safety', documents: [], inspection: false },
  '21': { controls: ['SANIDAD'], subType: 'food_safety', documents: [], inspection: false },
  '22': { controls: ['SANIDAD'], subType: 'food_safety', documents: [], inspection: false },
  '23': { controls: ['MAPA'], subType: 'animal_feed', documents: [
    { code: 'C620', name: 'Certificado para piensos', mandatory: true }
  ], inspection: false },

  // Capitulo 28-38: Productos quimicos
  '28': { controls: ['MITERD'], subType: 'chemicals_reach', documents: [
    { code: 'Y923', name: 'Declaracion REACH', mandatory: false }
  ], inspection: false },
  '29': { controls: ['MITERD'], subType: 'chemicals_reach', documents: [
    { code: 'Y923', name: 'Declaracion REACH', mandatory: true }
  ], inspection: false },
  '30': { controls: ['AEMPS', 'SANIDAD'], subType: 'pharmaceuticals', documents: [
    { code: 'C057', name: 'Autorizacion de importacion AEMPS', mandatory: true }
  ], inspection: true, notes: 'Medicamentos - requiere autorizacion AEMPS' },
  '33': { controls: ['SANIDAD'], subType: 'cosmetics', documents: [
    { code: 'C057', name: 'Notificacion CPNP', mandatory: true }
  ], inspection: false },
  '38': { controls: ['MITERD'], subType: 'chemicals_reach', documents: [
    { code: 'Y923', name: 'Declaracion REACH', mandatory: true },
    { code: 'Y922', name: 'Ficha de seguridad SDS', mandatory: true }
  ], inspection: false },

  // Capitulo 39-40: Plasticos y caucho
  '39': { controls: ['MITERD'], subType: 'waste', checkWaste: true, documents: [], inspection: false },
  '40': { controls: [], subType: null, documents: [], inspection: false },

  // Capitulo 44: Madera
  '44': { controls: ['MAPA'], subType: 'phytosanitary', documents: [
    { code: 'C633', name: 'Certificado Fitosanitario', mandatory: true },
    { code: 'Y926', name: 'Certificado FLEGT/CITES', mandatory: false }
  ], inspection: true, notes: 'Madera - posible control CITES' },

  // Capitulo 50-63: Textiles
  '50': { controls: ['SOIVRE'], subType: 'textiles', documents: [
    { code: 'Y923', name: 'Composicion fibras', mandatory: true }
  ], inspection: false },
  '51': { controls: ['SOIVRE'], subType: 'textiles', documents: [
    { code: 'Y923', name: 'Composicion fibras', mandatory: true }
  ], inspection: false },
  '52': { controls: ['SOIVRE'], subType: 'textiles', documents: [
    { code: 'Y923', name: 'Composicion fibras', mandatory: true }
  ], inspection: false },
  '61': { controls: ['SOIVRE'], subType: 'textiles', documents: [
    { code: 'Y923', name: 'Composicion fibras', mandatory: true },
    { code: 'C057', name: 'Etiquetado conforme', mandatory: true }
  ], inspection: false },
  '62': { controls: ['SOIVRE'], subType: 'textiles', documents: [
    { code: 'Y923', name: 'Composicion fibras', mandatory: true }
  ], inspection: false },

  // Capitulo 64-67: Calzado, sombreros
  '64': { controls: ['SOIVRE'], subType: 'industrial_products', documents: [
    { code: 'C057', name: 'Etiquetado conforme', mandatory: true }
  ], inspection: false },

  // Capitulo 84-85: Maquinaria y electronica
  '84': { controls: ['SOIVRE'], subType: 'machinery', documents: [
    { code: 'C057', name: 'Declaracion CE conformidad', mandatory: true }
  ], inspection: false },
  '85': { controls: ['SOIVRE'], subType: 'electrical', documents: [
    { code: 'C057', name: 'Declaracion CE conformidad', mandatory: true },
    { code: 'Y924', name: 'Certificado seguridad electrica', mandatory: false }
  ], inspection: false },

  // Capitulo 90: Instrumentos medicos
  '90': { controls: ['AEMPS'], subType: 'medical_devices', documents: [
    { code: 'C057', name: 'Marcado CE productos sanitarios', mandatory: true }
  ], inspection: false },

  // Capitulo 95: Juguetes
  '95': { controls: ['SOIVRE'], subType: 'toys', documents: [
    { code: 'C057', name: 'Declaracion CE conformidad', mandatory: true },
    { code: 'Y925', name: 'Informe de ensayo EN 71', mandatory: true }
  ], inspection: true, notes: 'Juguetes - control SOIVRE obligatorio' }
};

// Codigos TARIC especificos que requieren CITES
const CITES_TARIC_PREFIXES = [
  '0106', // Animales vivos CITES
  '0301', // Peces ornamentales
  '0508', // Coral, conchas
  '1211', // Plantas CITES
  '4103', '4104', // Pieles CITES
  '9601', '9602'  // Marfil, hueso
];

// Paises con restricciones especiales
const HIGH_RISK_COUNTRIES = {
  veterinary: ['CN', 'BR', 'AR', 'IN', 'TH', 'VN'],
  phytosanitary: ['CN', 'IN', 'BR', 'CO', 'EC'],
  chemicals: ['CN', 'IN']
};

class ParaduaneroService {
  constructor() {
    logger.info('Paraduanero Service initialized');
  }

  /**
   * Analizar expediente y determinar controles paraduaneros necesarios
   * @param {Object} expedition - Expediente a analizar
   * @returns {Array} Lista de controles requeridos
   */
  async analyzeExpedition(expedition) {
    logger.info(`Analyzing paraduanero controls for expedition ${expedition.expeditionId}`);

    const controls = [];
    const analyzedTypes = new Set(); // Evitar duplicados

    for (const good of expedition.goods || []) {
      const taricCode = good.taricCode;
      if (!taricCode) continue;

      const chapter = taricCode.substring(0, 2);
      const heading = taricCode.substring(0, 4);
      const origin = good.originCountry;

      // Verificar reglas por capitulo
      const rule = TARIC_CONTROL_RULES[chapter];
      if (rule && rule.controls.length > 0) {
        for (const controlType of rule.controls) {
          const key = `${controlType}-${rule.subType}`;
          if (!analyzedTypes.has(key)) {
            analyzedTypes.add(key);

            controls.push({
              controlType,
              subType: rule.subType,
              reason: `Capitulo TARIC ${chapter} requiere control ${controlType}`,
              documents: rule.documents || [],
              inspectionRequired: rule.inspection || false,
              priority: this._calculatePriority(controlType, origin),
              affectedGoods: [{
                itemNumber: good.itemNumber,
                description: good.description,
                taricCode: good.taricCode,
                quantity: good.quantity,
                unit: good.unit,
                weight: good.grossWeight
              }],
              notes: rule.notes
            });
          } else {
            // Agregar mercancia al control existente
            const existing = controls.find(c => c.controlType === controlType && c.subType === rule.subType);
            if (existing) {
              existing.affectedGoods.push({
                itemNumber: good.itemNumber,
                description: good.description,
                taricCode: good.taricCode,
                quantity: good.quantity,
                unit: good.unit,
                weight: good.grossWeight
              });
            }
          }
        }
      }

      // Verificar CITES
      if (this._requiresCites(taricCode)) {
        const citesKey = 'MITERD-cites';
        if (!analyzedTypes.has(citesKey)) {
          analyzedTypes.add(citesKey);
          controls.push({
            controlType: 'MITERD',
            subType: good.taricCode.startsWith('01') ? 'cites_fauna' : 'cites_flora',
            reason: 'Producto potencialmente CITES',
            documents: [
              { code: 'Y926', name: 'Permiso CITES', mandatory: true },
              { code: 'C400', name: 'Certificado CITES exportacion', mandatory: true }
            ],
            inspectionRequired: true,
            priority: 'critical',
            affectedGoods: [{
              itemNumber: good.itemNumber,
              description: good.description,
              taricCode: good.taricCode
            }],
            notes: 'ATENCION: Verificar inclusion en apendices CITES'
          });
        }
      }

      // Verificar riesgo por pais de origen
      if (this._isHighRiskOrigin(origin, rule?.subType)) {
        const control = controls.find(c => c.subType === rule?.subType);
        if (control) {
          control.priority = 'high';
          control.inspectionRequired = true;
          control.notes = (control.notes || '') + ` | Origen alto riesgo: ${origin}`;
        }
      }
    }

    logger.info(`Found ${controls.length} paraduanero controls for expedition ${expedition.expeditionId}`);
    return controls;
  }

  /**
   * Crear controles paraduaneros para un expediente
   * @param {string} expeditionId - ID del expediente
   * @param {Object} user - Usuario que crea los controles
   */
  async createControlsForExpedition(expeditionId, user) {
    const expedition = await Expedition.findById(expeditionId);
    if (!expedition) {
      throw new Error('Expediente no encontrado');
    }

    // Analizar que controles necesita
    const requiredControls = await this.analyzeExpedition(expedition);

    if (requiredControls.length === 0) {
      logger.info(`No paraduanero controls required for ${expedition.expeditionId}`);
      return [];
    }

    const createdControls = [];

    for (const controlData of requiredControls) {
      // Verificar si ya existe este control
      const existing = await ParaduaneroControl.findOne({
        expeditionId: expedition._id,
        controlType: controlData.controlType,
        subType: controlData.subType
      });

      if (existing) {
        logger.info(`Control ${controlData.controlType}/${controlData.subType} already exists`);
        continue;
      }

      // Crear el control
      const control = new ParaduaneroControl({
        expeditionId: expedition._id,
        // Heredar el tenant del expediente: el control es del mismo cliente.
        tenantId: expedition.tenantId,
        controlType: controlData.controlType,
        subType: controlData.subType,
        affectedGoods: controlData.affectedGoods,
        status: 'documents_required',
        priority: controlData.priority,
        requiredDocuments: controlData.documents.map(d => ({
          code: d.code,
          name: d.name,
          mandatory: d.mandatory,
          provided: false
        })),
        inspection: {
          required: controlData.inspectionRequired,
          scheduled: false
        },
        deadline: this._calculateDeadline(controlData.controlType),
        notes: controlData.notes,
        createdBy: user?._id,
        timeline: [{
          action: 'control_created',
          description: `Control ${controlData.controlType} creado - ${controlData.reason}`,
          performedBy: user?._id,
          performedByName: user?.name || 'Sistema'
        }]
      });

      await control.save();
      createdControls.push(control);

      logger.info(`Created paraduanero control: ${control.controlNumber}`);
    }

    // Actualizar expediente con referencia a los controles
    if (createdControls.length > 0) {
      expedition.timeline.push({
        action: 'paraduanero_controls_created',
        description: `${createdControls.length} control(es) paraduanero(s) creado(s)`,
        userId: user?._id,
        performedBy: user?.name || 'Sistema',
        metadata: {
          controls: createdControls.map(c => ({
            number: c.controlNumber,
            type: c.controlType
          }))
        }
      });
      await expedition.save();
    }

    return createdControls;
  }

  /**
   * Obtener controles de un expediente
   */
  async getControlsForExpedition(expeditionId) {
    return ParaduaneroControl.find({ expeditionId })
      .sort({ priority: -1, createdAt: -1 });
  }

  /**
   * Marcar documento como proporcionado
   */
  async markDocumentProvided(controlId, documentCode, documentId, userId) {
    const control = await _loadOwnedControl(controlId, userId);

    const doc = control.requiredDocuments.find(d => d.code === documentCode);
    if (!doc) {
      throw new Error('Documento no encontrado en la lista de requeridos');
    }

    doc.provided = true;
    doc.providedAt = new Date();
    doc.documentId = documentId;

    control.addTimelineEvent(
      'document_uploaded',
      `Documento ${doc.name} (${documentCode}) proporcionado`,
      userId
    );

    // Verificar si todos los documentos estan completos
    if (control.documentsComplete()) {
      control.status = control.inspection.required ? 'inspection_pending' : 'documents_submitted';
      control.addTimelineEvent(
        'status_changed',
        `Estado cambiado a ${control.status} - Documentacion completa`,
        userId
      );
    }

    await control.save();
    return control;
  }

  /**
   * Programar inspeccion
   */
  async scheduleInspection(controlId, inspectionData, userId) {
    const control = await _loadOwnedControl(controlId, userId);

    control.inspection.scheduled = true;
    control.inspection.scheduledDate = inspectionData.scheduledDate;
    control.inspection.scheduledTime = inspectionData.scheduledTime;
    control.inspection.location = inspectionData.location;
    control.status = 'inspection_scheduled';

    control.addTimelineEvent(
      'inspection_scheduled',
      `Inspeccion programada para ${inspectionData.scheduledDate} a las ${inspectionData.scheduledTime}`,
      userId,
      { location: inspectionData.location?.name }
    );

    await control.save();
    return control;
  }

  /**
   * Registrar resultado de inspeccion
   */
  async recordInspectionResult(controlId, resultData, userId) {
    const control = await _loadOwnedControl(controlId, userId);

    control.inspection.result = {
      inspectionDate: new Date(),
      inspectorName: resultData.inspectorName,
      inspectorId: resultData.inspectorId,
      result: resultData.result,
      findings: resultData.findings,
      conditions: resultData.conditions,
      samplesTaken: resultData.samplesTaken,
      samplesDescription: resultData.samplesDescription,
      actaNumber: resultData.actaNumber
    };

    // Actualizar estado segun resultado
    switch (resultData.result) {
      case 'approved':
        control.status = 'approved';
        control.resolvedAt = new Date();
        break;
      case 'conditional':
        control.status = 'conditional';
        control.resolvedAt = new Date();
        break;
      case 'rejected':
        control.status = 'rejected';
        control.resolvedAt = new Date();
        control.rejection = {
          reason: resultData.findings,
          appealable: true,
          appealDeadline: this._calculateDeadline('appeal')
        };
        break;
      case 'pending_analysis':
        control.status = 'lab_analysis';
        control.inspection.result.labResults = {
          pending: true,
          expectedDate: resultData.labExpectedDate
        };
        break;
      case 'requires_treatment':
        control.status = 'treatment_required';
        control.inspection.result.treatment = resultData.treatment;
        break;
    }

    control.addTimelineEvent(
      'inspection_completed',
      `Inspeccion completada - Resultado: ${resultData.result}`,
      userId,
      { result: resultData.result, actaNumber: resultData.actaNumber }
    );

    await control.save();
    return control;
  }

  /**
   * Emitir certificado
   */
  async issueCertificate(controlId, certificateData, userId) {
    const control = await _loadOwnedControl(controlId, userId);

    if (!['approved', 'conditional'].includes(control.status)) {
      throw new Error('Solo se pueden emitir certificados para controles aprobados');
    }

    control.certificate = {
      issued: true,
      issuedAt: new Date(),
      certificateNumber: certificateData.certificateNumber,
      certificateType: certificateData.certificateType,
      validFrom: certificateData.validFrom || new Date(),
      validUntil: certificateData.validUntil,
      documentId: certificateData.documentId
    };

    control.addTimelineEvent(
      'control_approved',
      `Certificado ${certificateData.certificateNumber} emitido`,
      userId
    );

    await control.save();
    return control;
  }

  /**
   * Obtener estadisticas de controles
   */
  async getStats(filters = {}) {
    const match = {};
    if (filters.startDate) match.createdAt = { $gte: new Date(filters.startDate) };
    if (filters.endDate) match.createdAt = { ...match.createdAt, $lte: new Date(filters.endDate) };

    const stats = await ParaduaneroControl.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$controlType',
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $in: ['$status', ['pending', 'documents_required', 'documents_submitted']] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $in: ['$status', ['inspection_pending', 'inspection_scheduled', 'under_inspection', 'lab_analysis']] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } }
        }
      }
    ]);

    return stats;
  }

  // --- Metodos auxiliares ---

  _requiresCites(taricCode) {
    return CITES_TARIC_PREFIXES.some(prefix => taricCode.startsWith(prefix));
  }

  _isHighRiskOrigin(country, subType) {
    if (!country || !subType) return false;
    const highRisk = HIGH_RISK_COUNTRIES[subType] || [];
    return highRisk.includes(country);
  }

  _calculatePriority(controlType, origin) {
    // CITES y AEMPS siempre alta prioridad
    if (['MITERD', 'AEMPS'].includes(controlType)) return 'high';
    // Paises alto riesgo
    if (HIGH_RISK_COUNTRIES.veterinary?.includes(origin) ||
        HIGH_RISK_COUNTRIES.phytosanitary?.includes(origin)) {
      return 'high';
    }
    return 'normal';
  }

  _calculateDeadline(controlType) {
    const days = {
      'SOIVRE': 5,
      'MAPA': 3,
      'SANIDAD': 3,
      'MITERD': 7,
      'AEMPS': 10,
      'AESAN': 3,
      'appeal': 30
    };
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + (days[controlType] || 5));
    return deadline;
  }
}

module.exports = new ParaduaneroService();
