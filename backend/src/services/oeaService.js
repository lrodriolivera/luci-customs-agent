/**
 * OEA Service - Operador Economico Autorizado
 * Business logic for OEA certification management
 *
 * STRIX AI - LUCI Customs Agent
 */

const OEA = require('../models/OEA');
const logger = require('../config/logger');

/**
 * Carga una certificacion OEA comprobando que pertenece a quien la pide.
 *
 * Las rutas de escritura pasaban el id directo al servicio, que hacia findById
 * sin mirar createdBy: con el id de una OEA ajena se podia aprobarla,
 * suspenderla, revocarla o registrarle incidencias. Se lanza el mismo error que
 * cuando no existe, para no confirmar que el id es valido en otra cuenta.
 *
 * Sin userId (jobs, migraciones) no se comprueba, y las OEA legacy sin
 * createdBy siguen accesibles para no romper el historico.
 */
async function _loadOwnedOEA(id, userId) {
  const oea = await OEA.findById(id);
  if (!oea) {
    throw new Error('Certificacion OEA no encontrada');
  }
  if (userId && oea.createdBy && String(oea.createdBy) !== String(userId)) {
    throw new Error('Certificacion OEA no encontrada');
  }
  return oea;
}


// OEA Benefits catalog
const OEA_BENEFITS = {
  OEAC: [
    {
      code: 'OEAC-01',
      name: 'Reduccion de garantias',
      category: 'guarantee',
      description: 'Reduccion del 30% en garantias globales para deudas aduaneras'
    },
    {
      code: 'OEAC-02',
      name: 'Despacho centralizado',
      category: 'simplification',
      description: 'Posibilidad de presentar declaraciones en aduana distinta a la de importacion'
    },
    {
      code: 'OEAC-03',
      name: 'Autodespachante',
      category: 'simplification',
      description: 'Autorizacion simplificada para actuar como autodespachante'
    },
    {
      code: 'OEAC-04',
      name: 'Inscripcion en registros declarantes',
      category: 'simplification',
      description: 'Facilidades para inscripcion en sistema de declarantes autorizados'
    },
    {
      code: 'OEAC-05',
      name: 'Menos controles fisicos y documentales',
      category: 'control',
      description: 'Menor frecuencia de controles aleatorios'
    },
    {
      code: 'OEAC-06',
      name: 'Tramitacion prioritaria',
      category: 'priority',
      description: 'Prioridad en tramitacion cuando se selecciona para control'
    }
  ],
  OEAS: [
    {
      code: 'OEAS-01',
      name: 'Notificacion previa de controles',
      category: 'control',
      description: 'Derecho a ser notificado antes de controles de seguridad'
    },
    {
      code: 'OEAS-02',
      name: 'Menos controles de seguridad',
      category: 'control',
      description: 'Reduccion de controles relacionados con seguridad y proteccion'
    },
    {
      code: 'OEAS-03',
      name: 'Entrada prioritaria',
      category: 'priority',
      description: 'Prioridad en la entrada de mercancias en la UE'
    },
    {
      code: 'OEAS-04',
      name: 'Reconocimiento mutuo',
      category: 'mutual_recognition',
      description: 'Beneficios en paises con acuerdos de reconocimiento mutuo (USA, Japon, China, etc.)'
    },
    {
      code: 'OEAS-05',
      name: 'ENS/EXS simplificado',
      category: 'simplification',
      description: 'Datos reducidos en declaraciones sumarias de entrada/salida'
    }
  ],
  OEAF: [] // Combines OEAC + OEAS benefits
};

// Guarantee reduction levels by certification type
const GUARANTEE_REDUCTIONS = {
  OEAC: {
    standard: 'reduced_30',
    enhanced: 'reduced_50'
  },
  OEAS: {
    standard: 'none',
    enhanced: 'none'
  },
  OEAF: {
    standard: 'reduced_50',
    enhanced: 'exempt_100'
  }
};

// Simplifications available
const AVAILABLE_SIMPLIFICATIONS = [
  {
    code: 'SDE',
    name: 'Declaracion Simplificada de Entrada',
    description: 'Permite presentar declaracion con datos minimos y completar posteriormente',
    requirements: ['OEAC', 'OEAF']
  },
  {
    code: 'ILE',
    name: 'Inscripcion en los Registros del Declarante',
    description: 'Anotacion directa en contabilidad sin declaracion previa',
    requirements: ['OEAC', 'OEAF']
  },
  {
    code: 'DCA',
    name: 'Despacho Centralizado de Aduanas',
    description: 'Declaracion en aduana diferente a la de presentacion de mercancias',
    requirements: ['OEAC', 'OEAF']
  },
  {
    code: 'AUT',
    name: 'Autoasistencia',
    description: 'Realizar operaciones sin supervision directa de funcionarios',
    requirements: ['OEAC', 'OEAF']
  },
  {
    code: 'GGR',
    name: 'Garantia Global Reducida',
    description: 'Uso de garantia global con importe reducido',
    requirements: ['OEAC', 'OEAF']
  },
  {
    code: 'DIF',
    name: 'Aplazamiento de Pago',
    description: 'Diferimiento del pago de derechos hasta 30 dias',
    requirements: ['OEAC', 'OEAF']
  }
];

