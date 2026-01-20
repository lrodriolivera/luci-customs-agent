/**
 * Excise Duties Service (SILICIE System)
 * Servicio para gestión de Impuestos Especiales en España
 * Cubre: Alcohol, Tabaco, Hidrocarburos
 */

const logger = require('../config/logger');

/**
 * Categorías de productos sujetos a Impuestos Especiales
 * Basado en TARIC y legislación española (Ley 38/1992)
 */
const EXCISE_CATEGORIES = {
  ALCOHOL: {
    name: 'Bebidas Alcohólicas',
    taricRanges: [
      { start: '2203', end: '2203', description: 'Cerveza' },
      { start: '2204', end: '2204', description: 'Vino' },
      { start: '2205', end: '2205', description: 'Vermut' },
      { start: '2206', end: '2206', description: 'Otras bebidas fermentadas' },
      { start: '2207', end: '2207', description: 'Alcohol etílico sin desnaturalizar' },
      { start: '2208', end: '2208', description: 'Bebidas espirituosas' }
    ],
    subcategories: {
      BEER: 'Cerveza',
      WINE: 'Vino y bebidas fermentadas',
      INTERMEDIATE: 'Productos intermedios',
      ETHYL_ALCOHOL: 'Alcohol etílico',
      SPIRITS: 'Bebidas derivadas'
    }
  },
  TOBACCO: {
    name: 'Labores del Tabaco',
    taricRanges: [
      { start: '2402', end: '2402', description: 'Cigarros (puros) y cigarritos' },
      { start: '2403', end: '2403', description: 'Demás tabacos y sucedáneos' }
    ],
    subcategories: {
      CIGARETTES: 'Cigarrillos',
      CIGARS: 'Cigarros (puros) y cigarritos',
      FINE_CUT: 'Picadura para liar',
      OTHER_TOBACCO: 'Demás labores de tabaco'
    }
  },
  HYDROCARBONS: {
    name: 'Hidrocarburos',
    taricRanges: [
      { start: '2701', end: '2701', description: 'Hullas' },
      { start: '2702', end: '2702', description: 'Lignitos' },
      { start: '2710', end: '2710', description: 'Aceites de petróleo' },
      { start: '2711', end: '2711', description: 'Gas de petróleo y demás hidrocarburos gaseosos' },
      { start: '2712', end: '2712', description: 'Vaselina, parafina' },
      { start: '2713', end: '2713', description: 'Coque de petróleo, betún' },
      { start: '2714', end: '2714', description: 'Betunes y asfaltos naturales' },
      { start: '2715', end: '2715', description: 'Mezclas bituminosas' }
    ],
    subcategories: {
      GASOLINE: 'Gasolinas',
      DIESEL: 'Gasóleo',
      KEROSENE: 'Queroseno',
      FUEL_OIL: 'Fuelóleo',
      LPG: 'Gases licuados del petróleo',
      NATURAL_GAS: 'Gas natural',
      COAL: 'Carbón'
    }
  },
  ELECTRICITY: {
    name: 'Electricidad',
    taricRanges: [
      { start: '2716', end: '2716', description: 'Energía eléctrica' }
    ]
  }
};

/**
 * Tarifas de Impuestos Especiales (2024)
 * Fuente: Ley 38/1992 y actualizaciones en Ley de Presupuestos
 */
