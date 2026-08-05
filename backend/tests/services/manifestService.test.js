/**
 * manifestService: lee un manifiesto CSV, clasifica las mercancias con IA y
 * genera datos de declaraciones H7 por linea.
 *
 * Es un singleton SIN base de datos y SIN persistencia: parseCSV/_mapHeaders/
 * _parseCSVLine son logica pura (parseo, deteccion de delimitador, mapeo de
 * ~200 alias de cabecera), y processManifest construye OBJETOS JS planos (no
 * documentos Mongoose). La unica frontera de red es `aiService.callClaude`
 * (Bedrock), que se carga lazy en `this.aiService`. NO se mockea el codigo bajo
 * prueba: se sustituye SOLO esa frontera inyectando un `callClaude` falso local
 * en `manifestService.aiService`, de modo que toda la logica de troceo,
 * extraccion de JSON, fallback y generacion H7 se ejecuta de verdad.
 *
 * jest.config tiene resetMocks:true; por eso el fake se reinstala en beforeEach.
 */

const manifestService = require('../../src/services/manifestService');

// callClaude falso: devuelve lo que el test configure. Sustituye SOLO la
// frontera de red; no toca la logica de manifestService.
let fakeCallClaude;
beforeEach(() => {
  fakeCallClaude = jest.fn();
  manifestService.aiService = { callClaude: fakeCallClaude };
});
afterEach(() => {
  manifestService.aiService = null; // fuerza el lazy-load real en el proximo uso
});

const buf = (s) => Buffer.from(s, 'utf-8');

// Respuesta de IA valida (JSON array crudo) para una sola linea elegible.
const iaOk = (items) => JSON.stringify(items);

describe('parseCSV', () => {
  test('parsea cabecera + filas, mapea campos y asigna lineNumber', () => {
    const csv = 'tracking,description,value\nAA1,Camiseta,50\nBB2,Zapato,80';
    const r = manifestService.parseCSV(csv && buf(csv));
    expect(r.totalRows).toBe(2);
    expect(r.rows[0]).toMatchObject({ tracking: 'AA1', description: 'Camiseta', value: '50', lineNumber: 1 });
    expect(r.rows[1].lineNumber).toBe(2);
    expect(r.headerMap['tracking']).toBe('tracking');
  });

  test('elimina el BOM inicial', () => {
    const r = manifestService.parseCSV(buf('﻿tracking,value\nAA1,10'));
    expect(r.headers[0]).toBe('tracking');
    expect(r.rows[0].tracking).toBe('AA1');
  });

  test('lanza si hay menos de 2 lineas', () => {
    expect(() => manifestService.parseCSV(buf('solo_cabecera'))).toThrow(/al menos una cabecera/i);
  });

  test('auto-detecta delimitador tab', () => {
    const r = manifestService.parseCSV(buf('tracking\tvalue\nAA1\t10'));
    expect(r.rows[0]).toMatchObject({ tracking: 'AA1', value: '10' });
  });

  test('auto-detecta delimitador punto y coma', () => {
    const r = manifestService.parseCSV(buf('tracking;value\nAA1;10'));
    expect(r.rows[0]).toMatchObject({ tracking: 'AA1', value: '10' });
  });

  test('normaliza acentos y comillas en cabeceras (descripción -> description)', () => {
    // "descripción" (con tilde) esta en el diccionario como "descripcion"
    const r = manifestService.parseCSV(buf('"descripción","valor"\n"Camiseta",50'));
    expect(r.headerMap['descripcion']).toBe('description');
    expect(r.rows[0].description).toBe('Camiseta');
    expect(r.rows[0].value).toBe('50');
  });

  test('salta filas totalmente vacias', () => {
    const r = manifestService.parseCSV(buf('tracking,value\nAA1,10\n\n   \nBB2,20'));
    expect(r.totalRows).toBe(2);
    expect(r.rows.map(x => x.tracking)).toEqual(['AA1', 'BB2']);
  });

  test('respeta delimitador explicito y campos entrecomillados con comas internas', () => {
    const r = manifestService.parseCSV(buf('tracking,description\nAA1,"Camiseta, roja, algodon"'), ',');
    expect(r.rows[0].description).toBe('Camiseta, roja, algodon');
  });

  test('cabeceras no reconocidas quedan sin mapear (null) y no crean campo en la fila', () => {
    const r = manifestService.parseCSV(buf('tracking,columna_rara\nAA1,xyz'));
    expect(r.headerMap['columna_rara']).toBeNull();
    expect(r.rows[0]).not.toHaveProperty('columna_rara');
    expect(r.rows[0].tracking).toBe('AA1');
  });
});

