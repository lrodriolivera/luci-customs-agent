/**
 * regulationController — busqueda de normativa (BOE / EUR-Lex), catalogos CAU/BOE
 * y analisis con LUCI. A diferencia de otros controllers, aqui NO hay estado de
 * negocio propio en Mongo: el controller ORQUESTA dos limites externos legitimos
 * (regulationService, que hace scraping/red a BOE y EUR-Lex; y aiService, que
 * llama a Bedrock) y transforma sus respuestas. Mockear ambos es honesto porque
 * el controller no reimplementa su logica — solo valida entrada, construye el
 * prompt y mapea la salida. Eso —la validacion, el armado de prompt y el mapeo—
 * es exactamente lo que estos tests ejercen de verdad.
 *
 * jest.config tiene resetMocks:true -> los fakes se reinstalan en beforeEach.
 */

jest.mock('../../src/services/regulationService', () => ({
  searchBOE: jest.fn(),
  searchEURLex: jest.fn(),
  searchAll: jest.fn(),
  getCAUCatalog: jest.fn(),
  getBOECatalog: jest.fn(),
  getDocumentContent: jest.fn(),
  searchArticle: jest.fn()
}));
jest.mock('../../src/services/aiService', () => ({
  analyzeRegulation: jest.fn(),
  askLuci: jest.fn()
}));

const regulationController = require('../../src/controllers/regulationController');
const regulationService = require('../../src/services/regulationService');
const aiService = require('../../src/services/aiService');

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  return res;
}
const mockReq = ({ query = {}, body = {} } = {}) => ({ query, body });

beforeEach(() => {
  regulationService.searchBOE.mockResolvedValue([{ id: 'BOE-1' }]);
  regulationService.searchEURLex.mockResolvedValue([{ id: 'CELEX-1' }]);
  regulationService.searchAll.mockResolvedValue({ boe: [], eurlex: [] });
  regulationService.getCAUCatalog.mockReturnValue([{ id: 'CAU-952-2013' }]);
  regulationService.getBOECatalog.mockReturnValue([{ id: 'BOE-CAT-1' }]);
  regulationService.getDocumentContent.mockResolvedValue({ content: 'texto del documento' });
  regulationService.searchArticle.mockResolvedValue({ found: true, excerpt: 'Articulo 5...' });
  aiService.analyzeRegulation.mockResolvedValue({
    message: 'analisis', confidence: 0.9, model: 'claude', tokensUsed: 123
  });
  aiService.askLuci.mockResolvedValue({ message: 'respuesta', confidence: 0.8, model: 'claude' });
});

describe('searchBOE', () => {
  test('400 si falta el termino de busqueda', async () => {
    const res = mockRes();
    await regulationController.searchBOE(mockReq(), res);
    expect(res.statusCode).toBe(400);
    expect(regulationService.searchBOE).not.toHaveBeenCalled();
  });

  test('delega en el service con limit parseado y devuelve resultados', async () => {
    const res = mockRes();
    await regulationController.searchBOE(mockReq({ query: { q: 'IVA', limit: '5', department: 'Hacienda' } }), res);
    expect(regulationService.searchBOE).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'IVA', limit: 5, department: 'Hacienda' })
    );
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([{ id: 'BOE-1' }]);
  });

  test('limit por defecto = 20 cuando no es numerico', async () => {
    const res = mockRes();
    await regulationController.searchBOE(mockReq({ query: { q: 'x', limit: 'abc' } }), res);
    expect(regulationService.searchBOE).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
  });

  test('500 si el service lanza (propaga el mensaje)', async () => {
    regulationService.searchBOE.mockRejectedValue(new Error('BOE caido'));
    const res = mockRes();
    await regulationController.searchBOE(mockReq({ query: { q: 'x' } }), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('BOE caido');
  });
});

