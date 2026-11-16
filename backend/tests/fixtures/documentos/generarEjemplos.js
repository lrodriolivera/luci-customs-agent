#!/usr/bin/env node
/**
 * Genera los documentos de EJEMPLO (SPECIMEN) de esta carpeta: un CMR y un
 * documento de acompañamiento de tránsito T1. Datos ficticios, para probar la
 * lectura de documentos de LUCI sin documentos reales de clientes.
 *
 * Uso (desde backend/):  node tests/fixtures/documentos/generarEjemplos.js
 *
 * Estructura oficial en la que se basan:
 *  - CMR: Convenio relativo al contrato de transporte internacional de
 *    mercancías por carretera (Ginebra, 19/May/1956), art. 6 (contenido de la
 *    carta de porte). Instrumento de adhesión de España: BOE núm. 109, de
 *    7/May/1974. Casillas numeradas del formulario modelo IRU (1-24).
 *  - T1: Reglamento de Ejecución (UE) 2015/2447, anexo B, título II, capítulo
 *    «Documento de acompañamiento de tránsito» (formato y datos del DAT/TAD,
 *    modelo de la fase 5 del NCTS); datos del Reglamento Delegado (UE)
 *    2015/2446, anexo B (columnas D1/D2/D3 del tránsito).
 *
 * Escenario (coherente con tests/services/extraccionDocumento.cmrT1.test.js):
 * un camión turco (34 ABC 123, remolque 34 XYZ 98) lleva camisetas de
 * Estambul a Madrid y entra en la UE por Bulgaria al amparo de un T1.
 */
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const CARPETA = __dirname;
const AVISO = 'EJEMPLO / SPECIMEN - Documento sintético para pruebas de LUCI. Datos ficticios. Sin validez legal ni aduanera.';

const DATOS = {
  remitente: ['EJEMPLO TEKSTIL SANAYI A.S. (SPECIMEN)', 'Organize Sanayi Bolgesi 12. Cadde No 4', '34555 Istanbul', 'TURQUIA (TR)', 'EORI TR0000000000EJ01'],
  destinatario: ['DISTRIBUCIONES EJEMPLO SL (SPECIMEN)', 'Calle Ficticia 1, nave 3', '28001 Madrid', 'ESPAÑA (ES)', 'EORI ESB00000000'],
  transportista: ['TRANSPORTES EJEMPLO LOJISTIK LTD (SPECIMEN)', 'Lojistik Caddesi 7', '34500 Istanbul, TURQUIA (TR)'],
  tractora: '34 ABC 123',
  remolque: '34 XYZ 98',
  paisMatricula: 'TR',
  cmr: 'EJ-CMR-000118',
  factura: 'INV-EJ-2026-118',
  fechaCarga: '10/11/2026',
  mercancia: {
    marcas: 'EJ-TEX 1/22', bultos: 22, embalaje: 'Palés (PX)', naturaleza: 'Camisetas de algodón de punto',
    sa: '6109.10', pesoBruto: 4380, pesoNeto: 4100, volumen: 38.5
  },
  mrn: '26BG009999000001J8',
  oficinaPartida: 'BG009999',
  oficinaDestino: 'ES009999',
  grn: '26BG0000000000EJ1',
  precintos: ['EJ0001', 'EJ0002']
};

// ---- Utilidades de dibujo -------------------------------------------------------

function marcaDeAgua(doc) {
  doc.save();
  doc.rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] });
  doc.fontSize(64).fillColor('#d9534f').fillOpacity(0.15)
    .text('EJEMPLO / SPECIMEN', 0, doc.page.height / 2 - 40, { width: doc.page.width, align: 'center' });
  doc.restore();
  doc.fillOpacity(1).fillColor('black');
}

function pie(doc) {
  doc.fontSize(7).fillColor('#a00').text(AVISO, 30, doc.page.height - 30, { width: doc.page.width - 60, align: 'center', lineBreak: false });
  doc.fillColor('black');
}

/** Casilla con número, título y líneas de contenido. */
function casilla(doc, { x, y, w, h, n, titulo, lineas = [], tam = 8 }) {
  doc.lineWidth(0.6).rect(x, y, w, h).stroke();
  const rotulo = `${n ? `${n}  ` : ''}${titulo}`;
  doc.fontSize(6).fillColor('#444').text(rotulo, x + 3, y + 2, { width: w - 6 });
  let yy = y + 4 + doc.heightOfString(rotulo, { width: w - 6 });
  doc.fontSize(tam).fillColor('black');
  for (const linea of lineas) {
    doc.text(linea, x + 4, yy, { width: w - 8 });
    yy += tam + 2.5;
  }
}

