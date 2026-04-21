#!/usr/bin/env node
/**
 * Download REAL TARIC/CN codes from UK Trade Tariff API
 *
 * The UK Trade Tariff uses the same HS/CN codes as the EU (6-digit HS, 8-digit CN).
 * Only TARIC codes (10-digit) may differ, but for the base nomenclature they are identical.
 *
 * API: https://www.trade-tariff.service.gov.uk/api/v2/headings/{HHHH}
 *
 * Usage: node scripts/downloadTaricFromUK.js [startChapter] [endChapter]
 * Examples:
 *   node scripts/downloadTaricFromUK.js          # All chapters 01-99
 *   node scripts/downloadTaricFromUK.js 01 10     # Chapters 01 to 10
 *   node scripts/downloadTaricFromUK.js 85        # Only chapter 85
 */

require('dotenv').config();
const mongoose = require('mongoose');
const https = require('https');
const TaricCode = require('../src/models/TaricCode');

// ============================================================================
// Chapter names in Spanish (from EU TARIC)
// ============================================================================
const CHAPTER_NAMES_ES = {
  '01': 'Animales vivos',
  '02': 'Carne y despojos comestibles',
  '03': 'Pescados y crustáceos, moluscos y demás invertebrados acuáticos',
  '04': 'Leche y productos lácteos; huevos de ave; miel natural',
  '05': 'Los demás productos de origen animal',
  '06': 'Plantas vivas y productos de la floricultura',
  '07': 'Hortalizas, plantas, raíces y tubérculos alimenticios',
  '08': 'Frutas y frutos comestibles; cortezas de agrios, melones o sandías',
  '09': 'Café, té, yerba mate y especias',
  '10': 'Cereales',
  '11': 'Productos de la molinería; malta; almidón y fécula; inulina; gluten de trigo',
  '12': 'Semillas y frutos oleaginosos; semillas y frutos diversos',
  '13': 'Gomas, resinas y demás jugos y extractos vegetales',
  '14': 'Materias trenzables y demás productos de origen vegetal',
  '15': 'Grasas y aceites animales o vegetales; grasas alimenticias elaboradas; ceras',
  '16': 'Preparaciones de carne, pescado o crustáceos',
  '17': 'Azúcares y artículos de confitería',
  '18': 'Cacao y sus preparaciones',
  '19': 'Preparaciones a base de cereales, harina, almidón, fécula o leche',
  '20': 'Preparaciones de hortalizas, frutas u otros frutos',
  '21': 'Preparaciones alimenticias diversas',
  '22': 'Bebidas, líquidos alcohólicos y vinagre',
  '23': 'Residuos y desperdicios de las industrias alimentarias',
  '24': 'Tabaco y sucedáneos del tabaco elaborados',
  '25': 'Sal; azufre; tierras y piedras; yesos, cales y cementos',
  '26': 'Minerales metalíferos, escorias y cenizas',
  '27': 'Combustibles minerales, aceites minerales',
  '28': 'Productos químicos inorgánicos',
  '29': 'Productos químicos orgánicos',
  '30': 'Productos farmacéuticos',
  '31': 'Abonos',
  '32': 'Extractos curtientes o tintóreos; taninos y sus derivados',
  '33': 'Aceites esenciales y resinoides; preparaciones de perfumería',
  '34': 'Jabones, agentes de superficie orgánicos',
  '35': 'Materias albuminoideas; productos a base de almidón o fécula modificados',
  '36': 'Pólvoras y explosivos; artículos de pirotecnia',
  '37': 'Productos fotográficos o cinematográficos',
  '38': 'Productos diversos de las industrias químicas',
  '39': 'Plástico y sus manufacturas',
  '40': 'Caucho y sus manufacturas',
  '41': 'Pieles (excepto la peletería) y cueros',
  '42': 'Manufacturas de cuero; artículos de talabartería o guarnicionería',
  '43': 'Peletería y confecciones de peletería',
  '44': 'Madera, carbón vegetal y manufacturas de madera',
  '45': 'Corcho y sus manufacturas',
  '46': 'Manufacturas de espartería o cestería',
  '47': 'Pasta de madera o de las demás materias fibrosas celulósicas',
  '48': 'Papel y cartón; manufacturas de pasta de celulosa',
  '49': 'Productos editoriales, de la prensa y de las demás industrias gráficas',
  '50': 'Seda',
  '51': 'Lana y pelo fino u ordinario',
  '52': 'Algodón',
  '53': 'Las demás fibras textiles vegetales',
  '54': 'Filamentos sintéticos o artificiales',
  '55': 'Fibras sintéticas o artificiales discontinuas',
  '56': 'Guata, fieltro y telas sin tejer',
  '57': 'Alfombras y demás revestimientos para el suelo',
  '58': 'Tejidos especiales; superficies textiles con mechón insertado',
  '59': 'Telas impregnadas, recubiertas, revestidas o estratificadas',
  '60': 'Tejidos de punto',
  '61': 'Prendas y complementos de vestir, de punto',
  '62': 'Prendas y complementos de vestir, excepto los de punto',
  '63': 'Los demás artículos textiles confeccionados; juegos; prendería',
  '64': 'Calzado, polainas y artículos análogos',
  '65': 'Sombreros, demás tocados, y sus partes',
  '66': 'Paraguas, sombrillas, quitasoles, bastones',
  '67': 'Plumas y plumón preparados; flores artificiales',
  '68': 'Manufacturas de piedra, yeso fraguable, cemento, amianto',
  '69': 'Productos cerámicos',
  '70': 'Vidrio y sus manufacturas',
  '71': 'Perlas finas o cultivadas, piedras preciosas, metales preciosos',
  '72': 'Fundición, hierro y acero',
  '73': 'Manufacturas de fundición, hierro o acero',
  '74': 'Cobre y sus manufacturas',
  '75': 'Níquel y sus manufacturas',
  '76': 'Aluminio y sus manufacturas',
  '78': 'Plomo y sus manufacturas',
  '79': 'Cinc y sus manufacturas',
  '80': 'Estaño y sus manufacturas',
  '81': 'Los demás metales comunes; cermets',
  '82': 'Herramientas y útiles, artículos de cuchillería',
  '83': 'Manufacturas diversas de metal común',
  '84': 'Reactores nucleares, calderas, máquinas, aparatos y artefactos mecánicos',
  '85': 'Máquinas, aparatos y material eléctrico',
  '86': 'Vehículos y material para vías férreas',
  '87': 'Vehículos automóviles, tractores, velocípedos',
  '88': 'Aeronaves, vehículos espaciales',
  '89': 'Barcos y demás artefactos flotantes',
  '90': 'Instrumentos y aparatos de óptica, fotografía, cinematografía',
  '91': 'Aparatos de relojería y sus partes',
  '92': 'Instrumentos musicales; sus partes y accesorios',
  '93': 'Armas, municiones, y sus partes y accesorios',
  '94': 'Muebles; mobiliario médico-quirúrgico; artículos de cama',
  '95': 'Juguetes, juegos y artículos para recreo o deporte',
  '96': 'Manufacturas diversas',
  '97': 'Objetos de arte o colección y antigüedades',
  '99': 'Códigos especiales de la nomenclatura combinada'
};

