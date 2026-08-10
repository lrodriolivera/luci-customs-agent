/**
 * Tests del parser del sistema QUOTA de la Comision.
 *
 * Los textos de entrada son literales de las respuestas reales de
 * `quota_list.jsp` y `quota_tariff_details.jsp`. El catalogo de contingentes que
 * habia en `quotaService.js` tenia 11 numeros de orden de los que 10 NO EXISTEN
 * en la base oficial en ningun ano, y el unico que existe (090101) describe otro
 * producto y otra unidad. Un mock aproximado no protegeria de eso: lo unico que
 * lo detecta es parsear la respuesta real.
 */
const https = require('https');

const {
  parsearListado,
  parsearDetalle,
  parsearImporte,
  listarAno,
  consultarContingente
} = require('../../src/services/quotaOfficialClient');

describe('parsearImporte', () => {
  it('separa la cantidad de la unidad tal como las da la fuente', () => {
    // La celda "Saldo" llega con el salto de linea y las tabulaciones del HTML.
    expect(parsearImporte('27624751.299 \n\t      Kilogram')).toEqual({
      amount: 27624751.299,
      unit: 'Kilogram'
    });
  });

  it('lee unidades de varias palabras', () => {
    expect(parsearImporte('0 Cubic metre')).toEqual({ amount: 0, unit: 'Cubic metre' });
  });

  it('devuelve null cuando la celda no trae importe', () => {
    expect(parsearImporte('')).toBeNull();
    expect(parsearImporte('   ')).toBeNull();
  });
});

describe('parsearListado', () => {
  it('extrae numero de orden, periodo y saldo de cada fila', () => {
    const html = '<table><tbody>' +
      '<tr><td data-ecl-table-header=" Número de orden">090006</td>' +
      '<td data-ecl-table-header=" Origenes">Todos los terceros países</td>' +
      '<td data-ecl-table-header="  Fecha de inicio">16-06-2026</td>' +
      '<td data-ecl-table-header=" Fecha de finalización">14-02-2027</td>' +
      '<td data-ecl-table-header="Saldo">27624751.299 \n\t      Kilogram</td></tr>' +
      '</tbody></table>';

    const filas = parsearListado(html);

    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      orderNumber: '090006',
      origins: 'Todos los terceros países',
      // Fecha en ISO: la fuente la da como DD-MM-AAAA y guardarla asi la haria
      // inordenable y ambigua frente a MM-DD-AAAA.
      startDate: '2026-06-16',
      endDate: '2027-02-14'
    });
    expect(filas[0].balance).toEqual({ amount: 27624751.299, unit: 'Kilogram' });
  });

  it('devuelve lista vacia cuando la consulta no encuentra el contingente', () => {
    // Un numero de orden inexistente devuelve 200 con la tabla vacia, no un
    // error: tratarlo como fallo de red haria pensar que el dato existe.
    expect(parsearListado('<table><tbody></tbody></table>')).toEqual([]);
    expect(parsearListado('sin tabla')).toEqual([]);
  });
});

