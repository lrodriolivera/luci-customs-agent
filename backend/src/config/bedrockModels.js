/**
 * IDs de los modelos de Bedrock, en un unico sitio.
 *
 * Antes vivian repartidos por seis ficheros. Al migrar a Claude 5 solo se
 * actualizaron dos de ellos, y las tres llamadas de dutyCalculationService
 * quedaron apuntando a un modelo inexistente: consultaban tasas arancelarias
 * y fallaban en produccion sin que nada lo delatara.
 *
 * Bedrock exige **inference profiles**: los IDs desnudos se rechazan con
 * "on-demand throughput isn't supported".
 *
 * Se usa el prefijo `global.` en lugar de `us.` porque cuesta un 10% menos
 * (Sonnet 5: $2,00/$10,00 frente a $2,20/$11,00). A cambio, Bedrock enruta a
 * cualquier region con capacidad en vez de solo EE.UU. Si algun cliente exige
 * residencia de datos en la UE habra que pasar a perfiles `eu.`, mas caros.
 *
 * `tests/services/modelIdGuard.test.js` falla si vuelve a aparecer un ID de
 * modelo suelto por el codigo.
 */

/** Razonamiento pesado: clasificacion TARIC, generacion H1, analisis legal. */
const OPUS = process.env.BEDROCK_OPUS_MODEL || 'global.anthropic.claude-opus-5';

/** Consultas medias y chat. */
const SONNET = process.env.BEDROCK_SONNET_MODEL || 'global.anthropic.claude-sonnet-5';

/** Ruta barata: validacion documental, chat simple, lineas de manifiesto H7. */
const FAST = process.env.BEDROCK_FAST_MODEL || 'global.anthropic.claude-sonnet-5';

/**
 * Etiqueta corta para mostrar al usuario o guardar como metadato. No es
 * invocable: nunca debe pasarse a Bedrock.
 */
const labelFor = (modelId) => {
  if (typeof modelId !== 'string') return 'desconocido';
  if (modelId.includes('opus-5')) return 'opus-5';
  if (modelId.includes('sonnet-5')) return 'sonnet-5';
  if (modelId.includes('haiku')) return 'haiku';
  return modelId.replace(/^(us|eu|apac|global)\.anthropic\./, '');
};

module.exports = { OPUS, SONNET, FAST, labelFor };
