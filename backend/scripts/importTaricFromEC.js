#!/usr/bin/env node
/**
 * Importar datos TARIC REALES desde la API SOAP de la Comision Europea
 * Endpoint: https://ec.europa.eu/taxation_customs/dds2/taric/services/goods
 * Operacion: goodsDescrForWs (descripcion por codigo)
 */
require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');

const EC_TARIC_SOAP = 'https://ec.europa.eu/taxation_customs/dds2/taric/services/goods';
const LANG = 'es';
const REF_DATE = '2026-03-19';
const DELAY_MS = 300; // Be nice to EC servers

function buildSoapRequest(goodsCode) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="http://goodsNomenclatureForWS.ws.taric.dds.s/">
  <soap:Body>
    <tns:goodsDescrForWs>
      <tns:goodsCode>${goodsCode}</tns:goodsCode>
      <tns:languageCode>${LANG}</tns:languageCode>
      <tns:referenceDate>${REF_DATE}</tns:referenceDate>
    </tns:goodsDescrForWs>
  </soap:Body>
</soap:Envelope>`;
}

async function queryTaricCode(code) {
  try {
    const resp = await axios.post(EC_TARIC_SOAP, buildSoapRequest(code), {
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      timeout: 10000
    });
    const xml = resp.data;
    const desc = (xml.match(/description[^>]*>([^<]+)/) || [])[1] || '';
    const declarable = (xml.match(/declarable[^>]*>([^<]+)/) || [])[1] === 'true';
    if (!desc) return null;
    return { code, description: desc.trim(), declarable };
  } catch (e) {
    return null;
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseBreakdown(code) {
  const n = code.padEnd(10, '0');
  return { chapter: n.substring(0,2), heading: n.substring(0,4), subheading: n.substring(0,6), cnCode: n.substring(0,8), taricCode: n };
}

function getLevel(code) {
  const s = code.replace(/0+$/, '');
  if (s.length <= 2) return 2;
  if (s.length <= 4) return 4;
  if (s.length <= 6) return 6;
  if (s.length <= 8) return 8;
  return 10;
}

async function exploreChapter(chapter) {
  const results = [];
  const ch = chapter.padStart(2, '0');

  // Query all possible headings (XX01 to XX99)
  for (let h = 1; h <= 99; h++) {
    const heading = ch + String(h).padStart(2, '0');
    const headingCode = heading.padEnd(10, '0');
    const result = await queryTaricCode(headingCode);

    if (result) {
      results.push(result);
      process.stdout.write(`  ${heading}: ${result.description.substring(0, 50)}\n`);

      // Explore subheadings (XXXX10 to XXXX99)
      for (let s = 10; s <= 99; s++) {
        const sub = heading + String(s).padStart(2, '0');
        const subCode = sub.padEnd(10, '0');
        const subResult = await queryTaricCode(subCode);
        if (subResult) {
          results.push(subResult);

          // Explore CN codes (XXXXXX10 to XXXXXX99)
          for (let cn = 10; cn <= 99; cn++) {
            const cnCode = sub + String(cn).padStart(2, '0');
            const cnFull = cnCode.padEnd(10, '0');
            const cnResult = await queryTaricCode(cnFull);
            if (cnResult) {
              results.push(cnResult);
            }
            await delay(DELAY_MS);
          }
        }
        await delay(DELAY_MS);
      }
    }
    await delay(DELAY_MS);
  }

  return results;
}

async function main() {
  const chapters = process.argv.slice(2);
  if (!chapters.length) {
    console.log('Usage: node importTaricFromEC.js 95 08 07 ...');
    process.exit(1);
  }

  console.log('=== TARIC EC SOAP Importer ===');
  console.log(`Chapters: ${chapters.join(', ')}`);
  console.log(`Language: ${LANG} | Date: ${REF_DATE}\n`);

  const allResults = {};
  for (const ch of chapters) {
    console.log(`\nExploring chapter ${ch}...`);
    allResults[ch] = await exploreChapter(ch);
    console.log(`  Total codes found: ${allResults[ch].length}`);
  }

  // Save to MongoDB
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/luci-customs';
  await mongoose.connect(mongoUri);
  console.log('\nConnected to MongoDB');

  const TaricCode = require('../src/models/TaricCode');
  let upserted = 0, errors = 0;

  for (const [ch, codes] of Object.entries(allResults)) {
    for (const item of codes) {
      try {
        const code = item.code.padEnd(10, '0');
        const level = getLevel(code);
        await TaricCode.findOneAndUpdate(
          { code },
          {
            code,
            description: { es: item.description },
            breakdown: parseBreakdown(code),
            level,
            isLeaf: item.declarable || level >= 8,
            isActive: true,
            keywords: item.description.toLowerCase().split(/\s+/).filter(w => w.length > 2).slice(0, 15),
            lastUpdated: new Date()
          },
          { upsert: true }
        );
        upserted++;
      } catch (e) { errors++; }
    }
  }

  const total = await TaricCode.countDocuments({ isActive: true });
  console.log(`\nUpserted: ${upserted} | Errors: ${errors} | Total in DB: ${total}`);
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
