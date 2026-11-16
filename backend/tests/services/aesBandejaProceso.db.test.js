/**
 * Lectura de la bandeja de avisos AES y su efecto en LUCI, contra Mongo en
 * memoria y con la AEAT simulada (respuestas de tests/fixtures/aeat-bandeja):
 * buzones por NIF del destinatario, asociación por MRN solo dentro de los
 * tenants de ese NIF, idempotencia (por clave de la bandeja y por Id del
 * aviso), errores de lectura y reintentos.
 */
jest.mock('../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../src/services/aeat/aeatStatusMonitorService', () => ({ aplicarAvisoBandeja: jest.fn() }));

const fs = require('fs');
const path = require('path');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const Expedition = require('../../src/models/Expedition');
const Tenant = require('../../src/models/Tenant');
const AvisoAeat = require('../../src/models/AvisoAeat');
const monitor = require('../../src/services/aeat/aeatStatusMonitorService');
const { procesarBandeja, destinatarioDe } = require('../../src/services/aesBandejaProceso');
const { ENDPOINT_LISTA, ENDPOINT_DETALLE } = require('../../src/services/aeat/aesBandeja');
const { TENANT_AGENTE, expedienteAes } = require('../fixtures/aeat-aes/expedienteAes');

const FIX = path.join(__dirname, '../fixtures/aeat-bandeja');
const leer = (f) => fs.readFileSync(path.join(FIX, f), 'utf8');
const MRN_A = '26ES002801100319B6';
const MRN_B = '26ES002801100326B3';
const DETALLES = { '20261116120438659005': 'aviso-csalid-sa.xml', '20261116122652360089': 'aviso-cdissa.xml' };

/** AEAT simulada: lista por NIF y detalle por clave; registra las llamadas. */
function aeatSimulada({ listas = { B22477020: 'lista-respuesta.xml' }, detalles = DETALLES } = {}) {
  const llamadas = [];
  const enviar = jest.fn(async (soap, endpoint) => {
    if (endpoint === ENDPOINT_LISTA) {
      const nif = /<l:NifDeclarante>([^<]+)</.exec(soap)[1];
      llamadas.push(['lista', nif]);
      return { status: 200, data: leer(listas[nif] || 'lista-vacia.xml') };
    }
    if (endpoint === ENDPOINT_DETALLE) {
      const clave = /<d:clave>([^<]+)</.exec(soap)[1];
      llamadas.push(['detalle', clave]);
      return { status: detalles[clave] === 'fault-client.xml' ? 500 : 200, data: leer(detalles[clave]) };
    }
    throw new Error(`endpoint inesperado ${endpoint}`);
  });
  return { enviar, llamadas };
}

