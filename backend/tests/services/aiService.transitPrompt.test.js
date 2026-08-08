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

/**
 * Un fallo del analisis no es un veredicto aduanero.
 *
 * E2E 8/Ago/2026: repitiendo `POST /api/transit/:id/ai/validate-route` sobre el
 * mismo transito, 1 de cada 4 llamadas devolvia
 *
 *   routeValidation: { isValid: false, issues: [{type:'error', description:'Error en validación IA'}] }
 *
 * El JSON del modelo se corta a mitad de frase (`rawResponse` de 2.124 chars
 * terminando en `"recommendation": "Evaluar f`), `JSON.parse` revienta y el
 * catch fabrica `isValid: false`. Para el frontend `isValid: false` significa
 * exactamente una cosa: la ruta declarada NO es valida. Es decir, un fallo
 * tecnico intermitente se presentaba como que la aduana rechazaria la ruta, y
 * al reintentar la "ruta invalida" pasaba a valida sin cambiar ni un dato.
 *
 * La causa del corte es `maxTokens: 4096`: el analisis de ruta legitimamente
 * gasta ~5.300 tokens (medido: `tokensUsed: 5338` en las respuestas completas).
 *
 * Dos arreglos independientes:
 *  - Presupuesto suficiente, para que no se corte.
 *  - Y cuando aun asi falle, decir que fallo (`isValid: null` + `analysisFailed`)
 *    en vez de emitir un veredicto que nadie ha calculado.
 */
describe('fallos del analisis de transito: no se disfrazan de veredicto', () => {
  let spy;

  // Respuesta cortada por presupuesto, tal como la devolvio Bedrock en vivo.
  const RESPUESTA_TRUNCADA = {
    content: '{\n  "routeValidation": {\n    "isValid": false,\n    "issues": [\n      {\n        "type": "error",\n        "recommendation": "Evaluar f',
    tokensUsed: 4096,
    stopReason: 'max_tokens'
  };

  beforeEach(() => {
    spy = jest.spyOn(aiService, 'callClaude');
  });

  afterEach(() => jest.restoreAllMocks());

  test('validateTransitRoute pide presupuesto suficiente para el JSON que exige', async () => {
    spy.mockResolvedValue({ content: RESPUESTA_RUTA, tokensUsed: 5338, stopReason: 'end_turn' });
    await aiService.validateTransitRoute(TRANSITO_SIN_PAISES);
    // Medido en vivo: una validacion completa gasta ~5.338 tokens.
    expect(spy.mock.calls[0][3]?.maxTokens).toBeGreaterThanOrEqual(8192);
  });

  test('una respuesta truncada NO se convierte en "ruta no valida"', async () => {
    spy.mockResolvedValue(RESPUESTA_TRUNCADA);
    const r = await aiService.validateTransitRoute(TRANSITO_SIN_PAISES);
    expect(r.routeValidation.isValid).not.toBe(false);
    expect(r.routeValidation.isValid).toBeNull();
  });

  test('el fallo se marca explicitamente y se dice que la respuesta se corto', async () => {
    spy.mockResolvedValue(RESPUESTA_TRUNCADA);
    const r = await aiService.validateTransitRoute(TRANSITO_SIN_PAISES);
    expect(r.analysisFailed).toBe(true);
    expect(r.truncated).toBe(true);
    expect(r.routeValidation.issues[0].description).toMatch(/no se pudo|incompleta|cort/i);
  });

  test('un JSON ilegible por otra razon se marca como fallo pero no como truncado', async () => {
    spy.mockResolvedValue({ content: 'lo siento, no puedo', tokensUsed: 80, stopReason: 'end_turn' });
    const r = await aiService.validateTransitRoute(TRANSITO_SIN_PAISES);
    expect(r.analysisFailed).toBe(true);
    expect(r.truncated).toBe(false);
    expect(r.routeValidation.isValid).toBeNull();
  });

  test('una validacion correcta no lleva la marca de fallo', async () => {
    spy.mockResolvedValue({ content: RESPUESTA_RUTA, tokensUsed: 5338, stopReason: 'end_turn' });
    const r = await aiService.validateTransitRoute(TRANSITO_SIN_PAISES);
    expect(r.analysisFailed).toBeUndefined();
    expect(r.routeValidation.isValid).toBe(true);
  });

  test('predictTransitIncidents no inventa un riesgo cuando el analisis falla', async () => {
    spy.mockResolvedValue(RESPUESTA_TRUNCADA);
    const r = await aiService.predictTransitIncidents(TRANSITO_SIN_PAISES);
    expect(r.analysisFailed).toBe(true);
    // `overallRiskScore: 50` era una puntuacion inventada: ni calculada ni
    // declarada como desconocida. Un 50 sobre 100 se lee como riesgo medio.
    expect(r.overallRiskScore).toBeNull();
    expect(r.riskLevel).toBe('UNKNOWN');
  });

  test('suggestTransitGuarantee tambien pide presupuesto suficiente', async () => {
    spy.mockResolvedValue({
      content: JSON.stringify({ recommendedType: {}, calculatedAmount: {}, alternatives: [] }),
      tokensUsed: 100,
      stopReason: 'end_turn'
    });
    await aiService.suggestTransitGuarantee(TRANSITO_SIN_PAISES);
    expect(spy.mock.calls[0][3]?.maxTokens).toBeGreaterThanOrEqual(8192);
  });

  test('suggestTransitGuarantee no propone una garantia que no ha calculado', async () => {
    spy.mockResolvedValue(RESPUESTA_TRUNCADA);
    const r = await aiService.suggestTransitGuarantee(TRANSITO_SIN_PAISES);
    expect(r.analysisFailed).toBe(true);
    // `finalAmount: 0` es un importe: una garantia de 0 EUR se lee como "no
    // hace falta garantia", que es la conclusion mas cara de equivocarse en un
    // transito. Y el tipo '1' "por defecto" no lo habia elegido nadie.
    expect(r.calculatedAmount?.finalAmount).toBeNull();
    expect(r.recommendedType?.code).toBeNull();
  });
});

