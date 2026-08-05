/**
 * TARIC Service - Servicio de consulta de codigos arancelarios
 * Integra con la API de la Comision Europea y mantiene cache local
 */

const axios = require('axios');
const logger = require('../config/logger');
const TaricCode = require('../models/TaricCode');
const TaricAICache = require('../models/TaricAICache');
const TaricSearchHistory = require('../models/TaricSearchHistory');

// URLs de la API TARIC de la UE
const TARIC_CONSULTATION_URL = 'https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp';
const TARIC_MEASURES_URL = 'https://ec.europa.eu/taxation_customs/dds2/taric/measures.jsp';

// API Access2Markets (REST API moderna)
const ACCESS2MARKETS_API = 'https://trade.ec.europa.eu/access-to-markets/api/v1';

// API TARIC3 (nueva API de la UE)
const TARIC3_API = 'https://ec.europa.eu/taxation_customs/tedb/rest-api/v1';

// Cache de tipos de IVA por capitulo en Espana
const VAT_RATES_ES = {
  standard: 21,
  reduced: 10,
  superReduced: 4,
  // Capitulos con IVA reducido/superreducido
  reducedChapters: ['01', '02', '03', '04', '07', '08', '09', '10', '11', '12', '15', '16', '19', '20', '21', '22'],
  superReducedChapters: [], // Pan, leche, huevos, frutas, verduras, etc. se definen por producto
  exemptChapters: []
};

