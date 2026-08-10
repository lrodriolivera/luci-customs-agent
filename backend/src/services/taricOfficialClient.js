/**
 * Cliente de consulta del TARIC oficial (DDS2 de la Comision Europea).
 *
 * No hay API REST publica de TARIC: los datos brutos se distribuyen en Excel via
 * CIRCABC, que exige EU Login. Lo que si es accesible es el portal DDS2, pero la
 * pagina `measures.jsp` NO trae las medidas en el HTML: solo declara un <iframe>
 * cuyo `src` lleva un `Sid` firmado por el servidor. Sin ese Sid,
 * `measures_details.jsp` responde 500. Por eso la consulta son tres saltos:
 *
 *   1. GET measures.jsp        -> cookie de sesion + src del iframe (con el Sid)
 *   2. GET measures_details.jsp -> el HTML con las filas de medidas
 *   3. GET measures_conditions.jsp?MeasureSid=N -> los tipos cuando la medida es
 *      condicional (el importe NO esta en la fila, sino tras las condiciones)
 *
 * El paso 3 es imprescindible y es donde estaba el bug de los 426 aranceles al
 * 50%: para los productos del Reg. (UE) 2024/1392 el "Derecho terceros paises"
 * es una medida condicional cuyo 50% se aplica SOLO si se presenta el
 * certificado Y155 (mercancia exportada desde Rusia o Bielorrusia). El arancel
 * general es el de la rama sin Y155. Leyendo solo la fila se ve el 50% y se
 * confunde una sancion con el arancel normal.
 */
const https = require('https');

const BASE = 'https://ec.europa.eu/taxation_customs/dds2/taric/';
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const TIMEOUT_MS = 30000;

/** Certificado que marca la mercancia sancionada (Rusia/Bielorrusia). */
const CERTIFICADO_SANCION = 'Y155';

/**
 * Rotulos de TARIC que expresan el arancel aplicable a un tercer pais sin
 * preferencia. No es solo "Derecho terceros paises": para los codigos con uso
 * final vinculado (aceites tecnicos, piensos) el rotulo es "Derecho no
 * preferencial en regimen de destino final", y es el que da el tipo real.
 * Buscar solo el primero deja fuera capitulos enteros del catalogo.
 */
const ROTULOS_ARANCEL = [
  'Derecho terceros países',
  'Derecho no preferencial en régimen de destino final'
];

/**
 * Rotulo cuyo tipo NO es el derecho general: solo se aplica si el importador
 * tiene la autorizacion EUS de destino final (certificado N990). Son los
 * codigos NC acabados en 1000 de los capitulos de aceites (usos tecnicos o
 * industriales). Guardar ese tipo como derecho de terceros paises sin dejar
 * constancia seria el mismo error que el 50% de la sancion guardado como
 * arancel general, asi que se marca en la trazabilidad.
 */
const ROTULO_DESTINO_FINAL = 'Derecho no preferencial en régimen de destino final';

