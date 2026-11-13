/**
 * Tests for Paraduanero Service
 * Testing non-customs controls (veterinary, phytosanitary, etc.)
 */

const paraduaneroService = require('../../src/services/paraduaneroService');

// Mock dependencies
jest.mock('../../src/config/logger');
jest.mock('../../src/models', () => {
  function ParaduaneroControlMock(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
    this.controlNumber = `CTRL-${Date.now()}`;
  }
  ParaduaneroControlMock.findOne = jest.fn();
  ParaduaneroControlMock.find = jest.fn();
  ParaduaneroControlMock.findById = jest.fn();
  ParaduaneroControlMock.countDocuments = jest.fn();
  ParaduaneroControlMock.aggregate = jest.fn();

  return {
    Expedition: {
      findById: jest.fn(),
      save: jest.fn()
    },
    ParaduaneroControl: ParaduaneroControlMock,
    Document: {}
  };
});

const { Expedition, ParaduaneroControl } = require('../../src/models');

describe('Paraduanero Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeExpedition', () => {
    test('should detect veterinary controls for live animals (Chapter 01)', async () => {
      const expedition = {
        expeditionId: 'EXP-001',
        goods: [{
          itemNumber: 1,
          description: 'Bovine animals',
          taricCode: '0102210000',
          originCountry: 'BR',
          quantity: 10,
          unit: 'NAR',
          grossWeight: 5000
        }]
      };

      const controls = await paraduaneroService.analyzeExpedition(expedition);

      expect(controls).toBeDefined();
      expect(controls.length).toBeGreaterThan(0);
      expect(controls[0]).toMatchObject({
        controlType: 'MAPA',
        subType: 'veterinary',
        inspectionRequired: true
      });
      expect(controls[0].documents).toContainEqual(
        expect.objectContaining({
          code: 'C620',
          name: expect.stringContaining('Veterinario')
        })
      );
    });

    test('should detect phytosanitary controls for fresh fruits (Chapter 08)', async () => {
      const expedition = {
        expeditionId: 'EXP-002',
        goods: [{
          itemNumber: 1,
          description: 'Fresh oranges',
          taricCode: '0805100000',
          originCountry: 'BR',
          quantity: 1000,
          unit: 'KGM',
          grossWeight: 1000
        }]
      };

      const controls = await paraduaneroService.analyzeExpedition(expedition);

      expect(controls.length).toBeGreaterThan(0);
      const phytoControl = controls.find(c => c.subType === 'phytosanitary');
      expect(phytoControl).toBeDefined();
      expect(phytoControl.documents).toContainEqual(
        expect.objectContaining({
          code: 'C633',
          name: expect.stringContaining('Fitosanitario')
        })
      );
    });

    test('should detect CITES controls for protected species', async () => {
      const expedition = {
        expeditionId: 'EXP-003',
        goods: [{
          itemNumber: 1,
          description: 'Exotic birds',
          taricCode: '0106390000',
          originCountry: 'BR',
          quantity: 5,
          unit: 'NAR',
          grossWeight: 10
        }]
      };

      const controls = await paraduaneroService.analyzeExpedition(expedition);

      const citesControl = controls.find(c => c.subType && c.subType.includes('cites'));
      expect(citesControl).toBeDefined();
      expect(citesControl.priority).toBe('critical');
      expect(citesControl.documents).toContainEqual(
        expect.objectContaining({
          code: 'Y926',
          name: expect.stringContaining('CITES')
        })
      );
    });

    test('should detect pharmaceutical controls (AEMPS)', async () => {
      const expedition = {
        expeditionId: 'EXP-004',
        goods: [{
          itemNumber: 1,
          description: 'Medicaments',
          taricCode: '3004200000',
          originCountry: 'CN',
          quantity: 100,
          unit: 'NAR',
          grossWeight: 50
        }]
      };

      const controls = await paraduaneroService.analyzeExpedition(expedition);

      const pharmaControl = controls.find(c => c.controlType === 'AEMPS');
      expect(pharmaControl).toBeDefined();
      expect(pharmaControl.subType).toBe('pharmaceuticals');
      expect(pharmaControl.inspectionRequired).toBe(true);
    });

    test('should detect textile controls (SOIVRE)', async () => {
      const expedition = {
        expeditionId: 'EXP-005',
        goods: [{
          itemNumber: 1,
          description: 'Cotton t-shirts',
          // TARIC real de la lista SOIVRE: el control ya no se decide por capitulo.
          taricCode: '6109100010',
          originCountry: 'BD',
          quantity: 500,
          unit: 'NAR',
          grossWeight: 100
        }]
      };

      const controls = await paraduaneroService.analyzeExpedition(expedition);

      const textileControl = controls.find(c => c.controlType === 'SOIVRE');
      expect(textileControl).toBeDefined();
      expect(textileControl.subType).toBe('textiles');
    });

    test('should not require controls for standard goods (Chapter 40)', async () => {
      const expedition = {
        expeditionId: 'EXP-006',
        goods: [{
          itemNumber: 1,
          description: 'Rubber tires',
          taricCode: '4011100000',
          originCountry: 'DE',
          quantity: 50,
          unit: 'NAR',
          grossWeight: 1000
        }]
      };

      const controls = await paraduaneroService.analyzeExpedition(expedition);

      // Chapter 40 (rubber) has no mandatory controls
      expect(controls.length).toBe(0);
    });

    test('should handle expedition with multiple goods requiring different controls', async () => {
      const expedition = {
        expeditionId: 'EXP-007',
        goods: [
          {
            itemNumber: 1,
            description: 'Fresh apples',
            taricCode: '0808100000',
            originCountry: 'CL',
            quantity: 500,
            unit: 'KGM',
            grossWeight: 500
          },
          {
            itemNumber: 2,
            description: 'Canned meat',
            taricCode: '1602500000',
            originCountry: 'AR',
            quantity: 200,
            unit: 'KGM',
            grossWeight: 220
          }
        ]
      };

      const controls = await paraduaneroService.analyzeExpedition(expedition);

      // Should detect both phytosanitary and sanitary controls
      expect(controls.length).toBeGreaterThan(0);
      const controlTypes = controls.map(c => c.subType);
      expect(controlTypes).toContain('phytosanitary');
      expect(controlTypes).toContain('food_safety');
    });

    test('should increase priority for high-risk origin countries', async () => {
      const expedition = {
        expeditionId: 'EXP-008',
        goods: [{
          itemNumber: 1,
          description: 'Fresh meat',
          taricCode: '0201100000',
          originCountry: 'CN', // High risk country for veterinary
          quantity: 1000,
          unit: 'KGM',
          grossWeight: 1000
        }]
      };

      const controls = await paraduaneroService.analyzeExpedition(expedition);

      const vetControl = controls.find(c => c.subType === 'veterinary');
      expect(vetControl).toBeDefined();
      expect(vetControl.priority).toBe('high');
      expect(vetControl.notes).toContain('alto riesgo');
    });
  });

  describe('createControlsForExpedition', () => {
    test('should create controls for expedition with required checks', async () => {
      const mockExpedition = {
        _id: 'exp123',
        expeditionId: 'EXP-001',
        goods: [{
          itemNumber: 1,
          description: 'Fresh vegetables',
          taricCode: '0701000000',
          originCountry: 'MA',
          quantity: 500,
          unit: 'KGM',
          grossWeight: 500
        }],
        timeline: [],
        save: jest.fn().mockResolvedValue(true)
      };

      Expedition.findById.mockResolvedValue(mockExpedition);
      ParaduaneroControl.findOne.mockResolvedValue(null);

      const user = { _id: 'user123', name: 'Test User' };

      // Since the service creates controls internally, we just verify the expedition was found
      await expect(
        paraduaneroService.createControlsForExpedition('exp123', user)
      ).resolves.toBeDefined();

      expect(Expedition.findById).toHaveBeenCalledWith('exp123');
    });

    test('should not create duplicate controls', async () => {
      const mockExpedition = {
        _id: 'exp123',
        expeditionId: 'EXP-001',
        goods: [{
          taricCode: '0701000000',
          originCountry: 'MA'
        }],
        timeline: [],
        save: jest.fn()
      };

      const existingControl = {
        _id: 'ctrl123',
        controlType: 'MAPA',
        subType: 'phytosanitary'
      };

      Expedition.findById.mockResolvedValue(mockExpedition);
      ParaduaneroControl.findOne.mockResolvedValue(existingControl);

      const user = { _id: 'user123', name: 'Test User' };
      const controls = await paraduaneroService.createControlsForExpedition('exp123', user);

      // Should not create new control if one exists
      expect(controls.length).toBe(0);
    });

    test('should throw error if expedition not found', async () => {
      Expedition.findById.mockResolvedValue(null);

      const user = { _id: 'user123' };

      await expect(
        paraduaneroService.createControlsForExpedition('nonexistent', user)
      ).rejects.toThrow('Expediente no encontrado');
    });
  });

  describe('getStats', () => {
    test('should calculate statistics for controls', async () => {
      const mockStats = [
        {
          _id: 'MAPA',
          total: 10,
          pending: 3,
          inProgress: 4,
          approved: 2,
          rejected: 1
        },
        {
          _id: 'SANIDAD',
          total: 5,
          pending: 1,
          inProgress: 2,
          approved: 2,
          rejected: 0
        }
      ];

      ParaduaneroControl.aggregate.mockResolvedValue(mockStats);

      const stats = await paraduaneroService.getStats();

      expect(ParaduaneroControl.aggregate).toHaveBeenCalled();
      expect(stats).toEqual(mockStats);
    });

    test('should filter statistics by date range', async () => {
      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      };

      ParaduaneroControl.aggregate.mockResolvedValue([]);

      await paraduaneroService.getStats(filters);

      const aggregateCall = ParaduaneroControl.aggregate.mock.calls[0][0];
      expect(aggregateCall[0].$match.createdAt).toBeDefined();
    });
  });

  describe('TARIC Control Rules', () => {
    test('should apply correct controls for each chapter', async () => {
      const testCases = [
        { chapter: '01', expectedControl: 'MAPA', subType: 'veterinary' },
        { chapter: '07', expectedControl: 'MAPA', subType: 'phytosanitary' },
        { chapter: '30', expectedControl: 'AEMPS', subType: 'pharmaceuticals' }
      ];

      for (const testCase of testCases) {
        const expedition = {
          expeditionId: `EXP-${testCase.chapter}`,
          goods: [{
            itemNumber: 1,
            description: `Test item for chapter ${testCase.chapter}`,
            taricCode: `${testCase.chapter}00000000`,
            originCountry: 'XX',
            quantity: 1,
            unit: 'NAR',
            grossWeight: 1
          }]
        };

        const controls = await paraduaneroService.analyzeExpedition(expedition);

        if (testCase.expectedControl) {
          expect(controls.length).toBeGreaterThan(0);
          expect(controls[0].controlType).toBe(testCase.expectedControl);
          expect(controls[0].subType).toBe(testCase.subType);
        }
      }
    });
  });
  /**
   * UAT 10/Nov/2026: unos portatiles (8471 30) salian con «control SOIVRE» por
   * pertenecer al capitulo 84. Segun las listas oficiales no estan en la lista
   * SOIVRE de seguridad y si en la de RoHS/RAEE. El SOIVRE se decide ahora por
   * codigo TARIC contra esas listas.
   */
  describe('controles SOIVRE segun las listas oficiales por TARIC', () => {
    const analizar = (taricCode, originCountry = 'CN') => paraduaneroService.analyzeExpedition({
      expeditionId: 'EXP-LISTAS',
      goods: [{ itemNumber: 1, description: 'Mercancia', taricCode, originCountry, quantity: 1, unit: 'NAR', grossWeight: 1 }]
    });

    test('portatiles 8471 30: solo RoHS/RAEE, sin control de seguridad', async () => {
      const controls = await analizar('8471300000');

      expect(controls).toHaveLength(1);
      expect(controls[0]).toMatchObject({ controlType: 'SOIVRE', subType: 'rohs_raee', inspectionRequired: false });
      // La agente de aduanas (UAT 13/Nov/2026): en SOIVRE siempre se adjunta
      // factura comercial y documento de transporte, sea cual sea el grupo.
      expect(controls[0].documents.map(d => d.code)).toEqual(['ROHS', 'RAEE', 'N380', 'N785']);
      expect(controls[0].reason).toContain('RoHS y RAEE');
      expect(controls[0].notes).toContain('2023-02-09');
    });

    test('RoHS/RAEE no procede para los origenes que la medida excluye (TR, NO, IS, LI)', async () => {
      // Consulta TARIC de la AEAT para la 8471 30: «ROS — todos erga omnes.
      // Exclusiones: Turquia, Noruega, Islandia, Liechtenstein».
      for (const origen of ['TR', 'NO', 'IS', 'LI', 'tr']) {
        expect(await analizar('8471300000', origen)).toEqual([]);
      }
      expect((await analizar('8471300000', 'CN')).map(c => c.subType)).toEqual(['rohs_raee']);
      expect((await analizar('8471300000', undefined)).map(c => c.subType)).toEqual(['rohs_raee']);
    });

    test('en un expediente mixto solo cuenta la partida de origen no excluido', async () => {
      const controls = await paraduaneroService.analyzeExpedition({
        expeditionId: 'EXP-MIXTO',
        goods: [
          { itemNumber: 1, description: 'Portatiles de Turquia', taricCode: '8471300000', originCountry: 'TR' },
          { itemNumber: 2, description: 'Portatiles de China', taricCode: '8471300000', originCountry: 'CN' }
        ]
      });

      expect(controls).toHaveLength(1);
      expect(controls[0].affectedGoods.map(g => g.itemNumber)).toEqual([2]);
    });

    test('maquinaria del capitulo 84 que no esta en ninguna lista no lleva control', async () => {
      // 8408 10: motores diesel para barcos. Antes: «SOIVRE machinery» por ser del 84.
      expect(await analizar('8408101100')).toEqual([]);
    });

    test('un TARIC de la lista SOIVRE de juguetes lleva control de seguridad con inspeccion', async () => {
      const controls = await analizar('9503001000');
      const juguetes = controls.find(c => c.subType === 'toys');

      expect(juguetes).toMatchObject({ controlType: 'SOIVRE', inspectionRequired: true });
      expect(juguetes.documents.map(d => d.code)).toEqual(['C057', 'Y925', 'N380', 'N785']);
      expect(juguetes.reason).toContain('grupo JUGUETES');
    });

    test('todo control SOIVRE exige siempre factura comercial y documento de transporte', async () => {
      // La agente de aduanas en UAT dijo literal: "En SOIVRE siempre se tiene
      // que adjuntar documentacion de factura y conocimiento de transporte".
      const textiles = (await analizar('6109100010')).find(c => c.subType === 'textiles');
      const rohsRaee = (await analizar('8471300000')).find(c => c.subType === 'rohs_raee');

      for (const control of [textiles, rohsRaee]) {
        const factura = control.documents.find(d => d.code === 'N380');
        const transporte = control.documents.find(d => d.code === 'N785');
        expect(factura).toMatchObject({ name: 'Factura Comercial', mandatory: true });
        expect(transporte).toMatchObject({ mandatory: true });
        expect(transporte.name).toContain('BL/AWB/CMR');
      }
    });

    test('no duplica factura ni transporte si el control ya los traia', () => {
      const conFacturaYTransporte = paraduaneroService._documentosSoivreConFacturaYTransporte(
        [
          { code: 'N380', name: 'Factura Comercial', mandatory: true },
          { code: 'C057', name: 'Declaracion CE conformidad', mandatory: true }
        ],
        undefined
      );

      expect(conFacturaYTransporte.map(d => d.code)).toEqual(['N380', 'C057', 'N785']);
    });

    test('el documento de transporte exigido depende del modo de transporte del expediente', async () => {
      const casos = [
        ['maritime', 'N705'],
        ['air', 'N740'],
        ['road', 'N730'],
        ['rail', 'N720'],
        [undefined, 'N785']
      ];

      for (const [transportMode, codigoEsperado] of casos) {
        const controls = await paraduaneroService.analyzeExpedition({
          expeditionId: 'EXP-TRANSPORTE',
          transportMode,
          goods: [{ itemNumber: 1, description: 'Juguetes', taricCode: '9503001000', originCountry: 'CN' }]
        });

        const juguetes = controls.find(c => c.subType === 'toys');
        const transporte = juguetes.documents.find(d => ['N705', 'N740', 'N730', 'N720', 'N785'].includes(d.code));
        expect(transporte.code).toBe(codigoEsperado);
      }
    });

    test('una subdivision de 10 digitos se reconoce por el prefijo de 8 de la lista', async () => {
      // La lista RoHS/RAEE recoge 8516 40 00 (planchas); el TARIC lleva 10 digitos.
      const controls = await analizar('8516400000');

      expect(controls.map(c => c.subType)).toEqual(['rohs_raee']);
    });

    test('varias partidas con el mismo control se agrupan en uno', async () => {
      const controls = await paraduaneroService.analyzeExpedition({
        expeditionId: 'EXP-GRUPO',
        goods: [
          { itemNumber: 1, description: 'Portatiles', taricCode: '8471300000', originCountry: 'CN' },
          { itemNumber: 2, description: 'Planchas', taricCode: '8516400000', originCountry: 'CN' }
        ]
      });

      expect(controls).toHaveLength(1);
      expect(controls[0].affectedGoods.map(g => g.itemNumber)).toEqual([1, 2]);
    });

    test('la nota que acota el control en la lista llega al agente', async () => {
      const { buscarRohsRaee } = require('../../src/services/paraduanero/listasOficiales');
      const rohsRaee = require('../../src/data/paraduanero/rohsRaee.json');
      const conNota = rohsRaee.entradas.find(e => e.nota && (e.rohs || e.raee));

      const controls = await analizar(conNota.prefijo.padEnd(10, '0'));

      expect(buscarRohsRaee(conNota.prefijo.padEnd(10, '0'))).toBe(conNota);
      expect(controls.find(c => c.subType === 'rohs_raee').notes).toContain(conNota.nota);
    });
  });

  describe('listasOficiales', () => {
    const { buscarRohsRaee, buscarSoivreSeguridad, normalizarTaric } = require('../../src/services/paraduanero/listasOficiales');

    test('normaliza a 10 digitos y descarta lo que no es un TARIC', () => {
      expect(normalizarTaric('8471 30 00')).toBe('8471300000');
      expect(normalizarTaric('8471.30.00.00')).toBe('8471300000');
      expect(normalizarTaric('8471')).toBeNull();
      expect(normalizarTaric(undefined)).toBeNull();
      expect(normalizarTaric('84713000001')).toBeNull();
    });

    test('la 8471 30 no esta en la lista SOIVRE de seguridad y si en RoHS/RAEE', () => {
      expect(buscarSoivreSeguridad('8471300000')).toBeNull();
      expect(buscarRohsRaee('8471300000')).toMatchObject({ prefijo: '84713000', rohs: true, raee: true });
    });

    test('un codigo fuera de las listas devuelve null en ambas', () => {
      expect(buscarSoivreSeguridad('4011100000')).toBeNull();
      expect(buscarRohsRaee('4011100000')).toBeNull();
    });

    test('las listas se cargan completas y sin prefijos duplicados', () => {
      const rohsRaee = require('../../src/data/paraduanero/rohsRaee.json');
      const soivre = require('../../src/data/paraduanero/soivreSeguridad.json');

      expect(rohsRaee.entradas).toHaveLength(820);
      expect(new Set(rohsRaee.entradas.map(e => e.prefijo)).size).toBe(820);
      expect(soivre.entradas).toHaveLength(838);
      expect(soivre.entradas.every(e => /^\d{10}$/.test(e.taric) && e.grupo)).toBe(true);
    });
  });

  // Nombres de documento que ve el agente en pantalla: deben llevar las tildes
  // correctas sin cambiar los codigos oficiales (Y923, C057, ROHS, RAEE...).
  describe('tildes en los nombres de documento (texto de pantalla)', () => {
    test('quimicos (REACH, capitulo 28/29): "Declaracion" -> "Declaración"', async () => {
      const controls = await paraduaneroService.analyzeExpedition({
        expeditionId: 'EXP-TILDE-REACH',
        goods: [{ itemNumber: 1, description: 'Reactivo', taricCode: '2901100000', originCountry: 'DE', quantity: 1, unit: 'KGM', grossWeight: 1 }]
      });
      expect(controls[0].documents).toContainEqual(expect.objectContaining({ code: 'Y923', name: 'Declaración REACH' }));
    });

    test('medicamentos (capitulo 30): "Autorizacion de importacion" -> "Autorización de importación"', async () => {
      const controls = await paraduaneroService.analyzeExpedition({
        expeditionId: 'EXP-TILDE-AEMPS',
        goods: [{ itemNumber: 1, description: 'Medicamento', taricCode: '3004900000', originCountry: 'CH', quantity: 1, unit: 'KGM', grossWeight: 1 }]
      });
      expect(controls[0].documents).toContainEqual(expect.objectContaining({ code: 'C057', name: 'Autorización de importación AEMPS' }));
    });

    test('cosmeticos (capitulo 33): "Notificacion CPNP" -> "Notificación CPNP"', async () => {
      const controls = await paraduaneroService.analyzeExpedition({
        expeditionId: 'EXP-TILDE-CPNP',
        goods: [{ itemNumber: 1, description: 'Crema', taricCode: '3304990000', originCountry: 'FR', quantity: 1, unit: 'KGM', grossWeight: 1 }]
      });
      expect(controls[0].documents).toContainEqual(expect.objectContaining({ code: 'C057', name: 'Notificación CPNP' }));
    });

    // Guantes de proteccion (4203291000): grupo TEXTIL de la lista oficial SOIVRE.
    test('SOIVRE textil: "Composicion fibras" -> "Composición fibras"', async () => {
      const controls = await paraduaneroService.analyzeExpedition({
        expeditionId: 'EXP-TILDE-TEXTIL',
        goods: [{ itemNumber: 1, description: 'Guantes', taricCode: '4203291000', originCountry: 'CN', quantity: 1, unit: 'NAR', grossWeight: 1 }]
      });
      expect(controls[0].documents).toContainEqual(expect.objectContaining({ code: 'Y923', name: 'Composición fibras' }));
    });
  });
});
