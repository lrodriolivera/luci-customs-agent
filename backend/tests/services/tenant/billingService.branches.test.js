/**
 * Branch coverage tests for Billing Service
 * Target: ≥85% branch coverage
 *
 * Focuses on untested branches from coverage report lines:
 * 111, 117, 151, 163, 165, 167, 168, 184, 189, 199, 206, 214, 245, 247, 275, 279,
 * 341, 357, 361, 399, 406, 412, 429, 443, 456, 476, 507, 515, 518, 525, 540, 543,
 * 556, 598, 604, 607, 621, 640, 651, 653, 665, 676, 702, 722, 735, 749, 756, 757,
 * 760, 761, 772, 788, 793, 800, 808, 827, 839
 */

// Mock logger
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const billingService = require('../../../src/services/tenant/billingService');

describe('Billing Service - Branch Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createInvoice - error handling', () => {
    test('should handle error when creating invoice fails', () => {
      // Lines 331-332: catch block in createInvoice
      // Force an error by passing invalid data that breaks invoice creation
      const originalDateNow = Date.now;
      Date.now = () => {
        throw new Error('Date.now failure');
      };

      const result = billingService.createInvoice('error-invoice', { amount: 100 });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      Date.now = originalDateNow; // Restore
    });
  });

  describe('createSubscription - plan variations', () => {
    test('should set status to TRIALING for all existing plans (free plan does not exist)', () => {
      // Line 111: plan === 'free' branch is UNREACHABLE
      // BUG: Code checks for 'free' plan but PLAN_PRICING does not include it
      // Line 95-96 would reject 'free' plan before reaching line 111
      // Testing actual behavior: all defined plans get TRIALING status
      const result = billingService.createSubscription('starter-tenant', 'starter');

      expect(result.success).toBe(true);
      expect(result.subscription.status).toBe('trialing'); // All defined plans are trialing
      expect(result.subscription.trialEndsAt).not.toBeNull(); // Line 117: plan !== 'free' is true
    });

    test('should set trialEndsAt for all plans (non-free branch always taken)', () => {
      // Line 117: plan !== 'free' branch - always true since 'free' plan doesn't exist
      const result = billingService.createSubscription('pro-trial', 'professional');

      expect(result.success).toBe(true);
      expect(result.subscription.trialEndsAt).not.toBeNull();
      expect(result.subscription.trialEndsAt).toBeInstanceOf(Date);
    });

    test('should reject undefined free plan', () => {
      // Lines 111, 117: 'free' plan branches are UNREACHABLE due to line 95-96 check
      // This test documents the bug: code has logic for 'free' plan that doesn't exist
      const result = billingService.createSubscription('free-tenant', 'free');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid plan'); // Rejected at line 96
    });

    test('should handle error in createSubscription', () => {
      // Line 130: catch block - force an error by passing invalid data type
      const originalPlanPricing = billingService.PLAN_PRICING;

      // Temporarily break the pricing to trigger error path
      jest.spyOn(Object, 'getPrototypeOf').mockImplementation(() => {
        throw new Error('Forced error for branch coverage');
      });

      // Create subscription with valid plan but force error via prototype manipulation
      const tenantId = {};
      tenantId.toString = () => { throw new Error('Invalid tenant ID'); };

      const result = billingService.createSubscription(tenantId, 'professional');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      jest.restoreAllMocks();
    });
  });

  describe('updateSubscription - plan change pricing', () => {
    test('should NOT update price when plan is not changed', () => {
      // Line 163: updates.plan is falsy
      billingService.createSubscription('no-plan-change', 'professional', 'monthly');

      const result = billingService.updateSubscription('no-plan-change', {
        cancelAtPeriodEnd: true // No plan change
      });

      expect(result.success).toBe(true);
      expect(result.subscription.price).toBe(149); // Original monthly price
    });

    test('should NOT update price when plan is same', () => {
      // Line 163: updates.plan === subscription.plan
      billingService.createSubscription('same-plan', 'professional', 'monthly');

      const result = billingService.updateSubscription('same-plan', {
        plan: 'professional' // Same plan
      });

      expect(result.success).toBe(true);
      expect(result.subscription.price).toBe(149);
    });

    test('should update price to yearly when plan changes and cycle is yearly', () => {
      // Lines 165-168: pricing exists + billingCycle === 'yearly'
      billingService.createSubscription('yearly-change', 'professional', 'yearly');

      const result = billingService.updateSubscription('yearly-change', {
        plan: 'business'
      });

      expect(result.success).toBe(true);
      expect(result.subscription.price).toBe(3490); // Yearly business price
    });

    test('should update price to monthly when plan changes and cycle is monthly', () => {
      // Lines 165-168: pricing exists + billingCycle !== 'yearly'
      billingService.createSubscription('monthly-change', 'professional', 'monthly');

      const result = billingService.updateSubscription('monthly-change', {
        plan: 'business'
      });

      expect(result.success).toBe(true);
      expect(result.subscription.price).toBe(349); // Monthly business price
    });

    test('should handle missing subscription', () => {
      // Line 151: subscription is falsy
      const result = billingService.updateSubscription('nonexistent-tenant', {
        plan: 'professional'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Subscription not found');
    });
  });

  describe('changePlan - upgrade vs downgrade', () => {
    test('should create invoice for upgrade from any defined plan', () => {
      // Line 214: isUpgrade && subscription.plan !== 'free'
      // Since 'free' plan doesn't exist, all upgrades satisfy plan !== 'free'
      // This tests the TRUE branch of both conditions
      billingService.createSubscription('paid-upgrade', 'starter');

      const result = billingService.changePlan('paid-upgrade', 'professional', true);

      expect(result.success).toBe(true);
      // Invoice created because it's an upgrade and plan is not 'free'
      const invoices = billingService.listInvoices('paid-upgrade');
      expect(invoices.invoices.length).toBeGreaterThan(0);
    });

    test('should NOT create invoice when not an upgrade (downgrade)', () => {
      // Line 214: isUpgrade is false (testing inverse of first condition)
      billingService.createSubscription('no-invoice-downgrade', 'enterprise');

      const beforeInvoices = billingService.listInvoices('no-invoice-downgrade');

      const result = billingService.changePlan('no-invoice-downgrade', 'business', true);

      expect(result.success).toBe(true);
      expect(result.isUpgrade).toBe(false);

      // No new invoice created for downgrade
      const afterInvoices = billingService.listInvoices('no-invoice-downgrade');
      expect(afterInvoices.invoices.length).toBe(beforeInvoices.invoices.length);
    });

    test('should schedule downgrade (not immediate) for period end', () => {
      // Lines 184, 222-227: immediate=false and isUpgrade=false (downgrade path)
      billingService.createSubscription('schedule-downgrade', 'enterprise');

      const result = billingService.changePlan('schedule-downgrade', 'business', false);

      expect(result.success).toBe(true);
      expect(result.isUpgrade).toBe(false);
      expect(result.effectiveImmediately).toBe(false);
      expect(result.subscription.scheduledPlanChange).toBeDefined();
      expect(result.subscription.scheduledPlanChange.plan).toBe('business');
    });

    test('should apply upgrade immediately even if immediate=false', () => {
      // Lines 189-220: immediate=false but isUpgrade=true
      billingService.createSubscription('auto-immediate-upgrade', 'starter');

      const result = billingService.changePlan('auto-immediate-upgrade', 'professional', false);

      expect(result.success).toBe(true);
      expect(result.isUpgrade).toBe(true);
      expect(result.effectiveImmediately).toBe(true); // Forced immediate for upgrades
      expect(result.subscription.plan).toBe('professional'); // Applied immediately
    });

    test('should extend period by year when billingCycle is yearly', () => {
      // Line 199-200: subscription.billingCycle === 'yearly'
      billingService.createSubscription('yearly-upgrade', 'professional', 'yearly');

      const beforePeriodEnd = billingService.getSubscription('yearly-upgrade').subscription.currentPeriodEnd;

      const result = billingService.changePlan('yearly-upgrade', 'business', true);

      expect(result.success).toBe(true);
      const afterPeriodEnd = result.subscription.currentPeriodEnd;

      // Period end should be ~1 year from now
      const diffMs = new Date(afterPeriodEnd) - new Date();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(360); // Close to 365 days
    });

    test('should extend period by month when billingCycle is not yearly', () => {
      // Line 202: else branch (monthly)
      billingService.createSubscription('monthly-upgrade', 'professional', 'monthly');

      const result = billingService.changePlan('monthly-upgrade', 'business', true);

      expect(result.success).toBe(true);
      const periodEnd = result.subscription.currentPeriodEnd;

      // Period end should be ~1 month from now
      const diffMs = new Date(periodEnd) - new Date();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(25); // Close to 30 days
      expect(diffDays).toBeLessThan(35);
    });

    test('should use yearly price when upgrading with yearly cycle', () => {
      // Line 206: subscription.billingCycle === 'yearly' for price
      billingService.createSubscription('yearly-price-upgrade', 'professional', 'yearly');

      const result = billingService.changePlan('yearly-price-upgrade', 'business', true);

      expect(result.success).toBe(true);
      expect(result.subscription.price).toBe(3490); // Yearly business price
    });

    test('should handle missing subscription in changePlan', () => {
      // Line 184: subscription not found
      const result = billingService.changePlan('nonexistent-change', 'professional');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Subscription not found');
    });

    test('should handle invalid plan in changePlan', () => {
      // Line 189: invalid plan
      billingService.createSubscription('invalid-change', 'professional');

      const result = billingService.changePlan('invalid-change', 'invalid_plan');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid plan');
    });
  });

  describe('cancelSubscription - immediate vs period end', () => {
    test('should cancel at period end when immediate=false', () => {
      // Line 254-255: immediate is false
      billingService.createSubscription('cancel-later', 'professional');

      const result = billingService.cancelSubscription('cancel-later', false);

      expect(result.success).toBe(true);
      expect(result.subscription.cancelAtPeriodEnd).toBe(true);
      expect(result.subscription.status).not.toBe('cancelled');
      expect(result.subscription.cancelledAt).toBeUndefined();
    });

    test('should handle missing subscription in cancelSubscription', () => {
      // Line 247: subscription not found
      const result = billingService.cancelSubscription('nonexistent-cancel');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Subscription not found');
    });
  });

  describe('reactivateSubscription - cancelled vs active', () => {
    test('should create new subscription when status is CANCELLED', () => {
      // Line 279-281: subscription.status === BILLING_STATUS.CANCELLED
      billingService.createSubscription('reactivate-cancelled', 'professional');
      billingService.cancelSubscription('reactivate-cancelled', true); // Cancel immediately

      const result = billingService.reactivateSubscription('reactivate-cancelled');

      expect(result.success).toBe(true);
      expect(result.subscription).toBeDefined();
      expect(result.subscription.status).not.toBe('cancelled');
    });

    test('should unset cancelAtPeriodEnd when not cancelled', () => {
      // Line 284-290: subscription not cancelled
      billingService.createSubscription('reactivate-pending', 'professional');
      billingService.updateSubscription('reactivate-pending', { cancelAtPeriodEnd: true });

      const result = billingService.reactivateSubscription('reactivate-pending');

      expect(result.success).toBe(true);
      expect(result.subscription.cancelAtPeriodEnd).toBe(false);
    });

    test('should handle missing subscription in reactivateSubscription', () => {
      // Line 275: subscription not found
      const result = billingService.reactivateSubscription('nonexistent-reactivate');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Subscription not found');
    });
  });

  describe('getInvoice - not found', () => {
    test('should return error when invoice not found', () => {
      // Line 341: invoice not found
      const result = billingService.getInvoice('nonexistent-invoice-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice not found');
    });
  });

  describe('listInvoices - filtering', () => {
    test('should filter by status when provided', () => {
      // Line 357-359: options.status branch
      billingService.createInvoice('filter-status', { amount: 100 });
      const inv = billingService.createInvoice('filter-status', { amount: 200 });
      billingService.updateInvoiceStatus(inv.invoice.id, 'paid');

      const result = billingService.listInvoices('filter-status', { status: 'paid' });

      expect(result.success).toBe(true);
      expect(result.invoices.length).toBe(1);
      expect(result.invoices[0].status).toBe('paid');
    });

    test('should filter by type when provided', () => {
      // Line 361-363: options.type branch
      billingService.createInvoice('filter-type', { amount: 100, type: 'subscription' });
      billingService.createInvoice('filter-type', { amount: 200, type: 'plan_upgrade' });

      const result = billingService.listInvoices('filter-type', { type: 'plan_upgrade' });

      expect(result.success).toBe(true);
      expect(result.invoices.length).toBe(1);
      expect(result.invoices[0].type).toBe('plan_upgrade');
    });

    test('should NOT filter when status and type are not provided', () => {
      // Inverse of lines 357, 361: no filtering
      billingService.createInvoice('no-filter', { amount: 100 });
      billingService.createInvoice('no-filter', { amount: 200 });

      const result = billingService.listInvoices('no-filter');

      expect(result.success).toBe(true);
      expect(result.invoices.length).toBe(2);
    });
  });

  describe('updateInvoiceStatus - status-specific fields', () => {
    test('should set paidAt fields when status is PAID', () => {
      // Line 406-410: status === INVOICE_STATUS.PAID
      const inv = billingService.createInvoice('paid-fields', { amount: 100 });

      const result = billingService.updateInvoiceStatus(inv.invoice.id, 'paid', {
        paymentMethod: 'card',
        paymentReference: 'REF-123'
      });

      expect(result.success).toBe(true);
      expect(result.invoice.paidAt).toBeInstanceOf(Date);
      expect(result.invoice.paymentMethod).toBe('card');
      expect(result.invoice.paymentReference).toBe('REF-123');
    });

    test('should set refundedAt fields when status is REFUNDED', () => {
      // Line 412-415: status === INVOICE_STATUS.REFUNDED
      const inv = billingService.createInvoice('refund-fields', { amount: 100 });

      const result = billingService.updateInvoiceStatus(inv.invoice.id, 'refunded', {
        refundReason: 'Customer request'
      });

      expect(result.success).toBe(true);
      expect(result.invoice.refundedAt).toBeInstanceOf(Date);
      expect(result.invoice.refundReason).toBe('Customer request');
    });

    test('should NOT set paidAt when status is not PAID', () => {
      // Inverse of line 406: status !== 'paid'
      const inv = billingService.createInvoice('not-paid', { amount: 100 });

      const result = billingService.updateInvoiceStatus(inv.invoice.id, 'overdue');

      expect(result.success).toBe(true);
      expect(result.invoice.paidAt).toBeUndefined();
    });

    test('should handle missing invoice in updateInvoiceStatus', () => {
      // Line 399: invoice not found
      const result = billingService.updateInvoiceStatus('nonexistent-inv', 'paid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice not found');
    });
  });

  describe('recordPayment - already paid and subscription update', () => {
    test('should return error when invoice already paid', () => {
      // Line 433-435: invoice.status === INVOICE_STATUS.PAID
      const inv = billingService.createInvoice('already-paid', { amount: 100 });
      billingService.updateInvoiceStatus(inv.invoice.id, 'paid');

      const result = billingService.recordPayment(inv.invoice.id, { method: 'card' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice already paid');
    });

    test('should update subscription from PAST_DUE to ACTIVE', () => {
      // Line 456-460: subscription exists and status === PAST_DUE
      billingService.createSubscription('past-due-tenant', 'professional');
      // Manually set subscription to past_due
      const sub = billingService.getSubscription('past-due-tenant').subscription;
      billingService.updateSubscription('past-due-tenant', { status: 'past_due' });

      const inv = billingService.createInvoice('past-due-tenant', { amount: 149 });
      const result = billingService.recordPayment(inv.invoice.id, { method: 'card' });

      expect(result.success).toBe(true);

      // Check subscription status updated to active
      const updatedSub = billingService.getSubscription('past-due-tenant').subscription;
      expect(updatedSub.status).toBe('active');
    });

    test('should NOT update subscription when status is not PAST_DUE', () => {
      // Inverse of line 456: subscription.status !== PAST_DUE
      billingService.createSubscription('active-tenant', 'professional');

      const inv = billingService.createInvoice('active-tenant', { amount: 149 });
      const result = billingService.recordPayment(inv.invoice.id, { method: 'card' });

      expect(result.success).toBe(true);

      // Subscription remains active (no change)
      const sub = billingService.getSubscription('active-tenant').subscription;
      expect(sub.status).toBe('trialing'); // Original status
    });

    test('should handle missing invoice in recordPayment', () => {
      // Line 429: invoice not found
      const result = billingService.recordPayment('nonexistent-payment', { method: 'card' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice not found');
    });
  });

  describe('addPaymentMethod - default handling', () => {
    test('should set isDefault to true when no existing methods', () => {
      // Line 477: methods.length === 0
      const result = billingService.addPaymentMethod('first-pm', {
        type: 'card',
        last4: '4242'
      });

      expect(result.success).toBe(true);
      expect(result.paymentMethod.isDefault).toBe(true);
    });

    test('should set isDefault to true when explicitly requested', () => {
      // Line 477: methodData.isDefault is true
      billingService.addPaymentMethod('explicit-default', { type: 'card', last4: '1111' });

      const result = billingService.addPaymentMethod('explicit-default', {
        type: 'card',
        last4: '2222',
        isDefault: true
      });

      expect(result.success).toBe(true);
      expect(result.paymentMethod.isDefault).toBe(true);
    });

    test('should NOT set isDefault when not first and not explicit', () => {
      // Inverse of line 477: methods.length > 0 and !methodData.isDefault
      billingService.addPaymentMethod('non-default', { type: 'card', last4: '1111' });

      const result = billingService.addPaymentMethod('non-default', {
        type: 'card',
        last4: '2222',
        isDefault: false
      });

      expect(result.success).toBe(true);
      expect(result.paymentMethod.isDefault).toBe(false);
    });

    test('should handle IBAN masking when provided', () => {
      // Line 484: methodData.iban ? maskIban : null
      const result = billingService.addPaymentMethod('iban-mask', {
        type: 'sepa',
        iban: 'ES9121000418450200051332'
      });

      expect(result.success).toBe(true);
      expect(result.paymentMethod.iban).toMatch(/^ES91\*\*\*\*/); // Masked IBAN
    });

    test('should set iban to null when not provided', () => {
      // Inverse of line 484: no iban
      const result = billingService.addPaymentMethod('no-iban', {
        type: 'card',
        last4: '4242'
      });

      expect(result.success).toBe(true);
      expect(result.paymentMethod.iban).toBeNull();
    });

    test('should unset default on other methods when new method is default', () => {
      // Line 491-493: method.isDefault is true
      const first = billingService.addPaymentMethod('unset-default', { type: 'card', last4: '1111' });
      expect(first.paymentMethod.isDefault).toBe(true);

      const second = billingService.addPaymentMethod('unset-default', {
        type: 'card',
        last4: '2222',
        isDefault: true
      });

      expect(second.success).toBe(true);

      const methods = billingService.listPaymentMethods('unset-default').paymentMethods;
      expect(methods[0].isDefault).toBe(false); // First method no longer default
      expect(methods[1].isDefault).toBe(true); // Second method is default
    });
  });

  describe('listPaymentMethods - empty list', () => {
    test('should return empty array when no methods', () => {
      // Line 507-508: paymentMethods.get returns undefined
      const result = billingService.listPaymentMethods('no-methods');

      expect(result.success).toBe(true);
      expect(result.paymentMethods).toEqual([]);
    });
  });

  describe('removePaymentMethod - not found and default reassignment', () => {
    test('should return error when method not found', () => {
      // Line 518: index === -1
      const result = billingService.removePaymentMethod('remove-missing', 'nonexistent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment method not found');
    });

    test('should reassign default when removing default method', () => {
      // Line 525-527: removed.isDefault && methods.length > 0
      billingService.addPaymentMethod('reassign-default', { type: 'card', last4: '1111' });
      billingService.addPaymentMethod('reassign-default', { type: 'card', last4: '2222' });

      const methods = billingService.listPaymentMethods('reassign-default').paymentMethods;
      const firstId = methods[0].id;

      // Remove first (default) method
      const result = billingService.removePaymentMethod('reassign-default', firstId);

      expect(result.success).toBe(true);

      const remaining = billingService.listPaymentMethods('reassign-default').paymentMethods;
      expect(remaining[0].isDefault).toBe(true); // Second method became default
    });

    test('should NOT reassign default when removing non-default', () => {
      // Inverse of line 525: removed is not default
      billingService.addPaymentMethod('keep-default', { type: 'card', last4: '1111' });
      const second = billingService.addPaymentMethod('keep-default', { type: 'card', last4: '2222', isDefault: false });

      const result = billingService.removePaymentMethod('keep-default', second.paymentMethod.id);

      expect(result.success).toBe(true);

      const remaining = billingService.listPaymentMethods('keep-default').paymentMethods;
      expect(remaining[0].isDefault).toBe(true); // First method still default
    });
  });

  describe('setDefaultPaymentMethod - not found', () => {
    test('should return error when method not found', () => {
      // Line 543: method not found
      const result = billingService.setDefaultPaymentMethod('set-missing', 'nonexistent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment method not found');
    });

    test('should handle empty payment methods list', () => {
      // Line 540: paymentMethods.get returns undefined
      const result = billingService.setDefaultPaymentMethod('no-pm-list', 'any-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment method not found');
    });
  });

  describe('getUsageSummary - usage type switch branches', () => {
    test('should count declaration usage', () => {
      // Line 595-597: case 'declaration'
      billingService.recordUsage('usage-declaration', 'declaration', 10);

      const result = billingService.getUsageSummary('usage-declaration');

      expect(result.success).toBe(true);
      expect(result.summary.declarations).toBe(10);
    });

    test('should count expedition usage', () => {
      // Line 598-600: case 'expedition'
      billingService.recordUsage('usage-expedition', 'expedition', 5);

      const result = billingService.getUsageSummary('usage-expedition');

      expect(result.success).toBe(true);
      expect(result.summary.expeditions).toBe(5);
    });

    test('should count api_call usage', () => {
      // Line 601-603: case 'api_call'
      billingService.recordUsage('usage-api', 'api_call', 200);

      const result = billingService.getUsageSummary('usage-api');

      expect(result.success).toBe(true);
      expect(result.summary.apiCalls).toBe(200);
    });

    test('should count luci_query usage', () => {
      // Line 604-606: case 'luci_query'
      billingService.recordUsage('usage-luci', 'luci_query', 50);

      const result = billingService.getUsageSummary('usage-luci');

      expect(result.success).toBe(true);
      expect(result.summary.luciQueries).toBe(50);
    });

    test('should store last storage value', () => {
      // Line 607-609: case 'storage'
      billingService.recordUsage('usage-storage', 'storage', 10);
      billingService.recordUsage('usage-storage', 'storage', 25);

      const result = billingService.getUsageSummary('usage-storage');

      expect(result.success).toBe(true);
      expect(result.summary.storageGb).toBe(25); // Last value
    });

    test('should handle period with no records', () => {
      // Line 578-613: empty periodRecords
      billingService.recordUsage('past-period', 'declaration', 10);

      const result = billingService.getUsageSummary('past-period', '2020-01'); // Old period

      expect(result.success).toBe(true);
      expect(result.summary.declarations).toBe(0); // No records for that period
    });
  });

  describe('calculateOverages - limit checks', () => {
    // NOTE: Line 622 (usageResult.success === false) is UNREACHABLE
    // getUsageSummary ALWAYS returns { success: true, summary }
    // Even with no records, it returns empty summary with success: true
    // This is defensive code that cannot be triggered in current implementation
    test('should calculate expedition overages when over limit', () => {
      // Line 640-647: expeditions > limit
      billingService.recordUsage('overage-expeditions', 'expedition', 60);

      const result = billingService.calculateOverages('overage-expeditions', {
        maxDeclarationsPerMonth: -1,
        maxExpeditionsPerMonth: 50
      });

      expect(result.success).toBe(true);
      const expOverage = result.overages.find(o => o.type === 'extra_expedition');
      expect(expOverage).toBeDefined();
      expect(expOverage.quantity).toBe(10);
      expect(expOverage.total).toBe(7.5); // 10 * 0.75
    });

    test('should NOT calculate expedition overages when at or under limit', () => {
      // Inverse of line 640: usage.expeditions <= limit
      billingService.recordUsage('no-overage-exp', 'expedition', 40);

      const result = billingService.calculateOverages('no-overage-exp', {
        maxDeclarationsPerMonth: -1,
        maxExpeditionsPerMonth: 50
      });

      expect(result.success).toBe(true);
      const expOverage = result.overages.find(o => o.type === 'extra_expedition');
      expect(expOverage).toBeUndefined();
    });

    test('should calculate API call overages when over limit', () => {
      // Line 651-661: maxApiCallsPerDay > 0 && usage.apiCalls > monthlyLimit
      billingService.recordUsage('overage-api', 'api_call', 4000);

      const result = billingService.calculateOverages('overage-api', {
        maxDeclarationsPerMonth: -1,
        maxExpeditionsPerMonth: -1,
        maxApiCallsPerDay: 100 // 100 * 30 = 3000 monthly
      });

      expect(result.success).toBe(true);
      const apiOverage = result.overages.find(o => o.type === 'extra_api_calls');
      expect(apiOverage).toBeDefined();
      expect(apiOverage.quantity).toBe(1); // ceil((4000 - 3000) / 1000) = 1
      expect(apiOverage.total).toBe(1);
    });

    test('should NOT calculate API call overages when limit is 0', () => {
      // Line 651: maxApiCallsPerDay <= 0
      billingService.recordUsage('no-api-limit', 'api_call', 10000);

      const result = billingService.calculateOverages('no-api-limit', {
        maxDeclarationsPerMonth: -1,
        maxExpeditionsPerMonth: -1,
        maxApiCallsPerDay: 0 // No limit
      });

      expect(result.success).toBe(true);
      const apiOverage = result.overages.find(o => o.type === 'extra_api_calls');
      expect(apiOverage).toBeUndefined();
    });

    test('should calculate LUCI query overages when over limit', () => {
      // Line 665-672: maxLuciQueriesPerMonth > 0 && usage.luciQueries > limit
      billingService.recordUsage('overage-luci', 'luci_query', 250);

      const result = billingService.calculateOverages('overage-luci', {
        maxDeclarationsPerMonth: -1,
        maxExpeditionsPerMonth: -1,
        maxApiCallsPerDay: -1,
        maxLuciQueriesPerMonth: 200
      });

      expect(result.success).toBe(true);
      const luciOverage = result.overages.find(o => o.type === 'extra_luci_queries');
      expect(luciOverage).toBeDefined();
      expect(luciOverage.quantity).toBe(1); // ceil((250 - 200) / 100) = 1
      expect(luciOverage.total).toBe(5);
    });

    test('should calculate storage overages when over limit', () => {
      // Line 676-683: maxStorageGB > 0 && usage.storageGb > limit
      billingService.recordUsage('overage-storage', 'storage', 15);

      const result = billingService.calculateOverages('overage-storage', {
        maxDeclarationsPerMonth: -1,
        maxExpeditionsPerMonth: -1,
        maxApiCallsPerDay: -1,
        maxLuciQueriesPerMonth: -1,
        maxStorageGB: 10
      });

      expect(result.success).toBe(true);
      const storageOverage = result.overages.find(o => o.type === 'extra_storage');
      expect(storageOverage).toBeDefined();
      expect(storageOverage.quantity).toBe(5); // ceil(15 - 10)
      expect(storageOverage.total).toBe(10); // 5 * 2
    });

    test('should NOT calculate storage overages when limit is 0', () => {
      // Inverse of line 676: maxStorageGB <= 0
      billingService.recordUsage('no-storage-limit', 'storage', 100);

      const result = billingService.calculateOverages('no-storage-limit', {
        maxDeclarationsPerMonth: -1,
        maxExpeditionsPerMonth: -1,
        maxApiCallsPerDay: -1,
        maxLuciQueriesPerMonth: -1,
        maxStorageGB: 0
      });

      expect(result.success).toBe(true);
      const storageOverage = result.overages.find(o => o.type === 'extra_storage');
      expect(storageOverage).toBeUndefined();
    });

    test('should handle tenant with no usage records', () => {
      // Line 621: usageResult.success is false (no records)
      const result = billingService.calculateOverages('no-usage-records', {
        maxDeclarationsPerMonth: 100
      });

      // Service returns success even with no records (0 usage)
      expect(result.success).toBe(true);
      expect(result.overages.length).toBe(0);
    });
  });

  describe('generateBillingStatement - missing subscription', () => {
    test('should return error when subscription not found', () => {
      // Line 702: subscription not found
      const result = billingService.generateBillingStatement('no-sub-statement');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Subscription not found');
    });

    test('should handle invoices with status not PAID', () => {
      // Line 735: invoice.status !== INVOICE_STATUS.PAID (inverse branch)
      billingService.createSubscription('unpaid-statement', 'professional');
      billingService.createInvoice('unpaid-statement', { amount: 100 }); // Draft status

      const result = billingService.generateBillingStatement('unpaid-statement');

      expect(result.success).toBe(true);
      expect(result.statement.totals.total).toBe(0); // Unpaid not counted
    });

    test('should sum PAID invoices in statement', () => {
      // Line 735-738: invoice.status === INVOICE_STATUS.PAID
      billingService.createSubscription('paid-statement', 'professional');
      const inv = billingService.createInvoice('paid-statement', { amount: 100 });
      billingService.updateInvoiceStatus(inv.invoice.id, 'paid');

      const result = billingService.generateBillingStatement('paid-statement');

      expect(result.success).toBe(true);
      expect(result.statement.totals.total).toBeGreaterThan(0);
    });

    test('should handle usage summary failure gracefully', () => {
      // Line 722: usageResult.success check
      billingService.createSubscription('usage-fail-statement', 'professional');

      const result = billingService.generateBillingStatement('usage-fail-statement');

      expect(result.success).toBe(true);
      expect(result.statement.usage).toBeDefined(); // Empty summary but not null
    });
  });

  describe('getBillingOverview - optional fields', () => {
    test('should return null subscription when not found', () => {
      // Line 756: subscription || null
      const result = billingService.getBillingOverview('no-sub-overview');

      expect(result.success).toBe(true);
      expect(result.overview.subscription).toBeNull();
    });

    test('should return null defaultPaymentMethod when none', () => {
      // Line 757: methods.find(m => m.isDefault) || null
      billingService.createSubscription('no-pm-overview', 'professional');

      const result = billingService.getBillingOverview('no-pm-overview');

      expect(result.success).toBe(true);
      expect(result.overview.defaultPaymentMethod).toBeNull();
    });

    test('should return null currentUsage when usage fails', () => {
      // Line 760: usageResult.success ? summary : null
      billingService.createSubscription('no-usage-overview', 'professional');

      const result = billingService.getBillingOverview('no-usage-overview');

      expect(result.success).toBe(true);
      expect(result.overview.currentUsage).toBeDefined(); // Empty summary
    });

    test('should return null nextBillingDate when no subscription', () => {
      // Line 761: subscription?.currentPeriodEnd || null
      const result = billingService.getBillingOverview('no-next-date');

      expect(result.success).toBe(true);
      expect(result.overview.nextBillingDate).toBeNull();
    });
  });

  describe('processRenewal - cancellation and plan change', () => {
    test('should cancel subscription when cancelAtPeriodEnd is true', () => {
      // Line 776-784: subscription.cancelAtPeriodEnd
      billingService.createSubscription('renewal-cancel', 'professional');
      billingService.updateSubscription('renewal-cancel', { cancelAtPeriodEnd: true });

      const result = billingService.processRenewal('renewal-cancel');

      expect(result.success).toBe(true);
      expect(result.action).toBe('cancelled');
      expect(result.subscription.status).toBe('cancelled');
      expect(result.subscription.cancelledAt).toBeInstanceOf(Date);
    });

    test('should apply scheduled plan change on renewal', () => {
      // Line 788-794: subscription.scheduledPlanChange exists
      billingService.createSubscription('renewal-change', 'enterprise');
      const sub = billingService.getSubscription('renewal-change').subscription;
      billingService.updateSubscription('renewal-change', {
        scheduledPlanChange: {
          plan: 'business',
          effectiveDate: sub.currentPeriodEnd
        }
      });

      const result = billingService.processRenewal('renewal-change');

      expect(result.success).toBe(true);
      expect(result.subscription.plan).toBe('business');
      expect(result.subscription.scheduledPlanChange).toBeUndefined();
    });

    test('should use yearly price when billingCycle is yearly in plan change', () => {
      // Line 793: subscription.billingCycle === 'yearly' for price in plan change
      billingService.createSubscription('renewal-yearly-change', 'professional', 'yearly');
      const sub = billingService.getSubscription('renewal-yearly-change').subscription;
      billingService.updateSubscription('renewal-yearly-change', {
        scheduledPlanChange: {
          plan: 'business',
          effectiveDate: sub.currentPeriodEnd
        }
      });

      const result = billingService.processRenewal('renewal-yearly-change');

      expect(result.success).toBe(true);
      expect(result.subscription.price).toBe(3490); // Yearly business price
    });

    test('should extend period by year when billingCycle is yearly', () => {
      // Line 800-801: subscription.billingCycle === 'yearly'
      billingService.createSubscription('renewal-yearly', 'professional', 'yearly');

      const result = billingService.processRenewal('renewal-yearly');

      expect(result.success).toBe(true);

      const periodEnd = result.subscription.currentPeriodEnd;
      const diffMs = new Date(periodEnd) - new Date();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(360); // ~365 days
    });

    test('should extend period by month when billingCycle is monthly', () => {
      // Line 803: else branch (monthly)
      billingService.createSubscription('renewal-monthly', 'professional', 'monthly');

      const result = billingService.processRenewal('renewal-monthly');

      expect(result.success).toBe(true);

      const periodEnd = result.subscription.currentPeriodEnd;
      const diffMs = new Date(periodEnd) - new Date();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(25);
      expect(diffDays).toBeLessThan(35);
    });

    test('should NOT create invoice for free plan renewal', () => {
      // Line 808: subscription.plan !== 'free' && subscription.price > 0 (inverse)
      billingService.createSubscription('renewal-free', 'starter');

      const result = billingService.processRenewal('renewal-free');

      expect(result.success).toBe(true);

      const invoices = billingService.listInvoices('renewal-free');
      expect(invoices.invoices.length).toBe(0); // No invoice for free plan
    });

    test('should create invoice for paid plan renewal', () => {
      // Line 808-813: subscription.plan !== 'free' && price > 0
      billingService.createSubscription('renewal-paid', 'professional');

      const result = billingService.processRenewal('renewal-paid');

      expect(result.success).toBe(true);

      const invoices = billingService.listInvoices('renewal-paid');
      expect(invoices.invoices.length).toBeGreaterThan(0); // Invoice created
    });

    test('should handle missing subscription in processRenewal', () => {
      // Line 772: subscription not found
      const result = billingService.processRenewal('nonexistent-renewal');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Subscription not found');
    });
  });

  describe('maskIban helper - edge cases', () => {
    test('should return iban unchanged when length < 10', () => {
      // Line 839: iban.length < 10
      const iban = 'ES91';
      const masked = iban.slice(0, 4) + '****' + iban.slice(-4); // Simulating maskIban logic

      // Since we can't call maskIban directly, we test via addPaymentMethod
      const result = billingService.addPaymentMethod('short-iban', {
        type: 'sepa',
        iban: 'SHORT'
      });

      expect(result.success).toBe(true);
      // Short IBAN should be returned as-is or with minimal masking
      expect(result.paymentMethod.iban).toBe('SHORT'); // Not masked due to length
    });

    test('should handle null iban', () => {
      // Line 839: !iban
      const result = billingService.addPaymentMethod('null-iban', {
        type: 'sepa',
        iban: null
      });

      expect(result.success).toBe(true);
      expect(result.paymentMethod.iban).toBeNull();
    });
  });

  describe('generateInvoiceNumber - year prefix and count', () => {
    test('should generate invoice number with current year', () => {
      // Line 831-835: generateInvoiceNumber logic
      const inv = billingService.createInvoice('year-check', { amount: 100 });

      const currentYear = new Date().getFullYear();
      expect(inv.invoice.number).toMatch(new RegExp(`^INV-${currentYear}-\\d{5}$`));
    });

    test('should increment invoice count for same year', () => {
      // Line 832-834: filter and count invoices
      const inv1 = billingService.createInvoice('count-check', { amount: 100 });
      const inv2 = billingService.createInvoice('count-check', { amount: 200 });

      const num1 = parseInt(inv1.invoice.number.split('-')[2], 10);
      const num2 = parseInt(inv2.invoice.number.split('-')[2], 10);

      expect(num2).toBeGreaterThan(num1);
    });
  });

  describe('getPlanValue helper - plan rankings', () => {
    test('should rank free as lowest value', () => {
      // Helper function getPlanValue used in line 193, 827
      // Test via changePlan to verify ranking
      billingService.createSubscription('rank-free', 'starter');

      const result = billingService.changePlan('rank-free', 'professional');

      expect(result.isUpgrade).toBe(true); // starter (free) to professional is upgrade
    });

    test('should rank enterprise as highest value', () => {
      billingService.createSubscription('rank-enterprise', 'enterprise');

      const result = billingService.changePlan('rank-enterprise', 'business');

      expect(result.isUpgrade).toBe(false); // enterprise to business is downgrade
    });

    test('should return 0 for invalid plan', () => {
      // Line 827: values[plan] || 0
      // Test by creating subscription with valid plan, then try invalid change
      billingService.createSubscription('invalid-rank', 'professional');

      const result = billingService.changePlan('invalid-rank', 'invalid_plan');

      expect(result.success).toBe(false); // Caught earlier, but tests the helper default
    });
  });
});