const EXCISE_RATES = {
  // Impuesto sobre el Alcohol y Bebidas Derivadas
  ALCOHOL: {
    BEER: {
      standard: 0.11, // €/litro/grado alcohólico (11 céntimos)
      reduced: 0.055, // Cerveza <= 1.2% volumen
      smallBrewery: 0.088 // Producción < 200,000 hl/año
    },
    WINE: {
      still: 0, // Exento
      sparkling: 0, // Exento
      intermediate: 0.85 // €/litro (productos intermedios 1.2%-15%)
    },
    ETHYL_ALCOHOL: {
      standard: 10.97, // €/litro de alcohol puro
      reduced: 5.485 // Pequeños productores
    },
    SPIRITS: {
      standard: 10.97, // €/litro de alcohol puro
      anise: 8.78 // Anisados y pacharán
    }
  },

  // Impuesto sobre las Labores del Tabaco
  TOBACCO: {
    CIGARETTES: {
      specific: 29.25, // €/1000 cigarrillos
      proportional: 0.55, // 55% sobre precio venta
      minimum: 188.00 // €/1000 cigarrillos (mínimo)
    },
    CIGARS: {
      proportional: 0.165 // 16.5% sobre precio venta
    },
    FINE_CUT: {
      specific: 22.00, // €/kg
      proportional: 0.45, // 45% sobre precio venta
      minimum: 175.00 // €/kg (mínimo)
    },
    OTHER_TOBACCO: {
      proportional: 0.25 // 25% sobre precio venta
    }
  },

  // Impuesto sobre Hidrocarburos
  HYDROCARBONS: {
    GASOLINE: {
      unleaded95: 436.00, // €/1000 litros
      unleaded97: 436.00,
      unleaded98: 436.00
    },
    DIESEL: {
      standard: 331.00, // €/1000 litros
      professional: 331.00, // Con devolución parcial
      heating: 83.00 // Gasóleo de calefacción
    },
    KEROSENE: {
      standard: 331.00, // €/1000 litros
      heating: 83.00
    },
    FUEL_OIL: {
      standard: 13.00 // €/tonelada
    },
    LPG: {
      automotive: 64.00, // €/1000 kg
      other: 0 // Exento otros usos
    },
    NATURAL_GAS: {
      automotive: 0.65, // €/gigajulio
      other: 0.15
    },
    COAL: {
      standard: 0.65 // €/gigajulio
    }
  },

  // Impuesto sobre la Electricidad
  ELECTRICITY: {
    standard: 0.051127, // €/kWh (5.11269632%)
    reduced: 0.5 // Reducción 85% para ciertos usos
  }
};

/**
 * Exenciones y reducciones
 */
const EXEMPTIONS = {
  ALCOHOL: [
    'Producción para uso propio (< 1000 litros/año)',
    'Alcohol completamente desnaturalizado',
    'Uso en hospitales, farmacias (bajo autorización)',
    'Muestras de análisis',
    'Pérdidas inevitables'
  ],
  TOBACCO: [
    'Exportación fuera de UE',
    'Muestras sin valor comercial',
    'Destrucción bajo control'
  ],
  HYDROCARBONS: [
    'Uso distinto de carburante o combustible',
    'Exportación fuera de territorio de aplicación',
    'Navegación aérea (excepto aviación privada)',
    'Navegación marítima (excepto embarcaciones privadas)',
    'Gasóleo profesional (devolución parcial)',
    'Biocombustibles puros'
  ],
  ELECTRICITY: [
    'Autoproducción < 10 MVA',
    'Generación mediante fuentes renovables',
    'Cogeneración alta eficiencia',
    'Producción en Ceuta y Melilla'
  ]
};

/**
 * Detectar si un producto está sujeto a Impuestos Especiales
 */
function detectExciseProduct(taricCode) {
  if (!taricCode || taricCode.length < 4) {
    return { subject: false, category: null };
  }

  const taric4 = taricCode.substring(0, 4);

  for (const [categoryKey, category] of Object.entries(EXCISE_CATEGORIES)) {
    for (const range of category.taricRanges) {
      if (taric4 >= range.start && taric4 <= range.end) {
        return {
          subject: true,
          category: categoryKey,
          categoryName: category.name,
          description: range.description,
          taricRange: `${range.start}-${range.end}`
        };
      }
    }
  }

  return { subject: false, category: null };
}

/**
 * Calcular Impuesto sobre Alcohol
 */