// ============================================================================
// Known headings per chapter (from HS 2024)
// ============================================================================
function getHeadingsForChapter(chapter) {
  // We'll discover headings dynamically from the API
  // But first define the known heading ranges per chapter
  const chapterNum = parseInt(chapter);
  const headings = [];

  // Generate possible headings - most chapters have headings from XX01 to XX99
  // The API will return 404 for non-existent ones
  for (let i = 1; i <= 99; i++) {
    headings.push(chapter + String(i).padStart(2, '0'));
  }
  return headings;
}

// ============================================================================
// HTTP fetch with retry
// ============================================================================
function fetchJSON(url, retries = 3) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
        if (res.statusCode === 404) {
          resolve(null); // heading doesn't exist
          return;
        }
        if (res.statusCode === 429 || res.statusCode >= 500) {
          if (n > 0) {
            setTimeout(() => attempt(n - 1), 3000);
            return;
          }
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(e); }
        });
      }).on('error', (err) => {
        if (n > 0) setTimeout(() => attempt(n - 1), 2000);
        else reject(err);
      });
    };
    attempt(retries);
  });
}

// ============================================================================
// Parse UK API response into our TARIC format
// ============================================================================
function parseHeadingResponse(json, headingCode) {
  if (!json || !json.data) return [];

  const results = [];
  const heading = json.data.attributes;

  // Add the heading itself (4-digit level)
  results.push({
    code: heading.goods_nomenclature_item_id,
    description: heading.description_plain || heading.description,
    level: 4,
    isLeaf: heading.declarable || false,
    indents: 0
  });

  // Parse included commodities
  if (json.included) {
    // Filter only commodities (not sections, chapters, etc.)
    const commodities = json.included.filter(item => item.type === 'commodity');

    // Group by goods_nomenclature_item_id and take the one with producline_suffix "80" (declarable)
    // or highest indent level
    const codeMap = new Map();

    for (const item of commodities) {
      const attrs = item.attributes;
      const code = attrs.goods_nomenclature_item_id;
      const suffix = attrs.producline_suffix;

      if (!codeMap.has(code)) {
        codeMap.set(code, []);
      }
      codeMap.get(code).push(attrs);
    }

    for (const [code, entries] of codeMap) {
      // Skip the heading code itself (already added)
      if (code === heading.goods_nomenclature_item_id) continue;

      // Prefer the declarable entry (suffix 80), otherwise take the descriptive one
      const declarable = entries.find(e => e.producline_suffix === '80');
      const descriptive = entries.find(e => e.producline_suffix !== '80');

      // Use declarable if exists, otherwise descriptive
      const primary = declarable || entries[0];
      const desc = descriptive ? descriptive.description_plain || descriptive.description : primary.description_plain || primary.description;

      const level = determineLevel(code);

      results.push({
        code: code,
        description: desc,
        level: level,
        isLeaf: primary.leaf || primary.declarable || false,
        indents: primary.number_indents || 0
      });
    }
  }

  return results;
}

