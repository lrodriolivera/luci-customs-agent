const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak,
} = require('docx');

const DATA_PATH = path.join(__dirname, 'casos_documento_agente.json');
const OUT_PATH = path.join(__dirname, '..', 'LUCI-Guia-Casos-Prueba-Agente-Aduanera.docx');

const casos = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));

const ACCENT = '0B5D4A';
const GREY = '5E6C66';

function h1(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } });
}
function h2(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 260, after: 80 },
    children: [new TextRun({ text, color: ACCENT, bold: true })],
  });
}
function p(text, opts = {}) {
  return new Paragraph({ children: [new TextRun({ text, ...opts })], spacing: { after: 120 } });
}
function labelLine(label, value) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: value }),
    ],
  });
}
function bulletDocs(docs) {
  return docs.map((d) => new Paragraph({ text: d, bullet: { level: 0 }, spacing: { after: 20 } }));
}

// --- Agrupacion en 2 niveles: lista real de Trello (Heading1) -> subgrupo (Heading2) -> caso (Heading3) ---
// El nivel "lista real de Trello" es el que coincide con el numero de tarjetas que se ve
// directamente en el tablero (149 en H1, 77 en AES, 15 en Borde) para que no haya duda de
// que el documento cubre exactamente lo mismo que Trello.
const SUPER_GROUPS = [
  {
    listName: 'H1 — Importación',
    subgroups: [
      'H1 — Casos base',
      'H1 — Mercancía extraña (test clasificación TARIC)',
      'H1 — Categorías especiales (perecederos/alimentos/químicos/peligrosos/frío)',
    ],
  },
  {
    listName: 'AES — Exportación',
    subgroups: [
      'AES — Casos base',
      'AES — Mercancía extraña (test clasificación TARIC)',
      'AES — Categorías especiales (perecederos/alimentos/químicos/peligrosos/frío)',
    ],
  },
  {
    listName: 'Clasificación TARIC — Casos de Borde',
    subgroups: ['Casos de borde — Clasificación TARIC'],
  },
];

const byGroup = {};
for (const c of casos) {
  (byGroup[c.grupo] = byGroup[c.grupo] || []).push(c);
}

function superGroupTotal(sg) {
  return sg.subgroups.reduce((sum, g) => sum + (byGroup[g] || []).length, 0);
}

// --- Portada + introduccion ---
const introChildren = [
  new Paragraph({
    children: [new TextRun({ text: 'LUCI — Guía de casos de prueba para el UAT', bold: true, size: 44, color: ACCENT })],
    spacing: { after: 100 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'Ronda de pruebas de usuario (UAT) — Importación (H1) y Exportación (AES)', size: 26, color: GREY })],
    spacing: { after: 400 },
  }),
  new Paragraph({
    children: [new TextRun({ text: `Documento generado: ${new Date().toISOString().slice(0, 10)} — STRIX AI / LUCI Customs Agent`, italics: true, size: 20, color: GREY })],
    spacing: { after: 600 },
  }),
  new Paragraph({ children: [new PageBreak()] }),

  h1('Cómo usar este documento'),
  p('Este documento reúne el detalle de los 241 casos de prueba preparados en el tablero real de Trello ' +
    '(“luci-pruebas-de-usuario”, board twFILESR), organizados en 7 bloques. Cada caso tiene ya su propia ' +
    'tarjeta en Trello con los documentos PDF de prueba adjuntos (factura comercial, packing list, ' +
    'documento de transporte y certificados según el caso) — no hace falta pedir ni generar nada aparte.'),
  p('Para localizar un caso en Trello, busca la tarjeta cuyo nombre coincide EXACTAMENTE con el campo ' +
    '“Tarjeta en Trello” de cada caso en este documento.'),

  h2('Las dos vías de carga de documentos'),
  p('Cada caso puede probarse cargando sus documentos por dos caminos distintos, y conviene probar ambos ' +
    'a lo largo de la ronda de UAT (no es necesario repetir cada caso por las dos vías, pero sí cubrir ' +
    'ambas vías en conjunto con distintos casos):'),
  new Paragraph({ text: 'Portal del cliente final: enlace público con token de expediente, sin necesidad de ' +
    'iniciar sesión. Al subir un documento por aquí, el expediente cambia de estado automáticamente.',
    bullet: { level: 0 }, spacing: { after: 60 } }),
  new Paragraph({ text: 'Panel del agente aduanero: subida autenticada desde dentro de LUCI. Por esta vía el ' +
    'estado del expediente NO cambia automáticamente — el agente decide cuándo avanzarlo tras revisar el documento.',
    bullet: { level: 0 }, spacing: { after: 200 } }),

  h2('Cómo leer el campo “Qué se prueba”'),
  p('En los CASOS BASE (H1-01 a H1-43, AES-01 a AES-21) la nota de qué se prueba suele aparecer también, ' +
    'literalmente, impresa en la propia factura comercial del caso — es información de contexto para la agente, ' +
    'visible en el propio documento.'),
  p('En los casos de MERCANCÍA EXTRAÑA y en los CASOS DE BORDE de clasificación TARIC, en cambio, esa nota es ' +
    'deliberadamente interna: no aparece en ningún documento del caso. El objetivo de estos casos es que la ' +
    'clasificación arancelaria (código TARIC) se razone de verdad a partir de la descripción de la mercancía, ' +
    'sin copiar un código ya sugerido por el proveedor extranjero en la factura (que a menudo es genérico o ' +
    'directamente incorrecto, como ocurre en envíos reales).'),
  p('En los casos de CATEGORÍAS ESPECIALES (perecederos, alimentos, químicos, mercancías peligrosas y cadena de ' +
    'frío) la nota combina ambos: describe el control no arancelario específico que se está poniendo a prueba ' +
    '(fitosanitario, veterinario, REACH/CLP, ADR/IMDG/IATA-DGR, cadena de frío) y suele estar reflejada también ' +
    'en el propio certificado adjunto correspondiente.'),

  h2('Estructura del tablero'),
  new Paragraph({ text: 'H1 — Casos base (43): flujo de importación general, un tema normativo distinto por caso.',
    bullet: { level: 0 }, spacing: { after: 40 } }),
  new Paragraph({ text: 'AES — Casos base (21): flujo de exportación general.',
    bullet: { level: 0 }, spacing: { after: 40 } }),
  new Paragraph({ text: 'H1 / AES — Mercancía extraña (128): 2 variantes por cada caso base, con mercancía ' +
    'atípica pensada para poner a prueba la clasificación TARIC.',
    bullet: { level: 0 }, spacing: { after: 40 } }),
  new Paragraph({ text: 'Casos de borde — Clasificación TARIC (15): casos autónomos fundados en tensiones reales ' +
    'de las Reglas Generales de Interpretación (GRI) del Sistema Armonizado.',
    bullet: { level: 0 }, spacing: { after: 40 } }),
  new Paragraph({ text: 'H1 / AES — Categorías especiales (34): perecederos vegetales, alimentos con controles ' +
    'sanitarios reforzados, productos químicos, mercancías peligrosas para el transporte y productos con cadena ' +
    'de frío farmacéutica/biológica.',
    bullet: { level: 0 }, spacing: { after: 200 } }),

  p('Todas las tarjetas están en la etiqueta “Estado: Pendiente” al empezar la ronda — muévelas a ' +
    '“En curso”, “Bug encontrado” o “Hecho” según avances, y marca la severidad (Bloqueante/Importante/Menor/' +
    'Sin problema) en lo que encuentres.', { italics: true, color: GREY }),

  new Paragraph({ children: [new PageBreak()] }),
  h1('Índice de secciones'),
  p('El total entre paréntesis de cada lista coincide EXACTAMENTE con el número de tarjetas que se ve en ' +
    'esa misma lista dentro de Trello (verificado tarjeta por tarjeta). Cada lista se desglosa a su vez en ' +
    'los sub-bloques con los que está organizado este documento. Para saltar directamente a un caso concreto ' +
    'por su ID (ej. “H1-23” o “BORDE-06”), usa Buscar (Ctrl+F) en Word, o abre el Panel de navegación ' +
    '(pestaña Vista → Panel de navegación) para moverte por los títulos de cada caso.'),
];

