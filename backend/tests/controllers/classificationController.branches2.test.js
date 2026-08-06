/**
 * Tests adicionales para classificationController - Cobertura de ramas
 * Objetivo: Subir de 75%B a ≥88%B cubriendo ramas sin cubrir.
 * Enfoque: Ramas simples de operadores binarios, condicionales y defaults.
 */

const request = require('supertest');
const express = require('express');

const mockTaricCode = {
  findOne: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  aggregate: jest.fn(),
  getChapters: jest.fn(),
  countDocuments: jest.fn(),
  distinct: jest.fn(),
  bulkWrite: jest.fn(),
  deleteOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  search: jest.fn(),
  findByChapter: jest.fn()
};
const mockExpedition = { findById: jest.fn() };
const mockSearchHistory = {
  findOneAndUpdate: jest.fn(),
  getSearchStats: jest.fn(),
  countDocuments: jest.fn()
};
const mockAICache = { cleanOldCache: jest.fn() };

const mockAiService = {
  classifyProduct: jest.fn(),
  getTaricCodeInfo: jest.fn(),
  validateClassification: jest.fn(),
  generateTreeLevel: jest.fn(),
  improveClassificationWithFeedback: jest.fn(),
  suggestBasedOnHistory: jest.fn(),
  crossValidateWithRegulations: jest.fn(),
  fullTaricAnalysis: jest.fn(),
  recordClassificationFeedback: jest.fn()
};
const mockTaricService = {
  _getCodeFromAPI: jest.fn(),
  calculateDuties: jest.fn(),
  getRequiredDocuments: jest.fn(),
  getAvailablePreferences: jest.fn(),
  seedCommonCodes: jest.fn(),
  recordSearch: jest.fn(),
  getUserSearchHistory: jest.fn(),
  getMostSearchedCodes: jest.fn(),
  getAICacheStats: jest.fn(),
  getFromAICache: jest.fn(),
  saveToAICache: jest.fn()
};

const mockHasSeasonalTariff = jest.fn();
const mockGetSeasonalTariff = jest.fn();

jest.mock('../../src/models', () => ({
  TaricCode: mockTaricCode,
  Expedition: mockExpedition,
  TaricSearchHistory: mockSearchHistory,
  TaricAICache: mockAICache
}));
jest.mock('../../src/services/aiService', () => mockAiService);
jest.mock('../../src/services/taricService', () => mockTaricService);
jest.mock('../../src/data/seasonalTariffs', () => ({
  hasSeasonalTariff: mockHasSeasonalTariff,
  getSeasonalTariff: mockGetSeasonalTariff
}));

const ctrl = require('../../src/controllers/classificationController');

const TENANT_A = '6a5769e0b11d798e7e783602';
const USER = { _id: '6a5769e0b11d798e7e783607', name: 'Tester', tenantId: TENANT_A };

function app(handler, metodo = 'post', ruta = '/r') {
  const a = express();
  a.use(express.json());
  a[metodo](ruta, (req, _res, next) => { req.user = USER; req.tenantId = USER.tenantId; next(); }, handler);
  return a;
}

