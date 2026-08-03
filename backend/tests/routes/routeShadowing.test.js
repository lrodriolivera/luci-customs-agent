/**
 * Ninguna ruta puede quedar tapada por un comodin declarado antes.
 *
 * Express resuelve por orden de declaracion: la primera ruta que casa gana. Una
 * ruta con parametro ('/:id') captura cualquier valor en esa posicion, incluido
 * un segmento literal declarado despues ('/api-keys', '/ask-luci'). El efecto es
 * que la ruta literal se vuelve INALCANZABLE, y el fallo no se nota al leer el
 * fichero: las dos lineas estan ahi y parecen correctas.
 *
 * Verificado contra produccion antes del arreglo:
 *
 *   GET /api/portal/api-keys, con JWT de admin valido, devolvia
 *     {"error":"Datos de entrada invalidos","details":[{"field":"token",...}]}
 *   -- el validador del portal rechazando "api-keys" como token de expediente.
 *   No habia forma de listar las API keys emitidas, aunque el POST que las crea
 *   si funcionaba: se podian emitir keys sin poder auditarlas.
 *
 *   POST /api/chat/ask-luci devolvia "Error al enviar mensaje", el mensaje de
 *   POST /:expeditionId buscando un expediente con id "ask-luci". Preguntar a
 *   LUCI sin expediente estaba roto.
 *
 * Ninguno era un agujero de seguridad (fallaban cerrado), pero si funciones
 * rotas de forma silenciosa. El test recorre TODOS los routers, no solo los dos
 * afectados, para que el patron no reaparezca en otro sitio.
 */

const fs = require('fs');
const path = require('path');

const RUTAS_DIR = path.join(__dirname, '../../src/routes');
const FICHEROS = fs.readdirSync(RUTAS_DIR).filter(f => f.endsWith('.js'));

/**
 * Rutas de un fichero que quedan tapadas por un comodin anterior.
 *
 * Un comodin solo tapa a otra ruta si coincide en verbo y en numero de
 * segmentos, y cada uno de los suyos la captura: '/:token/chat' (2 segmentos)
 * NO tapa a '/self-service/expeditions' (2 segmentos, pero el primero es
 * literal y distinto), mientras que '/:token' (1) si tapa a '/api-keys'.
 */
function rutasTapadas(contenido) {
  const lineas = contenido.split('\n');
  const comodines = [];
  const tapadas = [];

  lineas.forEach((linea, i) => {
    const m = linea.match(/router\.(get|post|put|patch|delete)\(\s*['"](\/[^'"]*)['"]/);
    if (!m) return;

    const [, metodo, ruta] = m;
    const segmentos = ruta.split('/').filter(Boolean);

    const previo = comodines.find(c =>
      c.metodo === metodo &&
      c.segmentos.length === segmentos.length &&
      c.segmentos.every((s, k) => s.startsWith(':') || s === segmentos[k])
    );

    if (previo) {
      tapadas.push(`L${i + 1} ${metodo.toUpperCase()} ${ruta} <- tapada por ${previo.ruta} (L${previo.linea})`);
    }

    if (segmentos.some(s => s.startsWith(':'))) {
      comodines.push({ metodo, segmentos, linea: i + 1, ruta });
    }
  });

  return tapadas;
}

describe('rutas tapadas por un comodin anterior', () => {
  test.each(FICHEROS)('%s no tiene rutas inalcanzables', (fichero) => {
    const contenido = fs.readFileSync(path.join(RUTAS_DIR, fichero), 'utf8');

    expect(rutasTapadas(contenido)).toEqual([]);
  });
});

describe('rutasTapadas: la deteccion es correcta', () => {
  // Sin estos casos el test de arriba podria estar en verde por no detectar nada.
  test('detecta el literal declarado despues del comodin', () => {
    const r = rutasTapadas([
      "router.get('/:token', h);",
      "router.get('/api-keys', h);"
    ].join('\n'));

    expect(r).toHaveLength(1);
    expect(r[0]).toContain('/api-keys');
  });

  test('no marca el literal declarado ANTES del comodin', () => {
    expect(rutasTapadas([
      "router.get('/api-keys', h);",
      "router.get('/:token', h);"
    ].join('\n'))).toEqual([]);
  });

  test('no confunde verbos distintos', () => {
    // POST /:id no tapa a GET /stats.
    expect(rutasTapadas([
      "router.post('/:id', h);",
      "router.get('/stats', h);"
    ].join('\n'))).toEqual([]);
  });

  test('no confunde rutas con distinto numero de segmentos', () => {
    expect(rutasTapadas([
      "router.post('/:token/chat', h);",
      "router.post('/self-service/expeditions', h);"
    ].join('\n'))).toEqual([]);
  });

  test('detecta el comodin en segunda posicion', () => {
    const r = rutasTapadas([
      "router.get('/expedition/:id', h);",
      "router.get('/expedition/summary', h);"
    ].join('\n'));

    expect(r).toHaveLength(1);
  });

  test('detecta una ruta declarada dos veces', () => {
    // Duplicado exacto: la segunda nunca se ejecuta. Inofensivo si apuntan al
    // mismo handler, pero es codigo muerto que enmascara el patron.
    expect(rutasTapadas([
      "router.post('/:id/amend', a);",
      "router.post('/:id/amend', b);"
    ].join('\n'))).toHaveLength(1);
  });
});