describe('procesarBandeja', () => {
  usarBaseDeDatosEnMemoria();
  beforeAll(() => AvisoAeat.init());

  let tenantA;
  let tenantB;
  let expA;
  let expB;

  beforeEach(async () => {
    monitor.aplicarAvisoBandeja.mockResolvedValue(true);
    tenantA = await Tenant.create({ name: 'STRIX', slug: 'strix', email: 'a@strixai.ai', ...TENANT_AGENTE });
    tenantB = await Tenant.create({
      name: 'Otra agencia', slug: 'otra', email: 'b@otra.es', companyName: 'Otra agencia SL',
      businessInfo: { type: 'customs_agent', eori: 'ESA78587268' }, primaryContact: TENANT_AGENTE.primaryContact
    });
    const enviada = (mrn) => ({ type: 'AES', lrn: 'LUCIAES1', customsOffice: 'ES002801', officeOfExit: 'ES002801', status: 'submitted', mrn });
    expA = await Expedition.create({ ...expedienteAes({ declaration: enviada(MRN_A) }), expeditionId: 'EXP-A', tenantId: tenantA._id });
    expB = await Expedition.create({ ...expedienteAes({ declaration: enviada(MRN_B) }), expeditionId: 'EXP-B', tenantId: tenantB._id });
  });

  test('salida efectiva: confirma la salida del expediente del tenant y deja el seguimiento final', async () => {
    const { enviar, llamadas } = aeatSimulada();
    const r = await procesarBandeja({ enviar });

    expect(llamadas.filter(([q]) => q === 'lista').map(([, nif]) => nif).sort()).toEqual(['A78587268', 'B22477020']);
    expect(r).toMatchObject({ buzones: 2, leidos: 2, aplicados: 1, sinExpediente: 1, errores: 0 });

    const a = await Expedition.findById(expA._id).lean();
    expect(a.declaration.exitConfirmedAt).toEqual(new Date('2026-11-16T00:00:00.000Z'));
    expect(a.declaration.aesSalida).toMatchObject({
      estado: 'SA', final: true, aduanaSalida: 'ES002801',
      salida: { confirmada: true, fecha: '2026-11-16', resultado: 'A2', resultadoTexto: expect.stringContaining('conforme') }
    });
    expect(a.declaration.aesAvisos).toEqual([expect.objectContaining({ id: '20261116120438659005', tipo: 'CSALID', estadoAES: 'SA' })]);
    expect(a.timeline.at(-1)).toMatchObject({ action: 'aes_aviso_aeat', metadata: { mrn: MRN_A, tipo: 'CSALID', estadoAES: 'SA' } });
    expect(monitor.aplicarAvisoBandeja).toHaveBeenCalledWith(expect.objectContaining({ mrn: MRN_A, tenantId: String(tenantA._id), estado: 'SA', tipo: 'CSALID' }));
  });

  test('aislamiento: un aviso del buzón de un NIF no toca el expediente de otro tenant aunque el MRN coincida', async () => {
    const { enviar } = aeatSimulada();
    await procesarBandeja({ enviar });
    const b = await Expedition.findById(expB._id).lean();
    expect(b.declaration.aesSalida).toBeUndefined();
    expect(b.declaration.aesAvisos || []).toHaveLength(0);
    const aviso = await AvisoAeat.findOne({ clave: '20261116122652360089' }).lean();
    expect(aviso).toMatchObject({ estado: 'sin_expediente', nif: 'B22477020', mrn: MRN_B, tipo: 'CDISSA' });
    expect(aviso.tenantId).toBeUndefined();
  });

  test('el aviso sin expediente se asocia en una pasada posterior, sin volver a leerlo', async () => {
    const { enviar } = aeatSimulada();
    await procesarBandeja({ enviar });
    const expA2 = await Expedition.create({ ...expedienteAes({ declaration: { type: 'AES', customsOffice: 'ES002801', officeOfExit: 'ES004601', status: 'submitted', mrn: MRN_B } }), expeditionId: 'EXP-A2', tenantId: tenantA._id });

    const segunda = aeatSimulada({ listas: { B22477020: 'lista-vacia.xml' } });
    const r = await procesarBandeja({ enviar: segunda.enviar });
    expect(segunda.llamadas.some(([q]) => q === 'detalle')).toBe(false);
    expect(r.aplicados).toBe(1);
    const a2 = await Expedition.findById(expA2._id).lean();
    expect(a2.declaration.aesSalida).toMatchObject({ estado: 'ST', final: true, disconformidad: { aduana: 'salida', fecha: '2026-11-16', motivo: 'No hay apenas kilos.' } });
    expect(a2.declaration.exitConfirmedAt).toBeUndefined();
    expect((await AvisoAeat.findOne({ clave: '20261116122652360089' }).lean())).toMatchObject({ estado: 'aplicado', tenantId: tenantA._id, expeditionId: expA2._id });
  });

  test('idempotencia: la misma clave no se vuelve a leer y el mismo aviso con otra clave no se duplica', async () => {
    const { enviar } = aeatSimulada();
    await procesarBandeja({ enviar });

    const otraVez = aeatSimulada();
    const r2 = await procesarBandeja({ enviar: otraVez.enviar });
    expect(otraVez.llamadas.filter(([q]) => q === 'detalle')).toEqual([]);
    expect(r2).toMatchObject({ leidos: 0, aplicados: 0, repetidos: 2 });

    const lista = leer('lista-respuesta.xml').replace(/20261116120438659005/, '20261116999999999999');
    fs.writeFileSync(path.join(FIX, '.tmp-lista.xml'), lista);
    try {
      const reentrega = aeatSimulada({ listas: { B22477020: '.tmp-lista.xml' }, detalles: { ...DETALLES, '20261116999999999999': 'aviso-csalid-sa.xml' } });
      const r3 = await procesarBandeja({ enviar: reentrega.enviar });
      expect(r3).toMatchObject({ leidos: 1, aplicados: 0 });
    } finally {
      fs.unlinkSync(path.join(FIX, '.tmp-lista.xml'));
    }
    const a = await Expedition.findById(expA._id).lean();
    expect(a.declaration.aesAvisos).toHaveLength(1);
    expect(a.timeline.filter((t) => t.action === 'aes_aviso_aeat')).toHaveLength(1);
    expect((await AvisoAeat.findOne({ clave: '20261116999999999999' }).lean()).estado).toBe('repetido');
  });

  test('un levante posterior no deshace la salida confirmada', async () => {
    const { enviar } = aeatSimulada();
    await procesarBandeja({ enviar });
    const lista = leer('lista-respuesta.xml').replace('ADEX26ES002801100319B6CSALIDS', 'ADEX26ES002801100319B6CLEVSAL').replace(/20261116120438659005/, '20261116125911348005');
    fs.writeFileSync(path.join(FIX, '.tmp-lista2.xml'), lista);
    try {
      const tarde = aeatSimulada({ listas: { B22477020: '.tmp-lista2.xml' }, detalles: { ...DETALLES, '20261116125911348005': 'aviso-clevsa.xml' } });
      await procesarBandeja({ enviar: tarde.enviar });
    } finally {
      fs.unlinkSync(path.join(FIX, '.tmp-lista2.xml'));
    }
    const a = await Expedition.findById(expA._id).lean();
    expect(a.declaration.aesSalida).toMatchObject({ estado: 'SA', final: true, levanteSalida: { fecha: '2026-11-16', csv: 'DBGZ6TBAS32GJ76E' } });
    expect(a.declaration.aesAvisos).toHaveLength(2);
  });

  test('si el detalle falla se guarda el error y se reintenta en la siguiente pasada', async () => {
    const mala = aeatSimulada({ detalles: { ...DETALLES, '20261116120438659005': 'fault-client.xml' } });
    const r = await procesarBandeja({ enviar: mala.enviar });
    expect(r.errores).toBe(1);
    expect(await AvisoAeat.findOne({ clave: '20261116120438659005' }).lean()).toMatchObject({ estado: 'error_lectura', error: expect.stringContaining('apoderado') });
    expect((await Expedition.findById(expA._id).lean()).declaration.exitConfirmedAt).toBeUndefined();

    const buena = aeatSimulada();
    const r2 = await procesarBandeja({ enviar: buena.enviar });
    expect(buena.llamadas).toContainEqual(['detalle', '20261116120438659005']);
    expect(r2.aplicados).toBe(1);
  });

  test('dos pasadas a la vez (réplicas): cada aviso se lee una sola vez', async () => {
    const { enviar, llamadas } = aeatSimulada();
    await Promise.all([procesarBandeja({ enviar }), procesarBandeja({ enviar })]);
    const detalles = llamadas.filter(([q]) => q === 'detalle').map(([, c]) => c).sort();
    expect(detalles).toEqual(['20261116120438659005', '20261116122652360089']);
    expect((await Expedition.findById(expA._id).lean()).declaration.aesAvisos).toHaveLength(1);
  });

  test('aviso para otro NIF que el del buzón: se guarda entero para revisar y no se aplica', async () => {
    const otro = leer('aviso-csalid-sa.xml').replace('<messageRecipient>ESB22477020</messageRecipient>', '<messageRecipient>ESA78587268</messageRecipient>');
    fs.writeFileSync(path.join(FIX, '.tmp-otro.xml'), otro);
    try {
      const { enviar } = aeatSimulada({ detalles: { ...DETALLES, '20261116120438659005': '.tmp-otro.xml' } });
      await procesarBandeja({ enviar });
    } finally {
      fs.unlinkSync(path.join(FIX, '.tmp-otro.xml'));
    }
    const aviso = await AvisoAeat.findOne({ clave: '20261116120438659005' }).lean();
    expect(aviso).toMatchObject({ estado: 'revisar', estadoAES: 'SA', error: expect.stringContaining('A78587268') });
    expect(aviso.leidoEn).toBeInstanceOf(Date);
    expect((await Expedition.findById(expA._id).lean()).declaration.exitConfirmedAt).toBeUndefined();
  });

  test('un error de lectura se reintenta como mucho 5 veces', async () => {
    const mala = aeatSimulada({ detalles: { ...DETALLES, '20261116120438659005': 'fault-client.xml' } });
    for (let i = 0; i < 7; i += 1) await procesarBandeja({ enviar: mala.enviar });
    expect(mala.llamadas.filter(([q, c]) => q === 'detalle' && c === '20261116120438659005')).toHaveLength(5);
    expect(await AvisoAeat.findOne({ clave: '20261116120438659005' }).lean()).toMatchObject({ estado: 'no_valido', intentos: 5 });
  });

  test('un fallo de la lista de un buzón no corta los demás', async () => {
    const { enviar } = aeatSimulada({ listas: { B22477020: 'fault-client.xml' } });
    const r = await procesarBandeja({ enviar });
    expect(r).toMatchObject({ buzones: 2, errores: 1, leidos: 0 });
  });

  test('límite de lecturas por pasada', async () => {
    const { enviar, llamadas } = aeatSimulada();
    const r = await procesarBandeja({ enviar, limite: 1 });
    expect(llamadas.filter(([q]) => q === 'detalle')).toHaveLength(1);
    expect(r.leidos).toBe(1);
  });

  test('sin AES enviados pendientes de salida no pregunta a la AEAT', async () => {
    await Expedition.updateMany({}, { $set: { 'declaration.aesSalida': { final: true } } });
    const { enviar } = aeatSimulada();
    const r = await procesarBandeja({ enviar });
    expect(enviar).not.toHaveBeenCalled();
    expect(r.buzones).toBe(0);
  });
});