// Mutual recognition partners
const MUTUAL_RECOGNITION_PARTNERS = [
  { country: 'Estados Unidos', countryCode: 'US', programName: 'C-TPAT', since: '2012-05-04' },
  { country: 'Japon', countryCode: 'JP', programName: 'AEO Japan', since: '2010-06-24' },
  { country: 'Suiza', countryCode: 'CH', programName: 'AEO Switzerland', since: '2009-07-01' },
  { country: 'Noruega', countryCode: 'NO', programName: 'AEO Norway', since: '2009-07-01' },
  { country: 'China', countryCode: 'CN', programName: 'AEO China', since: '2014-05-16' },
  { country: 'Andorra', countryCode: 'AD', programName: 'AEO Andorra', since: '2012-01-01' },
  { country: 'Reino Unido', countryCode: 'GB', programName: 'AEO UK', since: '2021-01-01' }
];

class OEAService {
  constructor() {
    logger.info('[OEAService] Initialized');
  }

  /**
   * Create new OEA application
   */
  async createApplication(data, userId) {
    logger.info(`[OEAService] Creating OEA application for ${data.organization?.nif}`);

    try {
      // Check if organization already has OEA
      const existing = await OEA.findOne({ 'organization.nif': data.organization.nif });
      if (existing && ['approved', 'under_review', 'pending'].includes(existing.certification.status)) {
        throw new Error(`La organizacion ya tiene una certificacion OEA en estado: ${existing.certification.status}`);
      }

      // Assign default benefits based on certification type
      const benefits = this.getDefaultBenefits(data.certification.type);

      // Set security requirements status based on type
      const securityStatus = data.certification.type === 'OEAC' ? 'not_applicable' : 'partial';

      const oea = new OEA({
        ...data,
        benefits,
        certification: {
          ...data.certification,
          status: 'pending',
          applicationDate: new Date()
        },
        requirements: {
          customsCompliance: { status: 'partial' },
          recordKeeping: { status: 'partial' },
          financialSolvency: { status: 'partial' },
          practicalCompetence: { status: 'partial' },
          securityStandards: { status: securityStatus }
        },
        compliance: {
          currentStatus: 'acceptable',
          records: []
        },
        createdBy: userId
      });

      await oea.save();

      // Add initial activity log
      await oea.addActivityLog(
        'APPLICATION_CREATED',
        `Solicitud de certificacion ${data.certification.type} creada`,
        userId
      );

      logger.info(`[OEAService] OEA application created: ${oea._id}`);
      return oea;

    } catch (error) {
      logger.error('[OEAService] Error creating application:', error);
      throw error;
    }
  }

  /**
   * Get default benefits for certification type
   */
  getDefaultBenefits(certificationType) {
    const benefits = [];

    if (certificationType === 'OEAC' || certificationType === 'OEAF') {
      benefits.push(...OEA_BENEFITS.OEAC.map(b => ({
        ...b,
        active: false,
        activatedDate: null
      })));
    }

    if (certificationType === 'OEAS' || certificationType === 'OEAF') {
      benefits.push(...OEA_BENEFITS.OEAS.map(b => ({
        ...b,
        active: false,
        activatedDate: null
      })));
    }

    return benefits;
  }

  /**
   * Update OEA application/certification
   */
  async update(id, data, userId) {
    logger.info(`[OEAService] Updating OEA: ${id}`);

    try {
      const oea = await _loadOwnedOEA(id, userId);

      // Update allowed fields
      const allowedUpdates = [
        'organization.contact',
        'organization.address',
        'notes',
        'requirements'
      ];

      for (const path of allowedUpdates) {
        const value = path.split('.').reduce((obj, key) => obj?.[key], data);
        if (value !== undefined) {
          const keys = path.split('.');
          let target = oea;
          for (let i = 0; i < keys.length - 1; i++) {
            target = target[keys[i]];
          }
          target[keys[keys.length - 1]] = value;
        }
      }

      oea.updatedBy = userId;
      await oea.save();

      await oea.addActivityLog(
        'APPLICATION_UPDATED',
        'Datos de la solicitud actualizados',
        userId
      );

      return oea;

    } catch (error) {
      logger.error('[OEAService] Error updating OEA:', error);
      throw error;
    }
  }

  /**
   * Submit application for review
   */
  async submitForReview(id, userId) {
    logger.info(`[OEAService] Submitting OEA for review: ${id}`);

    try {
      const oea = await _loadOwnedOEA(id, userId);

      if (oea.certification.status !== 'pending') {
        throw new Error(`No se puede enviar a revision en estado: ${oea.certification.status}`);
      }

      // Validate minimum requirements
      const validation = this.validateApplication(oea);
      if (!validation.valid) {
        throw new Error(`Validacion fallida: ${validation.errors.join(', ')}`);
      }

      oea.certification.status = 'under_review';
      await oea.save();

      await oea.addActivityLog(
        'SUBMITTED_FOR_REVIEW',
        'Solicitud enviada a AEAT para revision',
        userId
      );

      return oea;

    } catch (error) {
      logger.error('[OEAService] Error submitting for review:', error);
      throw error;
    }
  }