describe('parsearDetalle', () => {
  // Literal aplanado de quota_tariff_details.jsp?Code=090006&StartDate=2026-06-16
  const detalle = 'Número de orden | | | 090006 | | | | Periodo de validez | | | ' +
    '16-06-2026 - 14-02-2027 | | | | Orígenes | | | |Todos los terceros países| | | | ' +
    '| Volumen inicial | | | 33496000 Kilógramo | | | | Volumen | | 33496000 Kilógramo | | | | ' +
    'Saldo | | | 27624751.299 Kilógramo | | | | Cantidad transferida | | | | | | | | ' +
    'Fecha de agotamiento | | | | | | | Crítico | | | No | | | | ' +
    'Ultima fecha de importación | | | 04-08-2026 | | | | ' +
    'Fecha de la última atribución | | | 06-08-2026 | | | | ' +
    'Cuantía total en espera (|indicativo|) | | | 0 | | | | Periodo de bloqueo | | | | | | | ' +
    'Periodo suspensión | | | | | | | Porcentaje asignado en la última asignación | | 100 | | | | ' +
    'Códigos TARIC asociados | | | | 0302 41 00 00 | | 0303 51 00 00 | | 0304 59 50 00 | | ' +
    '0304 59 90 10 | | 0304 99 23 00 | | | |';

  it('lee volumen, saldo y consumo derivado del saldo, no de una cifra propia', () => {
    const d = parsearDetalle(detalle);

    expect(d.orderNumber).toBe('090006');
    expect(d.initialVolume).toEqual({ amount: 33496000, unit: 'Kilógramo' });
    expect(d.balance).toEqual({ amount: 27624751.299, unit: 'Kilógramo' });
    // El consumo NO lo publica la fuente: es volumen - saldo. Cualquier otra
    // cifra seria inventada, que es el bug de partida de este servicio.
    expect(d.used).toBeCloseTo(5871248.701, 3);
    expect(d.utilizationPercent).toBeCloseTo(17.53, 2);
  });

  it('toma la criticidad que declara la fuente en vez de deducirla', () => {
    // TARIC marca un contingente como critico por sus propias reglas (no es un
    // simple umbral de consumo): 090006 esta al 17% y no es critico.
    expect(parsearDetalle(detalle).critical).toBe(false);
    expect(parsearDetalle(detalle.replace('Crítico | | | No', 'Crítico | | | Sí')).critical).toBe(true);
  });

  it('deja la fecha de agotamiento en null cuando la fuente no la da', () => {
    // El servicio anterior extrapolaba una fecha de agotamiento y la presentaba
    // como dato. Si la fuente no la publica, no hay fecha.
    expect(parsearDetalle(detalle).exhaustionDate).toBeNull();
  });

  it('lee la fecha de agotamiento cuando la fuente si la publica', () => {
    const conFecha = detalle.replace('Fecha de agotamiento | | | | | |', 'Fecha de agotamiento | | | 12-05-2026 | | |');

    expect(parsearDetalle(conFecha).exhaustionDate).toBe('2026-05-12');
  });

  it('normaliza los codigos TARIC asociados quitando los espacios de la fuente', () => {
    // La fuente los escribe agrupados ("0302 41 00 00"); el catalogo local usa
    // el codigo de 10 digitos sin separar.
    expect(parsearDetalle(detalle).taricCodes).toEqual([
      '0302410000', '0303510000', '0304595000', '0304599010', '0304992300'
    ]);
  });

  it('no inventa consumo cuando falta el volumen', () => {
    const sinVolumen = 'Número de orden | | | 090101 | | | | Volumen inicial | | | | | | | ' +
      'Saldo | | | 1964263.541 EURO | | | | Crítico | | | No | |';
    const d = parsearDetalle(sinVolumen);

    expect(d.initialVolume).toBeNull();
    expect(d.used).toBeNull();
    expect(d.utilizationPercent).toBeNull();
    expect(d.balance).toEqual({ amount: 1964263.541, unit: 'EURO' });
  });
});

