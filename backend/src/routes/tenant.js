/**
 * Tenant Routes
 * Phase 6.3: Multi-Tenancy Support
 *
 * REST API routes for tenant, RBAC, and billing
 */

const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');
const {
  extractTenant,
  requireTenant,
  checkPermission,
  adminOnly,
  superAdminOnly,
  attachTenantContext
} = require('../middleware/tenantMiddleware');
const { auth } = require('../middleware/auth');

// Apply tenant extraction to all routes
router.use(extractTenant({ required: false }));
router.use(attachTenantContext);

// Contexto de tenant para las rutas que lo necesitan. El router.use de arriba
// corre antes de autenticar, asi que alli req.user no existe y no hay tenant:
// extractTenant toma el tenant del usuario autenticado (nunca de X-Tenant-ID,
// salvo un super_admin, que queda auditado). Por eso cada ruta con
// requireTenant autentica y vuelve a resolver el tenant.
const conTenant = [auth, extractTenant({ required: false })];

// =====================================================
// SUPER ADMIN - TENANT MANAGEMENT
// =====================================================

// GESTION DE TENANTS (super admin)
//
// `auth` va en cada ruta, no como router.use, porque mas abajo hay catalogos
// deliberadamente publicos (/tenant/plans, /tenant/permissions/info,
// /tenant/roles/builtin) que un router.use cerraria sin querer.
//
// Sin `auth`, req.user nunca se rellena y superAdminOnly comprueba
// `if (!req.user) return 401` ANTES de mirar el rol: estas 9 rutas devolvian
// 401 AUTH_REQUIRED incluso con un token valido. Junto con las tres cadenas
// divergentes del rol, era la segunda razon por la que la gestion de tenants
// resultaba inalcanzable.
// Create tenant (super admin)
router.post('/tenants', auth, superAdminOnly, tenantController.createTenant);

// List all tenants (super admin)
router.get('/tenants', auth, superAdminOnly, tenantController.listTenants);

// Get tenant by ID (super admin)
router.get('/tenants/:id', auth, superAdminOnly, tenantController.getTenant);

// Get tenant by slug (super admin)
router.get('/tenants/slug/:slug', auth, superAdminOnly, tenantController.getTenantBySlug);

// Update tenant (super admin)
router.put('/tenants/:id', auth, superAdminOnly, tenantController.updateTenant);

// Delete tenant (super admin)
router.delete('/tenants/:id', auth, superAdminOnly, tenantController.deleteTenant);

// Activate tenant (super admin)
router.post('/tenants/:id/activate', auth, superAdminOnly, tenantController.activateTenant);

// Suspend tenant (super admin)
router.post('/tenants/:id/suspend', auth, superAdminOnly, tenantController.suspendTenant);

// Cancel tenant (super admin)
router.post('/tenants/:id/cancel', auth, superAdminOnly, tenantController.cancelTenant);

// =====================================================
// CURRENT TENANT CONTEXT
// =====================================================

// Get current tenant
router.get('/tenant', ...conTenant, requireTenant, tenantController.getCurrentTenant);

// Get available plans
router.get('/tenant/plans', tenantController.getAvailablePlans);

// Get tenant settings
router.get('/tenant/settings', ...conTenant, requireTenant, tenantController.getTenantSettings);

// Update tenant settings (admin only)
router.put('/tenant/settings', ...conTenant, requireTenant, adminOnly, tenantController.updateTenantSettings);

// Get tenant usage stats
router.get('/tenant/usage', ...conTenant, requireTenant, tenantController.getTenantUsage);

// Change tenant plan (admin only)
router.post('/tenant/plan', ...conTenant, requireTenant, adminOnly, tenantController.changeTenantPlan);

// =====================================================
// RBAC - ROLES
// =====================================================

// Get permission info (resources, actions)
router.get('/tenant/permissions/info', tenantController.getPermissionInfo);

