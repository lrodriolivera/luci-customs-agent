/**
 * PDF «H1 definitivo» del portal del cliente: la declaracion tal como la
 * admitio la AEAT (MRN, fecha de admision, partidas con los tributos que
 * liquido y total a pagar) y, con pago previo al levante, los datos del 031.
 *
 * Recibe SOLO los datos en lista blanca de h1DefinitivoDe (pagoTributos.js).
 * Reutiliza la cabecera, el pie y la salida a buffer de pdfGenerator.
 */

const PDFDocument = require('pdfkit');
const pdfGenerator = require('../pdfGenerator');

const COLOR = { dark: '#1e293b', gray: '#64748b', border: '#cbd5e1', light: '#f1f5f9', primary: '#0284c7', white: '#ffffff' };

const euros = (v) => (v == null ? '-' : `${Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`);
const fecha = (d) => (d ? new Date(d).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
const pct = (v) => (v == null ? '-' : `${String(v).replace('.', ',')} %`);

const TEXTO_FORMA_PAGO = {
  A: 'Pago previo al levante (modelo 031)',
  R: 'Pago aplazado con garantía'
};

function filaDato(doc, etiqueta, valor, x, y, ancho) {
  doc.font('Helvetica').fontSize(7).fillColor(COLOR.gray).text(etiqueta, x, y, { width: ancho });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR.dark).text(valor || '-', x, y + 9, { width: ancho });
}

/**
 * Pie de pagina. Sin margen inferior mientras se escribe: el texto cae por
 * debajo del margen y PDFKit abriria una pagina en blanco por cada pie.
 */
function pie(doc) {
  const margen = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  pdfGenerator._drawFooter(doc);
  doc.page.margins.bottom = margen;
}

function saltoSiHaceFalta(doc, y, alto) {
  if (y + alto < doc.page.height - 60) return y;
  pie(doc);
  doc.addPage();
  return doc.page.margins.top;
}

function dibujarPartidas(doc, datos, mx, pw, yInicial) {
  const cols = [
    { label: 'TRIBUTO', w: 0.14 }, { label: 'MEDIO PAGO', w: 0.14 }, { label: 'BASE', w: 0.26 },
    { label: 'TIPO', w: 0.16 }, { label: 'CUOTA', w: 0.3 }
  ].map((c) => ({ ...c, w: c.w * pw }));
  let y = yInicial;
  for (const p of datos.partidas) {
    y = saltoSiHaceFalta(doc, y, 60);
    doc.rect(mx, y, pw, 16).fill(COLOR.dark);
    const titulo = `Partida ${p.numero ?? '-'} · ${p.codigo || 'sin código'} · ${p.descripcion || ''}`.slice(0, 110);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR.white).text(titulo, mx + 5, y + 4, { width: pw - 10, lineBreak: false });
    y += 16;
    let x = mx;
    cols.forEach((c) => {
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor(COLOR.gray).text(c.label, x + 4, y + 3, { width: c.w - 8, lineBreak: false });
      x += c.w;
    });
    y += 13;
    p.tributos.forEach((t, i) => {
      y = saltoSiHaceFalta(doc, y, 14);
      doc.rect(mx, y, pw, 14).fill(i % 2 === 0 ? COLOR.light : COLOR.white);
      x = mx;
      [t.tipo || '-', t.medioDePago || '-', euros(t.base), pct(t.tipoImpositivo), euros(t.cuota)].forEach((v, ci) => {
        doc.font('Helvetica').fontSize(7.5).fillColor(COLOR.dark).text(v, x + 4, y + 3, { width: cols[ci].w - 8, lineBreak: false });
        x += cols[ci].w;
      });
      y += 14;
    });
    y += 6;
  }
  return y;
}

/**
 * @param {object} datos - salida de h1DefinitivoDe
 * @param {{ modelo031?: object|null }} [extra] - datos del 031 si hay pago previo pendiente
 * @returns {Promise<Buffer>}
 */
async function generarH1DefinitivoPdf(datos, extra = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: 30 });
  const mx = doc.page.margins.left;
  const pw = doc.page.width - mx - doc.page.margins.right;

  pdfGenerator._drawHeader(doc, 'DECLARACIÓN DE IMPORTACIÓN H1 — ADMITIDA', 'Liquidación de la AEAT', { mrn: datos.mrn, expeditionId: datos.expeditionId });

  let y = doc.y;
  const col = pw / 3;
  filaDato(doc, 'MRN', datos.mrn, mx, y, col);
  filaDato(doc, 'FECHA DE ADMISIÓN', fecha(datos.fechaAdmision), mx + col, y, col);
  filaDato(doc, 'ADUANA', datos.aduana, mx + 2 * col, y, col);
  y += 28;
  filaDato(doc, 'IMPORTADOR', datos.importador.nombre, mx, y, col);
  filaDato(doc, 'NIF', datos.importador.nif, mx + col, y, col);
  filaDato(doc, 'FORMA DE PAGO', TEXTO_FORMA_PAGO[datos.formaDePago] || datos.formaDePago, mx + 2 * col, y, col);
  y += 34;

  y = dibujarPartidas(doc, datos, mx, pw, y);

  y = saltoSiHaceFalta(doc, y, 30);
  doc.rect(mx, y, pw, 20).fill(COLOR.primary);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR.white).text('TOTAL A PAGAR', mx + 6, y + 5, { lineBreak: false });
  doc.text(euros(datos.totalAPagar), mx + pw / 2, y + 5, { width: pw / 2 - 6, align: 'right', lineBreak: false });
  y += 30;

  const m = extra.modelo031;
  if (m) {
    y = saltoSiHaceFalta(doc, y, 90);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR.dark).text('Datos para pagar con el modelo 031', mx, y);
    y += 16;
    filaDato(doc, 'REFERENCIA DE LA DEUDA (MRN)', m.referencia, mx, y, col);
    filaDato(doc, 'IMPORTE', euros(m.importe), mx + col, y, col);
    filaDato(doc, 'NIF DEL IMPORTADOR', m.nifImportador, mx + 2 * col, y, col);
    y += 28;
    if (m.limiteDePago) {
      filaDato(doc, 'FECHA LÍMITE DE PAGO', m.limiteDePago, mx, y, col);
      y += 28;
    }
    doc.font('Helvetica').fontSize(8).fillColor(COLOR.dark)
      .text('Pague en la Sede electrónica de la AEAT (pago de deudas de comercio exterior) y suba el justificante en su portal: su agente lo necesita para obtener el levante.', mx, y, { width: pw });
    y = doc.y + 10;
  }

  y = saltoSiHaceFalta(doc, y, 40);
  const nota = datos.csv
    ? `Documento generado por LUCI con la respuesta de la AEAT. CSV de la declaración: ${datos.csv} (cotejo en la Sede electrónica de la AEAT).`
    : 'Documento generado por LUCI con la respuesta de la AEAT.';
  doc.font('Helvetica').fontSize(7).fillColor(COLOR.gray).text(nota, mx, y, { width: pw });

  pie(doc);
  return pdfGenerator._toBuffer(doc);
}

module.exports = { generarH1DefinitivoPdf };
