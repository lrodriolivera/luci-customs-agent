/**
 * Tipo de cambio para el valor en aduana.
 *
 * Regla (art. 53 del CAU y art. 146 del Reglamento de Ejecucion (UE)
 * 2015/2447): vale el tipo de referencia que publica el BCE el penultimo
 * miercoles de cada mes, y se aplica durante todo el mes siguiente. Si ese
 * dia no hubo publicacion, rige el ultimo tipo publicado antes.
 *
 * Aqui solo hay calculo puro: fechas y lectura del XML del BCE. El tipo se
 * expresa como lo publica el BCE: unidades de la divisa por 1 EUR.
 */

const ZONA = 'Europe/Madrid';
const MIERCOLES = 3;
// Si el BCE no publico el dia de referencia se admite el ultimo tipo anterior,
// pero no uno de hace semanas: seria señal de que la serie esta incompleta.
const MAX_DIAS_ATRAS = 7;

const pad = (n) => String(n).padStart(2, '0');

/** Mes («AAAA-MM») en el que cae una fecha, en hora de Madrid. */
function mesDe(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit' })
    .formatToParts(fecha);
  const valor = (tipo) => partes.find((p) => p.type === tipo).value;
  return `${valor('year')}-${valor('month')}`;
}

function mesAnterior(mes) {
  const [anio, m] = mes.split('-').map(Number);
  return m === 1 ? `${anio - 1}-12` : `${anio}-${pad(m - 1)}`;
}

/** Penultimo miercoles de un mes («AAAA-MM») como «AAAA-MM-DD». */
function penultimoMiercoles(mes) {
  const [anio, m] = mes.split('-').map(Number);
  const diasDelMes = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  const miercoles = [];
  for (let dia = 1; dia <= diasDelMes; dia += 1) {
    if (new Date(Date.UTC(anio, m - 1, dia)).getUTCDay() === MIERCOLES) miercoles.push(dia);
  }
  return `${anio}-${pad(m)}-${pad(miercoles[miercoles.length - 2])}`;
}

/** Dia cuyo tipo rige durante el mes indicado. */
function fechaDeReferencia(mes) {
  return penultimoMiercoles(mesAnterior(mes));
}

/**
 * Lee el XML de tipos de referencia del BCE (diario, 90 dias o historico).
 * Devuelve { 'AAAA-MM-DD': { USD: 1.1234, ... } }.
 */
function parsearBce(xml) {
  const serie = {};
  const dias = String(xml || '').split(/<Cube\s+time=/).slice(1);
  for (const bloque of dias) {
    const fecha = (bloque.match(/^['"](\d{4}-\d{2}-\d{2})['"]/) || [])[1];
    if (!fecha) continue;
    const tipos = {};
    const patron = /currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g;
    let hallado = patron.exec(bloque);
    while (hallado) {
      const tipo = Number(hallado[2]);
      if (Number.isFinite(tipo) && tipo > 0) tipos[hallado[1]] = tipo;
      hallado = patron.exec(bloque);
    }
    if (Object.keys(tipos).length > 0) serie[fecha] = tipos;
  }
  return serie;
}

function diasEntre(desde, hasta) {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);
}

/**
 * Tipos que rigen en un mes, sacados de una serie del BCE.
 * Devuelve null si la serie no alcanza el dia de referencia.
 */
function tiposDelMes(mes, serie) {
  const referencia = fechaDeReferencia(mes);
  const publicadas = Object.keys(serie || {}).filter((f) => f <= referencia).sort();
  const publicacion = publicadas[publicadas.length - 1];
  if (!publicacion || diasEntre(publicacion, referencia) > MAX_DIAS_ATRAS) return null;
  return { mes, fechaReferencia: referencia, fechaPublicacion: publicacion, tipos: { ...serie[publicacion] } };
}

/** Importe en euros de un importe en divisa (tipo = divisa por 1 EUR), a centimos. */
function aEuros(importe, tipo) {
  const valor = Number(importe) || 0;
  if (!(tipo > 0)) throw new Error('Tipo de cambio no válido');
  return Math.round((valor / tipo) * 100) / 100;
}

module.exports = {
  mesDe, mesAnterior, penultimoMiercoles, fechaDeReferencia, parsearBce, tiposDelMes, aEuros
};
