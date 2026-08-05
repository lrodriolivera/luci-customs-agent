/**
 * regulationService — busqueda de normativa aduanera en BOE (legislacion
 * consolidada) y EUR-Lex (CELLAR/CELEX). Es logica de negocio de consulta legal:
 * los agentes fundamentan requerimientos y recursos citando estas normas, asi
 * que el parseo de respuestas, el filtrado por query, los fallbacks a catalogo
 * curado y la extraccion de articulos tienen que comportarse de forma predecible.
 *
 * UNICA frontera mockeada: axios (red HTTP a boe.es / eur-lex.europa.eu). Nunca
 * se llama a las APIs reales. Todo el parsing/filtrado/catalogo se ejecuta REAL
 * sobre el singleton exportado. No se mockea el codigo bajo prueba.
 */

jest.mock('axios');
jest.mock('../../src/config/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

const axios = require('axios');
const regulationService = require('../../src/services/regulationService');

beforeEach(() => {
  axios.get.mockReset();
  // El servicio es un singleton con cache viva entre tests: vaciarla para aislar.
  regulationService.cache.clear();
});

describe('parseBOEResponse', () => {
  test('devuelve [] cuando no hay data', () => {
    expect(regulationService.parseBOEResponse(null, 10)).toEqual([]);
    expect(regulationService.parseBOEResponse({}, 10)).toEqual([]);
  });

  test('mapea un item y formatea la fecha YYYYMMDD -> YYYY-MM-DD', () => {
    const data = { data: [{
      identificador: 'BOE-A-2003-23186',
      titulo: 'Ley General Tributaria',
      rango: { texto: 'Ley' },
      fecha_publicacion: '20031218',
      departamento: { texto: 'Jefatura del Estado' },
      numero_oficial: '58/2003',
      ambito: { texto: 'Estatal' },
      url_html_consolidada: 'https://www.boe.es/x',
      url_eli: 'https://www.boe.es/eli/x',
      vigencia_agotada: 'N'
    }] };
    const [r] = regulationService.parseBOEResponse(data, 10);
    expect(r.id).toBe('BOE-A-2003-23186');
    expect(r.date).toBe('2003-12-18');
    expect(r.type).toBe('Ley');
    expect(r.vigente).toBe(true);
    expect(r.pdfUrl).toBe('https://www.boe.es/eli/x/pdf');
    expect(r.source).toBe('BOE');
  });

  test('acepta data como objeto unico (no array) y aplica defaults', () => {
    const data = { data: { identificador: 'BOE-A-X', titulo: 'T', vigencia_agotada: 'S' } };
    const [r] = regulationService.parseBOEResponse(data, 10);
    expect(r.type).toBe('Disposición');   // default cuando falta rango
    expect(r.vigente).toBe(false);         // vigencia_agotada !== 'N'
    expect(r.pdfUrl).toBeNull();           // sin url_eli
    expect(r.url).toContain('BOE-A-X');    // fallback de url usa el identificador
  });

  test('respeta el limite', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ identificador: 'B' + i, titulo: 't' }));
    expect(regulationService.parseBOEResponse({ data: items }, 2)).toHaveLength(2);
  });

  test('fecha con longitud distinta de 8 se deja tal cual', () => {
    const [r] = regulationService.parseBOEResponse({ data: [{ identificador: 'X', fecha_publicacion: '2003' }] }, 10);
    expect(r.date).toBe('2003');
  });
});

describe('searchBOE', () => {
  test('llamada con exito parsea y filtra por query', async () => {
    axios.get.mockResolvedValue({ data: { data: [
      { identificador: 'A', titulo: 'Ley del IVA', rango: { texto: 'Ley' } },
      { identificador: 'B', titulo: 'Reglamento de garantías', rango: { texto: 'RD' } }
    ] } });

    const res = await regulationService.searchBOE({ query: 'iva' });
    expect(res.fromAPI).toBe(true);
    expect(res.totalResults).toBe(1);
    expect(res.results[0].title).toMatch(/IVA/);
  });

  test('propaga filtros de fecha en la URL (from/to sin guiones)', async () => {
    axios.get.mockResolvedValue({ data: { data: [] } });
    await regulationService.searchBOE({ dateFrom: '2023-01-01', dateTo: '2023-12-31', limit: 10 });
    const url = axios.get.mock.calls[0][0];
    expect(url).toContain('from=20230101');
    expect(url).toContain('to=20231231');
    expect(url).toContain('limit=10');
  });

  test('sin query no filtra y devuelve todos', async () => {
    axios.get.mockResolvedValue({ data: { data: [
      { identificador: 'A', titulo: 'Uno' }, { identificador: 'B', titulo: 'Dos' }
    ] } });
    const res = await regulationService.searchBOE({});
    expect(res.totalResults).toBe(2);
  });

  test('ante error de red cae al catalogo curado', async () => {
    axios.get.mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await regulationService.searchBOE({ query: 'IVA' });
    expect(res.curated).toBe(true);
    // "IVA" aparece en el summary del curado (el titulo dice "Valor Añadido").
    expect(res.results.some(r => /IVA/.test(r.summary))).toBe(true);
  });
});

