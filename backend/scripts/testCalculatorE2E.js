#!/usr/bin/env node
/**
 * E2E Test: Duty Calculator Frontend (Puppeteer)
 * Takes screenshots as evidence for each of the 5 reported errors
 */

const puppeteer = require('puppeteer-core');
const path = require('path');

const BASE_URL = 'https://aduanas.strixai.es';
const EVIDENCE_DIR = path.join(__dirname, '..', '..', 'observaciones_test', 'EVIDENCIA_CORRECCION_ARANCELES');

const TEST_CASES = [
  { code: '9505900000', name: 'Articulos navideños', expected: '2.7', value: '1000' },
  { code: '8301600090', name: 'Cerraduras partes', expected: '2.7', value: '1000' },
  { code: '3926909790', name: 'Articulos plastico', expected: '6.5', value: '1000' },
  { code: '3824999699', name: 'Productos quimicos', expected: '6.5', value: '1000' },
  { code: '4408909500', name: 'Chapas madera >1mm', expected: '4', value: '1000' },
];

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  E2E Test: Calculadora de Derechos (Frontend)           ║');
  console.log('║  URL: ' + BASE_URL.padEnd(49) + '║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Launch chromium manually with explicit user-data-dir (snap workaround)
  const { spawn } = require('child_process');
  const chromeProc = spawn('/snap/bin/chromium', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--remote-debugging-port=9222', '--window-size=1400,900',
    '--user-data-dir=/tmp/chrome_puppeteer_profile'
  ], { stdio: 'ignore', detached: true });
  chromeProc.unref();
  await sleep(4000);

  let browser;
  try {
    const versionData = await (await fetch('http://localhost:9222/json/version')).json();
    console.log('✓ Chrome connected:', versionData.Browser);
    browser = await puppeteer.connect({ browserWSEndpoint: versionData.webSocketDebuggerUrl });
  } catch(e) {
    console.error('Cannot connect to Chrome:', e.message);
    chromeProc.kill();
    process.exit(1);
  }

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  // Step 1: Login
  console.log('🔐 Logging in...');
  await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });

  // Type email
  const emailInput = await page.$('input[type="email"]') || await page.$('input[name="email"]');
  await emailInput.click({ clickCount: 3 });
  await emailInput.type('demo@airgoexpress.com', { delay: 30 });

  // Type password
  const passInput = await page.$('input[type="password"]') || await page.$('input[name="password"]');
  await passInput.click({ clickCount: 3 });
  await passInput.type('AirgoDemo2026', { delay: 30 });

  // Submit
  const submitBtn = await page.$('button[type="submit"]');
  await submitBtn.click();
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  await sleep(2000);

  console.log('✓ Logged in\n');

  // Step 2: Navigate to calculator
  console.log('📊 Navigating to calculator...');
  await page.goto(BASE_URL + '/calculator', { waitUntil: 'networkidle2', timeout: 15000 });
  await sleep(2000);

  // Step 3: Run each test case
  let passed = 0;
  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    console.log(`\n═══ TEST ${i + 1}: ${tc.code} (${tc.name}) ═══`);

    try {
      // Clear and fill TARIC code
      const taricInput = await page.$('input[placeholder*="0000"]') || (await page.$$('input[type="text"]'))[0];
      await taricInput.click({ clickCount: 3 });
      await taricInput.type(tc.code, { delay: 20 });

      // Clear and fill value
      const valueInput = await page.$('input[type="number"]') || await page.$('input[placeholder*="0.00"]');
      await valueInput.click({ clickCount: 3 });
      await valueInput.type(tc.value, { delay: 20 });

      // Select origin CN (China)
      const selects = await page.$$('select');
      if (selects.length > 0) {
        await selects[0].select('CN');
      }

      // Click calculate button
      const calcBtn = await page.$('button[type="submit"]');
      await calcBtn.click();

      // Wait for results
      await sleep(4000);

      // Scroll to results
      await page.evaluate(() => {
        const resultCard = document.querySelectorAll('.card')[1] || document.querySelector('[class*="mt-6"]');
        if (resultCard) resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      await sleep(1000);

      // Take screenshot
      const screenshotPath = path.join(EVIDENCE_DIR, `FRONTEND_TEST_${i + 1}_${tc.code}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`   📸 Screenshot: FRONTEND_TEST_${i + 1}_${tc.code}.png`);

      // Extract the duty rate from the page
      const pageText = await page.evaluate(() => document.body.innerText);
      const rateMatch = pageText.match(/Tipo Arancel Base \(MFN\)\s*(\d+\.?\d*)%/i)
        || pageText.match(/Base.*?MFN.*?(\d+\.?\d*)\s*%/i)
        || pageText.match(/(\d+\.?\d*)\s*%\s*.*arancel/i);

      if (rateMatch) {
        const rate = rateMatch[1];
        if (rate === tc.expected || parseFloat(rate) === parseFloat(tc.expected)) {
          console.log(`   ✅ PASS: ${rate}% = esperado ${tc.expected}%`);
          passed++;
        } else {
          console.log(`   ❌ FAIL: ${rate}% ≠ esperado ${tc.expected}%`);
        }
      } else {
        // Try to find the rate in a different format
        const dutyMatch = pageText.match(/(\d+\.?\d*)\s*%/);
        console.log(`   ⚠️  Rate text not found in expected format. First % found: ${dutyMatch ? dutyMatch[1] + '%' : 'none'}`);
        // Still take full page screenshot for evidence
        const fullPath = path.join(EVIDENCE_DIR, `FRONTEND_TEST_${i + 1}_${tc.code}_FULL.png`);
        await page.screenshot({ path: fullPath, fullPage: true });
      }

    } catch (err) {
      console.log(`   ❌ ERROR: ${err.message}`);
      const errPath = path.join(EVIDENCE_DIR, `FRONTEND_ERROR_${i + 1}_${tc.code}.png`);
      await page.screenshot({ path: errPath, fullPage: true });
    }

    // Clear form for next test - reload page
    if (i < TEST_CASES.length - 1) {
      await page.goto(BASE_URL + '/calculator', { waitUntil: 'networkidle2', timeout: 15000 });
      await sleep(1500);
    }
  }

  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  RESULTADO: ${passed}/${TEST_CASES.length} PASS                                    ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);

  await browser.disconnect();
  chromeProc.kill();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
