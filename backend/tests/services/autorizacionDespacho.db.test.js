/**
 * Autorizacion de despacho vigente (UAT 11/Nov/2026): vale cuatro años por
 * cliente; si ya la entrego en una operacion anterior del mismo despacho, en el
 * checklist sale marcada y no se vuelve a pedir.
 *
 * Mongo real en memoria; solo se simula aiService porque portalController lo carga.
 */
const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');

jest.mock('../../src/services/aiService', () => ({}));

const { Expedition } = require('../../src/models');
const {
  autorizacionVigente, aplicarAutorizacionVigente
} = require('../../src/services/documentos/autorizacionDespacho');
const portalController = require('../../src/controllers/portalController');

usarBaseDeDatosEnMemoria();

const TENANT = new mongoose.Types.ObjectId();
const AHORA = new Date('2026-11-11T12:00:00Z');
const hace = (dias) => new Date(AHORA.getTime() - dias * 24 * 3600 * 1000);

const autorizacion = (uploadedAt, extra = {}) => ({
  type: 'dispatch_authorization', fileName: 'autorizacion.pdf', uploadedAt, ...extra
});
const expediente = (over = {}) => Expedition.create({
  tenantId: TENANT, operationType: 'import', transportMode: 'maritime',
  client: { companyName: 'Cliente SL', nif: 'B12345678' }, status: 'pending_documents',
  ...over
});
const CHECKLIST = [
  { documentType: 'commercial_invoice', documentName: 'Factura Comercial', required: true, received: false },
  { documentType: 'dispatch_authorization', documentName: 'Autorizacion de Despacho', required: true, received: false }
];

describe('autorizacionVigente', () => {
  test('encuentra la que el mismo cliente entrego en otro expediente y calcula hasta cuando vale', async () => {
    const anterior = await expediente({ documents: [autorizacion(hace(400))] });
    const nuevo = await expediente();

    const vigente = await autorizacionVigente(nuevo, { ahora: AHORA });

    expect(vigente.expeditionId).toBe(anterior.expeditionId);
    expect(vigente.fecha).toEqual(hace(400));
    expect(vigente.validaHasta.getFullYear()).toBe(hace(400).getFullYear() + 4);
  });

  test('con varias, se queda con la mas reciente', async () => {
    await expediente({ documents: [autorizacion(hace(900))] });
    const reciente = await expediente({ documents: [autorizacion(hace(30))] });
    const nuevo = await expediente();

    expect((await autorizacionVigente(nuevo, { ahora: AHORA })).expeditionId).toBe(reciente.expeditionId);
  });

  test('una de hace mas de cuatro años ya no vale', async () => {
    await expediente({ documents: [autorizacion(hace(4 * 365 + 10))] });
    const nuevo = await expediente();

    expect(await autorizacionVigente(nuevo, { ahora: AHORA })).toBeNull();
  });

  test('los cuatro años cuentan desde la fecha de la autorizacion, no desde la de subida', async () => {
    // Firmada hace tres años y medio, subida a LUCI ayer: le quedan seis meses.
    const anterior = await expediente({ documents: [autorizacion(hace(1), { documentDate: hace(1278) })] });
    const nuevo = await expediente();

    const vigente = await autorizacionVigente(nuevo, { ahora: AHORA });

    expect(vigente.expeditionId).toBe(anterior.expeditionId);
    expect(vigente.fecha).toEqual(hace(1278));
    expect(vigente.validaHasta.getTime()).toBeLessThan(AHORA.getTime() + 200 * 24 * 3600 * 1000);
  });

  test('una autorizacion de hace mas de cuatro años no vale aunque se haya subido hoy', async () => {
    await expediente({ documents: [autorizacion(hace(0), { documentDate: hace(4 * 365 + 30) })] });
    const nuevo = await expediente();

    expect(await autorizacionVigente(nuevo, { ahora: AHORA })).toBeNull();
  });

  test('con varias vigentes manda la de fecha de autorizacion mas reciente', async () => {
    await expediente({ documents: [autorizacion(hace(2), { documentDate: hace(1000) })] });
    const mejor = await expediente({ documents: [autorizacion(hace(300), { documentDate: hace(310) })] });
    const nuevo = await expediente();

    expect((await autorizacionVigente(nuevo, { ahora: AHORA })).expeditionId).toBe(mejor.expeditionId);
  });

  test('no vale la de otro cliente, la de otro despacho ni una rechazada', async () => {
    await expediente({ client: { companyName: 'Otro SL', nif: 'B87654321' }, documents: [autorizacion(hace(10))] });
    await expediente({ tenantId: new mongoose.Types.ObjectId(), documents: [autorizacion(hace(10))] });
    await expediente({ documents: [autorizacion(hace(10), { status: 'rejected' })] });
    const nuevo = await expediente();

    expect(await autorizacionVigente(nuevo, { ahora: AHORA })).toBeNull();
  });

  test('otro tipo de documento no cuenta, y el propio expediente tampoco', async () => {
    await expediente({ documents: [{ type: 'commercial_invoice', fileName: 'f.pdf', uploadedAt: hace(10) }] });
    const nuevo = await expediente({ documents: [autorizacion(hace(5))] });

    expect(await autorizacionVigente(nuevo, { ahora: AHORA })).toBeNull();
  });

  test('sin NIF o sin tenant no se busca nada', async () => {
    await expediente({ documents: [autorizacion(hace(10))] });

    expect(await autorizacionVigente({ _id: new mongoose.Types.ObjectId(), tenantId: TENANT, client: {} }, { ahora: AHORA })).toBeNull();
    expect(await autorizacionVigente({ _id: new mongoose.Types.ObjectId(), client: { nif: 'B12345678' } }, { ahora: AHORA })).toBeNull();
    expect(await autorizacionVigente(null)).toBeNull();
  });
});