function calculateAlcoholExcise(product) {
  const { taricCode, quantity, alcoholContent, price } = product;

  if (!quantity || !alcoholContent) {
    return {
      applicable: false,
      error: 'Se requiere quantity y alcoholContent para productos alcohólicos'
    };
  }

  let rate = 0;
  let subcategory = '';
  let calculation = '';

  const taric4 = taricCode.substring(0, 4);

  // Cerveza (2203)
  if (taric4 === '2203') {
    subcategory = 'BEER';
    if (alcoholContent <= 1.2) {
      rate = EXCISE_RATES.ALCOHOL.BEER.reduced;
      calculation = `${quantity} L × ${alcoholContent}% × ${rate} €/L/grado`;
    } else {
      rate = EXCISE_RATES.ALCOHOL.BEER.standard;
      calculation = `${quantity} L × ${alcoholContent}% × ${rate} €/L/grado`;
    }
    const amount = quantity * (alcoholContent / 100) * rate;

    return {
      applicable: true,
      subcategory,
      rate,
      amount: parseFloat(amount.toFixed(2)),
      calculation,
      unit: '€/L/grado alcohólico'
    };
  }

  // Vino y productos fermentados (2204, 2205, 2206)
  if (['2204', '2205', '2206'].includes(taric4)) {
    subcategory = 'WINE';

    // Productos intermedios (1.2% - 15% volumen)
    if (alcoholContent > 1.2 && alcoholContent <= 15) {
      rate = EXCISE_RATES.ALCOHOL.WINE.intermediate;
      const amount = quantity * rate;
      calculation = `${quantity} L × ${rate} €/L`;

      return {
        applicable: true,
        subcategory: 'INTERMEDIATE',
        rate,
        amount: parseFloat(amount.toFixed(2)),
        calculation,
        unit: '€/litro'
      };
    }

    // Vinos normales exentos
    return {
      applicable: false,
      subcategory,
      exemption: 'Vino y bebidas fermentadas (no intermedios) están exentos',
      amount: 0
    };
  }

  // Alcohol etílico (2207) y bebidas espirituosas (2208)
  if (['2207', '2208'].includes(taric4)) {
    subcategory = taric4 === '2207' ? 'ETHYL_ALCOHOL' : 'SPIRITS';
    rate = EXCISE_RATES.ALCOHOL.SPIRITS.standard;

    // Calcular litros de alcohol puro
    const pureAlcoholLiters = quantity * (alcoholContent / 100);
    const amount = pureAlcoholLiters * rate;
    calculation = `${quantity} L × ${alcoholContent}% × ${rate} €/L alcohol puro`;

    return {
      applicable: true,
      subcategory,
      rate,
      amount: parseFloat(amount.toFixed(2)),
      pureAlcoholLiters: parseFloat(pureAlcoholLiters.toFixed(2)),
      calculation,
      unit: '€/litro alcohol puro'
    };
  }

  return { applicable: false, error: 'TARIC no corresponde a producto alcohólico' };
}

/**
 * Calcular Impuesto sobre Tabaco
 */
