/**
 * supertest escucha en 127.0.0.1, no en todas las interfaces.
 *
 * request(app) hacia app.listen(0), que en macOS escucha en '::' aunque otro
 * proceso tenga ese puerto en 127.0.0.1, y luego conectaba a 127.0.0.1: si el
 * puerto efimero coincidia con uno local (un tunel ssh, ControlCenter en
 * 5000/7000), contestaba ese proceso. Asi fallaban de forma intermitente
 * querySILICIE (404) y los tests de OEA (403 y timeouts). Ver c47b26d.
 *
 * tests/helpers/supertestLocalhost.js (cargado desde tests/setup.js) hace que
 * supertest escuche en 127.0.0.1 y espere a 'listening' antes de enviar, en
 * todos los ficheros de test.
 */

const express = require('express');
const http = require('http');
const request = require('supertest');

function appEco() {
  const app = express();
  app.get('/eco', (req, res) => res.json({ local: req.socket.localAddress, q: req.query.q }));
  return app;
}

test('request(app) escucha en 127.0.0.1 (IPv4), no en ::', async () => {
  const res = await request(appEco()).get('/eco');
  expect(res.status).toBe(200);
  expect(res.body.local).toBe('127.0.0.1');
});

test('conserva la query string y el path', async () => {
  const res = await request(appEco()).get('/eco').query({ q: 'hola' });
  expect(res.body.q).toBe('hola');
});

test('funciona con .expect y con un http.Server sin arrancar', async () => {
  await request(http.createServer(appEco())).get('/eco').expect(200);
});

test('un servidor ya escuchando se usa tal cual', async () => {
  const servidor = http.createServer(appEco());
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  try {
    const res = await request(servidor).get('/eco');
    expect(res.body.local).toBe('127.0.0.1');
  } finally {
    await new Promise((resolve) => servidor.close(resolve));
  }
});

test('el servidor temporal se cierra al terminar la peticion', async () => {
  const servidor = http.createServer(appEco());
  await request(servidor).get('/eco');
  expect(servidor.listening).toBe(false);
});