function crearDocumento(nombre) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 30, left: 30, right: 30, bottom: 0 }, info: { Title: nombre, Author: 'LUCI - ejemplo sintético', Subject: AVISO } });
  const ruta = path.join(CARPETA, nombre);
  const salida = fs.createWriteStream(ruta);
  doc.pipe(salida);
  return { doc, ruta, terminado: new Promise((ok, mal) => { salida.on('finish', ok); salida.on('error', mal); }) };
}

// ---- CMR ----------------------------------------------------------------------------

function dibujarCmr(doc) {
  const d = DATOS;
  const m = d.mercancia;
  const X = 30;
  const W = 535;
  const mitad = W / 2;

  doc.fontSize(14).text('CARTA DE PORTE INTERNACIONAL - CMR', X, 30, { width: W, align: 'center' });
  doc.fontSize(7).text('Este transporte queda sometido, no obstante toda cláusula contraria, al Convenio relativo al contrato de transporte internacional de mercancías por carretera (CMR).', X, 48, { width: W, align: 'center' });
  doc.fontSize(9).text(`Nº ${d.cmr}`, X, 62, { width: W, align: 'right' });

  let y = 76;
  casilla(doc, { x: X, y, w: mitad, h: 74, n: 1, titulo: 'Remitente (nombre, domicilio, país) / Sender', lineas: d.remitente });
  casilla(doc, { x: X + mitad, y, w: mitad, h: 74, n: 16, titulo: 'Porteador (nombre, domicilio, país) / Carrier', lineas: [...d.transportista, `Matrícula tractora: ${d.paisMatricula} ${d.tractora}`, `Matrícula remolque: ${d.paisMatricula} ${d.remolque}`] });
  y += 74;
  casilla(doc, { x: X, y, w: mitad, h: 66, n: 2, titulo: 'Destinatario (nombre, domicilio, país) / Consignee', lineas: d.destinatario });
  casilla(doc, { x: X + mitad, y, w: mitad, h: 66, n: 17, titulo: 'Porteadores sucesivos / Successive carriers', lineas: ['-'] });
  y += 66;
  casilla(doc, { x: X, y, w: mitad, h: 34, n: 3, titulo: 'Lugar previsto para la entrega de la mercancía (lugar, país)', lineas: ['Madrid, ESPAÑA (ES)'] });
  casilla(doc, { x: X + mitad, y, w: mitad, h: 68, n: 18, titulo: 'Reservas y observaciones del porteador', lineas: ['Sin reservas.', `Precintos aduaneros: ${d.precintos.join(', ')}`] });
  y += 34;
  casilla(doc, { x: X, y, w: mitad, h: 34, n: 4, titulo: 'Lugar y fecha de carga de la mercancía (lugar, país, fecha)', lineas: [`Istanbul, TURQUIA (TR), ${d.fechaCarga}`] });
  y += 34;
  casilla(doc, { x: X, y, w: W, h: 34, n: 5, titulo: 'Documentos anexos / Documents attached', lineas: [`Factura comercial ${d.factura}; packing list; documento de acompañamiento de tránsito T1 MRN ${d.mrn}`] });
  y += 34;

  // Casillas 6 a 12: una fila de mercancía.
  const columnas = [
    { n: 6, t: 'Marcas y números', w: 70, v: m.marcas },
    { n: 7, t: 'Número de bultos', w: 50, v: String(m.bultos) },
    { n: 8, t: 'Clase de embalaje', w: 60, v: m.embalaje },
    { n: 9, t: 'Naturaleza de la mercancía', w: 135, v: m.naturaleza },
    { n: 10, t: 'Nº estadístico', w: 60, v: m.sa },
    { n: 11, t: 'Peso bruto, kg', w: 80, v: m.pesoBruto.toLocaleString('es-ES') },
    { n: 12, t: 'Volumen, m3', w: 80, v: String(m.volumen).replace('.', ',') }
  ];
  let xx = X;
  for (const c of columnas) {
    casilla(doc, { x: xx, y, w: c.w, h: 60, n: c.n, titulo: c.t, lineas: [c.v], tam: 9 });
    xx += c.w;
  }
  y += 60;

  casilla(doc, { x: X, y, w: mitad, h: 46, n: 13, titulo: 'Instrucciones del remitente (formalidades aduaneras y otras)', lineas: ['Mercancía en tránsito T1 hasta la aduana de destino ES009999.', 'Despacho a libre práctica en destino.'] });
  casilla(doc, { x: X + mitad, y, w: mitad, h: 46, n: 19, titulo: 'Estipulaciones particulares', lineas: ['-'] });
  y += 46;
  casilla(doc, { x: X, y, w: mitad / 2, h: 34, n: 14, titulo: 'Forma de pago', lineas: ['Porte pagado (DAP Madrid)'] });
  casilla(doc, { x: X + mitad / 2, y, w: mitad / 2, h: 34, n: 15, titulo: 'Reembolso', lineas: ['-'] });
  casilla(doc, { x: X + mitad, y, w: mitad, h: 34, n: 20, titulo: 'A pagar por: remitente / destinatario', lineas: ['Flete: remitente'] });
  y += 34;
  casilla(doc, { x: X, y, w: W, h: 26, n: 21, titulo: 'Formalizado en / Established in', lineas: [`Istanbul, a ${d.fechaCarga}`] });
  y += 26;
  const tercio = W / 3;
  casilla(doc, { x: X, y, w: tercio, h: 60, n: 22, titulo: 'Firma y sello del remitente', lineas: ['(firma de EJEMPLO)'] });
  casilla(doc, { x: X + tercio, y, w: tercio, h: 60, n: 23, titulo: 'Firma y sello del transportista', lineas: ['(firma de EJEMPLO)'] });
  casilla(doc, { x: X + 2 * tercio, y, w: tercio, h: 60, n: 24, titulo: 'Mercancía recibida (lugar, fecha, firma del destinatario)', lineas: ['Madrid, __/__/2026'] });
  y += 60;
  casilla(doc, { x: X, y, w: W, h: 26, n: 25, titulo: 'Matrícula / Registration (tractora - remolque)', lineas: [`${d.paisMatricula} ${d.tractora}  -  ${d.paisMatricula} ${d.remolque}`] });
}

