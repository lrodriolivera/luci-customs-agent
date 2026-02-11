/**
 * Preferential Tariffs Service
 * Gestión de preferencias arancelarias: EUR.1, Form A, ATR, acumulación origen
 *
 * STRIX AI - LUCI Customs Agent
 */

const logger = require('../config/logger');

// Base de datos de acuerdos preferenciales (simplificada para demo)
const PREFERENTIAL_AGREEMENTS = {
  // Acuerdos de Libre Comercio (FTA)
  'EU-UK': {
    name: 'EU-UK Trade and Cooperation Agreement',
    type: 'FTA',
    countries: ['GB'],
    certificate: 'Statement on Origin',
    preferentialRate: 0, // 0% duty
    originRules: {
      general: 'Product-specific rules',
      tolerance: 0.10, // 10% tolerance
      cumulation: ['EU', 'GB'],
      regionalValueContent: 0.45 // 45% RVC minimum
    },
    effectiveDate: '2021-01-01',
    documentRequired: true
  },

  'CETA': {
    name: 'EU-Canada Comprehensive Economic and Trade Agreement',
    type: 'FTA',
    countries: ['CA'],
    certificate: 'Statement on Origin / EUR.1',
    preferentialRate: 0,
    originRules: {
      general: 'Product-specific rules (Annex 5)',
      tolerance: 0.10,
      cumulation: ['EU', 'CA'],
      regionalValueContent: 0.50
    },
    effectiveDate: '2017-09-21',
    documentRequired: true
  },

  'JEFTA': {
    name: 'EU-Japan Economic Partnership Agreement',
    type: 'FTA',
    countries: ['JP'],
    certificate: 'Statement on Origin / EUR.1',
    preferentialRate: 0,
    originRules: {
      general: 'Product-specific rules (Annex 3-B)',
      tolerance: 0.10,
      cumulation: ['EU', 'JP'],
      regionalValueContent: 0.45
    },
    effectiveDate: '2019-02-01',
    documentRequired: true
  },

  'EU-MEXICO': {
    name: 'EU-Mexico Free Trade Agreement (Modernized)',
    type: 'FTA',
    countries: ['MX'],
    certificate: 'EUR.1 / Statement on Origin',
    preferentialRate: 0,
    originRules: {
      general: 'Product-specific rules',
      tolerance: 0.10,
      cumulation: ['EU', 'MX'],
      regionalValueContent: 0.40
    },
    effectiveDate: '2000-07-01',
    documentRequired: true
  },

  'EU-KOREA': {
    name: 'EU-South Korea Free Trade Agreement',
    type: 'FTA',
    countries: ['KR'],
    certificate: 'EUR.1 / Invoice Declaration',
    preferentialRate: 0,
    originRules: {
      general: 'Product-specific rules (Annex II)',
      tolerance: 0.10,
      cumulation: ['EU', 'KR'],
      regionalValueContent: 0.45
    },
    effectiveDate: '2011-07-01',
    documentRequired: true
  },

  'EU-VIETNAM': {
    name: 'EU-Vietnam Free Trade Agreement',
    type: 'FTA',
    countries: ['VN'],
    certificate: 'EUR.1 / Statement on Origin',
    preferentialRate: 0,
    originRules: {
      general: 'Product-specific rules',
      tolerance: 0.10,
      cumulation: ['EU', 'VN', 'ASEAN'],
      regionalValueContent: 0.40
    },
    effectiveDate: '2020-08-01',
    documentRequired: true
  },

  'EU-CHILE': {
    name: 'EU-Chile Association Agreement',
    type: 'FTA',
    countries: ['CL'],
    certificate: 'EUR.1',
    preferentialRate: 0,
    originRules: {
      general: 'Product-specific rules',
      tolerance: 0.10,
      cumulation: ['EU', 'CL'],
      regionalValueContent: 0.40
    },
    effectiveDate: '2003-02-01',
    documentRequired: true
  },

  // Sistema de Preferencias Generalizadas (GSP)
  'GSP': {
    name: 'Generalized System of Preferences',
    type: 'GSP',
    countries: ['IN', 'PK', 'TH', 'ID', 'MA', 'TN', 'EG', 'NG', 'GH', 'KE'],
    certificate: 'Form A',
    preferentialRate: 0.70, // 30% reduction
    originRules: {
      general: 'Value-added 50% minimum',
      tolerance: 0.15,
      cumulation: ['GSP', 'EU'],
      regionalValueContent: 0.50
    },
    effectiveDate: '1971-01-01',
    documentRequired: true
  },

  'GSP_PLUS': {
    name: 'GSP+ (Special incentive arrangement)',
    type: 'GSP+',
    countries: ['PK', 'BD', 'LK', 'PH', 'KH', 'BO', 'KG', 'AM'],
    certificate: 'Form A',
    preferentialRate: 0, // Full exemption
    originRules: {
      general: 'Value-added 50% minimum',
      tolerance: 0.15,
      cumulation: ['GSP', 'EU'],
      regionalValueContent: 0.50
    },
    effectiveDate: '2009-01-01',
    documentRequired: true
  },

  'EBA': {
    name: 'Everything But Arms (EBA)',
    type: 'EBA',
    countries: ['BD', 'KH', 'LA', 'MM', 'NP', 'AF', 'YE', 'SD', 'ET', 'UG'],
    certificate: 'Form A',
    preferentialRate: 0, // Full exemption
    originRules: {
      general: 'Value-added 50% minimum',
      tolerance: 0.15,
      cumulation: ['LDC', 'EU'],
      regionalValueContent: 0.50
    },
    effectiveDate: '2001-03-05',
    documentRequired: true
  },

  // Pan-Euro-Med
  'PAN_EURO_MED': {
    name: 'Pan-Euro-Mediterranean',
    type: 'PEM',
    countries: ['NO', 'CH', 'IS', 'TR', 'MK', 'RS', 'ME', 'AL', 'BA', 'XK', 'IL', 'PS', 'JO', 'EG', 'TN', 'MA', 'DZ'],
    certificate: 'EUR.1 / EUR-MED',
    preferentialRate: 0,
    originRules: {
      general: 'Diagonal cumulation',
      tolerance: 0.10,
      cumulation: ['EU', 'EFTA', 'Turkey', 'Western Balkans', 'Mediterranean'],
      regionalValueContent: 0.45
    },
    effectiveDate: '1997-01-01',
    documentRequired: true
  }
};

