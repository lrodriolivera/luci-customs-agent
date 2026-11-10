/**
 * Crea un usuario dentro de una organizacion (tenant) EXISTENTE.
 *
 * Hace falta porque POST /api/auth/admin/invite depende de Cognito (retirado) y
 * ninguna pantalla lo llama: hoy no hay forma de añadir usuarios a un tenant ya
 * creado desde la aplicacion. /register crea siempre un tenant nuevo.
 *
 * Uso (dentro del contenedor del backend o con MONGODB_URI en el entorno):
 *   NUEVO_USUARIO_PASSWORD='...' node src/scripts/crearUsuarioEnTenant.js \
 *     --email patricia@ejemplo.com --nombre "Patricia Mori Melero" \
 *     [--tenant-slug strix-ai-sl-testing] [--rol agent|supervisor|admin|viewer] \
 *     [--cargo "Agente de aduanas"] [--reset-password]
 *
 * La contrasena SOLO se lee de NUEVO_USUARIO_PASSWORD y nunca se imprime.
 * Idempotente: si el usuario ya existe no lo toca, salvo con --reset-password.
 * El perfil toma empresa y EORI del tenant (businessInfo.eori, descifrado por el
 * hook de lectura del modelo), que es lo que identifica al declarante en H1/AES/H7.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { DE_TENANT, AGENT, ADMIN, SUPERVISOR } = require('../constants/roles');

const PERMISOS_POR_ROL = (rol) => ({
  canCreateExpeditions: true,
  canUploadDocuments: true,
  canAccessReports: rol === ADMIN || rol === SUPERVISOR,
  canDeleteExpeditions: rol === ADMIN,
  canApproveDeclarations: rol === ADMIN || rol === SUPERVISOR,
  canManageUsers: rol === ADMIN,
  canManageCertificates: rol === ADMIN,
  canSignDeclarations: rol === ADMIN,
  canConfigureSystem: rol === ADMIN
});

function argumentos(argv) {
  const a = { 'tenant-slug': 'strix-ai-sl-testing', rol: AGENT, cargo: '', 'reset-password': false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const clave = k.slice(2);
    if (clave === 'reset-password') { a[clave] = true; continue; }
    a[clave] = argv[++i];
  }
  return a;
}

async function main() {
  const a = argumentos(process.argv.slice(2));
  const password = process.env.NUEVO_USUARIO_PASSWORD;
  const email = (a.email || '').trim().toLowerCase();
  if (!email || !a.nombre) throw new Error('Faltan --email y/o --nombre');
  if (!DE_TENANT.includes(a.rol)) throw new Error(`Rol no valido: ${a.rol} (admitidos: ${DE_TENANT.join(', ')})`);
  if (!password || password.length < 12) throw new Error('NUEVO_USUARIO_PASSWORD ausente o de menos de 12 caracteres');

  await connectDB();
  try {
    const tenant = await Tenant.findOne({ slug: a['tenant-slug'] });
    if (!tenant) throw new Error(`No existe el tenant con slug ${a['tenant-slug']}`);
    const eoriTenant = tenant.customsConfig?.eoriNumbers?.ES || tenant.businessInfo?.eori || '';
    console.log(`Tenant: ${tenant.name} (${tenant._id}) | EORI ES: ${eoriTenant ? 'configurado' : 'SIN CONFIGURAR'}`);

    const existente = await User.findOne({ email }).select('+password');
    if (existente) {
      if (String(existente.tenantId) !== String(tenant._id)) {
        throw new Error(`${email} ya existe en OTRO tenant (${existente.tenantId}); no se toca`);
      }
      if (!a['reset-password']) {
        console.log(`• ${email} ya existe en este tenant (rol ${existente.role}, activo: ${existente.isActive}); sin cambios. Use --reset-password para cambiar la contrasena.`);
        return;
      }
      existente.password = password;
      existente.isActive = true;
      await existente.save();
      console.log(`✓ Contrasena restablecida y cuenta activa: ${email}`);
      return;
    }

    const [givenName, ...resto] = a.nombre.trim().split(/\s+/);
    const user = await User.create({
      email,
      password,
      name: a.nombre.trim(),
      givenName,
      familyName: resto.join(' ') || undefined,
      role: a.rol,
      profile: { company: tenant.name, position: a.cargo || undefined, eoriNumber: eoriTenant || undefined },
      permissions: PERMISOS_POR_ROL(a.rol),
      tenantId: tenant._id,
      organizationId: tenant._id,
      isActive: true
    });
    console.log(`✓ Usuario creado: ${user.email} | rol ${user.role} | tenant ${tenant.slug} | activo`);
    console.log('  La contrasena es la de NUEVO_USUARIO_PASSWORD; entreguesela al usuario por un canal seguro y pidale que la cambie.');
  } finally {
    await mongoose.connection.close();
  }
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
