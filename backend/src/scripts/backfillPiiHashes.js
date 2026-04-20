/**
 * Idempotent backfill: compute businessInfo.nifHash / eoriHash for existing
 * Tenants so queries can start using the hashed index.
 *
 * Safe to run multiple times. Does not overwrite existing hashes.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { hash, enabled } = require('../utils/piiHash');

async function run() {
  if (!enabled()) {
    console.error('[backfill-pii] PII_HASH_KEY or PII_ENCRYPTION_KEY not set. Aborting.');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/luci-customs';
  await mongoose.connect(uri);
  const { Tenant } = require('../models');

  const tenants = await Tenant.find({}).lean();
  console.log(`[backfill-pii] ${tenants.length} tenants`);

  let updated = 0;
  for (const t of tenants) {
    const bi = t.businessInfo || {};
    const update = {};
    if (bi.nif && !bi.nifHash) update['businessInfo.nifHash'] = hash(bi.nif);
    if (bi.eori && !bi.eoriHash) update['businessInfo.eoriHash'] = hash(bi.eori);
    if (Object.keys(update).length) {
      await Tenant.updateOne({ _id: t._id }, { $set: update });
      console.log(`[backfill-pii] updated ${t.slug || t._id}: ${Object.keys(update).join(', ')}`);
      updated++;
    }
  }
  console.log(`[backfill-pii] Done. ${updated} tenants updated.`);
  await mongoose.connection.close();
}

if (require.main === module) {
  run().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { run };
