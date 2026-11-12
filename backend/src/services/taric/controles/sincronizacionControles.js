/**
 * Carga en Mongo las medidas de control de importacion del TARIC y sus tablas
 * de apoyo desde los ficheros mensuales de la Comision Europea (CIRCABC).
 * Sustituye el conjunto entero: los datos no se editan a mano.
 */
const logger = require('../../../config/logger');
const { leerPrimeraHoja } = require('../xlsxSimple');
const circabc = require('../circabcTaric');
const {
  leerMedidasControl, leerExclusiones, leerAreas, leerDescripciones, claveDeMedida
} = require('./medidasControl');
const { leerDobleUso } = require('./dobleUso');

const FICHEROS = {
  medidas: 'duties import 01-99.xlsx',
  exclusiones: 'measure exclusions.xlsx',
  areas: 'geographical areas composition.xlsx',
  certificados: 'box 44 codes of the sad.xlsx'
};
// Menos medidas que estas indica un fichero incompleto: no se sustituye nada.
const MINIMO_DE_MEDIDAS = 5000;
const TAMANO_DE_LOTE = 2000;

const etiquetaDeMes = (mes) => `${mes.anio}-${String(mes.mes).padStart(2, '0')}`;

/**
 * Ficheros del mes mas reciente que los tenga todos. Si `yaCargado(mes)` dice
 * que ese mes ya esta en Mongo, no descarga nada.
 */
async function ficherosDeControles({ yaCargado = () => false, ...opciones } = {}) {
  for (const mes of await circabc.mesesPublicados(opciones)) {
    const hijos = await circabc.hijos(mes.id, opciones);
    const buscar = (nombre) => hijos.find((f) => !f.carpeta && f.name.toLowerCase() === nombre);
    const hallados = Object.fromEntries(Object.entries(FICHEROS).map(([k, nombre]) => [k, buscar(nombre)]));
    if (!Object.values(hallados).every(Boolean)) continue;
    if (yaCargado(etiquetaDeMes(mes))) return { mes: etiquetaDeMes(mes), omitido: true };
    const contenido = {};
    for (const [k, fichero] of Object.entries(hallados)) contenido[k] = await circabc.descargar(fichero.id, opciones);
    return { mes: etiquetaDeMes(mes), ...contenido };
  }
  throw new Error('CIRCABC: ningún mes tiene todos los ficheros de medidas de control');
}

/** Documentos a guardar a partir de los ficheros (calculo puro). */
function prepararControles(ficheros, { fecha = new Date() } = {}) {
  const exclusiones = leerExclusiones(leerPrimeraHoja(ficheros.exclusiones));
  const medidas = leerMedidasControl(leerPrimeraHoja(ficheros.medidas), { fecha })
    .map((m) => ({ ...m, excluidos: exclusiones[claveDeMedida(m)] || [] }));
  const areas = leerAreas(leerPrimeraHoja(ficheros.areas));
  const todos = leerDescripciones(leerPrimeraHoja(ficheros.certificados), 'ES');
  const citados = new Set(medidas.flatMap((m) => m.condiciones.flatMap((g) => g.certificados)));
  const certificados = Object.fromEntries([...citados].filter((c) => todos[c]).map((c) => [c, todos[c]]));
  return { medidas, areas, certificados, certificadosSinDescripcion: [...citados].filter((c) => !todos[c]).sort() };
}

/**
 * Descarga y carga las medidas de control. Si el mes ya esta cargado no hace
 * nada (salvo `forzar`).
 *
 * @returns {Promise<{ omitido?: boolean, mes: string, medidas?: number, areas?: number, certificados?: number }>}
 */
