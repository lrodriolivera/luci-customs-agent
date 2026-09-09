/**
 * aiService.validateDocument — antes simulaba: le pedia al modelo "generar
 * datos de ejemplo" para el tipo de documento sin leer nunca el archivo real
 * subido. Cualquier archivo (irrelevante, en blanco, ilegible) podia recibir
 * isValid:true con datos inventados.
 *
 * Ahora lee el archivo real de disco y lo envia como bloque image/document de
 * Bedrock Converse junto al texto. Si el formato no esta soportado por Converse,
 * o el archivo no se puede leer, o la respuesta del modelo no se puede
 * interpretar, debe fallar a isValid:false (revision manual) -- nunca fingir
 * un exito por falta de evidencia.
 *
 * Frontera mockeada: unicamente el cliente Bedrock (red). Los archivos son
 * reales en /tmp (no se mockea fs) para ejercitar la lectura de verdad.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const aiService = require('../../src/services/aiService');

const textOnlyResponse = (jsonText) => ({
  output: { message: { role: 'assistant', content: [{ text: jsonText }] } },
  usage: { inputTokens: 50, outputTokens: 40 },
  stopReason: 'end_turn'
});

function crearArchivoTemporal(nombre, contenido = 'contenido de prueba') {
  const ruta = path.join(os.tmpdir(), `luci-test-${Date.now()}-${nombre}`);
  fs.writeFileSync(ruta, contenido);
  return ruta;
}

describe('aiService.validateDocument', () => {
  let originalClient;

  beforeEach(() => {
    originalClient = aiService.client;
  });

  afterEach(() => {
    aiService.client = originalClient;
  });

  const stubClient = (response) => {
    const send = jest.fn().mockResolvedValue(response);
    aiService.client = { send };
    return send;
  };

  test('envia el archivo real como bloque de contenido a Bedrock, no solo texto', async () => {
    const ruta = crearArchivoTemporal('factura.pdf', 'PDF-FALSO-PERO-REAL-EN-DISCO');
    const send = stubClient(textOnlyResponse(JSON.stringify({
      isValid: true, confidence: 95, extractedData: { total: 1000 }, autoFillSuggestions: {}
    })));

    const document = { type: 'commercial_invoice', filePath: ruta, mimeType: 'application/pdf', originalName: 'factura.pdf' };
    const expedition = { expeditionId: 'EXP-1', operationType: 'import', client: { companyName: 'ACME' } };

    const result = await aiService.validateDocument(document, expedition);

    expect(result.isValid).toBe(true);
    const contentEnviado = send.mock.calls[0][0].input.messages[0].content;
    const bloqueDocumento = contentEnviado.find(b => b.document);
    expect(bloqueDocumento).toBeDefined();
    expect(bloqueDocumento.document.format).toBe('pdf');
    expect(Buffer.from(bloqueDocumento.document.source.bytes).toString()).toBe('PDF-FALSO-PERO-REAL-EN-DISCO');

    fs.unlinkSync(ruta);
  });

  test('una imagen JPEG se envia como bloque image, no document', async () => {
    const ruta = crearArchivoTemporal('foto.jpg', 'BYTES-DE-IMAGEN');
    const send = stubClient(textOnlyResponse(JSON.stringify({ isValid: true, confidence: 80, extractedData: {} })));

    const document = { type: 'packing_list', filePath: ruta, mimeType: 'image/jpeg', originalName: 'foto.jpg' };
    await aiService.validateDocument(document, { expeditionId: 'EXP-2', client: {} });

    const contentEnviado = send.mock.calls[0][0].input.messages[0].content;
    const bloqueImagen = contentEnviado.find(b => b.image);
    expect(bloqueImagen).toBeDefined();
    expect(bloqueImagen.image.format).toBe('jpeg');

    fs.unlinkSync(ruta);
  });

  test('un formato no soportado por Bedrock Converse (TIFF) no llama al modelo y pide revision manual', async () => {
    const ruta = crearArchivoTemporal('escaneo.tiff', 'x');
    const send = stubClient(textOnlyResponse('{}'));

    const document = { type: 'certificate_origin', filePath: ruta, mimeType: 'image/tiff', originalName: 'escaneo.tiff' };
    const result = await aiService.validateDocument(document, { expeditionId: 'EXP-3', client: {} });

    expect(result.isValid).toBe(false);
    expect(result.notes).toMatch(/no soportado/i);
    expect(send).not.toHaveBeenCalled();

    fs.unlinkSync(ruta);
  });

  test('si el archivo no existe en disco, falla a isValid:false en vez de fingir un analisis', async () => {
    const send = stubClient(textOnlyResponse('{}'));

    const document = { type: 'commercial_invoice', filePath: '/tmp/no-existe-luci-test-12345.pdf', mimeType: 'application/pdf', originalName: 'x.pdf' };
    const result = await aiService.validateDocument(document, { expeditionId: 'EXP-4', client: {} });

    expect(result.isValid).toBe(false);
    expect(result.notes).toMatch(/no se pudo leer/i);
    expect(send).not.toHaveBeenCalled();
  });

  test('si la respuesta del modelo no es JSON interpretable, falla a isValid:false, no a true', async () => {
    // Antes: el catch devolvia isValid:true con confidence:75 -- fingiendo un
    // exito ante una respuesta que no se pudo ni siquiera leer.
    const ruta = crearArchivoTemporal('factura2.pdf', 'contenido');
    stubClient(textOnlyResponse('esto no es JSON en absoluto'));

    const document = { type: 'commercial_invoice', filePath: ruta, mimeType: 'application/pdf', originalName: 'factura2.pdf' };
    const result = await aiService.validateDocument(document, { expeditionId: 'EXP-5', client: {} });

    expect(result.isValid).toBe(false);

    fs.unlinkSync(ruta);
  });
});
