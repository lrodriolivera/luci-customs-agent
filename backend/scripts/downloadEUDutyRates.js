#!/usr/bin/env node
/**
 * Download REAL EU duty rates from the EU TARIC Consultation Service
 *
 * Source: https://ec.europa.eu/taxation_customs/dds2/taric/
 * Method: 2-step scrape (measures.jsp → measures_details.jsp)
 * Extracts: Third country duty (MFN), Autonomous suspensions
 *
 * Usage:
 *   node scripts/downloadEUDutyRates.js              # All leaf codes
 *   node scripts/downloadEUDutyRates.js 85           # Only chapter 85
 *   node scripts/downloadEUDutyRates.js 01 10        # Chapters 01 to 10
 *   node scripts/downloadEUDutyRates.js --dry-run    # Preview without writing
 *   node scripts/downloadEUDutyRates.js --test       # Test with 5 known codes
 */

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const TaricCode = require('../src/models/TaricCode');

// ============================================================================
// Config
// ============================================================================
const BASE_URL = 'https://ec.europa.eu/taxation_customs/dds2/taric';
const SIM_DATE = '20260323';
const CONCURRENCY = 5;           // parallel requests (conservative, limit is 100/s)
const DELAY_BETWEEN_BATCHES = 300; // ms between batches
const REQUEST_TIMEOUT = 20000;

