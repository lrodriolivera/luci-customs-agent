/**
 * Reglamento (UE) 2026/382 — supresión de la franquicia aduanera de 150 EUR.
 *
 * Aplicable desde 1/Jul/2026. Suprime el capítulo V del título II del Reg. (CE)
 * 1186/2009 (franquicia por umbral). Medida transitoria 1/Jul/2026 → 1/Jul/2028:
 * derecho de aduana fijo de 3 EUR/artículo en envíos cuyo valor intrínseco total
 * no supere 150 EUR cuando:
 *   (a) la importación esté exenta de IVA por IOSS (art. 143.1.c bis Dir. 2006/112/CE), o
 *   (b) se trate de mercancías en envíos postales.
 *
 * Ref: DOUE L de 18/02/2026; BOE DOUE-L-2026-80212.
 */
const REG_2026_382 = {
  fechaAplicacion: new Date('2026-07-01T00:00:00Z'),
  finTransitorio: new Date('2028-07-01T00:00:00Z'),
  derechoFijoPorArticulo: 3.00,
  transportistasPostales: ['CORREOS']
};

/**
 * Determina si a un envío H7 le corresponde el derecho fijo transitorio de 3 EUR/artículo.
 * @param {object} declaration objeto con {totals, vatPrepaid, duties, carrier}
 * @param {Date} [fecha] fecha de evaluación (por defecto, ahora)
 * @returns {boolean}
 */
function aplicaDerechoFijo2026(declaration, fecha = new Date()) {
  if (fecha < REG_2026_382.fechaAplicacion || fecha >= REG_2026_382.finTransitorio) return false;
  const valor = declaration.totals?.intrinsicValue ?? declaration.totals?.customsValue ?? 0;
  if (valor > 150) return false; // fuera del ámbito H7 / de la medida
  const esIOSSExento = !!(declaration.vatPrepaid || declaration.duties?.vat?.prepaid);
  const codigoCarrier = (declaration.carrier?.code || '').toUpperCase();
  const esPostal = REG_2026_382.transportistasPostales.includes(codigoCarrier);
  return esIOSSExento || esPostal;
}

module.exports = { REG_2026_382, aplicaDerechoFijo2026 };
