/**
 * Preferential Tariffs Service
 * Gestión de preferencias arancelarias: EUR.1, Form A, ATR, acumulación origen
 *
 * STRIX AI - LUCI Customs Agent
 */

const logger = require('../config/logger');
const { consultarArancelIntegrado } = require('./aeat/arancelIntegrado');
const { tiposAeat } = require('./aeat/contrasteArancel');

/** Importe en euros redondeado a centimos. */
const redondear = (n) => Math.round(n * 100) / 100;

// Base de datos de acuerdos preferenciales (simplificada para demo)
const PREFERENTIAL_AGREEMENTS = {
  // Acuerdos de Libre Comercio (FTA)
  'EU-UK': {
    name: 'EU-UK Trade and Cooperation Agreement',
    type: 'FTA',
    countries: ['GB'],
    certificate: 'Statement on Origin',
    proofKind: 'exporter_declaration',
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
    // AEAT, Acuerdos_UE.pdf (Canada): "texto de la declaracion de origen en
    // Anexo 2 del Protocolo". El CETA no tiene EUR.1.
    certificate: 'Declaración de origen del exportador (Anexo 2 del Protocolo de origen)',
    proofKind: 'exporter_declaration',
    legalBasis: 'Decisión (UE) 2017/37 (DOUE L 11 de 14-1-2017), Protocolo sobre normas de origen',
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
    // AEAT, Acuerdos_UE.pdf (Japon): "declaracion de origen REX (Anexo 3D)" y
    // NI GA 05/2019 sobre el conocimiento del importador. El AAE UE-Japon no usa
    // EUR.1 (UAT 16/Nov/2026).
    certificate: 'Declaración de origen (statement on origin, Anexo 3-D) o conocimiento del importador',
    proofKind: 'exporter_declaration',
    legalBasis: 'Decisión (UE) 2018/1907 (DOUE L 330 de 27-12-2018), capítulo 3 y Anexo 3-D',
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
    // El acuerdo modernizado no esta en vigor: la AEAT solo recoge la Decision 2/2000.
    name: 'EU-Mexico Free Trade Agreement (Decision 2/2000)',
    type: 'FTA',
    countries: ['MX'],
    certificate: 'EUR.1 / Statement on Origin',
    proofKind: 'certificate',
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
    proofKind: 'certificate',
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
    proofKind: 'certificate',
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
    // AEAT, Acuerdos_UE.pdf (Chile): el Acuerdo Interino de Comercio UE-Chile
    // (DOUE L 2024/2953) esta en vigor desde el 1-2-2025 y sustituye al Acuerdo de
    // Asociacion de 2003. La prueba de origen es la declaracion de origen del
    // exportador; el EUR.1 ya no es necesario (UAT 16/Nov/2026).
    name: 'EU-Chile Interim Trade Agreement',
    type: 'FTA',
    countries: ['CL'],
    certificate: 'Declaración de origen del exportador en factura u otro documento comercial, con su número de exportador registrado',
    proofKind: 'exporter_declaration',
    legalBasis: 'Acuerdo Interino de Comercio UE-Chile (DOUE L 2024/2953), en vigor el 1-2-2025 (DOUE L 2025/67)',
    originRules: {
      general: 'Product-specific rules',
      tolerance: 0.10,
      cumulation: ['EU', 'CL'],
      regionalValueContent: 0.40
    },
    effectiveDate: '2025-02-01',
    documentRequired: true
  },

  // Sistema de Preferencias Generalizadas (GSP)
  'GSP': {
    name: 'Generalized System of Preferences',
    type: 'GSP',
    countries: ['IN', 'PK', 'TH', 'ID', 'MA', 'TN', 'EG', 'NG', 'GH', 'KE'],
    certificate: 'Form A',
    proofKind: 'certificate',
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
    proofKind: 'certificate',
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
    proofKind: 'certificate',
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
    // Turquia no va aqui: es una union aduanera con A.TR (ver EU-TURKEY).
    countries: ['NO', 'CH', 'IS', 'MK', 'RS', 'ME', 'AL', 'BA', 'XK', 'IL', 'PS', 'JO', 'EG', 'TN', 'MA', 'DZ'],
    certificate: 'EUR.1 / EUR-MED',
    proofKind: 'certificate',
    originRules: {
      general: 'Diagonal cumulation',
      tolerance: 0.10,
      cumulation: ['EU', 'EFTA', 'Turkey', 'Western Balkans', 'Mediterranean'],
      regionalValueContent: 0.45
    },
    effectiveDate: '1997-01-01',
    documentRequired: true
  },

  // AEAT, Acuerdos_UE.pdf (Turquia): union aduanera para industriales con A.TR
  // (Decision 1/95); EUR.1 para productos CECA y agricolas (Decision 1/98).
  'EU-TURKEY': {
    name: 'EU-Turkey Customs Union',
    type: 'CU',
    countries: ['TR'],
    certificate: 'A.TR (productos industriales, unión aduanera) / EUR.1 (productos agrícolas y CECA)',
    proofKind: 'certificate',
    legalBasis: 'Decisión 1/95 del Consejo de Asociación (DOUE L 35 de 13-2-1996); Decisión 1/98 (agrícolas)',
    originRules: {
      general: 'A.TR acredita la libre práctica, no el origen (industriales); EUR.1 con reglas de origen para agrícolas y CECA',
      tolerance: 0.10,
      cumulation: ['EU', 'TR'],
      regionalValueContent: 0.45
    },
    effectiveDate: '1995-12-31',
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
      // Tipos reales del Arancel Integrado de la AEAT para el codigo y el origen
      // (primera mercancia; `rates` lleva el detalle de cada una). null = no se sabe.
      standardRate: null,
      preferentialRate: null,
      preferenceMeasure: null,
      aeatAvailable: false,
      rates: [],
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

      // Tipo general y preferencial reales de la AEAT. Antes cada acuerdo llevaba
      // `preferentialRate: 0` fijo, asi que la pantalla anunciaba 0 % y un ahorro
      // del 100 % del arancel para cualquier codigo, tuviera o no preferencia.
      const tarifa = await this.getAeatRates(operation);
      result.standardRate = tarifa.standardRate;
      result.preferentialRate = tarifa.preferentialRate;
      result.preferenceMeasure = tarifa.preferenceMeasure;
      result.aeatAvailable = tarifa.aeatAvailable;
      result.rates = tarifa.rates;
      result.warnings.push(...tarifa.warnings);

      // Evaluar cada acuerdo
      for (const agreement of applicableAgreements) {
        const evaluation = this.evaluateAgreement(operation, agreement, tarifa);

        if (evaluation.qualifies) {
          result.eligible = true;
          result.agreements.push({
            key: agreement.key,
            name: agreement.name,
            type: agreement.type,
            certificate: agreement.certificate,
            proofKind: agreement.proofKind || 'certificate',
            legalBasis: agreement.legalBasis || null,
            savings: evaluation.savings,
            qualifies: true,
            conditions: evaluation.conditions
          });
        }
      }

      // Si la AEAT contesta que el codigo paga arancel desde ese origen y no hay
      // ninguna preferencia, el acuerdo existe pero no cubre esta mercancia.
      if (tarifa.noPreference) {
        result.eligible = false;
      }

      // Recomendar mejor acuerdo
      if (result.agreements.length > 0) {
        result.recommended = result.agreements.reduce((best, current) =>
          (current.savings || 0) > (best.savings || 0) ? current : best
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
   * Tipos general (medida 103) y preferencial (medidas 1xx del origen) de cada
   * mercancia segun el Arancel Integrado de la AEAT, y el ahorro real.
   * Si la AEAT no responde para alguna mercancia, el ahorro es null (desconocido):
   * nunca se supone un 0 %.
   * @returns {Promise<{standardRate: number|null, preferentialRate: number|null,
   *   preferenceMeasure: string|null, aeatAvailable: boolean, noPreference: boolean,
   *   savings: number|null, rates: object[], warnings: object[]}>}
   */
  async getAeatRates(operation) {
    const origen = String(operation.originCountry || '').toUpperCase();
    const goods = (operation.goods || []).filter(g => g && g.taricCode);
    const rates = [];

    for (const good of goods) {
      rates.push(await this.getAeatRateForGood(good, origen));
    }

    const warnings = rates
      .filter(r => r.error || r.noPreference)
      .map(r => (r.error
        ? {
          code: 'AEAT_NO_DISPONIBLE',
          message: `No se pudo consultar el Arancel Integrado de la AEAT para ${r.taricCode}: ${r.error}. No se calcula el ahorro.`
        }
        : {
          code: 'SIN_PREFERENCIA_AEAT',
          message: `La AEAT no recoge preferencia arancelaria para ${r.taricCode} con origen ${origen}: se aplica el derecho de terceros países (${r.standardRate} %).`
        }));

    const aeatAvailable = rates.length > 0 && rates.every(r => !r.error);
    const savings = aeatAvailable ? redondear(rates.reduce((sum, r) => sum + r.savings, 0)) : null;
    const first = rates[0] || {};

    return {
      standardRate: first.standardRate ?? null,
      preferentialRate: first.preferentialRate ?? null,
      preferenceMeasure: first.preferenceMeasure ?? null,
      aeatAvailable,
      noPreference: aeatAvailable && rates.every(r => r.noPreference),
      savings,
      rates,
      warnings
    };
  }

  /** Consulta la AEAT para una mercancia y calcula su ahorro. */
  async getAeatRateForGood(good, origen) {
    const base = {
      taricCode: good.taricCode,
      standardRate: null,
      preferentialRate: null,
      preferenceMeasure: null,
      savings: null,
      noPreference: false
    };
    let resultado;
    try {
      resultado = await consultarArancelIntegrado({ codigo: good.taricCode, origen });
    } catch (error) {
      logger.warn(`[PreferencesService] Arancel Integrado AEAT no disponible para ${good.taricCode}: ${error.message}`);
      return { ...base, error: error.message };
    }
    if (!resultado?.existe) {
      return { ...base, error: 'el código no existe en el Arancel Integrado' };
    }

    const { general, preferencias } = tiposAeat(resultado);
    if (general === null) {
      return { ...base, error: 'la AEAT no da un derecho de terceros países en porcentaje para este código' };
    }
    // Si hay varias preferencias para el origen, la mas favorable (la agente
    // decide cual aplicar con su prueba de origen).
    const mejor = preferencias.reduce((min, p) => (min === null || p.tipo < min.tipo ? p : min), null);
    if (!mejor) {
      return { ...base, standardRate: general, savings: 0, noPreference: general > 0 };
    }
    const value = Number(good.customsValue) || 0;
    return {
      ...base,
      standardRate: general,
      preferentialRate: mejor.tipo,
      preferenceMeasure: mejor.codigo,
      savings: redondear(Math.max(0, value * (general - mejor.tipo) / 100))
    };
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
   * Evaluar si operación califica bajo un acuerdo específico.
   * El ahorro es el de la AEAT (`tarifa`), no un tipo fijo del acuerdo.
   */
  evaluateAgreement(operation, agreement, tarifa = {}) {
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

    // 2. Ahorro arancelario real (null si la AEAT no ha respondido)
    evaluation.savings = tarifa.savings === undefined ? null : tarifa.savings;
    if (tarifa.preferentialRate !== null && tarifa.preferentialRate !== undefined) {
      evaluation.conditions.push({
        type: 'preferential',
        rate: tarifa.preferentialRate,
        measure: tarifa.preferenceMeasure,
        source: 'AEAT · Arancel Integrado'
      });
    }

    // 3. Verificar cumplimiento documental
    if (agreement.documentRequired) {
      evaluation.conditions.push({
        type: 'document',
        required: agreement.certificate,
        description: `Prueba de origen: ${agreement.certificate}`
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
   * Obtener requisitos para aplicar preferencia
   */
  getRequirements(agreement) {
    const requirements = [];

    // Certificado de origen
    requirements.push({
      type: 'certificate',
      name: agreement.certificate,
      description: `Prueba de origen: ${agreement.certificate}`,
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

    // 3. Umbral de certificación. Solo tiene sentido donde la prueba de origen es un
    // certificado (EUR.1): en CETA, Japon o Chile la prueba ya es una declaracion
    // del exportador y sugerir "en lugar de EUR.1" seria otra vez el error de la UAT.
    const customsValue = operation.goods?.reduce((sum, g) => sum + (g.customsValue || 0), 0) || 0;
    const usaCertificado = eligibility.recommended?.proofKind !== 'exporter_declaration';
    if (customsValue < 6000 && usaCertificado) {
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
