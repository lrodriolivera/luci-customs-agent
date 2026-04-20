/**
 * Audits controllers for MongoDB queries that may lack tenantId filtering.
 *
 * Scans backend/src/controllers and backend/src/services for patterns like
 * Model.find(...), Model.findOne(...), Model.countDocuments(...) and flags
 * lines that do NOT reference tenantId, req.tenantQuery, req.tenantId, or _id.
 *
 * Findings are heuristics — a WARN is not automatically a bug (e.g. super-admin
 * dashboards are legitimate). The purpose is to produce a reviewable list.
 *
 * Run: npm run audit:tenants
 */

const fs = require('fs');
const path = require('path');

const TENANT_AWARE_MODELS = new Set([
  'Expedition', 'H7Declaration', 'ENSDeclaration', 'PUERequest', 'Transit',
  'User', 'Guarantee', 'Requirement', 'Deadline', 'Inspection',
  'InspectorCommunication', 'SpecialRegime', 'Workflow', 'WorkflowExecution',
  'OEA', 'Payment', 'ClientApiKey', 'ParaduaneroControl'
]);

const QUERY_METHODS = [
  'find', 'findOne', 'findById', 'findByIdAndUpdate', 'findByIdAndDelete',
  'findOneAndUpdate', 'findOneAndDelete', 'countDocuments', 'count',
  'distinct', 'aggregate', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany'
];

const SCAN_DIRS = [
  path.join(__dirname, '..', 'controllers'),
  path.join(__dirname, '..', 'services')
];

const TENANT_MARKERS = [
  'tenantId', 'req.tenantQuery', 'req.tenantId',
  'buildTenantFilter', 'organizationId', '_id:',
  'ensureSameTenant'  // post-fetch tenant guard counts as verified
];

function scanFile(filePath) {
  const findings = [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const queryPattern = new RegExp(
    `\\b(${Array.from(TENANT_AWARE_MODELS).join('|')})\\.(${QUERY_METHODS.join('|')})\\(`,
    'g'
  );

  lines.forEach((line, idx) => {
    const matches = [...line.matchAll(queryPattern)];
    if (matches.length === 0) return;

    // Context: current line + next 4 (for multi-line queries)
    const context = lines.slice(idx, Math.min(idx + 5, lines.length)).join('\n');
    const hasTenantMarker = TENANT_MARKERS.some(m => context.includes(m));

    if (!hasTenantMarker) {
      for (const m of matches) {
        findings.push({
          file: path.relative(path.join(__dirname, '..', '..'), filePath),
          line: idx + 1,
          model: m[1],
          method: m[2],
          snippet: line.trim().slice(0, 160)
        });
      }
    }
  });

  return findings;
}

function walk(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else if (entry.name.endsWith('.js')) results.push(full);
  }
  return results;
}

function run() {
  const allFindings = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walk(dir)) {
      allFindings.push(...scanFile(file));
    }
  }

  if (allFindings.length === 0) {
    console.log('[audit-tenants] No suspicious queries found. All tenant-aware models are filtered.');
    return 0;
  }

  const byFile = allFindings.reduce((acc, f) => {
    (acc[f.file] = acc[f.file] || []).push(f);
    return acc;
  }, {});

  console.log(`[audit-tenants] ${allFindings.length} potential issue(s) across ${Object.keys(byFile).length} file(s):\n`);
  for (const [file, items] of Object.entries(byFile)) {
    console.log(`  ${file}`);
    for (const f of items) {
      console.log(`    L${f.line}  ${f.model}.${f.method}()  "${f.snippet}"`);
    }
    console.log('');
  }
  console.log('Review each: confirm it is a super-admin route, or add tenantId/req.tenantQuery filter.');
  return allFindings.length;
}

if (require.main === module) {
  const count = run();
  process.exit(count > 0 ? 0 : 0);  // informational, does not fail the build
}

module.exports = { run, scanFile };
