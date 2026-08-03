/**
 * Rutas con logica inline: acceso por id acotado al tenant.
 *
 * Estas rutas definen el handler dentro del propio fichero de rutas en vez de
 * delegarlo en un controller, asi que quedaron fuera de los barridos anteriores
 * —que recorrian src/controllers y src/services—. Exigian token pero no
 * comprobaban el tenant: cualquier usuario autenticado podia descargar el PDF
 * de la declaracion de otro cliente o leer el chat de su expediente con solo
 * conocer el id.
 *
 * El test recorre los ficheros en vez de probar endpoint por endpoint, para
 * cubrir tambien las rutas inline que se anadan despues.
 */

const fs = require('fs');
const path = require('path');

const RUTAS_DIR = path.join(__dirname, '../../src/routes');

/** Ficheros de rutas que resuelven documentos por id con logica inline. */
const CON_LOGICA_INLINE = ['declarations.js', 'chat.js', 'pue.js', 'transit.js'];

/** Accesos por id sin comprobacion de propiedad en las 10 lineas de alrededor. */
function accesosSinGuard(contenido) {
  const lineas = contenido.split('\n');
  const sospechosos = [];

  lineas.forEach((linea, i) => {
    if (!/\.findById\((req\.params|\w+Id)/.test(linea)) return;
    const ventana = lineas.slice(Math.max(0, i - 10), i + 10).join('\n');
    if (!/ensureSameTenant|tenantId|req\.user\._id/.test(ventana)) {
      sospechosos.push(`L${i + 1}: ${linea.trim().slice(0, 60)}`);
    }
  });

  return sospechosos;
}

describe('rutas con logica inline: acceso por id', () => {
  test.each(CON_LOGICA_INLINE)('%s comprueba la propiedad en cada findById', (fichero) => {
    const contenido = fs.readFileSync(path.join(RUTAS_DIR, fichero), 'utf8');

    expect(accesosSinGuard(contenido)).toEqual([]);
  });

  test.each(CON_LOGICA_INLINE)('%s importa ensureSameTenant', (fichero) => {
    const contenido = fs.readFileSync(path.join(RUTAS_DIR, fichero), 'utf8');

    expect(contenido).toMatch(/require\(['"]\.\.\/utils\/tenantGuard['"]\)/);
  });

  test('ningun fichero de rutas resuelve por id sin comprobar la propiedad', () => {
    // Barrido completo: cubre tambien los ficheros que hoy no tienen logica
    // inline pero puedan tenerla manana.
    const pendientes = {};

    for (const f of fs.readdirSync(RUTAS_DIR).filter(f => f.endsWith('.js'))) {
      const sospechosos = accesosSinGuard(fs.readFileSync(path.join(RUTAS_DIR, f), 'utf8'));
      if (sospechosos.length) pendientes[f] = sospechosos;
    }

    expect(pendientes).toEqual({});
  });
});
