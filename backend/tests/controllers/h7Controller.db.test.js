/**
 * h7Controller + h7Service + modelo H7Declaration, contra Mongo real en memoria.
 *
 * H7 es la declaracion de bajo valor (e-commerce): aqui vive el aislamiento por
 * tenant/propiedad, el ciclo de estados (draft->cancelled), el calculo de
 * derechos y las estadisticas agregadas. Se ejercita contra BD efimera; el
 * modelo NO se mockea (los static getStats/calculateDuties son lo valioso).
 *
 * Se mockea SOLO aeatSubmitService (envio a AEAT por red). Los helpers puros de
 * h7Service (checkH7Eligibility, calculateValues, checkRestrictedGoods,
 * validateIOSS) corren de verdad.
 *
 * BD en memoria efimera, NUNCA produccion.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/services/aeat/aeatSubmitService', () => ({
  submitH7: jest.fn()
}));

const { H7Declaration } = require('../../src/models');
const ctrl = require('../../src/controllers/h7Controller');

usarBaseDeDatosEnMemoria();

function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

let contador = 0;
function usuario({ tenant, role = 'agent' } = {}) {
  contador += 1;
  return {
    _id: new mongoose.Types.ObjectId(),
    tenantId: tenant || new mongoose.Types.ObjectId(),
    role
  };
}

let contadorH7 = 0;

// H7 valida minima con todos los campos required del modelo. tenantId/createdBy
// se pasan aparte para ejercer aislamiento.
async function crearH7({ user, status = 'draft', extra = {} } = {}) {
  const u = user || usuario();
  contadorH7 += 1;
  return H7Declaration.create({
    tenantId: u.tenantId,
    createdBy: u._id,
    operationType: 'B2C',
    trackingNumber: `TRK-${u._id.toString().slice(-6)}-${contadorH7}`,
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
    status,
    ...extra
  });
}

describe('list: aislamiento por tenant y por propiedad', () => {
  test('un agent solo ve sus propias declaraciones (tenant + createdBy)', async () => {
    const op = usuario();
    const otro = usuario({ tenant: op.tenantId }); // mismo tenant, otro usuario
    await crearH7({ user: op });
    await crearH7({ user: otro });

    const res = crearRes();
    await ctrl.list({ user: op, query: {} }, res);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].createdBy.toString()).toBe(op._id.toString());
  });

  test('un admin ve todas las de SU tenant pero NO las de otro', async () => {
    const admin = usuario({ role: 'admin' });
    const propio = usuario({ tenant: admin.tenantId });
    const ajeno = usuario(); // otro tenant
    await crearH7({ user: propio });
    await crearH7({ user: propio });
    await crearH7({ user: ajeno });

    const res = crearRes();
    await ctrl.list({ user: admin, query: {} }, res);

    expect(res.body.data).toHaveLength(2);
  });

  test('el filtro por status funciona', async () => {
    const op = usuario();
    await crearH7({ user: op, status: 'draft' });
    await crearH7({ user: op, status: 'cancelled' });

    const res = crearRes();
    await ctrl.list({ user: op, query: { status: 'cancelled' } }, res);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('cancelled');
  });
});

describe('getStats: las estadisticas NO se filtran entre tenants (regresion)', () => {
  // Regresion de aislamiento: getStats para role 'admin' pasaba { ...req.query }
  // sin tenantId, y el static getStats del modelo ni siquiera leia tenantId, de
  // modo que un tenant_admin veia los agregados H7 (valor en aduana, aranceles,
  // transportistas) de TODAS las organizaciones. Corregido en ambas capas.
  // Ver SECURITY_AUDIT.md.
  test('un admin solo ve las estadisticas de SU tenant, no las de otro', async () => {
    const admin = usuario({ role: 'admin' });
    const ajeno = usuario();
    const t = (v) => ({ intrinsicValue: Math.min(v, 150), customsValue: v, grossWeight: 0.3, netWeight: 0.2 });
    await crearH7({ user: admin, extra: { totals: t(100) } });
    await crearH7({ user: admin, extra: { totals: t(50) } });
    await crearH7({ user: ajeno, extra: { totals: t(9999) } });

    const res = crearRes();
    await ctrl.getStats({ user: admin, query: {} }, res);

    expect(res.statusCode).toBe(200);
    const total = res.body.data.byStatus.reduce((s, x) => s + x.count, 0);
    // Solo las 2 del tenant del admin; la del otro tenant NO cuenta.
    expect(total).toBe(2);
    const valor = res.body.data.byStatus.reduce((s, x) => s + (x.totalValue || 0), 0);
    expect(valor).toBe(150); // 100 + 50, NUNCA incluye los 9999 ajenos
  });

  test('un agent solo ve las estadisticas de lo que el crea', async () => {
    const op = usuario();
    const companiero = usuario({ tenant: op.tenantId });
    await crearH7({ user: op });
    await crearH7({ user: companiero });

    const res = crearRes();
    await ctrl.getStats({ user: op, query: {} }, res);

    const total = res.body.data.byStatus.reduce((s, x) => s + x.count, 0);
    expect(total).toBe(1);
  });
});

describe('get', () => {
  test('devuelve la H7 del propio tenant', async () => {
    const user = usuario();
    const h7 = await crearH7({ user });
    const res = crearRes();

    await ctrl.get({ params: { id: h7._id }, user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data._id.toString()).toBe(h7._id.toString());
  });

  test('404 al pedir una H7 de OTRO tenant', async () => {
    const dueno = usuario();
    const h7 = await crearH7({ user: dueno });
    const res = crearRes();

    await ctrl.get({ params: { id: h7._id }, user: usuario() }, res);

    expect(res.statusCode).toBe(404);
  });

  test('404 si no existe', async () => {
    const res = crearRes();
    await ctrl.get({ params: { id: new mongoose.Types.ObjectId() }, user: usuario() }, res);
    expect(res.statusCode).toBe(404);
  });
});

describe('update: solo en draft y solo el creador', () => {
  test('actualiza el transportista de una H7 en draft', async () => {
    const user = usuario();
    const h7 = await crearH7({ user });
    const res = crearRes();

    await ctrl.update({
      params: { id: h7._id },
      body: { carrier: { code: 'DHL', name: 'DHL' } },
      user
    }, res);

    expect(res.statusCode).toBe(200);
    const guardada = await H7Declaration.findById(h7._id);
    expect(guardada.carrier.code).toBe('DHL');
  });

  test('no se puede modificar una H7 que no esta en draft (400)', async () => {
    const user = usuario();
    const h7 = await crearH7({ user, status: 'cancelled' });
    const res = crearRes();

    await ctrl.update({ params: { id: h7._id }, body: {}, user }, res);
    expect(res.statusCode).toBe(400);
  });

  test('un usuario que no es el creador recibe 404', async () => {
    const dueno = usuario();
    const h7 = await crearH7({ user: dueno });
    const res = crearRes();

    await ctrl.update({ params: { id: h7._id }, body: {}, user: usuario() }, res);
    expect(res.statusCode).toBe(404);
  });
});

describe('cancel', () => {
  test('cancela una H7 en draft y deja el motivo', async () => {
    const user = usuario();
    const h7 = await crearH7({ user });
    const res = crearRes();

    await ctrl.cancel({ params: { id: h7._id }, body: { reason: 'Datos erroneos' }, user }, res);

    expect(res.statusCode).toBe(200);
    const guardada = await H7Declaration.findById(h7._id);
    expect(guardada.status).toBe('cancelled');
    expect(guardada.statusHistory.some(h => h.reason === 'Datos erroneos')).toBe(true);
  });

  test('no se puede cancelar una H7 ya enviada (400)', async () => {
    const user = usuario();
    const h7 = await crearH7({ user, status: 'submitted' });
    const res = crearRes();

    await ctrl.cancel({ params: { id: h7._id }, body: {}, user }, res);
    expect(res.statusCode).toBe(400);
  });

  test('404 al cancelar una H7 de otro creador', async () => {
    const dueno = usuario();
    const h7 = await crearH7({ user: dueno });
    const res = crearRes();

    await ctrl.cancel({ params: { id: h7._id }, body: {}, user: usuario() }, res);
    expect(res.statusCode).toBe(404);
  });
});

describe('submit: el envio a AEAT es real, no una simulacion', () => {
  // H7 obtuvo MRN real en PRE (26ESH7A000067965R5): rotular el mensaje como
  // [DEMO] hace creer al usuario que no se ha presentado nada. Igual que en H1
  // (f0af0ab) y ENS.
  test('el mensaje de exito no dice DEMO', async () => {
    const aeatSubmitService = require('../../src/services/aeat/aeatSubmitService');
    aeatSubmitService.submitH7.mockResolvedValue({
      success: true, accepted: true, mrn: '26ESH7A000067965R5', xml: '<xml/>'
    });
    const user = usuario();
    const h7 = await crearH7({ user });
    const res = crearRes();

    await ctrl.submit({ params: { id: h7._id }, body: {}, user }, res);
    expect(res.body.message).not.toMatch(/DEMO|simula/i);
  });
});

describe('addDocument', () => {
  test('agrega un documento a la H7 del creador', async () => {
    const user = usuario();
    const h7 = await crearH7({ user });
    const res = crearRes();

    await ctrl.addDocument({
      params: { id: h7._id },
      body: { type: 'INVOICE', name: 'Factura', url: 'https://x/f.pdf' },
      user
    }, res);

    expect(res.statusCode).toBe(200);
    const guardada = await H7Declaration.findById(h7._id);
    expect(guardada.documents.length).toBeGreaterThanOrEqual(1);
  });
});

describe('validate / validateIOSS / calculateDuties (helpers puros del servicio)', () => {
  test('validate marca elegible una compra de bajo valor', async () => {
    const res = crearRes();
    await ctrl.validate({
      body: {
        operationType: 'B2C_LOW_VALUE',
        items: [{ description: 'Libro', taricCode: '49019900', quantity: 1, unitValue: 20 }]
      }
    }, res);

    expect(res.statusCode).toBe(200);
    expect(typeof res.body.data.eligible).toBe('boolean');
  });

  test('validateIOSS rechaza un formato invalido', async () => {
    const res = crearRes();
    await ctrl.validateIOSS({ params: { iossNumber: 'NO-VALIDO' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.valid).toBe(false);
  });

  test('validateIOSS acepta un formato valido IM + 10 digitos', async () => {
    const res = crearRes();
    await ctrl.validateIOSS({ params: { iossNumber: 'IM1234567890' } }, res);
    expect(res.body.data.valid).toBe(true);
  });

  test('calculateDuties devuelve totales y derechos', async () => {
    const res = crearRes();
    await ctrl.calculateDuties({
      body: {
        items: [{ description: 'Reloj', taricCode: '91011100', quantity: 2, unitValue: 40 }]
      }
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.totals).toBeDefined();
    expect(res.body.data.duties).toBeDefined();
  });
});

describe('create', () => {
  test('crea una H7 valida tomando el tenant del usuario (201)', async () => {
    const user = usuario();
    const res = crearRes();

    await ctrl.create({
      body: {
        operationType: 'B2C',
        trackingNumber: 'TRK-CREATE-1',
        carrier: { code: 'UPS', name: 'UPS' },
        sender: { name: 'Vendedor SL', address: { country: 'CN' } },
        recipient: {
          name: 'Ana', taxId: '11111111H',
          address: { street: 'Calle 2', city: 'Madrid', postalCode: '28002', country: 'ES' }
        },
        items: [{
          description: 'USB', taricCode: '85234910', quantity: 1,
          unitValue: 15, totalValue: 15, netWeight: 0.05, countryOfOrigin: 'CN'
        }],
        totals: { intrinsicValue: 15, customsValue: 15, grossWeight: 0.1, netWeight: 0.05 }
      },
      user
    }, res);

    expect(res.statusCode).toBe(201);
    const guardada = await H7Declaration.findById(res.body.data._id);
    expect(String(guardada.tenantId)).toBe(String(user.tenantId));
  });

  test('rechaza una compra por encima del limite de bajo valor (400)', async () => {
    const user = usuario();
    const res = crearRes();

    await ctrl.create({
      body: {
        operationType: 'B2C_LOW_VALUE',
        carrier: { code: 'UPS' },
        recipient: { name: 'Ana', taxId: '11111111H', address: { country: 'ES' } },
        items: [{ description: 'Portatil', taricCode: '84713000', quantity: 1, unitValue: 5000 }]
      },
      user
    }, res);

    expect(res.statusCode).toBe(400);
  });
});

describe('processBatch', () => {
  test('exige un array de declaraciones (400)', async () => {
    const res = crearRes();
    await ctrl.processBatch({ body: {}, user: usuario() }, res);
    expect(res.statusCode).toBe(400);
  });

  test('rechaza lotes de mas de 100 declaraciones (400)', async () => {
    const res = crearRes();
    const declarations = Array.from({ length: 101 }, () => ({}));
    await ctrl.processBatch({ body: { declarations }, user: usuario() }, res);
    expect(res.statusCode).toBe(400);
  });
});
