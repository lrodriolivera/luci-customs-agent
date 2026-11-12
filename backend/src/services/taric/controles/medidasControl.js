/**
 * Medidas de control de importacion del TARIC (no arancelarias): control
 * veterinario, fitosanitario, CITES, residuos, REACH, prohibiciones,
 * restricciones por sanciones... y los certificados que exige cada una.
 *
 * Salen del fichero oficial «Duties Import 01-99.xlsx» de la Comision
 * Europea: en estas medidas la columna «Duty» no trae un derecho, sino las
 * condiciones, p. ej. «Cond:  B cert: C-640 (29):; B cert: Y-072 (29):; B (09):».
 *
 * Aqui solo hay calculo puro: leer las filas y decidir que medidas alcanzan a
 * un codigo y un pais de origen.
 */

// Acciones que cierran un grupo de condiciones cuando no se presenta nada.
const ACCIONES_QUE_IMPIDEN = new Set(['04', '06', '08', '09']);
// Tipos del bloque 4xx que no son controles sino precios de referencia.
const TIPOS_DE_PRECIO = new Set(['488', '489', '490']);

/** Tipos de medida que son controles, restricciones o prohibiciones. */
function esMedidaDeControl(tipo) {
  const t = String(tipo || '');
  if (t === '277') return true;
  if (t.startsWith('7')) return true;
  return t.startsWith('4') && !TIPOS_DE_PRECIO.has(t);
}

/** «01-11-2026» -> «20261101»; cadena vacia si no hay fecha. */
function fechaOrdenable(texto) {
  const m = /^(\d{2})-(\d{2})-(\d{4})/.exec(String(texto || '').trim());
  return m ? `${m[3]}${m[2]}${m[1]}` : '';
}

