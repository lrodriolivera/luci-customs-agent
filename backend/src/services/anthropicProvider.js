/**
 * Proveedor de IA principal: la API de Anthropic (clave ANTHROPIC_API_KEY).
 * Bedrock queda de respaldo (ver aiService._enviarConverse).
 *
 * aiService construye las peticiones como ConverseCommand de Bedrock; aqui se
 * traducen al Messages API de Anthropic para no tocar las ~60 llamadas que
 * existen. La respuesta se devuelve con la misma forma que la de Bedrock
 * ({ content, model, tokensUsed, stopReason }).
 *
 * Se usa streaming con finalMessage(): las respuestas largas de Opus (analisis
 * completo, generacion H1) tardan mas de un minuto y sin streaming la conexion
 * se quedaba sin respuesta (UAT 16/Nov/2026, «Avanzado IA» con 0 % de confianza).
 */

const AnthropicModule = require('@anthropic-ai/sdk');
const logger = require('../config/logger');

const Anthropic = AnthropicModule.default || AnthropicModule;

// Equivalente en la API de Anthropic de cada familia de Bedrock.
const { OPUS, SONNET, HAIKU } = require('../config/anthropicModels');
const MODELOS = { opus: OPUS, sonnet: SONNET, haiku: HAIKU };

// Diez minutos por peticion (el SDK reintenta 2 veces 408/409/429/5xx y errores de conexion).
const TIMEOUT_MS = 10 * 60 * 1000;
const MAX_REINTENTOS = 2;
const MIN_MAX_TOKENS = 16000;

class FormatoNoSoportado extends Error {
  constructor(message) {
    super(message);
    this.name = 'FormatoNoSoportado';
  }
}

/** Cliente de la API de Anthropic, o null si no hay clave. */
function crearClienteAnthropic(env = process.env) {
  const apiKey = String(env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) return null;
  return new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: MAX_REINTENTOS });
}

/** global.anthropic.claude-opus-5 -> claude-opus-5-5 (por familia). */
function modeloAnthropicPara(modeloBedrock) {
  const id = String(modeloBedrock || '');
  if (id.includes('opus')) return MODELOS.opus;
  if (id.includes('haiku')) return MODELOS.haiku;
  return MODELOS.sonnet;
}

const TIPOS_IMAGEN = { jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
const TEXTO_PLANO = new Set(['txt', 'csv', 'md', 'html']);

const aBase64 = (bytes) => Buffer.from(bytes).toString('base64');

/**
 * Bloque de contenido de Bedrock Converse -> bloque del Messages API.
 * Word y Excel no se admiten como documento en la API de Anthropic: se lanza
 * FormatoNoSoportado y aiService usa Bedrock para esa peticion.
 */
function bloqueAnthropic(bloque) {
  if (typeof bloque?.text === 'string') return { type: 'text', text: bloque.text };
  if (bloque?.image) {
    const mediaType = TIPOS_IMAGEN[bloque.image.format];
    if (!mediaType) throw new FormatoNoSoportado(`Imagen ${bloque.image.format} no admitida`);
    return { type: 'image', source: { type: 'base64', media_type: mediaType, data: aBase64(bloque.image.source.bytes) } };
  }
  if (bloque?.document) {
    const { format, source, name } = bloque.document;
    if (format === 'pdf') {
      return { type: 'document', title: name, source: { type: 'base64', media_type: 'application/pdf', data: aBase64(source.bytes) } };
    }
    if (TEXTO_PLANO.has(format)) {
      return { type: 'document', title: name, source: { type: 'text', media_type: 'text/plain', data: Buffer.from(source.bytes).toString('utf8') } };
    }
    throw new FormatoNoSoportado(`Documento ${format} no admitido por la API de Anthropic`);
  }
  throw new FormatoNoSoportado('Bloque de contenido desconocido');
}

/**
 * Entrada de un ConverseCommand -> parametros de messages.stream().
 * effort (additionalModelRequestFields.output_config.effort) se conserva; los
 * modelos actuales razonan siempre (thinking adaptativo por defecto).
 */
function parametrosDesdeConverse(entrada) {
  const system = (entrada.system || []).map((b) => b.text).filter(Boolean).join('\n\n');
  const effort = entrada.additionalModelRequestFields?.output_config?.effort;
  return {
    model: modeloAnthropicPara(entrada.modelId),
    // Con streaming no hay riesgo de timeout y solo se factura lo generado:
    // un minimo de 16.000 evita cortar respuestas cuyo razonamiento consume
    // parte del presupuesto (con 6.144 se cortaba el analisis completo).
    max_tokens: Math.max(entrada.inferenceConfig?.maxTokens || 0, MIN_MAX_TOKENS),
    ...(system ? { system } : {}),
    ...(effort ? { output_config: { effort } } : {}),
    messages: (entrada.messages || []).map((m) => ({ role: m.role, content: (m.content || []).map(bloqueAnthropic) }))
  };
}

/** Texto de la respuesta (los bloques de razonamiento no se devuelven). */
function textoDe(mensaje) {
  return (mensaje.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

/**
 * Envia la peticion por la API de Anthropic.
 * @param {object} cliente - instancia de Anthropic
 * @param {object} entrada - command.input de un ConverseCommand
 * @returns {Promise<{ content: string, model: string, tokensUsed: number, stopReason: string }>}
 * @throws el error del SDK (tipado), FormatoNoSoportado, o Error si la respuesta es un rechazo
 */
async function enviarConAnthropic(cliente, entrada) {
  const parametros = parametrosDesdeConverse(entrada);
  const mensaje = await cliente.messages.stream(parametros).finalMessage();
  if (mensaje.stop_reason === 'refusal') {
    const categoria = mensaje.stop_details?.category || 'sin categoría';
    throw new Error(`La API de Anthropic rechazó la petición (${categoria})`);
  }
  if (mensaje.stop_reason === 'max_tokens') {
    logger.warn(`Anthropic: respuesta cortada por max_tokens (${parametros.max_tokens}) en ${parametros.model}`);
  }
  return {
    content: textoDe(mensaje),
    model: mensaje.model,
    tokensUsed: (mensaje.usage?.input_tokens || 0) + (mensaje.usage?.output_tokens || 0),
    stopReason: mensaje.stop_reason
  };
}

module.exports = {
  crearClienteAnthropic,
  enviarConAnthropic,
  parametrosDesdeConverse,
  modeloAnthropicPara,
  FormatoNoSoportado,
  Anthropic
};