function calculateTobaccoExcise(product) {
  const { taricCode, quantity, unit, price } = product;

  if (!quantity || !price) {
    return {
      applicable: false,
      error: 'Se requiere quantity y price para labores del tabaco'
    };
  }

  let subcategory = '';
  let specificComponent = 0;
  let proportionalComponent = 0;
  let minimumTax = 0;
  let calculation = '';

  const taric6 = taricCode.substring(0, 6);

  // Cigarrillos (240220)
  if (taric6 === '240220') {
    subcategory = 'CIGARETTES';
    const rates = EXCISE_RATES.TOBACCO.CIGARETTES;

    // Convertir a unidades por 1000
    const units1000 = quantity / 1000;

    specificComponent = units1000 * rates.specific;
    proportionalComponent = price * rates.proportional;
    const total = specificComponent + proportionalComponent;

    // Aplicar mínimo
    minimumTax = units1000 * rates.minimum;
    const amount = Math.max(total, minimumTax);

    calculation = `Max((${units1000.toFixed(2)} × ${rates.specific} €) + (${price} € × ${rates.proportional}), ${units1000.toFixed(2)} × ${rates.minimum} €)`;

    return {
      applicable: true,
      subcategory,
      specificComponent: parseFloat(specificComponent.toFixed(2)),
      proportionalComponent: parseFloat(proportionalComponent.toFixed(2)),
      minimumTax: parseFloat(minimumTax.toFixed(2)),
      amount: parseFloat(amount.toFixed(2)),
      calculation
    };
  }

  // Cigarros puros (240210, 240290)
  if (['240210', '240290'].includes(taric6)) {
    subcategory = 'CIGARS';
    proportionalComponent = price * EXCISE_RATES.TOBACCO.CIGARS.proportional;
    calculation = `${price} € × ${EXCISE_RATES.TOBACCO.CIGARS.proportional}`;

    return {
      applicable: true,
      subcategory,
      proportionalComponent: parseFloat(proportionalComponent.toFixed(2)),
      amount: parseFloat(proportionalComponent.toFixed(2)),
      calculation
    };
  }

  // Picadura para liar (240310)
  if (taric6.startsWith('24031')) {
    subcategory = 'FINE_CUT';
    const rates = EXCISE_RATES.TOBACCO.FINE_CUT;
    const weightKg = unit === 'kg' ? quantity : quantity / 1000;

    specificComponent = weightKg * rates.specific;
    proportionalComponent = price * rates.proportional;
    const total = specificComponent + proportionalComponent;

    minimumTax = weightKg * rates.minimum;
    const amount = Math.max(total, minimumTax);

    calculation = `Max((${weightKg} kg × ${rates.specific} €/kg) + (${price} € × ${rates.proportional}), ${weightKg} kg × ${rates.minimum} €/kg)`;

    return {
      applicable: true,
      subcategory,
      specificComponent: parseFloat(specificComponent.toFixed(2)),
      proportionalComponent: parseFloat(proportionalComponent.toFixed(2)),
      minimumTax: parseFloat(minimumTax.toFixed(2)),
      amount: parseFloat(amount.toFixed(2)),
      calculation
    };
  }

  // Otros tabacos (240391, 240399)
  if (taric6.startsWith('24039')) {
    subcategory = 'OTHER_TOBACCO';
    proportionalComponent = price * EXCISE_RATES.TOBACCO.OTHER_TOBACCO.proportional;
    calculation = `${price} € × ${EXCISE_RATES.TOBACCO.OTHER_TOBACCO.proportional}`;

    return {
      applicable: true,
      subcategory,
      proportionalComponent: parseFloat(proportionalComponent.toFixed(2)),
      amount: parseFloat(proportionalComponent.toFixed(2)),
      calculation
    };
  }

  return { applicable: false, error: 'TARIC no corresponde a labor del tabaco' };
}

/**
 * Calcular Impuesto sobre Hidrocarburos
 */
function calculateHydrocarbonExcise(product) {
  const { taricCode, quantity, unit, productType } = product;

  if (!quantity) {
    return {
      applicable: false,
      error: 'Se requiere quantity para productos hidrocarburos'
    };
  }

  let rate = 0;
  let subcategory = productType || 'UNKNOWN';
  let calculation = '';
  let unitType = unit || 'L';

  const taric4 = taricCode.substring(0, 4);

  // Aceites de petróleo (2710)
  if (taric4 === '2710') {
    // Gasolinas
    if (productType === 'GASOLINE' || taricCode.includes('271012')) {
      subcategory = 'GASOLINE';
      rate = EXCISE_RATES.HYDROCARBONS.GASOLINE.unleaded95;
      const amount = (quantity / 1000) * rate; // Tarifa por 1000 litros
      calculation = `${quantity} L / 1000 × ${rate} €/1000L`;

      return {
        applicable: true,
        subcategory,
        rate,
        amount: parseFloat(amount.toFixed(2)),
        calculation,
        unit: '€/1000 litros'
      };
    }

    // Gasóleo
    if (productType === 'DIESEL' || taricCode.includes('271019') || taricCode.includes('271020')) {
      subcategory = 'DIESEL';
      rate = EXCISE_RATES.HYDROCARBONS.DIESEL.standard;
      const amount = (quantity / 1000) * rate;
      calculation = `${quantity} L / 1000 × ${rate} €/1000L`;

      return {
        applicable: true,
        subcategory,
        rate,
        amount: parseFloat(amount.toFixed(2)),
        calculation,
        unit: '€/1000 litros',
        note: 'Gasóleo profesional puede tener devolución parcial'
      };
    }

    // Fuelóleo
    if (productType === 'FUEL_OIL') {
      subcategory = 'FUEL_OIL';
      rate = EXCISE_RATES.HYDROCARBONS.FUEL_OIL.standard;
      const weightTons = unitType === 'ton' ? quantity : quantity / 1000;
      const amount = weightTons * rate;
      calculation = `${weightTons} ton × ${rate} €/ton`;

      return {
        applicable: true,
        subcategory,
        rate,
        amount: parseFloat(amount.toFixed(2)),
        calculation,
        unit: '€/tonelada'
      };
    }
  }

  // Gases licuados (2711)
  if (taric4 === '2711') {
    subcategory = 'LPG';
    rate = EXCISE_RATES.HYDROCARBONS.LPG.automotive;
    const weightKg = unitType === 'kg' ? quantity : quantity * 0.54; // Aproximación L a kg
    const amount = (weightKg / 1000) * rate;
    calculation = `${weightKg} kg / 1000 × ${rate} €/1000kg`;

    return {
      applicable: true,
      subcategory,
      rate,
      amount: parseFloat(amount.toFixed(2)),
      calculation,
      unit: '€/1000 kg'
    };
  }

  // Carbón (2701, 2702)
  if (['2701', '2702'].includes(taric4)) {
    subcategory = 'COAL';
    rate = EXCISE_RATES.HYDROCARBONS.COAL.standard;
    // Aproximación: 1 tonelada carbón = 25 GJ
    const gigajoules = (unitType === 'ton' ? quantity : quantity / 1000) * 25;
    const amount = gigajoules * rate;
    calculation = `${quantity} ton × 25 GJ/ton × ${rate} €/GJ`;

    return {
      applicable: true,
      subcategory,
      rate,
      amount: parseFloat(amount.toFixed(2)),
      calculation,
      unit: '€/gigajulio'
    };
  }

  return {
    applicable: false,
    error: 'TARIC no identificado o no sujeto a impuesto especial de hidrocarburos'
  };
}