describe('_mapHeaders (alias de cabecera)', () => {
  test('mapea sinonimos ES/EN al campo estandar', () => {
    const m = manifestService._mapHeaders(['awb', 'destinatario', 'importe', 'peso_neto', 'ioss']);
    expect(m).toMatchObject({
      awb: 'tracking', destinatario: 'recipientName',
      importe: 'value', peso_neto: 'netWeight', ioss: 'iossNumber'
    });
  });

  test('normaliza espacios/guiones/puntos antes de buscar', () => {
    const m = manifestService._mapHeaders(['tracking number', 'sender-name', 'gross.weight']);
    expect(m['tracking number']).toBe('tracking');
    expect(m['sender-name']).toBe('senderName');
    expect(m['gross.weight']).toBe('weight');
  });

  test('devuelve null para cabecera desconocida', () => {
    expect(manifestService._mapHeaders(['no_existe'])['no_existe']).toBeNull();
  });
});

describe('_parseCSVLine', () => {
  test('separa por delimitador respetando comillas', () => {
    expect(manifestService._parseCSVLine('a,"b,c",d', ',')).toEqual(['a', 'b,c', 'd']);
  });

  test('comillas simples tambien alternan el estado', () => {
    expect(manifestService._parseCSVLine("x,'y;z',w", ',')).toEqual(['x', 'y;z', 'w']);
  });
});

describe('classifyWithAI', () => {
  test('parsea un JSON array crudo devuelto por la IA', async () => {
    fakeCallClaude.mockResolvedValue({ content: iaOk([
      { line: 1, hsCode: '610910', description_normalized: 'Camiseta', eligible_h7: true }
    ]) });
    const r = await manifestService.classifyWithAI([{ description: 'Camiseta', value: '50' }]);
    expect(r).toHaveLength(1);
    expect(r[0].hsCode).toBe('610910');
  });

  test('extrae el JSON de un bloque markdown ```json', async () => {
    fakeCallClaude.mockResolvedValue({
      content: '```json\n' + iaOk([{ line: 1, hsCode: '620520', eligible_h7: true }]) + '\n```'
    });
    const r = await manifestService.classifyWithAI([{ description: 'Camisa', value: '30' }]);
    expect(r[0].hsCode).toBe('620520');
  });

  test('acepta la respuesta como string plano (sin .content ni .message)', async () => {
    fakeCallClaude.mockResolvedValue(iaOk([{ line: 1, hsCode: '999999', eligible_h7: true }]));
    const r = await manifestService.classifyWithAI([{ description: 'X', value: '10' }]);
    expect(r[0].hsCode).toBe('999999');
  });

  test('sin JSON en la respuesta: fallback por valor (<=150 -> elegible)', async () => {
    fakeCallClaude.mockResolvedValue({ message: 'lo siento, no puedo clasificar' });
    const r = await manifestService.classifyWithAI([
      { description: 'Barato', value: '50' },
      { description: 'Caro', value: '500' }
    ]);
    expect(r[0].eligible_h7).toBe(true);
    expect(r[0].reason).toMatch(/no disponible/i);
    expect(r[1].eligible_h7).toBe(false); // 500 > 150
  });

  test('si callClaude lanza, degrada al fallback por error sin romper', async () => {
    fakeCallClaude.mockRejectedValue(new Error('Bedrock timeout'));
    const r = await manifestService.classifyWithAI([{ description: 'X', value: '20' }]);
    expect(r).toHaveLength(1);
    expect(r[0].eligible_h7).toBe(true);
    expect(r[0].reason).toMatch(/Error en clasificacion/i);
  });

  test('trocea en lotes: 2 lotes de batchSize=1 = 2 llamadas', async () => {
    fakeCallClaude.mockImplementation(async () => ({ content: iaOk([{ line: 1, hsCode: '610910', eligible_h7: true }]) }));
    const rows = [{ description: 'A', value: '10' }, { description: 'B', value: '20' }];
    const r = await manifestService.classifyWithAI(rows, 1);
    expect(fakeCallClaude).toHaveBeenCalledTimes(2);
    expect(r).toHaveLength(2);
  });

  test('lazy-load real de aiService cuando no se ha inyectado (require de ./aiService)', async () => {
    // Al ponerlo a null se dispara el require real. aiService.callClaude sin
    // credenciales Bedrock rechaza -> cae en el catch (fallback). No mockeamos
    // el codigo bajo prueba: solo comprobamos que el lazy-load no revienta.
    manifestService.aiService = null;
    const r = await manifestService.classifyWithAI([{ description: 'X', value: '10' }]);
    expect(r).toHaveLength(1);
    expect(r[0]).toHaveProperty('eligible_h7');
  });
});

