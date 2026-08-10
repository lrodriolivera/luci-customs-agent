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
    // Cerveza: Ley 38/1992 art. 26. Los tipos son POR HECTOLITRO y por epigrafe de
    // grado Plato (salvo los dos primeros, que van por grado alcoholico volumetrico).
    // Antes habia aqui `standard: 0.11 €/litro/grado alcoholico`, una tarifa que no
    // existe en la ley.
    BEER: {
      epigraph1a: 0,     // <= 1,2% vol
      epigraph1b: 2.75,  // > 1,2% y <= 2,8% vol
      epigraph2: 7.48,   // > 2,8% vol y grado Plato < 11
      epigraph3: 9.96,   // grado Plato >= 11 y <= 15
      epigraph4: 13.56,  // grado Plato > 15 y <= 19
      epigraph5: 0.91    // grado Plato > 19: €/hl y POR grado Plato
    },
    // Vino: Ley 38/1992 art. 30 — tranquilos y espumosos a CERO.
    WINE: {
      still: 0,
      sparkling: 0
    },
    // Productos intermedios: Ley 38/1992 art. 34, POR HECTOLITRO. Antes estaban
    // dentro de WINE como `intermediate: 0.85 €/litro`, un tipo que no existe.
    INTERMEDIATE: {
      upTo15: 38.48,  // <= 15% vol
      above15: 64.13  // los demas
    },
    // Alcohol etilico y bebidas derivadas: Ley 38/1992 art. 39 — 958,94 €/hectolitro
    // de alcohol puro, es decir 9,5894 €/litro. Estaba en 10,97 €/L, un 14% por encima
    // del tipo legal. El reducido estaba en 5,485 (la mitad del inflado); el tipo
    // reducido real es el del regimen de cosechero del art. 41: 226,36 €/hl.
    ETHYL_ALCOHOL: {
      standard: 9.5894, // €/litro de alcohol puro (958,94 €/hl, art. 39)
      reduced: 2.2636   // Regimen de cosechero (226,36 €/hl, art. 41)
    },
    // Bebidas derivadas: tributan por el MISMO tipo del art. 39 que el alcohol
    // etilico (958,94 €/hl de alcohol puro = 9,5894 €/L). Estaba en 10,97 €/L, un 14%
    // por encima. `anise: 8.78` era una tarifa aparte para anisados que la ley no
    // recoge: los anisados y el pacharan tributan como cualquier bebida derivada.
    SPIRITS: {
      standard: 9.5894 // €/litro de alcohol puro (958,94 €/hl, art. 39)
    }
  },

  // Impuesto sobre las Labores del Tabaco
  // Labores del tabaco: Ley 38/1992 art. 60, texto vigente consultado en el BOE el
  // 10/Ago/2026. Los ocho valores que habia estaban desfasados —cigarrillos al 55%
  // con 29,25 €/1000 y minimo 188, cigarros al 16,5%, picadura al 45% con 22 €/kg y
  // minimo 175, y "demas labores" al 25%—, ninguno coincidia con la ley.
  TOBACCO: {
    CIGARETTES: {
      specific: 33.50,      // €/1000 cigarrillos (epigrafe 2.b)
      proportional: 0.485,  // 48,5% sobre PVP (epigrafe 2.a)
      minimum: 150.00       // tipo unico minimo €/1000 cigarrillos
    },
    CIGARS: {
      proportional: 0.158,  // 15,8% sobre PVP (epigrafe 1)
      minimum: 47.00        // tipo unico minimo €/1000 unidades
    },
    FINE_CUT: {
      specific: 33.40,      // €/kg (epigrafe 3.b)
      proportional: 0.3768, // 37,68% sobre PVP (epigrafe 3.a)
      minimum: 112.50       // tipo unico minimo €/kg
    },
    OTHER_TOBACCO: {
      proportional: 0.34,   // 34% sobre PVP (epigrafe 4)
      minimum: 30.00        // tipo unico minimo €/kg
    }
  },

  // Impuesto sobre Hidrocarburos
  // Hidrocarburos: Ley 38/1992 art. 50, texto vigente consultado en el BOE el
  // 10/Ago/2026. El tipo de gravamen es la SUMA del tipo general y el especial
  // (72 €/1.000 l en carburantes de automocion), cosa que los valores anteriores no
  // recogian: gasolina estaba en 436 cuando son 400,69+72 = 472,69, y el gasoleo en
  // 331 cuando son 307+72 = 379.
  HYDROCARBONS: {
    GASOLINE: {
      unleaded95: 472.69, // €/1000 l — epigrafe 1.2.2 (400,69 general + 72 especial)
      unleaded97: 472.69,
      unleaded98: 503.92  // €/1000 l — epigrafe 1.2.1 (431,92 + 72), >= 98 I.O.
    },
    DIESEL: {
      standard: 379.00,     // €/1000 l — epigrafe 1.3 (307 general + 72 especial)
      professional: 379.00, // Mismo tipo; el gasoleo profesional es una devolucion parcial posterior
      heating: 83.00        // Gasoleo de calefaccion (epigrafe 1.4)
    },
    KEROSENE: {
      standard: 379.00, // €/1000 litros
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
 * Determinar el epigrafe de cerveza (Ley 38/1992, art. 26).
 *
 * Los epigrafes 1.a) y 1.b) van por grado alcoholico volumetrico; del 2 al 5 por
 * GRADO PLATO, que mide el extracto seco primitivo del mosto y no es lo mismo que
 * el grado alcoholico. Si no se declara el grado Plato se estima con la relacion
 * usada en la practica cervecera (~2,5 grados Plato por cada grado de alcohol) y se
 * marca como estimado: el importe definitivo exige el grado Plato real, y la ley
 * remite al analisis del producto.
 *
 * @param {number} alcoholContent - Grado alcoholico volumetrico (% vol)
 * @param {number} [platoDegrees] - Grado Plato declarado, si se conoce
 */
