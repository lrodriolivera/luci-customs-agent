/**
 * Ningun $regex de MongoDB recibe un termino sin escapar.
 *
 * Los listados y busquedas pasaban req.query.search, parametros de ruta y
 * campos de documentos a $regex tal cual (hallazgos de inyeccion NoSQL / ReDoS
 * del escaneo del 3/Nov/2026): '.*' devolvia todo y '(a+)+$' podia bloquear la
 * base de datos. Todos pasan ahora por utils/escapeRegex.
 *
 * La segunda parte recorre src/ y falla si aparece un `$regex:` cuyo valor no
 * pase por escapeRegex, para que el siguiente no dependa de que alguien
 * tropiece con el.
 */

const fs = require('fs');
const path = require('path');
const { escapeRegex } = require('../../src/utils/escapeRegex');

describe('escapeRegex', () => {
  test.each([
    ['.*', '\\.\\*'],
    ['(a+)+$', '\\(a\\+\\)\\+\\$'],
    ['^MSCU[0-9]{7}', '\\^MSCU\\[0-9\\]\\{7\\}'],
    ['a|b', 'a\\|b'],
    ['back\\slash', 'back\\\\slash']
  ])('escapa %s', (entrada, esperado) => {
    expect(escapeRegex(entrada)).toBe(esperado);
  });

  test('deja igual un termino normal', () => {
    expect(escapeRegex('MSKU1234567')).toBe('MSKU1234567');
    expect(escapeRegex('Naviera SL - 26ES')).toBe('Naviera SL - 26ES');
  });

  test('un termino escapado solo coincide literalmente', () => {
    const re = new RegExp(escapeRegex('MSCU.*'), 'i');
    expect(re.test('MSCU.*123')).toBe(true);
    expect(re.test('MSCU1234567')).toBe(false);
    expect(new RegExp(escapeRegex('mscu123'), 'i').test('MSCU1234567')).toBe(true);
  });

  test('un objeto deja de ser un operador', () => {
    expect(escapeRegex({ $ne: null })).toBe('\\[object Object\\]');
    expect(escapeRegex(undefined)).toBe('');
    expect(escapeRegex(null)).toBe('');
    expect(escapeRegex(1234)).toBe('1234');
  });
});

describe('guardia: todo $regex de src/ pasa por escapeRegex', () => {
  const SRC = path.join(__dirname, '../../src');

  function ficheros(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return ficheros(p);
      return p.endsWith('.js') ? [p] : [];
    });
  }

  test('no queda ningun $regex con un valor sin escapar', () => {
    const sinEscapar = [];
    for (const f of ficheros(SRC)) {
      fs.readFileSync(f, 'utf8').split('\n').forEach((linea, i) => {
        if (/^\s*(\/\/|\*)/.test(linea)) return;
        const m = linea.match(/\$regex:\s*([^,}]+)/);
        if (!m) return;
        const valor = m[1].trim();
        // Escapado, o un literal sin interpolacion (/^[0-9]+$/ o '^ES').
        if (/escapeRegex\(/.test(valor)) return;
        if (/^\/.*\/[a-z]*$/.test(valor) || /^'[^']*'$/.test(valor)) return;
        sinEscapar.push(`${path.relative(SRC, f)}:${i + 1}  ${linea.trim()}`);
      });
    }
    expect(sinEscapar).toEqual([]);
  });

  // El guard de arriba solo miraba `$regex:` y new RegExp(variable): no vio
  // new RegExp(`Artículo\\s*${article}...`) de regulationService.searchArticle
  // (F2 de noviembre, F17 de septiembre), un ReDoS sin autenticar. Este recorre
  // cada new RegExp(`...`) aunque ocupe varias lineas y exige escapeRegex en
  // cada interpolacion ${...}.
  // Unica excepcion: la alternancia (A|B|C) se construye a proposito con
  // constantes del propio script de auditoria; escaparla romperia el '|'.
  const EXCEPCIONES_PLANTILLA = {
    'scripts/auditTenantFilters.js': 'alternancia de nombres de modelos y metodos, constantes del propio script'
  };

  test('ninguna new RegExp con plantilla interpola un valor sin escapar', () => {
    const sinEscapar = [];
    for (const f of ficheros(SRC)) {
      if (EXCEPCIONES_PLANTILLA[path.relative(SRC, f)]) continue;
      const codigo = fs.readFileSync(f, 'utf8');
      const plantillas = /new RegExp\(\s*`((?:[^`\\]|\\[\s\S])*)`/g;
      let m;
      while ((m = plantillas.exec(codigo))) {
        const linea = codigo.slice(0, m.index).split('\n').length;
        for (const interp of m[1].matchAll(/\$\{([^}]*)\}/g)) {
          if (!/^\s*escapeRegex\(/.test(interp[1])) {
            sinEscapar.push(`${path.relative(SRC, f)}:${linea}  \${${interp[1].trim()}}`);
          }
        }
      }
    }
    expect(sinEscapar).toEqual([]);
  });

  test('ninguna RegExp de consulta se construye con un termino de busqueda crudo', () => {
    const sinEscapar = [];
    for (const f of ficheros(SRC)) {
      fs.readFileSync(f, 'utf8').split('\n').forEach((linea, i) => {
        if (/new RegExp\(\s*(search|q|term|termino|filters\.search|req\.(query|params|body)\.\w+)\s*[,)]/.test(linea)) {
          sinEscapar.push(`${path.relative(SRC, f)}:${i + 1}  ${linea.trim()}`);
        }
      });
    }
    expect(sinEscapar).toEqual([]);
  });
});
