/**
 * aiService.classifyProduct — ruta jerarquica de los candidatos (plan 3.4)
 *
 * Desde el PR #54 cada codigo del catalogo lleva en `legalDescription` su ruta
 * en la nomenclatura (capitulo > partida > subpartida > ...). Un candidato
 * «Los demás» no dice nada sin ella. El modelo recibe la ruta, razona por
 * niveles y solo debe devolver codigos declarables; lo que no lo es se marca
 * y queda detras de lo declarable.
 */
const mongoose = require('mongoose');
const aiService = require('../../src/services/aiService');
const TaricCode = require('../../src/models/TaricCode');
const { getCache } = require('../../src/services/cacheService');

const respuestaIA = (codes) => ({
  content: JSON.stringify({ suggestions: codes.map((code) => ({ code, confidence: 80, reasoning: 'x' })) }),
  model: 'global.anthropic.claude-opus-5',
  tokensUsed: 100,
  stopReason: 'end_turn'
});

const conLean = (valor) => ({ lean: () => Promise.resolve(valor) });
const conSortLimitLean = (valor) => ({ sort: () => ({ limit: () => conLean(valor) }) });

const CANDIDATOS = [
  {
    code: '8443321000',
    description: { es: 'Impresoras' },
    legalDescription: 'MÁQUINAS Y APARATOS PARA IMPRIMIR > Las demás máquinas impresoras > Que puedan conectarse a una máquina automática para tratamiento o procesamiento de datos > Impresoras'
  },
  {
    code: '8443399000',
    description: { es: 'Los demás' },
    legalDescription: 'MÁQUINAS Y APARATOS PARA IMPRIMIR > Las demás máquinas impresoras > Los demás > Los demás'
  }
];

describe('aiService.classifyProduct — ruta jerarquica y codigos declarables', () => {
  let callSpy;
  let estadoOriginal;

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
    Object.defineProperty(mongoose.connection, 'readyState', { get: () => 1, configurable: true });
    callSpy = jest.spyOn(aiService, 'callClaude').mockResolvedValue(respuestaIA(['8443321000']));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('el prompt lleva la ruta jerarquica de cada candidato', async () => {
    jest.spyOn(TaricCode, 'search').mockResolvedValue(CANDIDATOS);
    jest.spyOn(TaricCode, 'findOne').mockReturnValue(conLean({ code: '8443321000', isLeaf: true, isActive: true }));

    await aiService.classifyProduct({ description: 'Impresora multifuncion laser' });

    const prompt = callSpy.mock.calls[0][2];
    expect(prompt).toContain('- 8443321000: Impresoras');
    expect(prompt).toContain(`Ruta: ${CANDIDATOS[0].legalDescription}`);
    expect(prompt).toContain(`Ruta: ${CANDIDATOS[1].legalDescription}`);
  });

  it('un candidato sin ruta en el catalogo aparece sin linea de ruta', async () => {
    jest.spyOn(TaricCode, 'search').mockResolvedValue([{ code: '8443321000', description: { es: 'Impresoras' } }]);
    jest.spyOn(TaricCode, 'findOne').mockReturnValue(conLean({ code: '8443321000', isLeaf: true, isActive: true }));

    await aiService.classifyProduct({ description: 'Impresora sin ruta' });

    const prompt = callSpy.mock.calls[0][2];
    expect(prompt).toContain('- 8443321000: Impresoras');
    expect(prompt).not.toContain('Ruta: undefined');
  });

  it('pide razonar por niveles y devolver solo codigos declarables del catalogo', async () => {
    jest.spyOn(TaricCode, 'search').mockResolvedValue(CANDIDATOS);
    jest.spyOn(TaricCode, 'findOne').mockReturnValue(conLean({ code: '8443321000', isLeaf: true, isActive: true }));

    await aiService.classifyProduct({ description: 'Impresora por niveles' });

    const prompt = callSpy.mock.calls[0][2];
    expect(prompt).toContain('RAZONA POR NIVELES');
    expect(prompt).toMatch(/capitulo \(2 digitos\)/i);
    expect(prompt).toMatch(/partida \(4 digitos\)/i);
    expect(prompt).toMatch(/subpartida \(6 digitos\)/i);
    expect(prompt).toContain('declarable');
  });

  it('sin candidatos tambien pide razonar por niveles', async () => {
    jest.spyOn(TaricCode, 'search').mockResolvedValue([]);
    jest.spyOn(TaricCode, 'findOne').mockReturnValue(conLean({ code: '8443321000', isLeaf: true, isActive: true }));

    await aiService.classifyProduct({ description: 'Impresora sin candidatos' });

    expect(callSpy.mock.calls[0][2]).toContain('RAZONA POR NIVELES');
  });

  it('la busqueda de candidatos usa tambien el material y el uso', async () => {
    const search = jest.spyOn(TaricCode, 'search').mockResolvedValue([]);
    jest.spyOn(TaricCode, 'findOne').mockReturnValue(conLean({ code: '8443321000', isLeaf: true, isActive: true }));

    await aiService.classifyProduct({
      description: 'Bolso de mano',
      additionalInfo: { material: 'cuero bovino', use: 'complemento de vestir' }
    });

    const consulta = search.mock.calls[0][0];
    expect(consulta).toContain('Bolso de mano');
    expect(consulta).toContain('cuero bovino');
    expect(consulta).toContain('complemento de vestir');
  });

  it('marca si cada sugerencia esta entre los candidatos dados', async () => {
    callSpy.mockResolvedValue(respuestaIA(['8443321000', '8471600000']));
    jest.spyOn(TaricCode, 'search').mockResolvedValue(CANDIDATOS);
    jest.spyOn(TaricCode, 'findOne').mockReturnValue(conLean({ isLeaf: true, isActive: true }));

    const r = await aiService.classifyProduct({ description: 'Impresora con sugerencia ajena' });

    expect(r.find((s) => s.code === '8443321000').enCandidatos).toBe(true);
    expect(r.find((s) => s.code === '8471600000').enCandidatos).toBe(false);
  });

  it('sin candidatos no afirma nada sobre enCandidatos', async () => {
    jest.spyOn(TaricCode, 'search').mockResolvedValue([]);
    jest.spyOn(TaricCode, 'findOne').mockReturnValue(conLean({ code: '8443321000', isLeaf: true, isActive: true }));

    const r = await aiService.classifyProduct({ description: 'Impresora sin lista' });

    expect(r[0].enCandidatos).toBeUndefined();
  });

  it('un codigo no declarable o fuera del catalogo queda marcado y detras de los declarables', async () => {
    callSpy.mockResolvedValue(respuestaIA(['8443320000', '9999999999', '8443321000']));
    jest.spyOn(TaricCode, 'search').mockResolvedValue(CANDIDATOS);
    jest.spyOn(TaricCode, 'findOne').mockImplementation(({ code }) => conLean({
      8443320000: { code, isLeaf: false, isActive: true },
      8443321000: { code, isLeaf: true, isActive: true }
    }[code] || null));
    jest.spyOn(TaricCode, 'find').mockReturnValue(conSortLimitLean([]));

    const r = await aiService.classifyProduct({ description: 'Impresora con codigos malos' });

    expect(r.map((s) => [s.code, s.verified])).toEqual([
      ['8443321000', true],
      ['8443320000', false],
      ['9999999999', false]
    ]);
  });

  it('la clave de cache cambia de version: las respuestas del prompt anterior no se sirven', () => {
    expect(aiService._classificationCacheKey('Impresora', {})).toMatch(/^taric_class_v3_[0-9a-f]{32}$/);
  });
});
