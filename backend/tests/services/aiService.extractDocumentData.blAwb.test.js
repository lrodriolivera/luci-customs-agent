/**
 * Lectura de un BL y de un AWB reales (prueba en produccion del 13/Nov/2026,
 * alta desde documentos). El modelo esta simulado: devuelve lo que devolvio
 * en produccion (nombres y datos de contacto de las partes sustituidos por otros de prueba), y la salida normalizada
 * tiene que corregir lo que se leyo mal sin estropear lo que se leyo bien.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const aiService = require('../../src/services/aiService');
const { SYSTEM_PROMPT, normalizarExtraccion } = require('../../src/services/documentos/extraccionDocumento');

// BL de T.S. Lines, Haiphong -> Manila.
const LECTURA_BL = {
  legible: true, tipoDetectado: 'bill_of_lading', confianza: 92, notas: [],
  exportador: { nombre: 'SAIL TRADING COMPANY LIMITED', direccion: 'HAIPHONG, VIETNAM', ciudad: 'HAIPHONG', pais: 'VN' },
  importador: {
    nombre: 'EMERALDS COAST TRADING CORPORATION', identificacionFiscal: 'TIN: 010-123-456-000',
    direccion: 'MANILA, PHILIPPINES', ciudad: 'MANILA', pais: 'PH', telefono: '+63 2 8123 4567', email: 'IMPORT@EMERALDSCOAST.PH'
  },
  factura: { numero: null, fecha: null, moneda: null, importeTotal: null, incoterm: null, lugarIncoterm: null },
  transporte: {
    numeroDocumento: 'TSLHPHMNL2601234', medio: 'TS HAKATA', puertoCarga: 'HAIPHONG, VIETNAM', puertoDescarga: 'MANILA, PHILIPPINES',
    contenedores: ['MAGU5810422/40HQ', 'TSB2716891', 'MAGU5599236/40HQ', 'TSB2716818', 'TXGU7359270/40HQ', 'TSB2716718'],
    tipoCarga: 'FCL'
  },
  partidas: [{
    descripcion: 'PHENOLIC BOARD', codigoMercancia: '441234', cantidad: 54, unidad: 'PACKAGES',
    bultos: 54, tipoBulto: 'PACKAGES', pesoBrutoKg: 84000
  }],
  totales: { bultos: 54, pesoBrutoKg: 84000 }
};

// AWB de OIA Global, Cleveland -> Ciudad de Mexico. Con la regla nueva el
// modelo debe leer la hija y el vuelo; se simula tal como la regla los pide.
const LECTURA_AWB = {
  legible: true, tipoDetectado: 'air_waybill', confianza: 90,
  notas: ['Los cargos figuran como «As Agreed».'],
  exportador: { nombre: 'SHIPPER DE PRUEBA LLC', direccion: '28775 AURORA RD', ciudad: 'SOLON OH', codigoPostal: '44139', pais: 'US', telefono: '+1 440 248 0400' },
  importador: {
    nombre: 'ELECTRONICA 2000 DE MEXICO SA', direccion: 'CALLE 1509 95, SAN JUAN DE ARAGON 6TA SECC',
    ciudad: 'CMX', codigoPostal: '07918', pais: 'MX'
  },
  factura: { numero: null, fecha: '2018-01-23', moneda: 'USD', importeTotal: null, incoterm: 'EXW', lugarIncoterm: null },
  transporte: {
    numeroDocumento: '406-60018696', documentoHijo: 'S00705318', medio: '5X 1441/23, 5X 320/24',
    puertoCarga: 'CLEVELAND (CLE)', puertoDescarga: 'MEXICO CITY (MEX)', contenedores: [], tipoCarga: null
  },
  partidas: [{ descripcion: 'ELECTRONIC INSTRUMENTS', bultos: 1, pesoBrutoKg: 60 }],
  totales: { bultos: 1, pesoBrutoKg: 60 }
};

let dir;
const leer = async (lectura, type) => {
  jest.spyOn(aiService, 'callClaudeWithDocument').mockResolvedValue({ content: JSON.stringify(lectura), model: 'global.anthropic.claude-sonnet-5' });
  const filePath = path.join(dir, `${type}.pdf`);
  fs.writeFileSync(filePath, Buffer.from('%PDF-1.4 prueba'));
  return aiService.extractDocumentData({ filePath, mimeType: 'application/pdf', originalName: `${type}.pdf`, type });
};

beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'luci-bl-awb-')); });
afterAll(() => { fs.rmSync(dir, { recursive: true, force: true }); });
afterEach(() => { jest.restoreAllMocks(); });

describe('lectura de un BL real (T.S. Lines)', () => {
  test('los contenedores son solo las tres matriculas; los TSB son los precintos', async () => {
    const r = await leer(LECTURA_BL, 'other');

    expect(r.transporte.contenedores).toEqual(['MAGU5810422', 'MAGU5599236', 'TXGU7359270']);
    expect(r.transporte.precintos).toEqual(['TSB2716891', 'TSB2716818', 'TSB2716718']);
    expect(r.notas.some(n => n.includes('TSB2716891') && /precinto/i.test(n))).toBe(true);
    expect(r.notas.some(n => n.includes('MAGU5810422') && /d[ií]gito de control/i.test(n))).toBe(true);
  });

  test('los bultos no se toman por cantidad de mercancia', async () => {
    const r = await leer(LECTURA_BL, 'bill_of_lading');

    expect(r.partidas[0]).toMatchObject({ cantidad: null, unidad: null, bultos: 54, tipoBulto: 'PK' });
  });

  test('lo que se leia bien sigue igual', async () => {
    const r = await leer(LECTURA_BL, 'bill_of_lading');

    expect(r).toMatchObject({ leido: true, legible: true, tipoDetectado: 'bill_of_lading' });
    expect(r.exportador).toMatchObject({ nombre: 'SAIL TRADING COMPANY LIMITED', ciudad: 'HAIPHONG', pais: 'VN' });
    expect(r.importador).toMatchObject({
      nombre: 'EMERALDS COAST TRADING CORPORATION', identificacionFiscal: 'TIN: 010-123-456-000',
      telefono: '+63 2 8123 4567', email: 'import@emeraldscoast.ph', ciudad: 'MANILA', pais: 'PH'
    });
    expect(r.transporte).toMatchObject({
      numeroDocumento: 'TSLHPHMNL2601234', medio: 'TS HAKATA', puertoCarga: 'HAIPHONG, VIETNAM',
      puertoDescarga: 'MANILA, PHILIPPINES', tipoCarga: 'FCL', documentoHijo: null
    });
    expect(r.partidas[0]).toMatchObject({ descripcion: 'PHENOLIC BOARD', codigoMercancia: '441234', pesoBrutoKg: 84000 });
    expect(r.totales).toMatchObject({ bultos: 54, pesoBrutoKg: 84000 });
  });
});

describe('lectura de un AWB real (OIA Global)', () => {
  test('la fecha del AWB no es la de una factura: el documento de transporte no rellena la factura', async () => {
    const r = await leer(LECTURA_AWB, 'air_waybill');

    expect(r.factura).toEqual({ numero: null, fecha: null, importeTotal: null, moneda: 'USD', incoterm: 'EXW', lugarIncoterm: null });
  });

  test('la ciudad va sin el codigo del estado', async () => {
    const r = await leer(LECTURA_AWB, 'air_waybill');

    expect(r.exportador).toMatchObject({ ciudad: 'SOLON', codigoPostal: '44139', pais: 'US' });
    expect(r.importador).toMatchObject({ ciudad: 'CIUDAD DE MEXICO', codigoPostal: '07918', pais: 'MX' });
  });

  test('el medio es el primer vuelo; la AWB hija y los otros vuelos se leen y se anotan', async () => {
    const r = await leer(LECTURA_AWB, 'air_waybill');

    expect(r.transporte).toMatchObject({ numeroDocumento: '406-60018696', documentoHijo: 'S00705318', medio: '5X 1441' });
    expect(r.notas.some(n => n.includes('S00705318'))).toBe(true);
    expect(r.notas.some(n => n.includes('5X 320'))).toBe(true);
  });

  test('lo que se leia bien sigue igual, incluida la nota de «As Agreed»', async () => {
    const r = await leer(LECTURA_AWB, 'air_waybill');

    expect(r.notas[0]).toBe('Los cargos figuran como «As Agreed».');
    expect(r.exportador).toMatchObject({ nombre: 'SHIPPER DE PRUEBA LLC', direccion: '28775 AURORA RD', telefono: '+1 440 248 0400' });
    expect(r.importador).toMatchObject({ nombre: 'ELECTRONICA 2000 DE MEXICO SA', direccion: 'CALLE 1509 95, SAN JUAN DE ARAGON 6TA SECC' });
    expect(r.transporte).toMatchObject({ puertoCarga: 'CLEVELAND (CLE)', puertoDescarga: 'MEXICO CITY (MEX)', contenedores: [], precintos: [] });
    expect(r.partidas[0]).toMatchObject({ bultos: 1, pesoBrutoKg: 60 });
    expect(r.totales).toMatchObject({ bultos: 1, pesoBrutoKg: 60 });
  });
});

describe('reglas de la lectura', () => {
  test('una factura conserva numero, fecha e importe', () => {
    const d = normalizarExtraccion({
      tipoDetectado: 'commercial_invoice',
      factura: { numero: 'INV-1', fecha: '2026-03-04', moneda: 'USD', importeTotal: 1000 },
      partidas: [{ cantidad: 480, unidad: 'PCE', importe: 1000 }]
    });

    expect(d.factura).toMatchObject({ numero: 'INV-1', fecha: '2026-03-04', importeTotal: 1000 });
    expect(d.partidas[0]).toMatchObject({ cantidad: 480, unidad: 'PCE', importe: 1000 });
  });

  test('si el modelo no reconoce el tipo, manda el que dio el agente', () => {
    const datos = { tipoDetectado: 'other', factura: { numero: 'X1', fecha: '2026-01-01', importeTotal: 5 }, partidas: [{ importe: 5 }] };

    expect(normalizarExtraccion(datos, { tipoDeclarado: 'cmr' }).factura).toMatchObject({ numero: null, fecha: null, importeTotal: null });
    expect(normalizarExtraccion(datos, { tipoDeclarado: 'cmr' }).partidas[0].importe).toBeNull();
    expect(normalizarExtraccion(datos, { tipoDeclarado: 'commercial_invoice' }).factura.numero).toBe('X1');
  });

  test('una cantidad en bultos sin bultos leidos pasa a los bultos', () => {
    const d = normalizarExtraccion({ partidas: [{ cantidad: 12, unidad: 'CTNS' }] });

    expect(d.partidas[0]).toMatchObject({ cantidad: null, unidad: null, bultos: 12, tipoBulto: 'CT' });
  });

  test('el prompt pide separar precintos, no usar bultos como cantidad, la AWB hija, el vuelo y la ciudad sin estado', () => {
    expect(SYSTEM_PROMPT).toContain('"precintos"');
    expect(SYSTEM_PROMPT).toContain('"documentoHijo"');
    expect(SYSTEM_PROMPT).toMatch(/ISO 6346/);
    expect(SYSTEM_PROMPT).toMatch(/HAWB/);
    expect(SYSTEM_PROMPT).toMatch(/bultos.*NUNCA.*cantidad|cantidad.*NUNCA.*bultos/i);
    expect(SYSTEM_PROMPT).toMatch(/codigo del estado/i);
    expect(SYSTEM_PROMPT).toMatch(/documento de transporte.*factura/i);
  });
});