  /**
   * Validate OEA application completeness
   */
  /**
   * MUERTO: la asignacion a oeaServiceInstance.validateApplication (al final
   * del fichero) sobrescribe este metodo en la instancia exportada, que es la
   * unica que se usa. Se conserva por si algun dia se instancia la clase, pero
   * las comprobaciones vivas estan alli.
   */
  validateApplication(oea) {
    const errors = [];

    // Organization validation
    if (!oea.organization.name) errors.push('Nombre de organizacion requerido');
    if (!oea.organization.nif) errors.push('NIF requerido');
    if (!oea.organization.eori) errors.push('EORI requerido');
    if (!oea.organization.address?.city) errors.push('Direccion incompleta');

    // Contact validation
    if (!oea.organization.contact?.name) errors.push('Contacto requerido');
    if (!oea.organization.contact?.email) errors.push('Email de contacto requerido');

    // Legal representative
    if (!oea.organization.legalRepresentative?.name) errors.push('Representante legal requerido');

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Approve OEA certification
   */
  async approve(id, approvalData, userId) {
    logger.info(`[OEAService] Approving OEA: ${id}`);

    try {
      const oea = await _loadOwnedOEA(id, userId);

      if (oea.certification.status !== 'under_review') {
        throw new Error(`No se puede aprobar en estado: ${oea.certification.status}`);
      }

      // Generate OEA number.
      // this.generateOEANumber es la version reasignada en la instancia
      // (linea ~1302), cuya firma es (type, EORI): usa eori.substring(0,2) como
      // codigo de pais. Pasarle el NIF (p.ej. "B12345678") producia numeros con
      // prefijo de pais invalido ("B1OEAC...") en vez de "ESOEAC..." — el numero
      // OEA es un identificador oficial ante AEAT. Se pasa el EORI, que ya
      // empieza por el codigo ISO de pais.
      const oeaNumber = this.generateOEANumber(oea.certification.type, oea.organization.eori);

      // Calculate expiration (5 years)
      const expirationDate = new Date();
      expirationDate.setFullYear(expirationDate.getFullYear() + 5);

      oea.certification.status = 'approved';
      oea.certification.number = oeaNumber;
      oea.certification.approvalDate = new Date();
      oea.certification.effectiveDate = approvalData.effectiveDate || new Date();
      oea.certification.expirationDate = expirationDate;
      oea.certification.responsibleOffice = approvalData.responsibleOffice;

      // Activate benefits
      oea.benefits = oea.benefits.map(b => ({
        ...b.toObject(),
        active: true,
        activatedDate: new Date()
      }));

      // Set guarantee reduction
      const reductionLevel = GUARANTEE_REDUCTIONS[oea.certification.type]?.standard || 'none';
      oea.guaranteeReduction = {
        level: reductionLevel,
        approvedDate: new Date(),
        conditions: ['Mantenimiento del status OEA', 'Cumplimiento continuado de requisitos']
      };

      // Add mutual recognition for OEAS/OEAF
      if (oea.certification.type !== 'OEAC') {
        oea.mutualRecognition = MUTUAL_RECOGNITION_PARTNERS.map(p => ({
          ...p,
          recognitionDate: new Date(),
          status: 'active',
          benefits: ['Menor frecuencia de controles', 'Tramitacion prioritaria']
        }));
      }

      await oea.save();

      await oea.addActivityLog(
        'CERTIFICATION_APPROVED',
        `Certificacion ${oea.certification.type} aprobada con numero ${oeaNumber}`,
        userId,
        { oeaNumber, expirationDate }
      );

      // Create renewal reminder alert
      const reminderDate = new Date(expirationDate);
      reminderDate.setMonth(reminderDate.getMonth() - 6);
      await oea.addAlert(
        'renewal_reminder',
        'warning',
        'La certificacion OEA expira en 6 meses. Inicie el proceso de renovacion.',
        reminderDate
      );

      return oea;

    } catch (error) {
      logger.error('[OEAService] Error approving OEA:', error);
      throw error;
    }
  }

  /**
   * Generate OEA authorization number
   */
  generateOEANumber(type, nif) {
    const year = new Date().getFullYear();
    const typeCode = type;
    const countryCode = 'ES';
    const sequence = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${countryCode}${typeCode}${year}${nif.substring(0, 4)}${sequence}`;
  }

  /**
   * Suspend OEA certification
   */
  async suspend(id, reason, userId) {
    logger.info(`[OEAService] Suspending OEA: ${id}`);

    try {
      const oea = await _loadOwnedOEA(id, userId);

      if (oea.certification.status !== 'approved') {
        throw new Error(`No se puede suspender en estado: ${oea.certification.status}`);
      }

      oea.certification.status = 'suspended';

      // Deactivate benefits
      oea.benefits = oea.benefits.map(b => ({
        ...b.toObject(),
        active: false
      }));

      // Remove guarantee reduction
      oea.guaranteeReduction.level = 'none';

      await oea.save();

      await oea.addActivityLog(
        'CERTIFICATION_SUSPENDED',
        `Certificacion suspendida: ${reason}`,
        userId,
        { reason }
      );

      await oea.addAlert(
        'compliance_issue',
        'critical',
        `Certificacion suspendida: ${reason}`,
        null
      );

      return oea;

    } catch (error) {
      logger.error('[OEAService] Error suspending OEA:', error);
      throw error;
    }
  }

  /**
   * Revoke OEA certification
   */
  async revoke(id, reason, userId) {
    logger.info(`[OEAService] Revoking OEA: ${id}`);

    try {
      const oea = await _loadOwnedOEA(id, userId);

      oea.certification.status = 'revoked';

      // Deactivate all benefits
      oea.benefits = oea.benefits.map(b => ({
        ...b.toObject(),
        active: false
      }));

      // Remove guarantee reduction
      oea.guaranteeReduction.level = 'none';

      // Deactivate simplifications
      oea.simplifications = oea.simplifications.map(s => ({
        ...s.toObject(),
        active: false
      }));

      await oea.save();

      await oea.addActivityLog(
        'CERTIFICATION_REVOKED',
        `Certificacion revocada: ${reason}`,
        userId,
        { reason }
      );

      return oea;

    } catch (error) {
      logger.error('[OEAService] Error revoking OEA:', error);
      throw error;
    }
  }

  /**
   * Initiate reevaluation process (Art. 23 CAU)
   * Se inicia cuando hay cambios en legislacion o indicios de incumplimiento
   */
  async initiateReevaluation(id, reason, userId) {
    logger.info(`[OEAService] Initiating reevaluation for OEA: ${id}`);

    try {
      const oea = await _loadOwnedOEA(id, userId);

      if (!['approved', 'incident'].includes(oea.certification.status)) {
        throw new Error(`No se puede iniciar reevaluacion en estado: ${oea.certification.status}`);
      }

      // Store previous status for potential restoration
      oea.certification.previousStatus = oea.certification.status;
      oea.certification.status = 'reevaluation';
      oea.certification.reevaluationStartDate = new Date();
      oea.certification.reevaluationReason = reason;

      await oea.save();

      await oea.addActivityLog(
        'REEVALUATION_INITIATED',
        `Reevaluacion iniciada: ${reason}`,
        userId,
        { reason }
      );

      await oea.addAlert(
        'compliance_issue',
        'warning',
        `Reevaluacion iniciada: ${reason}`,
        new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days deadline
      );

      return oea;

    } catch (error) {
      logger.error('[OEAService] Error initiating reevaluation:', error);
      throw error;
    }
  }

  /**
   * Register an incident (incidencia de mantenimiento)
   * Para comunicar incidencias o irregularidades detectadas
   */
  async registerIncident(id, incidentData, userId) {
    logger.info(`[OEAService] Registering incident for OEA: ${id}`);

    try {
      const oea = await _loadOwnedOEA(id, userId);

      if (oea.certification.status !== 'approved') {
        throw new Error(`No se puede registrar incidencia en estado: ${oea.certification.status}`);
      }

      oea.certification.previousStatus = oea.certification.status;
      oea.certification.status = 'incident';

      // Add incident to history
      if (!oea.incidents) oea.incidents = [];
      oea.incidents.push({
        type: incidentData.type,
        description: incidentData.description,
        severity: incidentData.severity || 'minor',
        reportedDate: new Date(),
        reportedBy: userId,
        status: 'open',
        affectedAreas: incidentData.affectedAreas || [],
        correctiveActions: incidentData.correctiveActions || ''
      });

      await oea.save();

      await oea.addActivityLog(
        'INCIDENT_REGISTERED',
        `Incidencia registrada: ${incidentData.type} - ${incidentData.description}`,
        userId,
        incidentData
      );

      const alertSeverity = incidentData.severity === 'critical' ? 'critical' : 'warning';
      await oea.addAlert(
        'compliance_issue',
        alertSeverity,
        `Incidencia registrada: ${incidentData.description}`,
        null
      );

      return oea;

    } catch (error) {
      logger.error('[OEAService] Error registering incident:', error);
      throw error;
    }
  }

  /**
   * Resolve an incident and restore status
   */
  async resolveIncident(id, incidentIndex, resolution, userId) {
    logger.info(`[OEAService] Resolving incident for OEA: ${id}`);

    try {
      const oea = await _loadOwnedOEA(id, userId);

      if (!oea.incidents || !oea.incidents[incidentIndex]) {
        throw new Error('Incidencia no encontrada');
      }

      // Mark incident as resolved
      oea.incidents[incidentIndex].status = 'resolved';
      oea.incidents[incidentIndex].resolvedDate = new Date();
      oea.incidents[incidentIndex].resolution = resolution;
      oea.incidents[incidentIndex].resolvedBy = userId;

      // Check if all incidents are resolved
      const openIncidents = oea.incidents.filter(i => i.status === 'open');
      if (openIncidents.length === 0 && oea.certification.status === 'incident') {
        oea.certification.status = oea.certification.previousStatus || 'approved';
        delete oea.certification.previousStatus;
      }

      await oea.save();

      await oea.addActivityLog(
        'INCIDENT_RESOLVED',
        `Incidencia resuelta: ${resolution}`,
        userId,
        { incidentIndex, resolution }
      );

      return oea;

    } catch (error) {
      logger.error('[OEAService] Error resolving incident:', error);
      throw error;
    }
  }

  /**
   * Initiate renewal process
   */
  async initiateRenewal(id, userId) {
    logger.info(`[OEAService] Initiating renewal for OEA: ${id}`);

    try {
      const oea = await _loadOwnedOEA(id, userId);

      if (oea.certification.status !== 'approved') {
        throw new Error('Solo se pueden renovar certificaciones activas');
      }

      oea.certification.status = 'renewal_pending';

      await oea.save();

      await oea.addActivityLog(
        'RENEWAL_INITIATED',
        'Proceso de renovacion iniciado',
        userId
      );

      return oea;

    } catch (error) {
      logger.error('[OEAService] Error initiating renewal:', error);
      throw error;
    }
  }

  /**
   * Complete renewal
   */
  async completeRenewal(id, userId) {
    logger.info(`[OEAService] Completing renewal for OEA: ${id}`);

    try {
      const oea = await _loadOwnedOEA(id, userId);

      if (oea.certification.status !== 'renewal_pending') {
        throw new Error('La certificacion no esta en proceso de renovacion');
      }

      // Extend expiration by 5 years
      const newExpiration = new Date();
      newExpiration.setFullYear(newExpiration.getFullYear() + 5);

      oea.certification.status = 'approved';
      oea.certification.lastRenewalDate = new Date();
      oea.certification.expirationDate = newExpiration;

      // Reactivate all benefits
      oea.benefits = oea.benefits.map(b => ({
        ...b.toObject(),
        active: true
      }));

      await oea.save();

      await oea.addActivityLog(
        'RENEWAL_COMPLETED',
        `Renovacion completada. Nueva fecha de expiracion: ${newExpiration.toISOString().split('T')[0]}`,
        userId,
        { newExpirationDate: newExpiration }
      );

      // Create new renewal reminder
      const reminderDate = new Date(newExpiration);
      reminderDate.setMonth(reminderDate.getMonth() - 6);
      await oea.addAlert(
        'renewal_reminder',
        'warning',
        'La certificacion OEA expira en 6 meses. Inicie el proceso de renovacion.',
        reminderDate
      );

      return oea;

    } catch (error) {
      logger.error('[OEAService] Error completing renewal:', error);
      throw error;
    }
  }

  /**
   * Add audit record
   */
  async addAudit(id, auditData, userId) {
    logger.info(`[OEAService] Adding audit to OEA: ${id}`);

    try {
      const oea = await _loadOwnedOEA(id, userId);

      oea.audits.push({
        ...auditData,
        date: auditData.date || new Date()
      });

      // Update compliance based on audit result
      if (auditData.result === 'failed') {
        oea.compliance.currentStatus = 'critical';
      } else if (auditData.result === 'passed_with_conditions') {
        oea.compliance.currentStatus = 'warning';
      }

      // Add alerts for open findings
      for (const finding of auditData.findings || []) {
        if (finding.severity === 'critical' || finding.severity === 'major') {
          await oea.addAlert(
            'finding_due',
            finding.severity === 'critical' ? 'critical' : 'warning',
            `Hallazgo de auditoria: ${finding.description}`,
            finding.dueDate
          );
        }
      }

      await oea.save();

      await oea.addActivityLog(
        'AUDIT_RECORDED',
        `Auditoria ${auditData.type} registrada con resultado: ${auditData.result}`,
        userId
      );

      return oea;

    } catch (error) {
      logger.error('[OEAService] Error adding audit:', error);
      throw error;
    }
  }

  /**
   * Update requirement status
   */
  async updateRequirement(id, requirementKey, status, notes, userId) {
    logger.info(`[OEAService] Updating requirement ${requirementKey} for OEA: ${id}`);

    try {
      const oea = await _loadOwnedOEA(id, userId);

      if (!oea.requirements[requirementKey]) {
        throw new Error(`Requisito no valido: ${requirementKey}`);
      }

      oea.requirements[requirementKey].status = status;
      oea.requirements[requirementKey].lastVerified = new Date();
      if (notes) {
        oea.requirements[requirementKey].notes = notes;
      }

      await oea.save();

      await oea.addActivityLog(
        'REQUIREMENT_UPDATED',
        `Requisito ${requirementKey} actualizado a: ${status}`,
        userId
      );

      return oea;

    } catch (error) {
      logger.error('[OEAService] Error updating requirement:', error);
      throw error;
    }
  }

  /**
   * Add compliance record
   */
  async addComplianceRecord(id, recordData, userId) {
    logger.info(`[OEAService] Adding compliance record to OEA: ${id}`);

    try {
      const oea = await _loadOwnedOEA(id, userId);

      // Determine compliance status based on metrics
      let status = 'compliant';
      if (recordData.metrics.errorRate > 5 || recordData.metrics.customsInfractions > 0) {
        status = 'non_compliant';
      } else if (recordData.metrics.errorRate > 2 || recordData.metrics.lateSubmissions > 5) {
        status = 'warning';
      }

      oea.compliance.records.push({
        ...recordData,
        status,
        reviewedBy: userId,
        reviewedDate: new Date()
      });

      // Update overall compliance status
      const recentRecords = oea.compliance.records.slice(-4);
      const nonCompliant = recentRecords.filter(r => r.status === 'non_compliant').length;
      const warnings = recentRecords.filter(r => r.status === 'warning').length;

      if (nonCompliant >= 2) {
        oea.compliance.currentStatus = 'critical';
      } else if (nonCompliant === 1 || warnings >= 2) {
        oea.compliance.currentStatus = 'warning';
      } else if (warnings === 1) {
        oea.compliance.currentStatus = 'acceptable';
      } else {
        oea.compliance.currentStatus = 'excellent';
      }

      await oea.save();

      await oea.addActivityLog(
        'COMPLIANCE_RECORD_ADDED',
        `Registro de cumplimiento Q${recordData.period.quarter}/${recordData.period.year}: ${status}`,
        userId
      );

      return oea;

    } catch (error) {
      logger.error('[OEAService] Error adding compliance record:', error);
      throw error;
    }
  }

  /**
   * Grant simplification
   */
  async grantSimplification(id, simplificationCode, userId) {
    logger.info(`[OEAService] Granting simplification ${simplificationCode} to OEA: ${id}`);

    try {
      const oea = await _loadOwnedOEA(id, userId);

      if (oea.certification.status !== 'approved') {
        throw new Error('Solo se pueden otorgar simplificaciones a certificaciones activas');
      }

      const simplification = AVAILABLE_SIMPLIFICATIONS.find(s => s.code === simplificationCode);
      if (!simplification) {
        throw new Error(`Simplificacion no valida: ${simplificationCode}`);
      }

      // Check if certification type allows this simplification
      if (!simplification.requirements.includes(oea.certification.type)) {
        throw new Error(`La simplificacion ${simplificationCode} no esta disponible para ${oea.certification.type}`);
      }

      // Check if already granted
      const existing = oea.simplifications.find(s => s.code === simplificationCode);
      if (existing && existing.active) {
        throw new Error(`La simplificacion ${simplificationCode} ya esta activa`);
      }

      oea.simplifications.push({
        code: simplification.code,
        name: simplification.name,
        description: simplification.description,
        grantedDate: new Date(),
        conditions: ['Mantenimiento del status OEA activo'],
        active: true
      });

      await oea.save();

      await oea.addActivityLog(
        'SIMPLIFICATION_GRANTED',
        `Simplificacion ${simplification.name} (${simplificationCode}) otorgada`,
        userId
      );

      return oea;

    } catch (error) {
      logger.error('[OEAService] Error granting simplification:', error);
      throw error;
    }
  }

  /**
   * Calculate guarantee reduction for an operation
   */
  async calculateGuaranteeReduction(oeaId, originalAmount) {
    try {
      const oea = await OEA.findById(oeaId);
      if (!oea || oea.certification.status !== 'approved') {
        return {
          applicable: false,
          originalAmount,
          reducedAmount: originalAmount,
          reductionPercentage: 0,
          reason: 'OEA no activo'
        };
      }

      const reductionPercentage = oea.getGuaranteeReductionPercentage();
      const reducedAmount = originalAmount * (1 - reductionPercentage / 100);

      return {
        applicable: reductionPercentage > 0,
        originalAmount,
        reducedAmount,
        reductionPercentage,
        oeaNumber: oea.certification.number,
        oeaType: oea.certification.type,
        reason: `Reduccion OEA ${oea.certification.type}: ${reductionPercentage}%`
      };

    } catch (error) {
      logger.error('[OEAService] Error calculating guarantee reduction:', error);
      throw error;
    }
  }

  /**
   * Get OEA by ID.
   *
   * Acotado por createdBy: sin esto, cualquier usuario autenticado que conociera
   * (o enumerara) el id de una OEA ajena recibia la certificacion completa de
   * otra empresa (NIF, EORI, representante legal). Se devuelve null igual que si
   * no existiera, para no confirmar el id en otra cuenta. userId ausente
   * (jobs/migraciones) y OEA legacy sin createdBy siguen accesibles.
   */
  async getById(id, userId = null) {
    const oea = await OEA.findById(id);
    if (!oea) return null;
    if (userId && oea.createdBy && String(oea.createdBy) !== String(userId)) {
      return null;
    }
    return oea;
  }

  /**
   * Get OEA by EORI. Acotado por createdBy (ver getById): el EORI es un
   * identificador empresarial y sin filtro se podia consultar la OEA de otra
   * empresa por su EORI.
   */
  async getByEORI(eori, userId = null) {
    const oea = await OEA.findByEORI(eori);
    if (!oea) return null;
    if (userId && oea.createdBy && String(oea.createdBy) !== String(userId)) {
      return null;
    }
    return oea;
  }

  /**
   * Get OEA by NIF. Acotado por createdBy (ver getById): el NIF es un dato
   * fiscal personal; sin filtro se filtraba la OEA de otra empresa por su NIF.
   */
  async getByNIF(nif, userId = null) {
    const oea = await OEA.findOne({ 'organization.nif': nif });
    if (!oea) return null;
    if (userId && oea.createdBy && String(oea.createdBy) !== String(userId)) {
      return null;
    }
    return oea;
  }

  /**
   * List all OEAs with filters
   */
  async list(filters = {}, options = {}) {
    const query = {};

    // Sin esto el listado devolvia TODAS las certificaciones OEA del sistema a
    // cualquier usuario, con NIF, EORI y representante legal de cada empresa.
    if (filters.userId) {
      query.createdBy = filters.userId;
    }

    if (filters.status) {
      query['certification.status'] = filters.status;
    }
    if (filters.type) {
      query['certification.type'] = filters.type;
    }
    if (filters.search) {
      query.$or = [
        { 'organization.name': new RegExp(filters.search, 'i') },
        { 'organization.nif': new RegExp(filters.search, 'i') },
        { 'organization.eori': new RegExp(filters.search, 'i') },
        { 'certification.number': new RegExp(filters.search, 'i') }
      ];
    }

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const [oeas, total] = await Promise.all([
      OEA.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      OEA.countDocuments(query)
    ]);

    return {
      data: oeas,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get expiring certifications
   */
  async getExpiring(daysAhead = 90) {
    return OEA.findExpiring(daysAhead);
  }

  /**
   * Get statistics
   */
  async getStats() {
    const [
      totalActive,
      byType,
      byStatus,
      expiringSoon,
      complianceIssues
    ] = await Promise.all([
      OEA.countDocuments({ 'certification.status': 'approved' }),
      OEA.aggregate([
        { $match: { 'certification.status': 'approved' } },
        { $group: { _id: '$certification.type', count: { $sum: 1 } } }
      ]),
      OEA.aggregate([
        { $group: { _id: '$certification.status', count: { $sum: 1 } } }
      ]),
      OEA.findExpiring(90),
      OEA.countDocuments({
        'certification.status': 'approved',
        'compliance.currentStatus': { $in: ['warning', 'critical'] }
      })
    ]);

    return {
      totalActive,
      byType: byType.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      byStatus: byStatus.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      expiringSoon: expiringSoon.length,
      complianceIssues
    };
  }

  /**
   * Get available simplifications for a certification type
   */
  getAvailableSimplifications(certificationType) {
    return AVAILABLE_SIMPLIFICATIONS.filter(s =>
      s.requirements.includes(certificationType)
    );
  }

  /**
   * Get mutual recognition partners
   */
  getMutualRecognitionPartners() {
    return MUTUAL_RECOGNITION_PARTNERS;
  }

  /**
   * Get benefits catalog
   */
  getBenefitsCatalog() {
    return OEA_BENEFITS;
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(id, alertId, userId) {
    const oea = await _loadOwnedOEA(id, userId);

    const alert = oea.alerts.id(alertId);
    if (!alert) {
      throw new Error('Alerta no encontrada');
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedDate = new Date();

    await oea.save();
    return oea;
  }

  /**
   * Resolve alert
   */
  async resolveAlert(id, alertId, userId) {
    const oea = await _loadOwnedOEA(id, userId);

    const alert = oea.alerts.id(alertId);
    if (!alert) {
      throw new Error('Alerta no encontrada');
    }

    alert.resolved = true;
    alert.resolvedDate = new Date();

    await oea.save();
    return oea;
  }
}

// Create instance
const oeaServiceInstance = new OEAService();

// Attach static methods and constants to the instance for easy access
oeaServiceInstance.OEA_BENEFITS = Object.values(OEA_BENEFITS).flat().map((b, idx) => ({
  ...b,
  types: Object.entries(OEA_BENEFITS)
    .filter(([type, benefits]) => benefits.some(benefit => benefit.code === b.code))
    .map(([type]) => type)
}));

oeaServiceInstance.GUARANTEE_REDUCTIONS = GUARANTEE_REDUCTIONS;
oeaServiceInstance.AVAILABLE_SIMPLIFICATIONS = AVAILABLE_SIMPLIFICATIONS.map(s => ({
  ...s,
  applicableTo: s.requirements
}));
oeaServiceInstance.MUTUAL_RECOGNITION_PARTNERS = MUTUAL_RECOGNITION_PARTNERS;

// Static helper methods
oeaServiceInstance.validateApplication = function(data) {
  const errors = [];

  if (!data.organization?.name) {
    errors.push({ field: 'organization.name', message: 'Nombre de organizacion requerido' });
  }
  if (!data.organization?.nif) {
    errors.push({ field: 'organization.nif', message: 'NIF requerido' });
  }
  if (!data.organization?.eori) {
    errors.push({ field: 'organization.eori', message: 'EORI requerido' });
  }
  if (!['OEAC', 'OEAS', 'OEAF'].includes(data.certification?.type)) {
    errors.push({ field: 'certification.type', message: 'Tipo de certificacion invalido' });
  }

  // Estas cuatro comprobaciones vivian en PDFGenerator.validateApplication (el
  // metodo de la clase, linea ~350), pero esta asignacion lo sobrescribe en la
  // instancia exportada: submitForReview llama this.validateApplication y
  // resolvia AQUI, asi que nunca se ejecutaban. Resultado: una solicitud sin
  // direccion, sin contacto y sin representante legal pasaba a revision y la
  // AEAT la habria rechazado.
  if (!data.organization?.address?.city) {
    errors.push({ field: 'organization.address', message: 'Direccion incompleta' });
  }
  if (!data.organization?.contact?.name) {
    errors.push({ field: 'organization.contact.name', message: 'Contacto requerido' });
  }
  if (!data.organization?.contact?.email) {
    errors.push({ field: 'organization.contact.email', message: 'Email de contacto requerido' });
  }
  if (!data.organization?.legalRepresentative?.name) {
    errors.push({ field: 'organization.legalRepresentative', message: 'Representante legal requerido' });
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

oeaServiceInstance.getBenefitsByType = function(type) {
  if (!['OEAC', 'OEAS', 'OEAF'].includes(type)) return [];

  const benefits = [];
  if (type === 'OEAC' || type === 'OEAF') {
    benefits.push(...OEA_BENEFITS.OEAC.map(b => ({ ...b, types: ['OEAC', 'OEAF'] })));
  }
  if (type === 'OEAS' || type === 'OEAF') {
    benefits.push(...OEA_BENEFITS.OEAS.map(b => ({ ...b, types: ['OEAS', 'OEAF'] })));
  }
  return benefits;
};

oeaServiceInstance.getGuaranteeReductionForType = function(type) {
  const reductions = GUARANTEE_REDUCTIONS[type];
  if (!reductions) return null;

  return {
    comprehensive: type === 'OEAF' ? 100 : type === 'OEAC' ? 50 : 0,
    transit: type === 'OEAF' ? 100 : type === 'OEAC' ? 30 : 0
  };
};

oeaServiceInstance.getSimplificationsForType = function(type) {
  return AVAILABLE_SIMPLIFICATIONS.filter(s => s.requirements.includes(type))
    .map(s => ({ ...s, applicableTo: s.requirements }));
};

oeaServiceInstance.checkComplianceRequirements = function(type) {
  const requirements = {
    customsCompliance: { required: true, description: 'Cumplimiento de normativa aduanera' },
    recordKeeping: { required: true, description: 'Mantenimiento de registros' },
    financialSolvency: { required: true, description: 'Solvencia financiera' },
    practicalCompetence: { required: true, description: 'Competencia practica' },
    securityStandards: {
      required: type !== 'OEAC',
      description: 'Normas de seguridad y proteccion'
    }
  };
  return requirements;
};

oeaServiceInstance.calculateExpirationDate = function(approvalDate) {
  const date = approvalDate ? new Date(approvalDate) : new Date();
  date.setFullYear(date.getFullYear() + 5);
  return date;
};

oeaServiceInstance.generateOEANumber = function(type, eori) {
  const year = new Date().getFullYear();
  const countryCode = eori?.substring(0, 2) || 'ES';
  const sequence = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${countryCode}${type}${year}${sequence}`;
};

oeaServiceInstance.assessComplianceStatus = function(requirements, type) {
  const statuses = [
    requirements.customsCompliance?.status,
    requirements.recordKeeping?.status,
    requirements.financialSolvency?.status,
    requirements.practicalCompetence?.status
  ];

  if (type !== 'OEAC' && requirements.securityStandards) {
    statuses.push(requirements.securityStandards.status);
  }

  const notMet = statuses.filter(s => s === 'not_met').length;
  const partial = statuses.filter(s => s === 'partial').length;

  if (notMet > 0) return 'critical';
  if (partial > 1) return 'warning';
  if (partial === 1) return 'acceptable';
  return 'excellent';
};

oeaServiceInstance.getAuditTypes = function() {
  return ['internal', 'external', 'aeat', 'renewal'];
};

oeaServiceInstance.validateAuditData = function(audit) {
  const errors = [];

  if (!audit.date) {
    errors.push({ field: 'date', message: 'Fecha requerida' });
  }
  if (!['internal', 'external', 'aeat', 'renewal'].includes(audit.type)) {
    errors.push({ field: 'type', message: 'Tipo de auditoria invalido' });
  }
  if (!['passed', 'passed_with_conditions', 'failed', 'pending'].includes(audit.result)) {
    errors.push({ field: 'result', message: 'Resultado invalido' });
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

oeaServiceInstance.getInfo = function() {
  return {
    system: 'LUCI OEA Module',
    version: '1.0.0',
    types: ['OEAC', 'OEAS', 'OEAF'],
    authority: 'AEAT - Departamento de Aduanas e Impuestos Especiales',
    certificationPeriod: '5 years',
    capabilities: [
      'Application management',
      'Certification lifecycle',
      'Compliance tracking',
      'Audit management',
      'Benefits management',
      'Guarantee reductions',
      'Simplifications',
      'Mutual recognition'
    ]
  };
};

oeaServiceInstance.getSimplificationsCatalog = function() {
  return AVAILABLE_SIMPLIFICATIONS.map(s => ({
    ...s,
    applicableTo: s.requirements
  }));
};

oeaServiceInstance.findByEORI = async function(eori) {
  return OEA.findOne({ 'organization.eori': eori });
};

oeaServiceInstance.findByNIF = async function(nif) {
  return OEA.findOne({ 'organization.nif': nif });
};

oeaServiceInstance.findExpiring = async function(daysAhead = 90) {
  return OEA.findExpiring(daysAhead);
};

module.exports = oeaServiceInstance;