// Get built-in roles
router.get('/tenant/roles/builtin', tenantController.getBuiltInRoles);

// List all roles for tenant
router.get('/tenant/roles', ...conTenant, requireTenant, tenantController.listRoles);

// Get role by ID
router.get('/tenant/roles/:roleId', ...conTenant, requireTenant, tenantController.getRole);

// Create custom role (admin only)
router.post('/tenant/roles', ...conTenant, requireTenant, adminOnly, tenantController.createRole);

// Update role (admin only)
router.put('/tenant/roles/:roleId', ...conTenant, requireTenant, adminOnly, tenantController.updateRole);

// Delete role (admin only)
router.delete('/tenant/roles/:roleId', ...conTenant, requireTenant, adminOnly, tenantController.deleteRole);

// Clone role (admin only)
router.post('/tenant/roles/:roleId/clone', ...conTenant, requireTenant, adminOnly, tenantController.cloneRole);

// =====================================================
// RBAC - USER ROLES
// =====================================================

// Get user roles
router.get(
  '/tenant/users/:userId/roles',
  ...conTenant,
  requireTenant,
  checkPermission('user', 'read'),
  tenantController.getUserRoles
);

// Set user roles (replace all)
router.put(
  '/tenant/users/:userId/roles',
  ...conTenant,
  requireTenant,
  adminOnly,
  tenantController.setUserRoles
);

// Assign role to user
router.post(
  '/tenant/users/:userId/roles/:roleId',
  ...conTenant,
  requireTenant,
  adminOnly,
  tenantController.assignRole
);

// Remove role from user
router.delete(
  '/tenant/users/:userId/roles/:roleId',
  ...conTenant,
  requireTenant,
  adminOnly,
  tenantController.removeRole
);

// Get user permissions
router.get(
  '/tenant/users/:userId/permissions',
  ...conTenant,
  requireTenant,
  checkPermission('user', 'read'),
  tenantController.getUserPermissions
);

// Check specific permission
router.get(
  '/tenant/users/:userId/permissions/check',
  ...conTenant,
  requireTenant,
  tenantController.checkPermission
);

// =====================================================
// BILLING - SUBSCRIPTION
// =====================================================

// Get billing overview
router.get('/tenant/billing', ...conTenant, requireTenant, tenantController.getBillingOverview);

// Get plan pricing
router.get('/tenant/billing/pricing', tenantController.getPlanPricing);

// Get subscription
router.get('/tenant/billing/subscription', ...conTenant, requireTenant, tenantController.getSubscription);

// Update subscription
router.put(
  '/tenant/billing/subscription',
  ...conTenant,
  requireTenant,
  adminOnly,
  tenantController.updateSubscription
);

// Change plan
router.post(
  '/tenant/billing/change-plan',
  ...conTenant,
  requireTenant,
  adminOnly,
  tenantController.changeBillingPlan
);

// Cancel subscription
router.post(
  '/tenant/billing/cancel',
  ...conTenant,
  requireTenant,
  adminOnly,
  tenantController.cancelSubscription
);

// Reactivate subscription
router.post(
  '/tenant/billing/reactivate',
  ...conTenant,
  requireTenant,
  adminOnly,
  tenantController.reactivateSubscription
);

// =====================================================
// BILLING - INVOICES
// =====================================================

// List invoices
router.get(
  '/tenant/billing/invoices',
  ...conTenant,
  requireTenant,
  checkPermission('billing', 'read'),
  tenantController.listInvoices
);

// Get invoice by ID
router.get(
  '/tenant/billing/invoices/:invoiceId',
  ...conTenant,
  requireTenant,
  checkPermission('billing', 'read'),
  tenantController.getInvoice
);

// =====================================================
// BILLING - PAYMENT METHODS
// =====================================================

// List payment methods
router.get(
  '/tenant/billing/payment-methods',
  ...conTenant,
  requireTenant,
  checkPermission('billing', 'read'),
  tenantController.listPaymentMethods
);