// ============================================================================
// Fetch duty rate for a single TARIC code
// ============================================================================
async function fetchDutyRate(taricCode, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Step 1: Get measures page
      const measUrl = `${BASE_URL}/measures.jsp?Lang=en&Offset=0&Taric=${taricCode}&SimDate=${SIM_DATE}&Domain=TARIC&ExpandAll=true&callbackuri=CBU-0`;
      const measResp = await axios.get(measUrl, { timeout: REQUEST_TIMEOUT });

      // Step 2: Extract measure_details URL
      const match = measResp.data.match(/expandCollapseIFrame\('[^']+',\s*'(measures_details\.jsp[^']+)'/);
      if (!match) {
        // No measures found - could be a parent code or genuinely 0%
        return { code: taricCode, thirdCountry: 0, autonomous: null, source: 'no_measures' };
      }

      const detailUrl = `${BASE_URL}/${match[1].replace(/&amp;/g, '&')}`;
      const detailResp = await axios.get(detailUrl, { timeout: REQUEST_TIMEOUT });

      // Step 3: Parse HTML for duty rates
      const text = detailResp.data.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

      let thirdCountry = null;
      let autonomous = null;
      let specific = null;

      // Third country duty (MFN) - the main rate
      const tcMatch = text.match(/Third country duty.*?(\d+\.?\d*)\s*%/i);
      if (tcMatch) thirdCountry = parseFloat(tcMatch[1]);

      // Check for specific duties (EUR/unit)
      const specificMatch = text.match(/Third country duty.*?(\d+\.?\d*)\s*EUR\s*\/\s*([^\s,]+)/i);
      if (specificMatch) {
        specific = { amount: parseFloat(specificMatch[1]), unit: specificMatch[2] };
      }

      // Autonomous tariff suspension (lower rate if applicable)
      const autoMatch = text.match(/Autonomous tariff suspension.*?(\d+\.?\d*)\s*%/i);
      if (autoMatch) autonomous = parseFloat(autoMatch[1]);

      return {
        code: taricCode,
        thirdCountry: thirdCountry !== null ? thirdCountry : 0,
        autonomous,
        specific,
        source: thirdCountry !== null ? 'eu_taric' : 'no_rate_found'
      };

    } catch (err) {
      if (attempt < retries) {
        const isTimeout = err.code === 'ECONNABORTED' || err.message.includes('timeout');
        const is429 = err.response?.status === 429;
        const is5xx = err.response?.status >= 500;
        if (isTimeout || is429 || is5xx) {
          await sleep(is429 ? 5000 : 2000);
          continue;
        }
      }
      return { code: taricCode, error: err.message, source: 'error' };
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================================
// Process codes in parallel batches
// ============================================================================
async function processBatch(codes) {
  return Promise.all(codes.map(code => fetchDutyRate(code)));
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const testMode = args.includes('--test');
  const numArgs = args.filter(a => !a.startsWith('--')).map(Number);

  let startChapter = 1;
  let endChapter = 99;
  if (numArgs.length >= 1) startChapter = numArgs[0];
  if (numArgs.length >= 2) endChapter = numArgs[1];

  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  EU TARIC Duty Rate Downloader                          ║`);
  console.log(`║  Source: ec.europa.eu/taxation_customs/dds2/taric        ║`);
  console.log(`║  Chapters ${String(startChapter).padStart(2,'0')} to ${String(endChapter).padStart(2,'0')}${dryRun ? '  [DRY RUN]' : ''}${testMode ? '  [TEST]' : ''}                        ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/luci-customs';
  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB\n');

  // Test mode: just check 5 known codes
  if (testMode) {
    const testCodes = ['9505900000', '8301600090', '3926909790', '3824999699', '4408909500'];
    const expected = [2.7, 2.7, 6.5, 6.5, 4.0];
    console.log('Testing 5 known codes...\n');
    for (let i = 0; i < testCodes.length; i++) {
      const result = await fetchDutyRate(testCodes[i]);
      const ok = result.thirdCountry === expected[i] ? '✓' : '✗';
      console.log(`  ${ok} ${testCodes[i]}: ${result.thirdCountry}% (expected ${expected[i]}%) [${result.source}]`);
      await sleep(300);
    }
    await mongoose.disconnect();
    return;
  }

  // Build chapter filter
  const chapterFilter = [];
  for (let ch = startChapter; ch <= endChapter; ch++) {
    chapterFilter.push(String(ch).padStart(2, '0'));
  }

  // Get leaf codes (level >= 6, the ones that actually have duty rates)
  const codes = await TaricCode.find({
    'breakdown.chapter': { $in: chapterFilter },
    isActive: true,
    isLeaf: true
  }).select('code breakdown.chapter').sort({ code: 1 }).lean();

  console.log(`📊 Found ${codes.length} leaf codes to process\n`);

  if (codes.length === 0) {
    console.log('Nothing to process.');
    await mongoose.disconnect();
    return;
  }

  let totalUpdated = 0;
  let totalErrors = 0;
  let totalWithDuty = 0;
  let totalZero = 0;
  let currentChapter = '';

  // Process in batches of CONCURRENCY
  for (let i = 0; i < codes.length; i += CONCURRENCY) {
    const batch = codes.slice(i, i + CONCURRENCY);
    const chapter = batch[0].breakdown.chapter;

    if (chapter !== currentChapter) {
      currentChapter = chapter;
      const chapterCodes = codes.filter(c => c.breakdown.chapter === chapter);
      console.log(`\n📦 Cap ${chapter} (${chapterCodes.length} códigos)`);
    }

    if (dryRun) {
      totalUpdated += batch.length;
      continue;
    }

    const results = await processBatch(batch.map(c => c.code));

    // Update MongoDB
    const bulkOps = [];
    for (const r of results) {
      if (r.error) {
        totalErrors++;
        continue;
      }

      const update = {
        'duties.thirdCountry': r.thirdCountry,
        lastUpdated: new Date()
      };

      if (r.autonomous !== null) {
        update['duties.autonomous'] = r.autonomous;
      }
      if (r.specific) {
        update['duties.specific.amount'] = r.specific.amount;
        update['duties.specific.unit'] = r.specific.unit;
      }

      bulkOps.push({
        updateOne: {
          filter: { code: r.code },
          update: { $set: update }
        }
      });

      if (r.thirdCountry > 0) totalWithDuty++;
      else totalZero++;
      totalUpdated++;
    }

    if (bulkOps.length > 0) {
      await TaricCode.bulkWrite(bulkOps);
    }

    // Progress
    const pct = Math.round(((i + batch.length) / codes.length) * 100);
    const lastCode = batch[batch.length - 1].code;
    const rates = results.filter(r => !r.error).map(r => r.thirdCountry + '%').join(', ');
    process.stdout.write(`   ${pct}% (${i + batch.length}/${codes.length}) ${lastCode} → [${rates}]\r\n`);

    await sleep(DELAY_BETWEEN_BATCHES);
  }

  // Also update parent codes (level 4, 6, 8) by averaging their children's rates
  if (!dryRun) {
    console.log('\n\n📊 Propagating rates to parent codes...');
    await propagateRatesToParents(chapterFilter);
  }

  // Final stats
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  RESULTADO                                              ║`);
  console.log(`╠══════════════════════════════════════════════════════════╣`);
  console.log(`║  Códigos procesados: ${String(totalUpdated).padStart(6)}                           ║`);
  console.log(`║  Con arancel > 0%:   ${String(totalWithDuty).padStart(6)}                           ║`);
  console.log(`║  Con arancel 0%:     ${String(totalZero).padStart(6)}                           ║`);
  console.log(`║  Errores:            ${String(totalErrors).padStart(6)}                           ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);

  await mongoose.disconnect();
}

// ============================================================================
// Propagate duty rates from leaf codes up to parent codes
// ============================================================================
async function propagateRatesToParents(chapterFilter) {
  const chapters = await TaricCode.find({
    'breakdown.chapter': { $in: chapterFilter },
    level: { $in: [4, 6, 8] },
    isActive: true
  }).select('code level').sort({ level: -1 }).lean(); // Process deepest first

  let updated = 0;
  for (const parent of chapters) {
    const prefix = parent.code.replace(/0+$/, '');
    const children = await TaricCode.find({
      code: { $regex: `^${prefix}` },
      'duties.thirdCountry': { $gt: 0 },
      isActive: true,
      _id: { $ne: parent._id }
    }).select('duties.thirdCountry').lean();

    if (children.length > 0) {
      const avgRate = children.reduce((sum, c) => sum + (c.duties?.thirdCountry || 0), 0) / children.length;
      await TaricCode.updateOne(
        { code: parent.code },
        { $set: { 'duties.thirdCountry': Math.round(avgRate * 100) / 100 } }
      );
      updated++;
    }
  }
  console.log(`   ✓ ${updated} parent codes updated with averaged rates`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
