/**
 * Cliente del sistema QUOTA de la Comision Europea (DDS2).
 *
 * QUE PROBLEMA RESUELVE
 * ---------------------
 * `quotaService.js` llevaba 11 contingentes con el volumen, el consumo y el
 * saldo escritos a mano. Contrastados contra la base oficial: 10 de los 11
 * numeros de orden NO EXISTEN en ningun ano (2019-2027), y el unico que existe
 * (090101) es "Productos de seda o de algodon tejidos en telares a mano" con
 * saldo en EURO, no los "Platanos" en kg del catalogo local. Es decir, no
 * bastaba con refrescar los saldos: el catalogo entero estaba inventado.
 *
 * La base real publica ~1.960 filas para 2026, con volumen inicial, saldo,
 * criticidad, fecha de agotamiento (cuando existe) y los codigos TARIC
 * asociados de cada una. Un mismo numero de orden aparece varias veces cuando
 * tiene varios periodos de validez, asi que los numeros de orden distintos son
 * menos que las filas.
 *
 * CADENA DE PETICIONES
 * --------------------
 * 1. `quota_consultation.jsp` -> cookie de sesion (sin ella el resto responde
 *    500). Hay que mandar tambien el `Referer`.
 * 2. `quota_list.jsp?Lang=es&Year=AAAA[&Code=NNNNNN][&Offset=N]` -> listado.
 *    El parametro `Year` es OBLIGATORIO: sin el la respuesta es un 500, no una
 *    lista de todos los anos. Pagina de 20 en 20 con `Offset`.
 * 3. `quota_tariff_details.jsp?Lang=es&Code=NNNNNN&StartDate=AAAA-MM-DD` ->
 *    detalle. `StartDate` es la fecha de inicio que da el listado.
 *
 * QUE NO HACE
 * -----------
 * No deduce nada que la fuente no publique. Si no hay volumen, no hay consumo
 * ni porcentaje; si no hay fecha de agotamiento, es `null`. La criticidad se
 * toma del campo "Critico" de TARIC, que responde a las reglas de la Comision y
 * no a un umbral de consumo inventado aqui.
 *
 * AVISO DE DESPLIEGUE: el homelab no tiene salida directa a internet en los
 * contenedores. Este cliente funciona (comprobado), pero cualquier uso en
 * caliente debe tolerar el fallo de red y no presentar un timeout como "sin
 * contingente".
 */
const https = require('https');

const BASE = 'https://ec.europa.eu/taxation_customs/dds2/taric/';
const REFERER = `${BASE}quota_consultation.jsp?Lang=es`;
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const TIMEOUT_MS = 60000;
const POR_PAGINA = 20;

function get(url, cookie) {
  return new Promise((resolve, reject) => {
    const headers = { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*', Referer: REFERER };
    if (cookie) headers.Cookie = cookie;

    const req = https.get(url, { timeout: TIMEOUT_MS, headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({
        status: res.statusCode,
        body,
        cookies: res.headers['set-cookie'] || []
      }));
    });
    req.on('timeout', () => { req.destroy(new Error(`timeout tras ${TIMEOUT_MS}ms`)); });
    req.on('error', reject);
  });
}

/** Aplana el HTML a texto separando celdas con `|`, como se lee en la fuente. */
const aplanar = (html) => html
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<[^>]+>/g, '|')
  .replace(/&nbsp;/g, ' ')
  .replace(/\|+/g, '|')
  .replace(/\s+/g, ' ')
  .trim();