// Add payment method
router.post(
  '/tenant/billing/payment-methods',
  ...conTenant,
  requireTenant,
  adminOnly,
  tenantController.addPaymentMethod
);

// Remove payment method
router.delete(
  '/tenant/billing/payment-methods/:methodId',
  ...conTenant,
  requireTenant,
  adminOnly,
  tenantController.removePaymentMethod
);

// Set default payment method
router.put(
  '/tenant/billing/payment-methods/:methodId/default',
  ...conTenant,
  requireTenant,
  adminOnly,
  tenantController.setDefaultPaymentMethod
);

// =====================================================
// BILLING - USAGE
// =====================================================

// Get usage summary
router.get(
  '/tenant/billing/usage',
  ...conTenant,
  requireTenant,
  checkPermission('billing', 'read'),
  tenantController.getUsageSummary
);

// Get billing statement
router.get(
  '/tenant/billing/statement',
  ...conTenant,
  requireTenant,
  checkPermission('billing', 'read'),
  tenantController.getBillingStatement
);

// =====================================================
// CUSTOMS CONFIG - EORI per country
// =====================================================

const Tenant = require('../models/Tenant');
const { ROLES } = require('../constants/roles');

/**
 * Vista del tenant que consume Ajustes (GET /tenant/me y PUT /tenant/general).
 *
 * nif/eori pueden venir cifrados (formato v1: de piiCrypto). El hook del
 * modelo ya los descifra en lecturas normales, pero se descifra aqui de forma
 * explicita para no depender solo de ese efecto implicito: en pantalla nunca
 * debe verse un valor cifrado.
 */
function vistaDelTenant(tenant) {
  const { decrypt } = require('../utils/piiCrypto');
  const businessInfo = { ...(tenant.businessInfo || {}) };
  if (businessInfo.nif) businessInfo.nif = decrypt(businessInfo.nif);
  if (businessInfo.eori) businessInfo.eori = decrypt(businessInfo.eori);
  return {
    id: String(tenant._id),
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    businessInfo,
    subscription: tenant.subscription || {},
    customsConfig: tenant.customsConfig || {},
    settings: tenant.settings || {}
  };
}

/**
 * GET /api/tenant/me
 * Devuelve el tenant del usuario autenticado leído de MongoDB (no del Map demo).
 */
router.get('/tenant/me', auth, extractTenant({ required: false }), requireTenant, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId).lean();
    if (!tenant) return res.status(404).json({ success: false, error: 'Tenant no encontrado' });
    res.json({ success: true, data: vistaDelTenant(tenant) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Solo el administrador del tenant (o el super_admin de plataforma) cambia los
 * datos de la empresa o da de alta usuarios. Es el mismo criterio que
 * POST /api/auth/admin/invite. adminOnly no sirve aqui: deja pasar tambien al
 * supervisor.
 */
const soloAdministradorDelTenant = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'No autenticado.' });
  if (![ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Solo un administrador de la organización puede cambiar estos datos.' });
  }
  next();
};

/**
 * Campos de Ajustes › General que se guardan, con su longitud maxima. Las
 * longitudes de la direccion son las del declarante en los mensajes de la AEAT
 * (calle 70, ciudad 35, codigo postal 17): el H7 toma de aqui la direccion del
 * declarante.
 *
 * NO se editan aqui:
 *  - businessInfo.eori: tiene su pantalla (Ajustes › Aduanas, PUT /tenant/eori).
 *  - businessInfo.nif: dato fiscal, cifrado en la BD y con hash para busquedas;
 *    cambiarlo es una operacion de soporte, no un ajuste.
 *  - businessInfo.type: decide si el tenant actua como parte o como
 *    representante ante la AEAT (aeatSubmitService._tenantEsLaParte).
 *  - slug: identifica al tenant.
 */
