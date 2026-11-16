/**
 * Impuestos especiales (II.EE.) en el H1 CAU, a partir de las medidas
 * nacionales del Arancel Integrado de la AEAT (codigos I.., p. ej. IA3
 * "IC.Ep.2. Cerveza grado plato < 11", 7,480 EUR / HL).
 *
 * Como se declaran (guia CAU, separata 13 e Informacion complementaria,
 * separata 14; Resolucion de 11/07/2014, apendice II):
 * - Commodity/CommodityCode/NationalAdditionalCode: 4 caracteres = epigrafe
 *   (medida IA3 -> "0A3"; empieza por 0 los de la AEAT) + clave:
 *   0 importacion con devengo ("resto de los casos"), S suspensivo, E y B
 *   exencion, N sin devengo, D diferencia de tipos con Canarias.
 * - Con clave 0, un tributo DutiesAndTaxes de taxType = epigrafe ("0A3"),
 *   con el tipo por unidad fiscal, la unidad y la cantidad. La base del IVA
 *   incluye la cuota (art. 83 LIVA).
 *
 * Comprobado en preproduccion el 16/11/2026 (cerveza 2203000100, MX, 8 HL):
 * - sin codigo nacional: error 21526 con la lista de epigrafes del TARIC;
 * - 0A30 sin tributo: error 2826 "Falta declarar Tributo de Impuesto Especial";
 * - 0A30 + tributo 0A3 7,48 HLT x 8: admitido (MRN 26ES002801I01BQYR8), la
 *   AEAT liquida 0A3 = 59,84 y el IVA sobre 4.859,84 (valor + II.EE.);
 * - taxType "IA3": error 50130 (no esta en CLATRIBU).
 * Solo se admite por ahora la clave 0 (con pago) y unidades comprobadas.
 */

// Unidad fiscal del Arancel Integrado -> codigo del mensaje. Solo las probadas.
const UNIDADES = { HL: 'HLT' };
const CLAVES_ADMITIDAS = ['0'];

class ErrorImpuestoEspecial extends Error {
  constructor(message, codigo) {
    super(message);
    this.name = 'ErrorImpuestoEspecial';
    this.codigo = codigo;
  }
}

const numero = (texto) => Number(String(texto).replace(/\./g, '').replace(',', '.'));
const redondear = (v) => Math.round(v * 100) / 100;

/**
 * Medidas de impuestos especiales de la consulta del Arancel Integrado.
 * @returns {{ medida: string, codigoMedida: string, epigrafe: string, descripcion: string, tipo: number|null, unidadAeat: string|null, unidad: string|null }[]}
 */
function medidasDeImpuestoEspecial(resultado) {
  return (resultado?.medidas || [])
    .filter((m) => m.tipo === 'nacional' && /^I[A-Z0-9]{2}-/.test(m.codigo))
    .map((m) => {
      const medida = m.codigo.slice(0, 3);
      const especifico = String(m.derecho || '').match(/^\s*([\d.,]+)\s*EUR\s*\/\s*(\S+)\s*$/);
      const unidadAeat = especifico ? especifico[2].toUpperCase() : null;
      return {
        medida,
        codigoMedida: m.codigo,
        epigrafe: `0${medida.slice(1)}`,
        descripcion: m.descripcion,
        tipo: especifico ? numero(especifico[1]) : null,
        unidadAeat,
        unidad: unidadAeat ? UNIDADES[unidadAeat] || null : null
      };
    });
}

/**
 * Impuesto especial que se guarda en la partida, con el tipo y la unidad que
 * da la AEAT (nunca los del cliente).
 * @param {object} resultado - consulta del Arancel Integrado
 * @param {{ medida: string, cantidad: number, clave?: string }} eleccion
 * @throws {ErrorImpuestoEspecial}
 */
function impuestoEspecialPara(resultado, { medida, cantidad, clave = '0' } = {}) {
  const opcion = medidasDeImpuestoEspecial(resultado).find((o) => o.medida === String(medida || '').toUpperCase());
  if (!opcion) throw new ErrorImpuestoEspecial(`La AEAT no tiene el impuesto especial ${medida} para este código`, 'MEDIDA_NO_VALIDA');
  if (!CLAVES_ADMITIDAS.includes(String(clave))) {
    throw new ErrorImpuestoEspecial('Por ahora solo se declara la importación con pago del impuesto (clave 0); régimen suspensivo y exenciones necesitan el CAE en la casilla 44', 'CLAVE_NO_ADMITIDA');
  }
  if (opcion.tipo === null || !opcion.unidad) {
    throw new ErrorImpuestoEspecial(`El impuesto ${opcion.medida} se liquida por ${opcion.unidadAeat || 'un importe no específico'}: LUCI aún no lo calcula`, 'UNIDAD_NO_SOPORTADA');
  }
  const cant = Number(cantidad);
  if (!(cant > 0) || cant > 1e9) throw new ErrorImpuestoEspecial(`Indica la cantidad en ${opcion.unidadAeat}`, 'CANTIDAD_NO_VALIDA');
  return {
    medida: opcion.medida,
    epigrafe: opcion.epigrafe,
    clave: String(clave),
    descripcion: opcion.descripcion,
    tipo: opcion.tipo,
    unidad: opcion.unidad,
    unidadAeat: opcion.unidadAeat,
    cantidad: cant,
    cuota: redondear(opcion.tipo * cant)
  };
}

/**
 * Lo que aporta el impuesto especial de la partida al H1: el codigo nacional
 * adicional y, con clave 0, el tributo y su cuota (que se suma a la base del IVA).
 */
function impuestoEspecialEnH1(good, medioDePago) {
  const ie = good?.impuestoEspecial;
  if (!ie?.epigrafe || !ie?.clave) return { adicionalesNacionales: [], tributo: null, cuota: 0 };
  const adicionalesNacionales = [`${ie.epigrafe}${ie.clave}`];
  if (ie.clave !== '0') return { adicionalesNacionales, tributo: null, cuota: 0 };
  const cuota = redondear(ie.tipo * ie.cantidad);
  return {
    adicionalesNacionales,
    tributo: { tipo: ie.epigrafe, medioDePago, bases: [{ tipoImpositivo: ie.tipo, unidad: ie.unidad, cantidad: ie.cantidad, cuota }] },
    cuota
  };
}

module.exports = { medidasDeImpuestoEspecial, impuestoEspecialPara, impuestoEspecialEnH1, ErrorImpuestoEspecial, UNIDADES };
