/**
 * Tests del extractor de JSON de las respuestas del modelo.
 *
 * _extraerJsonString es la pieza que migro los ~40 sitios que hacian el matcher
 * fragil `content.match(/```...```/)` + JSON.parse. Su contrato: devolver el
 * string JSON saneado aceptando la valla markdown con o sin cierre, y rescatar
 * el JSON truncado cerrando lo que quedo abierto. _parseJsonRespuesta es su
 * version que ya devuelve el objeto parseado.
 *
 * El bug que motivo todo esto: el regex exigia el ``` de cierre, asi que una
 * respuesta cortada a media frase (habitual con Bedrock cuando agota tokens)
 * no casaba, se parseaba el texto entero con la valla incluida y reventaba,
 * cayendo a fallbacks que fingian resultados (canal verde inventado, expediente
 * "limpio", completitud del 50%...).
 */

const aiService = require('../../src/services/aiService');

describe('aiService._extraerJsonString / _parseJsonRespuesta', () => {
  test('extrae el JSON de una valla markdown cerrada', () => {
    const content = '```json\n{"a":1,"b":[1,2]}\n```';
    expect(aiService._extraerJsonString(content)).toBe('{"a":1,"b":[1,2]}');
    expect(aiService._parseJsonRespuesta(content)).toEqual({ a: 1, b: [1, 2] });
  });

  test('acepta JSON sin valla markdown', () => {
    const content = '{"ok":true}';
    expect(aiService._parseJsonRespuesta(content)).toEqual({ ok: true });
  });

  test('rescata una respuesta truncada sin valla de cierre', () => {
    // Se corto a media frase: sin ``` final y con el ultimo elemento incompleto.
    const content = '```json\n{\n  "items": [\n    {"id": 1, "name": "uno"},\n    {"id": 2, "name": "do';
    const parsed = aiService._parseJsonRespuesta(content);
    // Rescata el primer elemento completo; el segundo, cortado, se descarta.
    expect(parsed.items).toEqual([{ id: 1, name: 'uno' }]);
  });

  test('rescata cuando el modelo agoto tokens dejando un array a medias', () => {
    const content = '{"issues": [{"type": "A"}, {"type": "B"}, {"type": "C"';
    const parsed = aiService._parseJsonRespuesta(content);
    expect(parsed.issues).toEqual([{ type: 'A' }, { type: 'B' }]);
  });

  test('lanza cuando no hay nada parseable ni rescatable', () => {
    expect(() => aiService._parseJsonRespuesta('esto no es json en absoluto {')).toThrow();
  });
});
