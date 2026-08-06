/**
 * Guardia: todo modelo que se pase a Bedrock debe ser un inference profile
 *
 * Bedrock rechaza los IDs desnudos de los modelos actuales con
 * "on-demand throughput isn't supported. Retry with an inference profile",
 * asi que un ID sin prefijo `us.` / `global.` no es un detalle de estilo:
 * es una llamada que falla en produccion.
 *
 * El fallo es ademas silencioso de dos maneras: `callClaude` traduce el error
 * a un generico "Error en servicio de IA", y el fallback entre cuentas NO se
 * dispara (un ValidationException fallaria igual en la otra cuenta). Asi
 * llegaron a produccion las tres llamadas de dutyCalculationService, que
 * consultan tasas arancelarias reales.
 *
 * Este test recorre el codigo fuente porque el objetivo es que el problema no
 * pueda repetirse con el proximo modelo, no cubrir una linea concreta.
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../../src');

/** Un ID de modelo Claude en un literal de cadena. */
const MODEL_LITERAL = /['"`]([a-z0-9._-]*claude[a-z0-9._-]*)['"`]/gi;

/** Prefijos de inference profile que Bedrock acepta. */
const isInferenceProfile = (id) => /^(us|eu|apac|global)\./.test(id);

/**
 * Un ID solo es invocable si lleva prefijo de inference profile. Se excluyen
 * las etiquetas cortas de presentacion ('sonnet-5', 'opus-5'), que nunca
 * llegan a Bedrock: viajan al frontend para decir que modelo respondio.
 */
const isPresentationLabel = (id) => !id.startsWith('claude-') && !id.includes('anthropic');

const listJsFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJsFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });

describe('IDs de modelo Bedrock en el codigo fuente', () => {
  const findings = [];

  beforeAll(() => {
    for (const file of listJsFiles(SRC)) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return; // comentarios
        for (const [, id] of line.matchAll(MODEL_LITERAL)) {
          if (isPresentationLabel(id) || isInferenceProfile(id)) continue;
          findings.push(`${path.relative(SRC, file)}:${i + 1} -> '${id}'`);
        }
      });
    }
  });

  it('ningun ID invocable carece de prefijo de inference profile', () => {
    expect(findings).toEqual([]);
  });
});
