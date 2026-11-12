/**
 * Divisa de la factura de un expediente y tipo de cambio oficial con el que
 * su valor pasa a euros. El DUA admite una sola divisa (casilla 22) y los
 * tributos se liquidan siempre en euros.
 */
const { ErrorValidacion } = require('../forms/identificadorAduanero');
const { tipoOficial, aEuros } = require('./tiposCambioOficiales');

const CAMBIO_EUR = Object.freeze({ divisa: 'EUR', tipo: 1 });

const codigo = (divisa) => String(divisa || 'EUR').trim().toUpperCase() || 'EUR';

/** Divisas distintas que aparecen en las partidas (sin divisa = EUR). */
function divisasDelExpediente(expedition) {
  const goods = expedition?.goods || [];
  return [...new Set(goods.map((g) => codigo(g.currency)))];
}

/** Divisa de la factura; lanza 422 si las partidas no comparten divisa. */
function divisaDelExpediente(expedition) {
  const divisas = divisasDelExpediente(expedition);
  if (divisas.length > 1) {
    throw new ErrorValidacion(
      `Las partidas están en divisas distintas (${divisas.join(', ')}): el DUA admite una sola divisa de factura`,
      { code: 'DIVISAS_MEZCLADAS' }
    );
  }
  return divisas[0] || 'EUR';
}

/**
 * Tipo oficial que corresponde al expediente en una fecha (por defecto hoy:
 * rige el del mes en que se admite la declaracion). Lanza 422 si la divisa no
 * tiene tipo oficial: en ese caso los importes deben declararse en euros.
 */
async function cambioDelExpediente(expedition, opciones = {}) {
  const divisa = divisaDelExpediente(expedition);
  if (divisa === 'EUR') return { ...CAMBIO_EUR };
  const cambio = await tipoOficial(divisa, opciones);
  if (cambio) return cambio;
  const aplicado = cambioAplicado(expedition, divisa);
  if (aplicado) return aplicado;
  throw new ErrorValidacion(
    `La divisa ${divisa} no tiene tipo de cambio oficial del BCE: indica el cambio aplicado (1 EUR = … ${divisa}) en «Datos para presentar el H1»; el H1 se declarará en euros`,
    { code: 'DIVISA_SIN_TIPO_OFICIAL' }
  );
}

/**
 * Cambio que indico el usuario para una divisa que el BCE no cotiza. La
 * Resolucion del DUA (casilla 22) manda declarar entonces en euros el
 * contravalor y, con el codigo 1017, «el codigo de la divisa de facturacion y
 * el cambio aplicado». La AEAT rechaza esas divisas en el H1 CAU (error 25001).
 */
function cambioAplicado(expedition, divisa) {
  const a = expedition?.appliedExchangeRate;
  if (!a || codigo(a.currency) !== divisa || !(Number(a.rate) > 0)) return null;
  return { divisa, tipo: Number(a.rate), sinTipoBce: true, fuente: 'cambio aplicado' };
}

/**
 * Cambio que debe usar quien construye un H1 de forma sincrona: el recibido, o
 * EUR a 1 si el expediente esta en euros. Con otra divisa y sin tipo, lanza:
 * convertir a 1 declararia dolares como si fueran euros.
 */
function cambioObligatorio(expedition, cambio) {
  const divisa = divisaDelExpediente(expedition);
  if (divisa === 'EUR') return { ...CAMBIO_EUR };
  if (!cambio || codigo(cambio.divisa) !== divisa || !(cambio.tipo > 0)) {
    throw new ErrorValidacion(
      `Falta el tipo de cambio oficial de ${divisa} para pasar la factura a euros`,
      { code: 'TIPO_CAMBIO_FALTANTE' }
    );
  }
  return cambio;
}

module.exports = {
  CAMBIO_EUR, divisasDelExpediente, divisaDelExpediente, cambioDelExpediente, cambioAplicado, cambioObligatorio, aEuros
};