function get(url, cookie) {
  return new Promise((resolve, reject) => {
    const headers = { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' };
    if (cookie) headers.Cookie = cookie;

    const req = https.get(url, { timeout: TIMEOUT_MS, headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({
        status: res.statusCode,
        body,
        setCookie: res.headers['set-cookie']
      }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', (err) => reject(err));
  });
}

const aTexto = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Aplanado que conserva los limites de celda como `|`. Necesario para leer las
 * medidas de contingente: el tipo, el periodo y el numero de orden estan en
 * celdas contiguas, y con `aTexto` (que sustituye las etiquetas por espacios)
 * quedan indistinguibles del texto que los rodea.
 */
const aplanarMedidas = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, '|')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\|+/g, '|')
  .replace(/[^\S\n]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/** `DD-MM-AAAA` -> `AAAA-MM-DD`. `null` si no hay fecha (contingente abierto). */
function aFechaIso(texto) {
  const m = /(\d{2})-(\d{2})-(\d{4})/.exec(texto || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Primer importe de un fragmento de medida: `0 %`, `12.50 EUR / hl`.
 * La fuente separa la unidad con espacios ("EUR / hl") y aqui se normaliza a
 * "EUR/hl", que es como se guarda en el catalogo.
 */
function importeDeTexto(texto) {
  const m = /(-?[\d]+(?:[.,]\d+)?)\s*\|*\s*(%|EUR\s*\/\s*\w+|\w+\s*\/\s*\w+)/.exec(texto || '');
  if (!m) return null;
  return {
    valor: Number(m[1].replace(',', '.')),
    unidad: m[2].replace(/\s+/g, '')
  };
}

/**
 * Pide `measures.jsp` y devuelve la cookie de sesion y las URLs de detalle.
 *
 * OJO con de donde salen esas URLs: cuando el codigo tiene codigos adicionales,
 * el `src` del <iframe> es `iframes/empty_iframe.html` (un hueco que la pagina
 * rellena por JS) y las URLs reales de `measures_details.jsp` -cada una con su
 * propio `Sid`, que es lo que selecciona el codigo adicional- estan escritas en
 * el JS de la pagina. Leer solo el `src` dejaba sin medidas a 100 codigos de
 * vino del capitulo 22, que son justamente los que llevan codigo adicional.
 * Por eso se buscan en el cuerpo entero.
 */
async function abrirConsulta(taricCode, area) {
  const url = `${BASE}measures.jsp?Lang=es&SimDate=${fechaSim()}` +
    `&Area=${area || ''}&Taric=${taricCode}&LangDescr=es&Expand=true`;
  const res = await get(url);
  if (res.status !== 200) throw new Error(`measures.jsp HTTP ${res.status}`);

  const cookie = (res.setCookie || []).map((c) => c.split(';')[0]).join('; ');
  const iframes = [...new Set(
    [...res.body.matchAll(/measures_details\.jsp\?[^'"\s>]+/g)]
      .map((m) => m[0].replace(/&amp;/g, '&'))
  )].map((p) => (p.startsWith('http') ? p : BASE + p));

  // Los ids `<n>_iframe_content` van en el mismo orden que las URLs de detalle y
  // son los que dicen a que codigo de 10 digitos corresponde cada medida. Sin
  // esto no se puede saber que tipo pertenece a que codigo adicional, y las
  // variantes de un mismo codigo NC pueden diferir (2204211110: 13,10 EUR/hl
  // frente a 2204211190: 15,40 EUR/hl).
  const codigos = [...new Set(
    [...res.body.matchAll(/(\d{10})_iframe_content/g)].map((m) => m[1])
  )];

  return { cookie, iframes, codigos, html: res.body };
}

/**
 * Fecha de simulacion de TARIC (AAAAMMDD). TARIC devuelve las medidas vigentes
 * en esa fecha, asi que fijarla es lo que hace el volcado reproducible: la misma
 * consulta manana daria otras medidas si hay un reglamento nuevo.
 * `TARIC_SIM_DATE` permite reproducir un volcado anterior tal cual.
 */
function fechaSim() {
  if (process.env.TARIC_SIM_DATE) return process.env.TARIC_SIM_DATE;
  const hoy = new Date();
  return [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, '0'),
    String(hoy.getDate()).padStart(2, '0')
  ].join('');
}

/**
 * Extrae, de una fila de medida condicional, el tipo aplicable a la mercancia
 * NO sancionada. La rama con el certificado Y155 es la sancion.
 */
function separarCondiciones(textoCondiciones) {
  // Formato: "<rama> ... [certificado] ... [importe]" repetido, y al final una
  // leyenda que describe cada certificado.
  //
  // Dos trampas del formato real, ambas verificadas contra la fuente:
  //
  // 1. La leyenda ("Indicaciones especiales... Y155 Productos exportados...
  //    desde la Federacion de Rusia o Bielorrusia") va pegada a la ultima rama y
  //    contiene el propio Y155. Sin recortarla, la rama general se clasifica
  //    como sancionada y el arancel real se pierde.
  //
  // 2. Las ramas NO son siempre B1/B2. Cuando el codigo lleva ademas una
  //    condicion de destino final, la autorizacion EUS ocupa B1/B2 y el arancel
  //    pasa a C1/C2 (p.ej. 1507101000: C2 = 3,20%). Filtrar solo por B descarta
  //    el tipo y deja el codigo como irresoluble.
  const sinLeyenda = textoCondiciones
    .split(/Indicaciones especiales|Documentos presentados/i)[0];
  const tramos = sinLeyenda.split(/\b([A-Z]\d)\b/).filter(Boolean);
  const ramas = [];
  for (let i = 0; i < tramos.length - 1; i += 2) {
    const etiqueta = tramos[i];
    const cuerpo = tramos[i + 1] || '';
    const importe = cuerpo.match(/([0-9]+(?:[.,][0-9]+)?)\s*(%|EUR\s*\/\s*[^\s(]+|EUR)/i);
    if (!importe) continue;
    ramas.push({
      etiqueta,
      esSancion: /Y\s*155/i.test(cuerpo),
      valor: parseFloat(importe[1].replace(',', '.')),
      unidad: importe[2].replace(/\s+/g, '')
    });
  }
  return {
    general: ramas.find((r) => !r.esSancion) || null,
    sancion: ramas.find((r) => r.esSancion) || null,
    ramas
  };
}

/**
 * Consulta el derecho de terceros paises de un codigo TARIC.
 * Devuelve SIEMPRE el texto literal del que sale cada cifra, para que el dato
 * guardado sea auditable contra la fuente.
 */
async function consultarDerecho(taricCode, opciones = {}) {
  const area = opciones.area || 'US'; // pais no sancionado -> arancel general
  const { cookie, iframes, codigos } = await abrirConsulta(taricCode, area);

  if (iframes.length === 0) {
    return { code: taricCode, ok: false, motivo: 'sin_iframe_de_medidas' };
  }

  const medidas = [];
  // Un codigo con codigos adicionales abre un iframe por combinacion, y el
  // arancel puede no estar en el primero: hay que recorrerlos hasta encontrarlo.
  const aLeer = iframes.slice(0, opciones.maxIframes || 6);
  for (let idx = 0; idx < aLeer.length; idx++) {
    const src = aLeer[idx];
    const codigoVariante = codigos[idx] || null;
    const det = await get(src, cookie);
    if (det.status !== 200) {
      medidas.push({ error: `measures_details HTTP ${det.status}` });
      continue;
    }

    const patron = ROTULOS_ARANCEL
      .map((r) => r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const re = new RegExp(patron, 'gi');
    let m;
    while ((m = re.exec(det.body)) !== null) {
      const trozo = det.body.slice(m.index, m.index + 5000);
      const fila = aTexto(trozo.slice(0, 900));

      // Caso A: el importe viene en la propia fila ("... : 32.00 EUR / hl")
      const enLinea = fila.match(/:\s*([0-9]+(?:[.,][0-9]+)?)\s*(%|EUR\s*\/\s*[^\s(]+|EUR)/i);

      // Caso B: medida condicional -> hay que pedir las condiciones
      const sid = (trozo.match(/MeasureSid=(\d+)/) || [])[1];
      let condiciones = null;
      if (sid) {
        const rc = await get(
          `${BASE}measures_conditions.jsp?MeasureSid=${sid}&Lang=es&LangDescr=&SimDate=${fechaSim()}`,
          cookie
        );
        if (rc.status === 200) {
          const texto = aTexto(rc.body);
          condiciones = { texto, ...separarCondiciones(texto) };
        }
      }

      medidas.push({
        rotulo: m[0],
        codigoVariante,
        filaLiteral: fila.slice(0, 300),
        measureSid: sid || null,
        enLinea: enLinea
          ? { valor: parseFloat(enLinea[1].replace(',', '.')), unidad: enLinea[2].replace(/\s+/g, '') }
          : null,
        condiciones
      });
    }
  }

  return { code: taricCode, ok: true, area, medidas };
}

/**
 * Resuelve el arancel general (erga omnes, sin sanciones) de un codigo.
 * Devuelve `null` en `arancel` cuando la fuente no da un tipo explicito, para
 * que el llamante deje el dato intacto en vez de inventarlo.
 */
const claveArancel = (a) => (a?.adValorem !== undefined
  ? `${a.adValorem}%`
  : `${a?.specific?.amount} ${a?.specific?.unit}`);

const aArancel = (valor, unidad) => (unidad === '%'
  ? { adValorem: valor }
  : { specific: { amount: valor, unit: unidad } });

/**
 * Tipo aplicable a cada codigo adicional de un mismo codigo NC.
 * Un codigo con codigos adicionales NO tiene un unico derecho: el vino
 * 22042111 son dos codigos declarables con tipos distintos (2204211110 a
 * 13,10 EUR/hl y 2204211190 a 15,40 EUR/hl). Quedarse con el primero seria
 * repetir el error que este cliente viene a corregir, asi que se devuelven
 * todos y el llamante decide.
 */
function tiposPorVariante(consulta) {
  const porCodigo = new Map();
  for (const med of consulta.medidas || []) {
    if (!med.codigoVariante) continue;
    const g = med.condiciones?.general || med.enLinea;
    if (!g) continue;
    if (!porCodigo.has(med.codigoVariante)) {
      porCodigo.set(med.codigoVariante, {
        arancel: aArancel(g.valor, g.unidad),
        sancion: med.condiciones?.sancion
          ? { adValorem: med.condiciones.sancion.valor, certificado: CERTIFICADO_SANCION }
          : null,
        rotulo: med.rotulo || null,
        soloDestinoFinal: med.rotulo === ROTULO_DESTINO_FINAL,
        evidencia: (med.condiciones?.texto || med.filaLiteral || '').slice(0, 300)
      });
    }
  }
  return porCodigo;
}

function resolverArancelGeneral(consulta) {
  if (!consulta.ok) return { code: consulta.code, arancel: null, motivo: consulta.motivo };

  // Si el codigo se abre en varios codigos adicionales con tipos distintos, no
  // existe "el" arancel del codigo: hay que dejarlo sin tocar y exponer las
  // variantes, no promediar ni elegir una.
  const variantes = tiposPorVariante(consulta);
  const distintos = new Set([...variantes.values()].map((v) => claveArancel(v.arancel)));
  if (variantes.size > 1 && distintos.size > 1) {
    return {
      code: consulta.code,
      arancel: null,
      motivo: 'variantes_con_tipos_distintos',
      variantes: Object.fromEntries(
        [...variantes].map(([c, v]) => [c, {
          arancel: v.arancel,
          sancion: v.sancion,
          rotulo: v.rotulo,
          soloDestinoFinal: v.soloDestinoFinal
        }])
      )
    };
  }

  for (const med of consulta.medidas) {
    if (med.condiciones?.general) {
      const g = med.condiciones.general;
      return {
        code: consulta.code,
        arancel: g.unidad === '%' ? { adValorem: g.valor } : { specific: { amount: g.valor, unit: g.unidad } },
        sancion: med.condiciones.sancion
          ? { adValorem: med.condiciones.sancion.valor, certificado: CERTIFICADO_SANCION }
          : null,
        rotulo: med.rotulo || null,
        soloDestinoFinal: med.rotulo === ROTULO_DESTINO_FINAL,
        evidencia: med.condiciones.texto.slice(0, 300),
        motivo: 'condiciones_de_medida'
      };
    }
    if (med.enLinea) {
      const e = med.enLinea;
      return {
        code: consulta.code,
        arancel: e.unidad === '%' ? { adValorem: e.valor } : { specific: { amount: e.valor, unit: e.unidad } },
        sancion: null,
        rotulo: med.rotulo || null,
        soloDestinoFinal: med.rotulo === ROTULO_DESTINO_FINAL,
        evidencia: med.filaLiteral,
        motivo: 'fila_de_medida'
      };
    }
  }

  return { code: consulta.code, arancel: null, motivo: 'sin_tipo_explicito' };
}

/**
 * Medidas de contingente arancelario de un codigo, con su numero de orden y el
 * tipo aplicable dentro del contingente.
 *
 * El tipo in-quota NO lo publica la pagina de QUOTA (que solo da volumen y
 * saldo): solo aparece aqui, en la medida de TARIC. `quotaService.js` lo tenia
 * cableado a `inQuota: 0.00` para contingentes que ni existen, y de esa cifra
 * salia el "ahorro" que se le mostraba al usuario.
 *
 * Acepta el HTML de `measures_details.jsp` o el texto ya aplanado.
 */
function extraerContingentes(entrada) {
  const t = /<[a-z!]/i.test(entrada) ? aplanarMedidas(entrada) : String(entrada);
  const contingentes = [];

  const re = /Contingente arancelario (no preferencial|preferencial)\s*\|?\((\d{2}-\d{2}-\d{4})\s*-\s*(\d{2}-\d{2}-\d{4})?\)\|?([\s\S]{0,200}?)\(Número de orden:\s*\|?(\d{6})/g;

  for (const m of t.matchAll(re)) {
    const importe = importeDeTexto(m[4]);
    contingentes.push({
      orderNumber: m[5],
      preferential: m[1] === 'preferencial',
      startDate: aFechaIso(m[2]),
      endDate: aFechaIso(m[3]),
      // `null` si la medida no trae tipo legible: no se supone un 0%, que es
      // justo lo que hacia el catalogo cableado.
      inQuotaDuty: importe
        ? (importe.unidad === '%'
          ? { adValorem: importe.valor }
          : { specific: { amount: importe.valor, unit: importe.unidad } })
        : null
    });
  }

  return contingentes;
}

module.exports = {
  consultarDerecho,
  resolverArancelGeneral,
  tiposPorVariante,
  separarCondiciones,
  extraerContingentes,
  CERTIFICADO_SANCION,
  BASE
};
