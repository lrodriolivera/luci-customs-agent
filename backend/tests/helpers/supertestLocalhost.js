/**
 * Hace que supertest escuche en 127.0.0.1 en vez de en todas las interfaces.
 *
 * Por que: request(app) hace app.listen(0), que en macOS escucha en '::'
 * aunque otro proceso tenga ese mismo puerto en 127.0.0.1, y despues conecta a
 * 127.0.0.1. Si el puerto efimero que da el sistema coincide con uno local (un
 * tunel ssh, ControlCenter en 5000/7000...), la peticion le llega a ese proceso
 * y el test recibe su respuesta: 404, 403 o un timeout intermitentes. Escuchando
 * en 127.0.0.1 el sistema nunca asigna un puerto ocupado ahi.
 *
 * Es el mismo arreglo que c47b26d aplico a mano en aeatRealController.db, pero
 * en un solo sitio para todos los ficheros (se carga desde tests/setup.js).
 *
 * listen(0, '127.0.0.1') es asincrono (la direccion no existe hasta
 * 'listening'), asi que la URL definitiva se fija en end(), justo antes de
 * enviar. Un servidor que ya escucha se usa tal cual.
 */

const Test = require('supertest/lib/test');

const serverAddressOriginal = Test.prototype.serverAddress;
const endOriginal = Test.prototype.end;

Test.prototype.serverAddress = function serverAddressLocal(app, path) {
  if (app.address()) return serverAddressOriginal.call(this, app, path);
  this._server = app.listen(0, '127.0.0.1');
  this._rutaLocal = path;
  return `http://127.0.0.1:0${path}`; // provisional: end() pone el puerto real
};

Test.prototype.end = function endLocal(fn) {
  const servidor = this._server;
  if (this._rutaLocal === undefined || !servidor) return endOriginal.call(this, fn);

  const enviar = () => {
    this.url = `http://127.0.0.1:${servidor.address().port}${this._rutaLocal}`;
    delete this._rutaLocal;
    endOriginal.call(this, fn);
  };

  if (servidor.listening) {
    enviar();
  } else {
    servidor.once('listening', enviar);
    servidor.once('error', (err) => fn(err));
  }
  return this;
};
