/**
 * Genera el juego fijo de productos para medir la clasificacion TARIC
 * (juego-productos.json) y la plantilla para que la agente aduanera fije el
 * codigo correcto de 10 digitos (para-validar-patricia.csv).
 *
 * Fuente: los manifiestos de las pruebas documentales de la UAT
 * (trello/pruebas-documentales/{H1,AES,CASOS-BORDE-TARIC}/<caso>/00_resumen_caso.txt).
 *
 * - H1 y AES: el `HS:` de 6 digitos que figura en la factura del proveedor
 *   ficticio. Nadie lo ha validado: `validado: false`.
 * - Casos de borde: el `HS:` de la factura es erroneo a proposito; la
 *   respuesta sale del texto del fundamento del caso, al nivel que da (4 o 6
 *   digitos). La frase se copia literal como fuente y se comprueba que esta
 *   en el manifiesto.
 * - Ningun producto lleva codigo de 10 digitos: `esperado10: null` hasta que
 *   la agente lo valide.
 *
 * Es determinista: misma entrada, mismo juego.
 *
 * Ejecutar (desde backend/):  node tests/fixtures/clasificacion/generarJuego.js
 */
const fs = require('fs');
const path = require('path');

const RAIZ_PRUEBAS = path.resolve(__dirname, '../../../../trello/pruebas-documentales');
const DESTINO_JUEGO = path.join(__dirname, 'juego-productos.json');
const DESTINO_CSV = path.join(__dirname, 'para-validar-patricia.csv');
const MAX_PRODUCTOS = 60;

// Respuesta de cada caso de borde segun su propio fundamento. Los casos 12
// (kit solar: se declara cada componente por separado), 13 (SCOBY: el texto
// solo descarta 2102) y 15 (te con CBD: plantea la duda sin resolverla) no
// tienen un unico codigo correcto y se dejan fuera.
const RESPUESTAS_BORDE = {
  'BORDE-01': { esperado6: '844332', cita: 'la practica real consolidada en la UE clasifica estos equipos en 8443.32' },
  'BORDE-02': { esperado4: '9503', cita: 'las autoridades aduaneras consolidaron su clasificacion como juguete (9503)' },
  'BORDE-03': { esperado4: '9505', cita: "El Capitulo 95 (9505) cubre expresamente 'articulos para fiestas' incluidos los disfraces de carnaval, PERO solo si la calidad de confeccion es claramente inferior a la de una prenda de vestir normal" },
  'BORDE-04': { esperado4: '2202', cita: 'el Sistema Armonizado dirige especificamente las bebidas a las que se ha extraido el alcohol tras la fermentacion hacia la partida 2202' },
  'BORDE-05': { esperado4: '2106', cita: 'presentado y etiquetado como complemento alimenticio (sin indicacion de dosis terapeutica ni enfermedad concreta a tratar), corresponde a 2106' },
  'BORDE-06': { esperado4: '9403', cita: 'un mueble fabricado en 2024 en estilo Luis XV va en 9403 (muebles)' },
  'BORDE-07': { esperado4: '9703', cita: 'se clasifican en la partida 9703' },
  'BORDE-08': { esperado4: '6309', cita: 'La partida 6309 (prenderia) es una de las pocas partidas del Sistema Armonizado definida por el ESTADO del producto (usado)' },
  'BORDE-09': { esperado6: '120799', cita: 'se clasifican como semilla oleaginosa alimentaria ordinaria (1207.99)' },
  'BORDE-10': { esperado4: '8471', alternativas4: ['8543'], cita: 'mas propio de la partida 8471 (o 8543 segun el analisis)' },
  'BORDE-11': { esperado4: '4010', cita: 'corresponde a su propia partida de articulo de caucho para uso tecnico general (4010)' },
  'BORDE-14': { esperado4: '8528', cita: 'clasificar por funcion principal: la visualizacion' }
};

function leerManifiesto(fichero) {
  const texto = fs.readFileSync(fichero, 'utf8');
  const id = (texto.match(/^CASO (\S+)/m) || [])[1];
  const mercancias = [];
  let descripcion = null;
  for (const linea of texto.split('\n')) {
    if (linea.startsWith('  - ')) descripcion = linea.slice(4).trim();
    const hs = linea.match(/^\s+HS:\s*(\d+)/);
    if (hs && descripcion) {
      mercancias.push({ descripcion, hs: hs[1] });
      descripcion = null;
    }
  }
  return { id, texto, mercancias };
}

function manifiestos(grupo) {
  const dir = path.join(RAIZ_PRUEBAS, grupo);
  return fs.readdirSync(dir).sort().map((caso) => ({
    carpeta: `trello/pruebas-documentales/${grupo}/${caso}/00_resumen_caso.txt`,
    ...leerManifiesto(path.join(dir, caso, '00_resumen_caso.txt'))
  }));
}