/**
 * `fullTransitAnalysis` compone los tres analisis en un `readinessScore` con
 * etiqueta "READY / Listo para presentar". Si alguno de los tres ha fallado, el
 * score se calcula sobre datos que no existen y la etiqueta afirma algo que
 * nadie ha comprobado.
 */
describe('fullTransitAnalysis: el score no se calcula sobre analisis fallidos', () => {
  let spy;

  const OK_RUTA = JSON.stringify({ routeValidation: { isValid: true, issues: [] }, routeAnalysis: { estimatedTransitDays: 4 }, recommendations: [], riskLevel: 'LOW' });
  const OK_INCIDENCIAS = JSON.stringify({ overallRiskScore: 20, riskLevel: 'LOW', incidentPredictions: [], recommendations: [] });
  const OK_GARANTIA = JSON.stringify({ calculatedAmount: { finalAmount: 5000 }, recommendedType: { code: '1' }, alternatives: [] });

  const TRUNCADA = { content: '{"routeValidation": {"isValid', tokensUsed: 4096, stopReason: 'max_tokens' };

  const TRANSITO = {
    ...TRANSITO_SIN_PAISES,
    principal: { eori: 'ESB22477020', name: 'STRIX AI' },
    guarantee: { grn: '26ES0000010000001A1' },
    transitOffices: [{ code: 'FR001101' }],
    documents: [{ type: 'N337' }]
  };

  beforeEach(() => { spy = jest.spyOn(aiService, 'callClaude'); });
  afterEach(() => jest.restoreAllMocks());

  test('un analisis fallido no regala puntos de "bajo riesgo"', async () => {
    // Las tres llamadas van en Promise.all: ruta OK, incidencias truncada.
    spy.mockImplementation((model, sys, prompt) => Promise.resolve(
      /riesgos de tránsitos NCTS/.test(prompt) ? TRUNCADA
        : { content: /garantías de tránsito/.test(prompt) ? OK_GARANTIA : OK_RUTA, tokensUsed: 100, stopReason: 'end_turn' }
    ));
    const r = await aiService.fullTransitAnalysis(TRANSITO, {});
    // `overallRiskScore` es null cuando el analisis falla, y `null < 40` es
    // true en JS: sin guarda, un fallo sumaba los 15 puntos de "Bajo riesgo".
    expect(r.summary.factors).not.toContain('Bajo riesgo de incidencias');
  });

  test('el resumen avisa de que parte del analisis no se completo', async () => {
    spy.mockImplementation((model, sys, prompt) => Promise.resolve(
      /riesgos de tránsitos NCTS/.test(prompt) ? TRUNCADA
        : { content: /garantías de tránsito/.test(prompt) ? OK_GARANTIA : OK_RUTA, tokensUsed: 100, stopReason: 'end_turn' }
    ));
    const r = await aiService.fullTransitAnalysis(TRANSITO, {});
    expect(r.summary.incompleteAnalysis).toEqual(['incidentPrediction']);
  });

  test('con los tres analisis completos no se marca nada como incompleto', async () => {
    spy.mockImplementation((model, sys, prompt) => Promise.resolve({
      content: /riesgos de tránsitos NCTS/.test(prompt) ? OK_INCIDENCIAS
        : /garantías de tránsito/.test(prompt) ? OK_GARANTIA : OK_RUTA,
      tokensUsed: 100,
      stopReason: 'end_turn'
    }));
    const r = await aiService.fullTransitAnalysis(TRANSITO, {});
    expect(r.summary.incompleteAnalysis).toEqual([]);
    expect(r.summary.factors).toContain('Bajo riesgo de incidencias');
  });

  test('la garantia requerida no se reporta como 0 cuando no se ha calculado', async () => {
    spy.mockImplementation((model, sys, prompt) => Promise.resolve(
      /garantías de tránsito/.test(prompt) ? TRUNCADA
        : { content: /riesgos de tránsitos NCTS/.test(prompt) ? OK_INCIDENCIAS : OK_RUTA, tokensUsed: 100, stopReason: 'end_turn' }
    ));
    const r = await aiService.fullTransitAnalysis(TRANSITO, {});
    expect(r.summary.guaranteeRequired).toBeNull();
    expect(r.summary.incompleteAnalysis).toContain('guaranteeSuggestion');
  });
});