/** `DD-MM-AAAA` -> `AAAA-MM-DD`. Devuelve null si no es una fecha. */
function aIso(texto) {
  const m = /(\d{2})-(\d{2})-(\d{4})/.exec(texto || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Separa el importe de su unidad. La fuente escribe la celda con saltos de
 * linea y tabulaciones ("27624751.299 \n\t Kilogram") y la unidad puede llevar
 * varias palabras ("Cubic metre").
 */
function parsearImporte(celda) {
  const limpio = String(celda || '').replace(/\s+/g, ' ').trim();
  const m = /^(-?[\d.]+)\s*(.*)$/.exec(limpio);
  if (!m || m[1] === '' || Number.isNaN(Number(m[1]))) return null;
  return { amount: Number(m[1]), unit: m[2].trim() || null };
}

/** Filas del listado de `quota_list.jsp`. */
function parsearListado(html) {
  const ini = html.indexOf('<tbody');
  const fin = html.indexOf('</tbody>');
  if (ini < 0 || fin < 0) return [];

  const cuerpo = html.slice(ini, fin);
  const filas = [];

  for (const tr of cuerpo.matchAll(/<tr[\s\S]*?<\/tr>/g)) {
    const celdas = {};
    for (const td of tr[0].matchAll(/data-ecl-table-header="([^"]*)"[^>]*>([\s\S]*?)<\/td>/g)) {
      celdas[td[1].trim()] = td[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    }

    const orderNumber = Object.values(celdas).find((v) => /^\d{6}$/.test(v));
    if (!orderNumber) continue;

    filas.push({
      orderNumber,
      origins: celdas['Origenes'] || null,
      startDate: aIso(celdas['Fecha de inicio']),
      endDate: aIso(celdas['Fecha de finalización']),
      balance: parsearImporte(celdas['Saldo'])
    });
  }

  return filas;
}

/** Valor de un campo etiquetado de la pagina de detalle, ya aplanada. */
function campo(texto, etiqueta) {
  // El valor va tras la etiqueta separado por celdas vacias; se corta en la
  // siguiente etiqueta para no arrastrar el campo de al lado.
  const re = new RegExp(`${etiqueta}\\s*\\|[\\s|]*([^|]*)`);
  const m = re.exec(texto);
  return m ? m[1].trim() : '';
}

/** Detalle de `quota_tariff_details.jsp`. Acepta el HTML o el texto aplanado. */
function parsearDetalle(entrada) {
  const t = /<[a-z!]/i.test(entrada) ? aplanar(entrada) : String(entrada);

  const initialVolume = parsearImporte(campo(t, 'Volumen inicial'));
  const balance = parsearImporte(campo(t, 'Saldo'));

  // El consumo no lo publica la fuente: es volumen inicial menos saldo. Si
  // falta cualquiera de los dos se deja en null en vez de estimarlo.
  const hayAmbos = initialVolume && balance && initialVolume.amount > 0;
  const used = hayAmbos ? initialVolume.amount - balance.amount : null;
  const utilizationPercent = hayAmbos
    ? Number(((used / initialVolume.amount) * 100).toFixed(2))
    : null;

  const critico = campo(t, 'Crítico');
  const periodo = campo(t, 'Periodo de validez');
  const fechas = [...periodo.matchAll(/(\d{2}-\d{2}-\d{4})/g)].map((m) => aIso(m[1]));

  const codigos = (/Códigos TARIC asociados([\s\S]*)$/.exec(t) || [])[1] || '';

  return {
    orderNumber: (/^\d{6}$/.test(campo(t, 'Número de orden')) ? campo(t, 'Número de orden') : null),
    origins: campo(t, 'Orígenes') || null,
    startDate: fechas[0] || null,
    endDate: fechas[1] || null,
    initialVolume,
    balance,
    used,
    utilizationPercent,
    // Criticidad declarada por TARIC. No es un umbral de consumo: la Comision
    // marca critico un contingente por sus propias reglas de gestion.
    critical: /^s[ií]$/i.test(critico),
    exhaustionDate: aIso(campo(t, 'Fecha de agotamiento')),
    lastImportDate: aIso(campo(t, 'Ultima fecha de importación')),
    lastAllocationDate: aIso(campo(t, 'Fecha de la última atribución')),
    // La fuente los agrupa ("0302 41 00 00"); el catalogo usa 10 digitos juntos.
    taricCodes: [...codigos.matchAll(/(\d{4}\s\d{2}\s\d{2}\s\d{2})/g)]
      .map((m) => m[1].replace(/\s/g, ''))
  };
}

/** Cookie de sesion. Sin ella `quota_list.jsp` responde 500. */
async function abrirSesion() {
  const res = await get(REFERER);
  const cookie = res.cookies.map((c) => c.split(';')[0]).join('; ');
  if (!cookie) throw new Error('QUOTA no devolvio cookie de sesion');
  return cookie;
}

/**
 * Peticion que sobrevive a la caducidad de la sesion.
 *
 * La fuente contesta 302 a la pagina de consulta cuando la cookie ya no vale, lo
 * que en una tirada larga pasa constantemente. Se reabre la sesion y se repite la
 * peticion una vez. Devuelve tambien la cookie en uso para que el llamante siga
 * con la nueva y no vuelva a pedir con la muerta.
 *
 * Solo el 302/303 se reintenta: un 500 es otra cosa y debe propagarse.
 */
async function getConSesion(url, cookie) {
  let enUso = cookie || await abrirSesion();
  let res = await get(url, enUso);

  if (res.status === 302 || res.status === 303) {
    enUso = await abrirSesion();
    res = await get(url, enUso);
  }

  return { res, cookie: enUso };
}

/**
 * Consulta un numero de orden concreto. Devuelve `null` cuando la fuente no lo
 * tiene: un contingente inexistente responde 200 con la tabla vacia, y
 * confundirlo con un fallo de red haria creer que el dato existe.
 *
 * Devuelve la cookie en `cookieEnUso` porque puede haber renovado la sesion: el
 * llamante que siga usando la vieja se llevara un 302 en cada peticion. Medido:
 * el script de sincronizacion pedia la cookie una sola vez al arrancar y a partir
 * de la caducidad fallaba TODO (16 de 50 contingentes seguidos), con el reintento
 * repitiendo la misma cookie muerta.
 */
async function consultarContingente(orderNumber, year, cookieDada) {
  const url = `${BASE}quota_list.jsp?Lang=es&Code=${orderNumber}&Year=${year}&Expand=true`;
  const listado = await getConSesion(url, cookieDada);
  if (listado.res.status !== 200) throw new Error(`quota_list.jsp devolvio ${listado.res.status}`);

  const filas = parsearListado(listado.res.body);
  if (!filas.length) return null;

  const fila = filas[0];
  const detalle = await getConSesion(
    `${BASE}quota_tariff_details.jsp?Lang=es&Code=${orderNumber}&StartDate=${fila.startDate}`,
    listado.cookie
  );
  if (detalle.res.status !== 200) throw new Error(`quota_tariff_details.jsp devolvio ${detalle.res.status}`);

  return {
    ...parsearDetalle(detalle.res.body),
    consultadoEl: new Date().toISOString(),
    year,
    cookieEnUso: detalle.cookie
  };
}

/**
 * Listado completo de un ano, paginando con `Offset`. En 2026 son ~1.960 filas
 * (unos 98 paginas de 20), asi que esto es para poblar el catalogo, no para el
 * camino caliente.
 *
 * DOS TRAMPAS DE LA FUENTE, COMPROBADAS SONDEANDO
 * ----------------------------------------------
 * 1. La sesion se cae a mitad de una tirada larga: la peticion responde 302 a la
 *    pagina de consulta. Se reabre la sesion y se repite el offset. Si eso se
 *    tratara como error fatal (lo que hacia antes), la tirada moria a la pagina
 *    59 y el catalogo quedaba a medias sin que nadie lo notara.
 * 2. Una pagina entera puede ser todo numeros de orden ya vistos, porque un
 *    contingente con varios periodos de validez ocupa una fila por periodo. Ese
 *    no es el final del listado: cortar ahi devolvia 1.125 de las ~1.960 filas.
 *    El final se reconoce por una pagina SIN FILAS.
 */
async function listarAno(year, opciones = {}) {
  let cookie = opciones.cookie || await abrirSesion();
  const tope = opciones.maxPaginas || 200;
  const filasTodas = [];

  for (let pagina = 0; pagina < tope; pagina++) {
    const offset = pagina * POR_PAGINA;
    const url = `${BASE}quota_list.jsp?Lang=es&Year=${year}&Expand=true&Offset=${offset}`;

    const intento = await getConSesion(url, cookie);
    cookie = intento.cookie;
    const res = intento.res;
    if (res.status !== 200) throw new Error(`quota_list.jsp devolvio ${res.status} en offset ${offset}`);

    const filas = parsearListado(res.body);
    // Unico corte fiable: la fuente deja de devolver filas.
    if (!filas.length) break;

    filasTodas.push(...filas);
  }

  // Se devuelve una entrada por numero de orden, quedandose con el periodo mas
  // reciente: es el que decide el saldo que se puede pedir hoy.
  const porOrden = new Map();
  for (const fila of filasTodas) {
    const previa = porOrden.get(fila.orderNumber);
    if (!previa || (fila.startDate || '') > (previa.startDate || '')) {
      porOrden.set(fila.orderNumber, fila);
    }
  }

  return [...porOrden.values()];
}

module.exports = {
  parsearImporte,
  parsearListado,
  parsearDetalle,
  consultarContingente,
  listarAno,
  abrirSesion
};
