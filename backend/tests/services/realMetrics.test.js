/**
 * Las metricas de analytics salen de la base de datos, no de Math.random().
 *
 * analyticsService construia el cuadro de mando con _generateMetricValue(min,
 * max) en 171 sitios. La UI lo presentaba como analitica real: decia entre 150
 * y 300 declaraciones cuando en la base de datos habia 35, y la cifra cambiaba
 * en cada recarga de la pagina.
 *
 * realMetricsService lo sustituye por agregaciones. Lo que NO se puede calcular
 * hoy -- recaudacion cobrada (0 pagos) y valor de mercancia (goodsSummary
 * .totalValue = 0 en los 25 expedientes) -- no se inventa ni se aproxima: se
 * declara no disponible con un motivo legible, y el controlador responde 501.
 * Decision de Luis, 3/Ago/2026.
 *
 * Estos tests usan mocks de los modelos: comprueban la FORMA del calculo y,
 * sobre todo, las dos trampas que encontre al implementarlo.
 */

const mongoose = require('mongoose');

// El prefijo `mock` es obligatorio: jest.mock() se iza por encima de las
// declaraciones y solo permite referenciar variables asi nombradas.
const mockContar = jest.fn();
const mockAgregar = jest.fn();

/** Todos los modelos comparten espia: basta con inspeccionar la llamada. */
const mockModelo = () => ({
  countDocuments: (...a) => mockContar(...a),
  aggregate: (...a) => mockAgregar(...a)
});

jest.mock('../../src/models', () => ({
  H7Declaration: mockModelo(),
  Expedition: mockModelo(),
  Transit: mockModelo(),
  Inspection: mockModelo(),
  Requirement: mockModelo(),
  Guarantee: mockModelo(),
  Payment: mockModelo(),
  // Las garantias se aislan por `owner` (un usuario), no por tenantId: hay que
  // resolver antes los usuarios del tenant.
  User: { find: () => ({ select: () => ({ lean: () => Promise.resolve([]) }) }) }
}));

const metricas = require('../../src/services/analytics/realMetricsService');

const TENANT = '6a5769e0b11d798e7e783602';

beforeEach(() => {
  mockContar.mockReset();
  mockAgregar.mockReset();
  mockContar.mockResolvedValue(0);
  mockAgregar.mockResolvedValue([]);
});

describe('el tenantId llega a las agregaciones como ObjectId', () => {
  // LA TRAMPA. countDocuments() y find() castean la cadena a ObjectId usando el
  // esquema, pero aggregate() NO: su $match va contra el documento crudo. Con
  // el tenantId en cadena, la agregacion devolvia VACIO mientras countDocuments
  // devolvia 35 sobre los mismos datos.
  //
  // Es especialmente traicionero en un panel: un cero se lee como "no hay
  // actividad", no como un error.
  test('repartoPorCanal casa por ObjectId, no por cadena', async () => {
    await metricas.repartoPorCanal(TENANT);

    const [[etapas]] = mockAgregar.mock.calls;
    const filtro = etapas[0].$match;

    expect(filtro.tenantId).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(String(filtro.tenantId)).toBe(TENANT);
  });

  test('derechosLiquidados tambien', async () => {
    await metricas.derechosLiquidados(TENANT);

    expect(mockAgregar.mock.calls[0][0][0].$match.tenantId)
      .toBeInstanceOf(mongoose.Types.ObjectId);
  });

  test('un tenantId que ya es ObjectId no se rompe al recastear', async () => {
    const oid = new mongoose.Types.ObjectId(TENANT);

    await metricas.repartoPorCanal(oid);

    expect(String(mockAgregar.mock.calls[0][0][0].$match.tenantId)).toBe(TENANT);
  });

  test('sin tenantId no se filtra: los informes de plataforma lo necesitan', async () => {
    await metricas.repartoPorCanal(undefined);

    expect(mockAgregar.mock.calls[0][0][0].$match.tenantId).toBeUndefined();
  });
});

describe('metricas no disponibles', () => {
  test('recaudacion sin pagos se declara no disponible, no cero', async () => {
    // Un 0 EUR se lee como "no se ha recaudado nada". El motivo dice la verdad.
    mockContar.mockResolvedValue(0);

    const r = await metricas.recaudacionCobrada(TENANT);

    expect(r.disponible).toBe(false);
    expect(r.motivo).toMatch(/pagos/i);
    expect(r.total).toBeUndefined();
  });

  test('en cuanto haya un pago, pasa a calcularse sola', async () => {
    // Sin tocar el codigo: la comprobacion es en tiempo de ejecucion.
    mockContar.mockResolvedValue(3);
    mockAgregar.mockResolvedValue([{ _id: null, total: 1234.567, n: 3 }]);

    const r = await metricas.recaudacionCobrada(TENANT);

    expect(r.disponible).toBe(true);
    expect(r.total).toBe(1234.57);
    expect(r.pagos).toBe(3);
  });

  test('valor de mercancia sin importes se declara no disponible', async () => {
    mockContar.mockResolvedValue(0);

    const r = await metricas.valorMercancia(TENANT);

    expect(r.disponible).toBe(false);
    expect(r.motivo).toMatch(/valor de mercancia/i);
  });

  test('los motivos se leen sin contexto: van al 501', async () => {
    for (const motivo of Object.values(metricas.NO_DISPONIBLE)) {
      expect(motivo.length).toBeGreaterThan(30);
      expect(motivo).toMatch(/[a-z]/);
    }
  });
});