const CAMPOS_GENERALES = ['name', 'rea', 'address'];
const MAX_DIRECCION = { street: 70, city: 35, province: 35, postalCode: 17 };
const MAX_NOMBRE = 70;
const MAX_REA = 35;

/** Texto recortado, o undefined si no es una cadena (un objeto, un numero...). */
const texto = (valor) => (typeof valor === 'string' ? valor.trim() : undefined);

/** Valida el body de PUT /tenant/general y lo traduce a un $set. */
function cambiosGenerales(body) {
  const errores = [];
  const cambios = {};
  const noEditables = Object.keys(body).filter(k => !CAMPOS_GENERALES.includes(k));
  if (noEditables.length > 0) {
    errores.push(`Estos campos no se editan desde Ajustes › General: ${noEditables.join(', ')}`);
  }

  if (body.name !== undefined) {
    const nombre = texto(body.name);
    if (!nombre || nombre.length > MAX_NOMBRE) errores.push(`El nombre de la organización es obligatorio (hasta ${MAX_NOMBRE} caracteres)`);
    else cambios.name = nombre;
  }
  if (body.rea !== undefined) {
    const rea = texto(body.rea);
    if (rea === undefined || rea.length > MAX_REA) errores.push(`El REA no es válido (hasta ${MAX_REA} caracteres)`);
    else cambios['businessInfo.rea'] = rea;
  }
  if (body.address !== undefined) {
    const dir = body.address;
    if (!dir || typeof dir !== 'object' || Array.isArray(dir)) {
      errores.push('La dirección no es válida');
    } else {
      for (const [campo, max] of Object.entries(MAX_DIRECCION)) {
        const valor = dir[campo] === undefined || dir[campo] === null ? '' : texto(dir[campo]);
        if (valor === undefined || valor.length > max) errores.push(`La dirección (${campo}) no es válida (hasta ${max} caracteres)`);
        else cambios[`businessInfo.address.${campo}`] = valor;
      }
      const pais = (texto(dir.country) || '').toUpperCase();
      if (!/^[A-Z]{2}$/.test(pais)) errores.push('El país de la dirección ha de ser un código ISO de dos letras (p. ej. ES)');
      else cambios['businessInfo.address.country'] = pais;
    }
  }
  return { errores, cambios };
}

/**
 * PUT /api/tenant/general
 * Body: { name?, rea?, address?: { street, city, province, postalCode, country } }
 *
 * Acotado al tenant del token (req.tenantId lo resuelve extractTenant desde el
 * usuario autenticado, nunca desde X-Tenant-ID salvo super_admin).
 */
