/**
 * Idempotent MongoDB index migration.
 *
 * Creates compound indexes for tenant-scoped queries and common filters.
 * Safe to run multiple times: createIndex is a no-op if the index already exists.
 *
 * Run with:   node src/scripts/createIndexes.js
 * Or:         npm run migrate:indexes
 */

require('dotenv').config();
const mongoose = require('mongoose');

const INDEX_PLAN = [
  { collection: 'expeditions',        index: { tenantId: 1, status: 1 },       name: 'tenant_status' },
  { collection: 'expeditions',        index: { tenantId: 1, createdBy: 1 },    name: 'tenant_createdBy' },
  { collection: 'expeditions',        index: { tenantId: 1, createdAt: -1 },   name: 'tenant_createdAt_desc' },
  { collection: 'expeditions',        index: { tenantId: 1, country: 1 },      name: 'tenant_country' },
  { collection: 'expeditions',        index: { tenantId: 1, 'declaration.mrn': 1 }, name: 'tenant_mrn', sparse: true },

  { collection: 'h7declarations',     index: { tenantId: 1, status: 1 },       name: 'tenant_status' },
  { collection: 'h7declarations',     index: { tenantId: 1, channel: 1 },      name: 'tenant_channel' },
  { collection: 'h7declarations',     index: { tenantId: 1, createdAt: -1 },   name: 'tenant_createdAt_desc' },
  { collection: 'h7declarations',     index: { tenantId: 1, country: 1 },      name: 'tenant_country' },
  { collection: 'h7declarations',     index: { tenantId: 1, mrn: 1 },          name: 'tenant_mrn', sparse: true },

  { collection: 'ensdeclarations',    index: { tenantId: 1, status: 1 },       name: 'tenant_status' },
  { collection: 'ensdeclarations',    index: { tenantId: 1, createdAt: -1 },   name: 'tenant_createdAt_desc' },

  { collection: 'puerequests',        index: { tenantId: 1, status: 1 },       name: 'tenant_status' },
  { collection: 'puerequests',        index: { tenantId: 1, createdAt: -1 },   name: 'tenant_createdAt_desc' },

  { collection: 'transits',           index: { tenantId: 1, status: 1 },       name: 'tenant_status' },
  { collection: 'transits',           index: { tenantId: 1, createdAt: -1 },   name: 'tenant_createdAt_desc' },
  { collection: 'transits',           index: { tenantId: 1, mrn: 1 },          name: 'tenant_mrn', sparse: true },

  { collection: 'users',              index: { tenantId: 1, role: 1 },         name: 'tenant_role' },
  { collection: 'users',              index: { tenantId: 1, isActive: 1 },     name: 'tenant_active' },

  { collection: 'guarantees',         index: { tenantId: 1, status: 1 },       name: 'tenant_status' },
  { collection: 'requirements',       index: { tenantId: 1, status: 1 },       name: 'tenant_status' },
  { collection: 'deadlines',          index: { tenantId: 1, dueDate: 1 },      name: 'tenant_dueDate' },
  { collection: 'inspections',        index: { tenantId: 1, status: 1 },       name: 'tenant_status' },
  { collection: 'paraduaneracontrols', index: { tenantId: 1, status: 1 },      name: 'tenant_status' },
  { collection: 'specialregimes',     index: { tenantId: 1, status: 1 },       name: 'tenant_status' },
  { collection: 'workflows',          index: { tenantId: 1, status: 1 },       name: 'tenant_status' },
  { collection: 'workflowexecutions', index: { tenantId: 1, status: 1 },       name: 'tenant_status' },
  { collection: 'payments',           index: { tenantId: 1, status: 1 },       name: 'tenant_status' },
  { collection: 'oeas',               index: { tenantId: 1, status: 1 },       name: 'tenant_status' },
  { collection: 'clientapikeys',      index: { tenantId: 1, isActive: 1 },     name: 'tenant_active' },
  { collection: 'inspectorcommunications', index: { tenantId: 1, createdAt: -1 }, name: 'tenant_createdAt' }
];

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/luci-customs';
  console.log('[indexes] Connecting to', uri.replace(/:\/\/[^@]+@/, '://<redacted>@'));

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const existingCollections = (await db.listCollections().toArray()).map(c => c.name);

  const results = { created: 0, skipped: 0, missingCollection: 0, errors: 0 };

  for (const plan of INDEX_PLAN) {
    if (!existingCollections.includes(plan.collection)) {
      console.log(`[indexes] SKIP (no collection): ${plan.collection}`);
      results.missingCollection++;
      continue;
    }

    try {
      const options = { name: plan.name, background: true };
      if (plan.sparse) options.sparse = true;

      const result = await db.collection(plan.collection).createIndex(plan.index, options);
      const keys = Object.keys(plan.index).map(k => `${k}:${plan.index[k]}`).join(',');
      console.log(`[indexes] OK  ${plan.collection}.${result}  (${keys})`);
      results.created++;
    } catch (err) {
      if (err.code === 85 || err.code === 86 || /already exists/i.test(err.message)) {
        console.log(`[indexes] EXISTS  ${plan.collection}.${plan.name}`);
        results.skipped++;
      } else {
        console.error(`[indexes] ERROR  ${plan.collection}.${plan.name}:`, err.message);
        results.errors++;
      }
    }
  }

  console.log('\n[indexes] Summary:', results);
  await mongoose.connection.close();

  if (results.errors > 0) process.exit(1);
}

if (require.main === module) {
  run().catch(err => {
    console.error('[indexes] Fatal:', err);
    process.exit(1);
  });
}

module.exports = { INDEX_PLAN, run };
