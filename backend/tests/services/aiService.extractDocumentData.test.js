/**
 * aiService.extractDocumentData — lectura de un documento real del expediente.
 *
 * Casos sacados de la prueba en produccion del 10/Nov/2026 con documentos
 * escaneados, fotos, Word y Excel: una foto de 11 MB devolvia un 500 generico
 * porque el modelo rechaza las imagenes de mas de 5 MB en base64.
 *
 * Solo se sustituye la llamada al modelo (callClaudeWithDocument). Los
 * ficheros son reales, creados en un directorio temporal.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const aiService = require('../../src/services/aiService');
const { prepararImagen, esImagen } = require('../../src/services/documentos/imagenParaModelo');

const RESPUESTA = JSON.stringify({ legible: true, tipoDetectado: 'bill_of_lading', confianza: 90, notas: [], transporte: { numeroDocumento: 'BL-1' } });
let dir;
let llamada;

const fichero = (nombre, bytes) => { const p = path.join(dir, nombre); fs.writeFileSync(p, bytes); return p; };
const doc = (filePath, mimeType, originalName = path.basename(filePath)) => ({ filePath, mimeType, originalName, type: 'bill_of_lading' });
// Imagen con ruido: no comprime, asi que pesa como una foto real.
const fotoGrande = (ancho, alto) => sharp(Buffer.from(Array.from({ length: ancho * alto * 3 }, (_, i) => (i * 7919) % 251)), { raw: { width: ancho, height: alto, channels: 3 } }).jpeg({ quality: 100 }).toBuffer();

beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'luci-lectura-')); });
afterAll(() => { fs.rmSync(dir, { recursive: true, force: true }); });
beforeEach(() => {
  llamada = jest.spyOn(aiService, 'callClaudeWithDocument').mockResolvedValue({ content: RESPUESTA, model: 'global.anthropic.claude-sonnet-5' });
});
afterEach(() => { jest.restoreAllMocks(); });

describe('aiService.extractDocumentData', () => {
  test('un PDF normal se envia tal cual y devuelve la lectura normalizada', async () => {
    const pdf = Buffer.from('%PDF-1.4 prueba');
    const r = await aiService.extractDocumentData(doc(fichero('bl.pdf', pdf), 'application/pdf'));

    expect(r).toMatchObject({ leido: true, legible: true, confianza: 90, modelo: 'sonnet-5' });
    expect(r.transporte.numeroDocumento).toBe('BL-1');
    const bloque = llamada.mock.calls[0][3];
    expect(bloque.document.format).toBe('pdf');
    expect(Buffer.compare(bloque.document.source.bytes, pdf)).toBe(0);
  });

  test('una foto grande se reduce antes de enviarla y el fichero original no cambia', async () => {
    const original = await fotoGrande(4200, 3000);
    expect(original.length).toBeGreaterThan(3 * 1024 * 1024);
    const ruta = fichero('foto-grande.jpg', original);

    const r = await aiService.extractDocumentData(doc(ruta, 'image/jpeg'));

    expect(r.leido).toBe(true);
    const bloque = llamada.mock.calls[0][3];
    expect(bloque.image.format).toBe('jpeg');
    expect(bloque.image.source.bytes.length).toBeLessThan(3.6 * 1024 * 1024);
    const meta = await sharp(bloque.image.source.bytes).metadata();
    expect(Math.max(meta.width, meta.height)).toBe(3000);
    expect(fs.readFileSync(ruta).length).toBe(original.length);
  }, 30000);

  test('una foto pequeña no se toca', async () => {
    const pequena = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#ffffff' } }).png().toBuffer();
    await aiService.extractDocumentData(doc(fichero('foto.png', pequena), 'image/png'));

    const bloque = llamada.mock.calls[0][3];
    expect(bloque.image.format).toBe('png');
    expect(Buffer.compare(bloque.image.source.bytes, pequena)).toBe(0);
  });

  test('un PDF de mas de 4,5 MB no se envia y lo dice con el tamaño', async () => {
    const r = await aiService.extractDocumentData(doc(fichero('escaneado-grande.pdf', Buffer.alloc(5 * 1024 * 1024, 1)), 'application/pdf'));

    expect(r).toMatchObject({ leido: false, legible: false });
    expect(r.notas[0]).toContain('pesa 5,0 MB');
    expect(r.notas[0]).toContain('4,5 MB');
    expect(llamada).not.toHaveBeenCalled();
  });

  test('si el servicio de IA falla el documento queda como no leido, sin lanzar', async () => {
    llamada.mockRejectedValue(new Error('Error en servicio de IA'));

    const r = await aiService.extractDocumentData(doc(fichero('bl2.pdf', Buffer.from('%PDF')), 'application/pdf'));

    expect(r).toMatchObject({ leido: false, legible: false });
    expect(r.notas[0]).toContain('no ha podido leer el documento en este momento');
  });

  test('una imagen dañada, un formato no admitido o un fichero que no existe no llaman al modelo', async () => {
    const danada = await aiService.extractDocumentData(doc(fichero('rota.jpg', Buffer.from('esto no es una imagen')), 'image/jpeg'));
    const zip = await aiService.extractDocumentData(doc(fichero('datos.zip', Buffer.from('PK')), 'application/zip'));
    const ausente = await aiService.extractDocumentData(doc(path.join(dir, 'no-existe.pdf'), 'application/pdf'));

    expect(danada.notas[0]).toContain('No se pudo abrir la imagen');
    expect(zip.notas[0]).toContain('no se puede leer automaticamente');
    expect(ausente.notas[0]).toContain('No se pudo abrir el archivo');
    expect([danada, zip, ausente].every(x => x.leido === false && x.legible === false)).toBe(true);
    expect(llamada).not.toHaveBeenCalled();
  });

  test('una respuesta del modelo que no es JSON no se da por leida', async () => {
    llamada.mockResolvedValue({ content: 'No puedo leer este documento.', model: 'x' });

    const r = await aiService.extractDocumentData(doc(fichero('bl3.pdf', Buffer.from('%PDF')), 'application/pdf'));

    expect(r).toMatchObject({ leido: false, legible: false });
  });
});

describe('prepararImagen', () => {
  test('lo que no es imagen se devuelve tal cual', async () => {
    const bytes = Buffer.from('%PDF');
    expect(await prepararImagen(bytes, 'application/pdf')).toEqual({ bytes, mimeType: 'application/pdf', reducida: false });
    expect(esImagen('application/pdf')).toBe(false);
  });

  test('una imagen de muchos pixeles se reduce aunque pese poco', async () => {
    const enorme = await sharp({ create: { width: 6000, height: 4500, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
    const r = await prepararImagen(enorme, 'image/jpeg');

    expect(r.reducida).toBe(true);
    expect((await sharp(r.bytes).metadata()).width).toBe(3000);
  });

  test('un TIFF se convierte a JPEG, que es lo que admite el modelo', async () => {
    const tiff = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#ffffff' } }).tiff().toBuffer();
    const r = await prepararImagen(tiff, 'image/tiff');

    expect(r).toMatchObject({ mimeType: 'image/jpeg', reducida: true });
  });
});
