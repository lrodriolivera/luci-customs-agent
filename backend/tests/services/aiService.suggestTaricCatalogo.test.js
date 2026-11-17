/**
 * aiService.suggestTaricClassification — anclaje al catalogo TARIC
 *
 * Caso real de preproduccion (17/Nov/2026): en el boton «Sugerir TARIC» del
 * expediente, la IA propuso 8518300000 para «Auriculares inalambricos
 * Bluetooth 5.3 con estuche de carga» y se aplico. La linea tiene
 * subdivisiones (8518300010 / 8518300090): no es declarable.
 *
 * classifyProduct ya anclaba sus respuestas al catalogo (PR #54, #116), pero
 * este segundo camino no: el modelo no recibia candidatos reales y su codigo
 * no se comprobaba. La IA va simulada; nunca se llama a la real.
 */
const mongoose = require('mongoose');
const aiService = require('../../src/services/aiService');
const TaricCode = require('../../src/models/TaricCode');

const conLean = (valor) => ({ lean: () => Promise.resolve(valor) });
const conSortLimitLean = (valor) => ({ sort: () => ({ limit: () => conLean(valor) }) });

const CATALOGO = {
  '8518300000': { code: '8518300000', isLeaf: false, isActive: true },
  '8518300010': { code: '8518300010', isLeaf: true, isActive: true },
  '8518300090': { code: '8518300090', isLeaf: true, isActive: true }
};

const respuestaIA = (suggestions) => ({
  content: JSON.stringify({ items: [{ itemIndex: 0, description: 'Auriculares', suggestions }] }),
  model: 'simulado',
  tokensUsed: 100
});

const expediente = {
  operationType: 'import',
  goods: [{ description: 'Auriculares inalambricos Bluetooth 5.3 con estuche de carga', material: 'plastico' }]
};

describe('aiService.suggestTaricClassification — anclaje al catalogo', () => {
  let estadoOriginal;
  let callSpy;

  beforeAll(() => {
    estadoOriginal = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  });

  afterAll(() => {
    if (estadoOriginal) Object.defineProperty(mongoose.connection, 'readyState', estadoOriginal);
    else delete mongoose.connection.readyState;
  });

  beforeEach(() => {
    Object.defineProperty(mongoose.connection, 'readyState', { get: () => 1, configurable: true });
    jest.spyOn(TaricCode, 'search').mockResolvedValue([
      { code: '8518300090', description: { es: 'Los demás' }, legalDescription: 'Auriculares > Los demás' },
      { code: '8518300010', description: { es: 'Destinados a aeronaves civiles' } }
    ]);
    jest.spyOn(TaricCode, 'findOne').mockImplementation(({ code }) => conLean(CATALOGO[code] || null));
    jest.spyOn(TaricCode, 'find').mockReturnValue(conSortLimitLean([
      { code: '8518300010', description: { es: 'Destinados a aeronaves civiles' } },
      { code: '8518300090', description: { es: 'Los demás' } }
    ]));
    callSpy = jest.spyOn(aiService, 'callClaude');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('pasa al modelo los codigos reales del catalogo para cada mercancia', async () => {
    callSpy.mockResolvedValue(respuestaIA([{ taricCode: '8518300090', confidence: 90 }]));

    await aiService.suggestTaricClassification(expediente);

    const prompt = callSpy.mock.calls[0][2];
    expect(prompt).toContain('- 8518300090: Los demás');
    expect(prompt).toContain('Ruta: Auriculares > Los demás');
    expect(prompt).toContain('No deduzcas los digitos 9 y 10 de memoria');
    expect(TaricCode.search).toHaveBeenCalledWith(
      expect.stringContaining('Auriculares inalambricos Bluetooth'), expect.any(Number)
    );
  });

  it('caso real: 8518300000 queda marcado como no declarable, con sus subdivisiones, y no va primero', async () => {
    callSpy.mockResolvedValue(respuestaIA([
      { taricCode: '8518300000', confidence: 92, reasoning: 'auriculares' },
      { taricCode: '8518300090', confidence: 80, reasoning: 'los demas' }
    ]));

    const r = await aiService.suggestTaricClassification(expediente);

    const [primera, segunda] = r.items[0].suggestions;
    expect(primera).toMatchObject({ taricCode: '8518300090', verified: true });
    expect(segunda).toMatchObject({ taricCode: '8518300000', verified: false });
    expect(segunda.alternatives.map(a => a.code)).toEqual(['8518300010', '8518300090']);
  });

  it('si la unica sugerencia no es declarable se conserva marcada para que la agente elija', async () => {
    callSpy.mockResolvedValue(respuestaIA([{ taricCode: '8518300000', confidence: 92 }]));

    const r = await aiService.suggestTaricClassification(expediente);

    expect(r.items[0].suggestions).toHaveLength(1);
    expect(r.items[0].suggestions[0]).toMatchObject({ taricCode: '8518300000', verified: false });
  });
});
