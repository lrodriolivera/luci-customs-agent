const { TaricCode, Expedition } = require('../models');
const logger = require('../config/logger');
const axios = require('axios');

// Cache para tipos de cambio (se actualiza cada hora)
let exchangeRatesCache = {
  rates: {},
  lastUpdate: null
};

/**
 * Calcular aranceles para un producto
 * POST /api/calculation/duties
 */
const calculateDuties = async (req, res) => {
  try {
    const { taricCode, value, currency, origin, weight, preference } = req.body;

    // Obtener info TARIC
    const taricInfo = await TaricCode.findOne({ code: taricCode });

    if (!taricInfo) {
      return res.status(404).json({
        success: false,
        error: 'Codigo TARIC no encontrado'
      });
    }

    // Convertir a EUR si es necesario
    let valueEur = value;
    if (currency && currency !== 'EUR') {
      const rate = await getExchangeRate(currency, 'EUR');
      valueEur = value * rate;
    }

    // Determinar tipo de arancel segun origen y preferencia
    let dutyRate = taricInfo.duties?.thirdCountry || 0;

    // Verificar preferencias arancelarias
    if (preference && preference !== '100' && taricInfo.preferences) {
      const preferentialTreatment = taricInfo.preferences.find(p =>
        p.countries.includes(origin) || p.agreement === getPreferenceAgreement(preference)
      );
      if (preferentialTreatment) {
        dutyRate = preferentialTreatment.dutyRate || 0;
      }
    }

    // Calcular arancel ad valorem
    let dutyAmount = valueEur * (dutyRate / 100);

    // Si hay arancel especifico (por peso, unidades, etc.)
    if (taricInfo.duties?.specific && weight) {
      const specificDuty = calculateSpecificDuty(taricInfo.duties.specific, weight);
      dutyAmount += specificDuty;
    }

    // Arancel mixto (ad valorem + especifico con minimo/maximo)
    if (taricInfo.duties?.mixed) {
      const mixedDuty = calculateMixedDuty(taricInfo.duties.mixed, valueEur, weight);
      dutyAmount = mixedDuty;
    }

    res.json({
      success: true,
      data: {
        taricCode,
        origin,
        preference: preference || '100',
        originalValue: value,
        currency: currency || 'EUR',
        valueEur,
        dutyRate,
        dutyAmount: Math.round(dutyAmount * 100) / 100,
        dutyType: taricInfo.duties?.specific ? 'mixed' : 'ad_valorem',
        notes: getDutyNotes(taricInfo, origin, preference)
      }
    });

  } catch (error) {
    logger.error('Error calculando aranceles:', error);
    res.status(500).json({
      success: false,
      error: 'Error al calcular aranceles'
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

    // Obtener tipo de IVA
    let vatRate = 21; // Por defecto

    if (taricCode) {
      const taricInfo = await TaricCode.findOne({ code: taricCode });
      if (taricInfo && taricInfo.vat) {
        vatRate = taricInfo.vat.applicable || taricInfo.vat.standard || 21;
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

    for (const item of itemsToCalculate) {
      const taricInfo = await TaricCode.findOne({ code: item.taricCode });

      // Convertir a EUR
      let valueEur = item.value;
      if (item.currency && item.currency !== 'EUR') {
        const rate = await getExchangeRate(item.currency, 'EUR');
        valueEur = item.value * rate;
      }

      // Arancel
      let dutyRate = taricInfo?.duties?.thirdCountry || 0;
      if (preference && preference !== '100' && taricInfo?.preferences) {
        const pref = taricInfo.preferences.find(p =>
          p.countries?.includes(item.origin)
        );
        if (pref) dutyRate = pref.dutyRate || 0;
      }
      const dutyAmount = valueEur * (dutyRate / 100);

      // IVA
      const vatRate = taricInfo?.vat?.applicable || 21;
      const vatBase = valueEur + dutyAmount;
      const vatAmount = vatBase * (vatRate / 100);

      // Impuestos especiales
      let specialTaxAmount = 0;
      if (taricInfo?.specialTaxes && taricInfo.specialTaxes.length > 0) {
        for (const tax of taricInfo.specialTaxes) {
          if (tax.unit === 'EUR/100kg' && item.weight) {
            specialTaxAmount += (item.weight / 100) * tax.rate;
          } else {
            specialTaxAmount += valueEur * (tax.rate / 100);
          }
        }
      }

      totalInvoiceValue += valueEur;
      totalDuties += dutyAmount;
      totalVat += vatAmount;
      totalSpecialTaxes += specialTaxAmount;

      itemCalculations.push({
        taricCode: item.taricCode,
        description: taricInfo?.description?.es || 'N/A',
        valueEur: Math.round(valueEur * 100) / 100,
        dutyRate,
        dutyAmount: Math.round(dutyAmount * 100) / 100,
        vatRate,
        vatAmount: Math.round(vatAmount * 100) / 100,
        specialTaxes: Math.round(specialTaxAmount * 100) / 100
      });
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
      error: 'Error al calcular impuestos'
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

module.exports = {
  calculateDuties,
  calculateVat,
  calculateTotal,
  getExchangeRate: getExchangeRateEndpoint
};
