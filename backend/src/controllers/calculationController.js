const { TaricCode, Expedition } = require('../models');
const logger = require('../config/logger');
const axios = require('axios');
const dutyCalculationService = require('../services/dutyCalculationService');

// Cache para tipos de cambio (se actualiza cada hora)
let exchangeRatesCache = {
  rates: {},
  lastUpdate: null
};

/**
 * Calcular aranceles para un producto
 * POST /api/calculation/duties
 * MEJORADO: Usa IA para obtener aranceles actualizados cuando no estan en BD local
 */
const calculateDuties = async (req, res) => {
  try {
    // Accept both field naming conventions for backwards compatibility
    const taricCode = req.body.taricCode || req.body.code;
    const value = req.body.value || req.body.customsValue;
    const currency = req.body.currency;
    const origin = req.body.origin || req.body.countryOfOrigin;
    const weight = req.body.weight || req.body.netWeight;
    const preference = req.body.preference;
    const quantity = req.body.quantity;
    const importDate = req.body.importDate;

    if (!taricCode) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere codigo TARIC'
      });
    }

    // Convertir a EUR si es necesario
    let valueEur = value || 0;
    if (currency && currency !== 'EUR' && value) {
      const rate = await getExchangeRate(currency, 'EUR');
      valueEur = value * rate;
    }

    // Usar nuevo servicio con IA para obtener aranceles
    const calculation = await dutyCalculationService.calculateDutiesWithAI({
      taricCode,
      customsValue: valueEur,
      origin: origin || null,
      preference: preference || '100',
      quantity: quantity || null,
      netWeight: weight || null,
      importDate: importDate || null
    });

    // Formatear respuesta compatible con frontend existente
    res.json({
      success: true,
      data: {
        taricCode: calculation.taricCode,
        description: calculation.description,
        origin: calculation.origin,
        preference: preference || '100',
        originalValue: value,
        currency: currency || 'EUR',
        valueEur,
        customsValue: calculation.customsValue,

        // Aranceles
        dutyRate: calculation.duties.effectiveDutyRate,
        baseDutyRate: calculation.duties.baseDutyRate,
        dutyAmount: calculation.duties.totalDuty,
        dutyType: calculation.duties.dutyType,
        adValoremDuty: calculation.duties.adValoremDuty,
        specificDuty: calculation.duties.specificDuty,
        antidumpingDuty: calculation.duties.antidumpingDuty,

        // IVA
        vatRate: calculation.vat.rate,
        vatType: calculation.vat.type,
        vatDescription: calculation.vat.description,
        vatBase: calculation.vat.base,
        vatAmount: calculation.vat.amount,

        // Preferencia aplicada
        preferenceApplied: calculation.preferenceApplied,

        // Medidas especiales
        measures: calculation.measures,
        antidumping: calculation.antidumping,
        quota: calculation.quota,

        // Totales
        totalTaxes: calculation.totalTaxes,
        totalToPay: calculation.totalToPay,

        // Informacion adicional
        supplementaryUnit: calculation.supplementaryUnit,
        requiredDocuments: calculation.requiredDocuments,
        notes: calculation.warnings || [],
        warnings: calculation.warnings || [],

        // Aranceles estacionales
        seasonal: calculation.seasonal || null,
        importDate: calculation.importDate,

        // Metadata
        source: calculation.source,
        confidence: calculation.confidence,
        calculatedAt: calculation.calculatedAt
      }
    });

  } catch (error) {
    logger.error('Error calculando aranceles:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al calcular aranceles'
    });
  }
};

/**
 * Calcular IVA de importacion
 * POST /api/calculation/vat
 */