function productosProveedor() {
  const vistos = { descripciones: new Set(), codigos: new Set() };
  const productos = [];
  for (const m of [...manifiestos('H1'), ...manifiestos('AES')]) {
    for (const { descripcion, hs } of m.mercancias) {
      // Un producto por descripcion y por codigo: repetidos no aportan medida.
      if (vistos.descripciones.has(descripcion) || vistos.codigos.has(hs)) continue;
      vistos.descripciones.add(descripcion);
      vistos.codigos.add(hs);
      productos.push({
        grupo: 'proveedor_sin_validar',
        descripcion,
        esperado4: hs.slice(0, 4),
        esperado6: hs,
        esperado10: null,
        validado: false,
        fuente: `${m.id} (${m.carpeta}): HS de la factura del proveedor, codigo del proveedor, sin validar`
      });
    }
  }
  return productos.sort((a, b) => a.esperado6.localeCompare(b.esperado6));
}

function productosBorde() {
  return manifiestos('CASOS-BORDE-TARIC')
    .filter((m) => RESPUESTAS_BORDE[m.id])
    .map((m) => {
      const r = RESPUESTAS_BORDE[m.id];
      if (!m.texto.includes(r.cita)) throw new Error(`${m.id}: la cita no esta en el manifiesto`);
      return {
        grupo: 'caso_borde',
        descripcion: m.mercancias[0].descripcion,
        esperado4: r.esperado4 || r.esperado6.slice(0, 4),
        esperado6: r.esperado6 || null,
        ...(r.alternativas4 ? { alternativas4: r.alternativas4 } : {}),
        esperado10: null,
        validado: false,
        codigoFactura: m.mercancias[0].hs,
        fuente: `${m.id} (${m.carpeta}): «${r.cita}»`
      };
    });
}

/**
 * Muestra variada y siempre la misma: mientras sobren productos se quita el
 * ultimo (por codigo) del capitulo con mas productos; asi no desaparece
 * ningun capitulo mientras haya otro repetido.
 */
function muestraRepartida(lista, cuantos) {
  let resto = [...lista];
  while (resto.length > cuantos) {
    const porCapitulo = resto.reduce((acc, p) => ({ ...acc, [p.esperado4.slice(0, 2)]: (acc[p.esperado4.slice(0, 2)] || 0) + 1 }), {});
    const capitulo = Object.keys(porCapitulo).sort((a, b) => porCapitulo[b] - porCapitulo[a] || a.localeCompare(b))[0];
    const ultimo = resto.map((p) => p.esperado4.slice(0, 2)).lastIndexOf(capitulo);
    resto = resto.filter((_, i) => i !== ultimo);
  }
  return resto;
}

function csv(valor) {
  const texto = String(valor ?? '');
  return /[",;\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function main() {
  const borde = productosBorde();
  const proveedor = productosProveedor();
  const elegidos = muestraRepartida(proveedor, MAX_PRODUCTOS - borde.length);
  const productos = [...elegidos, ...borde].map((p, i) => ({ id: `P${String(i + 1).padStart(2, '0')}`, ...p }));

  const juego = {
    descripcion: 'Juego fijo para medir la clasificacion TARIC. Sin codigos de 10 digitos validados: ' +
      'esperado10 se rellena cuando la agente aduanera los fije (para-validar-patricia.csv).',
    generadoCon: 'backend/tests/fixtures/clasificacion/generarJuego.js',
    totales: {
      productos: productos.length,
      proveedor_sin_validar: elegidos.length,
      proveedor_distintos_disponibles: proveedor.length,
      caso_borde: borde.length
    },
    productos
  };
  fs.writeFileSync(DESTINO_JUEGO, `${JSON.stringify(juego, null, 2)}\n`);

  const cabecera = ['id', 'grupo', 'descripcion', 'codigo de referencia (HS6 del proveedor o respuesta del caso de borde)',
    'TARIC correcto (10 digitos)', 'comentario'];
  const filas = productos.map((p) => [p.id, p.grupo === 'caso_borde' ? 'caso de borde' : 'proveedor sin validar',
    p.descripcion, p.esperado6 || p.esperado4, '', '']);
  // BOM para que Excel abra bien los acentos.
  fs.writeFileSync(DESTINO_CSV, `﻿${[cabecera, ...filas].map((f) => f.map(csv).join(';')).join('\n')}\n`);

  console.log(`Juego: ${productos.length} productos (${elegidos.length} de ${proveedor.length} del proveedor, ${borde.length} de borde)`);
}

if (require.main === module) main();

module.exports = { leerManifiesto, muestraRepartida, RESPUESTAS_BORDE };
