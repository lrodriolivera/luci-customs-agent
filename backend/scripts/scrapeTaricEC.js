#!/usr/bin/env node
/**
 * Scraper REAL de nomenclatura TARIC de la Comision Europea
 * Usa Puppeteer con Chromium para renderizar la pagina DDS2 y extraer codigos reales
 */
const puppeteer = require('puppeteer-core');
const mongoose = require('mongoose');
require('dotenv').config();

const TARIC_URL = 'https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp';

async function scrapeTaricForCode(browser, code) {
  const page = await browser.newPage();
  try {
    const url = `${TARIC_URL}?Lang=ES&Taric=${code}&SimDate=20260319&Expand=true`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for the nomenclature table to render
    await page.waitForSelector('table', { timeout: 10000 }).catch(() => {});

    // Extract all codes and descriptions from the page
    const data = await page.evaluate(() => {
      const results = [];
      // The TARIC consultation shows codes in a structured format
      // Look for elements containing codes and descriptions
      const allText = document.body.innerText;
      const lines = allText.split('\n').map(l => l.trim()).filter(l => l);

      for (const line of lines) {
        // Match patterns like "9505 10 10 00" or "9505.10.10.00" or "9505101000"
        const codeMatch = line.match(/^(\d{4}[\s.]*\d{2}[\s.]*\d{2}[\s.]*\d{2})/);
        if (codeMatch) {
          const code = codeMatch[1].replace(/[\s.]/g, '');
          // Description is the rest of the line or the next relevant text
          const desc = line.replace(codeMatch[0], '').replace(/^[\s\-:]+/, '').trim();
          if (code.length >= 8 && desc.length > 2) {
            results.push({ code: code.padEnd(10, '0'), description: desc });
          }
        }
      }

      // Also try finding structured data in tables
      document.querySelectorAll('tr').forEach(tr => {
        const tds = tr.querySelectorAll('td');
        if (tds.length >= 2) {
          const codeText = tds[0]?.innerText?.trim() || '';
          const descText = tds[1]?.innerText?.trim() || '';
          const codeCleaned = codeText.replace(/[\s.]/g, '');
          if (/^\d{4,10}$/.test(codeCleaned) && descText.length > 2) {
            results.push({ code: codeCleaned.padEnd(10, '0'), description: descText.substring(0, 256) });
          }
        }
      });

      return results;
    });

    await page.close();
    return data;
  } catch (err) {
    console.error(`Error scraping ${code}:`, err.message);
    await page.close();
    return [];
  }
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

function determineLevel(code) {
  const stripped = code.replace(/0+$/, '');
  if (stripped.length <= 2) return 2;
  if (stripped.length <= 4) return 4;
  if (stripped.length <= 6) return 6;
  if (stripped.length <= 8) return 8;
  return 10;
}

async function main() {
  const chapters = process.argv.slice(2);
  if (chapters.length === 0) {
    console.log('Usage: node scrapeTaricEC.js 95 08 07 ...');
    console.log('Scrapes REAL TARIC data from EC DDS2 for given chapters');
    process.exit(1);
  }

  console.log(`\n=== TARIC EC Scraper ===`);
  console.log(`Chapters: ${chapters.join(', ')}\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/snap/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const allResults = {};

  for (const chapter of chapters) {
    console.log(`Scraping chapter ${chapter}...`);
    const codes = await scrapeTaricForCode(browser, chapter);
    allResults[chapter] = codes;
    console.log(`  Found ${codes.length} codes`);
    for (const c of codes.slice(0, 5)) {
      console.log(`    ${c.code}: ${c.description.substring(0, 60)}`);
    }
    // Be nice to the server
    await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();

  // Save to MongoDB
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/luci-customs';
  await mongoose.connect(mongoUri);
  console.log('\nConnected to MongoDB');

  const TaricCode = require('../src/models/TaricCode');
  let upserted = 0, errors = 0;

  for (const [chapter, codes] of Object.entries(allResults)) {
    for (const item of codes) {
      try {
        const code = item.code.padEnd(10, '0');
        const level = determineLevel(code);
        const breakdown = parseCodeBreakdown(code);

        await TaricCode.findOneAndUpdate(
          { code },
          {
            code,
            description: { es: item.description },
            breakdown,
            level,
            isLeaf: level >= 8,
            isActive: true,
            keywords: item.description.toLowerCase().split(/\s+/).filter(w => w.length > 2).slice(0, 15),
            lastUpdated: new Date()
          },
          { upsert: true }
        );
        upserted++;
      } catch (e) {
        errors++;
      }
    }
  }

  const total = await TaricCode.countDocuments({ isActive: true });
  console.log(`\nUpserted: ${upserted} | Errors: ${errors} | Total in DB: ${total}`);

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
