/**
 * El operador 'regex' de las condiciones de workflow no puede bloquear el
 * proceso.
 *
 * El patron lo escribe quien configura el workflow y se evalua con new RegExp
 * contra datos de las entidades en el propio proceso de Node: un patron con
 * cuantificadores anidados como (a+)+$ tarda un tiempo exponencial con una
 * entrada como 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa!' y deja el servidor sin
 * atender a nadie (ReDoS). La funcion se mantiene; se limita la longitud del
 * patron y se rechazan los cuantificadores anidados (la condicion se evalua
 * como false, igual que un patron invalido).
 */

const workflowEngine = require('../../../src/services/workflow/workflowEngine');
const { esPatronRegexSeguro, MAX_REGEX_PATTERN_LENGTH } = require('../../../src/services/workflow/workflowEngine');

const ctx = { entity: { status: 'pending', ref: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!' } };
const evalRegex = (field, value) =>
  workflowEngine.evaluateCondition({ field, operator: 'regex', value }, ctx);

describe('operador regex: patrones peligrosos', () => {
  test.each([
    '(a+)+$',
    '(a*)*b',
    '(\\d+)*x',
    '(a+b)+$',
    '(x{1,5}){2,}',
    '((ab)+c)+',
    '(?:a+)+'
  ])('rechaza el patron con cuantificadores anidados %s', (patron) => {
    expect(esPatronRegexSeguro(patron)).toBe(false);
  });

  test('un patron con cuantificadores anidados se evalua como false sin colgarse', () => {
    const inicio = Date.now();
    expect(evalRegex('entity.ref', '(a+)+$')).toBe(false);
    expect(Date.now() - inicio).toBeLessThan(200);
  });

  test('rechaza un patron demasiado largo', () => {
    const largo = 'a'.repeat(MAX_REGEX_PATTERN_LENGTH + 1);
    expect(esPatronRegexSeguro(largo)).toBe(false);
    expect(evalRegex('entity.status', largo)).toBe(false);
  });

  test('rechaza lo que no es un string', () => {
    expect(esPatronRegexSeguro({ $ne: null })).toBe(false);
    expect(esPatronRegexSeguro(undefined)).toBe(false);
  });
});

describe('operador regex: patrones normales siguen funcionando', () => {
  test.each([
    ['^pend', true],
    ['ing$', true],
    ['^(pending|draft)$', true],
    ['p[a-z]+g', true],
    ['\\d{3}', false],
    ['(ab)+', false],
    ['a+b*c?', false],
    ['[(]+', false]
  ])('acepta y evalua %s', (patron, esperado) => {
    expect(esPatronRegexSeguro(patron)).toBe(true);
    expect(evalRegex('entity.status', patron)).toBe(esperado);
  });

  test('un patron justo en el limite de longitud se acepta', () => {
    expect(esPatronRegexSeguro('a'.repeat(MAX_REGEX_PATTERN_LENGTH))).toBe(true);
  });

  test('un cuantificador escapado o dentro de una clase no cuenta como anidado', () => {
    expect(esPatronRegexSeguro('(a\\+)+')).toBe(true);
    expect(esPatronRegexSeguro('([+*])+')).toBe(true);
  });
});