// Base de datos local de codigos TARIC comunes (para funcionamiento offline)
const COMMON_TARIC_CODES = {
  // Capitulo 84 - Maquinas y aparatos mecanicos
  '8471300000': {
    description: { es: 'Maquinas automaticas para tratamiento de datos, portatiles, de peso inferior o igual a 10 kg, que esten constituidas, al menos, por una unidad central de proceso, un teclado y un visualizador', en: 'Portable automatic data processing machines, weighing not more than 10 kg, consisting of at least a central processing unit, a keyboard and a display' },
    duties: { thirdCountry: 0 },
    vat: { applicable: 21 },
    supplementaryUnit: { required: true, type: 'p/st', description: 'Numero de articulos' }
  },
  '8471410000': {
    description: { es: 'Las demas maquinas automaticas para tratamiento de datos que incluyan en la misma envoltura, al menos, una unidad central de proceso y, aunque esten combinadas, una unidad de entrada y una de salida', en: 'Other automatic data processing machines comprising in the same housing at least a central processing unit and an input and output unit' },
    duties: { thirdCountry: 0 },
    vat: { applicable: 21 },
    supplementaryUnit: { required: true, type: 'p/st', description: 'Numero de articulos' }
  },
  '8471490000': {
    description: { es: 'Las demas maquinas automaticas para tratamiento de datos presentadas en forma de sistemas', en: 'Other automatic data processing machines presented in the form of systems' },
    duties: { thirdCountry: 0 },
    vat: { applicable: 21 },
    supplementaryUnit: { required: true, type: 'p/st', description: 'Numero de articulos' }
  },

  // Capitulo 85 - Aparatos y material electrico
  '8517120000': {
    description: { es: 'Telefonos moviles (celulares) y los de otras redes inalambricas', en: 'Telephones for cellular networks or for other wireless networks' },
    duties: { thirdCountry: 0 },
    vat: { applicable: 21 },
    supplementaryUnit: { required: true, type: 'p/st', description: 'Numero de articulos' }
  },
  '8517620000': {
    description: { es: 'Aparatos para la recepcion, conversion y transmision o regeneracion de voz, imagen u otros datos, incluidos los de conmutacion y encaminamiento (switching and routing apparatus)', en: 'Machines for the reception, conversion and transmission or regeneration of voice, images or other data' },
    duties: { thirdCountry: 0 },
    vat: { applicable: 21 },
    supplementaryUnit: { required: true, type: 'p/st', description: 'Numero de articulos' }
  },
  '8528720000': {
    description: { es: 'Los demas aparatos receptores de television, en colores', en: 'Other reception apparatus for television, colour' },
    duties: { thirdCountry: 14 },
    vat: { applicable: 21 },
    supplementaryUnit: { required: true, type: 'p/st', description: 'Numero de articulos' }
  },

  // Capitulo 61 - Prendas y complementos de vestir, de punto
  '6109100000': {
    description: { es: 'T-shirts y camisetas interiores, de punto, de algodon', en: 'T-shirts, singlets and other vests, knitted or crocheted, of cotton' },
    duties: { thirdCountry: 12 },
    vat: { applicable: 21 },
    supplementaryUnit: { required: true, type: 'p/st', description: 'Numero de articulos' }
  },
  '6110209100': {
    description: { es: 'Sueteres (jerseys), pulloveres, cardiganes, chalecos y articulos similares, de punto, de algodon', en: 'Jerseys, pullovers, cardigans, waistcoats and similar articles, knitted or crocheted, of cotton' },
    duties: { thirdCountry: 12 },
    vat: { applicable: 21 },
    supplementaryUnit: { required: true, type: 'p/st', description: 'Numero de articulos' }
  },

  // Capitulo 62 - Prendas y complementos de vestir, excepto los de punto
  '6203420000': {
    description: { es: 'Pantalones largos, pantalones con peto, pantalones cortos y shorts de algodon, para hombres o ninos', en: 'Men\'s or boys\' trousers, bib and brace overalls, breeches and shorts, of cotton' },
    duties: { thirdCountry: 12 },
    vat: { applicable: 21 },
    supplementaryUnit: { required: true, type: 'p/st', description: 'Numero de articulos' }
  },

  // Capitulo 64 - Calzado
  '6403999600': {
    description: { es: 'Los demas calzados con suela de caucho, plastico o cuero natural, con parte superior de cuero natural', en: 'Other footwear with outer soles of rubber, plastics or leather, with uppers of leather' },
    duties: { thirdCountry: 8 },
    vat: { applicable: 21 },
    supplementaryUnit: { required: true, type: 'pa', description: 'Numero de pares' }
  },

  // Capitulo 94 - Muebles
  '9401610000': {
    description: { es: 'Los demas asientos con armazon de madera, tapizados', en: 'Other seats with wooden frames, upholstered' },
    duties: { thirdCountry: 0 },
    vat: { applicable: 21 },
    supplementaryUnit: { required: true, type: 'p/st', description: 'Numero de articulos' }
  },
  '9403300000': {
    description: { es: 'Muebles de madera del tipo de los utilizados en oficinas', en: 'Wooden furniture of a kind used in offices' },
    duties: { thirdCountry: 0 },
    vat: { applicable: 21 },
    supplementaryUnit: { required: false }
  },
  '9403600000': {
    description: { es: 'Los demas muebles de madera', en: 'Other wooden furniture' },
    duties: { thirdCountry: 0 },
    vat: { applicable: 21 },
    supplementaryUnit: { required: false }
  },

  // Capitulo 08 - Frutas y frutos
  '0803901000': {
    description: { es: 'Platanos frescos', en: 'Fresh bananas' },
    duties: { thirdCountry: 114, specific: { amount: 114, unit: 'EUR/1000 kg' } },
    vat: { applicable: 10 },
    supplementaryUnit: { required: false }
  },
  '0804300000': {
    description: { es: 'Pinas (ananas) frescas o secas', en: 'Pineapples, fresh or dried' },
    duties: { thirdCountry: 5.8 },
    vat: { applicable: 10 },
    supplementaryUnit: { required: false }
  },
  '0805100000': {
    description: { es: 'Naranjas frescas o secas', en: 'Oranges, fresh or dried' },
    duties: { thirdCountry: 16 },
    vat: { applicable: 10 },
    supplementaryUnit: { required: false }
  },

  // Capitulo 22 - Bebidas
  '2204210000': {
    description: { es: 'Vino de uvas frescas en recipientes de capacidad inferior o igual a 2 litros', en: 'Wine of fresh grapes in containers holding 2 litres or less' },
    duties: { thirdCountry: 32, specific: { amount: 32, unit: 'EUR/hl' } },
    vat: { applicable: 21 },
    supplementaryUnit: { required: true, type: 'l', description: 'Litros' },
    specialTaxes: [{ type: 'alcohol', rate: 0, unit: 'EUR/hl' }]
  },

  // Capitulo 87 - Vehiculos
  '8703230000': {
    description: { es: 'Los demas vehiculos con motor de encendido por chispa de cilindrada superior a 1500 cm3 pero inferior o igual a 3000 cm3', en: 'Other vehicles with spark-ignition engine of a cylinder capacity exceeding 1500 cc but not exceeding 3000 cc' },
    duties: { thirdCountry: 10 },
    vat: { applicable: 21 },
    supplementaryUnit: { required: true, type: 'p/st', description: 'Numero de vehiculos' },
    specialTaxes: [{ type: 'matriculacion', rate: 4.75, unit: '%' }]
  },

  // Capitulo 90 - Instrumentos opticos
  '9018900000': {
    description: { es: 'Los demas instrumentos y aparatos de medicina, cirugia, odontologia o veterinaria', en: 'Other instruments and appliances used in medical, surgical, dental or veterinary sciences' },
    duties: { thirdCountry: 0 },
    vat: { applicable: 10 },
    supplementaryUnit: { required: false }
  },

  // Capitulo 30 - Productos farmaceuticos
  '3004900000': {
    description: { es: 'Los demas medicamentos constituidos por productos mezclados o sin mezclar, preparados para usos terapeuticos o profilacticos, dosificados o acondicionados para la venta al por menor', en: 'Other medicaments consisting of mixed or unmixed products for therapeutic or prophylactic uses' },
    duties: { thirdCountry: 0 },
    vat: { applicable: 4 },
    supplementaryUnit: { required: false }
  }
};

