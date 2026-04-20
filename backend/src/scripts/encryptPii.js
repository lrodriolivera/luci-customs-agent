/**
 * Migration: encrypt existing Tenant.businessInfo.nif/eori in-place.
 *
 * Idempotent: skips records already encrypted (prefix `v1:`). Computes hash
 * first (from plaintext) if missing, then encrypts.
 *
 * Requires: PII_ENCRYPTION_KEY + PII_HASH_KEY (or same key) in env + ENCRYPT_PII=true.
 *
 * Run: node src/scripts/encryptPii.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  const { encrypt, enabled: encEnabled, isEncrypted } = require('../utils/piiCrypto');
  const { hash, enabled: hashEnabled } = require('../utils/piiHash');

  if (!encEnabled()) {
    console.error('[encrypt-pii] PII_ENCRYPTION_KEY not set (min 32 chars). Abort.');
    process.exit(1);
  }
  if (!hashEnabled()) {
    console.error('[encrypt-pii] PII_HASH_KEY or PII_ENCRYPTION_KEY not set. Abort.');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/luci-customs';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const col = db.collection('tenants');

  const tenants = await col.find({}).toArray();
  console.log(`[encrypt-pii] ${tenants.length} tenants`);

  let encrypted = 0;
  let skipped = 0;
  for (const t of tenants) {
    const bi = t.businessInfo || {};
    const update = {};

    if (bi.nif && !isEncrypted(bi.nif)) {
      if (!bi.nifHash) update['businessInfo.nifHash'] = hash(bi.nif);
      update['businessInfo.nif'] = encrypt(bi.nif);
    }
    if (bi.eori && !isEncrypted(bi.eori)) {
      if (!bi.eoriHash) update['businessInfo.eoriHash'] = hash(bi.eori);
      update['businessInfo.eori'] = encrypt(bi.eori);
    }

    if (Object.keys(update).length) {
      await col.updateOne({ _id: t._id }, { $set: update });
      console.log(`[encrypt-pii] encrypted ${t.slug || t._id}: ${Object.keys(update).join(', ')}`);
      encrypted++;
    } else {
      skipped++;
    }
  }

  console.log(`\n[encrypt-pii] Done. ${encrypted} encrypted, ${skipped} already-encrypted/empty.`);
  await mongoose.connection.close();
}

if (require.main === module) {
  run().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { run };
