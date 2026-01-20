/**
 * Rules Engine - Motor de Reglas Aduaneras
 * Determina automaticamente todos los requisitos para una operacion
 * basandose en: origen, destino, TARIC, valor, tipo de operacion
 *
 * Stock Logistic - LUCI Customs Agent
 */

const logger = require('../config/logger');
const exciseDutiesService = require('./exciseDutiesService');
const quotaService = require('./quotaService');
const preferencesService = require('./preferencesService');

// Tratados de Libre Comercio y Preferencias
const FTA_AGREEMENTS = {
  // Acuerdos UE vigentes 2024-2026
  'CETA': { countries: ['CA'], type: 'fta', origin_rules: 'product_specific' },
  'JEFTA': { countries: ['JP'], type: 'fta', origin_rules: 'product_specific' },
  'EU-UK': { countries: ['GB'], type: 'fta', origin_rules: 'product_specific' },
  'EU-MERCOSUR': { countries: ['AR', 'BR', 'UY', 'PY'], type: 'fta', origin_rules: 'regional' },
  'EU-MEXICO': { countries: ['MX'], type: 'fta', origin_rules: 'product_specific' },
  'EU-CHILE': { countries: ['CL'], type: 'fta', origin_rules: 'product_specific' },
  'EU-KOREA': { countries: ['KR'], type: 'fta', origin_rules: 'product_specific' },
  'EU-VIETNAM': { countries: ['VN'], type: 'fta', origin_rules: 'product_specific' },
  'GSP': {
    countries: ['IN', 'PK', 'BD', 'LK', 'PH', 'ID', 'TH', 'KH', 'LA', 'MM', 'NP', 'BO', 'CO', 'EC', 'PE', 'VE', 'EG', 'MA', 'TN', 'DZ', 'NG', 'GH', 'KE', 'TZ', 'UG'],
    type: 'gsp',
    origin_rules: 'simple'
  },
  'GSP_PLUS': {
    countries: ['PK', 'BD', 'LK', 'PH', 'KH', 'LA', 'BO', 'CO', 'EC', 'PE', 'VE'],
    type: 'gsp_plus',
    origin_rules: 'simple'
  },
  'EBA': {
    countries: ['BD', 'KH', 'LA', 'MM', 'NP', 'AF', 'YE', 'SD', 'ET', 'UG', 'TZ', 'RW', 'BI', 'MZ', 'MW', 'ZM'],
    type: 'eba',
    origin_rules: 'simple'
  }
};

// Paises con medidas restrictivas o sanciones
const SANCTIONED_COUNTRIES = {
  'KP': { level: 'total', reason: 'Corea del Norte - embargo total ONU' },
  'IR': { level: 'sectorial', reason: 'Iran - sanciones sectoriales' },
  'SY': { level: 'total', reason: 'Siria - embargo total UE' },
  'RU': { level: 'sectorial', reason: 'Rusia - sanciones por conflicto Ucrania' },
  'BY': { level: 'sectorial', reason: 'Bielorrusia - sanciones UE' },
  'VE': { level: 'parcial', reason: 'Venezuela - sanciones parciales' },
  'MM': { level: 'parcial', reason: 'Myanmar - sanciones parciales' }
};

// Productos de doble uso (exportacion controlada)
const DUAL_USE_CHAPTERS = ['28', '29', '30', '84', '85', '90', '93'];

// Productos prohibidos/restringidos por TARIC
const RESTRICTED_PRODUCTS = {
  // Armas y municiones
  '93': { restriction: 'prohibited', authority: 'Defensa', permit: 'required' },

  // Explosivos
  '3601': { restriction: 'prohibited', authority: 'Industria', permit: 'required' },
  '3602': { restriction: 'prohibited', authority: 'Industria', permit: 'required' },

  // Drogas y estupefacientes
  '1211': { restriction: 'controlled', authority: 'AEMPS', permit: 'conditional' },
  '2939': { restriction: 'controlled', authority: 'AEMPS', permit: 'required' },

  // Productos químicos peligrosos
  '2804': { restriction: 'controlled', authority: 'MITERD', permit: 'conditional' },
  '2811': { restriction: 'controlled', authority: 'MITERD', permit: 'conditional' },

  // Residuos
  '3825': { restriction: 'controlled', authority: 'MITERD', permit: 'required' }
};