// Reglas de origen por capítulo TARIC (simplificadas)
const ORIGIN_RULES_BY_CHAPTER = {
  // Ejemplo: Productos agrícolas
  '01-24': {
    rule: 'WO', // Wholly Obtained
    description: 'Wholly obtained in a single country'
  },

  // Textiles y confección
  '50-63': {
    rule: 'CC', // Change of Chapter
    description: 'All non-originating materials must undergo change of tariff chapter',
    additional: 'May require two-stage processing'
  },

  // Productos químicos
  '28-38': {
    rule: 'CTH', // Change of Tariff Heading
    description: 'Change of tariff heading + maxNM 50%',
    valueAdded: 0.50
  },

  // Maquinaria y electrónica
  '84-85': {
    rule: 'RVC', // Regional Value Content
    description: 'RVC 45% minimum',
    valueAdded: 0.45
  },

  // Vehículos
  '87': {
    rule: 'RVC',
    description: 'RVC 45% minimum + specific rules for engines',
    valueAdded: 0.45,
    additional: 'Engine and transmission must be originating'
  }
};

class PreferencesService {
  constructor() {
    logger.info('[PreferencesService] Initialized');
  }

  /**
   * Determinar si una operación califica para preferencias
   * @param {Object} operation - Datos de la operación
   * @returns {Object} Análisis de elegibilidad preferencial
   */
  async checkEligibility(operation) {
    logger.info(`[PreferencesService] Checking eligibility for origin: ${operation.originCountry}`);

    const result = {
      eligible: false,
      agreements: [],
      recommended: null,
      savings: 0,
      requirements: [],
      warnings: []
    };

    try {
      // Buscar acuerdos aplicables
      const applicableAgreements = this.findApplicableAgreements(operation.originCountry);

      if (applicableAgreements.length === 0) {
        result.warnings.push({
          code: 'NO_AGREEMENTS',
          message: `No hay acuerdos preferenciales con ${operation.originCountry}`
        });
        return result;
      }

      // Evaluar cada acuerdo
      for (const agreement of applicableAgreements) {
        const evaluation = await this.evaluateAgreement(operation, agreement);

        if (evaluation.qualifies) {
          result.eligible = true;
          result.agreements.push({
            name: agreement.name,
            type: agreement.type,
            certificate: agreement.certificate,
            savings: evaluation.savings,
            qualifies: true,
            conditions: evaluation.conditions
          });
        }
      }

      // Recomendar mejor acuerdo
      if (result.agreements.length > 0) {
        result.recommended = result.agreements.reduce((best, current) =>
          current.savings > best.savings ? current : best
        );

        result.savings = result.recommended.savings;
        result.requirements = this.getRequirements(result.recommended);
      }

    } catch (error) {
      logger.error('[PreferencesService] Error in checkEligibility:', error);
      result.warnings.push({
        code: 'ERROR',
        message: error.message
      });
    }

    return result;
  }