// Preferencias arancelarias por acuerdo
const PREFERENCE_AGREEMENTS = {
  '100': { name: 'Terceros paises', reduction: 0 },
  '200': {
    name: 'SPG (Sistema de Preferencias Generalizadas)',
    countries: ['BD', 'KH', 'LA', 'MM', 'NP', 'AF', 'BT', 'ET', 'LR', 'MW', 'MZ', 'RW', 'SL', 'SO', 'TZ', 'UG', 'ZM'],
    reduction: 100,
    certificate: 'Form A / REX'
  },
  '300': {
    name: 'Acuerdos de libre comercio',
    agreements: {
      'EUR-MED': ['MA', 'TN', 'EG', 'JO', 'IL', 'PS', 'LB', 'SY'],
      'CETA': ['CA'],
      'EU-Japan': ['JP'],
      'EU-Korea': ['KR'],
      'EU-Mexico': ['MX'],
      'EU-Singapore': ['SG'],
      'EU-Vietnam': ['VN'],
      'EU-UK-TCA': ['GB'],
      'EU-Chile': ['CL']
    },
    reduction: 100,
    certificate: 'EUR.1 / EUR-MED / Declaracion en factura'
  },
  '400': {
    name: 'Union aduanera',
    countries: ['TR', 'AD', 'SM'],
    reduction: 100,
    certificate: 'ATR'
  }
};