describe('destinatarioDe', () => {
  test('el representante del AES (la agencia del tenant), sin ES', () => {
    expect(destinatarioDe(expedienteAes(), TENANT_AGENTE)).toBe('B22477020');
  });

  test('sin representante con EORI propio y el tenant exportador: el declarante', () => {
    const tenantExportador = { ...TENANT_AGENTE, businessInfo: { type: 'exporter', eori: 'ESB22477020' } };
    const exp = expedienteAes({ client: { companyName: 'X', nif: 'B22477020', eori: 'ESB22477020', address: { street: 'C', city: 'M', postalCode: '28001', country: 'ES' } } });
    expect(destinatarioDe(exp, tenantExportador)).toBe('B22477020');
  });

  test('si el expediente ya no permite rehacer los datos del AES, el NIF del tenant', () => {
    expect(destinatarioDe(expedienteAes({ goods: [] }), TENANT_AGENTE)).toBe('B22477020');
  });

  test('manda el destinatario fijado al presentar, aunque luego se edite el expediente', () => {
    const exp = expedienteAes({ declaration: { type: 'AES', aesDestinatario: 'A78587268' } });
    expect(destinatarioDe(exp, TENANT_AGENTE)).toBe('A78587268');
  });

  test('sin NIF español en ningún sitio: null', () => {
    expect(destinatarioDe(expedienteAes({ goods: [] }), { companyName: 'X', businessInfo: {} })).toBeNull();
  });
});