router.put('/tenant/general', auth, extractTenant({ required: false }), requireTenant, soloAdministradorDelTenant, async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const { errores, cambios } = cambiosGenerales(body);
    if (errores.length > 0) return res.status(400).json({ success: false, error: errores.join('. '), errors: errores });
    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({ success: false, error: 'No hay cambios que guardar' });
    }

    // Update directo con $set de rutas concretas: no pasa por el pre('save')
    // (no recifra ni recalcula hashes) y no toca nif/eori, que siguen como
    // esten guardados, cifrados o no.
    const r = await Tenant.updateOne({ _id: req.tenantId }, { $set: cambios }, { runValidators: false });
    if (r.matchedCount === 0) return res.status(404).json({ success: false, error: 'Tenant no encontrado' });

    res.json({ success: true, data: vistaDelTenant(await Tenant.findById(req.tenantId).lean()) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Quien ve los recuentos de usuarios por rol: los que ven Ajustes › Roles con
 * capacidad de gestion o supervision. Un agente o un consultor no necesita
 * saber cuantos usuarios hay en la organizacion.
 */
const ROLES_QUE_VEN_RECUENTOS = [ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.SUPERVISOR];

/**
 * GET /api/tenant/users/role-counts
 * Usuarios ACTIVOS del tenant por rol: { counts: { admin, supervisor, agent, viewer }, total }.
 *
 * Acotado al tenant del token (req.tenantId). Solo los roles de tenant
 * (DE_TENANT): super_admin es de plataforma y no se lista como rol de la
 * organizacion. aggregate() no castea a ObjectId como find(): se castea aqui.
 */
router.get('/tenant/users/role-counts', auth, extractTenant({ required: false }), requireTenant, async (req, res) => {
  try {
    if (!ROLES_QUE_VEN_RECUENTOS.includes(req.user?.role)) {
      return res.status(403).json({ success: false, error: 'No tienes permisos para esta accion.' });
    }
    const mongoose = require('mongoose');
    const User = require('../models/User');
    const { DE_TENANT } = require('../constants/roles');
    if (!mongoose.Types.ObjectId.isValid(String(req.tenantId))) {
      return res.status(400).json({ success: false, error: 'Tenant no valido' });
    }

    const filas = await User.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(String(req.tenantId)),
          isActive: { $ne: false },
          role: { $in: [...DE_TENANT] }
        }
      },
      { $group: { _id: '$role', n: { $sum: 1 } } }
    ]);

    const counts = Object.fromEntries(DE_TENANT.map(rol => [rol, 0]));
    for (const fila of filas) counts[fila._id] = fila.n;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    res.json({ success: true, data: { counts, total } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/tenant/eori
 * EORI por pais del tenant.
 */
router.get('/tenant/eori', auth, extractTenant({ required: false }), requireTenant, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ success: false, error: 'Tenant no encontrado' });

    res.json({
      success: true,
      data: {
        eoriNumbers: tenant.customsConfig?.eoriNumbers || {},
        defaultEori: tenant.businessInfo?.eori || '',
        country: tenant.customsConfig?.country || 'ES'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const MEDIOS_DE_PAGO_H1 = ['A', 'R', 'J'];
const FORMATO_GRN = /^\d{2}[A-Z]{2}[A-Z0-9]{12}\d([A-Z]\d{6})?$/;

const presentacionH1De = (tenant) => ({
  h1Service: tenant.customsConfig?.h1Service || 'precau',
  medioDePago: tenant.customsConfig?.medioDePago || 'A',
  garantiaGRN: tenant.customsConfig?.garantiaGRN || '',
  contacto: {
    name: tenant.primaryContact?.name || '',
    phone: tenant.primaryContact?.phone || '',
    email: tenant.primaryContact?.email || ''
  }
});

/**
 * GET /api/tenant/h1
 * Como presenta el tenant el H1: servicio, medio de pago, garantia y persona de contacto.
 */
router.get('/tenant/h1', auth, extractTenant({ required: false }), requireTenant, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId).lean();
    if (!tenant) return res.status(404).json({ success: false, error: 'Tenant no encontrado' });
    res.json({ success: true, data: presentacionH1De(tenant) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/tenant/h1
 * Body: { h1Service, medioDePago, garantiaGRN, contacto: { name, phone, email } }
 */
router.put('/tenant/h1', auth, extractTenant({ required: false }), requireTenant, adminOnly, async (req, res) => {
  try {
    const { h1Service, medioDePago, garantiaGRN, contacto } = req.body || {};
    const errores = [];
    const cambios = {};

    if (h1Service !== undefined) {
      if (!['precau', 'cau'].includes(h1Service)) errores.push('Servicio del H1 no válido');
      else cambios['customsConfig.h1Service'] = h1Service;
    }
    const grn = garantiaGRN === undefined ? undefined : String(garantiaGRN).trim().toUpperCase();
    if (grn !== undefined) {
      if (grn && !FORMATO_GRN.test(grn)) errores.push('El número de garantía (GRN) no tiene el formato esperado (17 o 24 caracteres)');
      else cambios['customsConfig.garantiaGRN'] = grn;
    }
    if (medioDePago !== undefined) {
      if (!MEDIOS_DE_PAGO_H1.includes(medioDePago)) errores.push('Medio de pago no válido (A, R o J)');
      else cambios['customsConfig.medioDePago'] = medioDePago;
    }
    if (contacto !== undefined) {
      const nombre = String(contacto?.name || '').trim();
      const telefono = String(contacto?.phone || '').trim();
      const email = String(contacto?.email || '').trim();
      if (!nombre || nombre.length > 70) errores.push('El nombre de la persona de contacto es obligatorio (hasta 70 caracteres)');
      if (!telefono || telefono.length > 35) errores.push('El teléfono de contacto es obligatorio (hasta 35 caracteres)');
      if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) errores.push('El correo de contacto no es válido');
      cambios['primaryContact.name'] = nombre;
      cambios['primaryContact.phone'] = telefono;
      cambios['primaryContact.email'] = email;
    }
    if (errores.length > 0) return res.status(400).json({ success: false, error: errores.join('. '), errors: errores });

    const tenant = await Tenant.findById(req.tenantId).lean();
    if (!tenant) return res.status(404).json({ success: false, error: 'Tenant no encontrado' });
    // El pago aplazado exige garantia: no se guarda una combinacion que la AEAT rechazaria.
    const medioFinal = cambios['customsConfig.medioDePago'] ?? tenant.customsConfig?.medioDePago ?? 'A';
    const grnFinal = cambios['customsConfig.garantiaGRN'] ?? tenant.customsConfig?.garantiaGRN ?? '';
    if (medioFinal === 'R' && !grnFinal) {
      return res.status(400).json({ success: false, error: 'El pago aplazado (R) exige un número de garantía (GRN)' });
    }

    // Update directo (sin .save()) para no revalidar campos antiguos del tenant.
    if (Object.keys(cambios).length > 0) {
      await Tenant.updateOne({ _id: req.tenantId }, { $set: cambios }, { runValidators: false });
    }
    res.json({ success: true, data: presentacionH1De(await Tenant.findById(req.tenantId).lean()) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/tenant/eori
 * Update EORI numbers per country
 * Body: { eoriNumbers: { ES: 'ESxxx', NL: 'NLxxx' } }
 */
router.put('/tenant/eori', auth, extractTenant({ required: false }), requireTenant, adminOnly, async (req, res) => {
  try {
    const { eoriNumbers } = req.body;
    if (!eoriNumbers || typeof eoriNumbers !== 'object') {
      return res.status(400).json({ success: false, error: 'eoriNumbers object requerido' });
    }

    // Validate EORI format per country
    const validCountries = ['ES', 'NL', 'BE', 'DE', 'FR', 'PT', 'IT'];
    const errors = [];
    for (const [country, eori] of Object.entries(eoriNumbers)) {
      if (!validCountries.includes(country)) {
        errors.push(`Pais no soportado: ${country}`);
        continue;
      }
      if (eori && !eori.startsWith(country)) {
        errors.push(`EORI de ${country} debe comenzar con ${country} (recibido: ${eori})`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ success: false, error: 'Tenant no encontrado' });

    // El frontend (TenantSettings.jsx CustomsTab) manda siempre el mapa COMPLETO
    // de paises que quedan activos tras el toggle: si aqui se fusionaba con lo
    // que ya habia guardado, el EORI de un pais recien desactivado nunca se
    // borraba porque el merge solo sobreescribe las claves que llegan, nunca
    // quita las que faltan. Se sustituye el mapa entero por el recibido.
    const merged = { ...eoriNumbers };

    // Update directo en MongoDB (sin .save() para no revalidar campos legacy
    // como slug que pueden faltar en tenants creados antes del schema actual).
    await Tenant.updateOne(
      { _id: req.tenantId },
      { $set: { 'customsConfig.eoriNumbers': merged } },
      { runValidators: false }
    );

    res.json({
      success: true,
      data: { eoriNumbers: merged }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
