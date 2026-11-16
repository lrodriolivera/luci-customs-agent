/**
 * Impuesto especial sobre los envases de plastico no reutilizables (Ley
 * 7/2022) en el H1 del CAU.
 *
 * Fuente: AEAT, «El impuesto especial sobre envases de plastico no
 * reutilizables. La importacion y demas aspectos de la gestion aduanera»
 * (IMPORT_IEPNR.pdf), pags. 6, 10-12:
 *  - Sujeto: tributo 1PL, kg netos de plastico NO reciclado, tipo 0,45 EUR/kg.
 *    La cuota forma parte de la base del IVA.
 *  - Exento (art. 75): codigo 1P1-1P5 en la casilla 37.2 (procedimiento
 *    adicional) y tributo 1PL con los kg, el tipo 0,45 y cuota cero. Con 1P4
 *    (art. 75 f, hasta 5 kg al mes) la AEAT rechaza el DUA si las partidas con
 *    1P4 superan 5 kg.
 *  - Reciclado: kg netos de plastico reciclado en la casilla 44 con el
 *    certificado 1135; el 1PL solo lleva los kg no reciclados.
 *
 * Comprobado en PRE el 17/11/2026 (modo prueba): exento 1P1 con 1PL cuota 0
 * (MRN 26ES002801I01BRLR5, la AEAT no liquida 1PL); 1135 con 4 kg + 1PL 6 kg
 * (BRMR4, liquida 2,70); todo reciclado, 1135 con 10 kg sin 1PL (BRNR3).
 */

// Ley 7/2022, art. 82: 0,45 EUR por kilo de plastico no reciclado.
const TIPO_PLASTICO = 0.45;
const CERTIFICADO_RECICLADO = '1135';
const EXENCION_5KG = '1P4';
const LIMITE_5KG = 5;

// Codigos de exencion del art. 75 (IMPORT_IEPNR.pdf, pag. 10).
const EXENCIONES_PLASTICO = {
  '1P1': 'Art. 75 a): envases y productos para medicamentos, productos sanitarios, alimentos para usos médicos especiales… (hay que acreditar el destino)',
  '1P2': 'Art. 75 b): envases que contienen medicamentos, productos sanitarios, alimentos para usos médicos especiales o residuos sanitarios peligrosos',
  '1P3': 'Art. 75 c): rollos de plástico para ensilado de forrajes o cereales',
  '1P4': 'Art. 75 f): envases con no más de 5 kg de plástico no reciclado en el mes',
  '1P5': 'Art. 75 g): semielaborados o cierres que no se destinan a envases (hay que acreditar el destino)'
};

const redondear = (n) => Math.round(n * 100) / 100;
const kilos = (v) => (Number(v) > 0 ? Number(v) : 0);

/**
 * Lo que aporta el plastico a una partida del H1.
 *
 * @param {object} good - partida del expediente (`good.impuestoPlastico`)
 * @param {string} medioDePago
 * @param {number} n - numero de partida (para los mensajes)
 * @param {string[]} faltan - se le añaden los datos que faltan
 * @returns {{ tributo: object|null, cuota: number, adicionales: string[], documentos: object[], kgExentos5kg: number }}
 */
function plasticoEnH1(good, medioDePago, n, faltan) {
  const datos = good?.impuestoPlastico || {};
  const kg = kilos(datos.kg);
  const kgReciclado = kilos(datos.kgReciclado);
  const exencion = EXENCIONES_PLASTICO[datos.exencion] ? datos.exencion : null;
  const certificado = String(datos.certificadoReciclado || '').trim();

  if (kgReciclado > 0 && !certificado) {
    faltan.push(`número del certificado de plástico reciclado (1135) de la partida ${n}`);
  }
  if (exencion && kg === 0) {
    faltan.push(`kg de plástico no reciclado de la partida ${n}: la exención ${exencion} se declara con los kg y cuota cero`);
  }

  const cuota = kg > 0 && !exencion ? redondear(kg * TIPO_PLASTICO) : 0;
  return {
    tributo: kg > 0
      ? { tipo: '1PL', medioDePago, bases: [{ tipoImpositivo: TIPO_PLASTICO, unidad: 'KGM', cantidad: kg, cuota }] }
      : null,
    cuota,
    adicionales: exencion && kg > 0 ? [exencion] : [],
    documentos: kgReciclado > 0 && certificado
      ? [{ tipo: CERTIFICADO_RECICLADO, referencia: certificado, unidad: 'KGM', cantidad: kgReciclado }]
      : [],
    kgExentos5kg: exencion === EXENCION_5KG ? kg : 0
  };
}

/**
 * La AEAT rechaza el DUA si las partidas con 1P4 suman mas de 5 kg.
 *
 * @param {number} totalKg - suma de `kgExentos5kg` de las partidas
 * @param {string[]} faltan
 */
function comprobarLimite5kg(totalKg, faltan) {
  if (totalKg > LIMITE_5KG) {
    faltan.push(`plástico con la exención 1P4 (hasta ${LIMITE_5KG} kg al mes): las partidas suman ${redondear(totalKg)} kg; por encima de ${LIMITE_5KG} kg se liquida todo el mes, quita la exención`);
  }
}

module.exports = { plasticoEnH1, comprobarLimite5kg, EXENCIONES_PLASTICO, TIPO_PLASTICO };
