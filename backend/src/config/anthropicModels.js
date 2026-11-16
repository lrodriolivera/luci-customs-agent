/**
 * IDs de los modelos en la API de Anthropic (proveedor principal desde el
 * 16/11/2026; Bedrock queda de respaldo con config/bedrockModels).
 *
 * Aqui van sin prefijo: la API de Anthropic no usa inference profiles. Es el
 * unico fichero donde tests/services/modelIdGuard.test.js admite un ID sin
 * prefijo. Generacion actual: Opus 5.5 y Sonnet 5.5 (mismo uso que Opus 5 y
 * Sonnet 5 en Bedrock, mas baratos).
 */
module.exports = {
  OPUS: process.env.ANTHROPIC_OPUS_MODEL || 'claude-opus-5-5',
  SONNET: process.env.ANTHROPIC_SONNET_MODEL || 'claude-sonnet-5-5',
  HAIKU: process.env.ANTHROPIC_HAIKU_MODEL || 'claude-haiku-5-5'
};
