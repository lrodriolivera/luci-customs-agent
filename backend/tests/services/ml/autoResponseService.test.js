/**
 * Auto Response Service Tests
 * Phase 6.5: ML-based auto-response for AEAT requirements
 */

const {
  generateResponse,
  getTemplatePreview,
  listTemplates,
  RESPONSE_TEMPLATES,
  STANDARD_PHRASES
} = require('../../../src/services/ml/autoResponseService');

describe('Auto Response Service', () => {
  describe('generateResponse', () => {
    test('should generate response for documentary requirement', () => {
      const result = generateResponse(
        {
          id: 'req_123',
          requirementType: 'documentary',
          requestedDocuments: ['factura comercial'],
          specificQuestions: []
        },
        {
          mrn: '22ES1234567890AB1',
          customsValue: 50000,
          documents: [{ type: 'INVOICE', number: 'INV-001', name: 'Factura' }]
        }
      );

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response.sections).toBeDefined();
    });

    test('should include confidence level', () => {
      const result = generateResponse(
        {
          id: 'req_124',
          requirementType: 'valuation',
          requestedDocuments: [],
          specificQuestions: []
        },
        {
          mrn: '22ES1234567890AB1',
          customsValue: 50000
        }
      );

      expect(result.success).toBe(true);
      expect(result.response.confidence).toBeDefined();
      expect(result.response.confidence).toBeGreaterThanOrEqual(0);
    });

    test('should indicate if manual review required', () => {
      const result = generateResponse(
        {
          id: 'req_125',
          requirementType: 'classification',
          requestedDocuments: [],
          specificQuestions: []
        },
        { mrn: '22ES1234567890AB1' }
      );

      expect(result.success).toBe(true);
      expect(result.response.requiresReview).toBeDefined();
      expect(typeof result.response.requiresReview).toBe('boolean');
    });

    test('should suggest attachments', () => {
      const result = generateResponse(
        {
          id: 'req_126',
          requirementType: 'origin',
          requestedDocuments: [],
          specificQuestions: []
        },
        { mrn: '22ES1234567890AB1' }
      );

      expect(result.success).toBe(true);
      expect(result.response.suggestedAttachments).toBeDefined();
      expect(Array.isArray(result.response.suggestedAttachments)).toBe(true);
    });

    test('should include generated timestamp', () => {
      const result = generateResponse(
        {
          id: 'req_127',
          requirementType: 'documentary',
          requestedDocuments: ['factura'],
          specificQuestions: []
        },
        { mrn: '22ES1234567890AB1' }
      );

      expect(result.success).toBe(true);
      expect(result.response.generatedAt).toBeDefined();
    });

    test('should handle valuation type with low price questions', () => {
      const result = generateResponse(
        {
          id: 'req_128',
          requirementType: 'valuation',
          requestedDocuments: [],
          specificQuestions: ['Justificar precio bajo']
        },
        {
          mrn: '22ES1234567890AB1',
          customsValue: 100
        }
      );

      expect(result.success).toBe(true);
      expect(result.response.sections.length).toBeGreaterThan(0);
    });

    test('should handle physical inspection type', () => {
      const result = generateResponse(
        {
          id: 'req_129',
          requirementType: 'physical',
          requestedDocuments: [],
          specificQuestions: []
        },
        {
          mrn: '22ES1234567890AB1',
          reference: 'EXP-2024-001'
        }
      );

      expect(result.success).toBe(true);
      expect(result.response.sections).toBeDefined();
    });

    test('should include deadline reminder when provided', () => {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 3);

      const result = generateResponse(
        {
          id: 'req_130',
          requirementType: 'documentary',
          requestedDocuments: ['factura'],
          specificQuestions: [],
          deadline: deadline.toISOString()
        },
        { mrn: '22ES1234567890AB1' }
      );

      expect(result.success).toBe(true);
      expect(result.response.deadlineReminder).toBeDefined();
      expect(result.response.deadlineReminder.urgency).toBeDefined();
    });

    test('should generate summary', () => {
      const result = generateResponse(
        {
          id: 'req_131',
          requirementType: 'documentary',
          requestedDocuments: ['factura', 'packing list'],
          specificQuestions: []
        },
        { mrn: '22ES1234567890AB1' }
      );

      expect(result.success).toBe(true);
      expect(result.response.summary).toBeDefined();
      expect(result.response.summary.totalSections).toBeDefined();
    });
  });

  describe('getTemplatePreview', () => {
    test('should preview template with category and type', () => {
      const result = getTemplatePreview('documentary', 'invoice');

      expect(result.success).toBe(true);
      expect(result.template).toBeDefined();
      expect(result.template.content).toBeDefined();
      expect(result.template.requiredFields).toBeDefined();
    });

    test('should return error for non-existent template', () => {
      const result = getTemplatePreview('nonexistent', 'type');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should preview valuation template', () => {
      const result = getTemplatePreview('valuation', 'priceJustification');

      expect(result.success).toBe(true);
      expect(result.template.category).toBe('valuation');
      expect(result.template.type).toBe('priceJustification');
    });

    test('should preview origin template', () => {
      const result = getTemplatePreview('origin', 'originVerification');

      expect(result.success).toBe(true);
      expect(result.template).toBeDefined();
    });
  });

  describe('listTemplates', () => {
    test('should list all available templates', () => {
      const result = listTemplates();

      expect(result.success).toBe(true);
      expect(result.templates).toBeDefined();
      expect(Array.isArray(result.templates)).toBe(true);
      expect(result.templates.length).toBeGreaterThan(0);
    });

    test('should include template metadata', () => {
      const result = listTemplates();

      expect(result.success).toBe(true);
      result.templates.forEach(template => {
        expect(template.category).toBeDefined();
        expect(template.type).toBeDefined();
        expect(template.requiredFields).toBeDefined();
      });
    });

    test('should include standard phrases', () => {
      const result = listTemplates();

      expect(result.success).toBe(true);
      expect(result.standardPhrases).toBeDefined();
      expect(Array.isArray(result.standardPhrases)).toBe(true);
    });

    test('should have templates for different categories', () => {
      const result = listTemplates();

      expect(result.success).toBe(true);
      const categories = new Set(result.templates.map(t => t.category));
      expect(categories.has('documentary')).toBe(true);
      expect(categories.has('valuation')).toBe(true);
      expect(categories.has('classification')).toBe(true);
    });
  });

  describe('RESPONSE_TEMPLATES', () => {
    test('should have documentary templates', () => {
      expect(RESPONSE_TEMPLATES.documentary).toBeDefined();
      expect(RESPONSE_TEMPLATES.documentary.invoice).toBeDefined();
      expect(RESPONSE_TEMPLATES.documentary.bl).toBeDefined();
    });

    test('should have valuation templates', () => {
      expect(RESPONSE_TEMPLATES.valuation).toBeDefined();
      expect(RESPONSE_TEMPLATES.valuation.priceJustification).toBeDefined();
    });

    test('should have classification templates', () => {
      expect(RESPONSE_TEMPLATES.classification).toBeDefined();
      expect(RESPONSE_TEMPLATES.classification.taricJustification).toBeDefined();
    });

    test('should have origin templates', () => {
      expect(RESPONSE_TEMPLATES.origin).toBeDefined();
      expect(RESPONSE_TEMPLATES.origin.originVerification).toBeDefined();
    });

    test('should have physical templates', () => {
      expect(RESPONSE_TEMPLATES.physical).toBeDefined();
      expect(RESPONSE_TEMPLATES.physical.inspectionCoordination).toBeDefined();
    });

    test('should include template content and required fields', () => {
      Object.entries(RESPONSE_TEMPLATES).forEach(([category, types]) => {
        Object.entries(types).forEach(([type, template]) => {
          expect(template.template).toBeDefined();
          expect(template.requiredFields).toBeDefined();
          expect(Array.isArray(template.requiredFields)).toBe(true);
        });
      });
    });
  });

  describe('STANDARD_PHRASES', () => {
    test('should have standard phrases defined', () => {
      expect(STANDARD_PHRASES).toBeDefined();
      expect(typeof STANDARD_PHRASES).toBe('object');
    });

    test('should have party relationship phrases', () => {
      expect(STANDARD_PHRASES.partyRelationship).toBeDefined();
      expect(STANDARD_PHRASES.partyRelationship.independent).toBeDefined();
      expect(STANDARD_PHRASES.partyRelationship.related).toBeDefined();
    });

    test('should have low price reason phrases', () => {
      expect(STANDARD_PHRASES.lowPriceReasons).toBeDefined();
      expect(STANDARD_PHRASES.lowPriceReasons.promotion).toBeDefined();
      expect(STANDARD_PHRASES.lowPriceReasons.volume).toBeDefined();
    });

    test('should have value elements phrases', () => {
      expect(STANDARD_PHRASES.valueElements).toBeDefined();
      expect(STANDARD_PHRASES.valueElements.complete).toBeDefined();
    });
  });
});