describe('derechosLiquidados', () => {
  test('redondea a dos decimales', async () => {
    mockAgregar.mockResolvedValue([{
      _id: null, arancel: 10.005, iva: 515.7649, total: 525.7699, valorEnAduana: 2500, n: 35
    }]);

    const r = await metricas.derechosLiquidados(TENANT);

    expect(r.iva).toBe(515.76);
    expect(r.total).toBe(525.77);
  });

  test('sin declaraciones devuelve ceros, no NaN', async () => {
    // Dividir entre 0 al calcular la media daria NaN, que en JSON es null.
    mockAgregar.mockResolvedValue([]);

    const r = await metricas.derechosLiquidados(TENANT);

    expect(r.medioPorDeclaracion).toBe(0);
    expect(Number.isNaN(r.medioPorDeclaracion)).toBe(false);
  });

  test('es lo LIQUIDADO, no lo cobrado', async () => {
    // La distincion importa: se calcula de las declaraciones, no de los pagos.
    mockAgregar.mockResolvedValue([{ _id: null, arancel: 0, iva: 100, total: 100, valorEnAduana: 500, n: 2 }]);

    const r = await metricas.derechosLiquidados(TENANT);

    expect(r).toHaveProperty('declaraciones', 2);
    expect(r).not.toHaveProperty('pagos');
  });
});

describe('repartoPorCanal', () => {
  test('el porcentaje se calcula sobre los que TIENEN canal', async () => {
    // Sobre el total de expedientes saldria falseado: los que aun no han
    // llegado a canal no son "canal verde".
    mockAgregar.mockResolvedValue([
      { _id: 'green_channel', n: 2 },
      { _id: 'orange_channel', n: 3 },
      { _id: 'red_channel', n: 3 },
      { _id: 'draft', n: 17 }          // sin canal todavia
    ]);

    const r = await metricas.repartoPorCanal(TENANT);

    expect(r.conCanalAsignado).toBe(8);
    expect(r.porcentajes.green).toBe(25);      // 2/8, no 2/25
    expect(r.porcentajes.orange).toBe(37.5);
  });

  test('sin ningun canal asignado no divide entre cero', async () => {
    mockAgregar.mockResolvedValue([{ _id: 'draft', n: 5 }]);

    const r = await metricas.repartoPorCanal(TENANT);

    expect(r.porcentajes.green).toBe(0);
    expect(Number.isNaN(r.porcentajes.green)).toBe(false);
  });
});

describe('tiemposDeDespacho', () => {
  test('solo entran las declaraciones con levante', async () => {
    // Promediar tambien las que siguen abiertas daria un numero optimista.
    await metricas.tiemposDeDespacho(TENANT);

    const filtro = mockAgregar.mock.calls[0][0][0].$match;

    expect(filtro.submittedAt).toEqual({ $ne: null });
    expect(filtro.releasedAt).toEqual({ $ne: null });
  });

  test('sin muestra devuelve null, no cero', async () => {
    // Un 0 se leeria como "se despacha al instante".
    mockAgregar.mockResolvedValue([]);

    const r = await metricas.tiemposDeDespacho(TENANT);

    expect(r.muestra).toBe(0);
    expect(r.mediaHoras).toBeNull();
  });

  test('convierte milisegundos a horas', async () => {
    mockAgregar.mockResolvedValue([{ _id: null, media: 323.8963, minimo: 27.2, maximo: 715.8, n: 8 }]);

    const r = await metricas.tiemposDeDespacho(TENANT);

    expect(r.mediaHoras).toBe(323.9);
    expect(r.muestra).toBe(8);
  });
});

describe('volumenDeclaraciones', () => {
  test('agrupa los estados terminales favorables como aceptadas', async () => {
    mockContar.mockResolvedValue(35);
    mockAgregar.mockResolvedValue([
      { _id: 'accepted', n: 5 },
      { _id: 'released', n: 8 },
      { _id: 'draft', n: 8 },
      { _id: 'pending', n: 6 }
    ]);

    const r = await metricas.volumenDeclaraciones(TENANT);

    expect(r.aceptadas).toBe(13);   // accepted + released
    expect(r.pendientes).toBe(14);  // pending + draft (validating = 0)
  });

  test('solo declara los tipos que tienen coleccion propia', async () => {
    // H1 y AES se generan desde el expediente y no se persisten aparte. Un 0
    // se leeria como "ninguna presentada", que es distinto de "no aplica".
    mockContar.mockResolvedValue(35);

    const r = await metricas.volumenDeclaraciones(TENANT);

    expect(Object.keys(r.porTipo)).toEqual(['H7', 'NCTS']);
    expect(r.porTipo).not.toHaveProperty('H1');
  });
});

describe('el cuadro de mando declara que NO es simulado', () => {
  test('simulated es false', async () => {
    // Es lo que este servicio existe para poder afirmar.
    const r = await metricas.cuadroDeMando(TENANT);

    expect(r.simulated).toBe(false);
  });

  test('lleva marca de tiempo de generacion', async () => {
    const r = await metricas.cuadroDeMando(TENANT);

    expect(new Date(r.generadoEn).getTime()).toBeLessThanOrEqual(Date.now());
  });

  test('no usa Math.random en ninguna parte', () => {
    const fs = require('fs');
    const path = require('path');
    const fuente = fs.readFileSync(
      path.join(__dirname, '../../src/services/analytics/realMetricsService.js'), 'utf8'
    );

    expect(fuente).not.toMatch(/Math\.random/);
  });
});