SUPER_GROUPS.forEach((sg, i) => {
  const total = superGroupTotal(sg);
  introChildren.push(new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({ text: `${i + 1}. `, bold: true }),
      new TextRun({ text: `Lista Trello “${sg.listName}” `, bold: true, color: ACCENT }),
      new TextRun({ text: `— ${total} tarjetas en total`, color: GREY, bold: true }),
    ],
  }));
  sg.subgroups.forEach((g) => {
    const n = (byGroup[g] || []).length;
    introChildren.push(new Paragraph({
      text: `${g} (${n} casos)`,
      bullet: { level: 0 },
      spacing: { after: 40 },
    }));
  });
});
introChildren.push(new Paragraph({ children: [new PageBreak()] }));

// --- Cuerpo: Heading1 = lista real de Trello, Heading2 = sub-bloque, Heading3 = caso ---
const body = [];
for (const sg of SUPER_GROUPS) {
  const total = superGroupTotal(sg);
  body.push(h1(`Lista Trello: ${sg.listName} (${total} tarjetas)`));
  for (const grupo of sg.subgroups) {
    const items = byGroup[grupo] || [];
    body.push(h2(`${grupo} — ${items.length} casos`));
    for (const c of items) {
      body.push(h3(`${c.id} — ${c.titulo}`));
      body.push(labelLine('Tarjeta en Trello', c.tarjeta_trello));
      body.push(labelLine('Ruta', c.ruta));
      body.push(new Paragraph({ children: [new TextRun({ text: 'Documentos esperados adjuntos:', bold: true })], spacing: { after: 40 } }));
      body.push(...bulletDocs(c.documentos));
      body.push(new Paragraph({
        spacing: { before: 60, after: 200 },
        children: [
          new TextRun({ text: 'Qué se prueba: ', bold: true, color: ACCENT }),
          new TextRun({ text: c.que_se_prueba }),
        ],
      }));
    }
  }
}

const doc = new Document({
  creator: 'STRIX AI — LUCI Customs Agent',
  title: 'LUCI — Guía de casos de prueba para el UAT',
  sections: [
    {
      properties: { page: { size: { width: 11906, height: 16838 } } }, // A4 en DXA
      children: [...introChildren, ...body],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(OUT_PATH, buffer);
  console.log(`Escrito: ${OUT_PATH} (${casos.length} casos)`);
});
