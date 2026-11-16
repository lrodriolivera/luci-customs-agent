/**
 * GET /api/classification/aeat-tariff: validacion de entrada y errores de la
 * consulta del Arancel Integrado de la AEAT (el servicio se prueba aparte).
 */
const request = require('supertest');
const express = require('express');

const mockConsultar = jest.fn();
jest.mock('../../src/services/aeat/arancelIntegrado', () => {
  class ArancelIntegradoError extends Error {
    constructor(message, codigo) { super(message); this.codigo = codigo; }
  }
  return { consultarArancelIntegrado: (...a) => mockConsultar(...a), ArancelIntegradoError };
});
jest.mock('../../src/models', () => ({ TaricCode: {}, Expedition: {}, TaricSearchHistory: {}, TaricAICache: {} }));
jest.mock('../../src/services/aiService', () => ({}));
jest.mock('../../src/services/taricService', () => ({}));

const ctrl = require('../../src/controllers/classificationController');
const { ArancelIntegradoError } = require('../../src/services/aeat/arancelIntegrado');

const app = () => {
  const a = express();
  a.get('/aeat-tariff', ctrl.getAeatTariff);
  return a;
};

describe('classificationController.getAeatTariff', () => {
  beforeEach(() => jest.clearAllMocks());

  test('devuelve las medidas de la AEAT para el codigo y el origen', async () => {
    mockConsultar.mockResolvedValue({ existe: true, codigo: '6302210089', medidas: [{ codigo: 'IVA-IVA', derecho: '21,000%' }] });

    const res = await request(app()).get('/aeat-tariff?code=6302.21.00.89&origin=cn');

    expect(res.status).toBe(200);
    expect(res.body.data.medidas[0].codigo).toBe('IVA-IVA');
    expect(mockConsultar).toHaveBeenCalledWith({ codigo: '6302210089', origen: 'CN' });
  });

  test('sin origen consulta erga omnes', async () => {
    mockConsultar.mockResolvedValue({ existe: true, medidas: [] });
    await request(app()).get('/aeat-tariff?code=6302210089');
    expect(mockConsultar).toHaveBeenCalledWith({ codigo: '6302210089', origen: undefined });
  });

  test.each([
    ['code=630221', 'Código TARIC no válido (10 dígitos)'],
    ['code=6302210089&origin=CHN', 'País de origen no válido (código ISO de dos letras)']
  ])('400 con %s', async (query, error) => {
    const res = await request(app()).get(`/aeat-tariff?${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(error);
    expect(mockConsultar).not.toHaveBeenCalled();
  });

  test('si la AEAT cambia el formato se dice asi, con 502', async () => {
    mockConsultar.mockRejectedValue(new ArancelIntegradoError('sin tabla', 'FORMATO'));
    const res = await request(app()).get('/aeat-tariff?code=6302210089');
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('La AEAT ha cambiado el formato de su consulta del Arancel Integrado');
  });

  test('un fallo de red da 502 con un mensaje generico', async () => {
    mockConsultar.mockRejectedValue(new Error('ECONNRESET'));
    const res = await request(app()).get('/aeat-tariff?code=6302210089');
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('No se pudo consultar el Arancel Integrado de la AEAT');
  });
});
