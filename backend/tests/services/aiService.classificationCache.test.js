/**
 * aiService.classifyProduct — cache de clasificacion TARIC
 *
 * Clasificar es la operacion mas cara del producto: usa Opus y ronda los 2.900
 * tokens de salida por llamada. En e-commerce el mismo articulo se repite entre
 * expedientes ("camiseta algodon", "funda movil", "cable USB"), asi que cada
 * repeticion estaba pagando una clasificacion completa.
 *
 * Ojo: TaricAICache NO sirve aqui. Cachea en el sentido contrario —codigo TARIC
 * a informacion arancelaria—, mientras que clasificar va de descripcion a
 * codigo. De ahi una cache propia sobre el cacheService compartido (Redis en
 * produccion, memoria como respaldo).
 *
 * Frontera mockeada: la llamada al modelo y el almacen. La normalizacion de la
 * clave se ejecuta de verdad, que es lo que decide si dos descripciones
 * comparten entrada.
 */

const aiService = require('../../src/services/aiService');
const { getCache } = require('../../src/services/cacheService');

const RESPUESTA_IA = JSON.stringify({
  suggestions: [{ code: '6109100000', description: 'Camisetas de algodon', confidence: 92 }]
});

describe('aiService.classifyProduct — cache', () => {
  let cache;
  let callSpy;

  beforeEach(async () => {
    cache = getCache();
    if (cache.flushAll) await cache.flushAll();
    callSpy = jest.spyOn(aiService, 'callClaude').mockResolvedValue({
      content: RESPUESTA_IA,
      model: 'global.anthropic.claude-opus-5',
      tokensUsed: 2949,
      stopReason: 'end_turn'
    });
  });

  afterEach(() => {
    callSpy.mockRestore();
  });

  it('clasifica llamando al modelo la primera vez', async () => {
    const r = await aiService.classifyProduct({ description: 'Camiseta de algodon hombre' });

    expect(callSpy).toHaveBeenCalledTimes(1);
    expect(r[0].code).toBe('6109100000');
  });

  it('no vuelve a llamar al modelo con la misma descripcion', async () => {
    await aiService.classifyProduct({ description: 'Camiseta de algodon hombre' });
    const r = await aiService.classifyProduct({ description: 'Camiseta de algodon hombre' });

    expect(callSpy).toHaveBeenCalledTimes(1);
    expect(r[0].code).toBe('6109100000');
  });

  it('trata como iguales descripciones que solo difieren en formato', async () => {
    // El mismo articulo escrito por dos operarios distintos.
    await aiService.classifyProduct({ description: 'Camiseta de algodon hombre' });
    await aiService.classifyProduct({ description: '  CAMISETA  DE   ALGODON HOMBRE ' });

    expect(callSpy).toHaveBeenCalledTimes(1);
  });

  it('vuelve a llamar si la descripcion es otra', async () => {
    await aiService.classifyProduct({ description: 'Camiseta de algodon hombre' });
    await aiService.classifyProduct({ description: 'Auriculares bluetooth' });

    expect(callSpy).toHaveBeenCalledTimes(2);
  });

  it('separa entradas cuando cambia el material, que cambia la partida', async () => {
    // Una camiseta de algodon y una de poliester no son el mismo TARIC.
    await aiService.classifyProduct({
      description: 'Camiseta', additionalInfo: { material: 'algodon' }
    });
    await aiService.classifyProduct({
      description: 'Camiseta', additionalInfo: { material: 'poliester' }
    });

    expect(callSpy).toHaveBeenCalledTimes(2);
  });

  it('separa entradas cuando cambia el origen, que decide el arancel', async () => {
    await aiService.classifyProduct({
      description: 'Bicicleta', additionalInfo: { origin: 'CN' }
    });
    await aiService.classifyProduct({
      description: 'Bicicleta', additionalInfo: { origin: 'DE' }
    });

    expect(callSpy).toHaveBeenCalledTimes(2);
  });

  it('no cachea una respuesta que no se pudo interpretar', async () => {
    // Guardar basura envenenaria la cache durante dias.
    callSpy.mockResolvedValue({
      content: 'lo siento, no puedo clasificar eso',
      tokensUsed: 30,
      stopReason: 'end_turn'
    });

    await aiService.classifyProduct({ description: 'Producto indescifrable XYZ' });
    await aiService.classifyProduct({ description: 'Producto indescifrable XYZ' });

    expect(callSpy).toHaveBeenCalledTimes(2);
  });
});
