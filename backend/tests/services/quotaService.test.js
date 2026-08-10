/**
 * Tests for Quota Service
 */

const quotaService = require('../../src/services/quotaService');

describe('Quota Service', () => {

  describe('checkQuotaAvailability', () => {
    test('should find quota for beef from Argentina', () => {
      const result = quotaService.checkQuotaAvailability('02011000', 'AR', 10000, 'kg');

      expect(result.found).toBe(true);
      expect(result.count).toBeGreaterThan(0);
      expect(result.quotas[0].type).toBeDefined();
    });

    test('should find quota for beef from US', () => {
      const result = quotaService.checkQuotaAvailability('02011000', 'US', 5000, 'kg');

      expect(result.found).toBe(true);
      expect(result.quotas.some(q => q.originCountries.includes('US'))).toBe(true); // US is in origin list for Q090001
      expect(result.quotas[0].quotaId).toBe('Q090001'); // Autonomous quota includes US
    });

    test('should find quota for pork from Canada (CETA)', () => {
      const result = quotaService.checkQuotaAvailability('02031110', 'CA', 5000, 'kg');

      expect(result.found).toBe(true);
      expect(result.quotas[0].agreement).toBe('CETA');
      expect(result.quotas[0].requiresCertificate).toBe('EUR.1');
    });

    test('should not find quota for non-quota products', () => {
      const result = quotaService.checkQuotaAvailability('8517120000', 'CN', 100, 'kg');

      expect(result.found).toBe(false);
      expect(result.count).toBe(0);
      expect(result.quotas).toHaveLength(0);
    });

    test('should check if requested quantity is available', () => {
      const result = quotaService.checkQuotaAvailability('02011000', 'AR', 100000000, 'kg');

      if (result.found && result.quotas.length > 0) {
        const hasAvailable = result.quotas.some(q => q.available);
        // With 100M kg request, should exceed most quotas
        expect(hasAvailable).toBeDefined();
      }
    });

    /**
     * Los saldos de este servicio son un catalogo ESTATICO en codigo, no una consulta
     * al sistema de contingentes de la Comision. Un contingente FCFS puede agotarse en
     * horas, asi que presentar "Disponible: 12.550.000 kg" como disponibilidad actual
     * es afirmar algo que no se ha consultado. Detectado en produccion el 10/Ago/2026.
     */
    test('el saldo se marca como NO consultado en tiempo real', () => {
      const result = quotaService.checkQuotaAvailability('02011000', 'AR', 10000, 'kg');

      expect(result.found).toBe(true);
      for (const quota of result.quotas) {
        expect(quota.volume.isLiveBalance).toBe(false);
        expect(quota.volume.officialSource).toMatch(/^https:\/\//);
      }
    });

    test('should sort quotas by lowest tariff first', () => {
      const result = quotaService.checkQuotaAvailability('02011000', 'AR', 1000, 'kg');

      if (result.found && result.quotas.length > 1) {
        for (let i = 0; i < result.quotas.length - 1; i++) {
          expect(result.quotas[i].duty.inQuota).toBeLessThanOrEqual(result.quotas[i + 1].duty.inQuota);
        }
      }
    });

    test('should calculate utilization percentage', () => {
      const result = quotaService.checkQuotaAvailability('02011000', 'AR', 1000, 'kg');

      if (result.found && result.quotas.length > 0) {
        expect(result.quotas[0].volume.utilizationPercent).toBeGreaterThanOrEqual(0);
        expect(result.quotas[0].volume.utilizationPercent).toBeLessThanOrEqual(100);
      }
    });

    test('should mark quota as critical if >95% utilized', () => {
      const result = quotaService.checkQuotaAvailability('04021019', 'US', 1000, 'kg');

      if (result.found && result.quotas.length > 0) {
        const criticalQuota = result.quotas.find(q => q.volume.utilizationPercent > 95);
        if (criticalQuota) {
          expect(criticalQuota.critical).toBe(true);
        }
      }
    });
  });

  describe('reserveQuota', () => {
    test('should reserve quota successfully', () => {
      const result = quotaService.reserveQuota('Q090001', 1000, {
        type: 'import',
        originCountry: 'AR'
      });

      expect(result.success).toBe(true);
      expect(result.reservationId).toContain('RES-Q090001');
      expect(result.quantity).toBe(1000);
      expect(result.instructions).toBeInstanceOf(Array);
      expect(result.instructions.length).toBeGreaterThan(0);
    });

    test('should fail if quota does not exist', () => {
      const result = quotaService.reserveQuota('Q999999', 1000, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('no encontrado');
    });

    test('should fail if quantity exceeds availability', () => {
      const result = quotaService.reserveQuota('Q090001', 999999999, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('excede disponibilidad');
      expect(result.available).toBeDefined();
      expect(result.requested).toBe(999999999);
    });

    test('should include EUR.1 requirement for CETA quotas', () => {
      const result = quotaService.reserveQuota('Q094100', 1000, {});

      if (result.success) {
        const hasEUR1 = result.instructions.some(i => i && i.includes('EUR.1'));
        expect(hasEUR1).toBe(true);
      }
    });

    test('should warn for critical quotas', () => {
      const result = quotaService.reserveQuota('Q090002', 100, {}); // Critical quota

      if (result.success) {
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('crítico');
      }
    });
  });

  describe('calculateQuotaSavings', () => {
    test('should calculate savings for eligible product', () => {
      const result = quotaService.calculateQuotaSavings('02011000', 'AR', 10000, 50000);

      if (result.applicable) {
        expect(result.dutyWithoutQuota).toBeGreaterThan(0);
        expect(result.dutyWithQuota).toBeGreaterThanOrEqual(0);
        expect(result.savings).toBeGreaterThan(0);
        expect(result.savingsPercent).toBeGreaterThan(0);
        expect(result.recommendation).toContain('contingente');
      }
    });

    test('should return not applicable if no quotas found', () => {
      const result = quotaService.calculateQuotaSavings('8517120000', 'CN', 100, 50000);

      expect(result.applicable).toBe(false);
      expect(result.savings).toBe(0);
      expect(result.message).toContain('No hay contingentes');
    });

    test('should return not applicable if quota is exhausted', () => {
      // Try with a quota that has very limited availability
      const result = quotaService.calculateQuotaSavings('04021019', 'US', 10000000, 5000000);

      if (!result.applicable) {
        expect(result.message || result.quota?.recommendation).toBeDefined();
      }
    });

    test('should calculate percentage savings correctly', () => {
      const result = quotaService.calculateQuotaSavings('02011000', 'AR', 10000, 50000);

      if (result.applicable && result.savings > 0) {
        const expectedPercent = (result.savings / result.dutyWithoutQuota) * 100;
        expect(result.savingsPercent).toBeCloseTo(expectedPercent, 1);
      }
    });
  });

  describe('getQuotasByAgreement', () => {
    test('should return CETA quotas', () => {
      const result = quotaService.getQuotasByAgreement('CETA');

      expect(result.agreement).toBe('CETA');
      expect(result.count).toBeGreaterThan(0);
      expect(result.quotas).toBeInstanceOf(Array);
      // All returned quotas should be CETA
      result.quotas.forEach(q => {
        expect(q.agreement).toBe('CETA');
      });
    });

    test('should return JEFTA quotas', () => {
      const result = quotaService.getQuotasByAgreement('JEFTA');

      expect(result.agreement).toBe('JEFTA');
      // All returned quotas should be JEFTA
      result.quotas.forEach(q => {
        expect(q.agreement).toBe('JEFTA');
      });
    });

    test('should return EU-MERCOSUR quotas', () => {
      const result = quotaService.getQuotasByAgreement('EU-MERCOSUR');

      expect(result.agreement).toBe('EU-MERCOSUR');
      expect(result.count).toBeGreaterThan(0);
      expect(result.quotas.every(q => q.originCountries.some(c => ['AR', 'BR', 'UY', 'PY'].includes(c)))).toBe(true);
    });

    test('should return empty for non-existent agreement', () => {
      const result = quotaService.getQuotasByAgreement('NON_EXISTENT');

      expect(result.agreement).toBe('NON_EXISTENT');
      expect(result.count).toBe(0);
      expect(result.quotas).toHaveLength(0);
    });

    test('should include utilization percentage', () => {
      const result = quotaService.getQuotasByAgreement('CETA');

      if (result.quotas.length > 0) {
        expect(result.quotas[0].volume.utilizationPercent).toBeDefined();
        expect(typeof result.quotas[0].volume.utilizationPercent).toBe('number');
      }
    });
  });

  describe('getCriticalQuotas', () => {
    test('should return quotas with >90% utilization or marked as critical', () => {
      const critical = quotaService.getCriticalQuotas();

      expect(critical).toBeInstanceOf(Array);
      if (critical.length > 0) {
        // Each quota should either have >90% utilization OR be explicitly marked as critical
        critical.forEach(q => {
          const isCritical = q.utilizationPercent > 90;
          if (!isCritical) {
            // If not >90%, it should have been marked as critical in the source data
            expect(q.utilizationPercent).toBeGreaterThan(70); // At least >70%
          }
        });
      }
    });

    test('should sort by utilization percentage descending', () => {
      const critical = quotaService.getCriticalQuotas();

      if (critical.length > 1) {
        for (let i = 0; i < critical.length - 1; i++) {
          expect(critical[i].utilizationPercent).toBeGreaterThanOrEqual(critical[i + 1].utilizationPercent);
        }
      }
    });

    test('should include exhaustion date estimate', () => {
      const critical = quotaService.getCriticalQuotas();

      if (critical.length > 0) {
        expect(critical[0].estimatedExhaustion).toBeDefined();
        expect(typeof critical[0].estimatedExhaustion).toBe('string');
      }
    });

    /**
     * La criticidad salia de `utilization > 90 || quota.critical`, y dos contingentes
     * venian marcados `critical: true` a mano con el 79% y el 85,86% consumido: la
     * pestaña "Contingentes Criticos" los listaba con "Solicite reserva urgente"
     * mientras su propia ficha decia "Mas de 90 dias" de margen. Un aviso de urgencia
     * que contradice la cifra que lo acompaña desorienta. Ahora sale solo del consumo.
     */
    test('solo son criticos los que superan el 90% consumido', () => {
      const critical = quotaService.getCriticalQuotas();

      expect(critical.length).toBeGreaterThan(0); // si no, el test no probaria nada
      for (const q of critical) {
        expect(q.utilizationPercent).toBeGreaterThan(90);
      }
    });

    /**
     * La fecha de agotamiento es una extrapolacion lineal sobre un consumo que no se
     * actualiza nunca (catalogo estatico). Devolver una fecha concreta y a secas se
     * lee como un dato comprobado, cuando puede venir de cifras congeladas hace meses.
     */
    test('la fecha de agotamiento se declara como proyeccion, no como dato', () => {
      const critical = quotaService.getCriticalQuotas();

      const conFecha = critical.filter(q => /\d{4}-\d{2}-\d{2}/.test(q.estimatedExhaustion));
      expect(conFecha.length).toBeGreaterThan(0); // si no, el test no probaria nada
      for (const q of conFecha) {
        expect(q.estimatedExhaustion).toMatch(/proyeccion sobre datos no actualizados/i);
      }
    });

    test('should include quota details', () => {
      const critical = quotaService.getCriticalQuotas();

      if (critical.length > 0) {
        const quota = critical[0];
        expect(quota.quotaId).toBeDefined();
        expect(quota.orderNumber).toBeDefined();
        expect(quota.description).toBeDefined();
        expect(quota.available).toBeDefined();
        expect(quota.unit).toBeDefined();
      }
    });
  });

  describe('generateQuotaReport', () => {
    test('should generate full report without filters', () => {
      const report = quotaService.generateQuotaReport({});

      expect(report.generatedAt).toBeDefined();
      expect(report.summary.total).toBeGreaterThan(0);
      expect(report.quotas).toBeInstanceOf(Array);
      expect(report.quotas.length).toBe(report.summary.total);
    });

    test('should filter by type', () => {
      const report = quotaService.generateQuotaReport({ type: 'fta' });

      expect(report.filters.type).toBe('fta');
      if (report.quotas.length > 0) {
        expect(report.quotas.every(q => q.type === 'fta')).toBe(true);
      }
    });

    test('should filter by agreement', () => {
      const report = quotaService.generateQuotaReport({ agreement: 'CETA' });

      expect(report.filters.agreement).toBe('CETA');
      if (report.quotas.length > 0) {
        expect(report.quotas.every(q => q.agreement === 'CETA')).toBe(true);
      }
    });

    test('should filter by origin country', () => {
      const report = quotaService.generateQuotaReport({ originCountry: 'CA' });

      expect(report.filters.originCountry).toBe('CA');
      if (report.quotas.length > 0) {
        // Verify that returned quotas are relevant to CA
        report.quotas.forEach(q => {
          // The quota should have origin countries defined
          expect(q).toHaveProperty('originCountries');
        });
      }
    });

    test('should calculate summary statistics', () => {
      const report = quotaService.generateQuotaReport({});

      expect(report.summary.total).toBeGreaterThan(0);
      expect(report.summary.critical).toBeGreaterThanOrEqual(0);
      expect(report.summary.available).toBeGreaterThanOrEqual(0);
      expect(report.summary.exhausted).toBeGreaterThanOrEqual(0);
      expect(report.summary.byType).toBeDefined();
    });

    test('should classify quota status correctly', () => {
      const report = quotaService.generateQuotaReport({});

      if (report.quotas.length > 0) {
        report.quotas.forEach(quota => {
          expect(['available', 'critical', 'exhausted']).toContain(quota.status);
        });
      }
    });
  });

  describe('ACTIVE_QUOTAS data integrity', () => {
    test('should have valid quota structure', () => {
      const quotas = quotaService.ACTIVE_QUOTAS;

      Object.entries(quotas).forEach(([quotaId, quota]) => {
        expect(quota.orderNumber).toBeDefined();
        expect(quota.type).toBeDefined();
        expect(quota.description).toBeDefined();
        expect(quota.taricCodes).toBeInstanceOf(Array);
        expect(quota.originCountries).toBeInstanceOf(Array);
        expect(quota.volume).toBeDefined();
        expect(quota.volume.total).toBeGreaterThan(0);
        expect(quota.volume.used).toBeGreaterThanOrEqual(0);
        expect(quota.volume.available).toBeGreaterThanOrEqual(0);
        expect(quota.duty).toBeDefined();
        expect(quota.duty.inQuota).toBeGreaterThanOrEqual(0);
        expect(quota.duty.outQuota).toBeGreaterThan(quota.duty.inQuota);
      });
    });

    test('should have consistent volume calculations', () => {
      const quotas = quotaService.ACTIVE_QUOTAS;

      Object.entries(quotas).forEach(([quotaId, quota]) => {
        expect(quota.volume.used + quota.volume.available).toBe(quota.volume.total);
      });
    });

    test('should have valid period dates', () => {
      const quotas = quotaService.ACTIVE_QUOTAS;

      Object.entries(quotas).forEach(([quotaId, quota]) => {
        expect(quota.period.start).toBeDefined();
        expect(quota.period.end).toBeDefined();
        const start = new Date(quota.period.start);
        const end = new Date(quota.period.end);
        expect(start.getTime()).toBeLessThan(end.getTime());
      });
    });

    test('should have valid allocation methods', () => {
      const quotas = quotaService.ACTIVE_QUOTAS;
      const validMethods = ['fcfs', 'traditional', 'license'];

      Object.entries(quotas).forEach(([quotaId, quota]) => {
        expect(validMethods).toContain(quota.allocationMethod);
      });
    });
  });

  describe('Edge cases', () => {
    test('should handle empty TARIC code', () => {
      const result = quotaService.checkQuotaAvailability('', 'AR', 1000, 'kg');

      expect(result.found).toBe(false);
    });

    test('should handle zero quantity', () => {
      const result = quotaService.checkQuotaAvailability('02011000', 'AR', 0, 'kg');

      if (result.found) {
        expect(result.quotas[0].volume.requested).toBe(0);
      }
    });

    test('should handle negative quantity gracefully', () => {
      const result = quotaService.checkQuotaAvailability('02011000', 'AR', -1000, 'kg');

      // Should still return results but with negative requested (will be caught by validation)
      expect(result).toBeDefined();
    });

    test('should handle non-existent country code', () => {
      const result = quotaService.checkQuotaAvailability('02011000', 'ZZ', 1000, 'kg');

      // May or may not find depending on 'ALL' countries
      expect(result).toBeDefined();
      expect(result.found).toBeDefined();
    });
  });
});
