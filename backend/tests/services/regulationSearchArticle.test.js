/**
 * searchArticle busca el numero de articulo literal, no como expresion regular.
 *
 * Hallazgo F2 del escaneo del 3/Nov/2026: req.query.article de
 * GET /api/regulations/article (sin autenticacion) entraba sin escapar en
 * new RegExp y se ejecutaba contra el texto completo del reglamento. Con
 * article=1|((.+)+)+QQQ el '|' saltaba el prefijo fijo y el cuantificador
 * anidado bloqueaba el event loop de cada worker (ReDoS).
 *
 * Aqui no se lanza la carga catastrofica (colgaria el test con el codigo
 * vulnerable); se comprueba que los metacaracteres se toman literalmente, que
 * es lo que la desactiva.
 */

jest.mock('../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const regulationService = require('../../src/services/regulationService');

const TEXTO = 'Preambulo. Artículo 5 Ambito de aplicacion del codigo. Art. 12 Definiciones. Fin.';

beforeEach(() => {
  jest.spyOn(regulationService, 'getDocumentContent').mockResolvedValue({ content: TEXTO });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('encuentra un articulo normal', async () => {
  const r = await regulationService.searchArticle('32013R0952', '5');
  expect(r.found).toBe(true);
  expect(r.excerpt).toContain('Artículo 5');
});

test('encuentra la forma abreviada Art.', async () => {
  const r = await regulationService.searchArticle('32013R0952', '12');
  expect(r.found).toBe(true);
});

test.each([
  ['1|.'],
  ['.*'],
  ['9|Ambito'],
  ['(5)']
])('el termino %s se busca literal: no casa con nada del texto', async (articulo) => {
  const r = await regulationService.searchArticle('32013R0952', articulo);
  expect(r.found).toBe(false);
});

test('un patron con cuantificadores anidados se resuelve al momento', async () => {
  const largo = { content: 'Artículo ' + 'a'.repeat(5000) + '!' };
  regulationService.getDocumentContent.mockResolvedValue(largo);
  const inicio = Date.now();
  const r = await regulationService.searchArticle('32013R0952', '(a+)+$');
  expect(r.found).toBe(false);
  expect(Date.now() - inicio).toBeLessThan(500);
});
