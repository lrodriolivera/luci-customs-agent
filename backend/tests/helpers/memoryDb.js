/**
 * Base de datos en memoria para los tests que ejercitan Mongoose de verdad.
 *
 * Por que un helper opt-in y no un beforeAll global en setup.js:
 * muchas suites mockean `src/models` con jest.mock(). Si setup.js abriera una
 * conexion real para todas, esas suites tendrian una conexion viva que no
 * esperan, y las que hoy pasan sin BD podrian empezar a colgarse en el buffer
 * de Mongoose. Este helper solo lo usan las suites que lo piden.
 *
 * mongodb-memory-server se instalo en backend/.test-deps (fuera del
 * node_modules del proyecto, que es propiedad de root por una instalacion
 * previa con sudo). La ruta relativa apunta alli.
 *
 * NO es la base de datos de produccion: es un mongod efimero que arranca en un
 * puerto aleatorio, vive solo durante la suite y se destruye al terminar.
 * Cumple "todo test va contra entorno local o CI".
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('../../.test-deps/node_modules/mongodb-memory-server');

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

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });
}

module.exports = { usarBaseDeDatosEnMemoria };
