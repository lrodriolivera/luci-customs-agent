#!/usr/bin/env node
/**
 * Translate TARIC code descriptions from English to Spanish using Claude Haiku
 *
 * Reads all TARIC codes from MongoDB where description.es == description.en (still in English),
 * translates them in batches using Claude Haiku (cheap & fast), and updates MongoDB.
 *
 * Usage:
 *   node scripts/translateTaricToSpanish.js              # All codes
 *   node scripts/translateTaricToSpanish.js 85           # Only chapter 85
 *   node scripts/translateTaricToSpanish.js 01 10        # Chapters 01 to 10
 *   node scripts/translateTaricToSpanish.js --dry-run    # Preview without writing
 *   node scripts/translateTaricToSpanish.js --force 85   # Re-translate chapter 85
 */

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const TaricCode = require('../src/models/TaricCode');

// ============================================================================
// Config
// ============================================================================
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_BATCH_SIZE = 80;  // descriptions per API call
const RATE_LIMIT_MS = 500;      // ms between API calls
const MAX_RETRIES = 3;

// Chapter names already in Spanish (from download script) - skip these
const CHAPTER_NAMES_ES = new Set([
  'Animales vivos', 'Carne y despojos comestibles', 'Cereales', 'Seda',
  'Algodón', 'Abonos', 'Corcho y sus manufacturas', 'Productos cerámicos',
  'Vidrio y sus manufacturas', 'Manufacturas diversas', 'Tejidos de punto'
]);