class TaricService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 horas
    logger.info('TARIC Service initialized');
  }

  /**
   * Buscar codigo TARIC por descripcion
   */
  async searchByDescription(query, options = {}) {
    const { limit = 10, language = 'es' } = options;

    try {
      // Primero buscar en base de datos local
      const localResults = await TaricCode.search(query, limit);

      if (localResults.length > 0) {
        return {
          source: 'local',
          results: localResults.map(r => ({
            code: r.code,
            description: r.description,
            duties: r.duties,
            vat: r.vat
          }))
        };
      }

      // Si no hay resultados locales, buscar en codigos comunes
      const commonResults = this._searchCommonCodes(query, limit);
      if (commonResults.length > 0) {
        return {
          source: 'common',
          results: commonResults
        };
      }

      // Finalmente, intentar consulta a la API de la UE (si esta disponible)
      try {
        const apiResults = await this._searchTaricAPI(query, language);
        if (apiResults && apiResults.length > 0) {
          return {
            source: 'eu_api',
            results: apiResults.slice(0, limit)
          };
        }
      } catch (apiError) {
        logger.warn('TARIC API no disponible, usando datos locales', { error: apiError.message });
      }

      return {
        source: 'none',
        results: [],
        message: 'No se encontraron resultados. Intente con terminos mas especificos.'
      };

    } catch (error) {
      logger.error('Error en busqueda TARIC:', error);
      throw error;
    }
  }

  /**
   * Obtener informacion de un codigo TARIC especifico
   */
  async getCodeInfo(code) {
    const normalizedCode = this._normalizeCode(code);

    // Verificar cache
    const cacheKey = `taric_${normalizedCode}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      // Buscar en base de datos local
      let taricInfo = await TaricCode.findOne({ code: normalizedCode });

      if (!taricInfo) {
        // Buscar en codigos comunes
        const commonInfo = COMMON_TARIC_CODES[normalizedCode];
        if (commonInfo) {
          taricInfo = {
            code: normalizedCode,
            ...commonInfo,
            breakdown: this._parseCodeBreakdown(normalizedCode),
            source: 'common'
          };
        }
      }

      if (!taricInfo) {
        // Intentar obtener de la API de la UE
        taricInfo = await this._getCodeFromAPI(normalizedCode);
      }

      if (taricInfo) {
        // Guardar en cache
        this.cache.set(cacheKey, { data: taricInfo, timestamp: Date.now() });
        return taricInfo;
      }

      return null;

    } catch (error) {
      logger.error('Error obteniendo info TARIC:', error);
      throw error;
    }
  }

  /**
   * Calcular derechos de aduana
   */
  async calculateDuties(params) {
    const {
      taricCode,
      customsValue, // Valor en aduana en EUR
      origin,       // Codigo ISO pais de origen
      preference = '100', // Codigo de preferencia
      quantity,     // Cantidad en unidades suplementarias (si aplica)
      netWeight     // Peso neto en kg
    } = params;

    const codeInfo = await this.getCodeInfo(taricCode);

    if (!codeInfo) {
      throw new Error(`Codigo TARIC ${taricCode} no encontrado`);
    }

    // Determinar tasa de arancel base
    let baseDutyRate = codeInfo.duties?.thirdCountry || 0;
    let specificDuty = 0;
    let preferenceApplied = null;

    // Verificar si aplica preferencia
    if (preference !== '100') {
      const prefConfig = PREFERENCE_AGREEMENTS[preference];
      if (prefConfig) {
        const isEligible = this._checkPreferenceEligibility(origin, prefConfig);
        if (isEligible) {
          baseDutyRate = baseDutyRate * (1 - prefConfig.reduction / 100);
          preferenceApplied = {
            code: preference,
            name: prefConfig.name,
            certificate: prefConfig.certificate
          };
        }
      }
    }

    // Calcular arancel ad valorem
    const adValoremDuty = customsValue * (baseDutyRate / 100);

    // Calcular arancel especifico si aplica
    if (codeInfo.duties?.specific) {
      const spec = codeInfo.duties.specific;
      // spec.unit puede faltar; sin el ?. un TARIC con specific.amount sin unit
      // lanzaba TypeError y reventaba el cálculo de derechos (500).
      if (spec.unit?.includes('kg') && netWeight) {
        specificDuty = (netWeight / 1000) * spec.amount;
      } else if (spec.unit?.includes('hl') && quantity) {
        specificDuty = (quantity / 100) * spec.amount;
      } else if (spec.unit?.includes('p/st') && quantity) {
        specificDuty = quantity * spec.amount;
      }
    }

    // Total derechos de importacion
    const totalDuty = Math.max(adValoremDuty, specificDuty); // Para aranceles mixtos, se aplica el mayor

    // Calcular IVA
    const vatRate = codeInfo.vat?.applicable || 21;
    const vatBase = customsValue + totalDuty;
    const vatAmount = vatBase * (vatRate / 100);

    // Calcular impuestos especiales si aplica
    let specialTaxes = [];
    if (codeInfo.specialTaxes && codeInfo.specialTaxes.length > 0) {
      for (const tax of codeInfo.specialTaxes) {
        let taxAmount = 0;
        if (tax.unit === '%') {
          taxAmount = customsValue * (tax.rate / 100);
        } else if (tax.unit.includes('hl') && quantity) {
          taxAmount = (quantity / 100) * tax.rate;
        }
        specialTaxes.push({
          type: tax.type,
          amount: Math.round(taxAmount * 100) / 100
        });
      }
    }

    const totalSpecialTaxes = specialTaxes.reduce((sum, t) => sum + t.amount, 0);
    const totalToPay = customsValue + totalDuty + vatAmount + totalSpecialTaxes;

    return {
      taricCode,
      origin,
      customsValue: Math.round(customsValue * 100) / 100,

      // Derechos de importacion
      duties: {
        baseDutyRate: baseDutyRate,
        effectiveDutyRate: baseDutyRate,
        adValoremDuty: Math.round(adValoremDuty * 100) / 100,
        specificDuty: Math.round(specificDuty * 100) / 100,
        totalDuty: Math.round(totalDuty * 100) / 100
      },

      // IVA
      vat: {
        rate: vatRate,
        base: Math.round(vatBase * 100) / 100,
        amount: Math.round(vatAmount * 100) / 100
      },

      // Impuestos especiales
      specialTaxes: specialTaxes,
      totalSpecialTaxes: Math.round(totalSpecialTaxes * 100) / 100,

      // Preferencia aplicada
      preferenceApplied,

      // Totales
      totalTaxes: Math.round((totalDuty + vatAmount + totalSpecialTaxes) * 100) / 100,
      totalToPay: Math.round(totalToPay * 100) / 100,

      // Informacion adicional
      supplementaryUnit: codeInfo.supplementaryUnit,
      requiredDocuments: codeInfo.requiredDocuments || [],
      warnings: this._generateDutyWarnings(codeInfo, origin, preference)
    };
  }

  /**
   * Verificar si se requieren documentos especiales
   */
  async getRequiredDocuments(taricCode, origin) {
    const codeInfo = await this.getCodeInfo(taricCode);

    if (!codeInfo) {
      return { documents: [], warnings: ['Codigo TARIC no encontrado'] };
    }

    const documents = [];
    const warnings = [];

    // Documentos basicos siempre requeridos
    documents.push(
      { code: 'N380', name: 'Factura comercial', mandatory: true },
      { code: 'N714', name: 'Packing list', mandatory: true },
      { code: 'N785', name: 'Documento de transporte (BL/AWB/CMR)', mandatory: true }
    );

    // Documentos del codigo TARIC
    if (codeInfo.requiredDocuments) {
      documents.push(...codeInfo.requiredDocuments.map(d => ({
        ...d,
        mandatory: true
      })));
    }

    // Certificados de origen segun preferencia
    const chapter = taricCode.substring(0, 2);

    // Productos agricolas (capitulos 01-24)
    if (parseInt(chapter) <= 24) {
      documents.push({
        code: 'C400',
        name: 'Certificado fitosanitario',
        mandatory: ['CN', 'IN', 'BR', 'MX', 'CO', 'EC', 'PE'].includes(origin),
        authority: 'SOIVRE'
      });
    }

    // Productos de origen animal
    if (['01', '02', '03', '04', '05', '15', '16'].includes(chapter)) {
      documents.push({
        code: 'N851',
        name: 'Documento veterinario de entrada (DVE)',
        mandatory: true,
        authority: 'Sanidad Exterior'
      });
    }

    // Textiles (capitulos 50-63)
    if (parseInt(chapter) >= 50 && parseInt(chapter) <= 63) {
      if (['CN', 'BD', 'VN', 'KH', 'MM', 'PK', 'IN'].includes(origin)) {
        warnings.push('Producto sujeto a vigilancia textil');
      }
    }

    // Electronica (capitulo 85)
    if (chapter === '85') {
      documents.push({
        code: 'Y922',
        name: 'Marcado CE',
        mandatory: true,
        description: 'Declaracion de conformidad CE'
      });
    }

    return {
      documents,
      warnings,
      chapter,
      origin
    };
  }

  /**
   * Obtener preferencias disponibles para un pais de origen
   */
  getAvailablePreferences(origin) {
    const preferences = [
      { code: '100', name: 'Arancel terceros paises', description: 'Sin preferencia', certificate: null }
    ];

    // Verificar SPG
    if (PREFERENCE_AGREEMENTS['200'].countries.includes(origin)) {
      preferences.push({
        code: '200',
        name: 'SPG - Sistema de Preferencias Generalizadas',
        description: 'Reduccion total de aranceles para paises menos desarrollados',
        certificate: 'Certificado de origen Form A o REX'
      });
    }

    // Verificar acuerdos de libre comercio
    const fta = PREFERENCE_AGREEMENTS['300'];
    for (const [agreement, countries] of Object.entries(fta.agreements)) {
      if (countries.includes(origin)) {
        preferences.push({
          code: '300',
          name: `Acuerdo ${agreement}`,
          description: 'Exencion total de aranceles',
          certificate: 'EUR.1, EUR-MED o declaracion en factura'
        });
        break;
      }
    }

    // Verificar union aduanera
    if (PREFERENCE_AGREEMENTS['400'].countries.includes(origin)) {
      preferences.push({
        code: '400',
        name: 'Union aduanera',
        description: 'Libre circulacion de mercancias',
        certificate: 'ATR (Turquia) o sin certificado (Andorra, San Marino)'
      });
    }

    return preferences;
  }

  /**
   * Poblar base de datos con codigos TARIC comunes
   */
  async seedCommonCodes() {
    const codes = [];

    for (const [code, data] of Object.entries(COMMON_TARIC_CODES)) {
      codes.push({
        code,
        description: data.description,
        breakdown: this._parseCodeBreakdown(code),
        level: 10,
        duties: data.duties,
        vat: data.vat,
        supplementaryUnit: typeof data.supplementaryUnit === 'object' ? (data.supplementaryUnit?.type || data.supplementaryUnit?.description || '') : (data.supplementaryUnit || ''),
        specialTaxes: data.specialTaxes || [],
        isLeaf: true,
        isActive: true,
        keywords: this._extractKeywords(data.description.es),
        lastUpdated: new Date()
      });
    }

    try {
      for (const codeData of codes) {
        await TaricCode.findOneAndUpdate(
          { code: codeData.code },
          codeData,
          { upsert: true, new: true }
        );
      }
      logger.info(`TARIC: ${codes.length} codigos comunes actualizados`);
      return { success: true, count: codes.length };
    } catch (error) {
      logger.error('Error poblando codigos TARIC:', error);
      throw error;
    }
  }

  // ============== Metodos privados ==============

  _normalizeCode(code) {
    // Eliminar espacios y puntos, asegurar 10 digitos
    const cleaned = code.replace(/[\s.]/g, '');
    return cleaned.padEnd(10, '0').substring(0, 10);
  }

  _parseCodeBreakdown(code) {
    const normalized = this._normalizeCode(code);
    return {
      chapter: normalized.substring(0, 2),
      heading: normalized.substring(0, 4),
      subheading: normalized.substring(0, 6),
      cnCode: normalized.substring(0, 8),
      taricCode: normalized.substring(0, 10)
    };
  }

  _searchCommonCodes(query, limit) {
    const queryLower = query.toLowerCase();
    const results = [];

    for (const [code, data] of Object.entries(COMMON_TARIC_CODES)) {
      const descEs = data.description.es.toLowerCase();
      const descEn = (data.description.en || '').toLowerCase();

      if (descEs.includes(queryLower) || descEn.includes(queryLower)) {
        results.push({
          code,
          description: data.description,
          duties: data.duties,
          vat: data.vat,
          confidence: descEs.includes(queryLower) ? 90 : 80
        });
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence).slice(0, limit);
  }

  /**
   * Buscar en la API Access2Markets de la UE
   */
  async _searchTaricAPI(query, language = 'en') {
    try {
      // Intentar con Access2Markets API
      const searchUrl = `${ACCESS2MARKETS_API}/nomenclatures/taric/search`;

      const response = await axios.get(searchUrl, {
        params: {
          q: query,
          lang: language === 'es' ? 'es' : 'en',
          limit: 20
        },
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'Accept-Language': language
        }
      });

      if (response.data && Array.isArray(response.data)) {
        return response.data.map(item => ({
          code: item.code || item.goodsCode,
          description: {
            es: item.description_es || item.description,
            en: item.description_en || item.description
          },
          duties: item.duties || { thirdCountry: 0 },
          source: 'eu_api'
        }));
      }

      return [];

    } catch (error) {
      // API puede no estar disponible, usar fallback
      logger.debug('API Access2Markets no disponible:', error.message);

      // Intentar TARIC3 API como fallback
      try {
        return await this._searchTaric3API(query, language);
      } catch (fallbackError) {
        logger.debug('TARIC3 API tampoco disponible:', fallbackError.message);
        return [];
      }
    }
  }

  /**
   * Buscar en TARIC3 API (fallback)
   */
  async _searchTaric3API(query, language) {
    try {
      const response = await axios.get(`${TARIC3_API}/goods/search`, {
        params: { q: query, lang: language },
        timeout: 8000
      });

      if (response.data && response.data.results) {
        return response.data.results.map(item => ({
          code: item.goodsNomenclatureItemId,
          description: { es: item.description, en: item.descriptionEn },
          source: 'taric3_api'
        }));
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Obtener informacion de codigo desde API de la UE
   */
  async _getCodeFromAPI(code) {
    const normalizedCode = this._normalizeCode(code);

    try {
      // Intentar Access2Markets API
      const response = await axios.get(`${ACCESS2MARKETS_API}/nomenclatures/taric/${normalizedCode}`, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'Accept-Language': 'es'
        }
      });

      if (response.data) {
        const data = response.data;
        return {
          code: normalizedCode,
          description: {
            es: data.description_es || data.description,
            en: data.description_en || data.description
          },
          breakdown: this._parseCodeBreakdown(normalizedCode),
          duties: {
            thirdCountry: data.conventionalRate || data.dutyRate || 0
          },
          vat: { applicable: 21 },
          measures: data.measures || [],
          source: 'eu_api'
        };
      }

    } catch (error) {
      logger.debug(`API UE no disponible para codigo ${code}:`, error.message);
    }

    // Intentar TARIC3 como fallback
    try {
      const response = await axios.get(`${TARIC3_API}/commodities/${normalizedCode}`, {
        timeout: 8000
      });

      if (response.data) {
        return {
          code: normalizedCode,
          description: {
            es: response.data.description,
            en: response.data.descriptionEn
          },
          breakdown: this._parseCodeBreakdown(normalizedCode),
          duties: { thirdCountry: response.data.thirdCountryDuty || 0 },
          vat: { applicable: 21 },
          source: 'taric3_api'
        };
      }
    } catch (error) {
      logger.debug(`TARIC3 API no disponible para codigo ${code}`);
    }

    return null;
  }

  /**
   * Guardar busqueda en historial
   */
  async recordSearch(params) {
    const { userId, tenantId, code, searchType, found, source, description, responseTime, resultSummary } = params;

    try {
      await TaricSearchHistory.create({
        userId,
        tenantId,
        code,
        normalizedCode: this._normalizeCode(code),
        searchType: searchType || 'code_lookup',
        found: found || false,
        source: source || 'not_found',
        description,
        responseTime,
        resultSummary
      });
    } catch (error) {
      logger.warn('Error guardando historial de busqueda:', error.message);
    }
  }

  /**
   * Obtener historial de busquedas de un usuario
   */
  async getUserSearchHistory(userId, limit = 10) {
    try {
      return await TaricSearchHistory.getRecentByUser(userId, limit);
    } catch (error) {
      logger.error('Error obteniendo historial:', error);
      return [];
    }
  }

  /**
   * Obtener codigos mas buscados
   */
  async getMostSearchedCodes(tenantId, days = 30, limit = 20) {
    try {
      return await TaricSearchHistory.getMostSearchedCodes(tenantId, days, limit);
    } catch (error) {
      logger.error('Error obteniendo codigos mas buscados:', error);
      return [];
    }
  }

  /**
   * Verificar cache de IA antes de llamar a Claude
   */
  async getFromAICache(code) {
    try {
      return await TaricAICache.getFromCache(code);
    } catch (error) {
      logger.warn('Error obteniendo de cache IA:', error.message);
      return null;
    }
  }

  /**
   * Guardar resultado de IA en cache
   */
  async saveToAICache(code, aiResponse, metadata = {}) {
    try {
      return await TaricAICache.saveToCache(code, aiResponse, metadata);
    } catch (error) {
      logger.warn('Error guardando en cache IA:', error.message);
    }
  }

  /**
   * Obtener estadisticas del cache de IA
   */
  async getAICacheStats() {
    try {
      return await TaricAICache.getCacheStats();
    } catch (error) {
      logger.error('Error obteniendo stats de cache:', error);
      return null;
    }
  }

  _checkPreferenceEligibility(origin, prefConfig) {
    if (prefConfig.countries && prefConfig.countries.includes(origin)) {
      return true;
    }
    if (prefConfig.agreements) {
      for (const countries of Object.values(prefConfig.agreements)) {
        if (countries.includes(origin)) {
          return true;
        }
      }
    }
    return false;
  }

  _generateDutyWarnings(codeInfo, origin, preference) {
    const warnings = [];

    // Advertencia sobre unidades suplementarias
    if (codeInfo.supplementaryUnit?.required) {
      warnings.push(`Requiere unidades suplementarias: ${codeInfo.supplementaryUnit.description} (${codeInfo.supplementaryUnit.type})`);
    }

    // Advertencia sobre impuestos especiales
    if (codeInfo.specialTaxes && codeInfo.specialTaxes.length > 0) {
      warnings.push(`Producto sujeto a impuestos especiales: ${codeInfo.specialTaxes.map(t => t.type).join(', ')}`);
    }

    // Advertencia sobre preferencia no aplicada
    if (preference !== '100') {
      const prefConfig = PREFERENCE_AGREEMENTS[preference];
      if (prefConfig && !this._checkPreferenceEligibility(origin, prefConfig)) {
        warnings.push(`El pais de origen ${origin} no tiene derecho a la preferencia ${preference}`);
      }
    }

    return warnings;
  }

  _extractKeywords(text) {
    const stopWords = ['de', 'la', 'el', 'los', 'las', 'y', 'o', 'en', 'con', 'para', 'por', 'a', 'del'];
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .slice(0, 10);
  }
}

module.exports = new TaricService();