function obtenerEpigrafeCerveza(alcoholContent, platoDegrees) {
  const r = EXCISE_RATES.ALCOHOL.BEER;

  if (alcoholContent <= 1.2) {
    return { rate: r.epigraph1a, label: 'Epigrafe 1.a) <= 1,2% vol', plato: null, estimated: false };
  }
  if (alcoholContent <= 2.8) {
    return { rate: r.epigraph1b, label: 'Epigrafe 1.b) > 1,2% y <= 2,8% vol', plato: null, estimated: false };
  }

  const estimated = platoDegrees == null;
  const plato = estimated ? parseFloat((alcoholContent * 2.5).toFixed(1)) : platoDegrees;

  if (plato < 11) {
    return { rate: r.epigraph2, label: 'Epigrafe 2: > 2,8% vol y grado Plato < 11', plato, estimated };
  }
  if (plato <= 15) {
    return { rate: r.epigraph3, label: 'Epigrafe 3: grado Plato 11-15', plato, estimated };
  }
  if (plato <= 19) {
    return { rate: r.epigraph4, label: 'Epigrafe 4: grado Plato 15-19', plato, estimated };
  }
  return { rate: r.epigraph5, label: 'Epigrafe 5: grado Plato > 19', plato, estimated, perPlatoDegree: true };
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

  // Cerveza (2203). Ley 38/1992 art. 26: tributa POR HECTOLITRO segun epigrafes de
  // grado Plato, NO en €/litro/grado alcoholico. Lo que habia era una tarifa inventada
  // (0,11 €/L/grado) y ademas mal aplicada -`quantity * (alcoholContent/100) * rate`
  // dividia el grado entre 100 cuando la propia tarifa decia ser "por grado"-, asi que
  // ni siquiera cuadraba con el desglose que mostraba: 1.000 L al 5% salian 5,50 EUR
  // cuando esa formula da 550. El importe correcto por el epigrafe 3 es 99,60 EUR.
  if (taric4 === '2203') {
    subcategory = 'BEER';
    const hectolitros = quantity / 100;
    const epigrafe = obtenerEpigrafeCerveza(alcoholContent, product.platoDegrees);

    rate = epigrafe.rate;
    const amount = epigrafe.perPlatoDegree
      ? hectolitros * rate * epigrafe.plato
      : hectolitros * rate;

    calculation = epigrafe.perPlatoDegree
      ? `${hectolitros} hl × ${rate} €/hl/grado Plato × ${epigrafe.plato} grados Plato (${epigrafe.label})`
      : `${hectolitros} hl × ${rate} €/hl (${epigrafe.label})`;

    return {
      applicable: true,
      subcategory,
      rate,
      amount: parseFloat(amount.toFixed(2)),
      calculation,
      unit: epigrafe.perPlatoDegree ? '€/hl/grado Plato' : '€/hl',
      legalBasis: 'Ley 38/1992, art. 26',
      epigraph: epigrafe.label,
      platoDegrees: epigrafe.plato,
      platoEstimated: epigrafe.estimated
    };
  }

  // Vino y productos fermentados (2204, 2205, 2206).
  //
  // Ley 38/1992 art. 30: los vinos tranquilos y espumosos tributan a CERO. Lo que
  // habia trataba como "producto intermedio" a 0,85 €/L todo lo que estuviera entre
  // 1,2% y 15% vol, es decir, PRACTICAMENTE TODO EL VINO: un contenedor de 10.000 L
  // de Rioja liquidaba 8.500 EUR de impuesto especial inexistente. Y ni el tipo ni la
  // unidad eran los de la ley: los productos intermedios (art. 34) van por hectolitro
  // -38,48 €/hl hasta 15% vol y 64,13 €/hl por encima-, y son una categoria distinta
  // (2205 y vinos encabezados), no todo el capitulo 2204.
  if (['2204', '2205', '2206'].includes(taric4)) {
    subcategory = 'WINE';

    // Un vino encabezado por encima de 15% vol ya no es vino a efectos del impuesto:
    // pasa a producto intermedio (art. 34).
    if (alcoholContent > 15) {
      const hectolitros = quantity / 100;
      rate = alcoholContent <= 22
        ? EXCISE_RATES.ALCOHOL.INTERMEDIATE.upTo15
        : EXCISE_RATES.ALCOHOL.INTERMEDIATE.above15;
      const amount = hectolitros * rate;

      return {
        applicable: true,
        subcategory: 'INTERMEDIATE',
        rate,
        amount: parseFloat(amount.toFixed(2)),
        calculation: `${hectolitros} hl × ${rate} €/hl (producto intermedio)`,
        unit: '€/hl',
        legalBasis: 'Ley 38/1992, art. 34'
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
    const rates = EXCISE_RATES.TOBACCO.CIGARS;
    const units1000 = quantity / 1000;

    proportionalComponent = price * rates.proportional;
    // El epigrafe 1 del art. 60 impone un tipo unico minimo de 47 €/1.000 unidades:
    // "El importe del impuesto no puede ser inferior...". No se aplicaba, asi que un
    // puro barato liquidaba por debajo del minimo legal.
    minimumTax = units1000 * rates.minimum;
    const amount = Math.max(proportionalComponent, minimumTax);

    calculation = `Max(${price} € × ${rates.proportional}, ${units1000.toFixed(2)} × ${rates.minimum} €)`;

    return {
      applicable: true,
      subcategory,
      proportionalComponent: parseFloat(proportionalComponent.toFixed(2)),
      minimumTax: parseFloat(minimumTax.toFixed(2)),
      amount: parseFloat(amount.toFixed(2)),
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
    const rates = EXCISE_RATES.TOBACCO.OTHER_TOBACCO;
    const pesoKg = unit === 'kg' ? quantity : quantity / 1000;

    proportionalComponent = price * rates.proportional;
    // Epigrafe 4 del art. 60: tipo unico de 30 €/kg cuando la cuota proporcional
    // resulte inferior. No se aplicaba.
    minimumTax = pesoKg * rates.minimum;
    const amount = Math.max(proportionalComponent, minimumTax);

    calculation = `Max(${price} € × ${rates.proportional}, ${pesoKg} kg × ${rates.minimum} €/kg)`;

    return {
      applicable: true,
      subcategory,
      proportionalComponent: parseFloat(proportionalComponent.toFixed(2)),
      minimumTax: parseFloat(minimumTax.toFixed(2)),
      amount: parseFloat(amount.toFixed(2)),
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