class RulesEngine {
  constructor() {
    logger.info('[RulesEngine] Initialized');
  }

  /**
   * Analisis completo de una operacion
   * @param {Object} operation - Datos de la operacion
   * @returns {Object} Analisis completo con todos los requisitos
   */
  async analyzeOperation(operation) {
    logger.info(`[RulesEngine] Analyzing operation: ${operation.type} from ${operation.originCountry}`);

    const analysis = {
      operationId: operation.id,
      timestamp: new Date(),
      summary: {
        eligible: true,
        alerts: [],
        warnings: [],
        requirements: []
      },
      tariff: null,
      preferences: null,
      quotas: [],
      controls: {
        customs: [],
        paracustoms: [],
        sanctions: null,
        dual_use: null
      },
      taxes: {
        tariff: null,
        vat: null,
        excise: null,
        total: null
      },
      documentation: [],
      permits: [],
      recommendations: []
    };

    try {
      // 1. Verificar sanciones
      const sanctionsCheck = this.checkSanctions(operation.originCountry);
      if (sanctionsCheck.sanctioned) {
        analysis.controls.sanctions = sanctionsCheck;
        analysis.summary.eligible = false;
        analysis.summary.alerts.push({
          severity: 'critical',
          code: 'SANCTIONS',
          message: sanctionsCheck.reason
        });
      }

      // 2. Verificar productos prohibidos/restringidos
      for (const good of operation.goods || []) {
        const restriction = this.checkRestrictions(good.taricCode);
        if (restriction.restricted) {
          analysis.permits.push({
            type: restriction.restriction,
            authority: restriction.authority,
            required: restriction.permit === 'required',
            taricCode: good.taricCode,
            description: good.description
          });

          if (restriction.restriction === 'prohibited') {
            analysis.summary.eligible = false;
            analysis.summary.alerts.push({
              severity: 'critical',
              code: 'PROHIBITED',
              message: `Producto ${good.description} prohibido - TARIC ${good.taricCode}`
            });
          }
        }
      }

      // 3. Verificar doble uso (si es exportacion)
      if (operation.type === 'export') {
        const dualUse = this.checkDualUse(operation.goods);
        if (dualUse.isDualUse) {
          analysis.controls.dual_use = dualUse;
          analysis.summary.warnings.push({
            severity: 'high',
            code: 'DUAL_USE',
            message: 'Producto de doble uso - requiere licencia de exportacion'
          });
        }
      }

      // 4. Calcular aranceles aplicables
      if (operation.type === 'import') {
        analysis.tariff = await this.calculateTariff(operation);
        analysis.taxes = await this.calculateTaxes(operation, analysis.tariff);
      }

      // 5. Verificar preferencias arancelarias (usando preferencesService completo)
      if (operation.type === 'import') {
        try {
          const eligibility = await preferencesService.checkEligibility(operation);

          analysis.preferences = {
            available: eligibility.eligible,
            agreements: eligibility.agreements,
            recommended: eligibility.recommended,
            certificate: eligibility.recommended?.certificate || (eligibility.agreements[0]?.certificate),
            preferential: 0,
            savings: eligibility.savings || 0,
            requirements: eligibility.requirements || [],
            warnings: eligibility.warnings || []
          };

          if (analysis.preferences.available && analysis.preferences.savings > 0) {
            analysis.summary.recommendations.push({
              type: 'cost_saving',
              message: `Preferencia arancelaria disponible: ahorro de ${analysis.preferences.savings.toFixed(2)} EUR`,
              action: 'Solicitar certificado ' + analysis.preferences.certificate,
              agreement: analysis.preferences.recommended?.name
            });
          }

          // Add any warnings from preferences check
          for (const warning of eligibility.warnings || []) {
            analysis.summary.warnings.push({
              severity: 'medium',
              code: warning.code || 'PREFERENCE_WARNING',
              message: warning.message
            });
          }
        } catch (prefError) {
          logger.warn('[RulesEngine] Error checking preferences:', prefError.message);
          // Fallback to simple check
          analysis.preferences = this.checkPreferences(operation);
        }
      }

      // 5.5. Verificar contingentes arancelarios
      if (operation.type === 'import') {
        for (const good of operation.goods || []) {
          const quotaCheck = quotaService.checkQuotaAvailability(
            good.taricCode,
            operation.originCountry,
            good.quantity || 0,
            good.unit || 'kg'
          );

          if (quotaCheck.found && quotaCheck.quotas.length > 0) {
            analysis.quotas.push(...quotaCheck.quotas.map(q => ({
              ...q,
              product: good.description,
              taricCode: good.taricCode
            })));

            // Recomendar uso de contingente si hay ahorro significativo
            const bestQuota = quotaCheck.quotas[0];
            if (bestQuota.available && bestQuota.duty.savings > 0.01) {
              const savingsCalc = quotaService.calculateQuotaSavings(
                good.taricCode,
                operation.originCountry,
                good.quantity || 0,
                good.customsValue || 0
              );

              if (savingsCalc.applicable) {
                analysis.summary.recommendations.push({
                  type: 'quota_savings',
                  message: savingsCalc.recommendation,
                  quota: bestQuota.orderNumber,
                  savings: savingsCalc.savings
                });
              }
            }

            // Alertar si contingente está crítico
            if (bestQuota.critical) {
              analysis.summary.warnings.push({
                severity: 'medium',
                code: 'QUOTA_CRITICAL',
                message: `Contingente ${bestQuota.orderNumber} en estado crítico (${bestQuota.volume.utilizationPercent}% utilizado)`
              });
            }
          }
        }
      }

      // 6. Determinar controles paraduaneros
      analysis.controls.paracustoms = await this.determineParacustomsControls(operation);

      // 7. Documentacion requerida
      analysis.documentation = this.determineDocumentation(operation, analysis);

      // 8. Generar resumen de requisitos
      analysis.summary.requirements = this.generateRequirementsSummary(analysis);

      logger.info(`[RulesEngine] Analysis complete: ${analysis.summary.requirements.length} requirements`);

    } catch (error) {
      logger.error('[RulesEngine] Error in analysis:', error);
      analysis.summary.alerts.push({
        severity: 'error',
        code: 'ANALYSIS_ERROR',
        message: error.message
      });
    }

    return analysis;
  }

