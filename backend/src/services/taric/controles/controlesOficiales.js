/**
 * Consulta de las medidas de control de importacion que el TARIC aplica a un
 * codigo y a un pais de origen, con los certificados que exige cada una.
 */
const { prefijosDe } = require('./medidasControl');
const { nombreDeTipo, esProhibicion } = require('./tiposDeMedida');

const FUENTE = 'Comisión Europea - TARIC (CIRCABC)';

function modelosPorDefecto() {
  return {
    TaricControlMeasure: require('../../../models/TaricControlMeasure'),
    TaricReference: require('../../../models/TaricReference')
  };
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

  const [meta, grupos] = await Promise.all([
    TaricReference.findOne({ clase: 'meta', codigo: 'controles' }).lean(),
    TaricReference.find({ clase: 'area', miembros: origen }, { codigo: 1 }).lean()
  ]);
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
      ambito: { codigo: m.codigo, origen: m.origen, origenNombre: m.origenNombre },
      condiciones: (m.condiciones || []).map((g) => ({
        grupo: g.grupo,
        certificados: (g.certificados || []).map((c) => ({ codigo: c, descripcion: descripciones[c] || null })),
        exenciones: g.exenciones || [],
        impideSinCertificado: !!g.impideSinCertificado
      }))
    });
  }
  // Primero las prohibiciones; despues, por tipo de medida.
  medidas.sort((a, b) => (Number(b.prohibicion) - Number(a.prohibicion)) || a.tipo.localeCompare(b.tipo));

  return {
    codigo: limpio,
    origen,
    fuente: meta?.datos ? { nombre: FUENTE, mes: meta.datos.mes, actualizado: meta.datos.actualizado } : null,
    medidas
  };
}

module.exports = { controlesPara, FUENTE };
