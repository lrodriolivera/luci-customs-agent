/**
 * Cambios del TARIC que la Comision Europea publica cada dia habil (ZIP de
 * `daily_publications.jsp`): altas, cambios y bajas de codigos y de medidas,
 * con su fecha de entrada en vigor.
 *
 * Aqui solo se leen los ficheros y se queda lo que afecta a LUCI: codigos (con
 * su descripcion en español), derecho de terceros paises y de destino final, y
 * medidas de control. Las preferencias y los contingentes, que son la mayoria
 * de cada publicacion, se cuentan pero no se detallan.
 */
const { esMedidaDeControl } = require('../controles/medidasControl');

const TIPOS_DE_DERECHO = new Set(['103', '105']);
const ERGA_OMNES = '1011';
const SUFIJO_DECLARABLE = '80';

/** «18/11/2026 00:00» -> «20261118»; cadena vacia si no hay fecha. */
function fechaOrdenable(texto) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(texto || '').trim());
  return m ? `${m[3]}${m[2]}${m[1]}` : '';
}

function columnas(filas, nombres) {
  const cabecera = (filas[0] || []).map((c) => String(c).trim());
  const indices = Object.fromEntries(Object.entries(nombres).map(([clave, nombre]) => [clave, cabecera.indexOf(nombre)]));
  const faltan = Object.entries(indices).filter(([, i]) => i < 0).map(([clave]) => nombres[clave]);
  if (faltan.length > 0) throw new Error(`El fichero diario no tiene las columnas esperadas: ${faltan.join(', ')}`);
  return (fila, clave) => (fila[indices[clave]] != null ? String(fila[indices[clave]]).trim() : '');
}

/**
 * Cambios de codigos: solo las lineas declarables (sufijo 80), con su texto en
 * español y en ingles y su nivel (HIER_POS). Un alta (INSERT) trae fecha de
 * inicio y, si su vigencia es limitada, tambien de fin; una baja es un cambio
 * que fija la fecha de fin.
 *
 * El fichero real puede dar de alta un codigo con el español vacio y traer el
 * texto mas abajo en una linea UPDATE sin fechas (TARIC_20261106_1917,
 * 3908100010): esa linea completa el alta y no es un cambio aparte.
 */
function leerNomenclaturaDiaria(filas) {
  if (!filas || filas.length < 2) return [];
  const v = columnas(filas, {
    codigo: 'GOODS CODE', desde: 'START_DATE', hasta: 'END_DATE', idioma: 'LANG_COD', nivel: 'HIER_POS', texto: 'DESCR_TEXT', accion: 'PUBLISH'
  });
  const lineas = filas.slice(1).map((fila) => ({
    completo: v(fila, 'codigo').replace(/\D/g, ''), idioma: v(fila, 'idioma'), accion: v(fila, 'accion'),
    desde: fechaOrdenable(v(fila, 'desde')), hasta: fechaOrdenable(v(fila, 'hasta')),
    nivel: Number(v(fila, 'nivel')) || undefined, texto: v(fila, 'texto').replace(/\s+/g, ' ').trim()
  })).filter((l) => l.completo.length === 12 && l.completo.slice(10) === SUFIJO_DECLARABLE);

  const esAlta = (l) => l.accion === 'INSERT';
  const soloTexto = (l) => l.accion === 'UPDATE' && !l.desde && !l.hasta;
  const conAlta = new Set(lineas.filter(esAlta).map((l) => l.completo));
  // Ultimo texto no vacio de cada codigo e idioma en el fichero.
  const textos = new Map();
  for (const l of lineas) if (l.texto) textos.set(`${l.completo}|${l.idioma}`, l.texto);

  const cambios = [];
  for (const l of lineas) {
    if (l.idioma !== 'ES') continue;
    if (soloTexto(l) && conAlta.has(l.completo)) continue;
    const alta = esAlta(l);
    const detalleEn = textos.get(`${l.completo}|EN`);
    cambios.push({
      clase: 'codigo',
      code: l.completo.slice(0, 10),
      accion: alta ? 'alta' : (l.hasta ? 'baja' : 'cambio'),
      desde: l.desde,
      hasta: l.hasta,
      detalle: alta ? (textos.get(`${l.completo}|ES`) || '') : l.texto,
      ...(detalleEn ? { detalleEn } : {}),
      ...(l.nivel ? { nivel: l.nivel } : {})
    });
  }
  return cambios;
}

/**
 * Cambios de medidas que afectan a LUCI: derecho de terceros paises y de
 * destino final (ERGA OMNES) y medidas de control. Devuelve tambien cuantas
 * medidas de otros tipos traia la publicacion.
 */
function leerMedidasDiarias(filas) {
  if (!filas || filas.length < 2) return { cambios: [], otras: 0 };
  const v = columnas(filas, {
    codigo: 'GOODS CODE', desde: 'START_DATE', hasta: 'END_DATE', norma: 'REGULATION', derecho: 'DUTY', origen: 'GEOGR_AREA', tipo: 'MEAS_TYP_ID', accion: 'PUBLISH'
  });
  const cambios = [];
  let otras = 0;
  for (const fila of filas.slice(1)) {
    const tipo = v(fila, 'tipo');
    const comun = {
      code: v(fila, 'codigo').replace(/\D/g, '').slice(0, 10), tipo, origen: v(fila, 'origen'),
      accion: { INSERT: 'alta', UPDATE: 'cambio', DELETE: 'baja' }[v(fila, 'accion')] || v(fila, 'accion').toLowerCase(),
      desde: fechaOrdenable(v(fila, 'desde')), hasta: fechaOrdenable(v(fila, 'hasta')), norma: v(fila, 'norma')
    };
    if (TIPOS_DE_DERECHO.has(tipo) && comun.origen === ERGA_OMNES) {
      cambios.push({ clase: 'derecho', ...comun, detalle: v(fila, 'derecho').replace(/\s+/g, ' ') });
    } else if (esMedidaDeControl(tipo)) {
      cambios.push({ clase: 'control', ...comun, detalle: '' });
    } else {
      otras += 1;
    }
  }
  return { cambios, otras };
}

/** ¿Esta en vigor un cambio en una fecha («AAAAMMDD»)? */
const enVigor = (cambio, hoy) => (!cambio.desde || cambio.desde <= hoy) && (!cambio.hasta || cambio.hasta >= hoy);

module.exports = { leerNomenclaturaDiaria, leerMedidasDiarias, fechaOrdenable, enVigor };
