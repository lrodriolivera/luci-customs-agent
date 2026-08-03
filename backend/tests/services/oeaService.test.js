/**
 * Tests for OEA Service
 * Operador Economico Autorizado
 */

const oeaService = require('../../src/services/oeaService');

describe('OEA Service', () => {

  describe('Constants and Catalogs', () => {
    test('should have OEA benefits defined', () => {
      const benefits = oeaService.OEA_BENEFITS;

      expect(benefits).toBeDefined();
      expect(Array.isArray(benefits)).toBe(true);
      expect(benefits.length).toBeGreaterThan(0);

      // Check that each benefit has required fields
      benefits.forEach(benefit => {
        expect(benefit.code).toBeDefined();
        expect(benefit.name).toBeDefined();
        expect(benefit.category).toBeDefined();
        expect(benefit.types).toBeDefined();
        expect(Array.isArray(benefit.types)).toBe(true);
      });
    });

    test('should have guarantee reductions defined', () => {
      const reductions = oeaService.GUARANTEE_REDUCTIONS;

      expect(reductions).toBeDefined();
      expect(typeof reductions).toBe('object');
      expect(reductions.OEAC).toBeDefined();
      expect(reductions.OEAS).toBeDefined();
      expect(reductions.OEAF).toBeDefined();
    });

    test('should have simplifications defined', () => {
      const simplifications = oeaService.AVAILABLE_SIMPLIFICATIONS;

      expect(simplifications).toBeDefined();
      expect(Array.isArray(simplifications)).toBe(true);
      expect(simplifications.length).toBeGreaterThan(0);

      // Check standard simplification codes exist
      const codes = simplifications.map(s => s.code);
      expect(codes).toContain('SDE');
      expect(codes).toContain('ILE');
    });

    test('should have mutual recognition partners defined', () => {
      const partners = oeaService.MUTUAL_RECOGNITION_PARTNERS;

      expect(partners).toBeDefined();
      expect(Array.isArray(partners)).toBe(true);
      expect(partners.length).toBeGreaterThan(0);

      // Check USA C-TPAT exists
      const usa = partners.find(p => p.countryCode === 'US');
      expect(usa).toBeDefined();
      expect(usa.programName).toBe('C-TPAT');
    });
  });

  describe('validateApplication', () => {
    // Los fixtures se completaron con direccion, contacto y representante legal:
    // antes solo llevaban nombre, NIF y EORI y aun asi esperaban valid=true,
    // fijando un bug —habia dos validateApplication y la que se ejecutaba no
    // comprobaba esos campos, asi que una solicitud incompleta pasaba a
    // revision en la AEAT—.
    test('should validate complete organization data', () => {
      const data = {
        organization: {
          name: 'Test Company S.A.',
          nif: 'A12345678',
          eori: 'ESA12345678000',
          address: { street: 'Calle 1', city: 'Madrid', postalCode: '28001' },
          contact: { name: 'Contacto', email: 'c@ejemplo.es' },
          legalRepresentative: { name: 'Representante Legal' }
        },
        certification: {
          type: 'OEAC'
        }
      };

      const result = oeaService.validateApplication(data);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject missing organization name', () => {
      const data = {
        organization: {
          nif: 'A12345678',
          eori: 'ESA12345678000'
        },
        certification: {
          type: 'OEAC'
        }
      };

      const result = oeaService.validateApplication(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'organization.name')).toBe(true);
    });

    test('should reject missing NIF', () => {
      const data = {
        organization: {
          name: 'Test Company',
          eori: 'ESA12345678000'
        },
        certification: {
          type: 'OEAC'
        }
      };

      const result = oeaService.validateApplication(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'organization.nif')).toBe(true);
    });

    test('should reject missing EORI', () => {
      const data = {
        organization: {
          name: 'Test Company',
          nif: 'A12345678'
        },
        certification: {
          type: 'OEAC'
        }
      };

      const result = oeaService.validateApplication(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'organization.eori')).toBe(true);
    });

    test('should reject invalid certification type', () => {
      const data = {
        organization: {
          name: 'Test Company',
          nif: 'A12345678',
          eori: 'ESA12345678000'
        },
        certification: {
          type: 'INVALID'
        }
      };

      const result = oeaService.validateApplication(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'certification.type')).toBe(true);
    });

    test('should accept all valid certification types', () => {
      const types = ['OEAC', 'OEAS', 'OEAF'];

      types.forEach(type => {
        const data = {
          organization: {
            name: 'Test Company',
            nif: 'A12345678',
            eori: 'ESA12345678000',
            address: { street: 'Calle 1', city: 'Madrid', postalCode: '28001' },
            contact: { name: 'Contacto', email: 'c@ejemplo.es' },
            legalRepresentative: { name: 'Representante Legal' }
          },
          certification: { type }
        };

        const result = oeaService.validateApplication(data);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('getBenefitsByType', () => {
    test('should return benefits for OEAC', () => {
      const benefits = oeaService.getBenefitsByType('OEAC');

      expect(Array.isArray(benefits)).toBe(true);
      expect(benefits.length).toBeGreaterThan(0);

      // All benefits should apply to OEAC
      benefits.forEach(b => {
        expect(b.types).toContain('OEAC');
      });
    });

    test('should return benefits for OEAS', () => {
      const benefits = oeaService.getBenefitsByType('OEAS');

      expect(Array.isArray(benefits)).toBe(true);
      expect(benefits.length).toBeGreaterThan(0);

      // All benefits should apply to OEAS
      benefits.forEach(b => {
        expect(b.types).toContain('OEAS');
      });
    });

    test('should return benefits for OEAF (should include OEAC and OEAS)', () => {
      const benefitsOEAF = oeaService.getBenefitsByType('OEAF');
      const benefitsOEAC = oeaService.getBenefitsByType('OEAC');
      const benefitsOEAS = oeaService.getBenefitsByType('OEAS');

      // OEAF should have at least as many benefits as either OEAC or OEAS
      expect(benefitsOEAF.length).toBeGreaterThanOrEqual(Math.max(benefitsOEAC.length, benefitsOEAS.length));
    });

    test('should return empty array for invalid type', () => {
      const benefits = oeaService.getBenefitsByType('INVALID');

      expect(Array.isArray(benefits)).toBe(true);
      expect(benefits).toHaveLength(0);
    });
  });

  describe('getGuaranteeReductionForType', () => {
    test('should return reduction options for OEAC', () => {
      const reduction = oeaService.getGuaranteeReductionForType('OEAC');

      expect(reduction).toBeDefined();
      expect(reduction.comprehensive).toBeDefined();
      expect(reduction.transit).toBeDefined();
    });

    test('should return reduction options for OEAS', () => {
      const reduction = oeaService.getGuaranteeReductionForType('OEAS');

      expect(reduction).toBeDefined();
    });

    test('should return highest reductions for OEAF', () => {
      const reductionOEAF = oeaService.getGuaranteeReductionForType('OEAF');
      const reductionOEAC = oeaService.getGuaranteeReductionForType('OEAC');

      // OEAF should have at least as good reductions as OEAC
      expect(reductionOEAF.comprehensive).toBeGreaterThanOrEqual(reductionOEAC.comprehensive);
    });

    test('should return null for invalid type', () => {
      const reduction = oeaService.getGuaranteeReductionForType('INVALID');

      expect(reduction).toBeNull();
    });
  });

  describe('getSimplificationsForType', () => {
    test('should return simplifications for OEAC', () => {
      const simplifications = oeaService.getSimplificationsForType('OEAC');

      expect(Array.isArray(simplifications)).toBe(true);
      expect(simplifications.length).toBeGreaterThan(0);
    });

    test('should include required fields for each simplification', () => {
      const simplifications = oeaService.getSimplificationsForType('OEAC');

      simplifications.forEach(simp => {
        expect(simp.code).toBeDefined();
        expect(simp.name).toBeDefined();
        expect(simp.applicableTo).toBeDefined();
      });
    });
  });

  describe('getMutualRecognitionPartners', () => {
    test('should return list of mutual recognition partners', () => {
      const partners = oeaService.getMutualRecognitionPartners();

      expect(Array.isArray(partners)).toBe(true);
      expect(partners.length).toBeGreaterThan(0);
    });

    test('should include major trading partners', () => {
      const partners = oeaService.getMutualRecognitionPartners();
      const countryCodes = partners.map(p => p.countryCode);

      // Major EU mutual recognition partners
      expect(countryCodes).toContain('US'); // USA
      expect(countryCodes).toContain('JP'); // Japan
      expect(countryCodes).toContain('CH'); // Switzerland
    });

    test('should include partner details', () => {
      const partners = oeaService.getMutualRecognitionPartners();

      partners.forEach(partner => {
        expect(partner.country).toBeDefined();
        expect(partner.countryCode).toBeDefined();
        expect(partner.programName).toBeDefined();
      });
    });
  });

  describe('checkComplianceRequirements', () => {
    test('should return all requirements for OEAC', () => {
      const requirements = oeaService.checkComplianceRequirements('OEAC');

      expect(requirements).toBeDefined();
      expect(requirements.customsCompliance).toBeDefined();
      expect(requirements.recordKeeping).toBeDefined();
      expect(requirements.financialSolvency).toBeDefined();
      expect(requirements.practicalCompetence).toBeDefined();
    });

    test('should include security requirements for OEAS', () => {
      const requirements = oeaService.checkComplianceRequirements('OEAS');

      expect(requirements.securityStandards).toBeDefined();
      expect(requirements.securityStandards.required).toBe(true);
    });

    test('should include security requirements for OEAF', () => {
      const requirements = oeaService.checkComplianceRequirements('OEAF');

      expect(requirements.securityStandards).toBeDefined();
      expect(requirements.securityStandards.required).toBe(true);
    });

    test('should not require security for OEAC', () => {
      const requirements = oeaService.checkComplianceRequirements('OEAC');

      // OEAC does not require security standards
      expect(requirements.securityStandards.required).toBe(false);
    });
  });

  describe('calculateExpirationDate', () => {
    test('should calculate 5 years from approval date', () => {
      const approvalDate = new Date(2024, 0, 15); // Jan 15, 2024 (local time)
      const expirationDate = oeaService.calculateExpirationDate(approvalDate);

      expect(expirationDate.getFullYear()).toBe(2029);
      expect(expirationDate.getMonth()).toBe(0); // January
      // Date may vary by timezone, just check year and month
    });

    test('should handle current date if no date provided', () => {
      const expirationDate = oeaService.calculateExpirationDate();
      const now = new Date();

      // Should be approximately 5 years from now
      const diffYears = expirationDate.getFullYear() - now.getFullYear();
      expect(diffYears).toBe(5);
    });
  });

  describe('generateOEANumber', () => {
    test('should generate valid OEA number format', () => {
      const number = oeaService.generateOEANumber('OEAC', 'ESA12345678000');

      expect(number).toBeDefined();
      expect(typeof number).toBe('string');
      // OEA numbers typically start with country code
      expect(number.startsWith('ES')).toBe(true);
    });

    test('should include certification type in number', () => {
      const numberOEAC = oeaService.generateOEANumber('OEAC', 'ESA12345678000');
      const numberOEAS = oeaService.generateOEANumber('OEAS', 'ESA12345678000');

      // Numbers should be different for different types
      expect(numberOEAC).not.toBe(numberOEAS);
    });
  });

  describe('assessComplianceStatus', () => {
    test('should return excellent for all requirements met', () => {
      const requirements = {
        customsCompliance: { status: 'met' },
        recordKeeping: { status: 'met' },
        financialSolvency: { status: 'met' },
        practicalCompetence: { status: 'met' }
      };

      const status = oeaService.assessComplianceStatus(requirements, 'OEAC');

      expect(status).toBe('excellent');
    });

    test('should return warning for partial compliance', () => {
      const requirements = {
        customsCompliance: { status: 'met' },
        recordKeeping: { status: 'partial' },
        financialSolvency: { status: 'partial' },
        practicalCompetence: { status: 'met' }
      };

      const status = oeaService.assessComplianceStatus(requirements, 'OEAC');

      expect(['warning', 'acceptable']).toContain(status);
    });

    test('should return critical for any not met', () => {
      const requirements = {
        customsCompliance: { status: 'not_met' },
        recordKeeping: { status: 'met' },
        financialSolvency: { status: 'met' },
        practicalCompetence: { status: 'met' }
      };

      const status = oeaService.assessComplianceStatus(requirements, 'OEAC');

      expect(status).toBe('critical');
    });

    test('should include security for OEAS/OEAF assessment', () => {
      const requirementsWithSecurity = {
        customsCompliance: { status: 'met' },
        recordKeeping: { status: 'met' },
        financialSolvency: { status: 'met' },
        practicalCompetence: { status: 'met' },
        securityStandards: { status: 'not_met' }
      };

      const status = oeaService.assessComplianceStatus(requirementsWithSecurity, 'OEAS');

      expect(status).toBe('critical');
    });
  });

  describe('getAuditTypes', () => {
    test('should return list of audit types', () => {
      const types = oeaService.getAuditTypes();

      expect(Array.isArray(types)).toBe(true);
      expect(types).toContain('internal');
      expect(types).toContain('external');
      expect(types).toContain('aeat');
      expect(types).toContain('renewal');
    });
  });

  describe('validateAuditData', () => {
    test('should validate complete audit data', () => {
      const audit = {
        date: new Date().toISOString(),
        type: 'internal',
        auditor: { name: 'Auditor Name' },
        scope: ['customs_compliance'],
        result: 'passed'
      };

      const result = oeaService.validateAuditData(audit);

      expect(result.valid).toBe(true);
    });

    test('should reject missing date', () => {
      const audit = {
        type: 'internal',
        result: 'passed'
      };

      const result = oeaService.validateAuditData(audit);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'date')).toBe(true);
    });

    test('should reject invalid type', () => {
      const audit = {
        date: new Date().toISOString(),
        type: 'invalid_type',
        result: 'passed'
      };

      const result = oeaService.validateAuditData(audit);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'type')).toBe(true);
    });

    test('should reject invalid result', () => {
      const audit = {
        date: new Date().toISOString(),
        type: 'internal',
        result: 'invalid_result'
      };

      const result = oeaService.validateAuditData(audit);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'result')).toBe(true);
    });
  });

  describe('getInfo', () => {
    test('should return system information', () => {
      const info = oeaService.getInfo();

      expect(info).toBeDefined();
      expect(info.system).toBeDefined();
      expect(info.version).toBeDefined();
      expect(info.types).toBeDefined();
      expect(info.types).toContain('OEAC');
      expect(info.types).toContain('OEAS');
      expect(info.types).toContain('OEAF');
    });
  });
});