describe('getCuratedBOEResults', () => {
  test('sin query devuelve todos los curados', () => {
    const res = regulationService.getCuratedBOEResults();
    expect(res.curated).toBe(true);
    expect(res.results.length).toBeGreaterThanOrEqual(5);
  });

  test('con query filtra por titulo/summary/departamento', () => {
    const res = regulationService.getCuratedBOEResults('despacho');
    expect(res.results.every(r =>
      /despacho/i.test(r.title) || /despacho/i.test(r.summary) || /despacho/i.test(r.department)
    )).toBe(true);
    expect(res.results.length).toBeGreaterThanOrEqual(1);
  });
});

describe('searchCAUCatalog', () => {
  test('encuentra por shortName', () => {
    const res = regulationService.searchCAUCatalog('CAU');
    expect(res.length).toBeGreaterThanOrEqual(1);
    expect(res[0].source).toBe('EUR-Lex');
  });

  test('encuentra por numero CELEX', () => {
    const res = regulationService.searchCAUCatalog('32013R0952');
    expect(res.some(r => r.celex === '32013R0952')).toBe(true);
  });

  test('query vacia (undefined) matchea todo el catalogo (includes de cadena vacia)', () => {
    const res = regulationService.searchCAUCatalog(undefined);
    expect(res.length).toBeGreaterThan(1);
  });
});

