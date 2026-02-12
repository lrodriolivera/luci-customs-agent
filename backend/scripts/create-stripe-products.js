/**
 * Create Stripe Products and Prices for LUCI Plans
 * Run once: node scripts/create-stripe-products.js
 */
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function createProducts() {
  console.log('Creating Stripe products and prices...\n');

  // 1. Find existing Professional product
  const existingProducts = await stripe.products.list({ limit: 10 });
  let profProduct = existingProducts.data.find(p => p.name.includes('Professional'));

  if (!profProduct) {
    profProduct = await stripe.products.create({
      name: 'LUCI Professional',
      description: '50 declaraciones/mes, 5 usuarios, H1/H7/AES/NCTS/ENS, envio directo AEAT',
      metadata: { plan: 'professional' }
    });
    console.log('Created Professional product:', profProduct.id);
  } else {
    console.log('Found existing Professional product:', profProduct.id);
  }

  // Check if Professional monthly price exists
  const existingPrices = await stripe.prices.list({ product: profProduct.id, limit: 10 });
  let profMonthly = existingPrices.data.find(p => p.recurring?.interval === 'month' && p.active);

  if (!profMonthly) {
    profMonthly = await stripe.prices.create({
      product: profProduct.id,
      unit_amount: 14900, // 149.00 EUR
      currency: 'eur',
      recurring: { interval: 'month' },
      metadata: { plan: 'professional', cycle: 'monthly' }
    });
    console.log('Created Professional monthly price:', profMonthly.id);
  } else {
    console.log('Found existing Professional monthly price:', profMonthly.id);
  }

  // 2. Business product
  const businessProduct = await stripe.products.create({
    name: 'LUCI Business',
    description: '200 declaraciones/mes, 15 usuarios, PUE SOIVRE/ROHS, API publica, analytics',
    metadata: { plan: 'business' }
  });
  console.log('Created Business product:', businessProduct.id);

  const businessMonthly = await stripe.prices.create({
    product: businessProduct.id,
    unit_amount: 34900, // 349.00 EUR
    currency: 'eur',
    recurring: { interval: 'month' },
    metadata: { plan: 'business', cycle: 'monthly' }
  });
  console.log('Created Business monthly price:', businessMonthly.id);

  // 3. Enterprise product
  const entProduct = await stripe.products.create({
    name: 'LUCI Enterprise',
    description: 'Declaraciones ilimitadas, usuarios ilimitados, integraciones custom, SLA 99.9%',
    metadata: { plan: 'enterprise' }
  });
  console.log('Created Enterprise product:', entProduct.id);

  const entMonthly = await stripe.prices.create({
    product: entProduct.id,
    unit_amount: 79900, // 799.00 EUR
    currency: 'eur',
    recurring: { interval: 'month' },
    metadata: { plan: 'enterprise', cycle: 'monthly' }
  });
  console.log('Created Enterprise monthly price:', entMonthly.id);

  // Output env vars
  console.log('\n========================================');
  console.log('Add these to your .env file:');
  console.log('========================================');
  console.log(`STRIPE_PRICE_PROFESSIONAL_MONTHLY=${profMonthly.id}`);
  console.log(`STRIPE_PRICE_BUSINESS_MONTHLY=${businessMonthly.id}`);
  console.log(`STRIPE_PRICE_ENTERPRISE_MONTHLY=${entMonthly.id}`);
  console.log('========================================\n');
}

createProducts().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
