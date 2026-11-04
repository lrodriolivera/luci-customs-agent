/**
 * El lote H7 usa el tenant del usuario, no el que venga en el body.
 *
 * Hallazgos F6 y F18 del escaneo del 3/Nov/2026: POST /api/h7/batch (y la
 * carga CSV) copiaba cada declaracion del body con {...declarations[i]}, asi
 * que un tenantId del body se conservaba. Un usuario creaba declaraciones en
 * otro tenant y, al presentarlas, salian a la AEAT con la identidad de
 * declarante (NIF, EORI, certificado) de ese otro cliente.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/services/aeat/aeatSubmitService', () => ({ submitH7: jest.fn() }));

const { H7Declaration } = require('../../src/models');
const ctrl = require('../../src/controllers/h7Controller');

usarBaseDeDatosEnMemoria();

const TENANT_ATACANTE = new mongoose.Types.ObjectId();
const TENANT_VICTIMA = new mongoose.Types.ObjectId();

function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

let n = 0;
function declaracion(extra = {}) {
  n += 1;
  return {
    operationType: 'B2C',
    trackingNumber: `TRK-LOTE-${n}`,
    carrier: { code: 'UPS', name: 'UPS' },
    sender: { name: 'Vendedor SL', address: { country: 'CN' } },
    recipient: {
      name: 'Juan Perez', taxId: '12345678Z',
      address: { street: 'Calle Mayor 1', city: 'Madrid', postalCode: '28001', country: 'ES' }
    },
    items: [{
      description: 'Auriculares', taricCode: '85183000', quantity: 1,
      unitValue: 30, totalValue: 30, netWeight: 0.2, countryOfOrigin: 'CN'
    }],
    ...extra
  };
}

const atacante = () => ({ _id: new mongoose.Types.ObjectId(), role: 'admin', tenantId: TENANT_ATACANTE });

const todas = () => H7Declaration.find({}).lean();

test('un tenantId en el body se ignora: las declaraciones son del tenant del usuario', async () => {
  const res = crearRes();
  await ctrl.processBatch({
    body: { declarations: [declaracion({ tenantId: String(TENANT_VICTIMA) }), declaracion({ tenantId: TENANT_VICTIMA })] },
    user: atacante()
  }, res);

  expect(res.body.data.successful).toBe(2);
  const creadas = await todas();
  expect(creadas).toHaveLength(2);
  expect(creadas.every((d) => String(d.tenantId) === String(TENANT_ATACANTE))).toBe(true);
});

test('sin tenantId en el body tambien se asigna el del usuario', async () => {
  const res = crearRes();
  await ctrl.processBatch({ body: { declarations: [declaracion()] }, user: atacante() }, res);

  const [creada] = await todas();
  expect(String(creada.tenantId)).toBe(String(TENANT_ATACANTE));
});

test('la carga CSV tampoco puede elegir el tenant', async () => {
  const csv = [
    'trackingNumber,operationType,recipientName,recipientTaxId,recipientStreet,recipientCity,recipientPostalCode,recipientCountry,senderCountry,carrierCode,description,taricCode,quantity,unitValue,netWeight,countryOfOrigin,tenantId',
    `TRK-CSV-1,B2C,Juan Perez,12345678Z,Calle Mayor 1,Madrid,28001,ES,CN,UPS,Auriculares,85183000,1,30,0.2,CN,${TENANT_VICTIMA}`
  ].join('\n');
  const res = crearRes();
  await ctrl.importCSV({ body: { csv }, user: atacante() }, res);

  const creadas = await todas();
  expect(creadas.length).toBeGreaterThan(0);
  expect(creadas.every((d) => String(d.tenantId) === String(TENANT_ATACANTE))).toBe(true);
});