const calculateVat = async (req, res) => {
  try {
    const { taricCode, customsValue, dutyAmount, specialTaxes } = req.body;

    // Obtener tipo de IVA usando tabla por capitulo (Ley 37/1992)
    const dutyCalcService = require('../services/dutyCalculationService');
    let vatRate = 21;
    let vatType = 'standard';

    if (taricCode) {
      // Primero intentar desde la tabla autoritativa por capitulo
      const normalizedCode = taricCode.replace(/[\s.]/g, '').padEnd(10, '0').substring(0, 10);
      const dutyInfo = await dutyCalcService.getDutyInfo(normalizedCode);
      if (dutyInfo && dutyInfo.vatRate) {
        vatRate = dutyInfo.vatRate;
        vatType = dutyInfo.vatType || 'standard';
      }
    }

    // Base imponible = Valor en aduana + Aranceles + Impuestos especiales
    const taxBase = customsValue + (dutyAmount || 0) + (specialTaxes || 0);

    const vatAmount = taxBase * (vatRate / 100);

    res.json({
      success: true,
      data: {
        customsValue,
        dutyAmount: dutyAmount || 0,
        specialTaxes: specialTaxes || 0,
        taxBase,
        vatRate,
        vatType,
        vatAmount: Math.round(vatAmount * 100) / 100
      }
    });

  } catch (error) {
    logger.error('Error calculando IVA:', error);
    res.status(500).json({
      success: false,
      error: 'Error al calcular IVA'
    });
  }
};

/**
 * Calculo completo de impuestos
 * POST /api/calculation/total
 * MEJORADO: Usa IA para obtener aranceles actualizados
 */
const calculateTotal = async (req, res) => {
  try {
    const {
      expeditionId,
      items, // Array de { taricCode, value, currency, origin, weight, quantity }
      freightCost,
      insuranceCost,
      preference
    } = req.body;

    let expedition = null;
    if (expeditionId) {
      expedition = await Expedition.findById(expeditionId);
    }

    // Usar items del body o del expediente
    const itemsToCalculate = items || (expedition?.goods.map(g => ({
      taricCode: g.taricCode,
      value: g.invoiceValue,
      currency: 'EUR',
      origin: g.originCountry,
      weight: g.netWeight,
      quantity: g.quantity
    }))) || [];

    if (itemsToCalculate.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay items para calcular'
      });
    }

    let totalInvoiceValue = 0;
    let totalDuties = 0;
    let totalVat = 0;
    let totalSpecialTaxes = 0;
    const itemCalculations = [];
    const allWarnings = [];

    for (const item of itemsToCalculate) {
      // Convertir a EUR
      let valueEur = item.value || 0;
      if (item.currency && item.currency !== 'EUR' && item.value) {
        const rate = await getExchangeRate(item.currency, 'EUR');
        valueEur = item.value * rate;
      }

      // Usar servicio con IA para calcular aranceles
      try {
        const calculation = await dutyCalculationService.calculateDutiesWithAI({
          taricCode: item.taricCode,
          customsValue: valueEur,
          origin: item.origin || null,
          preference: preference || '100',
          quantity: item.quantity || null,
          netWeight: item.weight || null
        });

        totalInvoiceValue += valueEur;
        totalDuties += calculation.duties.totalDuty;
        totalVat += calculation.vat.amount;

        // Recopilar warnings
        if (calculation.warnings && calculation.warnings.length > 0) {
          allWarnings.push(...calculation.warnings.map(w => `${item.taricCode}: ${w}`));
        }

        itemCalculations.push({
          taricCode: item.taricCode,
          description: calculation.description || 'N/A',
          valueEur: Math.round(valueEur * 100) / 100,
          dutyRate: calculation.duties.effectiveDutyRate,
          baseDutyRate: calculation.duties.baseDutyRate,
          dutyAmount: Math.round(calculation.duties.totalDuty * 100) / 100,
          dutyType: calculation.duties.dutyType,
          vatRate: calculation.vat.rate,
          vatAmount: Math.round(calculation.vat.amount * 100) / 100,
          specialTaxes: 0,
          preferenceApplied: calculation.preferenceApplied,
          source: calculation.source,
          confidence: calculation.confidence,
          measures: calculation.measures,
          antidumping: calculation.antidumping
        });

      } catch (itemError) {
        logger.warn(`Error calculating duties for ${item.taricCode}:`, itemError.message);

        // Fallback: usar estimacion basica
        const fallbackRate = 5; // 5% por defecto
        const dutyAmount = valueEur * (fallbackRate / 100);
        const vatRate = 21;
        const vatAmount = (valueEur + dutyAmount) * (vatRate / 100);

        totalInvoiceValue += valueEur;
        totalDuties += dutyAmount;
        totalVat += vatAmount;

        allWarnings.push(`${item.taricCode}: Arancel estimado (5%) - verificar en TARIC oficial`);

        itemCalculations.push({
          taricCode: item.taricCode,
          description: 'Producto no identificado',
          valueEur: Math.round(valueEur * 100) / 100,
          dutyRate: fallbackRate,
          dutyAmount: Math.round(dutyAmount * 100) / 100,
          vatRate,
          vatAmount: Math.round(vatAmount * 100) / 100,
          specialTaxes: 0,
          source: 'fallback',
          confidence: 50
        });
      }
    }

    // Valor en aduana (CIF)
    const customsValue = totalInvoiceValue + (freightCost || 0) + (insuranceCost || 0);

    // Totales
    const totalTaxes = totalDuties + totalVat + totalSpecialTaxes;
    const totalToPay = customsValue + totalTaxes;

    // Garantia requerida (aprox)
    const guaranteeRequired = Math.ceil(totalTaxes * 1.1); // 110% de los impuestos

    const result = {
      summary: {
        invoiceTotal: Math.round(totalInvoiceValue * 100) / 100,
        freightCost: freightCost || 0,
        insuranceCost: insuranceCost || 0,
        customsValue: Math.round(customsValue * 100) / 100,
        totalDuties: Math.round(totalDuties * 100) / 100,
        totalVat: Math.round(totalVat * 100) / 100,
        totalSpecialTaxes: Math.round(totalSpecialTaxes * 100) / 100,
        totalTaxes: Math.round(totalTaxes * 100) / 100,
        totalToPay: Math.round(totalToPay * 100) / 100,
        guaranteeRequired: Math.round(guaranteeRequired * 100) / 100
      },
      items: itemCalculations,
      preference: preference || '100',
      currency: 'EUR',
      warnings: allWarnings,
      calculatedAt: new Date()
    };

    // Si hay expediente, actualizar calculos
    if (expedition) {
      expedition.calculations = {
        invoiceTotal: totalInvoiceValue,
        invoiceCurrency: 'EUR',
        exchangeRate: 1,
        invoiceTotalEur: totalInvoiceValue,
        freightCost: freightCost || 0,
        insuranceCost: insuranceCost || 0,
        customsValue,
        totalDuties,
        totalVat,
        totalSpecialTaxes,
        totalTaxes,
        guaranteeRequired,
        calculatedAt: new Date(),
        calculatedBy: 'ai'
      };

      // Actualizar items con calculos individuales
      itemCalculations.forEach((calc, index) => {
        if (expedition.goods[index]) {
          expedition.goods[index].dutyRate = calc.dutyRate;
          expedition.goods[index].dutyAmount = calc.dutyAmount;
          expedition.goods[index].vatRate = calc.vatRate;
          expedition.goods[index].vatAmount = calc.vatAmount;
          expedition.goods[index].specialTaxAmount = calc.specialTaxes;
        }
      });

      await expedition.save();
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error en calculo total:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al calcular impuestos'
    });
  }
};

