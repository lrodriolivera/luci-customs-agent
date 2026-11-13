/**
 * Consulta de las medidas de control de importacion que el TARIC aplica a un
 * codigo y a un pais de origen, con los certificados que exige cada una.
 */
const { prefijosDe } = require('./medidasControl');
const { nombreDeTipo, esProhibicion } = require('./tiposDeMedida');
const { regimenDeSanciones } = require('./sanciones');
const { descripcionDeCategoria, articuloDeCategoria, nombreDeOrigen, textosDobleUso } = require('./textosOficialesEs');

const FUENTE = 'Comisión Europea - TARIC (CIRCABC)';

function modelosPorDefecto() {
  return {
    TaricControlMeasure: require('../../../models/TaricControlMeasure'),
    TaricReference: require('../../../models/TaricReference')
  };
}

/** Cita de la version consolidada de la que salen los encabezados del anexo I. */
function fuenteDelAnexoI() {
  const { nombre, fecha, version, enlace } = textosDobleUso().fuente;
  return { nombre, fecha, version, enlace };
}

/**
 * @param {string} codigo  codigo TARIC (10 digitos; se rellena con ceros)
 * @param {string} pais    pais de origen (ISO de dos letras)
 * @returns {Promise<{ codigo: string, origen: string, fuente: object|null, medidas: object[] }>}
 */
async function controlesPara(codigo, pais, modelos = modelosPorDefecto()) {
  const { TaricControlMeasure, TaricReference } = modelos;
  const limpio = String(codigo || '').replace(/\D/g, '').padEnd(10, '0').slice(0, 10);
  const origen = String(pais || '').trim().toUpperCase();

  const [meta, grupos, correlaciones] = await Promise.all([
    TaricReference.findOne({ clase: 'meta', codigo: 'controles' }).lean(),
    TaricReference.find({ clase: 'area', miembros: origen }, { codigo: 1 }).lean(),
    TaricReference.find({ clase: 'dobleUso', codigo: { $in: prefijosDe(limpio) } }).lean()
  ]);
  // Categorias de doble uso del codigo y de sus niveles superiores, sin repetir.
  const dobleUso = [];
  for (const c of correlaciones) {
    for (const e of c.datos?.entradas || []) {
      if (dobleUso.some((d) => d.categoria === e.categoria)) continue;
      // Encabezado oficial en espanol del articulo del anexo I del Reglamento (UE) 2021/821.
      dobleUso.push({ categoria: e.categoria, nota: e.nota, articulo: articuloDeCategoria(e.categoria), descripcion: descripcionDeCategoria(e.categoria) });
    }
  }
  dobleUso.sort((a, b) => a.categoria.localeCompare(b.categoria));
  const filas = await TaricControlMeasure.find({
    prefijo: { $in: prefijosDe(limpio) },
    origen: { $in: [origen, ...grupos.map((g) => g.codigo)] },
    excluidos: { $ne: origen }
  }).lean();

  const citados = [...new Set(filas.flatMap((m) => (m.condiciones || []).flatMap((g) => g.certificados || [])))];
  const descripciones = citados.length
    ? Object.fromEntries((await TaricReference.find({ clase: 'certificado', codigo: { $in: citados } }).lean()).map((c) => [c.codigo, c.descripcion]))
    : {};

  const vistas = new Set();
  const medidas = [];
  for (const m of filas) {
    const huella = [m.tipo, m.baseLegal, JSON.stringify(m.condiciones || [])].join('|');
    if (vistas.has(huella)) continue;
    vistas.add(huella);
    medidas.push({
      tipo: m.tipo,
      nombre: nombreDeTipo(m.tipo, m.tipoNombre),
      nombreOficial: m.tipoNombre,
      baseLegal: m.baseLegal,
      prohibicion: esProhibicion(m.tipo),
      // Regimen de sanciones de la UE al que pertenece la medida, si lo es.
      sancion: regimenDeSanciones(m.baseLegal),
      // Nombre oficial en espanol del pais o grupo (TARIC); si no lo hay, el del fichero.
      ambito: { codigo: m.codigo, origen: m.origen, origenNombre: nombreDeOrigen(m.origen, m.origenNombre) },
      condiciones: (m.condiciones || []).map((g) => ({
        grupo: g.grupo,
        certificados: (g.certificados || []).map((c) => ({ codigo: c, descripcion: descripciones[c] || null })),
        exenciones: g.exenciones || [],
        impideSinCertificado: !!g.impideSinCertificado
      }))
    });
  }
  // Primero las prohibiciones, luego las sanciones; despues, por tipo de medida.
  medidas.sort((a, b) => (Number(b.prohibicion) - Number(a.prohibicion)) || (Number(!!b.sancion) - Number(!!a.sancion)) || a.tipo.localeCompare(b.tipo));

  return {
    codigo: limpio,
    origen,
    fuente: meta?.datos ? { nombre: FUENTE, mes: meta.datos.mes, actualizado: meta.datos.actualizado } : null,
    medidas,
    // Posible doble uso (Reglamento (UE) 2021/821): orientativo, sobre todo para exportar.
    dobleUso,
    fuenteDobleUso: dobleUso.length ? fuenteDelAnexoI() : null
  };
}

module.exports = { controlesPara, FUENTE };