  /**
   * Encontrar acuerdos aplicables para un país
   */
  findApplicableAgreements(countryCode) {
    const agreements = [];

    for (const [key, agreement] of Object.entries(PREFERENTIAL_AGREEMENTS)) {
      if (agreement.countries.includes(countryCode)) {
        agreements.push({ key, ...agreement });
      }
    }

    return agreements;
  }

  /**
   * Evaluar si operación califica bajo un acuerdo específico
   */
  async evaluateAgreement(operation, agreement) {
    const evaluation = {
      qualifies: false,
      savings: 0,
      conditions: [],
      issues: []
    };

    // 1. Verificar reglas de origen
    const originCheck = this.checkOriginRules(operation, agreement);

    if (!originCheck.complies) {
      evaluation.issues.push(...originCheck.issues);
      return evaluation;
    }

    evaluation.conditions.push(...originCheck.conditions);

    // 2. Calcular ahorro arancelario
    const standardDuty = this.calculateStandardDuty(operation);
    const preferentialDuty = standardDuty * agreement.preferentialRate;
    evaluation.savings = standardDuty - preferentialDuty;

    // 3. Verificar cumplimiento documental
    if (agreement.documentRequired) {
      evaluation.conditions.push({
        type: 'document',
        required: agreement.certificate,
        description: `Debe proporcionar ${agreement.certificate} válido`
      });
    }

    evaluation.qualifies = evaluation.issues.length === 0;

    return evaluation;
  }

  /**
   * Verificar reglas de origen
   */
  checkOriginRules(operation, agreement) {
    const check = {
      complies: true,
      conditions: [],
      issues: []
    };

    for (const good of operation.goods || []) {
      const chapter = good.taricCode?.substring(0, 2);

      // Obtener regla específica para el capítulo
      const rule = this.getOriginRule(chapter);

      // Verificar contenido regional de valor (RVC)
      if (rule?.valueAdded && good.originBreakdown) {
        const originatingValue = good.originBreakdown.originatingMaterials || 0;
        const totalValue = good.customsValue || 0;
        const rvc = originatingValue / totalValue;

        if (rvc < agreement.originRules.regionalValueContent) {
          check.complies = false;
          check.issues.push({
            good: good.description,
            issue: 'Insufficient regional value content',
            required: `${agreement.originRules.regionalValueContent * 100}%`,
            actual: `${(rvc * 100).toFixed(1)}%`
          });
        } else {
          check.conditions.push({
            type: 'rvc',
            good: good.description,
            value: `${(rvc * 100).toFixed(1)}%`,
            status: 'complies'
          });
        }
      }

      // Verificar tolerancia de materiales no originarios
      if (good.nonOriginatingContent) {
        const tolerance = good.nonOriginatingContent / (good.customsValue || 1);
        if (tolerance > agreement.originRules.tolerance) {
          check.issues.push({
            good: good.description,
            issue: 'Exceeds tolerance for non-originating materials',
            tolerance: `${agreement.originRules.tolerance * 100}%`,
            actual: `${(tolerance * 100).toFixed(1)}%`
          });
        }
      }
    }

    return check;
  }