// ============================================================================
// Claude API call
// ============================================================================
async function callClaude(descriptions, retries = MAX_RETRIES) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in .env');

  const systemPrompt = `Eres un traductor experto en terminología aduanera y del Arancel Integrado de las Comunidades Europeas (TARIC).
Traduce descripciones de códigos TARIC del inglés al español.

Reglas:
- Usa terminología oficial aduanera española (Nomenclatura Combinada de la UE)
- Mantén el nivel técnico y precisión de la descripción original
- NO añadas explicaciones, solo la traducción
- Si la descripción ya está en español, devuélvela tal cual
- Mantén abreviaturas estándar (ej: "excl." → "excl.", "incl." → "incl.")
- "Other" → "Los/Las demás" (según contexto)
- "Parts" → "Partes", "Parts and accessories" → "Partes y accesorios"
- "Of" al inicio → "De" (ej: "Of plastics" → "De plástico")
- Respeta mayúsculas/minúsculas del original

Formato de entrada: JSON array de objetos {id, en}
Formato de salida: JSON array de objetos {id, es}

Responde SOLO con el JSON array, sin markdown ni explicaciones.`;

  const userMessage = JSON.stringify(descriptions.map(d => ({ id: d.id, en: d.en })));

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(
        ANTHROPIC_API_URL,
        {
          model: HAIKU_MODEL,
          max_tokens: 8192,
          system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: userMessage }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'prompt-caching-2024-07-31'
          },
          timeout: 60000
        }
      );

      let text = response.data.content[0].text.trim();
      // Parse JSON - handle potential markdown wrapping
      let jsonStr = text.startsWith('[') ? text : text.match(/\[[\s\S]*\]/)?.[0];
      if (!jsonStr) throw new Error('No JSON array in response');

      // Fix common JSON issues from LLM output
      jsonStr = jsonStr
        .replace(/,\s*}/g, '}')     // trailing comma in objects
        .replace(/,\s*\]/g, ']')    // trailing comma in arrays
        .replace(/(['"])\s*\n\s*/g, '$1') // newlines inside strings
        .replace(/\u201c|\u201d/g, '"');  // smart quotes

      let translations;
      try {
        translations = JSON.parse(jsonStr);
      } catch (parseErr) {
        // Try to salvage partial results by extracting individual objects
        const matches = [...jsonStr.matchAll(/"id"\s*:\s*"(\d+)"\s*,\s*"es"\s*:\s*"([^"]+)"/g)];
        if (matches.length > 0) {
          translations = matches.map(m => ({ id: m[1], es: m[2] }));
        } else {
          throw new Error(`JSON parse failed: ${parseErr.message}`);
        }
      }
      const usage = response.data.usage;

      return { translations, usage };

    } catch (error) {
      const isRateLimit = error.response?.status === 429;
      const isOverloaded = error.response?.status === 529;
      const isTimeout = error.code === 'ECONNABORTED';

      if ((isRateLimit || isOverloaded || isTimeout) && attempt < retries) {
        const wait = isRateLimit ? 30000 : isOverloaded ? 15000 : 5000;
        console.log(`   ⏳ ${isRateLimit ? 'Rate limited' : isOverloaded ? 'Overloaded' : 'Timeout'}, retry ${attempt}/${retries} in ${wait/1000}s...`);
        await sleep(wait);
        continue;
      }

      throw new Error(`Claude API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================================
// Check if description looks like English (heuristic)
// ============================================================================
function looksEnglish(text) {
  if (!text || text.length < 3) return false;
  // Common English words in TARIC that don't appear in Spanish
  const englishMarkers = /\b(other|the|and|not|for|with|from|than|but|which|whether|containing|having|weighing|exceeding|excluding|including|prepared|made|used|thereof|thereof)\b/i;
  return englishMarkers.test(text);
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const smallBatch = args.includes('--small');
  const BATCH_SIZE = smallBatch ? 30 : DEFAULT_BATCH_SIZE;
  const numArgs = args.filter(a => !a.startsWith('--')).map(Number);

  let startChapter = 1;
  let endChapter = 99;
  if (numArgs.length >= 1) startChapter = numArgs[0];
  if (numArgs.length >= 2) endChapter = numArgs[1];

  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  TARIC Translation: English → Spanish (Claude Haiku)    ║`);
  console.log(`║  Chapters ${String(startChapter).padStart(2,'0')} to ${String(endChapter).padStart(2,'0')}${dryRun ? '  [DRY RUN]' : ''}${force ? '  [FORCE]' : ''}                        ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/luci-customs';
  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB\n');

  // Build chapter filter
  const chapterFilter = [];
  for (let ch = startChapter; ch <= endChapter; ch++) {
    chapterFilter.push(String(ch).padStart(2, '0'));
  }

  // Find codes that need translation
  // Strategy: description.es == description.en means it was never translated (download script sets both to English)
  let query;
  if (force) {
    // Force mode: translate all codes in selected chapters
    query = {
      'breakdown.chapter': { $in: chapterFilter },
      'description.en': { $exists: true, $ne: '' },
      level: { $gte: 4 } // Skip chapter-level (already in Spanish)
    };
  } else {
    // Normal mode: only codes where es == en (never translated) or es looks English
    query = {
      'breakdown.chapter': { $in: chapterFilter },
      'description.en': { $exists: true, $ne: '' },
      level: { $gte: 4 },
      $expr: { $eq: ['$description.es', '$description.en'] }
    };
  }

  const codes = await TaricCode.find(query)
    .select('code description breakdown.chapter level')
    .sort({ code: 1 })
    .lean();

  // Filter: skip codes where description.es is already different from description.en (already translated)
  // and skip codes where the description doesn't look English
  const toTranslate = force
    ? codes
    : codes.filter(c => looksEnglish(c.description?.es));

  console.log(`📊 Found ${codes.length} codes with es == en, ${toTranslate.length} look English\n`);

  if (toTranslate.length === 0) {
    console.log('✓ Nothing to translate!');
    await mongoose.disconnect();
    return;
  }

  // Group into batches
  const batches = [];
  for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
    batches.push(toTranslate.slice(i, i + BATCH_SIZE));
  }

  let totalTranslated = 0;
  let totalErrors = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let currentChapter = '';

  for (let bIdx = 0; bIdx < batches.length; bIdx++) {
    const batch = batches[bIdx];
    const chapter = batch[0].breakdown.chapter;

    if (chapter !== currentChapter) {
      currentChapter = chapter;
      const chapterCodes = toTranslate.filter(c => c.breakdown.chapter === chapter);
      console.log(`\n📦 Cap ${chapter} (${chapterCodes.length} códigos por traducir)`);
    }

    const descriptions = batch.map(c => ({
      id: c.code,
      en: c.description.en
    }));

    if (dryRun) {
      console.log(`   [DRY] Batch ${bIdx + 1}/${batches.length}: ${batch.length} codes (${batch[0].code} - ${batch[batch.length-1].code})`);
      totalTranslated += batch.length;
      continue;
    }

    try {
      const { translations, usage } = await callClaude(descriptions);

      if (usage) {
        totalInputTokens += usage.input_tokens || 0;
        totalOutputTokens += usage.output_tokens || 0;
      }

      // Build a map for quick lookup
      const translationMap = new Map();
      for (const t of translations) {
        translationMap.set(t.id, t.es);
      }

      // Update MongoDB in bulk
      const bulkOps = [];
      for (const code of batch) {
        const es = translationMap.get(code.code);
        if (es) {
          bulkOps.push({
            updateOne: {
              filter: { code: code.code },
              update: {
                $set: {
                  'description.es': es,
                  'keywords': es
                    .toLowerCase()
                    .replace(/[,;:()\[\]]/g, ' ')
                    .split(/\s+/)
                    .filter(w => w.length > 2 && !['de','la','el','los','las','y','o','en','con','para','por','del'].includes(w))
                    .slice(0, 15),
                  lastUpdated: new Date()
                }
              }
            }
          });
          totalTranslated++;
        } else {
          totalErrors++;
        }
      }

      if (bulkOps.length > 0) {
        await TaricCode.bulkWrite(bulkOps);
      }

      process.stdout.write(`   ✓ Batch ${bIdx + 1}/${batches.length}: ${bulkOps.length} translated (${batch[0].code}→${batch[batch.length-1].code})\r\n`);

      // Rate limit
      await sleep(RATE_LIMIT_MS);

    } catch (error) {
      console.error(`   ✗ Batch ${bIdx + 1} error: ${error.message}`);
      totalErrors += batch.length;
      // Continue with next batch
      await sleep(2000);
    }
  }

  // Cost estimation (Haiku pricing)
  const inputCost = (totalInputTokens / 1000000) * 1.00;   // $1.00/MTok
  const outputCost = (totalOutputTokens / 1000000) * 5.00;  // $5.00/MTok
  const totalCost = inputCost + outputCost;

  // Final stats
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  RESULTADO                                              ║`);
  console.log(`╠══════════════════════════════════════════════════════════╣`);
  console.log(`║  Códigos traducidos: ${String(totalTranslated).padStart(6)}                           ║`);
  console.log(`║  Errores:            ${String(totalErrors).padStart(6)}                           ║`);
  console.log(`║  Input tokens:       ${String(totalInputTokens).padStart(6)}                           ║`);
  console.log(`║  Output tokens:      ${String(totalOutputTokens).padStart(6)}                           ║`);
  console.log(`║  Coste estimado:     $${totalCost.toFixed(4).padStart(7)}                          ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);

  // Verify: count how many still need translation
  const remaining = await TaricCode.countDocuments({
    level: { $gte: 4 },
    $expr: { $eq: ['$description.es', '$description.en'] }
  });
  console.log(`📊 Códigos pendientes de traducción: ${remaining}\n`);

  await mongoose.disconnect();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
