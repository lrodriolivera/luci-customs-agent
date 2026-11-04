/**
 * Construccion segura del XML que se envia a la AEAT.
 *
 * Los builders montaban el mensaje con template strings e interpolaban los
 * datos de la declaracion tal cual: un '<' o un '&' en una descripcion, un
 * nombre o un MRN rompia el XML firmado o anadia elementos al mensaje que se
 * presenta en nombre del declarante.
 *
 * `xml` es un tagged template: escapa TODO lo que se interpola salvo lo que ya
 * es XML construido con `xml` (o unido con `joinXml`). Asi el fragmento anidado
 *
 *   xml`<A>${valor}</A>${cond ? xml`<B>${otro}</B>` : ''}`
 *
 * se compone sin doble escapado y cualquier dato suelto se escapa siempre.
 * El builder devuelve String(resultado) al final.
 *
 * Para cualquier valor que no contenga & < > " ' la salida es identica a la
 * del template string original (incluido String(undefined) === 'undefined'),
 * de modo que el XML que la AEAT ya acepta no cambia.
 */

class SafeXml {
  constructor(value) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

/**
 * Escapa un valor para texto o atributo XML.
 * @param {*} valor
 * @returns {string}
 */
function escapeXML(valor) {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Fragmento ya construido -> tal cual; lista de fragmentos (el resultado de un
 * .map(x => xml`...`)) -> concatenada; cualquier otra cosa -> escapada.
 * Una lista que no sea toda de fragmentos se trata como valor, igual que haria
 * el template string original (String([a, b]) === 'a,b').
 */
function render(valor) {
  if (valor instanceof SafeXml) return valor.value;
  if (Array.isArray(valor) && valor.length > 0 && valor.every(v => v instanceof SafeXml)) {
    return valor.map(v => v.value).join('');
  }
  if (Array.isArray(valor) && valor.length === 0) return '';
  return escapeXML(valor);
}

/**
 * Tagged template que escapa las interpolaciones.
 * @returns {SafeXml}
 */
function xml(strings, ...valores) {
  let out = strings[0];
  for (let i = 0; i < valores.length; i++) {
    out += render(valores[i]) + strings[i + 1];
  }
  return new SafeXml(out);
}

/**
 * Une fragmentos (equivale a Array#join para XML ya construido).
 * @param {Array} fragmentos
 * @param {string} [separador='']
 * @returns {SafeXml}
 */
function joinXml(fragmentos, separador = '') {
  return new SafeXml(fragmentos.map(render).join(separador));
}

module.exports = { xml, joinXml, escapeXML, SafeXml };
