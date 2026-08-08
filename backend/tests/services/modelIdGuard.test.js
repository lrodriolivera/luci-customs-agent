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

/**
 * Guardia: las etiquetas de presentacion tienen que corresponder al modelo
 * que se acaba de invocar.
 *
 * El guard de arriba deja pasar a proposito las etiquetas cortas
 * ('opus-5', 'sonnet-5') porque no viajan a Bedrock. El efecto colateral es
 * que tampoco detecta cuando se quedan obsoletas: tras migrar a Claude 5,
 * aiService seguia devolviendo `model: 'opus-4'` y `model: 'sonnet-4'` en 39
 * sitios. Eso llega al frontend y a la UI del cliente, que muestra un modelo
 * que no existe en la cuenta.
 *
 * Peor: la etiqueta tampoco coincidia con la GAMA. Habia 14 respuestas
 * etiquetadas 'opus-4' que en realidad las genero SONNET, y una 'sonnet-4'
 * generada por el modelo rapido. Un cliente que audite por que una
 * clasificacion salio mal leeria el modelo equivocado.
 *
 * Se comprueba contra el codigo fuente, y no sobre una llamada concreta,
 * porque el objetivo es que la proxima migracion de modelo no pueda dejar
 * etiquetas rancias detras.
 */
describe('etiquetas de modelo para presentacion', () => {
  const AI_SERVICE = path.join(SRC, 'services/aiService.js');

  /** `model: 'opus-4'` y companyia: version de modelo escrita a mano. */
  const ETIQUETA_LITERAL = /model:\s*['"`]((?:opus|sonnet|haiku)-[0-9][^'"`]*)['"`]/g;

  const GENERACION_VIGENTE = '5';

  it('ninguna etiqueta apunta a una generacion de modelo retirada', () => {
    const lines = fs.readFileSync(AI_SERVICE, 'utf8').split('\n');
    const rancias = [];

    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line)) return;
      for (const [, etiqueta] of line.matchAll(ETIQUETA_LITERAL)) {
        const generacion = etiqueta.match(/-([0-9])/)?.[1];
        // haiku va por su propio versionado (4.5) y no se etiqueta con numero.
        if (etiqueta.startsWith('haiku')) continue;
        if (generacion !== GENERACION_VIGENTE) {
          rancias.push(`aiService.js:${i + 1} -> '${etiqueta}'`);
        }
      }
    });

    expect(rancias).toEqual([]);
  });

  it('la etiqueta coincide con la gama del modelo que se invoco', () => {
    const lines = fs.readFileSync(AI_SERVICE, 'utf8').split('\n');
    const desajustes = [];

    lines.forEach((line, i) => {
      const etiquetas = [...line.matchAll(ETIQUETA_LITERAL)];
      if (!etiquetas.length) return;

      // La constante de modelo se elige en el `callClaude` mas cercano por
      // encima: es el que produjo el `result` que se esta etiquetando.
      let gamaInvocada = null;
      for (let j = i; j >= 0 && j > i - 60; j--) {
        const m = lines[j].match(/callClaude\(\s*(OPUS_MODEL|SONNET_MODEL|FAST_MODEL)/);
        if (m) { gamaInvocada = m[1]; break; }
      }
      if (!gamaInvocada) return;

      // FAST_MODEL y SONNET_MODEL apuntan hoy al mismo perfil de Sonnet.
      const esperada = gamaInvocada === 'OPUS_MODEL' ? 'opus' : 'sonnet';
      for (const [, etiqueta] of etiquetas) {
        const gamaEtiqueta = etiqueta.split('-')[0];
        if (gamaEtiqueta !== esperada) {
          desajustes.push(`aiService.js:${i + 1} -> '${etiqueta}' pero se llamo a ${gamaInvocada}`);
        }
      }
    });

    expect(desajustes).toEqual([]);
  });
});