  /**
   * Verificar si pais tiene sanciones
   */
  checkSanctions(countryCode) {
    const sanction = SANCTIONED_COUNTRIES[countryCode];

    if (!sanction) {
      return { sanctioned: false };
    }

    return {
      sanctioned: true,
      country: countryCode,
      level: sanction.level,
      reason: sanction.reason,
      action: sanction.level === 'total' ? 'block_operation' : 'require_authorization'
    };
  }

  /**
   * Verificar productos restringidos
   */
  checkRestrictions(taricCode) {
    if (!taricCode) {
      return { restricted: false };
    }

    const chapter = taricCode.substring(0, 2);
    const heading = taricCode.substring(0, 4);

    // Verificar por codigo especifico
    if (RESTRICTED_PRODUCTS[heading]) {
      return {
        restricted: true,
        ...RESTRICTED_PRODUCTS[heading]
      };
    }

    // Verificar por capitulo
    if (RESTRICTED_PRODUCTS[chapter]) {
      return {
        restricted: true,
        ...RESTRICTED_PRODUCTS[chapter]
      };
    }

    return { restricted: false };
  }

  /**
   * Verificar productos de doble uso
   */
  checkDualUse(goods) {
    const dualUseGoods = [];

    for (const good of goods || []) {
      const chapter = good.taricCode?.substring(0, 2);
      if (DUAL_USE_CHAPTERS.includes(chapter)) {
        dualUseGoods.push({
          taricCode: good.taricCode,
          description: good.description,
          chapter
        });
      }
    }

    return {
      isDualUse: dualUseGoods.length > 0,
      goods: dualUseGoods,
      requiresLicense: dualUseGoods.length > 0,
      authority: 'MINCOTUR',
      licenseType: 'Dual Use Export License'
    };
  }

  /**
   * Calcular arancel aplicable
   */
  async calculateTariff(operation) {
    const tariff = {
      standard: 0,
      preferential: 0,
      applied: 0,
      savings: 0,
      currency: 'EUR'
    };

    // Calcular arancel estandar (simplificado)
    for (const good of operation.goods || []) {
      const rate = this.getTariffRate(good.taricCode);
      const dutyAmount = (good.customsValue || 0) * rate;
      tariff.standard += dutyAmount;
    }

    tariff.applied = tariff.standard;
    return tariff;
  }