/**
 * Calcular Impuesto sobre Electricidad
 */
function calculateElectricityExcise(product) {
  const { quantity, unit } = product;

  if (!quantity) {
    return {
      applicable: false,
      error: 'Se requiere quantity para electricidad'
    };
  }

  const kWh = unit === 'MWh' ? quantity * 1000 : quantity;
  const rate = EXCISE_RATES.ELECTRICITY.standard;
  const amount = kWh * rate;

  return {
    applicable: true,
    subcategory: 'ELECTRICITY',
    rate,
    amount: parseFloat(amount.toFixed(2)),
    calculation: `${kWh} kWh × ${rate} €/kWh`,
    unit: '€/kWh',
    note: 'Puede aplicarse reducción del 85% para ciertos usos industriales'
  };
}

/**
 * Calcular Impuestos Especiales para un producto
 */
function calculateExciseDuty(product) {
  try {
    const detection = detectExciseProduct(product.taricCode);

    if (!detection.subject) {
      return {
        applicable: false,
        reason: 'Producto no sujeto a Impuestos Especiales'
      };
    }

    let result = {
      applicable: true,
      category: detection.category,
      categoryName: detection.categoryName,
      description: detection.description,
      taricCode: product.taricCode,
      product: product.description
    };

    // Calcular según categoría
    switch (detection.category) {
      case 'ALCOHOL':
        Object.assign(result, calculateAlcoholExcise(product));
        break;
      case 'TOBACCO':
        Object.assign(result, calculateTobaccoExcise(product));
        break;
      case 'HYDROCARBONS':
        Object.assign(result, calculateHydrocarbonExcise(product));
        break;
      case 'ELECTRICITY':
        Object.assign(result, calculateElectricityExcise(product));
        break;
      default:
        result.applicable = false;
        result.error = 'Categoría no implementada';
    }

    return result;

  } catch (error) {
    logger.error('[ExciseDuties] Error calculating:', error);
    return {
      applicable: false,
      error: error.message
    };
  }
}

/**
 * Calcular Impuestos Especiales para múltiples productos
 */
function calculateTotalExciseDuties(goods) {
  const results = {
    total: 0,
    byCategory: {},
    items: []
  };

  for (const good of goods) {
    const excise = calculateExciseDuty(good);

    if (excise.applicable && excise.amount) {
      results.total += excise.amount;

      const category = excise.category;
      if (!results.byCategory[category]) {
        results.byCategory[category] = {
          categoryName: excise.categoryName,
          amount: 0,
          items: []
        };
      }

      results.byCategory[category].amount += excise.amount;
      results.byCategory[category].items.push({
        taricCode: good.taricCode,
        description: good.description,
        amount: excise.amount
      });
    }

    results.items.push({
      taricCode: good.taricCode,
      description: good.description,
      excise
    });
  }

  results.total = parseFloat(results.total.toFixed(2));

  return results;
}

