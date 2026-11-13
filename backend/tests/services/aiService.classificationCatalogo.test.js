/**
 * aiService.classifyProduct — anclaje al catalogo TARIC
 *
 * Bug de UAT (10/Nov/2026): al pegar la descripcion oficial de una partida de
 * 10 digitos, LUCI acertaba la subpartida SA pero no la subdivision TARIC
 * (8544 42 10 00 en vez de 8544 42 90 10). El modelo elegia de memoria: no
 * recibia ningun codigo real del catalogo ni se comprobaba despues el suyo.
 */
const mongoose = require('mongoose');
const aiService = require('../../src/services/aiService');
const TaricCode = require('../../src/models/TaricCode');
const { getCache } = require('../../src/services/cacheService');

const respuestaIA = (codes) => ({
  content: JSON.stringify({ suggestions: codes.map(code => ({ code, confidence: 90, reasoning: 'x' })) }),
  model: 'global.anthropic.claude-opus-5',
  tokensUsed: 100,
  stopReason: 'end_turn'
});

const conLean = (valor) => ({ lean: () => Promise.resolve(valor) });
const conSortLimitLean = (valor) => ({ sort: () => ({ limit: () => conLean(valor) }) });

describe('aiService.classifyProduct — anclaje al catalogo TARIC', () => {
  let callSpy;
  let estadoOriginal;

  const fijarConexion = (readyState) => {
    Object.defineProperty(mongoose.connection, 'readyState', { get: () => readyState, configurable: true });
  };

  beforeAll(() => {
    estadoOriginal = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  });

  afterAll(() => {
    if (estadoOriginal) Object.defineProperty(mongoose.connection, 'readyState', estadoOriginal);
    else delete mongoose.connection.readyState;
  });

  beforeEach(async () => {
    const cache = getCache();
    if (cache.flushAll) await cache.flushAll();
    fijarConexion(1);
    callSpy = jest.spyOn(aiService, 'callClaude').mockResolvedValue(respuestaIA(['8544429010']));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('pasa al modelo los codigos reales del catalogo que coinciden con la descripcion', async () => {
    jest.spyOn(TaricCode, 'search').mockResolvedValue([
      { code: '8544429010', description: { es: 'Cable de transmision de datos' } },
      { code: '8544421000', description: { es: 'De los utilizados en telecomunicaciones' } }
    ]);
    jest.spyOn(TaricCode, 'findOne').mockReturnValue(conLean({ code: '8544429010', isLeaf: true, isActive: true }));

    await aiService.classifyProduct({ description: 'Cable de transmision de datos 600 Mbit/s' });

    const prompt = callSpy.mock.calls[0][2];
    expect(prompt).toContain('- 8544429010: Cable de transmision de datos');
    expect(prompt).toContain('- 8544421000: De los utilizados en telecomunicaciones');
    expect(prompt).toContain('No deduzcas los digitos 9 y 10 de memoria');
  });

  it('marca verified=true el codigo que existe en el catalogo y es declarable', async () => {
    jest.spyOn(TaricCode, 'search').mockResolvedValue([]);
    jest.spyOn(TaricCode, 'findOne').mockReturnValue(conLean({ code: '8544429010', isLeaf: true, isActive: true }));

    const r = await aiService.classifyProduct({ description: 'Cable verificado en catalogo' });

    expect(r[0]).toMatchObject({ code: '8544429010', verified: true });
    expect(r[0].alternatives).toBeUndefined();
  });

  it('marca verified=false y ofrece las hojas reales cuando el codigo no es declarable', async () => {
    callSpy.mockResolvedValue(respuestaIA(['8544429000']));
    jest.spyOn(TaricCode, 'search').mockResolvedValue([]);
    jest.spyOn(TaricCode, 'findOne').mockReturnValue(conLean({ code: '8544429000', isLeaf: false, isActive: true }));
    const find = jest.spyOn(TaricCode, 'find').mockReturnValue(conSortLimitLean([
      { code: '8544429010', description: { es: 'Cable de transmision de datos' } },
      { code: '8544429090', description: { es: 'Los demas' } }
    ]));

    const r = await aiService.classifyProduct({ description: 'Cable con codigo no declarable' });

    expect(r[0].verified).toBe(false);
    expect(r[0].alternatives).toEqual([
      { code: '8544429010', description: 'Cable de transmision de datos' },
      { code: '8544429090', description: 'Los demas' }
    ]);
    expect(find.mock.calls[0][0]).toMatchObject({ isLeaf: true, isActive: true });
    expect(String(find.mock.calls[0][0].code)).toBe('/^85444290/');
  });

  it('si no hay hojas a 8 digitos busca alternativas en la subpartida de 6', async () => {
    callSpy.mockResolvedValue(respuestaIA(['8544427700']));
    jest.spyOn(TaricCode, 'search').mockResolvedValue([]);
    jest.spyOn(TaricCode, 'findOne').mockReturnValue(conLean(null));
    const find = jest.spyOn(TaricCode, 'find')
      .mockReturnValueOnce(conSortLimitLean([]))
      .mockReturnValueOnce(conSortLimitLean([{ code: '8544421000', description: { es: 'Telecomunicaciones' } }]));

    const r = await aiService.classifyProduct({ description: 'Cable con codigo inexistente' });

    expect(r[0].verified).toBe(false);
    expect(r[0].alternatives).toEqual([{ code: '8544421000', description: 'Telecomunicaciones' }]);
    expect(String(find.mock.calls[1][0].code)).toBe('/^854442/');
  });

  it('un codigo que no tiene 10 digitos queda sin verificar y no consulta el catalogo', async () => {
    callSpy.mockResolvedValue(respuestaIA(['854442']));
    jest.spyOn(TaricCode, 'search').mockResolvedValue([]);
    const findOne = jest.spyOn(TaricCode, 'findOne');

    const r = await aiService.classifyProduct({ description: 'Cable con codigo corto' });

    expect(r[0]).toMatchObject({ verified: false, alternatives: [] });
    expect(findOne).not.toHaveBeenCalled();
  });

  it('sin conexion a la base de datos clasifica igual, sin candidatos y sin afirmar nada', async () => {
    fijarConexion(0);
    const search = jest.spyOn(TaricCode, 'search');
    const findOne = jest.spyOn(TaricCode, 'findOne');

    const r = await aiService.classifyProduct({ description: 'Cable sin base de datos' });

    expect(search).not.toHaveBeenCalled();
    expect(findOne).not.toHaveBeenCalled();
    expect(callSpy.mock.calls[0][2]).not.toContain('CODIGOS DEL CATALOGO');
    expect(r[0].code).toBe('8544429010');
    expect(r[0].verified).toBeUndefined();
  });

  it('si la busqueda en el catalogo falla, clasifica sin candidatos en vez de dar error', async () => {
    jest.spyOn(TaricCode, 'search').mockRejectedValue(new Error('text index required'));
    jest.spyOn(TaricCode, 'findOne').mockReturnValue(conLean({ code: '8544429010', isLeaf: true, isActive: true }));

    const r = await aiService.classifyProduct({ description: 'Cable con indice roto' });

    expect(callSpy.mock.calls[0][2]).not.toContain('CODIGOS DEL CATALOGO');
    expect(r[0].verified).toBe(true);
  });

  it('si la verificacion falla devuelve las sugerencias del modelo tal cual', async () => {
    jest.spyOn(TaricCode, 'search').mockResolvedValue([]);
    jest.spyOn(TaricCode, 'findOne').mockImplementation(() => { throw new Error('conexion perdida'); });

    const r = await aiService.classifyProduct({ description: 'Cable con verificacion rota' });

    expect(r[0].code).toBe('8544429010');
    expect(r[0].verified).toBeUndefined();
  });

  it('la clave de cache esta versionada para descartar las respuestas sin ancla', () => {
    expect(aiService._classificationCacheKey('Cable', {})).toMatch(/^taric_class_v3_[0-9a-f]{32}$/);
  });
});
