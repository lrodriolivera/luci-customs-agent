/**
 * POST /api/portal/:token/documents — integracion real con supertest.
 *
 * Bug reportado el 13/Nov/2026: el portal del cliente (sin login) no podia
 * subir documentos. frontend/src/components/Portal/PortalDocuments.jsx
 * mandaba el fichero en el campo 'document', pero esta ruta monta
 * upload.single('file') (ver src/routes/portal.js). Multer, al recibir un
 * campo de fichero que no espera, lo descarta silenciosamente: req.file
 * queda undefined y el controlador responde 400 "No se ha proporcionado
 * archivo", aunque el cliente si adjunto uno.
 *
 * Esta suite ejercita la cadena real: Express + multer (diskStorage) +
 * portalValidators + portalController.uploadDocument, nada mockeado salvo el
 * directorio de subida (se redirige a un tmpdir para no ensuciar el repo).
 *
 * NO mockear: Expedition (Mongo real en memoria), multer, portalController.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

// middleware/upload.js lee UPLOAD_PATH al cargarse: hay que fijarlo ANTES de
// requerir las rutas del portal, que lo cargan transitivamente.
const uploadDirTest = fs.mkdtempSync(path.join(os.tmpdir(), 'luci-portal-upload-'));
process.env.UPLOAD_PATH = uploadDirTest;

const { Expedition } = require('../../src/models');
const portalRoutes = require('../../src/routes/portal');

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

// Crea un expediente accesible por su token de portal (uuid v4 generado por
// el propio modelo, igual que en produccion).
async function sembrarExpediente(over = {}) {
  return Expedition.create({
    tenantId: new mongoose.Types.ObjectId(),
    operationType: 'import',
    transportMode: 'maritime',
    client: { companyName: 'Cliente SL', nif: 'B12345678', contact: { email: 'c@cliente.es' } },
    status: 'pending_documents',
    documentChecklist: [
      { documentType: 'commercial_invoice', documentName: 'Factura Comercial', required: true, received: false }
    ],
    ...over
  });
}

describe('POST /api/portal/:token/documents', () => {
  test('con el campo "file" (el que espera el servidor), la subida funciona', async () => {
    const expediente = await sembrarExpediente();
    const token = expediente.clientPortal.token;

    const res = await request(app)
      .post(`/api/portal/${token}/documents`)
      .field('documentType', 'commercial_invoice')
      .attach('file', Buffer.from('contenido factura'), 'factura.pdf');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const actualizado = await Expedition.findById(expediente._id);
    expect(actualizado.documents).toHaveLength(1);
    expect(actualizado.documents[0].originalName).toBe('factura.pdf');
    expect(actualizado.documents[0].type).toBe('commercial_invoice');

    const checklistItem = actualizado.documentChecklist.find(d => d.documentType === 'commercial_invoice');
    expect(checklistItem.received).toBe(true);
  });

  test('con el campo "document" (el bug original), multer rechaza el campo y la subida falla con 400', async () => {
    // Multer solo acepta el campo que declara upload.single('file'); un campo
    // de fichero inesperado no llega a req.file como indefinido: multer lo
    // rechaza directamente con MulterError 'Unexpected field', que
    // handleUploadError traduce a este 400. Asi fallaba la subida real del
    // portal antes del arreglo.
    const expediente = await sembrarExpediente();
    const token = expediente.clientPortal.token;

    const res = await request(app)
      .post(`/api/portal/${token}/documents`)
      .field('documentType', 'commercial_invoice')
      .attach('document', Buffer.from('contenido factura'), 'factura.pdf');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: 'Error de subida: Unexpected field'
    });

    const actualizado = await Expedition.findById(expediente._id);
    expect(actualizado.documents).toHaveLength(0);
  });

  test('token de portal invalido -> 400 (ni siquiera llega a multer)', async () => {
    const res = await request(app)
      .post('/api/portal/no-es-un-uuid/documents')
      .field('documentType', 'commercial_invoice')
      .attach('file', Buffer.from('contenido'), 'factura.pdf');

    expect(res.status).toBe(400);
  });
});