describe('processManifest', () => {
  test('genera una H7 completa con defaults para una linea elegible', async () => {
    fakeCallClaude.mockResolvedValue({ content: iaOk([
      { line: 1, hsCode: '61091000', description_normalized: 'Camiseta algodon', eligible_h7: true }
    ]) });
    const csv = 'tracking,description,value,recipient\nAA1,Camiseta,50,Juan Perez';
    const r = await manifestService.processManifest(buf(csv));

    expect(r.summary.totalRows).toBe(1);
    expect(r.summary.h7Ready).toBe(1);
    expect(r.h7Declarations).toHaveLength(1);
    const h7 = r.h7Declarations[0];
    expect(h7.trackingNumber).toBe('AA1');
    expect(h7.items[0].taricCode).toBe('610910'); // hsCode recortado a 6
    expect(h7.recipient.name).toBe('Juan Perez');
    expect(h7.sender.name).toBe('REMITENTE DESCONOCIDO'); // default
    expect(h7.sender.address.country).toBe('CN');         // default
    expect(h7.recipient.address.country).toBe('ES');      // default
    expect(h7.totals.intrinsicValue).toBe(50);
    expect(h7.items[0].netWeight).toBe(0.1); // default sin peso
  });

  test('un valor > 150 fuerza H1 aunque la IA lo marcase elegible', async () => {
    fakeCallClaude.mockResolvedValue({ content: iaOk([
      { line: 1, hsCode: '610910', eligible_h7: true } // IA se equivoca
    ]) });
    const csv = 'tracking,description,value,recipient\nAA1,Reloj,500,Ana';
    const r = await manifestService.processManifest(buf(csv));
    expect(r.summary.h7Ready).toBe(0);
    expect(r.summary.h1Required).toBe(1);
    expect(r.h1Required[0].reason).toMatch(/supera 150/i);
  });

  test('la IA puede marcar no-elegible por restriccion (mercancia prohibida)', async () => {
    fakeCallClaude.mockResolvedValue({ content: iaOk([
      { line: 1, hsCode: '', eligible_h7: false, reason: 'Mercancia restringida' }
    ]) });
    const csv = 'tracking,description,value,recipient\nAA1,Tabaco,20,Ana';
    const r = await manifestService.processManifest(buf(csv));
    expect(r.summary.h1Required).toBe(1);
    expect(r.h1Required[0].reason).toBe('Mercancia restringida');
  });

  test('acumula errores de validacion sin generar H7 (falta tracking/description/recipient, valor<=0)', async () => {
    fakeCallClaude.mockResolvedValue({ content: iaOk([
      { line: 1, eligible_h7: true }
    ]) });
    // fila elegible pero sin tracking, sin recipient y valor 0
    const csv = 'description,value\nSoloDesc,0';
    const r = await manifestService.processManifest(buf(csv));
    expect(r.summary.h7Ready).toBe(0);
    expect(r.summary.errors).toBe(1);
    expect(r.errors[0].errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/Falta tracking/),
      expect.stringMatching(/nombre destinatario/),
      expect.stringMatching(/Valor debe ser/)
    ]));
  });

  test('respeta carrier e iossNumber de options y del propio row', async () => {
    fakeCallClaude.mockResolvedValue({ content: iaOk([
      { line: 1, hsCode: '610910', eligible_h7: true },
      { line: 2, hsCode: '620520', eligible_h7: true }
    ]) });
    const csv = 'tracking,description,value,recipient,ioss\n' +
                'AA1,Camiseta,50,Juan,IM1112223334\n' +
                'BB2,Camisa,60,Ana,';
    const r = await manifestService.processManifest(buf(csv), { carrier: 'DHL', iossNumber: 'IM9998887776' });
    expect(r.h7Declarations[0].carrier).toEqual({ code: 'DHL', name: 'DHL' });
    expect(r.h7Declarations[0].iossNumber).toBe('IM1112223334'); // el del row gana
    expect(r.h7Declarations[1].iossNumber).toBe('IM9998887776'); // fallback al de options
  });

  test('reparte una mezcla en h7/h1/errores', async () => {
    fakeCallClaude.mockResolvedValue({ content: iaOk([
      { line: 1, hsCode: '610910', eligible_h7: true },   // OK
      { line: 2, hsCode: '', eligible_h7: false, reason: 'Restringida' }, // H1
      { line: 3, hsCode: '620520', eligible_h7: true }    // error (sin recipient)
    ]) });
    const csv = 'tracking,description,value,recipient\n' +
                'AA1,Camiseta,50,Juan\n' +
                'BB2,Tabaco,20,Ana\n' +
                'CC3,Camisa,30,';
    const r = await manifestService.processManifest(buf(csv));
    expect(r.summary).toMatchObject({ totalRows: 3, h7Ready: 1, h1Required: 1, errors: 1 });
  });
});
