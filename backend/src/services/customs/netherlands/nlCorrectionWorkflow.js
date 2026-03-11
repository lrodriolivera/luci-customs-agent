/**
 * Netherlands DMS Correction Workflow
 * In DMS 4.0, when customs finds errors, the declarant MUST correct them.
 * Goods are NOT released until corrections are processed.
 *
 * Flow: Submit -> Customs Review -> Correction Required -> Declarant Corrects -> Resubmit -> Released
 */
const logger = require('../../../config/logger');

class NLCorrectionWorkflow {

  /**
   * Process a correction notification from DMS/DECO
   */
  static async processCorrection(expedition, correctionData) {
    const {
      errorCode,
      errorDescription,
      errorPointer,     // Which data element has the error
      correctionDeadline, // Usually 10 working days
    } = correctionData;

    // Create correction record
    const correction = {
      id: `COR-${Date.now()}`,
      expeditionId: expedition.expeditionId,
      mrn: expedition.declaration?.mrn,
      status: 'pending',           // pending -> in_progress -> submitted -> resolved / rejected
      createdAt: new Date(),
      deadline: correctionDeadline || new Date(Date.now() + 10 * 24 * 3600 * 1000), // 10 days default
      errors: [{
        code: errorCode,
        description: errorDescription,
        pointer: errorPointer,
        resolved: false
      }],
      history: [{
        action: 'correction_received',
        timestamp: new Date(),
        description: `Correccion requerida por Aduanas NL: ${errorDescription}`
      }]
    };

    // Update expedition
    if (!expedition.corrections) expedition.corrections = [];
    expedition.corrections.push(correction);
    expedition.declaration.status = 'correction_required';

    logger.warn(`NL Correction required for ${expedition.expeditionId}: ${errorDescription}`);

    return correction;
  }

  /**
   * Submit correction for a specific error
   */
  static async submitCorrection(expedition, correctionId, correctedData) {
    const correction = expedition.corrections?.find(c => c.id === correctionId);
    if (!correction) {
      return { success: false, error: 'Correccion no encontrada' };
    }

    if (correction.status === 'resolved') {
      return { success: false, error: 'Correccion ya resuelta' };
    }

    // Check deadline
    if (new Date() > new Date(correction.deadline)) {
      return {
        success: false,
        error: 'Plazo de correccion expirado. Contacte con Aduanas NL.',
        expired: true
      };
    }

    // Build correction XML
    const correctionXml = NLCorrectionWorkflow._buildCorrectionXml(
      expedition.declaration.mrn,
      correctedData
    );

    // Update correction record
    correction.status = 'submitted';
    correction.submittedAt = new Date();
    correction.correctedData = correctedData;
    correction.history.push({
      action: 'correction_submitted',
      timestamp: new Date(),
      description: 'Correccion enviada a Aduanas NL'
    });

    logger.info(`NL Correction submitted for ${expedition.expeditionId} (${correctionId})`);

    return {
      success: true,
      correctionId,
      xml: correctionXml,
      status: 'submitted',
      message: 'Correccion enviada. Pendiente de procesamiento por Aduanas NL.'
    };
  }

  /**
   * Check remaining time for correction
   */
  static getCorrectionDeadlineStatus(correction) {
    const now = new Date();
    const deadline = new Date(correction.deadline);
    const remainingMs = deadline - now;
    const remainingDays = Math.ceil(remainingMs / (24 * 3600 * 1000));

    return {
      expired: remainingMs <= 0,
      remainingDays: Math.max(0, remainingDays),
      remainingHours: Math.max(0, Math.ceil(remainingMs / (3600 * 1000))),
      urgent: remainingDays <= 2,
      deadline: deadline.toISOString()
    };
  }

  /**
   * Get all pending corrections for a tenant
   */
  static async getPendingCorrections(Expedition, tenantId) {
    const expeditions = await Expedition.find({
      tenantId,
      'declaration.status': 'correction_required',
      'corrections.status': { $in: ['pending', 'in_progress'] }
    }).select('expeditionId declaration.mrn declaration.type corrections');

    return expeditions.map(exp => ({
      expeditionId: exp.expeditionId,
      mrn: exp.declaration?.mrn,
      declarationType: exp.declaration?.type,
      corrections: exp.corrections?.filter(c => ['pending', 'in_progress'].includes(c.status))
        .map(c => ({
          ...c.toObject ? c.toObject() : c,
          deadlineStatus: NLCorrectionWorkflow.getCorrectionDeadlineStatus(c)
        }))
    }));
  }

  /**
   * Build DMS correction XML
   */
  static _buildCorrectionXml(mrn, correctedData) {
    const escapeXml = (str) => {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    const fields = Object.entries(correctedData).map(([key, value]) =>
      `    <CorrectedField>
      <FieldName>${escapeXml(key)}</FieldName>
      <CorrectedValue>${escapeXml(value)}</CorrectedValue>
    </CorrectedField>`
    ).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<DeclarationAmendment xmlns="urn:wco:datamodel:WCO:DEC-DMS:2">
  <FunctionCode>13</FunctionCode>
  <DeclarationReferenceNumber>${escapeXml(mrn)}</DeclarationReferenceNumber>
  <Amendment>
    <ChangeReasonCode>CR</ChangeReasonCode>
${fields}
  </Amendment>
</DeclarationAmendment>`;
  }
}

module.exports = NLCorrectionWorkflow;
