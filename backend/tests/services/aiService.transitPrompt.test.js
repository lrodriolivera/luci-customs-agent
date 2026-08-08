/**
 * Los prompts de transito interpolaban `undefined` como si fuera un dato.
 *
 * E2E 8/Ago/2026, sobre 5 transitos vivos de https://aduanas.strixai.es: 4
 * generaban lineas como
 *
 *   - Aduana destino: ES002901 (undefined)
 *     1. Origen: undefined | TARIC: 73041100
 *
 * porque `${transit.destinationOffice?.country}` y `${g.countryOfOrigin}` se
 * interpolan sin `||`. El modelo no distingue "no me lo han dicho" de un valor
 * literal `undefined`, y el pais de la aduana es determinante justo en lo que se
 * le pide: validar que la ruta cruce fronteras coherentes y elegir las aduanas
 * de transito. Con `(undefined)` el analisis se hace a ciegas y devuelve un
 * veredicto con la misma seguridad que si tuviera el dato.
 *
 * Doble arreglo: el pais se deduce del prefijo ISO del codigo de aduana
 * (`ES002901` -> `ES`), que es como se construyen los codigos NCTS, y cuando no
 * se puede deducir se escribe la convencion del resto del fichero,
 * 'No especificado'.
 */

const aiService = require('../../src/services/aiService');

const RESPUESTA_RUTA = JSON.stringify({
  routeValidation: { isValid: true, issues: [] },
  routeAnalysis: {},
  recommendations: [],
  riskLevel: 'LOW'
});

// Transito real (LRNMSKMVXJ94Y2831 / MRN 26ES002801501096J6) tal como lo devuelve
// la API: sin `country` en ninguna aduana y sin `countryOfOrigin` en la partida.
const TRANSITO_SIN_PAISES = {
  transitType: 'T1',
  departureOffice: { code: 'ES002801' },
  destinationOffice: { code: 'ES002901' },
  transitOffices: [],
  route: {},
  transport: { mode: '3' },
  goodsItems: [{
    description: 'Tuberias de linea de acero',
    taricCode: '73041100',
    grossWeight: 450.5
  }],
  totals: { grossWeight: 450.5 }
};

describe('prompts de transito: nunca interpolar "undefined" como dato', () => {
  let spy;

  beforeEach(() => {
    spy = jest.spyOn(aiService, 'callClaude').mockResolvedValue({
      content: RESPUESTA_RUTA,
      tokensUsed: 100
    });
  });

  afterEach(() => jest.restoreAllMocks());

  // callClaude(model, systemPrompt, userMessage, options): el prompt con los
  // datos del transito es el tercer argumento, no el system.
  const promptDe = () => spy.mock.calls[0][2];

  test('validateTransitRoute no envia "undefined" en el prompt', async () => {
    await aiService.validateTransitRoute(TRANSITO_SIN_PAISES);
    expect(promptDe()).not.toMatch(/undefined/);
  });

  test('el pais de la aduana se deduce del prefijo ISO del codigo', async () => {
    await aiService.validateTransitRoute(TRANSITO_SIN_PAISES);
    const prompt = promptDe();
    // ES002801 y ES002901 son ambas espanyolas: transito nacional, sin fronteras.
    expect(prompt).toMatch(/Aduana partida: ES002801 \(ES\)/);
    expect(prompt).toMatch(/Aduana destino: ES002901 \(ES\)/);
  });

  test('el pais declarado prevalece sobre el deducido', async () => {
    await aiService.validateTransitRoute({
      ...TRANSITO_SIN_PAISES,
      destinationOffice: { code: 'DE005030', country: 'DE' }
    });
    expect(promptDe()).toMatch(/Aduana destino: DE005030 \(DE\)/);
  });

  test('un codigo de aduana del que no se puede deducir el pais se marca como no especificado', async () => {
    await aiService.validateTransitRoute({
      ...TRANSITO_SIN_PAISES,
      destinationOffice: { code: '12345' }
    });
    const prompt = promptDe();
    expect(prompt).toMatch(/Aduana destino: 12345 \(No especificado\)/);
    expect(prompt).not.toMatch(/undefined/);
  });

  test('sin aduana de destino no se inventa ni codigo ni pais', async () => {
    await aiService.validateTransitRoute({ ...TRANSITO_SIN_PAISES, destinationOffice: undefined });
    const prompt = promptDe();
    expect(prompt).toMatch(/Aduana destino: No especificado/);
    expect(prompt).not.toMatch(/undefined/);
  });

  test('el origen ausente de una partida se marca como no especificado', async () => {
    await aiService.validateTransitRoute(TRANSITO_SIN_PAISES);
    const prompt = promptDe();
    expect(prompt).toMatch(/Origen: No especificado/);
    expect(prompt).not.toMatch(/Origen: undefined/);
  });

  test('el peso ausente de una partida no llega como "undefined kg"', async () => {
    await aiService.validateTransitRoute({
      ...TRANSITO_SIN_PAISES,
      goodsItems: [{ description: 'Sin peso', taricCode: '73041100' }]
    });
    expect(promptDe()).not.toMatch(/undefined/);
  });

  test('predictTransitIncidents tampoco interpola undefined', async () => {
    spy.mockResolvedValue({
      content: JSON.stringify({ riskLevel: 'LOW', incidentPredictions: [], recommendations: [] }),
      tokensUsed: 100
    });
    await aiService.predictTransitIncidents(TRANSITO_SIN_PAISES);
    expect(promptDe()).not.toMatch(/undefined/);
  });

  test('suggestTransitGuarantee tampoco interpola undefined', async () => {
    spy.mockResolvedValue({
      content: JSON.stringify({ recommendedType: {}, calculatedAmount: {}, alternatives: [] }),
      tokensUsed: 100
    });
    await aiService.suggestTransitGuarantee(TRANSITO_SIN_PAISES);
    expect(promptDe()).not.toMatch(/undefined/);
  });
});
