/**
 * knowledgeController: catálogos de regímenes e incoterms.
 *
 * El frontend consultaba /ai/knowledge/regime/:code y /incoterm/:code, rutas
 * inexistentes que caían al fallback de la SPA (index.html con 200) dejando los
 * paneles vacíos. Ahora existen bajo /api/knowledge y devuelven JSON real.
 */

const request = require('supertest');
const express = require('express');
const knowledgeRoutes = require('../../src/routes/knowledge');

const app = express();
app.use(express.json());
app.use('/api/knowledge', knowledgeRoutes);

describe('knowledgeController', () => {
  describe('GET /api/knowledge/regime/:code', () => {
    it('devuelve el régimen 40 (libre práctica) con datos completos', async () => {
      const res = await request(app).get('/api/knowledge/regime/40');
      expect(res.status).toBe(200);
      expect(res.body.code).toBe('40');
      expect(res.body.name).toMatch(/libre práctica/i);
      expect(Array.isArray(res.body.requirements)).toBe(true);
      expect(res.body.requirements.length).toBeGreaterThan(0);
      expect(res.body.vat).toBeTruthy();
      expect(res.body.typical_use).toBeTruthy();
    });

    it('devuelve el régimen 42 (entrega intracomunitaria exenta)', async () => {
      const res = await request(app).get('/api/knowledge/regime/42');
      expect(res.status).toBe(200);
      expect(res.body.code).toBe('42');
      expect(res.body.vat).toMatch(/exento|destino/i);
    });

    it('404 con JSON (no HTML) para un régimen inexistente', async () => {
      const res = await request(app).get('/api/knowledge/regime/99');
      expect(res.status).toBe(404);
      expect(res.body.error).toBeTruthy();
      // Lo esencial: JSON, no el index.html de la SPA.
      expect(res.headers['content-type']).toMatch(/json/);
    });
  });

  describe('GET /api/knowledge/incoterm/:code', () => {
    it('devuelve CIF con el ajuste de valor en aduana', async () => {
      const res = await request(app).get('/api/knowledge/incoterm/CIF');
      expect(res.status).toBe(200);
      expect(res.body.code).toBe('CIF');
      expect(res.body.valueAdjustment).toMatch(/flete|seguro/i);
    });

    it('normaliza el código a mayúsculas (ddp → DDP)', async () => {
      const res = await request(app).get('/api/knowledge/incoterm/ddp');
      expect(res.status).toBe(200);
      expect(res.body.code).toBe('DDP');
      expect(res.body.valueAdjustment).toMatch(/restar/i);
    });

    it('404 JSON para un incoterm inexistente', async () => {
      const res = await request(app).get('/api/knowledge/incoterm/XXX');
      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/json/);
    });
  });

  describe('listados', () => {
    it('lista los 7 regímenes', async () => {
      const res = await request(app).get('/api/knowledge/regimes');
      expect(res.status).toBe(200);
      expect(res.body.regimes).toHaveLength(7);
    });

    it('lista los 10 incoterms', async () => {
      const res = await request(app).get('/api/knowledge/incoterms');
      expect(res.status).toBe(200);
      expect(res.body.incoterms).toHaveLength(10);
    });
  });
});
