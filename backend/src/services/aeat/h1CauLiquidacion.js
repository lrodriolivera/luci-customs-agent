/**
 * Liquidacion del H1 CAU: lo que LUCI declaro en el mensaje CC415A frente a
 * lo que liquida la AEAT (respuesta al presentar o consulta).
 *
 * Lo declarado se lee del XML enviado (guardado en `declaration.cauEnvio`):
 * es exactamente lo que recibio la AEAT, tambien en declaraciones antiguas.
 * Funciones puras; la comparacion se calcula al leer, no se guarda.
 */
const { DOMParser } = require('@xmldom/xmldom');

const redondear = (n) => Math.round(n * 100) / 100;
const CENTIMO = 0.005;

const hijos = (nodo, nombre) => {
  const lista = [];
  for (let n = nodo?.firstChild; n; n = n.nextSibling) if (n.nodeType === 1 && (!nombre || n.localName === nombre)) lista.push(n);
  return lista;
};
const hijo = (nodo, ...ruta) => ruta.reduce((actual, nombre) => (actual ? hijos(actual, nombre)[0] : undefined), nodo);
const numero = (nodo, nombre) => {
  const valor = hijo(nodo, nombre)?.textContent?.trim();
  return valor === undefined || valor === '' || Number.isNaN(Number(valor)) ? null : Number(valor);
};
function buscar(nodo, nombre) {
  for (const n of hijos(nodo)) {
    if (n.localName === nombre) return n;
    const dentro = buscar(n, nombre);
    if (dentro) return dentro;
  }
  return null;
}

/** Suma de las bases y cuotas de un tributo (puede tener varias bases). */
const sumaBases = (bases, base, cuota) => ({
  base: redondear(bases.reduce((s, b) => s + (b[base] || 0), 0)),
  cuota: redondear(bases.reduce((s, b) => s + (b[cuota] || 0), 0))
});

/**
 * @param {string} requestXML  mensaje CC415A enviado
 * @returns {{ total: number, partidas: Array<{ numero: number, tributos: Array<{ tipo, base, cuota }> }> } | null}
 */
function liquidacionDeclarada(requestXML) {
  if (typeof requestXML !== 'string' || !requestXML.trim()) return null;
  const fallos = [];
  const documento = new DOMParser({ errorHandler: { warning: () => {}, error: (m) => fallos.push(m), fatalError: (m) => fallos.push(m) } })
    .parseFromString(requestXML, 'text/xml');
  if (!documento?.documentElement || fallos.length > 0) return null;
  const envio = buscar(documento.documentElement, 'GoodsShipment') || (documento.documentElement.localName === 'GoodsShipment' ? documento.documentElement : null);
  const items = hijos(envio, 'GoodsShipmentItem');
  if (items.length === 0) return null;

  const partidas = items.map((item) => ({
    numero: numero(item, 'sequenceNumber'),
    tributos: hijos(hijo(item, 'Commodity', 'CalculationOfTaxes'), 'DutiesAndTaxes').map((t) => {
      const bases = hijos(t, 'TaxBase').map((b) => ({ importe: numero(b, 'amount'), cuota: numero(b, 'taxAmount') }));
      return { tipo: hijo(t, 'taxType')?.textContent?.trim() || null, ...sumaBases(bases, 'importe', 'cuota') };
    })
  }));
  const total = redondear(partidas.reduce((s, p) => s + p.tributos.reduce((t, x) => t + x.cuota, 0), 0));
  return { total, partidas };
}

/**
 * Compara lo declarado con lo que liquida la AEAT. `diferencia` = AEAT − LUCI
 * en la cuota; un tributo que solo aparece en un lado cuenta entero.
 *
 * @returns {{ cuadra: boolean, totalLuci: number, totalAeat: number, diferencia: number, partidas: Array }|null}
 */
function compararLiquidacion(declarada, aeat) {
  if (!declarada || !Array.isArray(aeat?.partidas) || aeat.partidas.length === 0) return null;
  const numeros = [...new Set([...declarada.partidas.map((p) => p.numero), ...aeat.partidas.map((p) => p.numero)])];

  const partidas = numeros.map((numero) => {
    const deLuci = declarada.partidas.find((p) => p.numero === numero)?.tributos || [];
    const deAeat = (aeat.partidas.find((p) => p.numero === numero)?.tributos || [])
      .map((t) => ({ tipo: t.tipo, ...sumaBases(t.bases || [], 'importe', 'cuota') }));
    const tipos = [...new Set([...deLuci.map((t) => t.tipo), ...deAeat.map((t) => t.tipo)])];
    return {
      numero,
      tributos: tipos.map((tipo) => {
        const l = deLuci.find((t) => t.tipo === tipo);
        const a = deAeat.find((t) => t.tipo === tipo);
        return {
          tipo,
          luci: l ? { base: l.base, cuota: l.cuota } : null,
          aeat: a ? { base: a.base, cuota: a.cuota } : null,
          diferencia: redondear((a?.cuota || 0) - (l?.cuota || 0))
        };
      })
    };
  });

  const totalAeat = aeat.totalAPagar ?? redondear(partidas.reduce((s, p) => s + p.tributos.reduce((t, x) => t + (x.aeat?.cuota || 0), 0), 0));
  const diferencia = redondear(totalAeat - declarada.total);
  const cuadra = Math.abs(diferencia) < CENTIMO && partidas.every((p) => p.tributos.every((t) =>
    Math.abs(t.diferencia) < CENTIMO && t.luci && t.aeat && Math.abs(t.luci.base - t.aeat.base) < CENTIMO));
  return { cuadra, totalLuci: declarada.total, totalAeat, diferencia, partidas };
}

module.exports = { liquidacionDeclarada, compararLiquidacion };
