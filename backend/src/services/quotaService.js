/**
 * Contingentes Arancelarios (TRQ) — sobre el catalogo oficial de la Comision.
 *
 * QUE ESTABA MAL
 * --------------
 * Este servicio llevaba 11 contingentes escritos a mano en el codigo, con el
 * volumen, el consumo, el saldo, el tipo dentro del contingente y la criticidad
 * cableados. Contrastado contra el sistema QUOTA de la Comision:
 *
 *   - 10 de los 11 numeros de orden NO EXISTEN en la base oficial en ningun ano
 *     (2019-2027): 090001, 090002, 090003, 094100, 094101, 094200, 094300,
 *     094301, 090100, 090200.
 *   - El unico que existe, 090101, es "Productos de seda o de algodon tejidos en
 *     telares a mano" con saldo en EURO; aqui figuraba como "Platanos" con
 *     850.000.000 kg.
 *   - Habia contingentes atribuidos a EU-MERCOSUR, acuerdo que no esta en vigor,
 *     con saldos concretos.
 *
 * La base real publica ~1.960 filas para 2026 (un contingente ocupa una fila por
 * periodo de validez). No era un problema de saldos desactualizados: el catalogo
 * entero era ficticio, asi que se sustituye
 * por el oficial, que se sincroniza con `scripts/sincronizarContingentes.js` y
 * vive en la coleccion `TariffQuota`.
 *
 * QUE NO SE AFIRMA
 * ----------------
 *  - El saldo lleva `syncedAt`: un contingente FCFS se agota en horas, asi que
 *    se dice de cuando es el dato en vez de presentarlo como disponibilidad
 *    actual.
 *  - El consumo es volumen inicial menos saldo. Si la fuente no da volumen, es
 *    `null`; no se estima.
 *  - La criticidad es la que declara TARIC, no un umbral de consumo calculado
 *    aqui.
 *  - La elegibilidad por origen NO se resuelve: el listado de QUOTA da un texto
 *    de origenes que a menudo es la descripcion del producto, no una lista de
 *    paises. Se devuelve ese texto con `originVerified: false` para que quien lo
 *    muestre remita a la comprobacion, en vez de filtrar por un dato que no
 *    tiene.
 *  - Sin tipo in-quota conocido no se calcula ahorro. El "ahorro estimado" que
 *    se mostraba salia de un `inQuota: 0.00` cableado para contingentes que ni
 *    existen.
 */
const logger = require('../config/logger');
const TariffQuota = require('../models/TariffQuota');

const URL_OFICIAL = 'https://ec.europa.eu/taxation_customs/dds2/taric/quota_consultation.jsp';

/** Antiguedad a partir de la cual el saldo se considera claramente caducado. */
const HORAS_SALDO_FIABLE = 24;

const aNumero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Unidades de la fuente y sus equivalentes en las que pide el llamante.
 *
 * QUOTA escribe la unidad en ingles y sin abreviar ("Kilogram", "Hectolitre"),
 * mientras que la aplicacion habla en 'kg' o 'l'. Comparar por prefijo no sirve
 * ('kg' no es prefijo de 'kilogram') y comparar sin normalizar dejaria todas las
 * cantidades sin comprobar. Lo que NO se hace es convertir entre magnitudes: un
 * saldo en EURO o en metros cubicos no se compara con kilos, se dice que no se
 * puede comparar.
 *
 * Y OJO CON LAS TILDES: el listado da "Kilogram" pero la pagina de detalle
 * —la que se guarda al sincronizar— la da como "Kilógramo". Los alias van sin
 * tilde y la comparacion las quita, porque si no, todo contingente realmente
 * sincronizado salia como "saldo sin comprobar".
 *
 * QUE SE DEJA FUERA A PROPOSITO
 * -----------------------------
 * El catalogo real de 2026 trae unidades CONDICIONADAS que no son la magnitud
 * base y que por eso NO se dan por equivalentes a kg ni a litros:
 * "Kilógramo of sugar with a yield in white sugar of 92%" (6 contingentes),
 * "Kilógramo of drained net weight" (1), "Litro de alcohol puro (100%)" (6) y
 * "Número de pares" (6). Un kg de azucar al 92% de rendimiento o un litro de
 * alcohol puro no son un kg ni un litro de mercancia: compararlos exigiria una
 * conversion que depende del producto declarado, y darla por hecha seria la misma
 * clase de invento que el "ahorro estimado" que se retiro. Salen como `null`
 * ("saldo sin comprobar") con la unidad publicada a la vista.
 */
