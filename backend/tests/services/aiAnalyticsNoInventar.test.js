/**
 * Los prompts de analitica de LUCI piden no inventar cifras ausentes de los datos.
 */
const aiService = require('../../src/services/aiService');

describe('prompts de analitica de aiService', () => {
  let spy;
  beforeEach(() => {
    spy = jest.spyOn(aiService, 'callClaude').mockResolvedValue({ content: '{}', tokensUsed: 1 });
  });
  afterEach(() => spy.mockRestore());

  const casos = [
    ['generateAutomaticInsights', () => aiService.generateAutomaticInsights({ a: 1 }, {})],
    ['detectAnomaliesAI', () => aiService.detectAnomaliesAI({ a: 1 }, {})],
    ['predictTrendsAI', () => aiService.predictTrendsAI({ a: 1 }, 30)],
    ['generateExecutiveReport', () => aiService.generateExecutiveReport({ a: 1 }, {})],
    ['analyzeKPIDeviations', () => aiService.analyzeKPIDeviations({ a: 1 }, {})]
  ];

  test.each(casos)('%s indica no inventar cifras que no esten en los datos', async (_n, llamar) => {
    await llamar().catch(() => {});
    expect(spy).toHaveBeenCalled();
    const prompt = spy.mock.calls[0][2];
    expect(prompt).toMatch(/No inventes cifras que no est[eé]n en los datos recibidos/);
    expect(prompt).toMatch(/Sin datos/);
  });
});