describe('aplicarAutorizacionVigente', () => {
  const vigente = { expeditionId: 'EXP-2025-AAAA', fecha: new Date('2025-10-07T10:00:00Z'), validaHasta: new Date('2029-10-07T10:00:00Z') };

  test('marca la autorizacion como entregada, con nota, y no toca el resto', () => {
    const r = aplicarAutorizacionVigente(CHECKLIST, vigente);

    expect(r[0]).toEqual(CHECKLIST[0]);
    expect(r[1]).toMatchObject({
      received: true,
      coveredByPrevious: { expeditionId: 'EXP-2025-AAAA', validUntil: vigente.validaHasta },
      notes: 'Vigente: autorizacion del 7/10/2025, entregada en el expediente EXP-2025-AAAA. Valida hasta el 7/10/2029.'
    });
    expect(CHECKLIST[1].received).toBe(false);
  });

  test('sin autorizacion vigente devuelve el checklist tal cual', () => {
    expect(aplicarAutorizacionVigente(CHECKLIST, null)).toBe(CHECKLIST);
  });

  test('si ya esta entregada en este expediente no la cambia', () => {
    const entregada = [{ ...CHECKLIST[1], received: true }];
    expect(aplicarAutorizacionVigente(entregada, vigente)[0]).toEqual(entregada[0]);
  });
});

describe('portal del cliente', () => {
  const res = () => {
    const r = { statusCode: 200 };
    r.status = (c) => { r.statusCode = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    return r;
  };

  test('la autorizacion de una operacion anterior sale marcada, sin decir en que expediente esta', async () => {
    const anterior = await expediente({ documents: [autorizacion(new Date(Date.now() - 30 * 24 * 3600 * 1000))] });
    const nuevo = await expediente({ documentChecklist: CHECKLIST });
    const r = res();

    await portalController.getByToken({ params: { token: nuevo.clientPortal.token } }, r);

    const [factura, aut] = r.body.data.documentChecklist;
    expect(factura).toMatchObject({ documentType: 'commercial_invoice', received: false });
    expect(aut).toMatchObject({ documentType: 'dispatch_authorization', received: true, coveredByPrevious: true });
    // El nombre vigente del tipo (con tilde) manda sobre el guardado en el expediente.
    expect(aut.documentName).toBe('Autorización de Despacho');
    expect(aut.validUntil).toBeDefined();
    expect(JSON.stringify(r.body.data.documentChecklist[1].coveredByPrevious)).not.toContain(anterior.expeditionId);
    // No se guarda: el checklist del expediente sigue pidiendola.
    expect((await Expedition.findById(nuevo._id)).documentChecklist[1].received).toBe(false);
  });

  test('sin operacion anterior sigue pendiente', async () => {
    const nuevo = await expediente({ documentChecklist: CHECKLIST });
    const r = res();

    await portalController.getByToken({ params: { token: nuevo.clientPortal.token } }, r);

    expect(r.body.data.documentChecklist[1]).toMatchObject({ received: false });
    expect(r.body.data.documentChecklist[1].coveredByPrevious).toBeUndefined();
  });

  test('la vista del cliente lleva cuantos documentos hay y la ultima actualizacion, sin rutas ni nombres de fichero', async () => {
    const nuevo = await expediente({
      documentChecklist: CHECKLIST,
      documents: [{ type: 'commercial_invoice', fileName: 'interno-123.pdf', filePath: '/app/uploads/interno-123.pdf', originalName: 'factura.pdf' }]
    });
    const r = res();

    await portalController.getByToken({ params: { token: nuevo.clientPortal.token } }, r);

    expect(r.body.data.documents).toHaveLength(1);
    expect(Object.keys(r.body.data.documents[0]).sort()).toEqual(['type', 'uploadedAt']);
    expect(r.body.data.updatedAt).toBeDefined();
    expect(JSON.stringify(r.body.data)).not.toContain('interno-123');
  });
});