describe('listarAno', () => {
  // Respuestas simuladas de `https.get` por URL: la paginacion se comprueba
  // contra los dos comportamientos reales de la fuente que rompian la tirada.
  let respuestas;
  let pedidas;

  const fila = (orden, inicio = '01-01-2026') =>
    `<tr><td data-ecl-table-header="Número de orden">${orden}</td>` +
    `<td data-ecl-table-header="Origenes">ERGA OMNES</td>` +
    `<td data-ecl-table-header="Fecha de inicio">${inicio}</td>` +
    `<td data-ecl-table-header="Fecha de finalización">31-12-2026</td>` +
    '<td data-ecl-table-header="Saldo">100 Kilogram</td></tr>';

  const pagina = (filas) => ({ status: 200, body: `<table><tbody>${filas.join('')}</tbody></table>` });
  const offsetDe = (url) => Number((/Offset=(\d+)/.exec(url) || [])[1]);

  beforeEach(() => {
    pedidas = [];
    respuestas = new Map();

    jest.spyOn(https, 'get').mockImplementation((url, _opts, cb) => {
      pedidas.push(url);
      const clave = /quota_consultation/.test(url) ? 'sesion' : offsetDe(url);
      const r = respuestas.get(clave) || pagina([]);
      // La cookie solo la entrega la pagina de consulta.
      const cookies = clave === 'sesion' ? ['JSESSIONID=abc; Path=/'] : [];

      process.nextTick(() => {
        cb({
          statusCode: r.status,
          headers: { 'set-cookie': cookies, location: r.location },
          on: (evento, fn) => {
            if (evento === 'data') fn(r.body || '');
            if (evento === 'end') fn();
          }
        });
      });
      return { on: () => {} };
    });

    respuestas.set('sesion', { status: 200, body: '' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('no corta cuando una pagina entera repite numeros de orden ya vistos', async () => {
    // Un contingente con varios periodos de validez ocupa una fila por periodo,
    // asi que hay paginas sin ningun numero de orden nuevo. Cortar ahi devolvia
    // 1.125 de las ~1.960 filas de 2026 sin que nadie lo notara.
    respuestas.set(0, pagina([fila('090001'), fila('090002')]));
    respuestas.set(20, pagina([fila('090001', '01-07-2026'), fila('090002', '01-07-2026')]));
    respuestas.set(40, pagina([fila('090003')]));
    respuestas.set(60, pagina([]));

    const filas = await listarAno(2026, { cookie: 'JSESSIONID=abc' });

    expect(filas.map((f) => f.orderNumber).sort()).toEqual(['090001', '090002', '090003']);
    expect(pedidas.some((u) => /Offset=40/.test(u))).toBe(true);
  });

  it('se queda con el periodo mas reciente de cada numero de orden', async () => {
    // El saldo que se puede pedir hoy es el del periodo vigente, no el del
    // primero que devuelva la fuente.
    respuestas.set(0, pagina([fila('090006', '01-01-2026'), fila('090006', '16-06-2026')]));
    respuestas.set(20, pagina([]));

    const filas = await listarAno(2026, { cookie: 'JSESSIONID=abc' });

    expect(filas).toHaveLength(1);
    expect(filas[0].startDate).toBe('2026-06-16');
  });

  it('reabre la sesion y repite el offset cuando la fuente responde 302', async () => {
    // Comprobado en la fuente: en una tirada larga la sesion caduca y responde
    // 302 a la pagina de consulta. Tratarlo como error fatal dejaba el catalogo
    // a medias en la pagina 59.
    let vecesOffset20 = 0;
    jest.spyOn(https, 'get').mockImplementation((url, _opts, cb) => {
      pedidas.push(url);
      let r;
      if (/quota_consultation/.test(url)) r = { status: 200, body: '', cookie: true };
      else if (offsetDe(url) === 0) r = pagina([fila('090001')]);
      else if (offsetDe(url) === 20) {
        vecesOffset20 += 1;
        r = vecesOffset20 === 1
          ? { status: 302, body: '', location: 'quota_consultation.jsp' }
          : pagina([fila('090002')]);
      } else r = pagina([]);

      process.nextTick(() => {
        cb({
          statusCode: r.status,
          headers: { 'set-cookie': r.cookie ? ['JSESSIONID=nueva; Path=/'] : [], location: r.location },
          on: (evento, fn) => {
            if (evento === 'data') fn(r.body || '');
            if (evento === 'end') fn();
          }
        });
      });
      return { on: () => {} };
    });

    const filas = await listarAno(2026, { cookie: 'JSESSIONID=vieja' });

    expect(filas.map((f) => f.orderNumber).sort()).toEqual(['090001', '090002']);
    expect(vecesOffset20).toBe(2);
    expect(pedidas.filter((u) => /quota_consultation/.test(u))).toHaveLength(1);
  });

  it('un estado que no es 200 ni 302 se propaga en vez de quedarse a medias', async () => {
    respuestas.set(0, pagina([fila('090001')]));
    respuestas.set(20, { status: 500, body: '' });

    await expect(listarAno(2026, { cookie: 'JSESSIONID=abc' }))
      .rejects.toThrow(/devolvio 500 en offset 20/);
  });
});

describe('consultarContingente', () => {
  /**
   * La sesion caduca a mitad de la tirada y la fuente responde 302. El script de
   * sincronizacion recibe la cookie una sola vez al arrancar, asi que a partir de
   * ese momento TODOS los contingentes fallaban con "devolvio 302" — medido: 16
   * fallidos de 50 — y el reintento no ayudaba porque repetia la cookie muerta.
   */
  const DETALLE = 'Número de orden | | | 090006 | | | | Periodo de validez | | | ' +
    '01-01-2026 - 31-12-2026 | | | | Volumen inicial | | | 100 Kilógramo | | | | ' +
    'Saldo | | | 40 Kilógramo | | | | Crítico | | | No | |';

  const respuestaDe = (r, cb) => process.nextTick(() => {
    cb({
      statusCode: r.status,
      headers: { 'set-cookie': r.cookie ? ['JSESSIONID=nueva; Path=/'] : [], location: r.location },
      on: (evento, fn) => {
        if (evento === 'data') fn(r.body || '');
        if (evento === 'end') fn();
      }
    });
  });

  const filaHtml = '<table><tbody><tr>' +
    '<td data-ecl-table-header="Número de orden">090006</td>' +
    '<td data-ecl-table-header="Fecha de inicio">01-01-2026</td>' +
    '<td data-ecl-table-header="Saldo">40 Kilogram</td></tr></tbody></table>';

  afterEach(() => { jest.restoreAllMocks(); });

  it('reabre la sesion cuando el listado responde 302 con la cookie caducada', async () => {
    let vecesListado = 0;
    const sesiones = [];

    jest.spyOn(https, 'get').mockImplementation((url, _opts, cb) => {
      if (/quota_consultation/.test(url)) {
        sesiones.push(url);
        return respuestaDe({ status: 200, body: '', cookie: true }, cb), { on: () => {} };
      }
      if (/quota_list/.test(url)) {
        vecesListado += 1;
        return respuestaDe(vecesListado === 1
          ? { status: 302, body: '', location: 'quota_consultation.jsp' }
          : { status: 200, body: filaHtml }, cb), { on: () => {} };
      }
      return respuestaDe({ status: 200, body: DETALLE }, cb), { on: () => {} };
    });

    const d = await consultarContingente('090006', 2026, 'JSESSIONID=caducada');

    expect(d.balance).toEqual({ amount: 40, unit: 'Kilógramo' });
    expect(vecesListado).toBe(2);
    expect(sesiones).toHaveLength(1);
  });

  it('reabre la sesion cuando es el detalle el que responde 302', async () => {
    // Medido tambien en la fuente: la sesion puede caer entre el listado y el
    // detalle, y entonces el contingente se perdia con el listado ya traido.
    let vecesDetalle = 0;

    jest.spyOn(https, 'get').mockImplementation((url, _opts, cb) => {
      if (/quota_consultation/.test(url)) return respuestaDe({ status: 200, body: '', cookie: true }, cb), { on: () => {} };
      if (/quota_list/.test(url)) return respuestaDe({ status: 200, body: filaHtml }, cb), { on: () => {} };
      vecesDetalle += 1;
      return respuestaDe(vecesDetalle === 1
        ? { status: 302, body: '', location: 'quota_consultation.jsp' }
        : { status: 200, body: DETALLE }, cb), { on: () => {} };
    });

    const d = await consultarContingente('090006', 2026, 'JSESSIONID=caducada');

    expect(d.balance).toEqual({ amount: 40, unit: 'Kilógramo' });
    expect(vecesDetalle).toBe(2);
  });

  it('devuelve null cuando el numero de orden no existe, sin confundirlo con un 302', async () => {
    jest.spyOn(https, 'get').mockImplementation((url, _opts, cb) => {
      if (/quota_consultation/.test(url)) return respuestaDe({ status: 200, body: '', cookie: true }, cb), { on: () => {} };
      return respuestaDe({ status: 200, body: '<table><tbody></tbody></table>' }, cb), { on: () => {} };
    });

    await expect(consultarContingente('090001', 2026, 'JSESSIONID=abc')).resolves.toBeNull();
  });

  it('un 500 se sigue propagando: no todo no-200 es sesion caducada', async () => {
    jest.spyOn(https, 'get').mockImplementation((url, _opts, cb) => {
      if (/quota_consultation/.test(url)) return respuestaDe({ status: 200, body: '', cookie: true }, cb), { on: () => {} };
      return respuestaDe({ status: 500, body: '' }, cb), { on: () => {} };
    });

    await expect(consultarContingente('090006', 2026, 'JSESSIONID=abc'))
      .rejects.toThrow(/quota_list\.jsp devolvio 500/);
  });
});