const EQUIVALENTES = {
  kilogram: ['kg', 'kilo', 'kilos', 'kilogram', 'kilogramo', 'kilogramos'],
  hectolitre: ['hl', 'hectolitre', 'hectolitro', 'hectolitros'],
  litre: ['l', 'litre', 'litro', 'litros'],
  tonne: ['t', 'tonne', 'tonelada', 'toneladas'],
  'number of items': [
    'ud', 'uds', 'unidad', 'unidades', 'items', 'piezas',
    // Como lo escribe la fuente en castellano (193 contingentes de 2026).
    'numero de unidades'
  ],
  'cubic metre': ['m3', 'cubic metre', 'metro cubico'],
  'square metre': ['m2', 'square metre', 'metro cuadrado'],
  euro: ['eur', 'euro', 'euros']
};

/** Minusculas y sin diacriticos, para cotejar contra los alias. */
const normalizarUnidad = (u) => String(u || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

/** `true` si las dos unidades designan la misma magnitud; `null` si no se sabe. */
function unidadesEquivalentes(pedida, publicada) {
  const a = normalizarUnidad(pedida);
  const b = normalizarUnidad(publicada);
  if (!a || !b) return null;
  if (a === b) return true;

  for (const alias of Object.values(EQUIVALENTES)) {
    if (alias.includes(a) && alias.includes(b)) return true;
  }
  // Si alguna de las dos no esta en la tabla, no se afirma que sean distintas:
  // podria ser una unidad nueva de la fuente y no una incompatibilidad real.
  const conocidas = Object.values(EQUIVALENTES).flat();
  if (!conocidas.includes(a) || !conocidas.includes(b)) return null;
  return false;
}

/**
 * Antiguedad del saldo en horas y si conviene advertirlo.
 * Un contingente critico se mueve en horas, asi que no basta con dar la fecha:
 * hay que decir si el dato ya no sirve para decidir.
 */
function frescura(quota) {
  if (!quota.syncedAt) {
    return { syncedAt: null, ageHours: null, stale: true };
  }
  const ageHours = (Date.now() - new Date(quota.syncedAt).getTime()) / 3600000;
  return {
    syncedAt: new Date(quota.syncedAt).toISOString(),
    ageHours: Number(ageHours.toFixed(1)),
    stale: ageHours > HORAS_SALDO_FIABLE
  };
}

/** Forma con la que se expone un contingente al resto de la aplicacion. */
function presentar(quota, extra = {}) {
  const f = frescura(quota);

  return {
    quotaId: `Q${quota.orderNumber}`,
    orderNumber: quota.orderNumber,
    // Texto de la fuente. No es una lista de paises: en muchos contingentes es
    // la descripcion del producto.
    origins: quota.origins || null,
    period: { start: quota.startDate, end: quota.endDate },
    volume: {
      initial: quota.initialVolume || null,
      balance: quota.balance || null,
      used: aNumero(quota.used),
      unit: quota.balance?.unit || quota.initialVolume?.unit || null,
      utilizationPercent: aNumero(quota.utilizationPercent),
      // El saldo viene de la fuente oficial, pero de una consulta con fecha:
      // no es una lectura en vivo en el momento de responder.
      isLiveBalance: false,
      source: quota.source || 'quota_dds2',
      syncedAt: f.syncedAt,
      balanceAgeHours: f.ageHours,
      balanceStale: f.stale,
      officialSource: URL_OFICIAL
    },
    // Criticidad declarada por TARIC.
    critical: Boolean(quota.critical),
    criticalSource: 'taric',
    // Fecha oficial de agotamiento. Nunca una proyeccion.
    exhaustionDate: quota.exhaustionDate || null,
    lastImportDate: quota.lastImportDate || null,
    lastAllocationDate: quota.lastAllocationDate || null,
    taricCodes: quota.taricCodes || [],
    // La elegibilidad por origen no la resuelve este servicio.
    originVerified: false,
    ...extra
  };
}

/** Avisos que deben acompañar siempre a un contingente. */
function avisos(quota) {
  const f = frescura(quota);
  const lista = [
    'Comprobar el saldo en el sistema oficial de contingentes antes de declarar: ' +
    'un contingente de reparto simultaneo (FCFS) puede agotarse en horas.'
  ];

  if (f.stale) {
    lista.push(f.syncedAt
      ? `El saldo mostrado se consulto el ${f.syncedAt} (hace ${Math.round(f.ageHours)} h).`
      : 'El saldo mostrado no tiene fecha de consulta registrada.');
  }
  if (!quota.initialVolume?.amount) {
    lista.push('La fuente no publica volumen inicial para este contingente: no se puede calcular el consumo.');
  }
  lista.push('Verificar la elegibilidad por origen y las condiciones del contingente en la consulta oficial.');

  return lista;
}

/**
 * Contingentes cuyo ambito incluye el codigo TARIC dado.
 *
 * HAY QUE BUSCAR EN LOS DOS SENTIDOS
 * ----------------------------------
 * La fuente asocia el contingente al nivel al que se definio, y ese nivel puede
 * ser mas grosero O mas fino que el codigo que se consulta:
 *
 *  - Mas grosero: se consulta `0302410090` y el contingente esta en `0302410000`.
 *    Lo cubren los candidatos con ceros de relleno.
 *  - Mas fino: se consulta `50072000` y el contingente 090101 esta definido en
 *    `5007201110`, `5007201910`, `5007202110`... Por igualdad NUNCA coincide, asi
 *    que el contingente existia en el catalogo y era inalcanzable desde el codigo
 *    que teclea el usuario. Para eso va la busqueda por prefijo.
 *
 * El prefijo se recorta por NIVELES de la nomenclatura (10 TARIC, 8 NC, 6 SA),
 * no digito a digito: `5007200000` -> `500720`, pero `5007209010` se usa entero
 * porque su ultima pareja (`10`) es significativa. Recortar de uno en uno dejaba
 * `500720901`, un prefijo que no corresponde a ningun nivel y que emparejaria
 * `5007209011` y `5007209019` sin cubrir el resto del epigrafe.
 *
 * No se ensancha por debajo de 6 digitos: hacerlo devolvia contingentes de otro
 * producto del mismo capitulo.
 */
function prefijoDeBusqueda(normalizado) {
  let prefijo = normalizado.slice(0, 10);
  // Una pareja de ceros al final es una posicion sin concretar, y solo se sube de
  // nivel mientras se sigan encontrando: por eso se comprueba pareja a pareja.
  while (prefijo.length > 6 && prefijo.slice(-2) === '00') {
    prefijo = prefijo.slice(0, -2);
  }
  return prefijo;
}

async function buscarPorTaric(taricCode, year) {
  const normalizado = String(taricCode || '').replace(/\D/g, '');
  if (normalizado.length < 6) return [];

  const candidatos = [...new Set([
    normalizado.padEnd(10, '0'),
    normalizado.slice(0, 10),
    normalizado.slice(0, 8).padEnd(10, '0'),
    normalizado.slice(0, 6).padEnd(10, '0')
  ])];

  return TariffQuota.find({
    year,
    $or: [
      { taricCodes: { $in: candidatos } },
      { taricCodes: { $regex: `^${prefijoDeBusqueda(normalizado)}` } }
    ]
  }).lean();
}

/**
 * Como ha coincidido el contingente con el codigo consultado.
 *
 * Importa decirlo: si el contingente esta definido en subdivisiones mas
 * especificas, no cubre necesariamente la mercancia concreta que se declara, y
 * presentarlo igual que una coincidencia exacta seria afirmar una cobertura que
 * no se ha comprobado.
 */
function tipoCoincidencia(taricCode, quota) {
  const normalizado = String(taricCode || '').replace(/\D/g, '');
  const codigos = quota.taricCodes || [];

  const exactos = new Set([
    normalizado.padEnd(10, '0'),
    normalizado.slice(0, 10),
    normalizado.slice(0, 8).padEnd(10, '0'),
    normalizado.slice(0, 6).padEnd(10, '0')
  ]);

  return codigos.some((c) => exactos.has(c)) ? 'exacta' : 'prefijo';
}

/**
 * Comprobar contingentes aplicables a un producto.
 *
 * `found: false` significa que el catalogo oficial sincronizado no tiene
 * contingente para ese codigo, no que se haya consultado la fuente en vivo.
 */
async function checkQuotaAvailability(taricCode, originCountry, quantity, unit = 'kg', opciones = {}) {
  const year = opciones.year || new Date().getFullYear();
  const encontrados = await buscarPorTaric(taricCode, year);

  const hoy = new Date().toISOString().slice(0, 10);
  const vigentes = encontrados.filter((q) => (
    (!q.startDate || q.startDate <= hoy) && (!q.endDate || q.endDate >= hoy)
  ));

  const quotas = vigentes.map((q) => {
    const saldo = aNumero(q.balance?.amount);
    // `available` responde a si el saldo publicado cubre la cantidad pedida.
    // Solo se afirma cuando las dos unidades designan la misma magnitud: un saldo
    // en EURO o en metros cubicos no se convierte a kilos aqui.
    const mismaUnidad = unidadesEquivalentes(unit, q.balance?.unit);
    const available = saldo === null || mismaUnidad !== true ? null : saldo >= quantity;
    const coincidencia = tipoCoincidencia(taricCode, q);

    return presentar(q, {
      requested: { quantity, unit },
      available,
      unitMismatch: saldo !== null && mismaUnidad !== true
        ? `La cantidad se pidio en ${unit} y el saldo se publica en ${q.balance.unit}: no se compara.`
        : null,
      // Coincidencia por prefijo: el contingente no esta definido para el codigo
      // consultado sino para subdivisiones suyas, asi que puede no cubrir la
      // mercancia concreta.
      codeMatch: coincidencia,
      warnings: [
        ...avisos(q),
        ...(coincidencia === 'prefijo'
          ? ['Este contingente esta definido para subdivisiones mas especificas del codigo ' +
             `consultado (${(q.taricCodes || []).slice(0, 3).join(', ')}...): comprobar que ` +
             'cubre el codigo TARIC exacto de la mercancia.']
          : [])
      ],
      recommendation: available === false
        ? 'Saldo publicado insuficiente para la cantidad solicitada - comprobar en la fuente oficial'
        : 'Indicar el numero de orden en la declaracion y comprobar el saldo en la fuente oficial'
    });
  });

  return {
    found: quotas.length > 0,
    count: quotas.length,
    year,
    // Que no haya resultados no prueba que no exista contingente: prueba que el
    // catalogo sincronizado no lo tiene.
    source: 'catalogo_oficial_sincronizado',
    officialSource: URL_OFICIAL,
    quotas
  };
}

/**
 * Datos para consignar el contingente en la declaracion.
 *
 * NO reserva nada: la atribucion la hace la aduana al aceptar la declaracion.
 * La version anterior devolvia un `reservationId` y una validez de 30 dias, que
 * no corresponden a ningun acto administrativo.
 */
async function getQuotaClaimData(orderNumber, quantity, opciones = {}) {
  const year = opciones.year || new Date().getFullYear();
  const quota = await TariffQuota.findOne({ orderNumber: String(orderNumber), year }).lean();

  if (!quota) {
    return {
      success: false,
      error: `Contingente ${orderNumber} no encontrado en el catalogo oficial de ${year}`,
      officialSource: URL_OFICIAL
    };
  }

  const saldo = aNumero(quota.balance?.amount);

  return {
    success: true,
    // No es una reserva: es la informacion para pedir el contingente en el DUA.
    isReservation: false,
    orderNumber: quota.orderNumber,
    requested: quantity,
    balance: quota.balance || null,
    critical: Boolean(quota.critical),
    instructions: [
      `Consignar el numero de orden ${quota.orderNumber} en la casilla del contingente del DUA`,
      'La atribucion la realiza la aduana al aceptar la declaracion: este dato no reserva cupo',
      'Conservar la documentacion probatoria del origen'
    ],
    warnings: [
      ...avisos(quota),
      ...(saldo !== null && saldo < quantity
        ? [`El saldo publicado (${saldo} ${quota.balance.unit}) es inferior a la cantidad solicitada`]
        : []),
      ...(quota.critical ? ['TARIC marca este contingente como critico'] : [])
    ]
  };
}

/**
 * Ahorro por usar el contingente.
 *
 * Exige que el llamante aporte los dos tipos (dentro y fuera del contingente):
 * el sistema QUOTA no publica el tipo in-quota —esta en la medida de TARIC— y
 * este servicio no se lo va a inventar. Sin ellos no hay cifra de ahorro, que
 * es de donde salian los 1.500 EUR de ahorro sobre un arancel real del 0%.
 */
async function calculateQuotaSavings(taricCode, originCountry, quantity, customsValue, tipos = {}) {
  const disponibilidad = await checkQuotaAvailability(taricCode, originCountry, quantity);

  if (!disponibilidad.found) {
    return {
      applicable: false,
      savings: null,
      message: 'El catalogo oficial sincronizado no tiene contingente para este codigo',
      officialSource: URL_OFICIAL
    };
  }

  const quota = disponibilidad.quotas[0];
  const dentro = aNumero(tipos.inQuotaDuty);
  const fuera = aNumero(tipos.outQuotaDuty);

  if (dentro === null || fuera === null) {
    return {
      applicable: false,
      savings: null,
      quota,
      // Se dice que falta el dato, no que no haya ahorro.
      message: 'Hay contingente, pero no se puede cuantificar el ahorro: falta el tipo dentro ' +
        'y/o fuera del contingente, que no los publica el sistema de contingentes sino la ' +
        'medida de TARIC del codigo y el origen concretos',
      officialSource: URL_OFICIAL
    };
  }

  const sinContingente = customsValue * fuera;
  const conContingente = customsValue * dentro;
  const savings = sinContingente - conContingente;

  return {
    applicable: true,
    quota,
    dutyWithoutQuota: Number(sinContingente.toFixed(2)),
    dutyWithQuota: Number(conContingente.toFixed(2)),
    savings: Number(savings.toFixed(2)),
    savingsPercent: sinContingente > 0
      ? Number(((savings / sinContingente) * 100).toFixed(2))
      : null,
    warnings: quota.warnings,
    // Con coincidencia por prefijo el ahorro depende ADEMAS de que el contingente
    // cubra el codigo exacto: esta definido en subdivisiones del consultado.
    recommendation: quota.codeMatch === 'prefijo'
      ? `Contingente ${quota.orderNumber}: ahorro de ${savings.toFixed(2)} EUR si el contingente ` +
        'cubre el codigo TARIC exacto de la mercancia y la aduana atribuye el cupo ' +
        '(comprobar ambito y saldo antes de declarar)'
      : `Contingente ${quota.orderNumber}: ahorro de ${savings.toFixed(2)} EUR ` +
        'si la aduana atribuye el cupo (comprobar saldo antes de declarar)'
  };
}

/**
 * Contingentes que TARIC marca como criticos.
 * No se recalcula la criticidad por porcentaje de consumo: es la Comision la
 * que la declara, y deducirla de un umbral llevo a presentar como urgentes
 * contingentes cuyo propio dato daba mas de 90 dias de margen.
 */
async function getCriticalQuotas(opciones = {}) {
  const year = opciones.year || new Date().getFullYear();
  const criticos = await TariffQuota.find({ year, critical: true })
    .sort({ utilizationPercent: -1 })
    .limit(opciones.limit || 200)
    .lean();

  return criticos.map((q) => presentar(q, { warnings: avisos(q) }));
}

/** Resumen del catalogo sincronizado. */
async function generateQuotaReport(filters = {}) {
  const year = filters.year || new Date().getFullYear();
  const consulta = { year };
  if (filters.orderNumber) consulta.orderNumber = String(filters.orderNumber);
  if (filters.taricCode) consulta.taricCodes = String(filters.taricCode).replace(/\D/g, '');

  const total = await TariffQuota.countDocuments(consulta);
  const critical = await TariffQuota.countDocuments({ ...consulta, critical: true });
  const exhausted = await TariffQuota.countDocuments({ ...consulta, 'balance.amount': { $lte: 0 } });
  const masReciente = await TariffQuota.findOne(consulta).sort({ syncedAt: -1 }).select('syncedAt').lean();

  const quotas = await TariffQuota.find(consulta)
    .sort({ orderNumber: 1 })
    .limit(filters.limit || 100)
    .lean();

  return {
    generatedAt: new Date().toISOString(),
    year,
    filters,
    summary: {
      total,
      critical,
      exhausted,
      available: total - exhausted,
      // Si el catalogo esta vacio es que no se ha sincronizado, no que no haya
      // contingentes: la fuente publica ~1.960 filas para 2026.
      synced: total > 0,
      lastSyncAt: masReciente?.syncedAt ? new Date(masReciente.syncedAt).toISOString() : null
    },
    source: 'catalogo_oficial_sincronizado',
    officialSource: URL_OFICIAL,
    quotas: quotas.map((q) => presentar(q))
  };
}

/** Guarda o actualiza un contingente traido de la fuente. */
async function guardarContingente(datos) {
  if (!datos?.orderNumber || !datos?.year) {
    throw new Error('Un contingente necesita numero de orden y ano');
  }

  // Se escriben rutas concretas con `$set`: asignar el documento entero
  // borraria los campos que la consulta de turno no traiga.
  await TariffQuota.findOneAndUpdate(
    { orderNumber: datos.orderNumber, year: datos.year },
    {
      $set: {
        origins: datos.origins || null,
        startDate: datos.startDate || null,
        endDate: datos.endDate || null,
        initialVolume: datos.initialVolume || null,
        balance: datos.balance || null,
        used: aNumero(datos.used),
        utilizationPercent: aNumero(datos.utilizationPercent),
        critical: Boolean(datos.critical),
        exhaustionDate: datos.exhaustionDate || null,
        lastImportDate: datos.lastImportDate || null,
        lastAllocationDate: datos.lastAllocationDate || null,
        taricCodes: datos.taricCodes || [],
        syncedAt: new Date(),
        source: 'quota_dds2'
      }
    },
    { upsert: true }
  );

  logger.debug(`[QuotaService] contingente ${datos.orderNumber}/${datos.year} sincronizado`);
}

module.exports = {
  presentar,
  avisos,
  checkQuotaAvailability,
  getQuotaClaimData,
  calculateQuotaSavings,
  getCriticalQuotas,
  generateQuotaReport,
  guardarContingente,
  URL_OFICIAL,
  HORAS_SALDO_FIABLE
};
