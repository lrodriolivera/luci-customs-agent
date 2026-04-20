/**
 * Post-fetch tenant ownership check.
 *
 * Many controllers do Model.findById(req.params.id) without including tenantId
 * in the query because IDs are globally-unique ObjectIds. That works for
 * retrieval but lets an attacker probe *existence* of records in other tenants
 * by URL manipulation. After fetching, always verify ownership:
 *
 *   const exp = await Expedition.findById(id);
 *   if (!ensureSameTenant(exp, req, res)) return;
 *
 * Returns true if safe to continue; if not, writes a 404 response and returns
 * false. We use 404 (not 403) to avoid leaking existence across tenants.
 */

function extractTenantId(doc) {
  if (!doc) return null;
  const raw = doc.tenantId || doc.organizationId;
  if (!raw) return null;
  return typeof raw === 'object' ? String(raw) : raw;
}

function isSuperAdmin(user) {
  return user?.role === 'superadmin' || user?.isSuperAdmin === true;
}

function ensureSameTenant(doc, req, res, { resource = 'Resource' } = {}) {
  if (!doc) {
    if (res && !res.headersSent) res.status(404).json({ success: false, error: `${resource} no encontrado` });
    return false;
  }
  if (isSuperAdmin(req.user)) return true;

  const docTenant = extractTenantId(doc);
  const userTenant = req.tenantId || (req.user?.tenantId ? String(req.user.tenantId) : null);

  // If the doc has no tenant (legacy) allow but log a warning once
  if (!docTenant) return true;
  if (!userTenant) {
    if (res && !res.headersSent) res.status(401).json({ success: false, error: 'No autenticado' });
    return false;
  }
  if (docTenant !== userTenant) {
    if (res && !res.headersSent) res.status(404).json({ success: false, error: `${resource} no encontrado` });
    return false;
  }
  return true;
}

module.exports = { ensureSameTenant, extractTenantId, isSuperAdmin };
