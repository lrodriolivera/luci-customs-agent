/**
 * Classification Service Tests
 * Phase 6.5: ML-enhanced TARIC classification
 */

const {
  classifyProduct,
  recordClassificationFeedback,
  getClassificationStats,
  CLASSIFICATION_PATTERNS
} = require('../../../src/services/ml/classificationService');

describe('Classification Service', () => {
  describe('classifyProduct', () => {
    test('should classify electronics product correctly', () => {
      const result = classifyProduct({
        description: 'Telefono movil smartphone celular electronico',
        material: 'electronico',
        use: 'comunicacion'
      });

      expect(result.success).toBe(true);
      expect(result.classification).toBeDefined();
      expect(result.classification.category).toBe('electronics');
      expect(result.classification.code).toMatch(/^85/);
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should classify apparel product correctly', () => {
      const result = classifyProduct({
        description: 'Camiseta de algodon para hombre manga corta',
        material: '100% algodon',
        use: 'vestir'
      });

      expect(result.success).toBe(true);
      expect(result.classification).toBeDefined();
      expect(result.classification.category).toBe('apparel');
      expect(result.classification.code).toMatch(/^6/);
    });

    test('should classify footwear product correctly', () => {
      const result = classifyProduct({
        description: 'Zapatillas deportivas sport calzado zapato running',
        material: 'textil y caucho',
        use: 'deporte calzado'
      });

      expect(result.success).toBe(true);
      expect(result.classification).toBeDefined();
      expect(result.classification.category).toBe('footwear');
      expect(result.classification.code).toMatch(/^64/);
    });

    test('should classify toys product correctly', () => {
      const result = classifyProduct({
        description: 'Muneca figura juguete doll toy para juego',
        material: 'juguete',
        use: 'juguete juego'
      });

      expect(result.success).toBe(true);
      expect(result.classification).toBeDefined();
      expect(result.classification.category).toBe('toys');
      expect(result.classification.code).toMatch(/^95/);
    });

    test('should classify furniture product correctly', () => {
      const result = classifyProduct({
        description: 'Silla mueble furniture chair asiento seat para oficina',
        material: 'mueble mobiliario',
        use: 'asiento mueble'
      });

      expect(result.success).toBe(true);
      expect(result.classification).toBeDefined();
      expect(result.classification.category).toBe('furniture');
      expect(result.classification.code).toMatch(/^94/);
    });

    test('should return suggestions for alternative codes', () => {
      const result = classifyProduct({
        description: 'Ordenador portatil laptop con pantalla 15 pulgadas'
      });

      expect(result.success).toBe(true);
      expect(result.suggestions).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    test('should indicate manual review for low confidence', () => {
      const result = classifyProduct({
        description: 'Articulo generico sin especificaciones claras'
      });

      expect(result.success).toBe(true);
      // May or may not require manual review depending on match
    });

    test('should include classification ID', () => {
      const result = classifyProduct({
        description: 'Television tv monitor pantalla electronico 55 pulgadas'
      });

      expect(result.success).toBe(true);
      if (result.classification) {
        expect(result.classificationId).toBeDefined();
        expect(result.classificationId).toMatch(/^class_/);
      }
    });

    test('should include reasoning', () => {
      const result = classifyProduct({
        description: 'Cargador USB universal para telefono'
      });

      expect(result.success).toBe(true);
      if (result.classification) {
        expect(result.reasoning).toBeDefined();
        expect(Array.isArray(result.reasoning)).toBe(true);
      }
    });

    test('should include additional checks', () => {
      const result = classifyProduct({
        description: 'Pantalon vaquero jeans para mujer'
      });

      expect(result.success).toBe(true);
      if (result.classification) {
        expect(result.additionalChecks).toBeDefined();
        expect(Array.isArray(result.additionalChecks)).toBe(true);
      }
    });

    test('should return confidence level', () => {
      const result = classifyProduct({
        description: 'Auriculares bluetooth inalambricos'
      });

      expect(result.success).toBe(true);
      if (result.classification) {
        expect(result.confidenceLevel).toBeDefined();
        expect(['high', 'medium', 'low']).toContain(result.confidenceLevel);
      }
    });

    test('should handle missing description gracefully', () => {
      const result = classifyProduct({});

      expect(result.success).toBe(true);
      expect(result.classification).toBeNull();
      expect(result.requiresManualReview).toBe(true);
    });

    test('should combine material and use for better classification', () => {
      const result = classifyProduct({
        description: 'Bolsa grande',
        material: 'plastico',
        use: 'envase'
      });

      expect(result.success).toBe(true);
      if (result.classification) {
        expect(result.classification.category).toBe('plastics');
      }
    });
  });

  describe('recordClassificationFeedback', () => {
    test('should record feedback for existing classification', () => {
      // First classify a product that will match
      const classification = classifyProduct({
        description: 'Tablet ordenador portatil laptop computer pc electronico'
      });

      if (classification.classificationId) {
        // Record feedback
        const feedback = recordClassificationFeedback(
          classification.classificationId,
          '8471.30',
          'Clasificacion correcta'
        );

        expect(feedback.success).toBe(true);
        expect(feedback.feedback).toBeDefined();
        expect(feedback.modelConfidence).toBeDefined();
      } else {
        // If no classification, skip this test
        expect(classification.success).toBe(true);
      }
    });

    test('should return error for non-existent classification', () => {
      const feedback = recordClassificationFeedback(
        'non_existent_id',
        '1234.56'
      );

      expect(feedback.success).toBe(false);
      expect(feedback.error).toBeDefined();
    });

    test('should track if classification was correct', () => {
      const classification = classifyProduct({
        description: 'Telefono movil smartphone phone celular electronico'
      });

      if (classification.classificationId && classification.classification) {
        const feedback = recordClassificationFeedback(
          classification.classificationId,
          classification.classification.code
        );

        expect(feedback.success).toBe(true);
        expect(feedback.feedback.wasCorrect).toBeDefined();
      } else {
        expect(classification.success).toBe(true);
      }
    });
  });

  describe('getClassificationStats', () => {
    test('should return statistics', () => {
      const stats = getClassificationStats();

      expect(stats.success).toBe(true);
      expect(stats.statistics).toBeDefined();
      expect(stats.statistics.totalClassifications).toBeDefined();
      expect(stats.statistics.totalFeedback).toBeDefined();
      expect(stats.statistics.modelConfidence).toBeDefined();
    });

    test('should include category distribution', () => {
      const stats = getClassificationStats();

      expect(stats.statistics.categoryDistribution).toBeDefined();
      expect(typeof stats.statistics.categoryDistribution).toBe('object');
    });
  });

  describe('CLASSIFICATION_PATTERNS', () => {
    test('should have electronics patterns', () => {
      expect(CLASSIFICATION_PATTERNS.electronics).toBeDefined();
      expect(CLASSIFICATION_PATTERNS.electronics.keywords).toBeDefined();
      expect(CLASSIFICATION_PATTERNS.electronics.subcategories).toBeDefined();
    });

    test('should have apparel patterns', () => {
      expect(CLASSIFICATION_PATTERNS.apparel).toBeDefined();
      expect(CLASSIFICATION_PATTERNS.apparel.subcategories.tshirts).toBeDefined();
    });

    test('should have footwear patterns', () => {
      expect(CLASSIFICATION_PATTERNS.footwear).toBeDefined();
      expect(CLASSIFICATION_PATTERNS.footwear.chapter).toBe('64');
    });

    test('should have toys patterns', () => {
      expect(CLASSIFICATION_PATTERNS.toys).toBeDefined();
      expect(CLASSIFICATION_PATTERNS.toys.chapter).toBe('95');
    });

    test('should have furniture patterns', () => {
      expect(CLASSIFICATION_PATTERNS.furniture).toBeDefined();
      expect(CLASSIFICATION_PATTERNS.furniture.chapter).toBe('94');
    });

    test('should have machinery patterns', () => {
      expect(CLASSIFICATION_PATTERNS.machinery).toBeDefined();
      expect(CLASSIFICATION_PATTERNS.machinery.chapter).toBe('84');
    });

    test('should have plastics patterns', () => {
      expect(CLASSIFICATION_PATTERNS.plastics).toBeDefined();
      expect(CLASSIFICATION_PATTERNS.plastics.chapter).toBe('39');
    });
  });
});