async function sincronizarControles({
  TaricControlMeasure, TaricReference, descargar = ficherosDeControles, preparar = prepararControles, ahora = new Date(), forzar = false
} = {}) {
  const meta = await TaricReference.findOne({ clase: 'meta', codigo: 'controles' }).lean();
  const ficheros = await descargar({ yaCargado: (mes) => !forzar && meta?.datos?.mes === mes });
  const { mes } = ficheros;
  if (ficheros.omitido) return { omitido: true, mes };

  const { medidas, areas, certificados, certificadosSinDescripcion = [] } = preparar(ficheros, { fecha: ahora });
  if (medidas.length < MINIMO_DE_MEDIDAS) {
    throw new Error(`Solo ${medidas.length} medidas de control en el fichero de ${mes}: no se sustituye lo cargado`);
  }

  const lote = `${mes}@${ahora.toISOString()}`;
  for (let i = 0; i < medidas.length; i += TAMANO_DE_LOTE) {
    await TaricControlMeasure.insertMany(medidas.slice(i, i + TAMANO_DE_LOTE).map((m) => ({ ...m, lote })), { ordered: false });
  }
  await TaricControlMeasure.deleteMany({ lote: { $ne: lote } });

  await TaricReference.deleteMany({ clase: { $in: ['area', 'certificado'] } });
  await TaricReference.insertMany([
    ...Object.entries(areas).map(([codigo, miembros]) => ({ clase: 'area', codigo, miembros })),
    ...Object.entries(certificados).map(([codigo, descripcion]) => ({ clase: 'certificado', codigo, descripcion }))
  ], { ordered: false });

  const datos = {
    mes, lote, actualizado: ahora, medidas: medidas.length, areas: Object.keys(areas).length,
    certificados: Object.keys(certificados).length, certificadosSinDescripcion
  };
  await TaricReference.updateOne({ clase: 'meta', codigo: 'controles' }, { $set: { datos } }, { upsert: true });
  logger.info(`[TARIC] Medidas de control de ${mes} cargadas: ${medidas.length} medidas, ${datos.areas} grupos de países, ${datos.certificados} certificados`);
  return { mes, medidas: medidas.length, areas: datos.areas, certificados: datos.certificados };
}

// Carpeta «Dual use codes» de las tablas de correlacion del TARIC en CIRCABC.
const CARPETA_DOBLE_USO = 'c3d06bd7-6ef0-4771-bbd7-f92b976ae9a0';
// Menos codigos que estos indica una tabla incompleta: no se sustituye nada.
const MINIMO_DE_CODIGOS_DOBLE_USO = 1000;

/** Tabla de doble uso mas reciente publicada; si `yaCargado(id)` no la descarga. */
async function ficheroDobleUso({ yaCargado = () => false, ...opciones } = {}) {
  const tablas = (await circabc.hijos(CARPETA_DOBLE_USO, opciones))
    .filter((f) => !f.carpeta && /dual use/i.test(f.name) && /\.xlsx$/i.test(f.name))
    .sort((a, b) => String(b.modificado || '').localeCompare(String(a.modificado || '')) || b.name.localeCompare(a.name));
  const reciente = tablas[0];
  if (!reciente) throw new Error('CIRCABC: no hay ninguna tabla de doble uso publicada');
  if (yaCargado(reciente.id)) return { id: reciente.id, nombre: reciente.name, omitido: true };
  return { id: reciente.id, nombre: reciente.name, contenido: await circabc.descargar(reciente.id, opciones) };
}

/**
 * Carga la tabla de correlacion de doble uso. Si la publicada ya esta cargada
 * no hace nada (salvo `forzar`).
 */
async function sincronizarDobleUso({ TaricReference, descargar = ficheroDobleUso, leer = (contenido) => leerDobleUso(leerPrimeraHoja(contenido)), ahora = new Date(), forzar = false } = {}) {
  const meta = await TaricReference.findOne({ clase: 'meta', codigo: 'dobleUso' }).lean();
  const fichero = await descargar({ yaCargado: (id) => !forzar && meta?.datos?.id === id });
  if (fichero.omitido) return { omitido: true, tabla: fichero.nombre };

  const tabla = leer(fichero.contenido);
  const codigos = Object.keys(tabla);
  if (codigos.length < MINIMO_DE_CODIGOS_DOBLE_USO) {
    throw new Error(`Solo ${codigos.length} códigos en la tabla de doble uso «${fichero.nombre}»: no se sustituye lo cargado`);
  }
  await TaricReference.deleteMany({ clase: 'dobleUso' });
  for (let i = 0; i < codigos.length; i += TAMANO_DE_LOTE) {
    await TaricReference.insertMany(
      codigos.slice(i, i + TAMANO_DE_LOTE).map((codigo) => ({ clase: 'dobleUso', codigo, datos: { entradas: tabla[codigo] } })),
      { ordered: false }
    );
  }
  await TaricReference.updateOne(
    { clase: 'meta', codigo: 'dobleUso' },
    { $set: { datos: { id: fichero.id, tabla: fichero.nombre, codigos: codigos.length, actualizado: ahora } } },
    { upsert: true }
  );
  logger.info(`[TARIC] Tabla de doble uso cargada: «${fichero.nombre}», ${codigos.length} códigos`);
  return { tabla: fichero.nombre, codigos: codigos.length };
}

module.exports = {
  sincronizarControles, prepararControles, ficherosDeControles, FICHEROS, MINIMO_DE_MEDIDAS,
  sincronizarDobleUso, ficheroDobleUso, MINIMO_DE_CODIGOS_DOBLE_USO
};