function determineLevel(code) {
  const stripped = code.replace(/0+$/, '');
  if (stripped.length <= 2) return 2;
  if (stripped.length <= 4) return 4;
  if (stripped.length <= 6) return 6;
  if (stripped.length <= 8) return 8;
  return 10;
}

function parseCodeBreakdown(code) {
  const n = code.padEnd(10, '0').substring(0, 10);
  return {
    chapter: n.substring(0, 2),
    heading: n.substring(0, 4),
    subheading: n.substring(0, 6),
    cnCode: n.substring(0, 8),
    taricCode: n
  };
}

function extractKeywords(text) {
  const stopWords = ['de', 'la', 'el', 'los', 'las', 'y', 'o', 'en', 'con', 'para', 'por', 'a', 'del', 'the', 'and', 'or', 'of', 'for', 'in', 'not', 'other', 'including'];
  return text
    .toLowerCase()
    .replace(/[,;:()\[\]]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w))
    .slice(0, 15);
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  const args = process.argv.slice(2);
  let startChapter = 1;
  let endChapter = 99;

  if (args.length >= 1) startChapter = parseInt(args[0]);
  if (args.length >= 2) endChapter = parseInt(args[1]);

  // Skip chapter 77 (reserved by WCO) and 98 (national use)
  const skipChapters = [77, 98];

  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  TARIC Code Downloader - UK Trade Tariff API            ║`);
  console.log(`║  Chapters ${String(startChapter).padStart(2,'0')} to ${String(endChapter).padStart(2,'0')}                                     ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/luci-customs';
  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB\n');

  let totalUpserted = 0;
  let totalErrors = 0;
  let totalChapters = 0;

  for (let ch = startChapter; ch <= endChapter; ch++) {
    if (skipChapters.includes(ch)) continue;

    const chapter = String(ch).padStart(2, '0');
    const chapterName = CHAPTER_NAMES_ES[chapter] || `Capítulo ${chapter}`;

    // Check if chapter already has subcodes in DB
    const existingCount = await TaricCode.countDocuments({
      'breakdown.chapter': chapter,
      level: { $gte: 6 }  // subcodes, not just headings
    });

    if (existingCount > 5) {
      console.log(`⏭  Cap ${chapter}: ${chapterName} - ya tiene ${existingCount} subcódigos, saltando`);
      continue;
    }

    console.log(`\n📦 Cap ${chapter}: ${chapterName}`);

    // First, upsert the chapter-level entry
    try {
      await TaricCode.findOneAndUpdate(
        { code: chapter.padEnd(10, '0') },
        {
          code: chapter.padEnd(10, '0'),
          description: { es: chapterName, en: chapterName },
          breakdown: parseCodeBreakdown(chapter),
          level: 2,
          isLeaf: false,
          isActive: true,
          keywords: extractKeywords(chapterName),
          lastUpdated: new Date()
        },
        { upsert: true }
      );
    } catch (e) { /* ignore */ }

    // Try each possible heading in this chapter
    const headings = getHeadingsForChapter(chapter);
    let chapterCodes = 0;

    for (const heading of headings) {
      const url = `https://www.trade-tariff.service.gov.uk/api/v2/headings/${heading}`;

      try {
        const json = await fetchJSON(url);
        if (!json) continue; // heading doesn't exist

        const codes = parseHeadingResponse(json, heading);

        for (const item of codes) {
          try {
            const code10 = item.code.padEnd(10, '0').substring(0, 10);
            const breakdown = parseCodeBreakdown(code10);

            await TaricCode.findOneAndUpdate(
              { code: code10 },
              {
                code: code10,
                description: { es: item.description, en: item.description },
                breakdown,
                level: item.level,
                isLeaf: item.isLeaf,
                isActive: true,
                keywords: extractKeywords(item.description),
                lastUpdated: new Date()
              },
              { upsert: true }
            );
            totalUpserted++;
            chapterCodes++;
          } catch (e) {
            totalErrors++;
          }
        }

        // Rate limit: 400ms between requests to avoid 429
        await new Promise(r => setTimeout(r, 400));

      } catch (err) {
        if (!err.message.includes('404')) {
          console.error(`   ✗ Error heading ${heading}: ${err.message}`);
          totalErrors++;
        }
        // On rate limit, wait longer
        if (err.message.includes('429')) {
          console.log('   ⏳ Rate limited, waiting 10s...');
          await new Promise(r => setTimeout(r, 10000));
        }
      }
    }

    console.log(`   ✓ ${chapterCodes} códigos guardados`);
    totalChapters++;

    // Brief pause between chapters
    await new Promise(r => setTimeout(r, 500));
  }

  // Final stats
  const totalInDB = await TaricCode.countDocuments({ isActive: true });
  const leafCount = await TaricCode.countDocuments({ isLeaf: true });

  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  RESULTADO                                              ║`);
  console.log(`╠══════════════════════════════════════════════════════════╣`);
  console.log(`║  Capítulos procesados: ${String(totalChapters).padStart(4)}                             ║`);
  console.log(`║  Códigos upserted:     ${String(totalUpserted).padStart(4)}                             ║`);
  console.log(`║  Errores:              ${String(totalErrors).padStart(4)}                             ║`);
  console.log(`║  Total en BD:          ${String(totalInDB).padStart(4)}                             ║`);
  console.log(`║  Códigos hoja:         ${String(leafCount).padStart(4)}                             ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);

  await mongoose.disconnect();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
