/**
 * Create Super Admin User for Tester
 *
 * Ejecutar: node src/scripts/createSuperAdmin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');
const Tenant = require('../models/Tenant');

const createSuperAdmin = async () => {
  try {
    await connectDB();

    const email = 'tester@strixai.es';
    const password = 'Tester2026!';
    const name = 'Tester STRIX';

    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`\n⚠ El usuario ${email} ya existe.`);
      console.log(`  ID: ${existing._id}`);
      console.log(`  Rol: ${existing.role}`);
      console.log(`  Activo: ${existing.isActive}`);
      await mongoose.connection.close();
      process.exit(0);
    }

    // Create tenant for tester
    const tenant = await Tenant.create({
      name: 'STRIX AI SL - Testing',
      slug: 'strix-ai-sl-testing',
      status: 'active',
      businessInfo: {
        type: 'customs_agent',
        nif: 'B22477020',
        eori: 'ESB22477020'
      },
      primaryContact: {
        name: name,
        email: email
      },
      subscription: {
        plan: 'enterprise',
        status: 'active',
        startDate: new Date()
      }
    });

    console.log(`\n✓ Tenant creado: ${tenant.name} (${tenant._id})`);

    // Create super admin user with ALL permissions
    const user = await User.create({
      email,
      password,
      name,
      role: 'admin',
      profile: {
        company: 'STRIX AI SL',
        position: 'QA Tester',
        eoriNumber: 'ESB22477020'
      },
      permissions: {
        canCreateExpeditions: true,
        canDeleteExpeditions: true,
        canApproveDeclarations: true,
        canManageUsers: true,
        canAccessReports: true,
        canManageCertificates: true,
        canSignDeclarations: true,
        canUploadDocuments: true,
        canConfigureSystem: true
      },
      tenantId: tenant._id,
      organizationId: tenant._id,
      isActive: true
    });

    // Set tenant owner
    tenant.owner = user._id;
    await tenant.save();

    console.log(`✓ Super Admin creado exitosamente!\n`);
    console.log(`  ┌─────────────────────────────────────┐`);
    console.log(`  │  CREDENCIALES SUPER ADMIN (TESTER)  │`);
    console.log(`  ├─────────────────────────────────────┤`);
    console.log(`  │  Email:    ${email}      │`);
    console.log(`  │  Password: ${password}           │`);
    console.log(`  │  Rol:      admin (super admin)      │`);
    console.log(`  │  Permisos: TODOS activos (9/9)      │`);
    console.log(`  │  Plan:     Enterprise               │`);
    console.log(`  └─────────────────────────────────────┘`);
    console.log(`\n  URL: https://aduanas.strixai.es`);
    console.log(`  User ID: ${user._id}`);
    console.log(`  Tenant ID: ${tenant._id}\n`);

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('\n✗ Error creando super admin:', error.message);
    if (error.code === 11000) {
      console.error('  El email ya esta registrado en el sistema.');
    }
    await mongoose.connection.close();
    process.exit(1);
  }
};

createSuperAdmin();
