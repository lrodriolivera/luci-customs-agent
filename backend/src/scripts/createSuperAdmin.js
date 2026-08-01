/**
 * Create Super Admin Users (STRIX AI)
 *
 * Ejecutar: node src/scripts/createSuperAdmin.js
 *
 * Idempotente: se puede reejecutar tras un re-seed. Reutiliza el tenant de
 * testing si existe y crea/omite cada usuario segun ya exista o no.
 * NOTA: las contrasenas aqui son de arranque; los usuarios deberian cambiarlas.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');
const Tenant = require('../models/Tenant');

// Permisos completos (9/9) para un admin de STRIX
const ALL_PERMISSIONS = {
  canCreateExpeditions: true,
  canDeleteExpeditions: true,
  canApproveDeclarations: true,
  canManageUsers: true,
  canAccessReports: true,
  canManageCertificates: true,
  canSignDeclarations: true,
  canUploadDocuments: true,
  canConfigureSystem: true
};

// Usuarios admin de STRIX AI. El primero se usa como owner del tenant.
// Las contrasenas se leen del .env (gitignored). El fallback solo aplica en
// entornos sin esas variables; en prod deben venir de SUPERADMIN_*_PASSWORD.
const ADMINS = [
  { email: 'tester@strixai.es',         password: process.env.SUPERADMIN_TESTER_PASSWORD  || 'Tester2026!',    name: 'Tester STRIX',   position: 'QA Tester' },
  { email: 'luis.rodriguez@strixai.es', password: process.env.SUPERADMIN_LUIS_PASSWORD    || 'ChangeMe2026!', name: 'Luis Rodriguez', position: 'Tech Lead' },
  { email: 'jenifer.romero@strixai.es', password: process.env.SUPERADMIN_JENIFER_PASSWORD || 'ChangeMe2026!', name: 'Jenifer Romero', position: 'CEO' }
];

const createSuperAdmins = async () => {
  try {
    await connectDB();

    // Reutilizar el tenant de testing o crearlo
    let tenant = await Tenant.findOne({ slug: 'strix-ai-sl-testing' });
    if (!tenant) {
      tenant = await Tenant.create({
        name: 'STRIX AI SL - Testing',
        slug: 'strix-ai-sl-testing',
        status: 'active',
        businessInfo: { type: 'customs_agent', nif: 'B22477020', eori: 'ESB22477020' },
        primaryContact: { name: ADMINS[0].name, email: ADMINS[0].email },
        subscription: { plan: 'enterprise', status: 'active', startDate: new Date() }
      });
      console.log(`\n✓ Tenant creado: ${tenant.name} (${tenant._id})`);
    } else {
      console.log(`\n• Tenant existente: ${tenant.name} (${tenant._id})`);
    }

    let ownerId = tenant.owner;

    for (const a of ADMINS) {
      const existing = await User.findOne({ email: a.email });
      if (existing) {
        console.log(`  • ${a.email} ya existe (rol: ${existing.role}) — omitido`);
        if (!ownerId) ownerId = existing._id;
        continue;
      }
      const user = await User.create({
        email: a.email,
        password: a.password,
        name: a.name,
        role: 'admin',
        profile: { company: 'STRIX AI SL', position: a.position, eoriNumber: 'ESB22477020' },
        permissions: ALL_PERMISSIONS,
        tenantId: tenant._id,
        organizationId: tenant._id,
        isActive: true
      });
      if (!ownerId) ownerId = user._id;
      console.log(`  ✓ ${a.email} creado (admin, 9/9 permisos)`);
    }

    // Asegurar owner del tenant
    if (ownerId && String(tenant.owner) !== String(ownerId)) {
      tenant.owner = ownerId;
      await tenant.save();
    }

    console.log(`\n✓ Listo. URL: https://aduanas.strixai.es`);
    console.log(`  Tenant ID: ${tenant._id}\n`);

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('\n✗ Error creando super admins:', error.message);
    if (error.code === 11000) {
      console.error('  Email duplicado en el sistema.');
    }
    await mongoose.connection.close();
    process.exit(1);
  }
};

createSuperAdmins();
