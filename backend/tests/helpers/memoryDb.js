/**
 * Base de datos en memoria para los tests que ejercitan Mongoose de verdad.
 *
 * Por que un helper opt-in y no un beforeAll global en setup.js:
 * muchas suites mockean `src/models` con jest.mock(). Si setup.js abriera una
 * conexion real para todas, esas suites tendrian una conexion viva que no
 * esperan, y las que hoy pasan sin BD podrian empezar a colgarse en el buffer
 * de Mongoose. Este helper solo lo usan las suites que lo piden.
 *
 * NO es la base de datos de produccion: es un mongod efimero que arranca en un
 * puerto aleatorio, vive solo durante la suite y se destruye al terminar.
 * Cumple "todo test va contra entorno local o CI".
 */

const mongoose = require('mongoose');

/**
 * mongodb-memory-server esta declarado en package.json, asi que en un checkout
 * limpio (`npm ci`, CI incluido) resuelve por su nombre. En el checkout de
 * desarrollo de Luis no: el node_modules del proyecto quedo propiedad de root
 * por una instalacion previa con sudo y npm no puede escribir en el, de modo
 * que ahi el paquete vive en backend/.test-deps.
 *
 * Antes solo existia la ruta a .test-deps, que esta en .gitignore: las 70
 * suites que usan este helper fallaban en CI con MODULE_NOT_FOUND y llevaban
 * rojas desde la ejecucion 45 sin que nadie lo viera.
 */
function cargarMongoMemoryServer() {
  try {
    return require('mongodb-memory-server');
  } catch (error) {
    const noEstaInstalado =
      error.code === 'MODULE_NOT_FOUND' &&
      error.message.includes("'mongodb-memory-server'");
    if (!noEstaInstalado) throw error;
    return require('../../.test-deps/node_modules/mongodb-memory-server');
  }
}

const { MongoMemoryServer } = cargarMongoMemoryServer();

let mongod;

/**
 * Cablea una BD en memoria para la suite que lo llame. Registra los
 * beforeAll/afterAll/afterEach necesarios. Usar dentro de un describe.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.limpiarEntreTests=true] vacia las colecciones tras
 *   cada test para que no se contaminen entre si.
 */
function usarBaseDeDatosEnMemoria({ limpiarEntreTests = true } = {}) {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  }, 60000); // la primera vez puede descargar el binario

  if (limpiarEntreTests) {
    afterEach(async () => {
      const colecciones = mongoose.connection.collections;
      for (const nombre of Object.keys(colecciones)) {
        await colecciones[nombre].deleteMany({});
      }
    });
  }

  // Timeout holgado: bajo --coverage y con varias suites .db corriendo en
  // paralelo, parar el mongod compite por CPU/IO y supera los 10s por defecto.
  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  }, 60000);
}

module.exports = { usarBaseDeDatosEnMemoria };
