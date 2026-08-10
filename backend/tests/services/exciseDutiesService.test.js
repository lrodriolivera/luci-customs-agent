/**
 * Tests for Excise Duties Service
 */

const exciseDutiesService = require('../../src/services/exciseDutiesService');

describe('Excise Duties Service', () => {

  describe('detectExciseProduct', () => {
    test('should detect alcohol products (beer)', () => {
      const result = exciseDutiesService.detectExciseProduct('2203000010');

      expect(result.subject).toBe(true);
      expect(result.category).toBe('ALCOHOL');
      expect(result.categoryName).toBe('Bebidas Alcohólicas');
      expect(result.description).toBe('Cerveza');
    });

    test('should detect tobacco products (cigarettes)', () => {
      const result = exciseDutiesService.detectExciseProduct('2402200000');

      expect(result.subject).toBe(true);
      expect(result.category).toBe('TOBACCO');
      expect(result.categoryName).toBe('Labores del Tabaco');
    });

    test('should detect hydrocarbon products', () => {
      const result = exciseDutiesService.detectExciseProduct('2710123100');

      expect(result.subject).toBe(true);
      expect(result.category).toBe('HYDROCARBONS');
      expect(result.categoryName).toBe('Hidrocarburos');
    });

    test('should detect electricity', () => {
      const result = exciseDutiesService.detectExciseProduct('2716000000');

      expect(result.subject).toBe(true);
      expect(result.category).toBe('ELECTRICITY');
    });

    test('should not detect non-excise products', () => {
      const result = exciseDutiesService.detectExciseProduct('8517120000');

      expect(result.subject).toBe(false);
      expect(result.category).toBeNull();
    });

    test('should handle empty TARIC code', () => {
      const result = exciseDutiesService.detectExciseProduct('');

      expect(result.subject).toBe(false);
    });

    test('should handle short TARIC code', () => {
      const result = exciseDutiesService.detectExciseProduct('220');

      expect(result.subject).toBe(false);
    });
  });

  describe('calculateAlcoholExcise', () => {
    /**
     * Ley 38/1992 art. 26 (texto vigente consultado en el BOE el 10/Ago/2026): la
     * cerveza tributa POR HECTOLITRO segun epigrafes de GRADO PLATO, no en
     * €/litro/grado alcoholico.
     *
     * Estos tests fijaban la tarifa inventada de 0,11 €/L/grado, que ademas se
     * aplicaba mal: `quantity * (alcoholContent/100) * rate` divide el grado entre
     * 100 aunque la tarifa dice ser "por grado", asi que ni siquiera cuadraba con el
     * desglose que la propia pantalla mostraba (1.000 L al 5% daban 5,50 EUR cuando
     * esa formula da 550). Reescritos con los importes de la ley.
     */
    test('cerveza de 5% vol: epigrafe 3 a 9,96 €/hl (Ley 38/1992 art. 26)', () => {
      const result = exciseDutiesService.calculateAlcoholExcise({
        taricCode: '2203000010', quantity: 1000, alcoholContent: 5.0, unit: 'L'
      });

      expect(result.applicable).toBe(true);
      expect(result.subcategory).toBe('BEER');
      expect(result.rate).toBe(9.96);
      expect(result.amount).toBe(99.6);   // 10 hl x 9,96 €/hl
      expect(result.unit).toBe('€/hl');
      expect(result.legalBasis).toBe('Ley 38/1992, art. 26');
      // Sin grado Plato declarado se estima, y se dice que es una estimacion.
      expect(result.platoEstimated).toBe(true);
    });

    test('el grado Plato declarado manda sobre la estimacion', () => {
      // 5% vol estimaria 12,5 grados Plato (epigrafe 3). Declarando 10 baja al 2.
      const result = exciseDutiesService.calculateAlcoholExcise({
        taricCode: '2203000010', quantity: 1000, alcoholContent: 5.0, platoDegrees: 10, unit: 'L'
      });

      expect(result.rate).toBe(7.48);
      expect(result.amount).toBe(74.8);
      expect(result.platoEstimated).toBe(false);
    });

    test('cerveza sin alcohol (<= 1,2% vol): epigrafe 1.a), 0 €/hl', () => {
      const result = exciseDutiesService.calculateAlcoholExcise({
        taricCode: '2203000010', quantity: 1000, alcoholContent: 1.0, unit: 'L'
      });

      expect(result.applicable).toBe(true);
      expect(result.rate).toBe(0);
      expect(result.amount).toBe(0);
      expect(result.epigraph).toMatch(/1\.a/);
    });

    test('cerveza de 2,5% vol: epigrafe 1.b) a 2,75 €/hl', () => {
      const result = exciseDutiesService.calculateAlcoholExcise({
        taricCode: '2203000010', quantity: 1000, alcoholContent: 2.5, unit: 'L'
      });

      expect(result.rate).toBe(2.75);
      expect(result.amount).toBe(27.5);
    });

    // Epigrafe 5: unico que va POR grado Plato ademas de por hectolitro.
    test('cerveza de mas de 19 grados Plato: 0,91 €/hl y POR grado Plato', () => {
      const result = exciseDutiesService.calculateAlcoholExcise({
        taricCode: '2203000010', quantity: 1000, alcoholContent: 9.0, platoDegrees: 22, unit: 'L'
      });

      expect(result.rate).toBe(0.91);
      expect(result.amount).toBe(200.2);  // 10 hl x 0,91 x 22 grados Plato
      expect(result.unit).toBe('€/hl/grado Plato');
    });

    /**
     * Ley 38/1992 art. 30: los vinos tranquilos y espumosos tributan a CERO en Espana.
     *
     * Este test EXIGIA el comportamiento incorrecto: daba por bueno que un vino de 12%
     * vol se tratara como "producto intermedio" a 0,85 €/L, un tipo que no existe en
     * la ley. Con el, un contenedor de 10.000 L de Rioja liquidaba 8.500 EUR de
     * impuesto especial inexistente. Los productos intermedios son otra categoria
     * (art. 34) y van POR HECTOLITRO.
     */
    test('un vino tranquilo de 12% vol tributa a CERO (art. 30), no como intermedio', () => {
      const result = exciseDutiesService.calculateAlcoholExcise({
        taricCode: '2204210000', quantity: 1000, alcoholContent: 12.0, unit: 'L'
      });

      expect(result.subcategory).not.toBe('INTERMEDIATE');
      expect(result.amount || 0).toBe(0);
    });

    /**
     * Ley 38/1992 art. 39: 958,94 €/hectolitro de alcohol puro = 9,5894 €/litro.
     * El servicio tenia 10,97 €/L, un 14% POR ENCIMA del tipo legal, y el reducido
     * en 5,485 (la mitad del inflado) en vez del regimen de cosechero del art. 41
     * (226,36 €/hl). Ningun test cubria el alcohol etilico, asi que el tipo inflado
     * pasaba inadvertido.
     */
    test('alcohol etilico: 9,5894 €/litro de alcohol puro (art. 39)', () => {
      // 1.000 L de whisky a 40% vol = 400 L de alcohol puro.
      const result = exciseDutiesService.calculateAlcoholExcise({
        taricCode: '2208300000', quantity: 1000, alcoholContent: 40.0, unit: 'L'
      });

      expect(result.applicable).toBe(true);
      expect(result.rate).toBe(9.5894);
      expect(result.pureAlcoholLiters).toBe(400);
      expect(result.amount).toBe(3835.76);  // 400 L x 9,5894
    });

    test('un vino encabezado de mas de 15% vol si es producto intermedio (art. 34)', () => {
      const result = exciseDutiesService.calculateAlcoholExcise({
        taricCode: '2204210000', quantity: 1000, alcoholContent: 18.0, unit: 'L'
      });

      expect(result.applicable).toBe(true);
      expect(result.subcategory).toBe('INTERMEDIATE');
      expect(result.rate).toBe(38.48);
      expect(result.amount).toBe(384.8);  // 10 hl x 38,48 €/hl
      expect(result.unit).toBe('€/hl');
      expect(result.legalBasis).toBe('Ley 38/1992, art. 34');
    });

    test('should exempt wine with less than 1.2% alcohol', () => {
      const product = {
        taricCode: '2204210000',
        quantity: 1000,
        alcoholContent: 1.0,
        unit: 'L'
      };

      const result = exciseDutiesService.calculateAlcoholExcise(product);

      expect(result.applicable).toBe(false);
      expect(result.exemption).toContain('exentos');
    });

    test('should calculate excise for spirits', () => {
      const product = {
        taricCode: '2208300000',
        quantity: 100,
        alcoholContent: 40.0,
        unit: 'L'
      };

      const result = exciseDutiesService.calculateAlcoholExcise(product);

      expect(result.applicable).toBe(true);
      expect(result.subcategory).toBe('SPIRITS');
      expect(result.pureAlcoholLiters).toBe(40); // 100 L * 40%
      // Ley 38/1992 art. 39: 958,94 €/hl de alcohol puro = 9,5894 €/L. Este test
      // fijaba 438,80 EUR, que salia del tipo inflado de 10,97 €/L (14% de mas).
      expect(result.amount).toBe(383.58); // 40 L * 9,5894 €/L
    });

    test('should return error if missing required fields', () => {
      const product = {
        taricCode: '2203000010'
        // Missing quantity and alcoholContent
      };

      const result = exciseDutiesService.calculateAlcoholExcise(product);

      expect(result.applicable).toBe(false);
      expect(result.error).toContain('quantity y alcoholContent');
    });
  });

  describe('calculateTobaccoExcise', () => {
    test('should calculate excise for cigarettes', () => {
      const product = {
        taricCode: '2402200000',
        quantity: 10000, // 10,000 cigarettes
        price: 5000, // 5000 EUR
        unit: 'units'
      };

      const result = exciseDutiesService.calculateTobaccoExcise(product);

      expect(result.applicable).toBe(true);
      expect(result.subcategory).toBe('CIGARETTES');
      expect(result.specificComponent).toBeGreaterThan(0);
      expect(result.proportionalComponent).toBeGreaterThan(0);
      expect(result.minimumTax).toBeGreaterThan(0);
      expect(result.amount).toBeGreaterThan(0);
    });

    test('should calculate excise for cigars', () => {
      const product = {
        taricCode: '2402100000',
        quantity: 1000,
        price: 10000,
        unit: 'units'
      };

      const result = exciseDutiesService.calculateTobaccoExcise(product);

      expect(result.applicable).toBe(true);
      expect(result.subcategory).toBe('CIGARS');
      // Ley 38/1992 art. 60 epigrafe 1: 15,8% sobre PVP. El test fijaba 1.650 EUR,
      // que salia del 16,5% que tenia el servicio y que la ley no recoge.
      expect(result.proportionalComponent).toBe(1580); // 10000 * 0,158
    });

    /**
     * Epigrafe 1 del art. 60: "El importe del impuesto no puede ser inferior al tipo
     * unico de 47 euros por cada 1.000 unidades". Los cigarros eran la unica labor
     * que NO aplicaba su minimo, asi que un puro barato liquidaba por debajo del
     * minimo legal.
     */
    test('los cigarros aplican el tipo unico minimo de 47 €/1.000 unidades', () => {
      // 1.000 puros a 100 EUR de PVP total: el 15,8% son 15,80 EUR, muy por debajo
      // del minimo de 47 EUR por cada 1.000 unidades.
      const result = exciseDutiesService.calculateTobaccoExcise({
        taricCode: '2402100000', quantity: 1000, price: 100, unit: 'units'
      });

      expect(result.proportionalComponent).toBe(15.8);
      expect(result.minimumTax).toBe(47);
      expect(result.amount).toBe(47); // manda el minimo
    });

    test('should calculate excise for fine cut tobacco', () => {
      const product = {
        taricCode: '2403110000',
        quantity: 10, // kg
        price: 5000,
        unit: 'kg'
      };

      const result = exciseDutiesService.calculateTobaccoExcise(product);

      expect(result.applicable).toBe(true);
      expect(result.subcategory).toBe('FINE_CUT');
      expect(result.specificComponent).toBeGreaterThan(0);
      expect(result.minimumTax).toBeGreaterThan(0);
    });

    test('should return error if missing price', () => {
      const product = {
        taricCode: '2402200000',
        quantity: 10000
        // Missing price
      };

      const result = exciseDutiesService.calculateTobaccoExcise(product);

      expect(result.applicable).toBe(false);
      expect(result.error).toContain('quantity y price');
    });
  });

  describe('calculateHydrocarbonExcise', () => {
    test('should calculate excise for gasoline', () => {
      const product = {
        taricCode: '2710121100',
        quantity: 10000, // 10,000 liters
        productType: 'GASOLINE',
        unit: 'L'
      };

      const result = exciseDutiesService.calculateHydrocarbonExcise(product);

      expect(result.applicable).toBe(true);
      expect(result.subcategory).toBe('GASOLINE');
      // Ley 38/1992 art. 50 epigrafe 1.2.2: el tipo es la SUMA del general (400,69)
      // y el especial (72) = 472,69 €/1.000 l. El test fijaba 436, que no es ninguno
      // de los dos ni su suma.
      expect(result.rate).toBe(472.69);
      expect(result.amount).toBe(4726.9); // 10000 / 1000 * 472,69
    });

    test('should calculate excise for diesel', () => {
      const product = {
        taricCode: '2710192100',
        quantity: 20000,
        productType: 'DIESEL',
        unit: 'L'
      };

      const result = exciseDutiesService.calculateHydrocarbonExcise(product);

      expect(result.applicable).toBe(true);
      expect(result.subcategory).toBe('DIESEL');
      // Epigrafe 1.3: 307 general + 72 especial = 379 €/1.000 l.
      expect(result.rate).toBe(379.00);
      expect(result.amount).toBe(7580); // 20000 / 1000 * 379
    });

    test('should calculate excise for LPG', () => {
      const product = {
        taricCode: '2711120000',
        quantity: 5000,
        unit: 'kg'
      };

      const result = exciseDutiesService.calculateHydrocarbonExcise(product);

      expect(result.applicable).toBe(true);
      expect(result.subcategory).toBe('LPG');
      expect(result.amount).toBe(320); // 5000 / 1000 * 64
    });
  });

  describe('calculateElectricityExcise', () => {
    test('should calculate excise for electricity in kWh', () => {
      const product = {
        taricCode: '2716000000',
        quantity: 10000,
        unit: 'kWh'
      };

      const result = exciseDutiesService.calculateElectricityExcise(product);

      expect(result.applicable).toBe(true);
      expect(result.subcategory).toBe('ELECTRICITY');
      expect(result.rate).toBe(0.051127);
      expect(result.amount).toBeCloseTo(511.27, 2);
    });

    test('should calculate excise for electricity in MWh', () => {
      const product = {
        taricCode: '2716000000',
        quantity: 10,
        unit: 'MWh'
      };

      const result = exciseDutiesService.calculateElectricityExcise(product);

      expect(result.applicable).toBe(true);
      expect(result.amount).toBeCloseTo(511.27, 2); // 10 MWh = 10000 kWh
    });

    test('should return error if missing quantity', () => {
      const product = {
        taricCode: '2716000000'
        // Missing quantity
      };

      const result = exciseDutiesService.calculateElectricityExcise(product);

      expect(result.applicable).toBe(false);
      expect(result.error).toContain('quantity');
    });
  });

  describe('calculateExciseDuty', () => {
    test('should calculate duty for excise product', () => {
      const product = {
        taricCode: '2203000010',
        description: 'Cerveza',
        quantity: 1000,
        alcoholContent: 5.0
      };

      const result = exciseDutiesService.calculateExciseDuty(product);

      expect(result.applicable).toBe(true);
      expect(result.category).toBe('ALCOHOL');
      expect(result.amount).toBeGreaterThan(0);
    });

    test('should return not applicable for non-excise product', () => {
      const product = {
        taricCode: '8517120000',
        description: 'Smartphones',
        quantity: 100
      };

      const result = exciseDutiesService.calculateExciseDuty(product);

      expect(result.applicable).toBe(false);
      expect(result.reason).toContain('no sujeto');
    });
  });

  describe('calculateTotalExciseDuties', () => {
    test('should calculate total for multiple products', () => {
      const goods = [
        {
          taricCode: '2203000010',
          description: 'Cerveza',
          quantity: 1000,
          alcoholContent: 5.0
        },
        {
          taricCode: '2402200000',
          description: 'Cigarrillos',
          quantity: 10000,
          price: 5000
        }
      ];

      const result = exciseDutiesService.calculateTotalExciseDuties(goods);

      expect(result.total).toBeGreaterThan(0);
      expect(result.byCategory.ALCOHOL).toBeDefined();
      expect(result.byCategory.TOBACCO).toBeDefined();
      expect(result.items).toHaveLength(2);
    });

    test('should handle mix of excise and non-excise products', () => {
      const goods = [
        {
          taricCode: '2203000010',
          description: 'Cerveza',
          quantity: 1000,
          alcoholContent: 5.0
        },
        {
          taricCode: '8517120000',
          description: 'Smartphones',
          quantity: 100
        }
      ];

      const result = exciseDutiesService.calculateTotalExciseDuties(goods);

      expect(result.total).toBeGreaterThan(0);
      expect(result.byCategory.ALCOHOL).toBeDefined();
      expect(result.items).toHaveLength(2);
      expect(result.items[1].excise.applicable).toBe(false);
    });

    test('should return zero for products without excise', () => {
      const goods = [
        {
          taricCode: '8517120000',
          description: 'Smartphones',
          quantity: 100
        }
      ];

      const result = exciseDutiesService.calculateTotalExciseDuties(goods);

      expect(result.total).toBe(0);
      expect(Object.keys(result.byCategory)).toHaveLength(0);
    });
  });

  describe('generateSILICIEDocument', () => {
    test('should generate SILICIE document for alcohol', () => {
      const operation = {
        type: 'import',
        originCountry: 'FR',
        destinationCountry: 'ES'
      };

      const exciseDuties = {
        total: 5.5,
        byCategory: {
          ALCOHOL: {
            categoryName: 'Bebidas Alcohólicas',
            amount: 5.5,
            items: []
          }
        },
        items: [
          {
            taricCode: '2203000010',
            description: 'Cerveza',
            excise: { applicable: true, amount: 5.5 }
          }
        ]
      };

      const document = exciseDutiesService.generateSILICIEDocument(operation, exciseDuties);

      expect(document.documentType).toBe('DUA-SILICIE');
      expect(document.documentNumber).toContain('SILICIE-');
      expect(document.exciseDuties.total).toBe(5.5);
      expect(document.requirements).toHaveLength(2); // Registro + DAE
      expect(document.guarantees).toHaveLength(1);
      expect(document.guarantees[0].amount).toBe(8.25); // 5.5 * 1.5
    });

    test('should include tobacco-specific requirements', () => {
      const operation = {
        type: 'import',
        originCountry: 'FR',
        destinationCountry: 'ES'
      };

      const exciseDuties = {
        total: 2000,
        byCategory: {
          TOBACCO: {
            categoryName: 'Labores del Tabaco',
            amount: 2000,
            items: []
          }
        },
        items: []
      };

      const document = exciseDutiesService.generateSILICIEDocument(operation, exciseDuties);

      expect(document.requirements.some(r => r.type === 'MARCA_FISCAL')).toBe(true);
    });
  });

  describe('checkExemptions', () => {
    test('should list available exemptions for alcohol', () => {
      const product = { taricCode: '2207100000' };
      const usage = 'medical use';

      const result = exciseDutiesService.checkExemptions(product, usage);

      expect(result.category).toBe('ALCOHOL');
      expect(result.availableExemptions).toBeInstanceOf(Array);
      expect(result.availableExemptions.length).toBeGreaterThan(0);
    });

    test('should match potential exemptions based on usage', () => {
      const product = { taricCode: '2207100000' };
      const usage = 'export to USA';

      const result = exciseDutiesService.checkExemptions(product, usage);

      expect(result.potentialMatches).toContain('Exportación fuera de territorio de aplicación');
      expect(result.requiresDocumentation).toBe(true);
    });

    test('should return empty for non-excise products', () => {
      const product = { taricCode: '8517120000' };
      const usage = '';

      const result = exciseDutiesService.checkExemptions(product, usage);

      expect(result.exempt).toBe(false);
      expect(result.reason).toContain('no sujeto');
    });
  });
});