  /**
   * Obtener tasa arancelaria por TARIC (simplificado)
   */
  getTariffRate(taricCode) {
    if (!taricCode) return 0.05;

    const chapter = taricCode.substring(0, 2);

    // Tasas simplificadas por capitulo
    const rates = {
      '01': 0.15, '02': 0.15, '03': 0.12, '04': 0.15,
      '07': 0.14, '08': 0.12, '09': 0.09,
      '50': 0.12, '51': 0.12, '52': 0.12, '61': 0.12, '62': 0.12,
      '84': 0.03, '85': 0.03, '90': 0.03,
      '87': 0.10
    };

    return rates[chapter] || 0.05;
  }

  /**
   * Calcular impuestos (IVA, excise)
   */
  async calculateTaxes(operation, tariff) {
    const customsValue = operation.goods.reduce((sum, g) => sum + (g.customsValue || 0), 0);
    const taxableBase = customsValue + tariff.applied;

    // Calcular impuestos especiales usando el servicio completo
    const exciseDuties = exciseDutiesService.calculateTotalExciseDuties(operation.goods || []);

    const taxes = {
      customsValue,
      tariff: tariff.applied,
      taxableBase,
      vat: {
        rate: 0.21,
        amount: taxableBase * 0.21
      },
      excise: {
        applicable: exciseDuties.total > 0,
        amount: exciseDuties.total,
        breakdown: exciseDuties.byCategory,
        items: exciseDuties.items
      },
      total: 0
    };

    taxes.total = tariff.applied + taxes.vat.amount + taxes.excise.amount;

    return taxes;
  }

  /**
   * Verificar impuestos especiales (delegado al servicio completo)
   */
  checkExciseDuty(taricCode) {
    return exciseDutiesService.detectExciseProduct(taricCode);
  }

  /**
   * Verificar preferencias arancelarias disponibles
   */
  checkPreferences(operation) {
    const origin = operation.originCountry;
    const preferences = {
      available: false,
      agreements: [],
      certificate: null,
      preferential: 0,
      savings: 0
    };

    // Buscar acuerdos aplicables
    for (const [name, agreement] of Object.entries(FTA_AGREEMENTS)) {
      if (agreement.countries.includes(origin)) {
        preferences.available = true;
        preferences.agreements.push({
          name,
          type: agreement.type,
          originRules: agreement.origin_rules
        });

        // Determinar certificado necesario
        preferences.certificate = this.getCertificateType(agreement.type);
      }
    }

    return preferences;
  }

  /**
   * Obtener tipo de certificado de origen
   */
  getCertificateType(agreementType) {
    const certificates = {
      'fta': 'EUR.1 / Statement on Origin',
      'gsp': 'Form A',
      'gsp_plus': 'Form A',
      'eba': 'Form A (EBA)',
      'pan_euro_med': 'EUR.1 / EUR-MED'
    };

    return certificates[agreementType] || 'EUR.1';
  }

  /**
   * Determinar controles paraduaneros
   */
  async determineParacustomsControls(operation) {
    const controls = [];

    for (const good of operation.goods || []) {
      const chapter = good.taricCode?.substring(0, 2);

      // Controles veterinarios (capitulos 01-05)
      if (['01', '02', '03', '04', '05'].includes(chapter)) {
        controls.push({
          type: 'veterinary',
          authority: 'MAPA',
          required: true,
          documents: ['C620 - Certificado Veterinario', 'N851 - DVCE'],
          taricCode: good.taricCode
        });
      }

      // Controles fitosanitarios (capitulos 06-14)
      if (['06', '07', '08', '10', '12'].includes(chapter)) {
        controls.push({
          type: 'phytosanitary',
          authority: 'MAPA',
          required: true,
          documents: ['C633 - Certificado Fitosanitario'],
          taricCode: good.taricCode
        });
      }

      // Controles sanitarios (alimentos procesados)
      if (['16', '19', '20', '21'].includes(chapter)) {
        controls.push({
          type: 'food_safety',
          authority: 'SANIDAD',
          required: true,
          documents: ['C620 - Certificado Sanitario'],
          taricCode: good.taricCode
        });
      }

      // Productos industriales (SOIVRE)
      if (['84', '85', '95'].includes(chapter)) {
        controls.push({
          type: 'industrial',
          authority: 'SOIVRE',
          required: false,
          documents: ['C057 - Declaracion CE Conformidad'],
          taricCode: good.taricCode
        });
      }
    }

    // Eliminar duplicados
    const uniqueControls = controls.filter((control, index, self) =>
      index === self.findIndex(c => c.type === control.type && c.authority === control.authority)
    );

    return uniqueControls;
  }

