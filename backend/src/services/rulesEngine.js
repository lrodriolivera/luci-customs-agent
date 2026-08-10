/**
 * Rules Engine - Motor de Reglas Aduaneras
 * Determina automaticamente todos los requisitos para una operacion
 * basandose en: origen, destino, TARIC, valor, tipo de operacion
 *
 * STRIX AI - LUCI Customs Agent
 */

const logger = require('../config/logger');
const exciseDutiesService = require('./exciseDutiesService');
const quotaService = require('./quotaService');
const preferencesService = require('./preferencesService');

// Tratados de Libre Comercio y Preferencias - Ref: TARIC S.A.U. Oct 2023 + actualizaciones 2024-2026
// Fuente: Sede AEAT, EUR-Lex, BOE
const FTA_AGREEMENTS = {
  // === ACUERDOS BILATERALES UE ===
  'EU-Albania':       { countries: ['AL'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-Andorra-Agri':  { countries: ['AD'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific', note: 'Solo productos agricolas' },
  'EU-Andorra-Ind':   { countries: ['AD'], type: 'customs_union', proofImport: 'T2L', proofExport: 'T2L', origin_rules: 'customs_union', note: 'Productos industriales' },
  'EU-Algeria':       { countries: ['DZ'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-Bosnia':        { countries: ['BA'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-Cameroon':      { countries: ['CM'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'CETA':             { countries: ['CA'], type: 'fta', proofImport: 'DeclaracionOrigen', proofExport: 'REX', origin_rules: 'product_specific', note: 'Business number del exportador' },
  'EU-CeutaMelilla':  { countries: ['XC', 'XL'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-Chile':         { countries: ['CL'], type: 'fta', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-Colombia':      { countries: ['CO'], type: 'fta', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-Korea':         { countries: ['KR'], type: 'fta', proofImport: 'DeclaracionOrigen', proofExport: 'DeclaracionOrigen', origin_rules: 'product_specific' },
  'EU-CoteDIvoire':   { countries: ['CI'], type: 'bilateral', proofImport: 'REX', proofExport: 'REX', origin_rules: 'product_specific' },
  'EU-Ecuador':       { countries: ['EC'], type: 'fta', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-Egypt':         { countries: ['EG'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-Georgia':       { countries: ['GE'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-Ghana':         { countries: ['GH'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'REX', origin_rules: 'product_specific' },
  'EU-Israel':        { countries: ['IL'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-Jordan':        { countries: ['JO'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'JEFTA':            { countries: ['JP'], type: 'fta', proofImport: 'DeclaracionOrigen', proofExport: 'DeclaracionOrigen', origin_rules: 'product_specific' },
  'EU-Kenya':         { countries: ['KE'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'REX', origin_rules: 'product_specific' },
  'EU-Kosovo':        { countries: ['XK'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-Lebanon':       { countries: ['LB'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-Mexico':        { countries: ['MX'], type: 'fta', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-Moldova':       { countries: ['MD'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-Montenegro':    { countries: ['ME'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-Morocco':       { countries: ['MA'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-NewZealand':    { countries: ['NZ'], type: 'fta', proofImport: 'DeclaracionOrigen', proofExport: 'DeclaracionOrigen', origin_rules: 'product_specific' },
  'EU-NorthMacedonia':{ countries: ['MK'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EEA':              { countries: ['IS', 'LI', 'NO'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific', note: 'Productos industriales y agricolas transformados' },
  'EU-Palestine':     { countries: ['PS'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-Peru':          { countries: ['PE'], type: 'fta', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-Singapore':     { countries: ['SG'], type: 'fta', proofImport: 'DeclaracionOrigen', proofExport: 'DeclaracionOrigen', origin_rules: 'product_specific' },
  'EU-Serbia':        { countries: ['RS'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-SouthAfrica':   { countries: ['ZA', 'BW', 'LS', 'SZ', 'NA', 'MZ'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'regional', note: 'SADC EPA' },
  'EU-Switzerland':   { countries: ['CH'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-Tunisia':       { countries: ['TN'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-Turkey':        { countries: ['TR'], type: 'customs_union', proofImport: 'ATR', proofExport: 'ATR', origin_rules: 'customs_union', note: 'Union aduanera productos industriales; EUR.1 para agricolas' },
  'EU-UK':            { countries: ['GB'], type: 'fta', proofImport: 'DeclaracionOrigen', proofExport: 'DeclaracionOrigen', origin_rules: 'product_specific', note: 'TCA - Exportador registrado REX' },
  'EU-Ukraine':       { countries: ['UA'], type: 'bilateral', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  'EU-Vietnam':       { countries: ['VN'], type: 'fta', proofImport: 'EUR.1', proofExport: 'REX', origin_rules: 'product_specific' },
  // Centroamerica
  'EU-CentralAmerica': { countries: ['GT', 'HN', 'NI', 'SV', 'CR', 'PA'], type: 'fta', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'product_specific' },
  // San Marino
  'EU-SanMarino':     { countries: ['SM'], type: 'customs_union', proofImport: 'T2L', proofExport: 'T2L', origin_rules: 'customs_union' },
  // MERCOSUR (pendiente ratificacion completa)
  'EU-MERCOSUR':      { countries: ['AR', 'BR', 'UY', 'PY'], type: 'fta', proofImport: 'EUR.1', proofExport: 'EUR.1', origin_rules: 'regional', note: 'Pendiente ratificacion' },

  // === SPG (Sistema de Preferencias Generalizadas) ===
  'GSP': {
    countries: ['IN', 'PK', 'BD', 'LK', 'PH', 'ID', 'TH', 'KH', 'LA', 'MM', 'NP',
      'BO', 'CO', 'EC', 'PE', 'VE', 'EG', 'MA', 'TN', 'DZ', 'NG', 'GH', 'KE', 'TZ', 'UG',
      'CN', 'UZ', 'KG', 'TJ', 'NG', 'SN', 'BJ', 'TG', 'NE', 'BF', 'ML', 'GN', 'SL',
      'LR', 'CI', 'ET', 'DJ', 'ER', 'SO', 'MG', 'MU', 'SC', 'MV', 'PG', 'FJ'],
    type: 'gsp',
    proofImport: 'REX',
    proofExport: 'REX',
    origin_rules: 'simple',
    note: 'Form A o REX (exportador registrado)'
  },
  'GSP_PLUS': {
    countries: ['PK', 'LK', 'PH', 'KH', 'LA', 'MN', 'UZ', 'KG', 'TJ',
      'BO', 'EC', 'PE', 'PY', 'GT', 'HN', 'NI', 'SV', 'CV', 'AM', 'GE'],
    type: 'gsp_plus',
    proofImport: 'REX',
    proofExport: 'REX',
    origin_rules: 'simple',
    note: 'Preferencia adicional por compromisos DDHH/laborales/medioambientales'
  },
  'EBA': {
    countries: ['BD', 'KH', 'LA', 'MM', 'NP', 'AF', 'YE', 'SD', 'ET', 'UG', 'TZ',
      'RW', 'BI', 'MZ', 'MW', 'ZM', 'ML', 'NE', 'BF', 'TD', 'CF', 'CD', 'SS', 'SO',
      'ER', 'DJ', 'GM', 'GW', 'SL', 'LR', 'TG', 'BJ', 'SN', 'MR', 'HT', 'TL', 'KI',
      'TV', 'SB', 'VU', 'WS', 'LS', 'SZ'],
    type: 'eba',
    proofImport: 'REX',
    proofExport: 'REX',
    origin_rules: 'simple',
    note: 'Todo Menos Armas - Paises menos adelantados (0% arancel excepto armas)'
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
            analysis.recommendations.push({
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
                analysis.recommendations.push({
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
      proofOfOrigin: [],
      certificate: null,
      preferential: 0,
      savings: 0
    };

    // Buscar acuerdos aplicables por pais de origen
    for (const [name, agreement] of Object.entries(FTA_AGREEMENTS)) {
      if (agreement.countries.includes(origin)) {
        preferences.available = true;
        const entry = {
          name,
          type: agreement.type,
          originRules: agreement.origin_rules,
          proofImport: agreement.proofImport || 'EUR.1',
          proofExport: agreement.proofExport || 'EUR.1'
        };
        if (agreement.note) entry.note = agreement.note;
        preferences.agreements.push(entry);

        // Recopilar pruebas de origen necesarias (sin duplicados)
        const proof = agreement.proofImport || 'EUR.1';
        if (!preferences.proofOfOrigin.includes(proof)) {
          preferences.proofOfOrigin.push(proof);
        }
        preferences.certificate = proof;
      }
    }

    // Enriquecer con info de Exportador Autorizado / REX si aplica
    if (preferences.agreements.some(a => a.proofImport === 'REX' || a.proofExport === 'REX')) {
      preferences.requiresREX = true;
      preferences.rexNote = 'El exportador debe estar registrado en el sistema REX (Registered Exporter) para emitir declaraciones de origen';
    }
    if (preferences.agreements.some(a => a.type === 'customs_union')) {
      preferences.customsUnion = true;
      preferences.customsUnionNote = 'Union aduanera: se utiliza certificado ATR para productos industriales o T2L para libre circulacion';
    }

    return preferences;
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

    // Autorizacion por sanciones. `checkSanctions` ya determina
    // `action: 'require_authorization'` para las sancionadas parcialmente (p.ej. RU),
    // pero esa autorizacion no llegaba NUNCA a la documentacion: la pantalla
    // presentaba "Factura + BL/AWB + Packing List" como la documentacion de la
    // operacion, omitiendo el unico requisito que impide despacharla. Un usuario que
    // siguiera esa lista se plantaria en la aduana sin la autorizacion exigida.
    if (analysis.controls?.sanctions?.sanctioned &&
        analysis.controls.sanctions.action === 'require_authorization') {
      docs.push({
        code: 'C990',
        name: `Autorizacion de importacion (sanciones ${analysis.controls.sanctions.country})`,
        mandatory: true,
        authority: 'Secretaria de Estado de Comercio',
        reason: analysis.controls.sanctions.reason
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
   * Certificado de origen caracteristico segun el tipo de acuerdo.
   * Coherente con los proofImport de FTA_AGREEMENTS: bilateral usa EUR.1,
   * las FTA modernas declaracion de origen, GSP/EBA el sistema REX y las
   * uniones aduaneras ATR (o T2L para libre circulacion).
   */
  getCertificateType(type) {
    const certByType = {
      bilateral: 'EUR.1',
      fta: 'DeclaracionOrigen',
      gsp: 'REX',
      gsp_plus: 'REX',
      eba: 'REX',
      customs_union: 'ATR'
    };
    return certByType[type] || 'EUR.1';
  }

  /**
   * Validar si operacion cumple requisitos
   */
  async validateCompliance(operation, providedDocuments = []) {
    const analysis = await this.analyzeOperation(operation);
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