  /**
   * Obtener regla de origen para un capítulo TARIC
   */
  getOriginRule(chapter) {
    // Buscar regla específica (simplificado)
    for (const [range, rule] of Object.entries(ORIGIN_RULES_BY_CHAPTER)) {
      if (range.includes('-')) {
        const [start, end] = range.split('-').map(Number);
        const chapterNum = parseInt(chapter);
        if (chapterNum >= start && chapterNum <= end) {
          return rule;
        }
      }
    }

    return {
      rule: 'CC',
      description: 'Change of Chapter',
      valueAdded: 0.45
    };
  }

  /**
   * Calcular arancel estándar (sin preferencias)
   */
  calculateStandardDuty(operation) {
    let totalDuty = 0;

    for (const good of operation.goods || []) {
      const rate = this.getStandardRate(good.taricCode);
      const dutyAmount = (good.customsValue || 0) * rate;
      totalDuty += dutyAmount;
    }

    return totalDuty;
  }

  /**
   * Obtener tasa arancelaria estándar
   */
  getStandardRate(taricCode) {
    if (!taricCode) return 0.05;

    const chapter = taricCode.substring(0, 2);

    const rates = {
      '01': 0.15, '02': 0.15, '03': 0.12, '04': 0.15,
      '07': 0.14, '08': 0.12,
      '50': 0.12, '61': 0.12, '62': 0.12,
      '84': 0.03, '85': 0.03,
      '87': 0.10
    };

    return rates[chapter] || 0.05;
  }

  /**
   * Obtener requisitos para aplicar preferencia
   */
  getRequirements(agreement) {
    const requirements = [];

    // Certificado de origen
    requirements.push({
      type: 'certificate',
      name: agreement.certificate,
      description: `Certificado de origen válido: ${agreement.certificate}`,
      mandatory: true,
      validityPeriod: '10 meses desde emisión'
    });

    // Factura
    requirements.push({
      type: 'invoice',
      name: 'Commercial Invoice',
      description: 'Factura comercial con referencia al origen',
      mandatory: true
    });

    // Declaración del exportador (si aplica)
    if (agreement.certificate.includes('Statement')) {
      requirements.push({
        type: 'declaration',
        name: 'Statement on Origin',
        description: 'Declaración en factura o documento comercial',
        mandatory: true,
        thresholdEUR: agreement.type === 'FTA' ? 6000 : null
      });
    }

    // Documentación de soporte
    requirements.push({
      type: 'supporting_docs',
      name: 'Origin Supporting Documents',
      description: 'BOM, facturas de materiales, certificados de proveedores',
      mandatory: false,
      reason: 'Para verificación posterior'
    });

    return requirements;
  }

