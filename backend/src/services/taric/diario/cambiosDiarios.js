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
 * Cambios de codigos: solo las lineas declarables (sufijo 80) y su texto en
 * español. Un alta trae fecha de inicio; una baja, fecha de fin.
 */
function leerNomenclaturaDiaria(filas) {
  if (!filas || filas.length < 2) return [];
  const v = columnas(filas, { codigo: 'GOODS CODE', desde: 'START_DATE', hasta: 'END_DATE', idioma: 'LANG_COD', texto: 'DESCR_TEXT', accion: 'PUBLISH' });
  const cambios = [];
  for (const fila of filas.slice(1)) {
    const completo = v(fila, 'codigo').replace(/\D/g, '');
    if (completo.length !== 12 || completo.slice(10) !== SUFIJO_DECLARABLE || v(fila, 'idioma') !== 'ES') continue;
    const hasta = fechaOrdenable(v(fila, 'hasta'));
    const alta = v(fila, 'accion') === 'INSERT';
    cambios.push({
      clase: 'codigo',
      code: completo.slice(0, 10),
      accion: hasta ? 'baja' : (alta ? 'alta' : 'cambio'),
      desde: fechaOrdenable(v(fila, 'desde')),
      hasta,
      detalle: v(fila, 'texto').replace(/\s+/g, ' ')
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
