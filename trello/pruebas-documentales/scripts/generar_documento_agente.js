const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak,
} = require('docx');

const DATA_PATH = path.join(__dirname, 'casos_documento_agente.json');
const FUNC_PATH = path.join(__dirname, 'casos_funcionales.json');
const OUT_PATH = path.join(__dirname, '..', 'LUCI-Guia-Casos-Prueba-Agente-Aduanera.docx');

const casos = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
// 48 pruebas funcionales de pantalla (sin documentos adjuntos), exportadas del tablero.
const funcionales = fs.existsSync(FUNC_PATH) ? JSON.parse(fs.readFileSync(FUNC_PATH, 'utf-8')) : [];

// Datos de acceso para la ronda. La URL es la de produccion; el usuario lo entrega STRIX aparte.
const ACCESO = {
  url: 'https://aduanas.strixai.ai',
  contacto: 'Luis Rodríguez (STRIX AI) — luis.rodriguez@strixai.ai',
};

const sinMarkdown = (t) => (t || '').replace(/\*\*/g, '');

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
    children: [new TextRun({ text: 'Ronda de pruebas de usuario (UAT) — Importación (H1), Exportación (AES), clasificación TARIC y pruebas funcionales', size: 26, color: GREY })],
    spacing: { after: 400 },
  }),
  new Paragraph({
    children: [new TextRun({ text: `Documento generado: ${new Date().toISOString().slice(0, 10)} — STRIX AI / LUCI Customs Agent`, italics: true, size: 20, color: GREY })],
    spacing: { after: 600 },
  }),
  new Paragraph({ children: [new PageBreak()] }),

  h1('Antes de empezar'),
  labelLine('Aplicación', ACCESO.url),
  labelLine('Usuario y contraseña', 'te los entrega STRIX AI por un canal aparte; no están en este documento ni en Trello. Tu usuario pertenece a una organización de pruebas con su EORI ya configurado en Ajustes > Aduanas.'),
  labelLine('Tablero de seguimiento', 'Trello “LUCI — Pruebas de usuario” (https://trello.com/b/twFILESR). Una tarjeta por caso; en ella anotas el resultado.'),
  labelLine('Entorno de la AEAT', 'las declaraciones de esta ronda se envían al entorno de PREPRODUCCIÓN de la AEAT, sin efectos reales. Los importadores y exportadores de los casos son empresas ficticias con NIF de formato válido. Si al enviar ves un MRN y un canal, es el de preproducción. Confirma con STRIX este punto antes de la primera prueba de envío y no envíes nunca estos casos contra producción.'),
  labelLine('Contacto', ACCESO.contacto),

  h2('Cómo anotar el resultado de cada caso'),
  new Paragraph({ text: 'Al empezar un caso cambia su etiqueta de “Estado: Pendiente” a “Estado: En curso”.', bullet: { level: 0 }, spacing: { after: 40 } }),
  new Paragraph({ text: 'Al terminar: “Estado: Hecho” si el resultado coincide con lo esperado, o “Estado: Bug encontrado” si no.', bullet: { level: 0 }, spacing: { after: 40 } }),
  new Paragraph({ text: 'Si hay fallo, añade la severidad: Bloqueante (impide seguir), Importante (resultado incorrecto), Menor (estético o de texto) o Sin problema.', bullet: { level: 0 }, spacing: { after: 40 } }),
  new Paragraph({ text: 'Rellena en la descripción de la tarjeta los campos “Resultado obtenido”, “Probado por / fecha” y adjunta una captura de pantalla como evidencia. Cuando no haya plantilla, escribe un comentario con esos tres datos.', bullet: { level: 0 }, spacing: { after: 40 } }),
  new Paragraph({ text: 'Si un caso no se puede ejecutar (falta un dato, un permiso, una pantalla), ponlo en “Bug encontrado” con severidad Bloqueante y explica qué faltó: eso también es un resultado.', bullet: { level: 0 }, spacing: { after: 200 } }),

  h2('Orden recomendado'),
  new Paragraph({ text: 'Ronda 1: los 43 casos base de H1, los 21 casos base de AES y las pruebas funcionales de prioridad ALTA. Son los flujos reales de un despacho.', bullet: { level: 0 }, spacing: { after: 40 } }),
  new Paragraph({ text: 'Ronda 2: categorías especiales, mercancía extraña y casos de borde de clasificación TARIC, y las funcionales de prioridad MEDIA y BAJA.', bullet: { level: 0 }, spacing: { after: 200 } }),

  new Paragraph({ children: [new PageBreak()] }),

  h1('Cómo usar este documento'),
  p(`Este documento reúne el detalle de los ${casos.length} casos de prueba documentales y las ${funcionales.length} pruebas ` +
    'funcionales de pantalla preparados en el tablero real de Trello (“luci-pruebas-de-usuario”, board twFILESR). ' +
    'Cada caso documental tiene ya su propia tarjeta en Trello con los documentos PDF de prueba adjuntos (factura ' +
    'comercial, packing list, documento de transporte y certificados según el caso) — no hace falta pedir ni generar nada aparte.'),
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
  p('En los CASOS BASE (H1-01 a H1-43, AES-01 a AES-21) la explicación está en español. A continuación se cita, ' +
    'entre comillas, la nota en inglés que lleva impresa la propia factura comercial del caso: la emite un proveedor ' +
    'extranjero y por eso va en inglés, como en un envío real. Es información de contexto visible en el documento.'),
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
    bullet: { level: 0 }, spacing: { after: 40 } }),
  new Paragraph({ text: `Pruebas funcionales de pantalla (${funcionales.length}): clasificación y calculadora, contingentes y normativa, ` +
    'H7 bajo valor, impuestos especiales, portal del cliente, preferencias arancelarias y requerimientos. Sin documentos ' +
    'adjuntos: cada tarjeta dice cómo llegar a la pantalla, qué condición probar y qué resultado se espera.',
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
// Listas de pruebas funcionales en el indice, a continuacion de las documentales.
const listasFuncionales = [...new Set(funcionales.map((f) => f.lista))];
listasFuncionales.forEach((lista, i) => {
  const n = funcionales.filter((f) => f.lista === lista).length;
  introChildren.push(new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({ text: `${SUPER_GROUPS.length + i + 1}. `, bold: true }),
      new TextRun({ text: `Lista Trello “${lista}” `, bold: true, color: ACCENT }),
      new TextRun({ text: `— ${n} pruebas funcionales (sin adjuntos)`, color: GREY, bold: true }),
    ],
  }));
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

// --- Pruebas funcionales de pantalla: Heading1 = lista de Trello, Heading3 = tarjeta ---
if (funcionales.length) {
  body.push(h1(`Pruebas funcionales de pantalla (${funcionales.length} tarjetas, sin documentos adjuntos)`));
  body.push(p('Estas tarjetas no llevan PDF: se prueban directamente en la pantalla que indica “Cómo llegar”. ' +
    'La prioridad ALTA marcada como REGRESIÓN corresponde a fallos ya corregidos que no deben volver a aparecer.'));
  for (const lista of listasFuncionales) {
    const items = funcionales.filter((f) => f.lista === lista);
    body.push(h2(`${lista} — ${items.length} pruebas`));
    for (const f of items) {
      body.push(h3(f.tarjeta_trello));
      body.push(labelLine('Tarjeta en Trello', f.tarjeta_trello));
      body.push(labelLine('Prioridad', f.prioridad));
      body.push(labelLine('Cómo llegar', sinMarkdown(f.como_llegar)));
      body.push(labelLine('Condición a probar', sinMarkdown(f.condicion)));
      body.push(new Paragraph({
        spacing: { before: 60, after: f.fuente ? 60 : 200 },
        children: [
          new TextRun({ text: 'Resultado esperado: ', bold: true, color: ACCENT }),
          new TextRun({ text: sinMarkdown(f.resultado_esperado) }),
        ],
      }));
      if (f.fuente) body.push(labelLine('Fuente', f.fuente));
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
