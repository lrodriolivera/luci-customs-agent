/**
 * PDF Generator Service
 * Genera PDFs para declaraciones aduaneras (H1, H7, AES, ENS)
 * y resumenes de expedientes para el portal del cliente.
 *
 * Usa PDFKit para generacion nativa sin dependencias del sistema.
 */

const PDFDocument = require('pdfkit');
const logger = require('../config/logger');

// Colores corporativos
const COLORS = {
  primary: '#0284c7',    // sky-600
  primaryDark: '#0c4a6e', // sky-900
  dark: '#1e293b',       // slate-800
  gray: '#64748b',       // slate-500
  lightGray: '#f1f5f9',  // slate-100
  border: '#cbd5e1',     // slate-300
  white: '#ffffff',
  red: '#ef4444',
  green: '#22c55e',
  amber: '#f59e0b'
};

// Helpers
const fmt = (val) => {
  if (val == null) return '-';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};
const fmtMoney = (val) => val != null && val !== 0 ? `${Number(val).toLocaleString('es-ES', { minimumFractionDigits: 2 })} EUR` : '0,00 EUR';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
const fmtPct = (val) => val != null ? `${val}%` : '-';

class PDFGenerator {

  /**
   * Genera buffer PDF a partir de un PDFDocument
   */
  _toBuffer(doc) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }

  /**
   * Header comun para todos los PDFs
   */
  _drawHeader(doc, title, subtitle, data = {}) {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Barra superior
    doc.rect(doc.page.margins.left, doc.page.margins.top, pageWidth, 60)
       .fill(COLORS.dark);

    // Logo text
    doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.white)
       .text('LUCI', doc.page.margins.left + 15, doc.page.margins.top + 10);
    doc.font('Helvetica').fontSize(7).fillColor('#94a3b8')
       .text('Agente Aduanero IA · by Strix AI', doc.page.margins.left + 15, doc.page.margins.top + 32);

    // Right side info
    const rightX = doc.page.width - doc.page.margins.right - 200;
    doc.font('Helvetica').fontSize(8).fillColor('#94a3b8')
       .text(`Fecha: ${fmtDate(new Date())}`, rightX, doc.page.margins.top + 10, { width: 185, align: 'right' });
    if (data.mrn) {
      doc.text(`MRN: ${data.mrn}`, rightX, doc.page.margins.top + 22, { width: 185, align: 'right' });
    }
    if (data.expeditionId) {
      doc.text(`Exp: ${data.expeditionId}`, rightX, doc.page.margins.top + 34, { width: 185, align: 'right' });
    }
    doc.font('Helvetica').fontSize(7).fillColor('#94a3b8')
       .text(`Ref: ${data.lrn || data.expeditionId || '-'}`, rightX, doc.page.margins.top + 46, { width: 185, align: 'right' });

    // Title bar
    const titleY = doc.page.margins.top + 65;
    doc.rect(doc.page.margins.left, titleY, pageWidth, 28)
       .fill(COLORS.primary);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.white)
       .text(title, doc.page.margins.left + 15, titleY + 7);
    if (subtitle) {
      doc.font('Helvetica').fontSize(8).fillColor('#bae6fd')
         .text(subtitle, doc.page.width - doc.page.margins.right - 200, titleY + 9, { width: 185, align: 'right' });
    }

    doc.y = titleY + 38;
    doc.fillColor(COLORS.dark);
  }

  /**
   * Draft watermark
   */
  _drawDraftWatermark(doc) {
    doc.save();
    doc.rotate(45, { origin: [doc.page.width / 2, doc.page.height / 2] });
    doc.font('Helvetica-Bold').fontSize(80).fillColor('#ef444420')
       .text('BORRADOR', 100, doc.page.height / 2 - 50, { width: 500, align: 'center' });
    doc.restore();
  }

  /**
   * Footer - dibujado al pie de la pagina actual sin crear paginas nuevas
   */
  _drawFooter(doc) {
    const bottom = doc.page.height - 25;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const mx = doc.page.margins.left;

    doc.save();
    doc.rect(mx, bottom - 8, pageWidth, 0.5).fill(COLORS.border);
    doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.gray);
    doc.text('Generado por LUCI · aduanas.strixai.es · Strix AI', mx, bottom - 3, { width: pageWidth * 0.6, lineBreak: false });
    doc.text('Pagina 1', mx + pageWidth * 0.6, bottom - 3, { width: pageWidth * 0.4, align: 'right', lineBreak: false });
    doc.restore();
  }

  /**
   * Seccion con titulo
   */
  _drawSection(doc, title, y) {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    if (y) doc.y = y;

    doc.rect(doc.page.margins.left, doc.y, pageWidth, 20).fill(COLORS.lightGray);
    doc.rect(doc.page.margins.left, doc.y, 3, 20).fill(COLORS.primary);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.dark)
       .text(title, doc.page.margins.left + 10, doc.y + 5);
    doc.y += 25;
  }

  /**
   * Par clave-valor
   */
  _drawField(doc, label, value, x, y, width = 200) {
    doc.font('Helvetica').fontSize(7).fillColor(COLORS.gray)
       .text(label, x, y);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.dark)
       .text(fmt(value), x, y + 10, { width });
  }

  /**
   * Tabla simple
   */
  _drawTable(doc, headers, rows, startY) {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / headers.length;
    let y = startY || doc.y;

    // Header
    doc.rect(doc.page.margins.left, y, pageWidth, 18).fill(COLORS.dark);
    headers.forEach((h, i) => {
      doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.white)
         .text(h, doc.page.margins.left + i * colWidth + 5, y + 5, { width: colWidth - 10 });
    });
    y += 18;

    // Rows
    rows.forEach((row, ri) => {
      const bg = ri % 2 === 0 ? COLORS.white : COLORS.lightGray;
      doc.rect(doc.page.margins.left, y, pageWidth, 16).fill(bg);
      row.forEach((cell, ci) => {
        doc.font('Helvetica').fontSize(7).fillColor(COLORS.dark)
           .text(String(cell ?? '-'), doc.page.margins.left + ci * colWidth + 5, y + 4, { width: colWidth - 10 });
      });
      y += 16;
    });

    // Bottom border
    doc.rect(doc.page.margins.left, y, pageWidth, 0.5).fill(COLORS.border);
    doc.y = y + 5;
  }

  // ==================== H1 - DECLARACION DE IMPORTACION (formato DUA) ====================

  /**
   * Dibuja una casilla numerada estilo DUA oficial
   */
  _drawBox(doc, num, label, value, x, y, w, h) {
    // Borde
    doc.rect(x, y, w, h).lineWidth(0.5).strokeColor(COLORS.border).stroke();
    // Numero y etiqueta
    doc.font('Helvetica').fontSize(5.5).fillColor(COLORS.gray)
       .text(`${num} ${label}`, x + 3, y + 2, { width: w - 6, lineBreak: false });
    // Valor
    const val = (value == null || value === '' || value === '-') ? '' : String(value);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.dark)
       .text(val, x + 3, y + 11, { width: w - 6, height: h - 14 });
  }

  async generateH1PDF(expedition, options = {}) {
    const doc = new PDFDocument({ size: 'A4', margin: 30, autoFirstPage: true });
    const decl = expedition.declaration || {};
    const goods = expedition.goods || [];
    const calc = expedition.calculations || {};
    const client = expedition.client || {};
    const transport = expedition.transport || {};
    const g0 = goods[0] || {};

    const mx = doc.page.margins.left;
    const pw = doc.page.width - mx - doc.page.margins.right; // page width usable
    const col2 = mx + pw * 0.5;
    const col3 = mx + pw * 0.66;

    const originCountry = g0.countryOfOrigin || expedition.origin?.country || '';
    const incoterm = typeof expedition.incoterm === 'object' ? (expedition.incoterm?.code || expedition.incoterm?.type || '') : (expedition.incoterm || '');
    const modeMap = { air: '4', sea: '1', road: '3', rail: '2', maritime: '1', AIR: '4', SEA: '1', ROAD: '3', RAIL: '2' };
    const transportMode = modeMap[expedition.transportMode] || expedition.transportMode || '';
    const totalGoodsValue = goods.reduce((sum, g) => sum + (g.invoiceValue || g.value || 0), 0);
    const customsValue = calc.customsValue || calc.invoiceTotal || totalGoodsValue || 0;
    const totalDuties = calc.totalDuties || goods.reduce((sum, g) => sum + (g.dutyAmount || 0), 0);
    const totalVat = calc.totalVat || goods.reduce((sum, g) => sum + (g.vatAmount || 0), 0);
    const totalTaxes = calc.totalTaxes || (totalDuties + totalVat);

    // ===== CABECERA =====
    doc.rect(mx, mx, pw, 40).fill(COLORS.dark);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.white)
       .text('COMUNIDAD EUROPEA', mx + 8, mx + 5);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.white)
       .text('DECLARACION DE IMPORTACION H1', mx + 8, mx + 18);
    // Right side
    doc.font('Helvetica').fontSize(7).fillColor('#94a3b8')
       .text(`MRN: ${decl.mrn || 'Pendiente'}`, mx + pw - 180, mx + 5, { width: 170, align: 'right' })
       .text(`Exp: ${expedition.expeditionId}`, mx + pw - 180, mx + 15, { width: 170, align: 'right' })
       .text(`Fecha: ${fmtDate(decl.declarationDate || expedition.createdAt)}`, mx + pw - 180, mx + 25, { width: 170, align: 'right' });

    if (options.draft) this._drawDraftWatermark(doc);

    let y = mx + 45;
    const rh = 28; // row height
    const rh2 = 38; // taller row

    // ===== FILA 1: Declaracion, Expedidor =====
    this._drawBox(doc, '1', 'DECLARACION', `IM  ${decl.declarationType || 'A'}`, mx, y, pw * 0.15, rh);
    this._drawBox(doc, '2', 'EXPEDIDOR / EXPORTADOR', client.companyName || expedition.shipper?.name || '', mx + pw * 0.15, y, pw * 0.45, rh2);
    this._drawBox(doc, '5', 'PARTIDAS', String(goods.length || 1), mx + pw * 0.6, y, pw * 0.1, rh);
    this._drawBox(doc, '6', 'TOTAL BULTOS', fmt(expedition.packages || g0.numberOfPackages), mx + pw * 0.7, y, pw * 0.15, rh);
    this._drawBox(doc, '7', 'N. REF.', expedition.expeditionId, mx + pw * 0.85, y, pw * 0.15, rh);
    y += rh2;

    // ===== FILA 2: Destinatario, Representante =====
    this._drawBox(doc, '8', 'DESTINATARIO - EORI', `${client.companyName || ''}\n${client.taxId || client.nif || ''}`, mx, y, pw * 0.5, rh2);
    this._drawBox(doc, '14', 'DECLARANTE / REPRESENTANTE', `Stock Logistic S.L.\nB22477020 / ESB22477020000`, mx + pw * 0.5, y, pw * 0.5, rh2);
    y += rh2;

    // ===== FILA 3: Paises, transporte =====
    this._drawBox(doc, '15', 'PAIS EXPEDICION', originCountry, mx, y, pw * 0.15, rh);
    this._drawBox(doc, '17', 'PAIS DESTINO', 'ES', mx + pw * 0.15, y, pw * 0.15, rh);
    this._drawBox(doc, '18', 'IDENT. MEDIO TRANSPORTE', fmt(transport.vehicleId || transport.vesselName || transport.flightNumber), mx + pw * 0.3, y, pw * 0.25, rh);
    this._drawBox(doc, '19', 'CTR', transport.containerNumber ? 'SI' : 'NO', mx + pw * 0.55, y, pw * 0.08, rh);
    this._drawBox(doc, '20', 'COND. ENTREGA', incoterm, mx + pw * 0.63, y, pw * 0.12, rh);
    this._drawBox(doc, '22', 'DIVISA / IMPORTE', `EUR ${fmtMoney(customsValue)}`, mx + pw * 0.75, y, pw * 0.25, rh);
    y += rh;

    // ===== FILA 4: Transporte, Aduana =====
    this._drawBox(doc, '25', 'MODO TRANSP.', transportMode, mx, y, pw * 0.1, rh);
    this._drawBox(doc, '26', 'TRANSP. INTERIOR', transportMode, mx + pw * 0.1, y, pw * 0.1, rh);
    this._drawBox(doc, '29', 'ADUANA PRESENTACION', fmt(decl.customsOffice), mx + pw * 0.2, y, pw * 0.25, rh);
    this._drawBox(doc, '30', 'LOCALIZACION MERCANCIAS', fmt(transport.warehouseCode || decl.goodsLocation), mx + pw * 0.45, y, pw * 0.25, rh);
    this._drawBox(doc, '36', 'PREFERENCIA', fmt(decl.preference || '100'), mx + pw * 0.7, y, pw * 0.15, rh);
    this._drawBox(doc, '37', 'REGIMEN', fmt(decl.regime || '40') + ' ' + fmt(decl.additionalProcedure || '000'), mx + pw * 0.85, y, pw * 0.15, rh);
    y += rh;

    // ===== FILA 5: Documento transporte =====
    this._drawBox(doc, '40', 'DOC. CARGO / DOC. PRECEDENTE', fmt(transport.documentNumber || transport.blNumber || transport.awbNumber), mx, y, pw * 0.5, rh);
    this._drawBox(doc, '44', 'INDICACIONES ESPECIALES / DOCS', (decl.notes || expedition.notes || []).join(', ') || '', mx + pw * 0.5, y, pw * 0.5, rh);
    y += rh;

    // ===== PARTIDAS (tabla) =====
    y += 3;
    doc.rect(mx, y, pw, 16).fill(COLORS.dark);
    const thCols = [
      { label: 'N.', w: pw * 0.04 },
      { label: '33 COD. MERCANCIAS', w: pw * 0.14 },
      { label: '31 DESCRIPCION', w: pw * 0.22 },
      { label: '34 ORIGEN', w: pw * 0.07 },
      { label: '35 MASA BRUTA', w: pw * 0.1 },
      { label: '38 MASA NETA', w: pw * 0.1 },
      { label: '42 VALOR', w: pw * 0.11 },
      { label: '46 VAL.EST.', w: pw * 0.11 },
      { label: 'ARANCEL', w: pw * 0.06 },
      { label: 'IVA', w: pw * 0.05 },
    ];
    let tx = mx;
    thCols.forEach(c => {
      doc.font('Helvetica-Bold').fontSize(5.5).fillColor(COLORS.white)
         .text(c.label, tx + 2, y + 4, { width: c.w - 4, lineBreak: false });
      tx += c.w;
    });
    y += 16;

    // Rows
    const rowData = goods.length > 0 ? goods : [{ description: 'Sin partidas', taricCode: '-' }];
    rowData.forEach((g, i) => {
      const bg = i % 2 === 0 ? COLORS.white : COLORS.lightGray;
      doc.rect(mx, y, pw, 14).fill(bg);
      tx = mx;
      const cells = [
        String(i + 1),
        fmt(g.taricCode),
        (g.description || '').substring(0, 22),
        fmt(g.countryOfOrigin || originCountry),
        g.grossWeight ? `${g.grossWeight}` : '-',
        g.netWeight ? `${g.netWeight}` : '-',
        g.invoiceValue || g.value ? `${Number(g.invoiceValue || g.value).toFixed(2)}` : '-',
        g.statisticalValue ? `${g.statisticalValue}` : g.invoiceValue ? `${Number(g.invoiceValue || g.value).toFixed(2)}` : '-',
        g.dutyRate != null ? `${g.dutyRate}%` : '-',
        g.vatRate != null ? `${g.vatRate}%` : '-'
      ];
      cells.forEach((val, ci) => {
        doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.dark)
           .text(val, tx + 2, y + 3, { width: thCols[ci].w - 4, lineBreak: false });
        tx += thCols[ci].w;
      });
      y += 14;
    });
    doc.rect(mx, y, pw, 0.5).fill(COLORS.border);
    y += 5;

    // ===== LIQUIDACION (Casilla 47) =====
    doc.rect(mx, y, pw, 16).fill(COLORS.dark);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.white)
       .text('47 CALCULO DE LOS TRIBUTOS', mx + 5, y + 4);
    const tCols2 = [
      { label: 'TIPO', w: pw * 0.1 },
      { label: 'BASE IMPONIBLE', w: pw * 0.2 },
      { label: 'TIPO GRAVAMEN', w: pw * 0.15 },
      { label: 'IMPORTE', w: pw * 0.2 },
      { label: 'MP', w: pw * 0.1 },
      { label: '', w: pw * 0.25 }
    ];
    y += 16;

    // A00 - Derechos
    doc.rect(mx, y, pw, 14).fill(COLORS.lightGray);
    tx = mx;
    ['A00', fmtMoney(customsValue), g0.dutyRate != null ? `${g0.dutyRate}%` : '-', fmtMoney(totalDuties), 'A', ''].forEach((val, ci) => {
      doc.font('Helvetica').fontSize(7).fillColor(COLORS.dark)
         .text(val, tx + 3, y + 3, { width: tCols2[ci].w - 6, lineBreak: false });
      tx += tCols2[ci].w;
    });
    y += 14;

    // B00 - IVA
    doc.rect(mx, y, pw, 14).fill(COLORS.white);
    tx = mx;
    const vatBase = customsValue + totalDuties;
    ['B00', fmtMoney(vatBase), g0.vatRate != null ? `${g0.vatRate}%` : '21%', fmtMoney(totalVat), 'A', ''].forEach((val, ci) => {
      doc.font('Helvetica').fontSize(7).fillColor(COLORS.dark)
         .text(val, tx + 3, y + 3, { width: tCols2[ci].w - 6, lineBreak: false });
      tx += tCols2[ci].w;
    });
    y += 14;

    // Total
    doc.rect(mx, y, pw, 18).fill(COLORS.primary);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.white)
       .text('TOTAL A INGRESAR', mx + 5, y + 4, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.white)
       .text(fmtMoney(totalTaxes), mx + pw * 0.5, y + 3, { width: pw * 0.48, align: 'right', lineBreak: false });
    y += 22;

    // ===== PIE: Estado, Firma =====
    const statusText = { draft: 'BORRADOR', pending: 'PENDIENTE', submitted: 'PRESENTADA', accepted: 'ACEPTADA', rejected: 'RECHAZADA', ready_for_declaration: 'BORRADOR' };
    const channelColors = { green: COLORS.green, orange: COLORS.amber, red: COLORS.red };

    this._drawBox(doc, '54', 'LUGAR, FECHA Y FIRMA DEL DECLARANTE', `${fmtDate(decl.declarationDate || expedition.createdAt)}  -  Stock Logistic S.L.`, mx, y, pw * 0.5, rh);

    // Canal/Estado
    doc.rect(mx + pw * 0.5, y, pw * 0.25, rh).lineWidth(0.5).strokeColor(COLORS.border).stroke();
    doc.font('Helvetica').fontSize(5.5).fillColor(COLORS.gray).text('ESTADO', mx + pw * 0.5 + 3, y + 2, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.dark)
       .text(statusText[decl.status || expedition.status] || (decl.status || expedition.status || '').toUpperCase(), mx + pw * 0.5 + 3, y + 12, { lineBreak: false });

    doc.rect(mx + pw * 0.75, y, pw * 0.25, rh).lineWidth(0.5).strokeColor(COLORS.border).stroke();
    doc.font('Helvetica').fontSize(5.5).fillColor(COLORS.gray).text('J CANAL', mx + pw * 0.75 + 3, y + 2, { lineBreak: false });
    const ch = decl.channel || '';
    doc.font('Helvetica-Bold').fontSize(9).fillColor(channelColors[ch] || COLORS.dark)
       .text(ch ? ch.toUpperCase() : '-', mx + pw * 0.75 + 3, y + 12, { lineBreak: false });

    return this._toBuffer(doc);
  }

  // ==================== H7 - DECLARACION BAJO VALOR ====================

  async generateH7PDF(h7Decl, options = {}) {
    const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: true });

    this._drawHeader(doc, 'DECLARACION H7 - BAJO VALOR E-COMMERCE', `Estado: ${fmt(h7Decl.status)}`, {
      mrn: h7Decl.mrn,
      lrn: h7Decl.lrn || h7Decl.declarationNumber
    });

    if (options.draft) this._drawDraftWatermark(doc);

    const mx = doc.page.margins.left;
    const midX = mx + 260;

    // Remitente / Destinatario
    this._drawSection(doc, 'REMITENTE Y DESTINATARIO');
    const pY = doc.y;
    this._drawField(doc, 'REMITENTE', fmt(h7Decl.sender?.name), mx + 10, pY);
    this._drawField(doc, 'EORI', fmt(h7Decl.sender?.eori), mx + 10, pY + 25);
    this._drawField(doc, 'DESTINATARIO', fmt(h7Decl.recipient?.name), midX, pY);
    this._drawField(doc, 'NIF/ID', fmt(h7Decl.recipient?.taxId), midX, pY + 25);
    if (h7Decl.iossNumber) {
      this._drawField(doc, 'IOSS', h7Decl.iossNumber, mx + 10, pY + 50);
    }
    doc.y = pY + (h7Decl.iossNumber ? 75 : 55);

    // Items
    this._drawSection(doc, 'ARTICULOS');
    const items = h7Decl.items || [];
    const headers = ['Nro', 'TARIC', 'Descripcion', 'Cantidad', 'Valor Unit.', 'Valor Total', 'Origen'];
    const rows = items.map((it, i) => [
      i + 1, fmt(it.taricCode), (it.description || '').substring(0, 20),
      it.quantity || 1, fmtMoney(it.unitValue), fmtMoney(it.totalValue), fmt(it.countryOfOrigin)
    ]);
    this._drawTable(doc, headers, rows);

    // Totales
    doc.y += 5;
    this._drawSection(doc, 'TOTALES Y LIQUIDACION');
    const tY = doc.y;
    const totals = h7Decl.totals || {};
    const duties = h7Decl.duties || {};

    this._drawField(doc, 'Valor Intrinseco', fmtMoney(totals.intrinsicValue), mx + 10, tY, 130);
    this._drawField(doc, 'Transporte', fmtMoney(totals.shippingCost), mx + 150, tY, 130);
    this._drawField(doc, 'Valor Aduanero', fmtMoney(totals.customsValue), mx + 290, tY, 130);
    this._drawField(doc, 'Arancel', fmtMoney(duties.tariff?.amount || 0), mx + 10, tY + 30, 130);
    this._drawField(doc, `IVA (${fmtPct(duties.vat?.rate)})`, fmtMoney(duties.vat?.amount || 0), mx + 150, tY + 30, 130);

    const pageWidth = doc.page.width - mx - doc.page.margins.right;
    doc.rect(mx + 10, tY + 55, pageWidth - 20, 20).fill(COLORS.primary);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.white)
       .text(`TOTAL: ${fmtMoney(duties.totalDue || 0)}`, mx + 20, tY + 59, { width: pageWidth - 40, align: 'right' });

    this._drawFooter(doc);
    return this._toBuffer(doc);
  }

  // ==================== AES - DECLARACION DE EXPORTACION ====================

  async generateAESPDF(expedition, options = {}) {
    const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: true });
    const decl = expedition.declaration || {};
    const goods = expedition.goods || [];
    const client = expedition.client || {};

    this._drawHeader(doc, 'DECLARACION DE EXPORTACION AES', `Regimen: ${fmt(decl.regime)}`, {
      mrn: decl.mrn, expeditionId: expedition.expeditionId
    });

    if (options.draft) this._drawDraftWatermark(doc);

    const mx = doc.page.margins.left;
    const midX = mx + 260;

    // Exportador / Destinatario
    this._drawSection(doc, 'PARTES');
    const pY = doc.y;
    this._drawField(doc, 'EXPORTADOR', fmt(client.companyName), mx + 10, pY);
    this._drawField(doc, 'NIF/EORI', fmt(client.taxId), mx + 10, pY + 25);
    this._drawField(doc, 'DESTINATARIO', fmt(expedition.consignee?.name || expedition.destination?.name), midX, pY);
    this._drawField(doc, 'Pais Destino', fmt(expedition.destination?.country), midX, pY + 25);
    this._drawField(doc, 'Aduana Salida', fmt(decl.customsOffice), mx + 10, pY + 55);
    this._drawField(doc, 'Aduana Destino', fmt(expedition.destination?.customsOffice), midX, pY + 55);
    doc.y = pY + 85;

    // Partidas
    this._drawSection(doc, 'PARTIDAS');
    const headers = ['Nro', 'TARIC', 'Descripcion', 'Peso Neto', 'Valor Estadistico', 'Pais Destino'];
    const rows = goods.map((g, i) => [
      i + 1, fmt(g.taricCode), (g.description || '').substring(0, 25),
      g.netWeight ? `${g.netWeight} kg` : '-', fmtMoney(g.invoiceValue || g.value),
      fmt(g.countryOfDestination || expedition.destination?.country)
    ]);
    this._drawTable(doc, headers, rows);

    this._drawFooter(doc);
    return this._toBuffer(doc);
  }

  // ==================== ENS - DECLARACION SUMARIA DE ENTRADA ====================

  async generateENSPDF(ensDecl, options = {}) {
    const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: true });

    const modeMap = { AIR: 'Aereo', SEA: 'Maritimo', ROAD: 'Carretera', RAIL: 'Ferrocarril' };

    this._drawHeader(doc, `DECLARACION SUMARIA DE ENTRADA (ENS/ICS2)`, `Modo: ${modeMap[ensDecl.transportMode] || ensDecl.transportMode}`, {
      mrn: ensDecl.mrn, lrn: ensDecl.lrn
    });

    if (options.draft) this._drawDraftWatermark(doc);

    const mx = doc.page.margins.left;
    const midX = mx + 260;

    // Datos generales
    this._drawSection(doc, 'DATOS GENERALES');
    const gY = doc.y;
    this._drawField(doc, 'Tipo Declaracion', fmt(ensDecl.declarationType), mx + 10, gY);
    this._drawField(doc, 'Aduana Entrada', fmt(ensDecl.entryOffice?.code), midX, gY);
    this._drawField(doc, 'Llegada Prevista', fmtDate(ensDecl.entryOffice?.expectedArrival), mx + 10, gY + 25);
    this._drawField(doc, 'Medio Transporte', fmt(ensDecl.transportMeans?.identification), midX, gY + 25);
    doc.y = gY + 55;

    // Carrier
    this._drawSection(doc, 'TRANSPORTISTA');
    const cY = doc.y;
    this._drawField(doc, 'Nombre', fmt(ensDecl.carrier?.name), mx + 10, cY);
    this._drawField(doc, 'EORI', fmt(ensDecl.carrier?.eori), midX, cY);
    doc.y = cY + 30;

    // Consignment
    this._drawSection(doc, 'ENVIO');
    const sY = doc.y;
    const cons = ensDecl.consignment || {};
    this._drawField(doc, 'Referencia (BL/AWB/CMR)', fmt(cons.referenceNumber), mx + 10, sY);
    this._drawField(doc, 'Contenedor', fmt(cons.containerNumber || 'N/A'), midX, sY);
    this._drawField(doc, 'Peso Bruto', cons.grossMass ? `${cons.grossMass} kg` : '-', mx + 10, sY + 25);
    this._drawField(doc, 'Bultos', fmt(cons.numberOfPackages), midX, sY + 25);
    this._drawField(doc, 'Descripcion Mercancia', fmt(cons.goodsDescription), mx + 10, sY + 50, 460);
    doc.y = sY + 80;

    // House consignments
    if (ensDecl.houseConsignments?.length > 0) {
      this._drawSection(doc, 'ENVIOS HOUSE (GRUPAJE)');
      const headers = ['Nro', 'Consignatario', 'Mercancia', 'Peso', 'Bultos'];
      const rows = ensDecl.houseConsignments.map((h, i) => [
        i + 1, fmt(h.consignee?.name), (h.goods?.[0]?.description || '').substring(0, 30),
        h.grossMass ? `${h.grossMass} kg` : '-', fmt(h.numberOfPackages)
      ]);
      this._drawTable(doc, headers, rows);
    }

    // Risk assessment
    if (ensDecl.riskAssessment) {
      this._drawSection(doc, 'EVALUACION DE RIESGO');
      const rY = doc.y;
      const ra = ensDecl.riskAssessment;
      const statusColors = { CLEARED: COLORS.green, HOLD: COLORS.red, PENDING: COLORS.amber };
      this._drawField(doc, 'Estado', fmt(ra.status), mx + 10, rY);
      this._drawField(doc, 'Puntuacion Riesgo', ra.riskScore != null ? `${ra.riskScore}/100` : '-', midX, rY);
      doc.y = rY + 30;
    }

    this._drawFooter(doc);
    return this._toBuffer(doc);
  }

  // ==================== RESUMEN EXPEDIENTE (para portal cliente) ====================

  async generateExpeditionSummaryPDF(expedition, options = {}) {
    const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: true });
    const decl = expedition.declaration || {};
    const calc = expedition.calculations || {};
    const client = expedition.client || {};

    this._drawHeader(doc, 'RESUMEN DE EXPEDIENTE', `${expedition.operationType === 'import' || expedition.operationType === 'IMPORT' ? 'Importacion' : 'Exportacion'}`, {
      expeditionId: expedition.expeditionId, mrn: decl.mrn
    });

    const mx = doc.page.margins.left;
    const midX = mx + 260;

    // Estado
    this._drawSection(doc, 'ESTADO DEL EXPEDIENTE');
    const sY = doc.y;
    this._drawField(doc, 'Estado', fmt(expedition.status), mx + 10, sY);
    this._drawField(doc, 'Canal', fmt(decl.channel || '-'), midX, sY);
    this._drawField(doc, 'Creado', fmtDate(expedition.createdAt), mx + 10, sY + 25);
    this._drawField(doc, 'Actualizado', fmtDate(expedition.updatedAt), midX, sY + 25);
    doc.y = sY + 55;

    // Cliente
    this._drawSection(doc, 'DATOS DEL CLIENTE');
    const clY = doc.y;
    this._drawField(doc, 'Empresa', fmt(client.companyName), mx + 10, clY);
    this._drawField(doc, 'NIF', fmt(client.taxId || client.nif), midX, clY);
    this._drawField(doc, 'Contacto', fmt(client.contact?.name || client.contactName), mx + 10, clY + 25);
    this._drawField(doc, 'Email', fmt(client.contact?.email || client.email), midX, clY + 25);
    doc.y = clY + 55;

    // Mercancias
    if (expedition.goods?.length > 0) {
      this._drawSection(doc, 'MERCANCIAS');
      const headers = ['Nro', 'Codigo', 'Descripcion', 'Cantidad', 'Valor'];
      const rows = expedition.goods.map((g, i) => [
        i + 1, fmt(g.taricCode), (g.description || '').substring(0, 30),
        `${g.quantity || '-'} ${g.unit || ''}`, fmtMoney(g.invoiceValue || g.value)
      ]);
      this._drawTable(doc, headers, rows);
    }

    // Importes
    this._drawSection(doc, 'IMPORTES');
    const iY = doc.y;
    this._drawField(doc, 'Valor Factura', fmtMoney(calc.invoiceTotal), mx + 10, iY, 130);
    this._drawField(doc, 'Valor Aduanero', fmtMoney(calc.customsValue), mx + 150, iY, 130);
    this._drawField(doc, 'Aranceles', fmtMoney(calc.totalDuties || 0), mx + 10, iY + 25, 130);
    this._drawField(doc, 'IVA', fmtMoney(calc.totalVat || 0), mx + 150, iY + 25, 130);
    this._drawField(doc, 'Total Tasas', fmtMoney(calc.totalTaxes || 0), mx + 290, iY + 25, 130);
    doc.y = iY + 55;

    // Documentos
    if (expedition.documentChecklist?.length > 0) {
      this._drawSection(doc, 'DOCUMENTACION');
      const headers = ['Documento', 'Obligatorio', 'Recibido'];
      const rows = expedition.documentChecklist.map(d => [
        d.documentName || d.name, d.required ? 'Si' : 'No', d.received ? 'Si' : 'Pendiente'
      ]);
      this._drawTable(doc, headers, rows);
    }

    this._drawFooter(doc);
    return this._toBuffer(doc);
  }

  // ==================== NCTS - DECLARACION DE TRANSITO ====================

  async generateNCTSPDF(transit, options = {}) {
    const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: true });
    const principal = transit.principal || {};
    const guarantee = transit.guarantee || {};
    const transport = transit.transport || {};
    const goodsItems = transit.goodsItems || [];
    const totals = transit.totals || {};

    const transitTypeDesc = { T1: 'T1 - Transito externo', T2: 'T2 - Transito interno', T2F: 'T2F - Transito interno fiscal', TIR: 'TIR - Cuaderno TIR' };

    this._drawHeader(doc, `DECLARACION DE TRANSITO NCTS`, transitTypeDesc[transit.transitType] || transit.transitType, {
      mrn: transit.mrn, lrn: transit.lrn, expeditionId: transit.reference
    });

    if (options.draft) this._drawDraftWatermark(doc);

    const mx = doc.page.margins.left;
    const midX = mx + 260;

    // Obligado principal
    this._drawSection(doc, 'OBLIGADO PRINCIPAL');
    const pY = doc.y;
    this._drawField(doc, 'Nombre', fmt(principal.name), mx + 10, pY);
    this._drawField(doc, 'EORI', fmt(principal.eori), midX, pY);
    const addr = principal.address || {};
    this._drawField(doc, 'Direccion', `${fmt(addr.street)} - ${fmt(addr.postalCode)} ${fmt(addr.city)} (${fmt(addr.country)})`, mx + 10, pY + 25, 460);
    doc.y = pY + 55;

    // Aduanas
    this._drawSection(doc, 'ADUANAS');
    const aY = doc.y;
    const dep = transit.departureOffice || {};
    const dest = transit.destinationOffice || {};
    this._drawField(doc, 'Aduana Partida', `${fmt(dep.code)} - ${fmt(dep.name)}`, mx + 10, aY);
    this._drawField(doc, 'Aduana Destino', `${fmt(dest.code)} - ${fmt(dest.name)}`, midX, aY);

    if (transit.transitOffices?.length > 0) {
      this._drawField(doc, 'Aduanas de Paso', transit.transitOffices.map(o => o.code).join(', '), mx + 10, aY + 25, 460);
      doc.y = aY + 55;
    } else {
      doc.y = aY + 30;
    }

    // Garantia
    this._drawSection(doc, 'GARANTIA');
    const gY = doc.y;
    const gTypeMap = { '0': 'Exencion', '1': 'Garantia global', '2': 'Garantia individual fianza', '3': 'Garantia individual metalico', '8': 'Garantia individual otro', R: 'Exencion reglamento' };
    this._drawField(doc, 'Tipo', gTypeMap[guarantee.type] || fmt(guarantee.type), mx + 10, gY);
    this._drawField(doc, 'GRN', fmt(guarantee.grn), midX, gY);
    this._drawField(doc, 'Importe', guarantee.amount ? fmtMoney(guarantee.amount) : '-', mx + 10, gY + 25);
    this._drawField(doc, 'Validez', guarantee.validTo ? `${fmtDate(guarantee.validFrom)} - ${fmtDate(guarantee.validTo)}` : '-', midX, gY + 25);
    doc.y = gY + 55;

    // Transporte
    this._drawSection(doc, 'TRANSPORTE');
    const tY = doc.y;
    const tModeMap = { '1': '1 (Maritimo)', '2': '2 (Ferrocarril)', '3': '3 (Carretera)', '4': '4 (Aereo)' };
    this._drawField(doc, 'Modo', tModeMap[transport.mode] || fmt(transport.mode), mx + 10, tY);
    this._drawField(doc, 'Vehiculo', fmt(transport.identityAtDeparture?.identification), midX, tY);
    this._drawField(doc, 'Contenedor', transport.containerIndicator ? 'Si' : 'No', mx + 10, tY + 25);
    this._drawField(doc, 'Precintos', transit.transport?.seals?.map(s => s.number).join(', ') || '-', midX, tY + 25);
    doc.y = tY + 55;

    // Mercancias
    this._drawSection(doc, 'MERCANCIAS');
    const headers = ['Nro', 'TARIC', 'Descripcion', 'Peso Bruto', 'Bultos', 'Origen'];
    const rows = goodsItems.map((g, i) => [
      g.itemNumber || i + 1, fmt(g.taricCode), (g.description || '').substring(0, 25),
      g.grossWeight ? `${g.grossWeight} kg` : '-', fmt(g.packages?.count), fmt(g.countryOfOrigin)
    ]);
    if (rows.length === 0) rows.push([1, '-', 'Sin partidas', '-', '-', '-']);
    this._drawTable(doc, headers, rows);

    // Totales
    doc.y += 3;
    const pageWidth = doc.page.width - mx - doc.page.margins.right;
    doc.rect(mx, doc.y, pageWidth, 20).fill(COLORS.lightGray);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.dark)
       .text(`Peso Bruto Total: ${totals.grossWeight || '-'} kg   |   Partidas: ${totals.itemCount || goodsItems.length}   |   Bultos: ${totals.packageCount || '-'}`, mx + 10, doc.y + 5, { lineBreak: false });
    doc.y += 25;

    // Estado
    const statusMap = { draft: 'BORRADOR', submitted: 'PRESENTADA', accepted: 'ACEPTADA', in_transit: 'EN TRANSITO', arrived: 'LLEGADA', completed: 'COMPLETADO' };
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.gray)
       .text(`Estado: ${statusMap[transit.status] || transit.status}`, mx, doc.y, { lineBreak: false });

    this._drawFooter(doc);
    return this._toBuffer(doc);
  }

  // ==================== PUE SOIVRE - SOLICITUD INSPECCION SOIVRE ====================

  async generatePUESOIVREPDF(pueRequest, options = {}) {
    const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: true });
    const operator = pueRequest.operator || {};
    const h1Data = pueRequest.h1AutoFill || {};
    const goods = pueRequest.goods || [];

    const flowLabel = pueRequest.flowType === 'ROHS_RAEE' ? 'ROHS / RAEE' : 'SOIVRE';

    this._drawHeader(doc, `SOLICITUD PUE ${flowLabel}`, `Tipo: ${pueRequest.operationType || 'ALTA'}`, {
      expeditionId: pueRequest.reference, lrn: pueRequest.pueReference
    });

    if (options.draft) this._drawDraftWatermark(doc);

    const mx = doc.page.margins.left;
    const midX = mx + 260;

    // MRN y datos de la partida
    this._drawSection(doc, 'DATOS DE LA DECLARACION');
    const dY = doc.y;
    this._drawField(doc, 'MRN Partida', fmt(pueRequest.mrnPartida || pueRequest.declarationMRN), mx + 10, dY);
    this._drawField(doc, 'Clave Zeta', fmt(pueRequest.claveZeta), midX, dY);
    this._drawField(doc, 'Tipo Documento', fmt(pueRequest.documentTypePue || 'DUA'), mx + 10, dY + 25);
    this._drawField(doc, 'Tipo Declaracion', fmt(pueRequest.declarationTypeSoivre || 'EXPEDIENTE_NUEVO'), midX, dY + 25);
    doc.y = dY + 55;

    // Operador / Importador
    this._drawSection(doc, 'OPERADOR / IMPORTADOR');
    const oY = doc.y;
    this._drawField(doc, 'Nombre', fmt(operator.name || h1Data.importerName), mx + 10, oY);
    this._drawField(doc, 'NIF', fmt(operator.nif || h1Data.importerNif), midX, oY);
    this._drawField(doc, 'EORI', fmt(operator.eori || h1Data.importerEori), mx + 10, oY + 25);
    this._drawField(doc, 'Email', fmt(pueRequest.contactEmail || operator.email), midX, oY + 25);
    doc.y = oY + 55;

    // Centro y Punto de Inspeccion
    this._drawSection(doc, 'CENTRO DE INSPECCION');
    const cY = doc.y;
    const codCice = pueRequest.codCice || {};
    const codPi = pueRequest.codPi || {};
    this._drawField(doc, 'CodCice (Centro S.I. SOIVRE)', `${fmt(codCice.code)} - ${fmt(codCice.name)}`, mx + 10, cY, 460);
    this._drawField(doc, 'CodPi (Punto Inspeccion)', `${fmt(codPi.code)} - ${fmt(codPi.name)}`, mx + 10, cY + 25, 460);
    doc.y = cY + 55;

    // Especificidades
    if (pueRequest.specificities?.length > 0) {
      this._drawSection(doc, 'ESPECIFICIDADES');
      const specs = pueRequest.specificities;
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.dark);
      specs.forEach(s => {
        doc.text(`• ${s}`, mx + 10, doc.y, { width: 460 });
        doc.y += 2;
      });
      doc.y += 5;
    }

    // Mercancia
    this._drawSection(doc, 'MERCANCIA');
    const mY = doc.y;
    this._drawField(doc, 'Unidad', fmt(pueRequest.merchandiseUnit), mx + 10, mY);
    this._drawField(doc, 'Cantidad', fmt(pueRequest.merchandiseQuantity), midX, mY);
    this._drawField(doc, 'Codigo SOIVRE Producto', fmt(pueRequest.codigoSoivreProducto), mx + 10, mY + 25);
    this._drawField(doc, 'Partida Arancelaria', fmt(h1Data.taricCode), midX, mY + 25);
    doc.y = mY + 55;

    // Certificados solicitados
    if (pueRequest.certificates) {
      this._drawSection(doc, 'CERTIFICADOS SOLICITADOS');
      const certY = doc.y;
      const certs = pueRequest.certificates;
      const certLabels = { NORMAL: 'Declaracion Normal', NOT_APPLICABLE: 'No procede', CONSULT: 'Consulta si procede' };
      this._drawField(doc, 'Certificado COM', certLabels[certs.com] || fmt(certs.com), mx + 10, certY);
      this._drawField(doc, 'Certificado ROHS', certLabels[certs.rohs] || fmt(certs.rohs), midX, certY);
      this._drawField(doc, 'Certificado RAEE', certLabels[certs.raee] || fmt(certs.raee), mx + 10, certY + 25);
      doc.y = certY + 55;
    }

    // Numeros RII
    if (pueRequest.riiNumbers?.raee || pueRequest.riiNumbers?.pya) {
      this._drawSection(doc, 'REGISTRO INTEGRADO INDUSTRIAL (RII)');
      const rY = doc.y;
      this._drawField(doc, 'Numero RII RAEE', fmt(pueRequest.riiNumbers.raee), mx + 10, rY);
      this._drawField(doc, 'Numero RII PyA', fmt(pueRequest.riiNumbers.pya), midX, rY);
      doc.y = rY + 30;
    }

    // Partidas de mercancias (si hay)
    if (goods.length > 0) {
      this._drawSection(doc, 'PARTIDAS');
      const headers = ['Nro', 'TARIC', 'Descripcion', 'Cantidad', 'Peso', 'Origen'];
      const rows = goods.map((g, i) => [
        g.sequenceNumber || i + 1, fmt(g.taricCode), (g.description || '').substring(0, 25),
        `${g.quantity || '-'} ${g.unitOfMeasure || ''}`, g.grossMass ? `${g.grossMass} kg` : '-', fmt(g.countryOfOrigin)
      ]);
      this._drawTable(doc, headers, rows);
    }

    // Estado
    const statusMap = { draft: 'BORRADOR', submitted: 'PRESENTADA', registered: 'REGISTRADA', approved: 'APROBADA', rejected: 'RECHAZADA', pending_inspection: 'PENDIENTE INSPECCION' };
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.gray)
       .text(`Estado: ${statusMap[pueRequest.status] || pueRequest.status}   |   Prioridad: ${(pueRequest.priority || 'normal').toUpperCase()}`, mx, doc.y, { lineBreak: false });

    this._drawFooter(doc);
    return this._toBuffer(doc);
  }
}

module.exports = new PDFGenerator();