// ---- T1 (documento de acompañamiento de tránsito) ---------------------------------

function dibujarT1(doc) {
  const d = DATOS;
  const m = d.mercancia;
  const X = 30;
  const W = 535;
  const mitad = W / 2;

  doc.fontSize(13).text('DOCUMENTO DE ACOMPAÑAMIENTO DE TRÁNSITO', X, 30, { width: W, align: 'center' });
  doc.fontSize(8).text('Transit Accompanying Document (TAD) - NCTS fase 5 - Reglamento de Ejecución (UE) 2015/2447, anexo B', X, 47, { width: W, align: 'center' });

  let y = 62;
  casilla(doc, { x: X, y, w: mitad, h: 36, titulo: 'MRN', lineas: [d.mrn], tam: 11 });
  doc.fontSize(6).fillColor('#444').text('(código de barras omitido en el ejemplo)', X + 150, y + 22, { width: 110 }).fillColor('black');
  casilla(doc, { x: X + mitad, y, w: mitad / 2, h: 36, titulo: 'Tipo de declaración', lineas: ['T1'], tam: 11 });
  casilla(doc, { x: X + mitad * 1.5, y, w: mitad / 2, h: 36, titulo: 'Nº de partidas / Bultos totales', lineas: [`1 / ${m.bultos}`], tam: 11 });
  y += 36;
  casilla(doc, { x: X, y, w: mitad / 2, h: 30, titulo: 'Masa bruta total (kg)', lineas: [m.pesoBruto.toLocaleString('es-ES')] });
  casilla(doc, { x: X + mitad / 2, y, w: mitad / 2, h: 30, titulo: 'Fecha de aceptación', lineas: ['11/11/2026'] });
  casilla(doc, { x: X + mitad, y, w: mitad / 2, h: 30, titulo: 'Fecha límite', lineas: ['19/11/2026'] });
  casilla(doc, { x: X + mitad * 1.5, y, w: mitad / 2, h: 30, titulo: 'Resultado del control', lineas: ['A1 - Conforme'] });
  y += 30;
  casilla(doc, { x: X, y, w: mitad, h: 30, titulo: 'Aduana de partida', lineas: [`${d.oficinaPartida} (ficticia)`] });
  casilla(doc, { x: X + mitad, y, w: mitad, h: 30, titulo: 'Aduana de destino', lineas: [`${d.oficinaDestino} (ficticia)`] });
  y += 30;
  casilla(doc, { x: X, y, w: W, h: 24, titulo: 'Aduanas de paso / Customs offices of transit', lineas: ['- (no hay: todo el recorrido es por territorio de la UE)'] });
  y += 24;
  casilla(doc, { x: X, y, w: mitad, h: 66, titulo: 'Titular del régimen de tránsito', lineas: d.transportista });
  casilla(doc, { x: X + mitad, y, w: mitad, h: 66, titulo: 'Expedidor / Consignor', lineas: d.remitente });
  y += 66;
  casilla(doc, { x: X, y, w: mitad, h: 66, titulo: 'Destinatario / Consignee', lineas: d.destinatario });
  casilla(doc, { x: X + mitad, y, w: mitad / 2, h: 66, titulo: 'País de expedición', lineas: ['TR'] });
  casilla(doc, { x: X + mitad * 1.5, y, w: mitad / 2, h: 66, titulo: 'País de destino', lineas: ['ES'] });
  y += 66;
  casilla(doc, { x: X, y, w: mitad, h: 44, titulo: 'Medio de transporte a la partida (tipo, identificación, nacionalidad)', lineas: ['30 - matrícula del vehículo', `${d.tractora.replace(/\s/g, '')} / ${d.remolque.replace(/\s/g, '')}`, `Nacionalidad: ${d.paisMatricula}`] });
  casilla(doc, { x: X + mitad, y, w: mitad, h: 44, titulo: 'Medio de transporte activo en frontera (aduana, tipo, identificación, nacionalidad)', lineas: [`${d.oficinaPartida} - 30 - ${d.tractora.replace(/\s/g, '')}`, `Nacionalidad: ${d.paisMatricula}`] });
  y += 44;
  casilla(doc, { x: X, y, w: mitad / 2, h: 30, titulo: 'Contenedor', lineas: ['0 - No'] });
  casilla(doc, { x: X + mitad / 2, y, w: mitad / 2, h: 30, titulo: 'Modo en frontera', lineas: ['3 - Carretera'] });
  casilla(doc, { x: X + mitad, y, w: mitad, h: 30, titulo: 'Precintos (número / identificadores)', lineas: [`${d.precintos.length} / ${d.precintos.join(', ')}`] });
  y += 30;
  casilla(doc, { x: X, y, w: W, h: 24, titulo: 'Garantía (tipo / GRN)', lineas: [`1 - garantía global / ${d.grn} (ficticia)`] });
  y += 30;

  doc.fontSize(9).text('PARTIDAS / GOODS ITEMS', X, y);
  y += 12;
  const columnas = [
    { t: 'Partida', w: 40, v: '1' },
    { t: 'Código SA', w: 55, v: m.sa.replace('.', '') },
    { t: 'Descripción', w: 140, v: m.naturaleza },
    { t: 'Bultos (tipo, nº, marcas)', w: 110, v: `PX, ${m.bultos}, ${m.marcas}` },
    { t: 'Masa bruta (kg)', w: 65, v: m.pesoBruto.toLocaleString('es-ES') },
    { t: 'Masa neta (kg)', w: 60, v: m.pesoNeto.toLocaleString('es-ES') },
    { t: 'Documentos', w: 65, v: `N730 ${d.cmr}; N380 ${d.factura}` }
  ];
  let xx = X;
  for (const c of columnas) {
    casilla(doc, { x: xx, y, w: c.w, h: 56, titulo: c.t, lineas: [c.v] });
    xx += c.w;
  }
}

// ---- Principal ------------------------------------------------------------------------

async function generar() {
  const generados = [];
  for (const [nombre, dibujar] of [['EJEMPLO-CMR-specimen.pdf', dibujarCmr], ['EJEMPLO-T1-TAD-specimen.pdf', dibujarT1]]) {
    const { doc, ruta, terminado } = crearDocumento(nombre);
    dibujar(doc);
    marcaDeAgua(doc);
    pie(doc);
    doc.end();
    await terminado;
    generados.push(ruta);
  }
  return generados;
}

if (require.main === module) {
  generar()
    .then((rutas) => rutas.forEach((r) => process.stdout.write(`${r}\n`)))
    .catch((err) => { process.stderr.write(`${err.stack}\n`); process.exit(1); });
}

module.exports = { generar, DATOS };
