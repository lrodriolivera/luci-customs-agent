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

const mongoose = require('mongoose');
const { esSuperAdmin } = require('../constants/roles');

function extractTenantId(doc) {
  if (!doc) return null;
  const raw = doc.tenantId || doc.organizationId;
  if (!raw) return null;
  return typeof raw === 'object' ? String(raw) : raw;
}

// Delegado en src/constants/roles.js: esta funcion comprobaba 'superadmin' SIN
// guion bajo, mientras tenantMiddleware exigia 'super_admin' CON el. Dos
// puertas distintas al mismo privilegio.
const isSuperAdmin = esSuperAdmin;

function ensureSameTenant(doc, req, res, { resource = 'Resource' } = {}) {
  if (!doc) {
    if (res && !res.headersSent) res.status(404).json({ success: false, error: `${resource} no encontrado` });
    return false;
  }
  if (isSuperAdmin(req.user)) return true;

  const docTenant = extractTenantId(doc);
  // Siempre el tenant del usuario autenticado (cargado de BD por requireAuth).
  // Nunca req.tenantId: extractTenant lo copia de la cabecera X-Tenant-ID que
  // controla el cliente, así que permitiría abrir documentos de otro tenant.
  const userTenant = req.user?.tenantId ? String(req.user.tenantId) : null;

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

/**
 * Filtro de tenant para LISTADOS: el tenant del usuario autenticado, nunca uno
 * que venga de la peticion. Un usuario sin tenant (legacy) solo ve documentos
 * sin tenant. Lo exige utils/tenantListGuard en PUE, plazos, inspecciones,
 * comunicaciones al inspector y chat.
 */
function filtroTenant(user) {
  const tenantId = user?.tenantId || null;
  // aggregate no castea el filtro: un tenantId en string no casaria con el
  // ObjectId guardado y las estadisticas saldrian a cero.
  if (typeof tenantId === 'string' && mongoose.Types.ObjectId.isValid(tenantId)) {
    return { tenantId: new mongoose.Types.ObjectId(tenantId) };
  }
  return { tenantId };
}

/**
 * Filtro de tenant para consultas que un super_admin de plataforma puede hacer
 * sobre TODOS los tenants (gestion de usuarios, ENS, H7...). Un super_admin sin
 * tenant no se acota; cualquier otro usuario se acota a su tenant y, si no lo
 * tiene, solo a los documentos sin tenant (filtroTenant).
 *
 * Sustituye a `if (user.tenantId) filtro.tenantId = user.tenantId`, que con un
 * admin sin tenant dejaba la consulta sin ningun filtro.
 */
function filtroTenantOPlataforma(user) {
  if (isSuperAdmin(user) && !user.tenantId) return {};
  return filtroTenant(user);
}

module.exports = { ensureSameTenant, extractTenantId, isSuperAdmin, filtroTenant, filtroTenantOPlataforma };
