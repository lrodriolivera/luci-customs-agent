/**
 * GET /api/knowledge/categories respondia 404.
 *
 * La barra lateral de la pantalla del asistente (/assistant, ChatAssistant)
 * pide al cargar las categorias de la base de conocimiento, pero el router de
 * /api/knowledge solo declaraba regimenes e incoterms: la ruta no existia, la
 * consola mostraba el 404 y el panel "Base de conocimiento" quedaba vacio.
 *
 * La respuesta es un objeto { clave: { name, description } }, que es lo que el
 * componente recorre con Object.entries.
 */
jest.mock('../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const express = require('express');
const request = require('supertest');
const router = require('../../src/routes/knowledge');

function app() {
  const a = express();
  a.use('/api/knowledge', router);
  return a;
}

describe('GET /api/knowledge/categories', () => {
  test('responde 200 con un objeto de categorias { name, description }', async () => {
    const res = await request(app()).get('/api/knowledge/categories');

    expect(res.status).toBe(200);
    const entradas = Object.entries(res.body);
    expect(entradas.length).toBeGreaterThan(0);
    entradas.forEach(([clave, cat]) => {
      expect(typeof clave).toBe('string');
      expect(typeof cat.name).toBe('string');
      expect(cat.name.length).toBeGreaterThan(0);
      expect(typeof cat.description).toBe('string');
      expect(cat.description.length).toBeGreaterThan(0);
    });
  });

  test('incluye temas aduaneros y temas de uso de LUCI', async () => {
    const res = await request(app()).get('/api/knowledge/categories');
    const nombres = Object.values(res.body).map(c => c.name).join(' | ');

    expect(nombres).toMatch(/Regímenes aduaneros/);
    expect(nombres).toMatch(/Incoterms/);
    expect(nombres).toMatch(/Portal del cliente/);
  });

  test('no necesita base de datos ni IA (catalogo estatico)', async () => {
    const res = await request(app()).get('/api/knowledge/categories');
    expect(res.headers['content-type']).toMatch(/json/);
  });
});
