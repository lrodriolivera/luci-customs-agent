/**
 * Tests for Billing Service
 * Phase 6.3: Multi-Tenancy Support Tests
 */

// Mock logger
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const billingService = require('../../../src/services/tenant/billingService');

describe('Billing Service', () => {
  const testTenantId = 'billing-test-tenant-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constants', () => {
    test('should define BILLING_STATUS', () => {
      expect(billingService.BILLING_STATUS).toBeDefined();
      expect(billingService.BILLING_STATUS.ACTIVE).toBe('active');
      expect(billingService.BILLING_STATUS.CANCELLED).toBe('cancelled');
    });

    test('should define INVOICE_STATUS', () => {
      expect(billingService.INVOICE_STATUS).toBeDefined();
      expect(billingService.INVOICE_STATUS.PAID).toBe('paid');
      expect(billingService.INVOICE_STATUS.PENDING).toBe('pending');
    });

    test('should define PAYMENT_METHODS', () => {
      expect(billingService.PAYMENT_METHODS).toBeDefined();
      expect(billingService.PAYMENT_METHODS.CARD).toBe('card');
      expect(billingService.PAYMENT_METHODS.SEPA).toBe('sepa');
    });

    test('should define PLAN_PRICING', () => {
      expect(billingService.PLAN_PRICING).toBeDefined();
      expect(billingService.PLAN_PRICING.free).toBeDefined();
      expect(billingService.PLAN_PRICING.professional).toBeDefined();
    });
  });

  describe('createSubscription', () => {
    test('should create subscription for tenant', () => {
      const result = billingService.createSubscription(testTenantId, 'professional');

      expect(result.success).toBe(true);
      expect(result.subscription).toBeDefined();
      expect(result.subscription.plan).toBe('professional');
      expect(result.subscription.tenantId).toBe(testTenantId);
    });

    test('should create subscription with yearly billing', () => {
      const result = billingService.createSubscription('yearly-tenant', 'starter', 'yearly');

      expect(result.success).toBe(true);
      expect(result.subscription.billingCycle).toBe('yearly');
      expect(result.subscription.price).toBe(490); // Yearly price for starter
    });

    test('should set trial for paid plans', () => {
      const result = billingService.createSubscription('trial-tenant', 'professional');

      expect(result.subscription.status).toBe('trialing');
      expect(result.subscription.trialEndsAt).toBeDefined();
    });

    test('should return error for invalid plan', () => {
      const result = billingService.createSubscription('invalid-tenant', 'invalid_plan');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid plan');
    });
  });

  describe('getSubscription', () => {
    test('should get subscription', () => {
      billingService.createSubscription('get-sub-tenant', 'starter');

      const result = billingService.getSubscription('get-sub-tenant');

      expect(result.success).toBe(true);
      expect(result.subscription.plan).toBe('starter');
    });

    test('should return error for non-existent subscription', () => {
      const result = billingService.getSubscription('non-existent-tenant');

      expect(result.success).toBe(false);
    });
  });

  describe('updateSubscription', () => {
    test('should update subscription', () => {
      billingService.createSubscription('update-sub-tenant', 'starter');

      const result = billingService.updateSubscription('update-sub-tenant', {
        cancelAtPeriodEnd: true
      });

      expect(result.success).toBe(true);
      expect(result.subscription.cancelAtPeriodEnd).toBe(true);
    });
  });

  describe('changePlan', () => {
    test('should upgrade plan immediately', () => {
      billingService.createSubscription('upgrade-tenant', 'starter');

      const result = billingService.changePlan('upgrade-tenant', 'professional');

      expect(result.success).toBe(true);
      expect(result.subscription.plan).toBe('professional');
      expect(result.isUpgrade).toBe(true);
      expect(result.effectiveImmediately).toBe(true);
    });

    test('should schedule downgrade for period end', () => {
      billingService.createSubscription('downgrade-tenant', 'professional');

      const result = billingService.changePlan('downgrade-tenant', 'starter', false);

      expect(result.success).toBe(true);
      expect(result.isUpgrade).toBe(false);
      expect(result.subscription.scheduledPlanChange).toBeDefined();
    });
  });

  describe('cancelSubscription', () => {
    test('should cancel at period end', () => {
      billingService.createSubscription('cancel-tenant', 'professional');

      const result = billingService.cancelSubscription('cancel-tenant', false);

      expect(result.success).toBe(true);
      expect(result.subscription.cancelAtPeriodEnd).toBe(true);
    });

    test('should cancel immediately', () => {
      billingService.createSubscription('cancel-now-tenant', 'professional');

      const result = billingService.cancelSubscription('cancel-now-tenant', true);

      expect(result.success).toBe(true);
      expect(result.subscription.status).toBe('cancelled');
    });
  });

  describe('reactivateSubscription', () => {
    test('should reactivate subscription', () => {
      billingService.createSubscription('reactivate-tenant', 'professional');
      billingService.updateSubscription('reactivate-tenant', { cancelAtPeriodEnd: true });

      const result = billingService.reactivateSubscription('reactivate-tenant');

      expect(result.success).toBe(true);
      expect(result.subscription.cancelAtPeriodEnd).toBe(false);
    });
  });

  describe('createInvoice', () => {
    test('should create invoice', () => {
      const result = billingService.createInvoice('invoice-tenant', {
        type: 'subscription',
        description: 'Monthly subscription',
        amount: 149
      });

      expect(result.success).toBe(true);
      expect(result.invoice).toBeDefined();
      expect(result.invoice.total).toBeCloseTo(180.29, 2); // 149 * 1.21
    });

    test('should generate invoice number', () => {
      const result = billingService.createInvoice('number-tenant', {
        amount: 100
      });

      expect(result.invoice.number).toMatch(/^INV-\d{4}-\d{5}$/);
    });
  });

  describe('getInvoice', () => {
    test('should get invoice by ID', () => {
      const createResult = billingService.createInvoice('get-inv-tenant', {
        amount: 100
      });

      const result = billingService.getInvoice(createResult.invoice.id);

      expect(result.success).toBe(true);
      expect(result.invoice.id).toBe(createResult.invoice.id);
    });
  });

  describe('listInvoices', () => {
    test('should list invoices for tenant', () => {
      billingService.createInvoice('list-inv-tenant', { amount: 100 });
      billingService.createInvoice('list-inv-tenant', { amount: 200 });

      const result = billingService.listInvoices('list-inv-tenant');

      expect(result.success).toBe(true);
      expect(result.invoices.length).toBe(2);
    });

    test('should support pagination', () => {
      const result = billingService.listInvoices('list-inv-tenant', {
        page: 1,
        limit: 1
      });

      expect(result.pagination.limit).toBe(1);
    });
  });

  describe('updateInvoiceStatus', () => {
    test('should update invoice status', () => {
      const createResult = billingService.createInvoice('status-inv-tenant', {
        amount: 100
      });

      const result = billingService.updateInvoiceStatus(createResult.invoice.id, 'paid', {
        paymentMethod: 'card',
        paymentReference: 'PAY-123'
      });

      expect(result.success).toBe(true);
      expect(result.invoice.status).toBe('paid');
      expect(result.invoice.paidAt).toBeDefined();
    });
  });

  describe('recordPayment', () => {
    test('should record payment for invoice', () => {
      const createResult = billingService.createInvoice('payment-inv-tenant', {
        amount: 100
      });

      const result = billingService.recordPayment(createResult.invoice.id, {
        method: 'card',
        reference: 'PAY-456'
      });

      expect(result.success).toBe(true);
      expect(result.payment).toBeDefined();
    });

    test('should not pay already paid invoice', () => {
      const createResult = billingService.createInvoice('paid-inv-tenant', {
        amount: 100
      });
      billingService.updateInvoiceStatus(createResult.invoice.id, 'paid');

      const result = billingService.recordPayment(createResult.invoice.id, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('already paid');
    });
  });

  describe('addPaymentMethod', () => {
    test('should add card payment method', () => {
      const result = billingService.addPaymentMethod('pm-tenant', {
        type: 'card',
        last4: '4242',
        brand: 'visa',
        expiryMonth: 12,
        expiryYear: 2027
      });

      expect(result.success).toBe(true);
      expect(result.paymentMethod.type).toBe('card');
      expect(result.paymentMethod.isDefault).toBe(true);
    });

    test('should add SEPA payment method', () => {
      const result = billingService.addPaymentMethod('sepa-pm-tenant', {
        type: 'sepa',
        iban: 'ES9121000418450200051332',
        bankName: 'BBVA'
      });

      expect(result.success).toBe(true);
      expect(result.paymentMethod.type).toBe('sepa');
    });
  });

  describe('listPaymentMethods', () => {
    test('should list payment methods', () => {
      billingService.addPaymentMethod('list-pm-tenant', {
        type: 'card',
        last4: '1234'
      });

      const result = billingService.listPaymentMethods('list-pm-tenant');

      expect(result.success).toBe(true);
      expect(result.paymentMethods.length).toBeGreaterThan(0);
    });
  });

  describe('removePaymentMethod', () => {
    test('should remove payment method', () => {
      const addResult = billingService.addPaymentMethod('remove-pm-tenant', {
        type: 'card',
        last4: '9999'
      });

      const result = billingService.removePaymentMethod('remove-pm-tenant', addResult.paymentMethod.id);

      expect(result.success).toBe(true);
    });
  });

  describe('setDefaultPaymentMethod', () => {
    test('should set default payment method', () => {
      billingService.addPaymentMethod('default-pm-tenant', { type: 'card', last4: '1111' });
      const addResult = billingService.addPaymentMethod('default-pm-tenant', {
        type: 'card',
        last4: '2222'
      });

      const result = billingService.setDefaultPaymentMethod('default-pm-tenant', addResult.paymentMethod.id);

      expect(result.success).toBe(true);
      expect(result.paymentMethod.isDefault).toBe(true);
    });
  });

  describe('recordUsage', () => {
    test('should record usage', () => {
      const result = billingService.recordUsage('usage-tenant', 'declaration', 5);

      expect(result.success).toBe(true);
      expect(result.record.type).toBe('declaration');
      expect(result.record.quantity).toBe(5);
    });
  });

  describe('getUsageSummary', () => {
    test('should get usage summary', () => {
      billingService.recordUsage('summary-tenant', 'declaration', 10);
      billingService.recordUsage('summary-tenant', 'api_call', 100);

      const result = billingService.getUsageSummary('summary-tenant');

      expect(result.success).toBe(true);
      expect(result.summary.declarations).toBe(10);
      expect(result.summary.apiCalls).toBe(100);
    });
  });

  describe('calculateOverages', () => {
    test('should calculate overages', () => {
      billingService.recordUsage('overage-tenant', 'declaration', 150);

      const result = billingService.calculateOverages('overage-tenant', {
        maxDeclarationsPerMonth: 100
      });

      expect(result.success).toBe(true);
      expect(result.overages.length).toBeGreaterThan(0);
      expect(result.totalOverage).toBeGreaterThan(0);
    });

    test('should return no overages when within limits', () => {
      billingService.recordUsage('no-overage-tenant', 'declaration', 50);

      const result = billingService.calculateOverages('no-overage-tenant', {
        maxDeclarationsPerMonth: 100
      });

      expect(result.success).toBe(true);
      expect(result.overages.length).toBe(0);
    });
  });

  describe('generateBillingStatement', () => {
    test('should generate billing statement', () => {
      billingService.createSubscription('statement-tenant', 'professional');
      billingService.recordUsage('statement-tenant', 'declaration', 50);

      const result = billingService.generateBillingStatement('statement-tenant');

      expect(result.success).toBe(true);
      expect(result.statement).toBeDefined();
      expect(result.statement.subscription).toBeDefined();
      expect(result.statement.usage).toBeDefined();
    });
  });

  describe('getBillingOverview', () => {
    test('should get billing overview', () => {
      billingService.createSubscription('overview-tenant', 'starter');
      billingService.addPaymentMethod('overview-tenant', {
        type: 'card',
        last4: '4242'
      });

      const result = billingService.getBillingOverview('overview-tenant');

      expect(result.success).toBe(true);
      expect(result.overview.subscription).toBeDefined();
      expect(result.overview.defaultPaymentMethod).toBeDefined();
    });
  });

  describe('processRenewal', () => {
    test('should process subscription renewal', () => {
      billingService.createSubscription('renewal-tenant', 'professional');

      const result = billingService.processRenewal('renewal-tenant');

      expect(result.success).toBe(true);
      expect(result.action).toBe('renewed');
    });

    test('should cancel subscription at renewal if flagged', () => {
      billingService.createSubscription('cancel-renewal-tenant', 'professional');
      billingService.updateSubscription('cancel-renewal-tenant', { cancelAtPeriodEnd: true });

      const result = billingService.processRenewal('cancel-renewal-tenant');

      expect(result.success).toBe(true);
      expect(result.action).toBe('cancelled');
    });
  });

  describe('getPlanPricing', () => {
    test('should return plan pricing', () => {
      const result = billingService.getPlanPricing();

      expect(result.success).toBe(true);
      expect(result.plans).toBeDefined();
      expect(result.usagePricing).toBeDefined();
      expect(result.currency).toBe('EUR');
    });
  });
});