/**
 * Obtener tipo de cambio
 * GET /api/calculation/exchange-rate
 */
const getExchangeRateEndpoint = async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar moneda origen (from) y destino (to)'
      });
    }

    const rate = await getExchangeRate(from.toUpperCase(), to.toUpperCase());

    res.json({
      success: true,
      data: {
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        rate,
        date: exchangeRatesCache.lastUpdate || new Date()
      }
    });

  } catch (error) {
    logger.error('Error obteniendo tipo de cambio:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tipo de cambio'
    });
  }
};

// ========== Funciones auxiliares ==========

async function getExchangeRate(from, to) {
  // Si ambas son iguales
  if (from === to) return 1;

  // Verificar cache (actualizar cada hora)
  const now = Date.now();
  if (exchangeRatesCache.lastUpdate && (now - exchangeRatesCache.lastUpdate) < 3600000) {
    if (exchangeRatesCache.rates[from] && exchangeRatesCache.rates[to]) {
      return exchangeRatesCache.rates[to] / exchangeRatesCache.rates[from];
    }
  }

  try {
    // Usar API del BCE o alternativa
    // Nota: En produccion usar API oficial del BCE
    const response = await axios.get(
      `https://api.exchangerate-api.com/v4/latest/EUR`,
      { timeout: 5000 }
    );

    exchangeRatesCache = {
      rates: { EUR: 1, ...response.data.rates },
      lastUpdate: now
    };

    if (from === 'EUR') {
      return exchangeRatesCache.rates[to] || 1;
    }
    if (to === 'EUR') {
      return 1 / (exchangeRatesCache.rates[from] || 1);
    }

    return exchangeRatesCache.rates[to] / exchangeRatesCache.rates[from];

  } catch (error) {
    logger.warn('Error obteniendo tipos de cambio, usando valores por defecto');
    // Valores aproximados de fallback
    const fallbackRates = {
      EUR: 1, USD: 1.08, GBP: 0.86, CNY: 7.8, JPY: 162
    };
    return (fallbackRates[to] || 1) / (fallbackRates[from] || 1);
  }
}