  /**
   * Validar certificado de origen
   */
  async validateCertificate(certificate) {
    const validation = {
      valid: false,
      issues: [],
      warnings: []
    };

    try {
      // Verificar tipo de certificado
      const validTypes = ['EUR.1', 'EUR-MED', 'Form A', 'Statement on Origin', 'ATR'];
      if (!validTypes.includes(certificate.type)) {
        validation.issues.push({
          field: 'type',
          message: `Tipo de certificado no válido: ${certificate.type}`
        });
      }

      // Verificar fechas
      const issuedDate = new Date(certificate.issuedDate);
      const now = new Date();
      const tenMonthsAgo = new Date(now.setMonth(now.getMonth() - 10));

      if (issuedDate < tenMonthsAgo) {
        validation.issues.push({
          field: 'issuedDate',
          message: 'Certificado expirado (>10 meses desde emisión)'
        });
      }

      // Verificar campos obligatorios
      const requiredFields = ['exporterName', 'consigneeName', 'originCountry', 'certificateNumber'];
      for (const field of requiredFields) {
        if (!certificate[field]) {
          validation.issues.push({
            field,
            message: `Campo obligatorio faltante: ${field}`
          });
        }
      }

      // Verificar formato de número de certificado
      if (certificate.certificateNumber) {
        if (certificate.type === 'EUR.1' && !/^[A-Z]{2}\d{6}$/.test(certificate.certificateNumber)) {
          validation.warnings.push({
            field: 'certificateNumber',
            message: 'Formato de número EUR.1 no estándar'
          });
        }
      }

      validation.valid = validation.issues.length === 0;

    } catch (error) {
      logger.error('[PreferencesService] Error validating certificate:', error);
      validation.issues.push({
        field: 'general',
        message: error.message
      });
    }

    return validation;
  }

  /**
   * Generar recomendaciones de optimización
   */
  async generateOptimizationRecommendations(operation) {
    const recommendations = [];

    // 1. Verificar si hay acuerdos no utilizados
    const eligibility = await this.checkEligibility(operation);

    if (eligibility.eligible && eligibility.savings > 0) {
      recommendations.push({
        type: 'preference',
        priority: 'high',
        savings: eligibility.savings,
        action: `Aplicar ${eligibility.recommended.name}`,
        requirements: eligibility.requirements.map(r => r.name)
      });
    }

    // 2. Evaluar acumulación diagonal
    if (operation.materials && operation.materials.length > 0) {
      const cumulationOpportunity = this.checkCumulationOpportunity(operation);
      if (cumulationOpportunity) {
        recommendations.push({
          type: 'cumulation',
          priority: 'medium',
          description: 'Posible acumulación diagonal de origen',
          action: cumulationOpportunity.action
        });
      }
    }

    // 3. Umbral de certificación
    const customsValue = operation.goods?.reduce((sum, g) => sum + (g.customsValue || 0), 0) || 0;
    if (customsValue < 6000) {
      recommendations.push({
        type: 'documentation',
        priority: 'low',
        description: 'Valor bajo 6000 EUR',
        action: 'Puede usar declaración en factura en lugar de EUR.1'
      });
    }

    return recommendations;
  }

  /**
   * Verificar oportunidades de acumulación de origen
   */
  checkCumulationOpportunity(operation) {
    // Simplificado - detectar si materiales provienen de zona de acumulación
    const agreement = this.findApplicableAgreements(operation.originCountry)[0];

    if (!agreement || !agreement.originRules.cumulation) {
      return null;
    }

    const cumulationZone = agreement.originRules.cumulation;

    return {
      zone: cumulationZone.join(', '),
      action: `Verificar si materiales provienen de: ${cumulationZone.join(', ')}`
    };
  }

  /**
   * Obtener información de acuerdo específico
   */
  getAgreementInfo(agreementKey) {
    const agreement = PREFERENTIAL_AGREEMENTS[agreementKey];

    if (!agreement) {
      return null;
    }

    return {
      ...agreement,
      key: agreementKey,
      coverage: {
        countries: agreement.countries.length,
        tariffLines: 'All (with product-specific rules)'
      }
    };
  }

  /**
   * Listar todos los acuerdos disponibles
   */
  getAllAgreements() {
    return Object.keys(PREFERENTIAL_AGREEMENTS).map(key => ({
      key,
      name: PREFERENTIAL_AGREEMENTS[key].name,
      type: PREFERENTIAL_AGREEMENTS[key].type,
      countries: PREFERENTIAL_AGREEMENTS[key].countries.length,
      certificate: PREFERENTIAL_AGREEMENTS[key].certificate
    }));
  }
}

module.exports = new PreferencesService();
