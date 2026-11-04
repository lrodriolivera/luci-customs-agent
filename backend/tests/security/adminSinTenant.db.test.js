/**
 * Un admin SIN tenantId (usuario legacy) no puede ver ni tocar datos de otro
 * tenant.
 *
 * Patron que se corrige: `if (user.tenantId) query.tenantId = user.tenantId`.
 * Sin tenant la clave no se anade, y como 'admin' tampoco anade createdBy, la
 * consulta queda sin ningun filtro y devuelve los documentos de TODOS los
 * tenants. Se usa filtroTenant(), que con un usuario sin tenant acota a
 * `tenantId: null` (solo documentos sin tenant).
 *
 * Sitios: busquedas ENS por contenedor y B/L, listado ENS, listado y
 * estadisticas H7, y listUsers/updateUser/adminDisableUser.
 *
 * BD en memoria efimera, NUNCA produccion.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/services/emailService', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../src/services/aeat/aeatSubmitService', () => ({
  submitH7: jest.fn()
}));

const { User, H7Declaration } = require('../../src/models');
const ENSDeclaration = require('../../src/models/ENSDeclaration');
const ensService = require('../../src/services/ensService');
const ensController = require('../../src/controllers/ensController');
const h7Controller = require('../../src/controllers/h7Controller');
const authController = require('../../src/controllers/authController');

usarBaseDeDatosEnMemoria();

function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.type = () => res;
  res.send = (b) => { res.body = b; return res; };
  return res;
}

let contador = 0;
async function crearUsuario({ tenantId, role }) {
  contador += 1;
  return User.create({
    name: `Usuario ${contador}`,
    email: `sintenant${contador}@ejemplo.es`,
    password: 'Password123!',
    role,
    ...(tenantId ? { tenantId } : {})
  });
}

const enHoras = (h) => new Date(Date.now() + h * 60 * 60 * 1000);
function datosENS(containerNumber) {
  return {
    transportMode: 'SEA',
    entryOffice: { code: 'ES002801', name: 'Algeciras', expectedArrival: enHoras(48) },
    carrier: { eori: 'ESB12345678', name: 'Naviera SL' },
    transportMeans: { identification: 'IMO9999999', identificationType: 'VESSEL_IMO', modeAtBorder: '1' },
    consignment: {
      referenceNumber: 'MBL-VICTIMA', referenceType: 'MBL', grossMass: 1000,
      numberOfPackages: 10, goodsDescription: 'Mercancia general', countryOfDispatch: 'CN',
      containerNumber
    },
    goods: [{ sequenceNumber: 1, description: 'Camisetas', commodityCode: '610910', grossMass: 500, numberOfPackages: 10 }]
  };
}

async function crearH7(user) {
  contador += 1;
  return H7Declaration.create({
    tenantId: user.tenantId,
    createdBy: user._id,
    operationType: 'B2C',
    trackingNumber: `TRK-VICTIMA-${contador}`,
    carrier: { code: 'UPS', name: 'UPS' },
    sender: { name: 'Vendedor SL', address: { country: 'CN' } },
    recipient: {
      name: 'Juan Perez',
      taxId: '12345678Z',
      address: { street: 'Calle Mayor 1', city: 'Madrid', postalCode: '28001', country: 'ES' }
    },
    items: [{
      description: 'Auriculares', taricCode: '85183000', quantity: 1,
      unitValue: 30, totalValue: 30, netWeight: 0.2, countryOfOrigin: 'CN'
    }],
    totals: { intrinsicValue: 30, customsValue: 30, grossWeight: 0.3, netWeight: 0.2 },
    status: 'draft'
  });
}

let TENANT_VICTIMA, victima, atacante;

beforeEach(async () => {
  TENANT_VICTIMA = new mongoose.Types.ObjectId();
  victima = await crearUsuario({ tenantId: TENANT_VICTIMA, role: 'agent' });
  atacante = await crearUsuario({ role: 'admin' });
  expect(atacante.tenantId).toBeUndefined();
});

describe('ENS: admin sin tenant', () => {
  beforeEach(async () => {
    const r = await ensService.createDeclaration(datosENS('MSCU7654321'), victima._id);
    expect(r.success).toBe(true);
    const ens = await ENSDeclaration.findById(r.data._id).lean();
    expect(String(ens.tenantId)).toBe(String(TENANT_VICTIMA));
  });

  test('la busqueda por contenedor no devuelve ENS de otro tenant', async () => {
    const res = crearRes();
    await ensController.searchByContainer({ user: atacante, params: { container: 'MSCU7654321' }, query: {} }, res);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  test('la busqueda por B/L no devuelve ENS de otro tenant', async () => {
    const res = crearRes();
    await ensController.searchByBOL({ user: atacante, params: { bol: 'MBL-VICTIMA' }, query: {} }, res);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  test('el listado no devuelve ENS de otro tenant', async () => {
    const res = crearRes();
    await ensController.list({ user: atacante, params: {}, query: {} }, res);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });
});

describe('H7: admin sin tenant', () => {
  beforeEach(async () => {
    await crearH7(victima);
  });

  test('el listado no devuelve H7 de otro tenant', async () => {
    const res = crearRes();
    await h7Controller.list({ user: atacante, query: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  test('las estadisticas no cuentan H7 de otro tenant', async () => {
    const res = crearRes();
    await h7Controller.getStats({ user: atacante, query: {} }, res);
    expect(res.statusCode).toBe(200);
    const total = res.body.data.byStatus.reduce((s, x) => s + x.count, 0);
    expect(total).toBe(0);
  });
});

describe('Usuarios: admin sin tenant', () => {
  test('listUsers no devuelve usuarios de otro tenant', async () => {
    const res = crearRes();
    await authController.listUsers({ user: atacante, query: {} }, res);
    expect(res.body.success).toBe(true);
    const emails = res.body.data.users.map(u => u.email);
    expect(emails).not.toContain(victima.email);
  });

  test('updateUser no modifica a un usuario de otro tenant', async () => {
    const res = crearRes();
    await authController.updateUser({
      user: atacante, params: { id: String(victima._id) }, body: { name: 'Secuestrado' }
    }, res);
    expect(res.statusCode).toBe(404);
    const recargado = await User.findById(victima._id).lean();
    expect(recargado.name).not.toBe('Secuestrado');
  });

  test('adminDisableUser no desactiva a un usuario de otro tenant', async () => {
    const res = crearRes();
    await authController.adminDisableUser({ user: atacante, params: { id: String(victima._id) } }, res);
    expect(res.statusCode).toBe(404);
    const recargado = await User.findById(victima._id).lean();
    expect(recargado.isActive).not.toBe(false);
  });
});

describe('guard estatico', () => {
  // `if (x.tenantId) filtro.tenantId = x.tenantId` deja la consulta sin tenant
  // cuando el usuario no lo tiene. _searchScope de ENS lo copio del listado en
  // la misma rama que cerraba las fugas de tenant: que no vuelva a entrar.
  test('ningun filtro asigna tenantId solo si el usuario lo tiene', () => {
    const fs = require('fs');
    const path = require('path');
    const patron = /if\s*\(\s*(?:req\.)?user\??\.tenantId\s*\)\s*\w+(?:\.tenantId|\[['"]tenantId['"]\])\s*=/;
    const encontrados = [];
    const recorrer = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) recorrer(p);
        else if (p.endsWith('.js')) {
          fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
            const codigo = l.trim();
            if (codigo.startsWith('*') || codigo.startsWith('//')) return;
            if (patron.test(l)) encontrados.push(`${path.relative(process.cwd(), p)}:${i + 1}`);
          });
        }
      }
    };
    recorrer(path.join(__dirname, '../../src'));
    expect(encontrados).toEqual([]);
  });
});

describe('super_admin de plataforma sin tenant', () => {
  // filtroTenantOPlataforma: el super_admin sin tenant conserva la vista
  // global (panel de plataforma). Solo se cierra para los demas roles.
  test('sigue viendo y gestionando los usuarios de todos los tenants', async () => {
    const superAdmin = await crearUsuario({ role: 'super_admin' });

    const resUsuarios = crearRes();
    await authController.listUsers({ user: superAdmin, query: {} }, resUsuarios);
    expect(resUsuarios.body.data.users.map(u => u.email)).toContain(victima.email);

    const resUpdate = crearRes();
    await authController.updateUser({
      user: superAdmin, params: { id: String(victima._id) }, body: { name: 'Renombrado por plataforma' }
    }, resUpdate);
    expect(resUpdate.statusCode).toBe(200);
  });
});