function hoyOrdenable(fecha = new Date()) {
  return fecha.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Parte del codigo que comparten todos sus descendientes: el codigo sin los
 * pares de ceros finales («0201000000» -> «0201», «0208402000» -> «02084020»).
 */
function prefijoDe(codigo) {
  let p = String(codigo || '').replace(/\D/g, '');
  while (p.length > 2 && p.endsWith('00')) p = p.slice(0, -2);
  return p;
}

/** Prefijos de los que puede colgar un codigo: «0201», «020110»... */
function prefijosDe(codigo) {
  const limpio = String(codigo || '').replace(/\D/g, '').padEnd(10, '0').slice(0, 10);
  const prefijos = [];
  for (let n = 2; n <= 10; n += 2) prefijos.push(limpio.slice(0, n));
  return prefijos;
}

/**
 * Condiciones de una medida. Cada grupo (B, Y, YA...) se cumple presentando
 * UNO de sus certificados; si la medida tiene varios grupos hay que cumplirlos
 * todos. Un grupo puede admitir tambien una exencion por cantidad.
 *
 * @returns {Array<{ grupo: string, certificados: string[], exenciones: Array<{cantidad:number, unidad:string}>, impideSinCertificado: boolean }>}
 */
function interpretarCondiciones(texto) {
  const cuerpo = String(texto || '').replace(/^\s*Cond:\s*/i, '');
  if (!cuerpo.trim() || !/\(\d\d\)/.test(cuerpo)) return [];
  const grupos = new Map();
  for (const trozo of cuerpo.split(';')) {
    const m = /^\s*([A-Z]{1,2})\s+(?:cert:\s*([A-Z])-?(\d{3})\s*)?(?:([\d.]+)\s*(?:EUR\s*)?\/?\s*([A-Z]{3})?\s*)?\((\d\d)\):?\s*$/.exec(trozo);
    if (!m) continue;
    const [, letra, familia, numero, cantidad, unidad, accion] = m;
    if (!grupos.has(letra)) grupos.set(letra, { grupo: letra, certificados: [], exenciones: [], impideSinCertificado: false });
    const grupo = grupos.get(letra);
    if (familia) {
      const codigo = `${familia}${numero}`;
      if (!grupo.certificados.includes(codigo)) grupo.certificados.push(codigo);
    } else if (cantidad && unidad) {
      grupo.exenciones.push({ cantidad: Number(cantidad), unidad });
    } else if (ACCIONES_QUE_IMPIDEN.has(accion)) {
      grupo.impideSinCertificado = true;
    }
  }
  return [...grupos.values()].filter((g) => g.certificados.length > 0);
}

/**
 * Medidas de control vigentes en una fecha, a partir de las filas del fichero
 * (la primera es la cabecera).
 */
function leerMedidasControl(filas, { fecha = new Date() } = {}) {
  const cabecera = (filas[0] || []).map((c) => String(c).trim());
  const col = (nombre) => cabecera.indexOf(nombre);
  const c = {
    codigo: col('Goods code'), adicional: col('Add code'), orden: col('Order No.'), desde: col('Start date'), hasta: col('End date'),
    origenNombre: col('Origin'), tipoNombre: col('Measure type'), base: col('Legal base'), condiciones: col('Duty'),
    origen: col('Origin code'), tipo: col('Meas. type code')
  };
  if (c.codigo < 0 || c.tipo < 0 || c.origen < 0) throw new Error('El fichero de medidas no tiene las columnas esperadas');
  const hoy = hoyOrdenable(fecha);
  const valor = (fila, k) => (k >= 0 && fila[k] != null ? String(fila[k]).trim() : '');
  const medidas = [];
  for (const fila of filas.slice(1)) {
    const tipo = valor(fila, c.tipo);
    if (!esMedidaDeControl(tipo)) continue;
    const desde = fechaOrdenable(valor(fila, c.desde));
    const hasta = fechaOrdenable(valor(fila, c.hasta));
    if ((desde && desde > hoy) || (hasta && hasta < hoy)) continue;
    const codigo = valor(fila, c.codigo);
    medidas.push({
      codigo,
      prefijo: prefijoDe(codigo),
      codigoAdicional: valor(fila, c.adicional),
      origen: valor(fila, c.origen),
      origenNombre: valor(fila, c.origenNombre),
      tipo,
      tipoNombre: valor(fila, c.tipoNombre),
      baseLegal: valor(fila, c.base),
      desde,
      hasta,
      condiciones: interpretarCondiciones(valor(fila, c.condiciones))
    });
  }
  return medidas;
}

/** Clave que identifica una medida en los ficheros de exclusiones y de notas. */
const claveDeMedida = (m) => [m.codigo, m.codigoAdicional || '', m.origen, m.tipo].join('|');

/** { clave de medida: [paises excluidos] } a partir de «Measure exclusions.xlsx». */
function leerExclusiones(filas) {
  const cabecera = (filas[0] || []).map((c) => String(c).trim());
  const k = { codigo: cabecera.indexOf('Goods code'), adicional: cabecera.indexOf('Add code'), origen: cabecera.indexOf('Origin code'),
    tipo: cabecera.indexOf('Meas. type code'), pais: cabecera.indexOf('Excluded country') };
  if (k.codigo < 0 || k.pais < 0) throw new Error('El fichero de exclusiones no tiene las columnas esperadas');
  const exclusiones = {};
  for (const fila of filas.slice(1)) {
    const v = (i) => (fila[i] != null ? String(fila[i]).trim() : '');
    if (!esMedidaDeControl(v(k.tipo)) || !v(k.pais)) continue;
    const clave = [v(k.codigo), v(k.adicional), v(k.origen), v(k.tipo)].join('|');
    (exclusiones[clave] = exclusiones[clave] || []).push(v(k.pais));
  }
  return exclusiones;
}

/** { grupo: [paises] } a partir de «Geographical areas composition.xlsx» (miembros vigentes). */
function leerAreas(filas) {
  const cabecera = (filas[0] || []).map((c) => String(c).trim());
  const grupo = cabecera.indexOf('Country group');
  const pais = cabecera.indexOf('Member country');
  const fin = cabecera.indexOf('Mbship end date');
  if (grupo < 0 || pais < 0) throw new Error('El fichero de áreas geográficas no tiene las columnas esperadas');
  const areas = {};
  for (const fila of filas.slice(1)) {
    if (fin >= 0 && fila[fin] && String(fila[fin]).trim()) continue;
    const g = String(fila[grupo] || '').trim();
    const p = String(fila[pais] || '').trim();
    if (!g || !p) continue;
    (areas[g] = areas[g] || []).push(p);
  }
  return areas;
}

/** { codigo: descripcion } en un idioma, de «Box 44 codes of the SAD.xlsx» o de las notas. */
function leerDescripciones(filas, idioma = 'ES') {
  const descripciones = {};
  for (const fila of filas.slice(1)) {
    if (String(fila[1] || '').trim() !== idioma) continue;
    // La ultima columna es la fecha de fin: una descripcion caducada no vale.
    if (fila[5] && String(fila[5]).trim()) continue;
    const codigo = String(fila[0] || '').trim();
    const texto = String(fila[2] || '').replace(/\s+/g, ' ').trim();
    if (codigo && texto) descripciones[codigo] = texto;
  }
  return descripciones;
}

/** Grupos de paises a los que pertenece un pais. */
function gruposDe(pais, areas) {
  return Object.keys(areas || {}).filter((g) => areas[g].includes(pais));
}

/**
 * Medidas que alcanzan a un codigo y a un pais de origen: las del propio
 * codigo y las de sus niveles superiores, dirigidas al pais o a un grupo que
 * lo contiene, y de las que el pais no este excluido.
 */
function medidasPara(codigo, pais, medidas, { areas = {}, exclusiones = {} } = {}) {
  const prefijos = new Set(prefijosDe(codigo));
  const origen = String(pais || '').trim().toUpperCase();
  const origenes = new Set([origen, ...gruposDe(origen, areas)]);
  const vistas = new Set();
  return medidas.filter((m) => {
    if (!prefijos.has(m.prefijo) || !origenes.has(m.origen)) return false;
    if ((exclusiones[claveDeMedida(m)] || m.excluidos || []).includes(origen)) return false;
    const huella = [m.tipo, m.baseLegal, JSON.stringify(m.condiciones)].join('|');
    if (vistas.has(huella)) return false;
    vistas.add(huella);
    return true;
  });
}

module.exports = {
  esMedidaDeControl, interpretarCondiciones, leerMedidasControl, leerExclusiones, leerAreas, leerDescripciones,
  medidasPara, prefijoDe, prefijosDe, gruposDe, claveDeMedida, fechaOrdenable
};