  /**
   * Determinar documentacion requerida
   */
  determineDocumentation(operation, analysis) {
    const docs = [];

    // Documentacion basica siempre requerida
    docs.push(
      { code: 'N380', name: 'Factura Comercial', mandatory: true },
      { code: 'N703', name: 'BL/AWB', mandatory: true },
      { code: 'N730', name: 'Packing List', mandatory: true }
    );

    // Certificado de origen si hay preferencias
    if (analysis.preferences?.available) {
      docs.push({
        code: 'C501',
        name: analysis.preferences.certificate,
        mandatory: false,
        benefit: 'Reduccion arancelaria'
      });
    }

    // Documentos de controles paraduaneros
    for (const control of analysis.controls.paracustoms || []) {
      for (const doc of control.documents || []) {
        docs.push({
          code: doc.split(' - ')[0],
          name: doc.split(' - ')[1],
          mandatory: control.required,
          authority: control.authority
        });
      }
    }

    // Permisos especiales
    for (const permit of analysis.permits || []) {
      docs.push({
        code: 'C990',
        name: `Permiso ${permit.authority}`,
        mandatory: permit.required,
        authority: permit.authority
      });
    }

    return docs;
  }

  /**
   * Generar resumen de requisitos
   */
  generateRequirementsSummary(analysis) {
    const requirements = [];

    // Requisitos de documentacion
    const mandatoryDocs = analysis.documentation.filter(d => d.mandatory);
    if (mandatoryDocs.length > 0) {
      requirements.push({
        category: 'documentation',
        count: mandatoryDocs.length,
        items: mandatoryDocs.map(d => d.name)
      });
    }

    // Controles paraduaneros
    if (analysis.controls.paracustoms.length > 0) {
      requirements.push({
        category: 'paracustoms_controls',
        count: analysis.controls.paracustoms.length,
        items: analysis.controls.paracustoms.map(c => `${c.authority} - ${c.type}`)
      });
    }

    // Permisos especiales
    const mandatoryPermits = analysis.permits.filter(p => p.required);
    if (mandatoryPermits.length > 0) {
      requirements.push({
        category: 'permits',
        count: mandatoryPermits.length,
        items: mandatoryPermits.map(p => `${p.authority} - ${p.type}`)
      });
    }

    // Impuestos especiales
    if (analysis.taxes?.excise?.applicable) {
      requirements.push({
        category: 'excise_duties',
        count: 1,
        items: [`IIEE - ${analysis.taxes.excise.type}`]
      });
    }

    return requirements;
  }

  /**
   * Obtener acuerdos comerciales aplicables a un pais
   */
  getApplicableAgreements(countryCode) {
    const agreements = [];

    for (const [name, agreement] of Object.entries(FTA_AGREEMENTS)) {
      if (agreement.countries.includes(countryCode)) {
        agreements.push({
          name,
          type: agreement.type,
          certificate: this.getCertificateType(agreement.type)
        });
      }
    }

    return agreements;
  }

  /**
   * Validar si operacion cumple requisitos
   */
  validateCompliance(operation, providedDocuments = []) {
    const analysis = this.analyzeOperation(operation);
    const compliance = {
      compliant: true,
      missing: [],
      warnings: []
    };

    // Verificar documentos obligatorios
    const mandatoryDocs = analysis.documentation.filter(d => d.mandatory);
    for (const doc of mandatoryDocs) {
      if (!providedDocuments.includes(doc.code)) {
        compliance.compliant = false;
        compliance.missing.push({
          type: 'document',
          code: doc.code,
          name: doc.name
        });
      }
    }

    // Verificar permisos obligatorios
    const mandatoryPermits = analysis.permits.filter(p => p.required);
    for (const permit of mandatoryPermits) {
      compliance.missing.push({
        type: 'permit',
        authority: permit.authority,
        reason: permit.type
      });
    }

    return compliance;
  }
}

module.exports = new RulesEngine();
