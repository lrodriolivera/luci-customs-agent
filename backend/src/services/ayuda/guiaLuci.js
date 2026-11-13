/**
 * Guia de uso de LUCI para el asistente.
 *
 * El asistente (chat flotante y pantalla /assistant) solo sabia de normativa:
 * a preguntas de uso de la aplicacion respondia que no tenia informacion y
 * remitia a soporte. Esta guia describe lo que la aplicacion hace de verdad,
 * escrita a partir de las pantallas y rutas reales, y se inyecta en el system
 * prompt del asistente.
 *
 * El texto vive en guiaLuci.md para poder editarlo sin tocar codigo. Cada
 * seccion empieza por "## Titulo {#id}" seguida de una linea "> resumen": el
 * resumen alimenta las categorias de la barra lateral del asistente.
 *
 * Si cambia una pantalla, hay que actualizar la guia: el asistente responde con
 * lo que dice aqui.
 */

const fs = require('fs');
const path = require('path');

const RUTA_GUIA = path.join(__dirname, 'guiaLuci.md');

const GUIA_LUCI = fs.readFileSync(RUTA_GUIA, 'utf8').trim();

const CABECERA_SECCION = /^## (.+?) \{#([a-z0-9-]+)\}\s*$/;

function parsearSecciones(texto) {
  const secciones = [];
  let actual = null;

  texto.split('\n').forEach(linea => {
    const m = linea.match(CABECERA_SECCION);
    if (m) {
      actual = { id: m[2], titulo: m[1].trim(), lineas: [linea] };
      secciones.push(actual);
      return;
    }
    if (actual) actual.lineas.push(linea);
  });

  return secciones.map(({ id, titulo, lineas }) => {
    const lineaResumen = lineas.find(l => l.startsWith('> ')) || '';
    return Object.freeze({
      id,
      titulo,
      resumen: lineaResumen.slice(2).trim(),
      texto: lineas.join('\n').trim()
    });
  });
}

const SECCIONES = Object.freeze(parsearSecciones(GUIA_LUCI));

/** Secciones de la guia, en el orden del fichero. */
function seccionesGuia() {
  return SECCIONES;
}

/** Categorias para la barra lateral del asistente: { id: { name, description } }. */
function categoriasAyuda() {
  return Object.fromEntries(
    SECCIONES.map(s => [s.id, { name: s.titulo, description: s.resumen }])
  );
}

module.exports = { GUIA_LUCI, seccionesGuia, categoriasAyuda };