/**
 * Generar documento DUA-SILICIE
 * (Documento Único de Aduanas para Impuestos Especiales)
 */
function generateSILICIEDocument(operation, exciseDuties) {
  const document = {
    documentType: 'DUA-SILICIE',
    documentNumber: `SILICIE-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    operation: {
      type: operation.type,
      originCountry: operation.originCountry,
      destinationCountry: operation.destinationCountry || 'ES'
    },
    exciseDuties: {
      total: exciseDuties.total,
      breakdown: exciseDuties.byCategory
    },
    goods: exciseDuties.items.filter(item => item.excise.applicable),
    requirements: [],
    guarantees: []
  };

  // Determinar requisitos según categorías presentes
  const categories = Object.keys(exciseDuties.byCategory);

  if (categories.includes('ALCOHOL')) {
    document.requirements.push({
      type: 'REGISTRO_OPERADOR',
      description: 'Registro como operador de bebidas alcohólicas',
      authority: 'Agencia Tributaria - SILICIE'
    });
    document.requirements.push({
      type: 'DOCUMENTO_ACOMPAÑAMIENTO',
      description: 'Documento administrativo electrónico (DAE/e-AD)',
      system: 'EMCS (Excise Movement and Control System)'
    });
  }

  if (categories.includes('TOBACCO')) {
    document.requirements.push({
      type: 'AUTORIZACION_TABACO',
      description: 'Autorización especial para labores del tabaco',
      authority: 'Comisionado para el Mercado de Tabacos'
    });
    document.requirements.push({
      type: 'MARCA_FISCAL',
      description: 'Adquisición y aplicación de marcas fiscales',
      note: 'Obligatorio para cigarrillos y picadura'
    });
  }

  if (categories.includes('HYDROCARBONS')) {
    document.requirements.push({
      type: 'REGISTRO_HIDROCARBUROS',
      description: 'Registro de operadores de hidrocarburos',
      authority: 'Agencia Tributaria - SILICIE'
    });
  }

  // Garantías
  if (exciseDuties.total > 0) {
    document.guarantees.push({
      type: 'GUARANTEE',
      description: 'Garantía para suspensión de impuestos especiales',
      amount: parseFloat((exciseDuties.total * 1.5).toFixed(2)), // 150% del impuesto
      note: 'Requerida para circulación en régimen suspensivo'
    });
  }

  return document;
}

/**
 * Verificar exenciones aplicables
 */
function checkExemptions(product, usage) {
  const detection = detectExciseProduct(product.taricCode);

  if (!detection.subject) {
    return { exempt: false, reason: 'Producto no sujeto a impuestos especiales' };
  }

  const applicableExemptions = EXEMPTIONS[detection.category] || [];

  // Análisis básico según uso declarado
  const exemptionMatches = [];

  if (usage && usage.toLowerCase().includes('export')) {
    exemptionMatches.push('Exportación fuera de territorio de aplicación');
  }

  if (usage && usage.toLowerCase().includes('medical')) {
    exemptionMatches.push('Uso en hospitales, farmacias (bajo autorización)');
  }

  if (usage && usage.toLowerCase().includes('analysis')) {
    exemptionMatches.push('Muestras de análisis');
  }

  return {
    category: detection.category,
    availableExemptions: applicableExemptions,
    potentialMatches: exemptionMatches,
    requiresDocumentation: exemptionMatches.length > 0
  };
}

module.exports = {
  EXCISE_CATEGORIES,
  EXCISE_RATES,
  EXEMPTIONS,
  detectExciseProduct,
  calculateExciseDuty,
  calculateTotalExciseDuties,
  generateSILICIEDocument,
  checkExemptions,

  // Métodos específicos por categoría
  calculateAlcoholExcise,
  calculateTobaccoExcise,
  calculateHydrocarbonExcise,
  calculateElectricityExcise
};