describe('searchEURLex', () => {
  test('400 sin query', async () => {
    const res = mockRes();
    await regulationController.searchEURLex(mockReq(), res);
    expect(res.statusCode).toBe(400);
  });

  test('delega y devuelve', async () => {
    const res = mockRes();
    await regulationController.searchEURLex(mockReq({ query: { q: 'aranceles', type: 'REG', year: '2023' } }), res);
    expect(regulationService.searchEURLex).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'aranceles', type: 'REG', year: '2023', limit: 20 })
    );
    expect(res.body.data).toEqual([{ id: 'CELEX-1' }]);
  });

  test('500 al fallar', async () => {
    regulationService.searchEURLex.mockRejectedValue(new Error('eurlex down'));
    const res = mockRes();
    await regulationController.searchEURLex(mockReq({ query: { q: 'x' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('searchAll', () => {
  test('400 sin query', async () => {
    const res = mockRes();
    await regulationController.searchAll(mockReq(), res);
    expect(res.statusCode).toBe(400);
  });

  test('delega en searchAll(query, {limit})', async () => {
    const res = mockRes();
    await regulationController.searchAll(mockReq({ query: { q: 'origen', limit: '3' } }), res);
    expect(regulationService.searchAll).toHaveBeenCalledWith('origen', { limit: 3 });
    expect(res.body.success).toBe(true);
  });

  test('500 al fallar', async () => {
    regulationService.searchAll.mockRejectedValue(new Error('boom'));
    const res = mockRes();
    await regulationController.searchAll(mockReq({ query: { q: 'x' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getCAUCatalog / getBOECatalog', () => {
  test('CAU devuelve el catalogo con descripcion', async () => {
    const res = mockRes();
    await regulationController.getCAUCatalog(mockReq(), res);
    expect(res.body.success).toBe(true);
    expect(res.body.data.catalog).toEqual([{ id: 'CAU-952-2013' }]);
    expect(res.body.data.description).toMatch(/CAU/);
  });

  test('CAU 500 si el service lanza', async () => {
    regulationService.getCAUCatalog.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await regulationController.getCAUCatalog(mockReq(), res);
    expect(res.statusCode).toBe(500);
  });

  test('BOE devuelve el catalogo', async () => {
    const res = mockRes();
    await regulationController.getBOECatalog(mockReq(), res);
    expect(res.body.data.catalog).toEqual([{ id: 'BOE-CAT-1' }]);
  });

  test('BOE 500 si el service lanza', async () => {
    regulationService.getBOECatalog.mockImplementation(() => { throw new Error('x'); });
    const res = mockRes();
    await regulationController.getBOECatalog(mockReq(), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('getDocument', () => {
  test('400 si falta source o id', async () => {
    const res = mockRes();
    await regulationController.getDocument(mockReq({ query: { source: 'BOE' } }), res);
    expect(res.statusCode).toBe(400);
  });

  test('devuelve el contenido del documento', async () => {
    const res = mockRes();
    await regulationController.getDocument(mockReq({ query: { source: 'BOE', id: 'BOE-A-2023-1' } }), res);
    expect(regulationService.getDocumentContent).toHaveBeenCalledWith('BOE', 'BOE-A-2023-1');
    expect(res.body.data.content).toBe('texto del documento');
  });

  test('500 al fallar', async () => {
    regulationService.getDocumentContent.mockRejectedValue(new Error('no existe'));
    const res = mockRes();
    await regulationController.getDocument(mockReq({ query: { source: 'BOE', id: 'x' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('searchArticle', () => {
  test('400 si falta celex o article', async () => {
    const res = mockRes();
    await regulationController.searchArticle(mockReq({ query: { celex: '32013R0952' } }), res);
    expect(res.statusCode).toBe(400);
  });

  test('devuelve el articulo encontrado', async () => {
    const res = mockRes();
    await regulationController.searchArticle(mockReq({ query: { celex: '32013R0952', article: '5' } }), res);
    expect(regulationService.searchArticle).toHaveBeenCalledWith('32013R0952', '5');
    expect(res.body.data.found).toBe(true);
  });

  test('500 al fallar', async () => {
    regulationService.searchArticle.mockRejectedValue(new Error('boom'));
    const res = mockRes();
    await regulationController.searchArticle(mockReq({ query: { celex: 'a', article: 'b' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('analyzeRegulation', () => {
  test('400 si falta documentId o question', async () => {
    const res = mockRes();
    await regulationController.analyzeRegulation(mockReq({ body: { question: 'q' } }), res);
    expect(res.statusCode).toBe(400);
  });

  test('usa content del body sin pedir el documento', async () => {
    const res = mockRes();
    await regulationController.analyzeRegulation(mockReq({
      body: { documentId: 'D1', question: '¿que dice?', content: 'contenido dado', context: 'ctx' }
    }), res);
    expect(regulationService.getDocumentContent).not.toHaveBeenCalled();
    expect(aiService.analyzeRegulation).toHaveBeenCalled();
    expect(res.body.data.analysis).toBe('analisis');
    expect(res.body.data.confidence).toBe(0.9);
    expect(res.body.data.tokensUsed).toBe(123);
  });

  test('descarga el documento cuando no hay content y se da source', async () => {
    const res = mockRes();
    await regulationController.analyzeRegulation(mockReq({
      body: { documentId: 'D2', question: 'q', source: 'BOE' }
    }), res);
    expect(regulationService.getDocumentContent).toHaveBeenCalledWith('BOE', 'D2');
    // El prompt construido debe incluir el contenido descargado.
    const prompt = aiService.analyzeRegulation.mock.calls[0][0];
    expect(prompt).toContain('texto del documento');
  });

  test('sigue adelante aunque falle la descarga del documento (solo contexto)', async () => {
    regulationService.getDocumentContent.mockRejectedValue(new Error('404'));
    const res = mockRes();
    await regulationController.analyzeRegulation(mockReq({
      body: { documentId: 'D3', question: 'q', source: 'BOE', context: 'algo de contexto' }
    }), res);
    expect(res.body.success).toBe(true);
    const prompt = aiService.analyzeRegulation.mock.calls[0][0];
    expect(prompt).toContain('algo de contexto');
  });

  test('trunca el contenido largo en el prompt', async () => {
    const largo = 'A'.repeat(9000);
    const res = mockRes();
    await regulationController.analyzeRegulation(mockReq({
      body: { documentId: 'D4', question: 'q', content: largo }
    }), res);
    const prompt = aiService.analyzeRegulation.mock.calls[0][0];
    expect(prompt).toContain('[contenido truncado]');
  });

  test('500 si aiService lanza', async () => {
    aiService.analyzeRegulation.mockRejectedValue(new Error('bedrock down'));
    const res = mockRes();
    await regulationController.analyzeRegulation(mockReq({
      body: { documentId: 'D5', question: 'q', content: 'x' }
    }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('analyzeClassification', () => {
  test('400 si falta descripcion del producto', async () => {
    const res = mockRes();
    await regulationController.analyzeClassification(mockReq({ body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  test('construye el prompt con codigo propuesto y normativa de referencia', async () => {
    const res = mockRes();
    await regulationController.analyzeClassification(mockReq({
      body: {
        productDescription: 'Zapatos de cuero',
        proposedCode: '6403990000',
        regulations: [{ title: 'Reglamento X' }, { id: 'CELEX-Y' }],
        context: 'importacion China'
      }
    }), res);
    const prompt = aiService.analyzeRegulation.mock.calls[0][0];
    expect(prompt).toContain('Zapatos de cuero');
    expect(prompt).toContain('6403990000');
    expect(prompt).toContain('Reglamento X');
    expect(prompt).toContain('CELEX-Y');
    expect(prompt).toContain('importacion China');
    expect(res.body.data.proposedCode).toBe('6403990000');
  });

  test('500 si aiService lanza', async () => {
    aiService.analyzeRegulation.mockRejectedValue(new Error('down'));
    const res = mockRes();
    await regulationController.analyzeClassification(mockReq({ body: { productDescription: 'x' } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('queryRegulations', () => {
  test('400 sin pregunta', async () => {
    const res = mockRes();
    await regulationController.queryRegulations(mockReq({ body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  test('pregunta a LUCI y mapea la respuesta', async () => {
    const res = mockRes();
    await regulationController.queryRegulations(mockReq({ body: { question: '¿Que es el CAU?' } }), res);
    expect(aiService.askLuci).toHaveBeenCalled();
    const prompt = aiService.askLuci.mock.calls[0][0];
    expect(prompt).toContain('¿Que es el CAU?');
    expect(res.body.data.answer).toBe('respuesta');
    expect(res.body.data.confidence).toBe(0.8);
  });

  test('500 si askLuci lanza', async () => {
    aiService.askLuci.mockRejectedValue(new Error('down'));
    const res = mockRes();
    await regulationController.queryRegulations(mockReq({ body: { question: 'x' } }), res);
    expect(res.statusCode).toBe(500);
  });
});