function calculateSpecificDuty(specific, weight) {
  const { amount, unit } = specific;
  if (unit === 'EUR/100kg') {
    return (weight / 100) * amount;
  }
  if (unit === 'EUR/kg') {
    return weight * amount;
  }
  return 0;
}

function calculateMixedDuty(mixed, value, weight) {
  const adValorem = value * (mixed.adValorem / 100);
  let specific = 0;

  if (mixed.specific && weight) {
    specific = calculateSpecificDuty(mixed.specific, weight);
  }

  // Normalmente es el mayor de los dos, o la suma
  return Math.max(adValorem, specific);
}

function getPreferenceAgreement(code) {
  const agreements = {
    '200': 'SPG',
    '300': 'PREFERENTIAL',
    '400': 'CUSTOMS_UNION'
  };
  return agreements[code] || null;
}

function getDutyNotes(taricInfo, origin, preference) {
  const notes = [];

  if (!taricInfo) {
    notes.push('Codigo TARIC no encontrado en base de datos local');
    return notes;
  }

  if (taricInfo.measures && taricInfo.measures.length > 0) {
    notes.push(`Este producto tiene ${taricInfo.measures.length} medida(s) especial(es)`);
  }

  if (taricInfo.requiredDocuments && taricInfo.requiredDocuments.length > 0) {
    notes.push(`Documentos requeridos: ${taricInfo.requiredDocuments.map(d => d.code).join(', ')}`);
  }

  if (preference !== '100' && !taricInfo.preferences?.some(p => p.countries?.includes(origin))) {
    notes.push('No se encontro preferencia arancelaria para el origen indicado');
  }

  return notes;
}

/**
 * Obtener informacion de aranceles con IA
 * GET /api/calculation/duty-info/:taricCode
 */
const getDutyInfo = async (req, res) => {
  try {
    const { taricCode } = req.params;
    const { origin } = req.query;

    const dutyInfo = await dutyCalculationService.getDutyInfo(taricCode, origin || null);

    if (!dutyInfo) {
      return res.status(404).json({
        success: false,
        error: 'No se pudo obtener informacion de aranceles'
      });
    }

    res.json({
      success: true,
      data: dutyInfo
    });

  } catch (error) {
    logger.error('Error obteniendo info de aranceles:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener informacion de aranceles'
    });
  }
};

/**
 * Validar arancel con IA
 * POST /api/calculation/validate-duty
 */
const validateDutyRate = async (req, res) => {
  try {
    const { taricCode, currentRate, origin } = req.body;

    if (!taricCode || currentRate === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere taricCode y currentRate'
      });
    }

    const validation = await dutyCalculationService.validateDutyRate(taricCode, currentRate, origin);

    if (!validation) {
      return res.status(500).json({
        success: false,
        error: 'No se pudo validar el arancel'
      });
    }

    res.json({
      success: true,
      data: validation
    });

  } catch (error) {
    logger.error('Error validando arancel:', error);
    res.status(500).json({
      success: false,
      error: 'Error al validar arancel'
    });
  }
};

/**
 * Limpiar cache de aranceles
 * DELETE /api/calculation/cache
 */
const clearCache = async (req, res) => {
  try {
    dutyCalculationService.clearMemoryCache();

    res.json({
      success: true,
      message: 'Cache de aranceles limpiado'
    });

  } catch (error) {
    logger.error('Error limpiando cache:', error);
    res.status(500).json({
      success: false,
      error: 'Error al limpiar cache'
    });
  }
};

module.exports = {
  calculateDuties,
  calculateVat,
  calculateTotal,
  getExchangeRate: getExchangeRateEndpoint,
  getDutyInfo,
  validateDutyRate,
  clearCache
};
