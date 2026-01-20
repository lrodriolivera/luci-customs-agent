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
    test('should calculate excise for beer', () => {
      const product = {
        taricCode: '2203000010',
        quantity: 1000,
        alcoholContent: 5.0,
        unit: 'L'
      };

      const result = exciseDutiesService.calculateAlcoholExcise(product);

      expect(result.applicable).toBe(true);
      expect(result.subcategory).toBe('BEER');
      expect(result.amount).toBe(5.5); // 1000 L * 5% * 0.11 €/L/grado
    });

    test('should calculate excise for low-alcohol beer', () => {
      const product = {
        taricCode: '2203000010',
        quantity: 1000,
        alcoholContent: 1.0,
        unit: 'L'
      };

      const result = exciseDutiesService.calculateAlcoholExcise(product);

      expect(result.applicable).toBe(true);
      expect(result.subcategory).toBe('BEER');
      expect(result.rate).toBe(0.055); // Reduced rate
    });

    test('should apply intermediate rate for wine products between 1.2% and 15%', () => {
      const product = {
        taricCode: '2204210000',
        quantity: 1000,
        alcoholContent: 12.0,
        unit: 'L'
      };

      const result = exciseDutiesService.calculateAlcoholExcise(product);

      // Wine with 1.2% - 15% alcohol is treated as intermediate product
      expect(result.applicable).toBe(true);
      expect(result.subcategory).toBe('INTERMEDIATE');
      expect(result.rate).toBe(0.85);
      expect(result.amount).toBe(850); // 1000 L * 0.85 €/L
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
      expect(result.amount).toBe(438.8); // 40 L * 10.97 €/L
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
      expect(result.proportionalComponent).toBe(1650); // 10000 * 0.165
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
      expect(result.rate).toBe(436.00);
      expect(result.amount).toBe(4360); // 10000 / 1000 * 436
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
      expect(result.rate).toBe(331.00);
      expect(result.amount).toBe(6620); // 20000 / 1000 * 331
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