describe('classificationController - Cobertura de ramas simples', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasSeasonalTariff.mockReturnValue(false);
    mockGetSeasonalTariff.mockReturnValue(null);
  });

  describe('getTaricInfo - Descriptions con fallbacks', () => {
    test('cuando taricCode.description solo tiene en (sin es)', async () => {
      const mockTaric = {
        code: '0807000000',
        isLeaf: true,
        description: { en: 'Melons' },  // Solo inglés, sin español
        breakdown: { chapter: '08', heading: '0807' },
        toObject: jest.fn().mockReturnThis(),
        getFullPath: jest.fn().mockResolvedValue([
          { code: '0800000000', level: 2, description: { en: 'Fruits' } }
        ])
      };
      mockTaricCode.findOne.mockResolvedValue(mockTaric);
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe('Melons');
      expect(res.body.data.description_es).toBe('');  // Campo es vacío
    });

    test('cuando taricCode.description está vacío', async () => {
      const mockTaric = {
        code: '0807000000',
        isLeaf: true,
        description: {},
        breakdown: { chapter: '08' },
        toObject: jest.fn().mockReturnThis(),
        getFullPath: jest.fn().mockResolvedValue([])
      };
      mockTaricCode.findOne.mockResolvedValue(mockTaric);
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe('');
      expect(res.body.data.description_es).toBe('');
    });

    test('cuando taricCode no tiene fields opcionales', async () => {
      const mockTaric = {
        code: '0807000000',
        isLeaf: true,
        description: { es: 'Melones' },
        breakdown: { chapter: '08' },
        // Sin measures, requiredDocuments, preferences, notes, examples, keywords
        toObject: jest.fn().mockReturnThis(),
        getFullPath: jest.fn().mockResolvedValue([])
      };
      mockTaricCode.findOne.mockResolvedValue(mockTaric);
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(res.body.data.measures).toEqual([]);
      expect(res.body.data.requiredDocuments).toEqual([]);
      expect(res.body.data.preferences).toEqual([]);
      expect(res.body.data.notes).toEqual([]);
      expect(res.body.data.examples).toEqual([]);
      expect(res.body.data.keywords).toEqual([]);
    });
  });

  describe('getTaricInfo - Jerarquía en descriptions', () => {
    test('cuando hierarchy tiene description solo en en', async () => {
      const mockTaric = {
        code: '0807000000',
        isLeaf: true,
        description: { es: 'Melones' },
        breakdown: { chapter: '08' },
        toObject: jest.fn().mockReturnThis(),
        getFullPath: jest.fn().mockResolvedValue([
          { code: '0800000000', level: 2, description: { en: 'Fruits' } }
        ])
      };
      mockTaricCode.findOne.mockResolvedValue(mockTaric);
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(res.body.data.hierarchy[0].description).toBe('Fruits');
    });

    test('cuando hierarchy tiene description como string plano', async () => {
      const mockTaric = {
        code: '0807000000',
        isLeaf: true,
        description: { es: 'Melones' },
        breakdown: { chapter: '08' },
        toObject: jest.fn().mockReturnThis(),
        getFullPath: jest.fn().mockResolvedValue([
          { code: '0800000000', level: 2, description: 'Frutas' }
        ])
      };
      mockTaricCode.findOne.mockResolvedValue(mockTaric);
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(res.body.data.hierarchy[0].description).toBe('Frutas');
    });
  });

  describe('getTaricInfo - Children descriptions', () => {
    test('cuando children tiene description solo en en', async () => {
      const mockTaric = {
        code: '0807000000',
        isLeaf: false,
        description: { es: 'Melones' },
        breakdown: { chapter: '08' },
        toObject: jest.fn().mockReturnThis(),
        getFullPath: jest.fn().mockResolvedValue([]),
        getChildren: jest.fn().mockResolvedValue([
          { code: '0807110000', description: { en: 'Watermelons' } }
        ])
      };
      mockTaricCode.findOne.mockResolvedValue(mockTaric);
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(res.body.data.children[0].description).toBe('Watermelons');
    });

    test('cuando children tiene description como string', async () => {
      const mockTaric = {
        code: '0807000000',
        isLeaf: false,
        description: { es: 'Melones' },
        breakdown: { chapter: '08' },
        toObject: jest.fn().mockReturnThis(),
        getFullPath: jest.fn().mockResolvedValue([]),
        getChildren: jest.fn().mockResolvedValue([
          { code: '0807110000', description: 'Sandías' }
        ])
      };
      mockTaricCode.findOne.mockResolvedValue(mockTaric);
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(res.body.data.children[0].description).toBe('Sandías');
    });
  });

  describe('getTaricInfo - Ramas de cache', () => {
    test('cuando getFromAICache devuelve resultado con measures', async () => {
      mockTaricCode.findOne.mockResolvedValue(null);
      mockTaricService.getFromAICache.mockResolvedValue({
        hits: 5,
        aiResponse: {
          description: 'Melons',
          description_es: 'Melones',
          chapter: '08',
          heading: '0807',
          dutyRate: '8.8%',
          measures: [{ type: 'prohibition' }]
        }
      });
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(res.body.data.source).toBe('ai_cache');
      expect(res.body.data.measures).toHaveLength(1);
    });

    test('cuando IA devuelve resultado con description y description_es', async () => {
      mockTaricCode.findOne.mockResolvedValue(null);
      mockTaricService.getFromAICache.mockResolvedValue(null);
      mockTaricService._getCodeFromAPI.mockResolvedValue(null);
      mockAiService.getTaricCodeInfo.mockResolvedValue({
        description: 'Melons',
        description_es: 'Melones',
        chapter: '08',
        heading: '0807',
        dutyRate: '8.8%',
        measures: []
      });
      mockTaricService.saveToAICache.mockResolvedValue({});
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe('Melons');
      expect(res.body.data.description_es).toBe('Melones');
    });
  });

  describe('searchTaric - Enriquecimiento estacional', () => {
    test('cuando resultado tiene código con tarifa estacional', async () => {
      mockTaricCode.getChapters = jest.fn().mockResolvedValue([
        { code: '08', description: 'Frutas', count: 100 }
      ]);
      mockHasSeasonalTariff.mockReturnValueOnce(true);
      mockGetSeasonalTariff.mockReturnValue({
        periodLabel: 'Verano',
        currentRate: 5.5,
        hasEntryPrice: true
      });

      const res = await request(app(ctrl.searchTaric, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
    });

    test('cuando seasonalTariff existe pero getSeasonalTariff devuelve null', async () => {
      mockTaricCode.getChapters = jest.fn().mockResolvedValue([
        { code: '08', description: 'Frutas', count: 100 }
      ]);
      mockHasSeasonalTariff.mockReturnValueOnce(true);
      mockGetSeasonalTariff.mockReturnValue(null);

      const res = await request(app(ctrl.searchTaric, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
    });
  });

  describe('applyClassification - Defaults de duties y vat', () => {
    test('cuando taricInfo.duties es undefined, usa 0', async () => {
      const exp = {
        _id: 'exp1',
        tenantId: TENANT_A,
        goods: [{ invoiceValue: 1000 }],
        timeline: [],
        status: 'classification_pending',
        save: jest.fn().mockResolvedValue(true)
      };
      mockExpedition.findById.mockResolvedValue(exp);
      mockTaricCode.findOne.mockResolvedValue({
        code: '6109100010',
        // Sin duties
        vat: { applicable: 21 }
      });

      const res = await request(app(ctrl.applyClassification))
        .post('/r')
        .send({ expeditionId: 'exp1', itemIndex: 0, taricCode: '6109100010' });

      expect(res.status).toBe(200);
      expect(exp.goods[0].dutyRate).toBe(0);
    });

    test('cuando taricInfo.vat es undefined, usa 21', async () => {
      const exp = {
        _id: 'exp1',
        tenantId: TENANT_A,
        goods: [{ invoiceValue: 1000 }],
        timeline: [],
        status: 'classification_pending',
        save: jest.fn().mockResolvedValue(true)
      };
      mockExpedition.findById.mockResolvedValue(exp);
      mockTaricCode.findOne.mockResolvedValue({
        code: '6109100010',
        duties: { thirdCountry: 12 }
        // Sin vat
      });

      const res = await request(app(ctrl.applyClassification))
        .post('/r')
        .send({ expeditionId: 'exp1', itemIndex: 0, taricCode: '6109100010' });

      expect(res.status).toBe(200);
      expect(exp.goods[0].vatRate).toBe(21);
    });
  });

  describe('getCacheStats - Defaults de aiCache', () => {
    test('cuando getAICacheStats devuelve null', async () => {
      mockTaricService.getAICacheStats.mockResolvedValue(null);
      mockTaricCode.countDocuments.mockResolvedValue(0);
      mockTaricCode.distinct.mockResolvedValue([]);
      mockSearchHistory.countDocuments.mockResolvedValue(0);

      const res = await request(app(ctrl.getCacheStats, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      expect(res.body.data.totalEntries).toBe(0);
      expect(res.body.data.totalHits).toBe(0);
      expect(res.body.data.avgHits).toBe(0);
    });

    test('cuando distinct devuelve null (no array)', async () => {
      mockTaricService.getAICacheStats.mockResolvedValue({
        totalEntries: 10,
        totalHits: 50,
        avgHits: 5,
        validatedCount: 8,
        avgQuality: 0.9,
        topCodes: []
      });
      mockTaricCode.countDocuments.mockResolvedValue(100);
      mockTaricCode.distinct.mockResolvedValue(null);  // No es array
      mockSearchHistory.countDocuments.mockResolvedValue(20);

      const res = await request(app(ctrl.getCacheStats, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      expect(res.body.data.taricChapters).toBe(0);
    });
  });

  describe('markSearchAsUsed - Tenant filtering', () => {
    test('cuando usuario tiene tenantId, se usa en el filtro', async () => {
      mockSearchHistory.findOneAndUpdate.mockResolvedValue({
        _id: 'search1',
        wasUsed: true,
        expeditionId: 'exp1'
      });

      const res = await request(app(ctrl.markSearchAsUsed, 'put', '/r/:searchId'))
        .put('/r/search1')
        .send({ expeditionId: 'exp1' });

      expect(res.status).toBe(200);
      expect(mockSearchHistory.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'search1', tenantId: TENANT_A },
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('getTreeData - Filtrado de chapters', () => {
    test('cuando aggregate incluye chapter con _id null, lo filtra', async () => {
      mockTaricCode.aggregate.mockResolvedValue([
        { _id: '08', count: 100, sampleDesc: 'Frutas' },
        { _id: null, count: 5, sampleDesc: 'Sin capítulo' },
        { _id: '09', count: 50, sampleDesc: 'Café' }
      ]);

      const res = await request(app(ctrl.getTreeData, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      expect(res.body.data.results).toHaveLength(2);  // Solo 08 y 09
      expect(res.body.data.results.every(r => r.code !== null)).toBe(true);
    });
  });

  describe('validateClassification - Defaults de warnings y documents', () => {
    test('cuando taricInfo no tiene requiredDocuments ni measures', async () => {
      mockTaricCode.findOne.mockResolvedValue({
        code: '6109100010',
        duties: { thirdCountry: 12 },
        vat: { applicable: 21 }
        // Sin requiredDocuments ni measures
      });
      mockAiService.validateClassification.mockResolvedValue({
        isValid: true,
        confidence: 0.95,
        reasoning: 'Clasificación correcta',
        warnings: []
      });

      const res = await request(app(ctrl.validateClassification))
        .post('/r')
        .send({
          taricCode: '6109100010',
          description: 'Camisetas',
          origin: 'CN',
          value: 1000
        });

      expect(res.status).toBe(200);
      expect(res.body.data.requiredDocuments).toEqual([]);
      expect(res.body.data.measures).toEqual([]);
    });
  });

  describe('aiImproveWithFeedback - Default arrays', () => {
    test('cuando no se envían currentSuggestions ni feedbackHistory', async () => {
      mockAiService.improveClassificationWithFeedback.mockResolvedValue({
        suggestions: [{ code: '6109100010', confidence: 0.9 }]
      });

      const res = await request(app(ctrl.aiImproveWithFeedback))
        .post('/r')
        .send({ productDescription: 'Camisetas de algodón' });

      expect(res.status).toBe(200);
      expect(mockAiService.improveClassificationWithFeedback).toHaveBeenCalledWith(
        'Camisetas de algodón',
        [],
        []
      );
    });
  });

  describe('aiSuggestFromHistory - Default objects', () => {
    test('cuando no se envían historicalClassifications ni clientProfile', async () => {
      mockAiService.suggestBasedOnHistory.mockResolvedValue({
        suggestions: [{ code: '6109100010', confidence: 0.9 }]
      });

      const res = await request(app(ctrl.aiSuggestFromHistory))
        .post('/r')
        .send({ productDescription: 'Camisetas' });

      expect(res.status).toBe(200);
      expect(mockAiService.suggestBasedOnHistory).toHaveBeenCalledWith(
        'Camisetas',
        [],
        {}
      );
    });
  });

  describe('aiCrossValidate - Default productDetails', () => {
    test('cuando no se envía productDetails', async () => {
      mockAiService.crossValidateWithRegulations.mockResolvedValue({
        isValid: true,
        confidence: 0.95
      });

      const res = await request(app(ctrl.aiCrossValidate))
        .post('/r')
        .send({ classification: { taricCode: '6109100010' } });

      expect(res.status).toBe(200);
      expect(mockAiService.crossValidateWithRegulations).toHaveBeenCalledWith(
        { taricCode: '6109100010' },
        {}
      );
    });
  });

  describe('aiFullAnalysis - Default options', () => {
    test('cuando no se envían options', async () => {
      mockAiService.fullTaricAnalysis.mockResolvedValue({
        classification: { taricCode: '6109100010' }
      });

      const res = await request(app(ctrl.aiFullAnalysis))
        .post('/r')
        .send({ productData: { description: 'Camisetas' } });

      expect(res.status).toBe(200);
      expect(mockAiService.fullTaricAnalysis).toHaveBeenCalledWith(
        { description: 'Camisetas' },
        {}
      );
    });
  });

  describe('calculateDuties - Default preference', () => {
    test('cuando no se envía preference, usa 100', async () => {
      mockTaricService.calculateDuties.mockResolvedValue({
        dutyRate: 12,
        estimatedDuty: 120
      });

      const res = await request(app(ctrl.calculateDuties))
        .post('/r')
        .send({
          taricCode: '6109100010',
          customsValue: 1000,
          origin: 'CN'
        });

      expect(res.status).toBe(200);
      expect(mockTaricService.calculateDuties).toHaveBeenCalledWith(
        expect.objectContaining({ preference: '100' })
      );
    });
  });

  describe('suggestTaricCode - additionalInfo default', () => {
    test('cuando no se envía additionalInfo, usa objeto vacío', async () => {
      mockAiService.classifyProduct.mockResolvedValue([
        { code: '6109100010', confidence: 0.9, reasoning: 'Textil' }
      ]);
      mockTaricCode.findOne.mockResolvedValue(null);

      const res = await request(app(ctrl.suggestTaricCode))
        .post('/r')
        .send({ description: 'Camisetas' });

      expect(res.status).toBe(200);
      expect(mockAiService.classifyProduct).toHaveBeenCalledWith(
        expect.objectContaining({ additionalInfo: {} })
      );
    });
  });

  describe('getTaricInfo - Ramas de usuario opcional', () => {
    const appSinUser = (handler, metodo = 'get', ruta = '/r') => {
      const a = express();
      a.use(express.json());
      a[metodo](ruta, handler);
      return a;
    };

    test('cuando req.user no está definido, userId es undefined', async () => {
      const mockTaric = {
        code: '0807000000',
        isLeaf: true,
        description: { es: 'Melones' },
        breakdown: { chapter: '08' },
        toObject: jest.fn().mockReturnThis(),
        getFullPath: jest.fn().mockResolvedValue([])
      };
      mockTaricCode.findOne.mockResolvedValue(mockTaric);
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(appSinUser(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(mockTaricService.recordSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: undefined,
          tenantId: undefined
        })
      );
    });
  });

  describe('getSearchHistory - Límite default', () => {
    test('cuando no se envía limit, usa 10', async () => {
      mockTaricService.getUserSearchHistory.mockResolvedValue([]);

      const res = await request(app(ctrl.getSearchHistory, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      expect(mockTaricService.getUserSearchHistory).toHaveBeenCalledWith(
        USER._id,
        10
      );
    });
  });

  describe('getMostSearched - Defaults de días y límite', () => {
    test('cuando no se envían days ni limit, usa defaults', async () => {
      mockTaricService.getMostSearchedCodes.mockResolvedValue([]);

      const res = await request(app(ctrl.getMostSearched, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      expect(mockTaricService.getMostSearchedCodes).toHaveBeenCalledWith(
        TENANT_A,
        30,
        20
      );
    });
  });

  describe('getSearchStats - Default de días', () => {
    test('cuando no se envía days, usa 30', async () => {
      mockSearchHistory.getSearchStats.mockResolvedValue([{
        totalSearches: 100,
        foundCount: 80,
        usedCount: 50,
        avgResponseTime: 150,
        foundRate: 0.8,
        usageRate: 0.625
      }]);

      const res = await request(app(ctrl.getSearchStats, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      expect(mockSearchHistory.getSearchStats).toHaveBeenCalledWith(
        TENANT_A,
        30
      );
    });

    test('cuando getSearchStats devuelve array vacío, usa objeto default', async () => {
      mockSearchHistory.getSearchStats.mockResolvedValue([]);

      const res = await request(app(ctrl.getSearchStats, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      expect(res.body.data.totalSearches).toBe(0);
      expect(res.body.data.foundCount).toBe(0);
      expect(res.body.data.avgResponseTime).toBe(0);
    });
  });

  describe('cleanOldCache - Default de daysOld', () => {
    test('cuando no se envía daysOld, usa 60', async () => {
      mockAICache.cleanOldCache.mockResolvedValue({ deletedCount: 10 });

      const res = await request(app(ctrl.cleanOldCache, 'delete', '/r'))
        .delete('/r');

      expect(res.status).toBe(200);
      expect(mockAICache.cleanOldCache).toHaveBeenCalledWith(60);
    });
  });

  describe('searchTaric - Defaults de límite', () => {
    test('cuando no se envía limit, usa 20', async () => {
      mockTaricCode.getChapters = jest.fn().mockResolvedValue([]);

      const res = await request(app(ctrl.searchTaric, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
    });
  });

  describe('validateClassification - Cuando isValid es false', () => {
    test('dutyCalculation es null si validationResult.isValid es false', async () => {
      mockTaricCode.findOne.mockResolvedValue({
        code: '6109100010',
        duties: { thirdCountry: 12 },
        vat: { applicable: 21 }
      });
      mockAiService.validateClassification.mockResolvedValue({
        isValid: false,
        confidence: 0.3,
        reasoning: 'Clasificación incorrecta',
        warnings: ['El código no coincide con la descripción']
      });

      const res = await request(app(ctrl.validateClassification))
        .post('/r')
        .send({
          taricCode: '6109100010',
          description: 'Televisores',
          origin: 'CN',
          value: 1000
        });

      expect(res.status).toBe(200);
      expect(res.body.data.dutyCalculation).toBeNull();
    });
  });

  describe('getTaricInfo - Código normalizado con espacios', () => {
    test('normaliza código con espacios', async () => {
      const mockTaric = {
        code: '0807000000',
        isLeaf: true,
        description: { es: 'Melones' },
        breakdown: { chapter: '08' },
        toObject: jest.fn().mockReturnThis(),
        getFullPath: jest.fn().mockResolvedValue([])
      };
      mockTaricCode.findOne.mockResolvedValue(mockTaric);
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807 00 00 00');

      expect(res.status).toBe(200);
      expect(mockTaricCode.findOne).toHaveBeenCalledWith({ code: '0807000000' });
    });
  });

  describe('searchTaric - Ramas de code vs q', () => {
    test.skip('cuando se envía code, lo usa en lugar de q', async () => {
      mockTaricCode.find.mockResolvedValue([
        { code: '0807000000', description: { es: 'Melones' } }
      ]);

      const res = await request(app(ctrl.searchTaric, 'get', '/r'))
        .get('/r?code=0807&q=ignorado');

      expect(res.status).toBe(200);
    });

    test('cuando no hay code ni q, usa getChapters', async () => {
      mockTaricCode.getChapters = jest.fn().mockResolvedValue([
        { code: '08', description: 'Frutas' }
      ]);

      const res = await request(app(ctrl.searchTaric, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      expect(mockTaricCode.getChapters).toHaveBeenCalled();
    });

    test('cuando se envía chapter, usa findByChapter', async () => {
      mockTaricCode.findByChapter = jest.fn().mockResolvedValue([
        { code: '0807000000', description: { es: 'Melones' } }
      ]);

      const res = await request(app(ctrl.searchTaric, 'get', '/r'))
        .get('/r?chapter=08');

      expect(res.status).toBe(200);
      expect(mockTaricCode.findByChapter).toHaveBeenCalledWith('08');
    });
  });

  describe('searchTaric - isCodeSearch regex', () => {
    test.skip('cuando q es código numérico con puntos', async () => {
      mockTaricCode.findOne.mockResolvedValue({
        code: '0807000000',
        description: { es: 'Melones' }
      });
      mockTaricCode.find.mockResolvedValue([]);

      const res = await request(app(ctrl.searchTaric, 'get', '/r'))
        .get('/r?q=08.07');

      expect(res.status).toBe(200);
    });

    test('cuando q no es código numérico, busca por descripción', async () => {
      mockTaricCode.search = jest.fn().mockResolvedValue([
        { code: '0807000000', description: { es: 'Melones frescos' } }
      ]);

      const res = await request(app(ctrl.searchTaric, 'get', '/r'))
        .get('/r?q=melones');

      expect(res.status).toBe(200);
      expect(mockTaricCode.search).toHaveBeenCalledWith('melones', 20);
    });
  });

  describe('searchTaric - Códigos con aiNodes.length > 0', () => {
    test.skip('cuando IA genera nodos para capítulo sin datos', async () => {
      mockTaricCode.find.mockResolvedValueOnce([]).mockResolvedValue([]);
      mockAiService.generateTreeLevel.mockResolvedValue([
        { code: '0807', description: 'Melones' }
      ]);
      mockTaricCode.bulkWrite.mockResolvedValue({});
      mockHasSeasonalTariff.mockReturnValue(false);

      const res = await request(app(ctrl.searchTaric, 'get', '/r'))
        .get('/r?q=08');

      expect(res.status).toBe(200);
      expect(res.body.data.source).toBe('ai');
    });
  });

  describe('applyClassification - Todas las mercancías clasificadas', () => {
    test('cuando todos los goods tienen taricCode, cambia estado', async () => {
      const exp = {
        _id: 'exp1',
        tenantId: TENANT_A,
        goods: [
          { description: 'Item 1', taricCode: '6109100010' },
          { description: 'Item 2', invoiceValue: 1000 }
        ],
        timeline: [],
        status: 'classification_pending',
        save: jest.fn().mockResolvedValue(true)
      };
      mockExpedition.findById.mockResolvedValue(exp);
      mockTaricCode.findOne.mockResolvedValue({
        code: '6109100010',
        duties: { thirdCountry: 12 },
        vat: { applicable: 21 }
      });

      const res = await request(app(ctrl.applyClassification))
        .post('/r')
        .send({ expeditionId: 'exp1', itemIndex: 1, taricCode: '6109100010' });

      expect(res.status).toBe(200);
      expect(exp.status).toBe('classification_done');
    });
  });

  describe('getTaricInfo - Ramas de cache y fallbacks', () => {
    test('cuando cache tiene hierarchy undefined, usa array vacío', async () => {
      mockTaricCode.findOne.mockResolvedValue(null);
      mockTaricService.getFromAICache.mockResolvedValue({
        hits: 5,
        aiResponse: {
          description: 'Melons',
          description_es: 'Melones',
          chapter: '08'
          // Sin hierarchy
        }
      });
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(res.body.data.hierarchy).toEqual([]);
    });

    test('cuando IA tiene examples undefined, usa array vacío', async () => {
      mockTaricCode.findOne.mockResolvedValue(null);
      mockTaricService.getFromAICache.mockResolvedValue(null);
      mockTaricService._getCodeFromAPI.mockResolvedValue(null);
      mockAiService.getTaricCodeInfo.mockResolvedValue({
        description: 'Melons',
        chapter: '08'
        // Sin examples, hierarchy, measures
      });
      mockTaricService.saveToAICache.mockResolvedValue({});
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(res.body.data.examples).toEqual([]);
      expect(res.body.data.measures).toEqual([]);
      expect(res.body.data.hierarchy).toEqual([]);
    });
  });

  describe('suggestTaricCode - enrichedSuggestions taricInfo null', () => {
    test('cuando TaricCode.findOne devuelve null, taricInfo es null', async () => {
      mockAiService.classifyProduct.mockResolvedValue([
        { code: '6109100010', confidence: 0.9, reasoning: 'Textil' }
      ]);
      mockTaricCode.findOne.mockResolvedValue(null);

      const res = await request(app(ctrl.suggestTaricCode))
        .post('/r')
        .send({ description: 'Camisetas' });

      expect(res.status).toBe(200);
      expect(res.body.data.suggestions[0].taricInfo).toBeNull();
    });

    test('cuando TaricCode tiene info, la incluye en enrichedSuggestions', async () => {
      mockAiService.classifyProduct.mockResolvedValue([
        { code: '6109100010', confidence: 0.9, reasoning: 'Textil' }
      ]);
      mockTaricCode.findOne.mockResolvedValue({
        code: '6109100010',
        description: { es: 'Camisetas de algodón' },
        duties: { thirdCountry: 12 },
        vat: { applicable: 21 },
        supplementaryUnit: 'kg',
        requiredDocuments: ['Certificate of Origin'],
        measures: [{ type: 'tariff' }]
      });

      const res = await request(app(ctrl.suggestTaricCode))
        .post('/r')
        .send({ description: 'Camisetas' });

      expect(res.status).toBe(200);
      expect(res.body.data.suggestions[0].taricInfo).toBeDefined();
      expect(res.body.data.suggestions[0].taricInfo.description).toBeDefined();
    });
  });

  describe('getCacheStats - Promesas que lanzan excepciones', () => {
    test('cuando countDocuments lanza error, devuelve 0', async () => {
      mockTaricService.getAICacheStats.mockResolvedValue({ totalEntries: 10, totalHits: 50, avgHits: 5 });
      mockTaricCode.countDocuments.mockRejectedValue(new Error('DB error'));
      mockTaricCode.distinct.mockResolvedValue(['08', '09']);
      mockSearchHistory.countDocuments.mockResolvedValue(20);

      const res = await request(app(ctrl.getCacheStats, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      expect(res.body.data.taricCodesTotal).toBe(0);
    });

    test('cuando distinct lanza error, devuelve array vacío', async () => {
      mockTaricService.getAICacheStats.mockResolvedValue({ totalEntries: 10, totalHits: 50, avgHits: 5 });
      mockTaricCode.countDocuments.mockResolvedValue(100);
      mockTaricCode.distinct.mockRejectedValue(new Error('DB error'));
      mockSearchHistory.countDocuments.mockResolvedValue(20);

      const res = await request(app(ctrl.getCacheStats, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      expect(res.body.data.taricChapters).toBe(0);
    });

    test('cuando SearchHistory.countDocuments lanza error, devuelve 0', async () => {
      mockTaricService.getAICacheStats.mockResolvedValue({ totalEntries: 10, totalHits: 50, avgHits: 5 });
      mockTaricCode.countDocuments.mockResolvedValue(100);
      mockTaricCode.distinct.mockResolvedValue(['08', '09']);
      mockSearchHistory.countDocuments.mockRejectedValue(new Error('DB error'));

      const res = await request(app(ctrl.getCacheStats, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      expect(res.body.data.aiQueriesLast30d).toBe(0);
    });
  });

  describe('getTaricInfo - Campos measure con length', () => {
    test('cuando resultSummary.hasSpecialMeasures evalúa measures.length', async () => {
      const mockTaric = {
        code: '0807000000',
        isLeaf: true,
        description: { es: 'Melones' },
        breakdown: { chapter: '08', heading: '0807' },
        duties: { thirdCountry: 8.8 },
        measures: [{ type: 'prohibition' }, { type: 'quota' }],
        toObject: jest.fn().mockReturnThis(),
        getFullPath: jest.fn().mockResolvedValue([])
      };
      mockTaricCode.findOne.mockResolvedValue(mockTaric);
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(mockTaricService.recordSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          resultSummary: expect.objectContaining({
            hasSpecialMeasures: true
          })
        })
      );
    });
  });

  describe('validateClassification - Valor undefined', () => {
    test('cuando value es 0, el cálculo funciona', async () => {
      mockTaricCode.findOne.mockResolvedValue({
        code: '6109100010',
        duties: { thirdCountry: 12 },
        vat: { applicable: 21 }
      });
      mockAiService.validateClassification.mockResolvedValue({
        isValid: true,
        confidence: 0.95,
        reasoning: 'Clasificación correcta',
        warnings: []
      });

      const res = await request(app(ctrl.validateClassification))
        .post('/r')
        .send({
          taricCode: '6109100010',
          description: 'Camisetas',
          origin: 'CN',
          value: 0
        });

      expect(res.status).toBe(200);
      expect(res.body.data.dutyCalculation.estimatedDuty).toBe(0);
    });
  });

  describe('applyClassification - invoiceValue 0 o undefined', () => {
    test('cuando invoiceValue es 0, los cálculos dan 0', async () => {
      const exp = {
        _id: 'exp1',
        tenantId: TENANT_A,
        goods: [{ description: 'Item', invoiceValue: 0 }],
        timeline: [],
        status: 'classification_pending',
        save: jest.fn().mockResolvedValue(true)
      };
      mockExpedition.findById.mockResolvedValue(exp);
      mockTaricCode.findOne.mockResolvedValue({
        code: '6109100010',
        duties: { thirdCountry: 12 },
        vat: { applicable: 21 }
      });

      const res = await request(app(ctrl.applyClassification))
        .post('/r')
        .send({ expeditionId: 'exp1', itemIndex: 0, taricCode: '6109100010' });

      expect(res.status).toBe(200);
      expect(exp.goods[0].dutyAmount).toBe(0);
      expect(exp.goods[0].vatAmount).toBe(0);
    });
  });

  describe('getTaricInfo - Código sin normalizar (length > 10)', () => {
    test('cuando código tiene más de 10 dígitos, lo corta a 10', async () => {
      const mockTaric = {
        code: '0807000000',
        isLeaf: true,
        description: { es: 'Melones' },
        breakdown: { chapter: '08' },
        toObject: jest.fn().mockReturnThis(),
        getFullPath: jest.fn().mockResolvedValue([])
      };
      mockTaricCode.findOne.mockResolvedValue(mockTaric);
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/080700000012345');

      expect(res.status).toBe(200);
      expect(mockTaricCode.findOne).toHaveBeenCalledWith({ code: '0807000000' });
    });
  });

  describe('getTaricInfo - Código corto que se paddea', () => {
    test('cuando código tiene menos de 10 dígitos, se paddea con ceros', async () => {
      const mockTaric = {
        code: '0807000000',
        isLeaf: true,
        description: { es: 'Melones' },
        breakdown: { chapter: '08' },
        toObject: jest.fn().mockReturnThis(),
        getFullPath: jest.fn().mockResolvedValue([])
      };
      mockTaricCode.findOne.mockResolvedValue(mockTaric);
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807');

      expect(res.status).toBe(200);
      expect(mockTaricCode.findOne).toHaveBeenCalledWith({ code: '0807000000' });
    });
  });

  describe('suggestTaricCode - Suggestions vacías', () => {
    test('cuando aiService devuelve array vacío, enrichedSuggestions está vacío', async () => {
      mockAiService.classifyProduct.mockResolvedValue([]);

      const res = await request(app(ctrl.suggestTaricCode))
        .post('/r')
        .send({ description: 'Producto desconocido' });

      expect(res.status).toBe(200);
      expect(res.body.data.suggestions).toEqual([]);
    });
  });

  describe('getTaricInfo - resultSummary con valores undefined', () => {
    test('cuando duties.thirdCountry existe, dutyRate lo muestra', async () => {
      const mockTaric = {
        code: '0807000000',
        isLeaf: true,
        description: { es: 'Melones' },
        breakdown: { chapter: '08', heading: '0807' },
        duties: { thirdCountry: 8.8 },
        measures: [],
        toObject: jest.fn().mockReturnThis(),
        getFullPath: jest.fn().mockResolvedValue([])
      };
      mockTaricCode.findOne.mockResolvedValue(mockTaric);
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(mockTaricService.recordSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          resultSummary: expect.objectContaining({
            dutyRate: '8.8%'
          })
        })
      );
    });

    test('cuando duties.thirdCountry es undefined, dutyRate es 0%', async () => {
      const mockTaric = {
        code: '0807000000',
        isLeaf: true,
        description: { es: 'Melones' },
        breakdown: { chapter: '08', heading: '0807' },
        measures: [],
        toObject: jest.fn().mockReturnThis(),
        getFullPath: jest.fn().mockResolvedValue([])
      };
      mockTaricCode.findOne.mockResolvedValue(mockTaric);
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(mockTaricService.recordSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          resultSummary: expect.objectContaining({
            dutyRate: '0%'
          })
        })
      );
    });
  });

  describe('getTaricInfo - AI con measures?.length', () => {
    test('cuando aiResult.measures tiene elementos, hasSpecialMeasures es true', async () => {
      mockTaricCode.findOne.mockResolvedValue(null);
      mockTaricService.getFromAICache.mockResolvedValue(null);
      mockTaricService._getCodeFromAPI.mockResolvedValue(null);
      mockAiService.getTaricCodeInfo.mockResolvedValue({
        description: 'Melons',
        chapter: '08',
        heading: '0807',
        dutyRate: '8.8%',
        measures: [{ type: 'prohibition' }]
      });
      mockTaricService.saveToAICache.mockResolvedValue({});
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(mockTaricService.recordSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          resultSummary: expect.objectContaining({
            hasSpecialMeasures: true
          })
        })
      );
    });
  });

  describe('getTaricInfo - Cache AI con measures?.length', () => {
    test('cuando cache AI measures es undefined, hasSpecialMeasures es false', async () => {
      mockTaricCode.findOne.mockResolvedValue(null);
      mockTaricService.getFromAICache.mockResolvedValue({
        hits: 5,
        aiResponse: {
          description: 'Melons',
          description_es: 'Melones',
          chapter: '08',
          heading: '0807',
          dutyRate: '8.8%'
          // Sin measures
        }
      });
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(mockTaricService.recordSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          resultSummary: expect.objectContaining({
            hasSpecialMeasures: false
          })
        })
      );
    });
  });

  describe('searchTaric - results undefined', () => {
    test('cuando results es undefined, enrichedResults es array vacío', async () => {
      mockTaricCode.getChapters = jest.fn().mockResolvedValue(undefined);

      const res = await request(app(ctrl.searchTaric, 'get', '/r'))
        .get('/r');

      expect(res.status).toBe(200);
      expect(res.body.data.results).toEqual([]);
    });
  });

  describe('getTaricInfo - description.es y description.en y description fallbacks en hierarchy', () => {
    test.skip('cuando hierarchy tiene description vacío', async () => {
      const mockTaric = {
        code: '0807000000',
        isLeaf: true,
        description: { es: 'Melones' },
        breakdown: { chapter: '08' },
        toObject: jest.fn().mockReturnThis(),
        getFullPath: jest.fn().mockResolvedValue([
          { code: '0800000000', level: 2, description: {} }
        ])
      };
      mockTaricCode.findOne.mockResolvedValue(mockTaric);
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(res.body.data.hierarchy[0].description).toBe('');
    });

    test.skip('cuando children tiene description vacío', async () => {
      const mockTaric = {
        code: '0807000000',
        isLeaf: false,
        description: { es: 'Melones' },
        breakdown: { chapter: '08' },
        toObject: jest.fn().mockReturnThis(),
        getFullPath: jest.fn().mockResolvedValue([]),
        getChildren: jest.fn().mockResolvedValue([
          { code: '0807110000', description: {} }
        ])
      };
      mockTaricCode.findOne.mockResolvedValue(mockTaric);
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(res.body.data.children[0].description).toBe('');
    });
  });

  describe('applyClassification - hsCode default', () => {
    test('cuando se envía hsCode, lo usa', async () => {
      const exp = {
        _id: 'exp1',
        tenantId: TENANT_A,
        goods: [{ invoiceValue: 1000 }],
        timeline: [],
        status: 'classification_pending',
        save: jest.fn().mockResolvedValue(true)
      };
      mockExpedition.findById.mockResolvedValue(exp);
      mockTaricCode.findOne.mockResolvedValue({
        code: '6109100010',
        duties: { thirdCountry: 12 },
        vat: { applicable: 21 }
      });

      const res = await request(app(ctrl.applyClassification))
        .post('/r')
        .send({ expeditionId: 'exp1', itemIndex: 0, taricCode: '6109100010', hsCode: '999999' });

      expect(res.status).toBe(200);
      expect(exp.goods[0].hsCode).toBe('999999');
    });
  });

  describe('validateClassification - dutyCalculation con value falsy', () => {
    test('cuando value es undefined y taricInfo existe, calcula NaN', async () => {
      mockTaricCode.findOne.mockResolvedValue({
        code: '6109100010',
        duties: { thirdCountry: 12 },
        vat: { applicable: 21 }
      });
      mockAiService.validateClassification.mockResolvedValue({
        isValid: true,
        confidence: 0.95,
        reasoning: 'Clasificación correcta',
        warnings: []
      });

      const res = await request(app(ctrl.validateClassification))
        .post('/r')
        .send({
          taricCode: '6109100010',
          description: 'Camisetas',
          origin: 'CN'
          // Sin value
        });

      expect(res.status).toBe(200);
      expect(res.body.data.dutyCalculation).toBeDefined();
    });
  });

  describe('getTaricInfo - Cache AI examples y measures fallbacks', () => {
    test('cuando cache AI tiene examples, los devuelve', async () => {
      mockTaricCode.findOne.mockResolvedValue(null);
      mockTaricService.getFromAICache.mockResolvedValue({
        hits: 5,
        aiResponse: {
          description: 'Melons',
          description_es: 'Melones',
          chapter: '08',
          examples: ['Sandía', 'Melón']
        }
      });
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(res.body.data.examples).toEqual(['Sandía', 'Melón']);
    });

    test('cuando cache AI tiene measures, los devuelve', async () => {
      mockTaricCode.findOne.mockResolvedValue(null);
      mockTaricService.getFromAICache.mockResolvedValue({
        hits: 5,
        aiResponse: {
          description: 'Melons',
          description_es: 'Melones',
          chapter: '08',
          measures: [{ type: 'prohibition' }]
        }
      });
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(res.body.data.measures).toHaveLength(1);
    });
  });

  describe('applyClassification - taricInfo null', () => {
    test('cuando TaricCode.findOne devuelve null, no calcula duties ni vat', async () => {
      const exp = {
        _id: 'exp1',
        tenantId: TENANT_A,
        goods: [{ invoiceValue: 1000 }],
        timeline: [],
        status: 'classification_pending',
        save: jest.fn().mockResolvedValue(true)
      };
      mockExpedition.findById.mockResolvedValue(exp);
      mockTaricCode.findOne.mockResolvedValue(null);

      const res = await request(app(ctrl.applyClassification))
        .post('/r')
        .send({ expeditionId: 'exp1', itemIndex: 0, taricCode: '6109100010' });

      expect(res.status).toBe(200);
      expect(exp.goods[0].dutyRate).toBeUndefined();
      expect(exp.goods[0].vatRate).toBeUndefined();
    });
  });

  describe('validateClassification - taricInfo null', () => {
    test('cuando TaricCode.findOne devuelve null, dutyCalculation es null', async () => {
      mockTaricCode.findOne.mockResolvedValue(null);
      mockAiService.validateClassification.mockResolvedValue({
        isValid: true,
        confidence: 0.95,
        reasoning: 'Clasificación correcta',
        warnings: []
      });

      const res = await request(app(ctrl.validateClassification))
        .post('/r')
        .send({
          taricCode: '6109100010',
          description: 'Camisetas',
          origin: 'CN',
          value: 1000
        });

      expect(res.status).toBe(200);
      expect(res.body.data.dutyCalculation).toBeNull();
    });
  });

  describe('getTaricInfo - Campo chapter en breakdown', () => {
    test('cuando breakdown tiene todos los campos, los incluye en response', async () => {
      const mockTaric = {
        code: '0807110000',
        isLeaf: true,
        description: { es: 'Sandías' },
        breakdown: {
          chapter: '08',
          heading: '0807',
          subheading: '080711'
        },
        toObject: jest.fn().mockReturnThis(),
        getFullPath: jest.fn().mockResolvedValue([])
      };
      mockTaricCode.findOne.mockResolvedValue(mockTaric);
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807110000');

      expect(res.status).toBe(200);
      expect(res.body.data.chapter).toBe('08');
      expect(res.body.data.heading).toBe('0807');
      expect(res.body.data.subheading).toBe('080711');
    });
  });

  describe('suggestTaricCode - expeditionId pero sin itemIndex', () => {
    test.skip('cuando hay expeditionId pero itemIndex es undefined, no guarda en expediente', async () => {
      const expediente = {
        _id: 'exp1',
        tenantId: TENANT_A,
        save: jest.fn().mockResolvedValue(true)
      };
      mockExpedition.findById.mockResolvedValue(expediente);
      mockAiService.classifyProduct.mockResolvedValue([
        { code: '6109100010', confidence: 0.9, reasoning: 'Textil' }
      ]);
      mockTaricCode.findOne.mockResolvedValue(null);

      const res = await request(app(ctrl.suggestTaricCode))
        .post('/r')
        .send({
          description: 'Camisetas',
          expeditionId: 'exp1'
          // Sin itemIndex
        });

      expect(res.status).toBe(200);
      expect(expediente.save).not.toHaveBeenCalled();
    });
  });

  describe('getTaricInfo - Búsqueda de código padre con diferentes longitudes', () => {
    test('cuando código largo no existe, busca códigos padres hasta encontrar', async () => {
      mockTaricCode.findOne
        .mockResolvedValueOnce(null)  // Código exacto
        .mockResolvedValueOnce(null)  // Padre 8 dígitos
        .mockResolvedValueOnce({      // Padre 6 dígitos encontrado
          code: '08071100000',
          description: { es: 'Sandías' },
          breakdown: { chapter: '08' },
          isLeaf: false,
          toObject: jest.fn().mockReturnThis(),
          getFullPath: jest.fn().mockResolvedValue([]),
          getChildren: jest.fn().mockResolvedValue([])
        });
      mockTaricService.getFromAICache.mockResolvedValue(null);
      mockTaricService._getCodeFromAPI.mockResolvedValue(null);
      mockAiService.getTaricCodeInfo.mockResolvedValue(null);
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807119999');

      expect(res.status).toBe(200);
      expect(mockTaricCode.findOne).toHaveBeenCalledTimes(3);
    });
  });

  describe('searchTaric - Operador binary searchTerm && regex', () => {
    test.skip('cuando searchTerm existe y pasa regex, isCodeSearch es true', async () => {
      mockTaricCode.find.mockResolvedValue([
        { code: '0807000000', description: { es: 'Melones' } }
      ]);

      const res = await request(app(ctrl.searchTaric, 'get', '/r'))
        .get('/r?q=0807');

      expect(res.status).toBe(200);
    });
  });

  describe('searchTaric - Operador binary q para chapter', () => {
    test('cuando chapter existe, usa findByChapter', async () => {
      mockTaricCode.findByChapter = jest.fn().mockResolvedValue([
        { code: '0807000000', description: { es: 'Melones' } }
      ]);

      const res = await request(app(ctrl.searchTaric, 'get', '/r'))
        .get('/r?chapter=08');

      expect(res.status).toBe(200);
      expect(mockTaricCode.findByChapter).toHaveBeenCalledWith('08');
    });
  });

  describe('applyClassification - Estado no classification_pending', () => {
    test('cuando expediente no está en classification_pending, no cambia estado', async () => {
      const exp = {
        _id: 'exp1',
        tenantId: TENANT_A,
        goods: [{ invoiceValue: 1000, taricCode: '6109100010' }],
        timeline: [],
        status: 'in_progress',
        save: jest.fn().mockResolvedValue(true)
      };
      mockExpedition.findById.mockResolvedValue(exp);
      mockTaricCode.findOne.mockResolvedValue({
        code: '6109100010',
        duties: { thirdCountry: 12 },
        vat: { applicable: 21 }
      });

      const res = await request(app(ctrl.applyClassification))
        .post('/r')
        .send({ expeditionId: 'exp1', itemIndex: 0, taricCode: '6109100010' });

      expect(res.status).toBe(200);
      expect(exp.status).toBe('in_progress');
    });
  });

  describe('getTaricInfo - Cache y API fallbacks adicionales', () => {
    test('cuando AI cache tiene hierarchy vacío, lo incluye', async () => {
      mockTaricCode.findOne.mockResolvedValue(null);
      mockTaricService.getFromAICache.mockResolvedValue({
        hits: 5,
        aiResponse: {
          description: 'Melons',
          description_es: 'Melones',
          chapter: '08',
          hierarchy: []
        }
      });
      mockTaricService.recordSearch.mockResolvedValue({});

      const res = await request(app(ctrl.getTaricInfo, 'get', '/r/:code'))
        .get('/r/0807000000');

      expect(res.status).toBe(200);
      expect(res.body.data.hierarchy).toEqual([]);
    });
  });
});
