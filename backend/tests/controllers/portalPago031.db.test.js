/**
 * Pago previo al levante (forma de pago A, modelo 031) desde el portal del
 * cliente — UAT 16/Nov/2026, peticion de Patricia: con el H1 admitido, LUCI le
 * da al cliente el H1 definitivo y los datos del 031 y se queda a la espera del
 * justificante de pago para obtener el levante.
 *
 * Cadena real con supertest: Express + rutas del portal + multer + Mongo en
 * memoria. Nada mockeado salvo el directorio de subida (tmpdir).
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

const uploadDirTest = fs.mkdtempSync(path.join(os.tmpdir(), 'luci-portal-031-'));
process.env.UPLOAD_PATH = uploadDirTest;

const { Expedition } = require('../../src/models');
const portalRoutes = require('../../src/routes/portal');
const { h1DefinitivoDe, pagoTributosDe } = require('../../src/services/portal/pagoTributos');

usarBaseDeDatosEnMemoria();

afterAll(() => {
  fs.rmSync(uploadDirTest, { recursive: true, force: true });
});

let app;
beforeEach(() => {
  app = express();
  app.use(express.json());
  app.use('/api/portal', portalRoutes);
});

const MRN = '26ES00280110000011';
const LIQUIDACION = {
  totalAPagar: 1704.96,
  totalAGarantizar: 0,
  partidas: [{
    numero: 1,
    preferencia: '100',
    tributos: [
      { tipo: 'A00', medioDePago: 'A', bases: [{ tipoImpositivo: 12, importe: 1000, cuota: 120, aGarantizar: 0 }] },
      { tipo: 'B00', medioDePago: 'A', bases: [{ tipoImpositivo: 21, importe: 7547.43, cuota: 1584.96, aGarantizar: 0 }] }
    ]
  }]
};

function declaracionAdmitida(over = {}) {
  return {
    type: 'H1',
    mrn: MRN,
    paymentMethod: 'A',
    acceptanceDate: new Date('2026-11-16T10:00:00Z'),
    customsOffice: '280100',
    cauEnvio: { requestXML: '<xml>SECRETO-DEL-ENVIO</xml>' },
    aeatResponse: {
      servicio: 'CC415AV1',
      csv: 'CSVAEAT123',
      responseCode: '40',
      liquidacion: LIQUIDACION,
      certificados: { requeridos: 'N', partidas: [] }
    },
    ...over
  };
}

async function sembrar(over = {}) {
  return Expedition.create({
    tenantId: new mongoose.Types.ObjectId(),
    operationType: 'import',
    transportMode: 'maritime',
    client: { companyName: 'Cliente SL', nif: 'B12345678', contact: { email: 'interno@cliente.es' } },
    goods: [{ itemNumber: 1, description: 'Bicicletas eléctricas', taricCode: '8711601000', quantity: 10, unit: 'u', invoiceValue: 1000 }],
    status: 'green_channel',
    declaration: declaracionAdmitida(),
    ...over
  });
}

const leer = async (token) => (await request(app).get(`/api/portal/${token}`)).body.data;

describe('pago previo al levante (A) con el H1 admitido: lo que ve el cliente', () => {
  test('datos del modelo 031: el MRN como referencia, el importe de la AEAT y el NIF del importador', async () => {
    const exp = await sembrar();
    const pago = (await leer(exp.clientPortal.token)).pagoTributos;

    expect(pago).toMatchObject({ paymentMethod: 'A', pendientePago: true, totalAPagar: 1704.96, h1Definitivo: true, justificante: null });
    expect(pago.modelo031).toEqual({
      referencia: MRN,
      importe: 1704.96,
      nifImportador: 'B12345678',
      fechaAdmision: '2026-11-16T10:00:00.000Z',
      limiteDePago: null
    });
  });

  test('no se expone nada interno: ni el XML enviado, ni el CSV, ni correos', async () => {
    const exp = await sembrar();
    const texto = JSON.stringify(await leer(exp.clientPortal.token));
    expect(texto).not.toContain('SECRETO-DEL-ENVIO');
    expect(texto).not.toContain('CSVAEAT123');
    expect(texto).not.toContain('interno@cliente.es');
  });

  test('el canal verde que procesa LUCI no es el levante de la AEAT: con A sigue pendiente de pago', async () => {
    // channelService pone levanteDate al procesar el canal verde, pero con pago
    // previo la AEAT no da el levante hasta cobrar el 031.
    const exp = await sembrar({ declaration: declaracionAdmitida({ channel: 'green', levanteDate: new Date() }) });
    expect((await leer(exp.clientPortal.token)).pagoTributos.pendientePago).toBe(true);
  });

  test('con el levante de la AEAT (consulta) deja de estar pendiente de pago', async () => {
    const decl = declaracionAdmitida();
    decl.aeatResponse.consulta = { estado: { levante: 'L', fechaLevante: '2026-11-17T09:00:00' } };
    const exp = await sembrar({ declaration: decl });
    const pago = (await leer(exp.clientPortal.token)).pagoTributos;
    expect(pago.pendientePago).toBe(false);
    expect(pago.modelo031).toBeNull();
  });

  test('manda la liquidación de la última consulta y su fecha límite de pago', async () => {
    const decl = declaracionAdmitida();
    decl.aeatResponse.consulta = {
      estado: { levante: 'D', limiteDePago: '2026-11-26' },
      liquidacion: { ...LIQUIDACION, totalAPagar: 1800.5 }
    };
    const exp = await sembrar({ declaration: decl });
    const pago = (await leer(exp.clientPortal.token)).pagoTributos;
    expect(pago.totalAPagar).toBe(1800.5);
    expect(pago.modelo031).toMatchObject({ importe: 1800.5, limiteDePago: '2026-11-26' });
  });

  test('con pago aplazado (R) no hay datos del 031, pero sí el H1 definitivo', async () => {
    const exp = await sembrar({ declaration: declaracionAdmitida({ paymentMethod: 'R' }) });
    const pago = (await leer(exp.clientPortal.token)).pagoTributos;
    expect(pago.modelo031).toBeNull();
    expect(pago.pendientePago).toBe(false);
    expect(pago.h1Definitivo).toBe(true);
  });

  test('sin presentar no hay H1 definitivo ni datos del 031', () => {
    const pago = pagoTributosDe({ operationType: 'import', client: { nif: 'B1' }, declaration: { paymentMethod: 'A' }, documents: [] });
    expect(pago).toMatchObject({ h1Definitivo: false, modelo031: null, pendientePago: false, justificante: null });
  });
});

describe('H1 definitivo del cliente (GET /api/portal/:token/h1-definitivo)', () => {
  test('datos del H1 admitido en lista blanca: MRN, fecha, importador, partidas con sus tributos y total', async () => {
    const exp = await sembrar();
    const datos = h1DefinitivoDe(exp);
    expect(datos).toEqual({
      expeditionId: exp.expeditionId,
      mrn: MRN,
      csv: 'CSVAEAT123',
      fechaAdmision: new Date('2026-11-16T10:00:00Z'),
      aduana: '280100',
      formaDePago: 'A',
      importador: { nombre: 'Cliente SL', nif: 'B12345678' },
      partidas: [{
        numero: 1,
        codigo: '8711601000',
        descripcion: 'Bicicletas eléctricas',
        tributos: [
          { tipo: 'A00', medioDePago: 'A', base: 1000, tipoImpositivo: 12, cuota: 120 },
          { tipo: 'B00', medioDePago: 'A', base: 7547.43, tipoImpositivo: 21, cuota: 1584.96 }
        ]
      }],
      totalAPagar: 1704.96
    });
  });

  test('descarga un PDF', async () => {
    const exp = await sembrar();
    const res = await request(app)
      .get(`/api/portal/${exp.clientPortal.token}/h1-definitivo`)
      .buffer(true)
      .parse((r, cb) => { const c = []; r.on('data', (d) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toContain(`H1_${MRN}.pdf`);
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
    // Una sola pagina: el pie no debe abrir paginas en blanco.
    expect(res.body.toString('latin1').match(/\/Count (\d+)/)[1]).toBe('1');
  });

  test('409 si el H1 aún no está admitido', async () => {
    const exp = await sembrar({ declaration: { type: 'H1', paymentMethod: 'A' } });
    const res = await request(app).get(`/api/portal/${exp.clientPortal.token}/h1-definitivo`);
    expect(res.status).toBe(409);
  });

  test('404 con un token que no existe y 400 con uno mal formado', async () => {
    expect((await request(app).get('/api/portal/0b6c1d55-1d2b-4f4e-9a52-7a1e3c9b8f00/h1-definitivo')).status).toBe(404);
    expect((await request(app).get('/api/portal/no-es-token/h1-definitivo')).status).toBe(400);
  });
});

describe('justificante de pago del modelo 031 subido desde el portal', () => {
  const subir = (token, documentType) => request(app)
    .post(`/api/portal/${token}/documents`)
    .field('documentType', documentType)
    .attach('file', Buffer.from('%PDF-1.4 justificante'), 'justificante-031.pdf');

  test('queda en el expediente y en el seguimiento, y el portal lo da por recibido', async () => {
    const exp = await sembrar();
    const token = exp.clientPortal.token;

    const res = await subir(token, 'customs_payment_receipt');

    expect(res.status).toBe(200);
    const guardado = await Expedition.findById(exp._id);
    expect(guardado.documents.map((d) => d.type)).toEqual(['customs_payment_receipt']);
    expect(guardado.timeline.map((t) => t.action)).toContain('payment_receipt_uploaded');

    const vista = await leer(token);
    expect(vista.timeline.map((t) => t.action)).toContain('payment_receipt_uploaded');
    expect(vista.pagoTributos.justificante).toEqual({ subidoEn: expect.any(String) });
    // Sigue a la espera del levante de la AEAT.
    expect(vista.pagoTributos.pendientePago).toBe(true);
  });

  test('sin pago previo al levante con el H1 presentado no se admite (409) y no se guarda', async () => {
    const exp = await sembrar({ declaration: { type: 'H1', paymentMethod: 'A' } });
    const res = await subir(exp.clientPortal.token, 'customs_payment_receipt');
    expect(res.status).toBe(409);
    expect((await Expedition.findById(exp._id)).documents).toHaveLength(0);
  });

  test('un tipo de documento que no existe se rechaza con 400', async () => {
    const exp = await sembrar();
    const res = await subir(exp.clientPortal.token, 'no_existe');
    expect(res.status).toBe(400);
    expect((await Expedition.findById(exp._id)).documents).toHaveLength(0);
  });
});
