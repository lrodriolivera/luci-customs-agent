/**
 * Servicio de Calculo de Aranceles con IA
 * Obtiene aranceles actualizados usando Claude AI cuando no estan en BD local
 */

const logger = require('../config/logger');
const TaricCode = require('../models/TaricCode');
const TaricAICache = require('../models/TaricAICache');
const aiService = require('./aiService');
const { getSeasonalTariff, hasSeasonalTariff } = require('../data/seasonalTariffs');

// Cache en memoria para aranceles (1 hora)
const dutyCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

/**
 * Obtener informacion completa de aranceles para un codigo TARIC
 * Usa multiples fuentes: BD local -> Cache IA -> IA en tiempo real
 */
async function getDutyInfo(taricCode, origin = null) {
  const normalizedCode = normalizeCode(taricCode);
  const cacheKey = `duty_${normalizedCode}_${origin || 'all'}`;

  // 1. Verificar cache en memoria
  const memoryCached = dutyCache.get(cacheKey);
  if (memoryCached && Date.now() - memoryCached.timestamp < CACHE_TTL) {
    logger.debug(`Duty info from memory cache: ${normalizedCode}`);
    return { ...memoryCached.data, source: 'memory_cache' };
  }

  // 2. Buscar en BD local
  const localData = await TaricCode.findOne({ code: normalizedCode });
  if (localData && localData.duties && localData.duties.thirdCountry !== undefined) {
    const localVatInfo = getVATRateByChapter(normalizedCode);
    const result = {
      code: normalizedCode,
      description: localData.description?.es || localData.description?.en,
      dutyRate: localData.duties.thirdCountry,
      dutyType: localData.duties.specific ? 'mixed' : 'ad_valorem',
      specificDuty: localData.duties.specific || null,
      vatRate: localVatInfo.rate,
      vatType: localVatInfo.type,
      supplementaryUnit: localData.supplementaryUnit,
      measures: localData.measures || [],
      requiredDocuments: localData.requiredDocuments || [],
      preferences: localData.preferences || [],
      source: 'local_db',
      lastVerified: localData.lastUpdated
    };

    // Guardar en cache memoria
    dutyCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  // 3. Buscar en cache de IA
  const aiCached = await TaricAICache.getFromCache(normalizedCode);
  if (aiCached && aiCached.aiResponse && aiCached.aiResponse.dutyRate) {
    const vatInfo = getVATRateByChapter(normalizedCode);
    const result = {
      code: normalizedCode,
      description: aiCached.aiResponse.description_es || aiCached.aiResponse.description,
      dutyRate: parseFloat(aiCached.aiResponse.dutyRate) || 0,
      dutyType: 'ad_valorem',
      vatRate: vatInfo.rate,
      vatType: vatInfo.type,
      measures: aiCached.aiResponse.measures || [],
      source: 'ai_cache',
      cacheHits: aiCached.hits,
      lastVerified: aiCached.updatedAt
    };

    dutyCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  // 4. Obtener de IA en tiempo real
  try {
    const aiResult = await getArancelesFromAI(normalizedCode, origin);
    if (aiResult) {
      // Guardar en cache de IA
      await TaricAICache.saveToCache(normalizedCode, aiResult, {
        model: 'claude-sonnet-4-20250514'
      });

      // Guardar en cache memoria
      dutyCache.set(cacheKey, { data: aiResult, timestamp: Date.now() });

      // Actualizar BD local si no existe
      await updateLocalDatabase(normalizedCode, aiResult);

      return { ...aiResult, source: 'ai_realtime' };
    }
  } catch (error) {
    logger.error(`Error getting duty info from AI for ${normalizedCode}:`, error.message);
  }

  // 5. Fallback: estimar basado en capitulo
  return getEstimatedDuty(normalizedCode);
}

/**
 * Obtener aranceles actualizados usando IA
 */
async function getArancelesFromAI(taricCode, origin = null) {
  const prompt = `Proporciona informacion EXACTA y ACTUALIZADA sobre el arancel de importacion de la Union Europea para el codigo TARIC: ${taricCode}

IMPORTANTE: Necesito datos PRECISOS del arancel ERGA OMNES (terceros paises) vigente en 2026.

${origin ? `Pais de origen: ${origin}` : ''}

Responde UNICAMENTE con un JSON valido con esta estructura exacta:
{
  "code": "${taricCode}",
  "description": "Descripcion oficial del producto en espanol",
  "description_es": "Descripcion en espanol",
  "dutyRate": "X.X",
  "dutyRateNumeric": X.X,
  "dutyType": "ad_valorem|specific|mixed",
  "specificDuty": {
    "amount": null,
    "unit": null,
    "formula": null
  },
  "vatRate": 21,
  "vatType": "standard|reduced|super_reduced",
  "chapter": "XX",
  "chapterDescription": "Descripcion del capitulo",
  "measures": [
    {"type": "string", "description": "string", "applies": boolean}
  ],
  "preferences": [
    {"agreement": "string", "countries": ["XX"], "rate": X.X, "certificate": "string"}
  ],
  "antidumping": {
    "applies": boolean,
    "countries": [],
    "additionalRate": null
  },
  "quota": {
    "applies": boolean,
    "description": null
  },
  "supplementaryUnit": {
    "required": boolean,
    "type": null,
    "description": null
  },
  "notes": "Notas relevantes sobre el arancel",
  "source": "TARIC UE 2026",
  "confidence": 95,
  "lastUpdate": "2026-01"
}

REGLAS:
1. El dutyRateNumeric debe ser el porcentaje EXACTO (ej: 12 para 12%, 0 para 0%)
2. Para productos electronicos (cap 84, 85) muchos tienen 0% por acuerdos ITA
3. Para textiles (cap 61-63) suelen ser 12%
4. Para vehiculos (cap 87) suelen ser 10%
5. Para alimentos (cap 01-24) varian segun producto
6. Si hay arancel especifico, indicar formula y unidades
7. Indica si hay medidas antidumping o cuotas aplicables
8. NO inventes datos, usa informacion oficial TARIC`;

  try {
    const result = await aiService.callClaude(
      'claude-sonnet-4-20250514',
      `Eres un experto en aranceles de la Union Europea. Tu funcion es proporcionar informacion EXACTA y ACTUALIZADA sobre aranceles del TARIC. Los datos deben ser precisos para calculos de importacion reales. Responde SOLO con JSON valido.`,
      prompt
    );

    let jsonContent = result.content;

    // Limpiar posibles bloques de codigo markdown
    const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }
    jsonContent = jsonContent.trim();

    const parsed = JSON.parse(jsonContent);

    // Validar que tenga los campos necesarios
    if (parsed.dutyRateNumeric === undefined && parsed.dutyRate === undefined) {
      throw new Error('Respuesta de IA no contiene dutyRate');
    }

    // Usar tabla local de IVA como fuente autoritativa (Ley 37/1992)
    const vatInfo = getVATRateByChapter(taricCode);

    return {
      code: taricCode,
      description: parsed.description_es || parsed.description,
      description_es: parsed.description_es,
      dutyRate: parsed.dutyRateNumeric !== undefined ? parsed.dutyRateNumeric : parseFloat(parsed.dutyRate) || 0,
      dutyType: parsed.dutyType || 'ad_valorem',
      specificDuty: parsed.specificDuty || null,
      vatRate: vatInfo.rate,
      vatType: vatInfo.type,
      chapter: parsed.chapter,
      chapterDescription: parsed.chapterDescription,
      measures: parsed.measures || [],
      preferences: parsed.preferences || [],
      antidumping: parsed.antidumping || { applies: false },
      quota: parsed.quota || { applies: false },
      supplementaryUnit: parsed.supplementaryUnit || { required: false },
      notes: parsed.notes,
      confidence: parsed.confidence || 85,
      source: 'ai_realtime'
    };

  } catch (error) {
    logger.error('Error parsing AI duty response:', error.message);
    return null;
  }
}

/**
 * Calcular aranceles completos para un producto
 */
async function calculateDutiesWithAI(params) {
  const {
    taricCode,
    customsValue,
    origin,
    preference = '100',
    quantity,
    netWeight,
    importDate
  } = params;

  // Fecha de importacion (por defecto: hoy)
  const calcDate = importDate ? new Date(importDate) : new Date();

  // Obtener informacion de aranceles
  const dutyInfo = await getDutyInfo(taricCode, origin);

  if (!dutyInfo) {
    throw new Error(`No se pudo obtener informacion de aranceles para ${taricCode}`);
  }

  // Verificar aranceles estacionales
  const normalizedCode = normalizeCode(taricCode);
  const seasonalInfo = getSeasonalTariff(normalizedCode, calcDate);

  // Determinar tasa base (estacional si aplica, sino la normal)
  let effectiveDutyRate = dutyInfo.dutyRate || 0;
  let seasonalApplied = null;

  if (seasonalInfo) {
    effectiveDutyRate = seasonalInfo.currentRate;
    seasonalApplied = {
      isSeasonal: true,
      currentRate: seasonalInfo.currentRate,
      periodLabel: seasonalInfo.periodLabel,
      hasEntryPrice: seasonalInfo.hasEntryPrice,
      entryPrice: seasonalInfo.currentEntryPrice,
      entryPriceUnit: seasonalInfo.entryPriceUnit,
      allSeasons: seasonalInfo.allSeasons,
      description: seasonalInfo.description
    };
    // Sobrescribir baseDutyRate con la estacional
    dutyInfo.dutyRate = seasonalInfo.currentRate;
  }

  let preferenceApplied = null;

  // Verificar preferencias arancelarias
  if (preference !== '100' && dutyInfo.preferences) {
    const applicablePreference = dutyInfo.preferences.find(p => {
      if (p.countries && p.countries.includes(origin)) return true;
      if (preference === '200' && p.agreement?.includes('SPG')) return true;
      if (preference === '300' && (p.agreement?.includes('FTA') || p.agreement?.includes('Preferencial'))) return true;
      if (preference === '400' && p.agreement?.includes('Union')) return true;
      return false;
    });

    if (applicablePreference) {
      effectiveDutyRate = applicablePreference.rate || 0;
      preferenceApplied = {
        agreement: applicablePreference.agreement,
        certificate: applicablePreference.certificate,
        reduction: dutyInfo.dutyRate - effectiveDutyRate
      };
    }
  }

  // Verificar antidumping
  let antidumpingDuty = 0;
  if (dutyInfo.antidumping?.applies && dutyInfo.antidumping.countries?.includes(origin)) {
    antidumpingDuty = dutyInfo.antidumping.additionalRate || 0;
  }

  // Calcular arancel ad valorem
  const adValoremDuty = customsValue * (effectiveDutyRate / 100);

  // Calcular arancel especifico si aplica
  let specificDuty = 0;
  if (dutyInfo.specificDuty && dutyInfo.specificDuty.amount) {
    const spec = dutyInfo.specificDuty;
    if (spec.unit?.includes('kg') && netWeight) {
      specificDuty = (netWeight / 1000) * spec.amount;
    } else if (spec.unit?.includes('hl') && quantity) {
      specificDuty = (quantity / 100) * spec.amount;
    } else if ((spec.unit?.includes('p/st') || spec.unit?.includes('unit')) && quantity) {
      specificDuty = quantity * spec.amount;
    }
  }

  // Total derechos de importacion
  let totalDuty;
  if (dutyInfo.dutyType === 'mixed') {
    totalDuty = Math.max(adValoremDuty, specificDuty);
  } else if (dutyInfo.dutyType === 'specific') {
    totalDuty = specificDuty;
  } else {
    totalDuty = adValoremDuty;
  }

  // Añadir antidumping
  totalDuty += customsValue * (antidumpingDuty / 100);

  // Calcular IVA - usar tabla por capitulo TARIC como fuente autoritativa
  const vatByChapter = getVATRateByChapter(taricCode);
  const vatRate = vatByChapter.rate;
  const vatType = vatByChapter.type;
  const vatBase = customsValue + totalDuty;
  const vatAmount = vatBase * (vatRate / 100);

  // Warnings
  const warnings = [];
  if (seasonalApplied) {
    warnings.push(`Arancel estacional: ${seasonalApplied.currentRate}% (${seasonalApplied.periodLabel})`);
    if (seasonalApplied.hasEntryPrice && seasonalApplied.entryPrice) {
      warnings.push(`Sistema de precios de entrada: ${seasonalApplied.entryPrice} ${seasonalApplied.entryPriceUnit}. Si el precio de importacion es inferior, se aplican derechos adicionales.`);
    }
  }
  if (dutyInfo.antidumping?.applies) {
    warnings.push(`Producto sujeto a derechos antidumping desde ${dutyInfo.antidumping.countries?.join(', ')}`);
  }
  if (dutyInfo.quota?.applies) {
    warnings.push('Producto sujeto a contingentes arancelarios');
  }
  if (dutyInfo.supplementaryUnit?.required) {
    warnings.push(`Requiere unidades suplementarias: ${dutyInfo.supplementaryUnit.description}`);
  }
  if (dutyInfo.confidence && dutyInfo.confidence < 90) {
    warnings.push('Arancel estimado - verificar en TARIC oficial antes de declarar');
  }

  return {
    taricCode,
    description: dutyInfo.description,
    origin,
    customsValue: Math.round(customsValue * 100) / 100,

    // Derechos de importacion
    duties: {
      baseDutyRate: dutyInfo.dutyRate,
      effectiveDutyRate: effectiveDutyRate,
      dutyType: dutyInfo.dutyType,
      adValoremDuty: Math.round(adValoremDuty * 100) / 100,
      specificDuty: Math.round(specificDuty * 100) / 100,
      antidumpingDuty: Math.round(customsValue * (antidumpingDuty / 100) * 100) / 100,
      totalDuty: Math.round(totalDuty * 100) / 100
    },

    // IVA
    vat: {
      rate: vatRate,
      type: vatType,
      description: vatByChapter.description,
      base: Math.round(vatBase * 100) / 100,
      amount: Math.round(vatAmount * 100) / 100
    },

    // Preferencia aplicada
    preferenceApplied,

    // Medidas especiales
    measures: dutyInfo.measures || [],
    antidumping: dutyInfo.antidumping,
    quota: dutyInfo.quota,

    // Totales
    totalTaxes: Math.round((totalDuty + vatAmount) * 100) / 100,
    totalToPay: Math.round((customsValue + totalDuty + vatAmount) * 100) / 100,

    // Informacion adicional
    supplementaryUnit: dutyInfo.supplementaryUnit,
    requiredDocuments: dutyInfo.requiredDocuments || [],
    warnings,

    // Aranceles estacionales
    seasonal: seasonalApplied,
    importDate: calcDate.toISOString().split('T')[0],

    // Metadata
    source: dutyInfo.source,
    confidence: dutyInfo.confidence || 95,
    calculatedAt: new Date()
  };
}

/**
 * Validar arancel con fuentes oficiales usando IA
 */
async function validateDutyRate(taricCode, currentRate, origin = null) {
  const prompt = `Verifica si el arancel ${currentRate}% es correcto para el codigo TARIC ${taricCode} en la UE (2026).
${origin ? `Pais de origen: ${origin}` : ''}

Responde con JSON:
{
  "isCorrect": boolean,
  "correctRate": X.X,
  "difference": X.X,
  "explanation": "string",
  "source": "string",
  "confidence": number
}`;

  try {
    const result = await aiService.callClaude(
      'claude-sonnet-4-20250514',
      'Eres un experto en aranceles de la UE. Valida aranceles con precision.',
      prompt
    );

    let jsonContent = result.content;
    const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    return JSON.parse(jsonContent.trim());
  } catch (error) {
    logger.error('Error validating duty rate:', error.message);
    return null;
  }
}

// ============== Funciones auxiliares ==============

/**
 * Determinar tipo de IVA por capitulo TARIC segun Ley 37/1992 del IVA (Espana)
 * - 4% superreducido: productos de primera necesidad
 * - 10% reducido: alimentos en general, agua, productos sanitarios
 * - 21% general: todo lo demas
 */
function getVATRateByChapter(taricCode) {
  const code = taricCode.replace(/[\s.]/g, '');
  const chapter = code.substring(0, 2);
  const heading = code.substring(0, 4);

  // 4% Superreducido - Productos de primera necesidad (Art. 91.Dos Ley 37/1992)
  const superReduced = {
    // Pan comun, harinas panificables, leche, quesos, huevos, frutas, verduras,
    // cereales, legumbres (productos basicos sin transformar)
    headings: ['0407', '0408', '0401', '0402', '0403', '0404', '1001', '1002', '1003', '1004', '1005'],
    // Medicamentos de uso humano
    chapters: ['30']
  };

  // 10% Reducido - Alimentos en general (Art. 91.Uno Ley 37/1992)
  const reduced = {
    chapters: [
      '01', // Animales vivos
      '02', // Carnes
      '03', // Pescados
      '04', // Lacteos, huevos, miel
      '05', // Otros productos de origen animal
      '06', // Plantas vivas
      '07', // Legumbres, hortalizas
      '08', // Frutas
      '09', // Cafe, te, especias
      '10', // Cereales
      '11', // Molineria
      '12', // Semillas oleaginosas
      '13', // Gomas, resinas
      '14', // Materias trenzables
      '15', // Grasas y aceites
      '16', // Preparaciones de carne/pescado
      '19', // Preparaciones de cereales
      '20', // Preparaciones de legumbres/frutas
      '21', // Preparaciones alimenticias diversas
      '23', // Residuos industria alimentaria, piensos
    ]
  };

  // Verificar superreducido por capitulo
  if (superReduced.chapters.includes(chapter)) {
    return { rate: 4, type: 'super_reduced', description: 'IVA superreducido (Ley 37/1992 Art. 91.Dos)' };
  }

  // Verificar superreducido por partida especifica
  if (superReduced.headings.includes(heading)) {
    return { rate: 4, type: 'super_reduced', description: 'IVA superreducido (Ley 37/1992 Art. 91.Dos)' };
  }

  // Verificar reducido por capitulo
  if (reduced.chapters.includes(chapter)) {
    return { rate: 10, type: 'reduced', description: 'IVA reducido - Alimentos (Ley 37/1992 Art. 91.Uno)' };
  }

  // Agua (2201)
  if (heading === '2201') {
    return { rate: 10, type: 'reduced', description: 'IVA reducido - Agua (Ley 37/1992 Art. 91.Uno)' };
  }

  // 21% General - Todo lo demas
  return { rate: 21, type: 'standard', description: 'IVA general (Ley 37/1992 Art. 90)' };
}

function normalizeCode(code) {
  return code.replace(/[\s.]/g, '').padEnd(10, '0').substring(0, 10);
}

function getEstimatedDuty(taricCode) {
  const chapter = taricCode.substring(0, 2);

  // Estimaciones basadas en capitulo
  const chapterEstimates = {
    // Animales y productos animales
    '01': { rate: 0, vat: 10, desc: 'Animales vivos' },
    '02': { rate: 12.8, vat: 10, desc: 'Carnes' },
    '03': { rate: 12, vat: 10, desc: 'Pescados' },
    '04': { rate: 9, vat: 10, desc: 'Lacteos, huevos' },

    // Productos vegetales
    '07': { rate: 10.4, vat: 10, desc: 'Legumbres, hortalizas' },
    '08': { rate: 8, vat: 10, desc: 'Frutas' },

    // Productos alimenticios
    '16': { rate: 15, vat: 10, desc: 'Preparaciones de carne' },
    '17': { rate: 35, vat: 21, desc: 'Azucares' },
    '18': { rate: 8, vat: 21, desc: 'Cacao' },
    '19': { rate: 9, vat: 10, desc: 'Preparaciones de cereales' },
    '20': { rate: 17, vat: 10, desc: 'Preparaciones de legumbres' },
    '21': { rate: 12, vat: 10, desc: 'Preparaciones alimenticias' },
    '22': { rate: 0, vat: 21, desc: 'Bebidas' },

    // Quimicos
    '28': { rate: 5.5, vat: 21, desc: 'Productos quimicos inorganicos' },
    '29': { rate: 6.5, vat: 21, desc: 'Productos quimicos organicos' },
    '30': { rate: 0, vat: 4, desc: 'Productos farmaceuticos' },

    // Plasticos y caucho
    '39': { rate: 6.5, vat: 21, desc: 'Plasticos' },
    '40': { rate: 3, vat: 21, desc: 'Caucho' },

    // Textiles
    '50': { rate: 4, vat: 21, desc: 'Seda' },
    '51': { rate: 3.8, vat: 21, desc: 'Lana' },
    '52': { rate: 8, vat: 21, desc: 'Algodon' },
    '61': { rate: 12, vat: 21, desc: 'Prendas de punto' },
    '62': { rate: 12, vat: 21, desc: 'Prendas no de punto' },
    '63': { rate: 12, vat: 21, desc: 'Otros articulos textiles' },

    // Calzado
    '64': { rate: 8, vat: 21, desc: 'Calzado' },

    // Metales
    '72': { rate: 0, vat: 21, desc: 'Hierro y acero' },
    '73': { rate: 2.7, vat: 21, desc: 'Manufacturas de hierro' },
    '74': { rate: 0, vat: 21, desc: 'Cobre' },
    '76': { rate: 6, vat: 21, desc: 'Aluminio' },

    // Maquinaria y electronica
    '84': { rate: 0, vat: 21, desc: 'Maquinas y aparatos mecanicos' },
    '85': { rate: 0, vat: 21, desc: 'Maquinas y aparatos electricos' },

    // Vehiculos
    '87': { rate: 10, vat: 21, desc: 'Vehiculos' },

    // Instrumentos
    '90': { rate: 2.7, vat: 21, desc: 'Instrumentos opticos y medicos' },

    // Muebles
    '94': { rate: 0, vat: 21, desc: 'Muebles' },

    // Juguetes
    '95': { rate: 2.7, vat: 21, desc: 'Juguetes' }
  };

  const estimate = chapterEstimates[chapter] || { rate: 5, vat: 21, desc: 'Producto no clasificado' };

  return {
    code: taricCode,
    description: estimate.desc,
    dutyRate: estimate.rate,
    dutyType: 'ad_valorem',
    vatRate: estimate.vat,
    source: 'estimated',
    confidence: 60,
    warnings: ['Arancel ESTIMADO basado en capitulo. Verificar en TARIC oficial antes de declarar.']
  };
}

async function updateLocalDatabase(taricCode, dutyInfo) {
  try {
    await TaricCode.findOneAndUpdate(
      { code: taricCode },
      {
        code: taricCode,
        description: {
          es: dutyInfo.description_es || dutyInfo.description,
          en: dutyInfo.description
        },
        breakdown: {
          chapter: taricCode.substring(0, 2),
          heading: taricCode.substring(0, 4),
          subheading: taricCode.substring(0, 6),
          cnCode: taricCode.substring(0, 8),
          taricCode: taricCode
        },
        level: 10,
        duties: {
          thirdCountry: dutyInfo.dutyRate
        },
        vat: {
          applicable: dutyInfo.vatRate || 21
        },
        supplementaryUnit: dutyInfo.supplementaryUnit || { required: false },
        measures: dutyInfo.measures || [],
        isLeaf: true,
        isActive: true,
        lastUpdated: new Date()
      },
      { upsert: true }
    );
    logger.info(`Updated local DB with duty info for ${taricCode}`);
  } catch (error) {
    logger.warn(`Could not update local DB for ${taricCode}:`, error.message);
  }
}

/**
 * Limpiar cache en memoria
 */
function clearMemoryCache() {
  dutyCache.clear();
  logger.info('Duty cache cleared');
}

module.exports = {
  getDutyInfo,
  calculateDutiesWithAI,
  validateDutyRate,
  getArancelesFromAI,
  clearMemoryCache
};