describe('searchEURLex', () => {
  test('devuelve del catalogo sin tocar la red si hay match', async () => {
    const res = await regulationService.searchEURLex({ query: 'TARIC' });
    expect(res.fromCatalog).toBe(true);
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('sin match en catalogo llama a EUR-Lex y parsea el HTML', async () => {
    axios.get.mockResolvedValue({ data: 'blah CELEX:32099R9999 blah CELEX:32088R8888' });
    const res = await regulationService.searchEURLex({ query: 'terminoquenoexisteenelcatalogo' });
    expect(axios.get).toHaveBeenCalled();
    expect(res.results.length).toBeGreaterThanOrEqual(1);
    expect(res.results[0].celex).toMatch(/^320/);
  });

  test('ante error de red cae al mock/catalogo', async () => {
    axios.get.mockRejectedValue(new Error('timeout'));
    const res = await regulationService.searchEURLex({ query: 'terminoquenoexiste' });
    expect(res.isMock || res.fromCatalog).toBeTruthy();
    expect(res.results.length).toBeGreaterThanOrEqual(1);
  });
});

describe('buildEURLexSearchUrl', () => {
  test('incluye lang, text y qid; anade type/year si vienen', () => {
    const url = regulationService.buildEURLexSearchUrl('valor', 'regulation', '2015');
    expect(url).toContain('lang=es');
    expect(url).toContain('text=valor');
    expect(url).toContain('type=regulation');
    expect(url).toContain('DD_YEAR=2015');
  });

  test('sin type/year no los incluye y admite query nula', () => {
    const url = regulationService.buildEURLexSearchUrl(null);
    expect(url).not.toContain('type=');
    expect(url).not.toContain('DD_YEAR=');
  });
});

describe('parseEURLexHTML', () => {
  test('extrae CELEX del HTML respetando el limite', () => {
    const html = 'x CELEX:32013R0952 y CELEX: 32015R2446 z';
    const res = regulationService.parseEURLexHTML(html, 1);
    expect(res).toHaveLength(1);
    expect(res[0].celex).toBe('32013R0952');
  });

  test('HTML sin CELEX devuelve []', () => {
    expect(regulationService.parseEURLexHTML('nada aqui', 10)).toEqual([]);
  });
});

describe('extractTextFromHTML', () => {
  test('elimina scripts/estilos/etiquetas y decodifica entidades', () => {
    const html = '<style>.a{}</style><script>var x=1;</script><p>Hola&nbsp;&amp;&lt;mundo&gt;</p>';
    const text = regulationService.extractTextFromHTML(html);
    // &lt;/&gt; se decodifican a </> DESPUES de quitar las etiquetas, asi que el
    // resultado final si contiene '<mundo>' como texto plano. Lo relevante: no
    // queda ninguna etiqueta HTML real ni el contenido de script/style.
    // &nbsp;->espacio y luego colapso de espacios; &amp;->&, &lt;/&gt;-></>.
    expect(text).toContain('Hola &<mundo>');
    expect(text).not.toContain('var x');
    expect(text).not.toContain('.a{}');
  });
});

describe('getDocumentContent (con cache)', () => {
  test('fuente BOE obtiene y cachea el documento', async () => {
    axios.get.mockResolvedValue({ data: '<p>Contenido BOE</p>' });
    const doc = await regulationService.getDocumentContent('BOE', 'BOE-A-2003-23186');
    expect(doc.source).toBe('BOE');
    expect(doc.content).toContain('Contenido BOE');

    // Segunda llamada: viene de cache, no vuelve a la red
    axios.get.mockClear();
    const doc2 = await regulationService.getDocumentContent('BOE', 'BOE-A-2003-23186');
    expect(doc2.content).toContain('Contenido BOE');
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('fuente EUR-Lex obtiene el documento por CELEX', async () => {
    axios.get.mockResolvedValue({ data: '<div>Texto UE</div>' });
    const doc = await regulationService.getDocumentContent('EUR-Lex', '32013R0952');
    expect(doc.source).toBe('EUR-Lex');
    expect(doc.celex).toBe('32013R0952');
  });

  test('fuente no valida lanza error', async () => {
    await expect(
      regulationService.getDocumentContent('OTRA', 'x')
    ).rejects.toThrow(/Error obteniendo documento/i);
  });

  test('propaga error si la descarga falla', async () => {
    axios.get.mockRejectedValue(new Error('404'));
    await expect(
      regulationService.getDocumentContent('BOE', 'noexiste')
    ).rejects.toThrow(/Error obteniendo documento/i);
  });
});

describe('searchArticle', () => {
  test('encuentra el articulo y extrae un extracto', async () => {
    const contenido = 'Preambulo. Artículo 5. El valor en aduana se determina... resto del texto.';
    axios.get.mockResolvedValue({ data: `<p>${contenido}</p>` });
    const res = await regulationService.searchArticle('32015R2446', '5');
    expect(res.found).toBe(true);
    expect(res.excerpt.length).toBeGreaterThan(0);
    expect(res.article).toBe('5');
  });

  test('articulo inexistente devuelve found:false', async () => {
    axios.get.mockResolvedValue({ data: '<p>Sin articulos numerados aqui</p>' });
    const res = await regulationService.searchArticle('32015R2446', '999');
    expect(res.found).toBe(false);
    expect(res.excerpt).toBe('');
  });

  test('propaga error si getDocumentContent falla', async () => {
    axios.get.mockRejectedValue(new Error('down'));
    await expect(regulationService.searchArticle('32013R0952', '1')).rejects.toThrow();
  });
});

describe('catalogos y searchAll', () => {
  test('getCAUCatalog devuelve todas las entradas con url/pdfUrl', () => {
    const cat = regulationService.getCAUCatalog();
    expect(cat.length).toBeGreaterThanOrEqual(9);
    expect(cat[0].url).toContain('CELEX:');
    expect(cat[0].pdfUrl).toContain('PDF');
  });

  test('getBOECatalog devuelve entradas con source BOE', () => {
    const cat = regulationService.getBOECatalog();
    expect(cat.length).toBeGreaterThanOrEqual(10);
    expect(cat.every(r => r.source === 'BOE')).toBe(true);
    expect(cat[0].url).toContain('boe.es');
  });

  test('getMockEURLexResults usa catalogo si hay match, si no el fallback fijo', () => {
    const conCatalogo = regulationService.getMockEURLexResults('CAU');
    expect(conCatalogo.fromCatalog).toBe(true);

    const sinCatalogo = regulationService.getMockEURLexResults('xyz-no-existe');
    expect(sinCatalogo.isMock).toBe(true);
    expect(sinCatalogo.results.length).toBe(3);
  });

  test('searchAll combina BOE + EUR-Lex y suma totales', async () => {
    // searchBOE hara una llamada de red; searchEURLex('CAU') tira de catalogo.
    axios.get.mockResolvedValue({ data: { data: [{ identificador: 'A', titulo: 'CAU en BOE' }] } });
    const res = await regulationService.searchAll('CAU');
    expect(res.query).toBe('CAU');
    expect(res.boe).toBeDefined();
    expect(res.eurlex).toBeDefined();
    expect(res.totalResults).toBeGreaterThanOrEqual(1);
  });

  test('searchAll tolera que una fuente falle (allSettled)', async () => {
    // BOE cae a curado (no rechaza); EUR-Lex 'CAU' tira de catalogo. Ambas resuelven.
    axios.get.mockRejectedValue(new Error('boom'));
    const res = await regulationService.searchAll('CAU');
    expect(res.eurlex.results.length).toBeGreaterThanOrEqual(1);
  });
});
