/**
 * Tests del servicio de contingentes arancelarios.
 *
 * LA BATERIA ANTERIOR FIJABA EL BUG
 * ---------------------------------
 * Los tests que habia comprobaban la integridad del catalogo cableado
 * (`volume.used + volume.available === volume.total`, `Q090001` como primer
 * resultado, `duty.outQuota > duty.inQuota`) y por eso pasaban en verde mientras
 * el catalogo entero era ficticio: 10 de los 11 numeros de orden no existen en
 * la base de la Comision y el unico que existe describe otro producto. Un test
 * que verifica la coherencia interna de un dato inventado no protege de nada.
 *
 * Lo que se comprueba ahora es lo contrario: que el servicio no afirme lo que la
 * fuente no dice.
 */
jest.mock('../../src/models/TariffQuota');
jest.mock('../../src/config/logger', () => ({
  debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()
}));

const TariffQuota = require('../../src/models/TariffQuota');
const quotaService = require('../../src/services/quotaService');

/** Contingente real: 090006 de 2026, tal como lo publica QUOTA. */
const contingente090006 = (extra = {}) => ({
  orderNumber: '090006',
  year: 2026,
  origins: 'ERGA OMNES',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  initialVolume: { amount: 33496000, unit: 'Kilogram' },
  balance: { amount: 27624751.299, unit: 'Kilogram' },
  used: 5871248.701,
  utilizationPercent: 17.53,
  critical: false,
  exhaustionDate: null,
  taricCodes: ['0302410000', '0303510000'],
  syncedAt: new Date(),
  source: 'quota_dds2',
  ...extra
});

/** Encadenables de Mongoose: find().lean(), find().sort().limit().lean(). */
const cadena = (resultado) => {
  const api = {};
  ['sort', 'limit', 'skip', 'select'].forEach((m) => { api[m] = jest.fn(() => api); });
  api.lean = jest.fn().mockResolvedValue(resultado);
  return api;
};

beforeEach(() => {
  jest.clearAllMocks();
  TariffQuota.find = jest.fn(() => cadena([]));
  TariffQuota.findOne = jest.fn(() => cadena(null));
  TariffQuota.countDocuments = jest.fn().mockResolvedValue(0);
  TariffQuota.findOneAndUpdate = jest.fn().mockResolvedValue({});
});

describe('checkQuotaAvailability', () => {
  test('devuelve el contingente del catalogo oficial con el saldo fechado', async () => {
    TariffQuota.find = jest.fn(() => cadena([contingente090006()]));

    const r = await quotaService.checkQuotaAvailability('0302410000', 'CN', 1000, 'kg', { year: 2026 });

    expect(r.found).toBe(true);
    expect(r.quotas[0].orderNumber).toBe('090006');
    expect(r.quotas[0].volume.balance).toEqual({ amount: 27624751.299, unit: 'Kilogram' });
    // El saldo NO se lee en vivo: viene de una sincronizacion con fecha.
    expect(r.quotas[0].volume.isLiveBalance).toBe(false);
    expect(r.quotas[0].volume.syncedAt).toBeTruthy();
  });

  test('avisa siempre de que un FCFS se agota en horas', async () => {
    TariffQuota.find = jest.fn(() => cadena([contingente090006()]));

    const r = await quotaService.checkQuotaAvailability('0302410000', 'CN', 1000, 'kg', { year: 2026 });

    expect(r.quotas[0].warnings.some((w) => /FCFS|agotarse en horas/i.test(w))).toBe(true);
  });

  test('marca el saldo como caducado cuando la sincronizacion es vieja', async () => {
    const hace3Dias = new Date(Date.now() - 3 * 24 * 3600 * 1000);
    TariffQuota.find = jest.fn(() => cadena([contingente090006({ syncedAt: hace3Dias })]));

    const r = await quotaService.checkQuotaAvailability('0302410000', 'CN', 1000, 'kg', { year: 2026 });

    expect(r.quotas[0].volume.balanceStale).toBe(true);
    expect(r.quotas[0].volume.balanceAgeHours).toBeGreaterThan(24);
    expect(r.quotas[0].warnings.some((w) => /se consulto el/i.test(w))).toBe(true);
  });

  test('no compara la cantidad cuando la unidad del saldo es otra', async () => {
    // 090101 publica el saldo en EURO. Comparar 1.000 kg contra 1.964.263 EURO y
    // responder "disponible" seria inventarse una conversion.
    TariffQuota.find = jest.fn(() => cadena([contingente090006({
      orderNumber: '090101',
      initialVolume: { amount: 2432000, unit: 'EURO' },
      balance: { amount: 1964263.541, unit: 'EURO' }
    })]));

    const r = await quotaService.checkQuotaAvailability('5007200000', 'IN', 1000, 'kg', { year: 2026 });

    expect(r.quotas[0].available).toBeNull();
    expect(r.quotas[0].unitMismatch).toMatch(/EURO/);
  });

  test('compara kg contra el "Kilogram" que escribe la fuente', async () => {
    // QUOTA publica la unidad en ingles y sin abreviar. Sin equivalencia, ninguna
    // cantidad se comprobaba nunca: todo salia como "no se puede comparar".
    TariffQuota.find = jest.fn(() => cadena([contingente090006()]));

    const r = await quotaService.checkQuotaAvailability('0302410000', 'CN', 1000, 'kg', { year: 2026 });

    expect(r.quotas[0].available).toBe(true);
    expect(r.quotas[0].unitMismatch).toBeNull();
  });

  test('compara kg contra el "Kilógramo" acentuado de la pagina de detalle', async () => {
    // El listado da la unidad en ingles ("Kilogram") pero la pagina de detalle la
    // da en castellano y CON TILDE ("Kilógramo"), y es esa la que se guarda al
    // sincronizar. Con la tabla de equivalencias sin tildes, los contingentes
    // sincronizados de verdad salian todos como "saldo sin comprobar".
    TariffQuota.find = jest.fn(() => cadena([contingente090006({
      initialVolume: { amount: 33496000, unit: 'Kilógramo' },
      balance: { amount: 27624751.299, unit: 'Kilógramo' }
    })]));

    const r = await quotaService.checkQuotaAvailability('0302410000', 'CN', 1000, 'kg', { year: 2026 });

    expect(r.quotas[0].available).toBe(true);
    expect(r.quotas[0].unitMismatch).toBeNull();
  });

  test('tampoco confunde unidades acentuadas distintas entre si', async () => {
    // La tolerancia a tildes no debe volver comparable lo que no lo es.
    TariffQuota.find = jest.fn(() => cadena([contingente090006({
      initialVolume: { amount: 1000, unit: 'Hectólitro' },
      balance: { amount: 800, unit: 'Hectólitro' }
    })]));

    const r = await quotaService.checkQuotaAvailability('2204210600', 'CL', 1000, 'kg', { year: 2026 });

    expect(r.quotas[0].available).toBeNull();
    expect(r.quotas[0].unitMismatch).toMatch(/Hectólitro/);
  });

  /**
   * Unidades medidas en el catalogo real de 2026 (1.682 contingentes): 1.420 en
   * "Kilógramo", 193 "Número de unidades", 26 "Litro", 13 "Metro cuadrado", 10
   * "EURO", 6 "Litro de alcohol puro (100%)", 6 "Número de pares", 6 "Kilógramo
   * of sugar with a yield in white sugar of 92%", 1 "Metro cúbico" y 1 "Kilógramo
   * of drained net weight". Las tres ultimas NO son la magnitud base: un kg de
   * azucar al 92% de rendimiento o un litro de alcohol puro no son un kg ni un
   * litro de mercancia, y compararlos seria la misma clase de invento que el
   * "ahorro estimado" que se quito.
   */
  const conUnidad = (unidad, saldo = 800) => contingente090006({
    initialVolume: { amount: 1000, unit: unidad },
    balance: { amount: saldo, unit: unidad }
  });

  test.each([
    ['Número de unidades', 'ud'],
    ['Metro cuadrado', 'm2'],
    ['Litro', 'l']
  ])('compara la unidad real "%s" contra "%s"', async (publicada, pedida) => {
    TariffQuota.find = jest.fn(() => cadena([conUnidad(publicada)]));

    const r = await quotaService.checkQuotaAvailability('0302410000', 'CN', 100, pedida, { year: 2026 });

    expect(r.quotas[0].available).toBe(true);
    expect(r.quotas[0].unitMismatch).toBeNull();
  });

  test.each([
    ['Kilógramo of sugar with a yield in white sugar of 92%', 'kg'],
    ['Kilógramo of drained net weight', 'kg'],
    ['Litro de alcohol puro (100%)', 'l'],
    ['Número de pares', 'ud']
  ])('no compara "%s" con "%s": no es la misma magnitud', async (publicada, pedida) => {
    TariffQuota.find = jest.fn(() => cadena([conUnidad(publicada)]));

    const r = await quotaService.checkQuotaAvailability('0302410000', 'CN', 100, pedida, { year: 2026 });

    // `null` = no se puede comparar. Nunca `true`: el saldo esta expresado en una
    // unidad condicionada (rendimiento, peso escurrido, alcohol puro, pares).
    expect(r.quotas[0].available).toBeNull();
    expect(r.quotas[0].unitMismatch).toContain(publicada);
  });

  test('dice que el saldo publicado no cubre la cantidad pedida', async () => {
    TariffQuota.find = jest.fn(() => cadena([contingente090006({
      balance: { amount: 500, unit: 'Kilogram' }
    })]));

    const r = await quotaService.checkQuotaAvailability('0302410000', 'CN', 1000, 'kg', { year: 2026 });

    expect(r.quotas[0].available).toBe(false);
    expect(r.quotas[0].recommendation).toMatch(/insuficiente/i);
  });

  test('no afirma disponibilidad cuando la fuente no publica saldo', async () => {
    TariffQuota.find = jest.fn(() => cadena([contingente090006({ balance: null })]));

    const r = await quotaService.checkQuotaAvailability('0302410000', 'CN', 1000, 'kg', { year: 2026 });

    // `null` es "no lo se", no `false` ni `true`.
    expect(r.quotas[0].available).toBeNull();
  });

  test('descarta los contingentes cuyo periodo no esta vigente', async () => {
    TariffQuota.find = jest.fn(() => cadena([contingente090006({
      startDate: '2020-01-01', endDate: '2020-12-31'
    })]));

    const r = await quotaService.checkQuotaAvailability('0302410000', 'CN', 1000, 'kg', { year: 2026 });

    expect(r.found).toBe(false);
  });

  test('sin resultados dice que es el catalogo sincronizado, no la fuente', async () => {
    // La distincion importa: si el catalogo esta sin sincronizar, "no hay
    // contingente" seria una afirmacion falsa sobre la realidad.
    const r = await quotaService.checkQuotaAvailability('8517120000', 'CN', 100, 'kg', { year: 2026 });

    expect(r.found).toBe(false);
    expect(r.source).toBe('catalogo_oficial_sincronizado');
    expect(r.officialSource).toContain('quota_consultation.jsp');
  });

  test('busca por el codigo y por sus prefijos de 8 y 6 digitos', async () => {
    await quotaService.checkQuotaAvailability('0302410090', 'CN', 1000, 'kg', { year: 2026 });

    const consulta = TariffQuota.find.mock.calls[0][0];
    const exactos = consulta.$or.find((c) => c.taricCodes.$in).taricCodes.$in;
    expect(exactos).toEqual(expect.arrayContaining(['0302410090', '0302410000']));
    expect(consulta.year).toBe(2026);
  });

  test('encuentra el contingente definido en subdivisiones mas especificas', async () => {
    // 090101 no lleva `5007200000`: la fuente lo define en `5007201110`,
    // `5007201910`... Con el cotejo por igualdad y ceros de relleno, una consulta
    // de 8 digitos no alcanzaba NUNCA un contingente asi. Existe en el catalogo
    // sincronizado y era inaccesible desde el codigo que teclea el usuario.
    TariffQuota.find = jest.fn(() => cadena([contingente090006({
      orderNumber: '090101',
      taricCodes: ['5007201110', '5007201910', '5007202110']
    })]));

    const r = await quotaService.checkQuotaAvailability('50072000', 'IN', 1000, 'kg', { year: 2026 });

    expect(r.found).toBe(true);
    expect(r.quotas[0].orderNumber).toBe('090101');
    // Y se dice que la coincidencia es por prefijo: el contingente NO esta
    // definido para el codigo consultado, sino para subdivisiones suyas.
    expect(r.quotas[0].codeMatch).toBe('prefijo');
    expect(r.quotas[0].warnings.some((w) => /subdivisiones mas especificas/i.test(w))).toBe(true);
  });

  test('consulta tambien por prefijo, no solo por igualdad', async () => {
    await quotaService.checkQuotaAvailability('50072000', 'IN', 1000, 'kg', { year: 2026 });

    const consulta = TariffQuota.find.mock.calls[0][0];
    const porPrefijo = consulta.$or.find((c) => c.taricCodes.$regex);
    // Los ceros de cola son posiciones sin concretar, asi que el prefijo es 500720.
    expect(porPrefijo.taricCodes.$regex).toBe('^500720');
  });

  test('no ensancha por prefijo un codigo de 10 digitos ya concreto', async () => {
    // Si el llamante da la subdivision exacta, ensanchar a 6 digitos devolveria
    // contingentes de otra subdivision del mismo epigrafe: seria presentar como
    // aplicable un contingente que no cubre esa mercancia.
    await quotaService.checkQuotaAvailability('5007209010', 'IN', 1000, 'kg', { year: 2026 });

    const consulta = TariffQuota.find.mock.calls[0][0];
    const porPrefijo = consulta.$or.find((c) => c.taricCodes.$regex);
    expect(porPrefijo.taricCodes.$regex).toBe('^5007209010');
  });

  test('marca como exacta la coincidencia cuando el codigo si esta en el contingente', async () => {
    TariffQuota.find = jest.fn(() => cadena([contingente090006()]));

    const r = await quotaService.checkQuotaAvailability('0302410000', 'CN', 1000, 'kg', { year: 2026 });

    expect(r.quotas[0].codeMatch).toBe('exacta');
    expect(r.quotas[0].warnings.some((w) => /subdivisiones mas especificas/i.test(w))).toBe(false);
  });

  test('no busca con un codigo mas corto de 6 digitos', async () => {
    // Ensanchar a 4 digitos devolvia contingentes de otro producto del capitulo.
    const r = await quotaService.checkQuotaAvailability('0302', 'CN', 1000, 'kg', { year: 2026 });

    expect(r.found).toBe(false);
    expect(TariffQuota.find).not.toHaveBeenCalled();
  });

  test('no expone una elegibilidad por origen que no ha resuelto', async () => {
    TariffQuota.find = jest.fn(() => cadena([contingente090006()]));

    const r = await quotaService.checkQuotaAvailability('0302410000', 'RU', 1000, 'kg', { year: 2026 });

    expect(r.quotas[0].originVerified).toBe(false);
    expect(r.quotas[0].warnings.some((w) => /elegibilidad por origen/i.test(w))).toBe(true);
  });
});

describe('getQuotaClaimData', () => {
  test('no presenta el dato como una reserva de cupo', async () => {
    // La version anterior devolvia `reservationId` y 30 dias de validez: no hay
    // reserva, la atribucion la hace la aduana al admitir la declaracion.
    TariffQuota.findOne = jest.fn(() => cadena(contingente090006()));

    const r = await quotaService.getQuotaClaimData('090006', 1000, { year: 2026 });

    expect(r.success).toBe(true);
    expect(r.isReservation).toBe(false);
    expect(r.reservationId).toBeUndefined();
    expect(r.instructions.some((i) => /no reserva cupo/i.test(i))).toBe(true);
  });

  test('avisa cuando la cantidad pedida supera el saldo publicado', async () => {
    TariffQuota.findOne = jest.fn(() => cadena(contingente090006({
      balance: { amount: 500, unit: 'Kilogram' }
    })));

    const r = await quotaService.getQuotaClaimData('090006', 1000, { year: 2026 });

    expect(r.warnings.some((w) => /inferior a la cantidad solicitada/i.test(w))).toBe(true);
  });

  test('traslada la criticidad que declara TARIC', async () => {
    TariffQuota.findOne = jest.fn(() => cadena(contingente090006({ critical: true })));

    const r = await quotaService.getQuotaClaimData('090006', 10, { year: 2026 });

    expect(r.critical).toBe(true);
    expect(r.warnings.some((w) => /critico/i.test(w))).toBe(true);
  });

  test('falla explicitamente si el numero de orden no esta en el catalogo', async () => {
    const r = await quotaService.getQuotaClaimData('090001', 1000, { year: 2026 });

    expect(r.success).toBe(false);
    expect(r.error).toMatch(/090001/);
  });
});

describe('calculateQuotaSavings', () => {
  test('no cuantifica el ahorro sin los dos tipos', async () => {
    // El tipo dentro del contingente no lo publica el sistema de contingentes:
    // esta en la medida de TARIC. El servicio anterior lo tenia cableado a 0.00 y
    // de ahi salian 1.500 EUR de ahorro sobre un arancel real del 0%.
    TariffQuota.find = jest.fn(() => cadena([contingente090006()]));

    const r = await quotaService.calculateQuotaSavings('0302410000', 'CN', 1000, 50000);

    expect(r.applicable).toBe(false);
    expect(r.savings).toBeNull();
    expect(r.message).toMatch(/falta el tipo/i);
    // Hay contingente: lo que falta es el tipo, y se devuelve el contingente.
    expect(r.quota.orderNumber).toBe('090006');
  });

  test('calcula el ahorro cuando el llamante aporta los dos tipos', async () => {
    TariffQuota.find = jest.fn(() => cadena([contingente090006()]));

    const r = await quotaService.calculateQuotaSavings('0302410000', 'CN', 1000, 50000, {
      inQuotaDuty: 0, outQuotaDuty: 0.12
    });

    expect(r.applicable).toBe(true);
    expect(r.dutyWithoutQuota).toBe(6000);
    expect(r.dutyWithQuota).toBe(0);
    expect(r.savings).toBe(6000);
    expect(r.savingsPercent).toBe(100);
  });

  test('un ahorro de cero es cero, no "no aplicable"', async () => {
    // Cuando los dos tipos coinciden el contingente no ahorra nada, y eso es un
    // resultado calculado, distinto de no poder calcularlo.
    TariffQuota.find = jest.fn(() => cadena([contingente090006()]));

    const r = await quotaService.calculateQuotaSavings('0302410000', 'CN', 1000, 50000, {
      inQuotaDuty: 0.06, outQuotaDuty: 0.06
    });

    expect(r.applicable).toBe(true);
    expect(r.savings).toBe(0);
  });

  test('avisa de que el ahorro se ha cifrado sobre una coincidencia por prefijo', async () => {
    // El ahorro se calcula sobre `quotas[0]`. Si ese contingente se localizo por
    // prefijo puede no cubrir la mercancia declarada, y entonces la cifra es
    // condicional: darla igual que una coincidencia exacta es afirmar un ahorro
    // que depende de una cobertura no comprobada.
    TariffQuota.find = jest.fn(() => cadena([contingente090006({
      orderNumber: '090101',
      taricCodes: ['5007201110', '5007201910']
    })]));

    const r = await quotaService.calculateQuotaSavings('50072000', 'IN', 1000, 50000, {
      inQuotaDuty: 0, outQuotaDuty: 0.12
    });

    expect(r.applicable).toBe(true);
    expect(r.savings).toBe(6000);
    expect(r.quota.codeMatch).toBe('prefijo');
    expect(r.warnings.some((w) => /subdivisiones mas especificas/i.test(w))).toBe(true);
    expect(r.recommendation).toMatch(/si el contingente cubre/i);
  });

  test('sin contingente no devuelve un ahorro de cero, devuelve que no hay', async () => {
    const r = await quotaService.calculateQuotaSavings('8517120000', 'CN', 100, 1000, {
      inQuotaDuty: 0, outQuotaDuty: 0.12
    });

    expect(r.applicable).toBe(false);
    expect(r.savings).toBeNull();
  });
});

describe('getCriticalQuotas', () => {
  test('consulta la criticidad declarada por TARIC, no un umbral de consumo', async () => {
    // Deducirla de >90% de consumo marcaba como urgentes contingentes cuyo propio
    // dato daba mas de 90 dias de margen.
    TariffQuota.find = jest.fn(() => cadena([contingente090006({ critical: true, utilizationPercent: 17.53 })]));

    const r = await quotaService.getCriticalQuotas({ year: 2026 });

    expect(TariffQuota.find).toHaveBeenCalledWith({ year: 2026, critical: true });
    expect(r[0].critical).toBe(true);
    expect(r[0].criticalSource).toBe('taric');
    // Critico al 17,53%: la criticidad no es funcion del porcentaje.
    expect(r[0].volume.utilizationPercent).toBe(17.53);
  });

  test('no proyecta una fecha de agotamiento que la fuente no da', async () => {
    TariffQuota.find = jest.fn(() => cadena([contingente090006({ critical: true, exhaustionDate: null })]));

    const r = await quotaService.getCriticalQuotas({ year: 2026 });

    expect(r[0].exhaustionDate).toBeNull();
  });

  test('devuelve la fecha oficial de agotamiento cuando existe', async () => {
    TariffQuota.find = jest.fn(() => cadena([contingente090006({ critical: true, exhaustionDate: '2026-03-14' })]));

    const r = await quotaService.getCriticalQuotas({ year: 2026 });

    expect(r[0].exhaustionDate).toBe('2026-03-14');
  });
});

describe('generateQuotaReport', () => {
  test('un catalogo vacio se declara sin sincronizar, no sin contingentes', async () => {
    // La fuente publica ~1.960 filas para 2026: cero resultados significa que no
    // se ha sincronizado.
    const r = await quotaService.generateQuotaReport({ year: 2026 });

    expect(r.summary.total).toBe(0);
    expect(r.summary.synced).toBe(false);
    expect(r.officialSource).toContain('quota_consultation.jsp');
  });

  test('cuenta agotados, criticos y la fecha de la ultima sincronizacion', async () => {
    TariffQuota.countDocuments = jest.fn()
      .mockResolvedValueOnce(1125)  // total
      .mockResolvedValueOnce(37)    // criticos
      .mockResolvedValueOnce(112);  // agotados
    const sincronizado = new Date('2026-08-10T06:00:00.000Z');
    TariffQuota.findOne = jest.fn(() => cadena({ syncedAt: sincronizado }));
    TariffQuota.find = jest.fn(() => cadena([contingente090006()]));

    const r = await quotaService.generateQuotaReport({ year: 2026 });

    expect(r.summary).toMatchObject({ total: 1125, critical: 37, exhausted: 112, available: 1013, synced: true });
    expect(r.summary.lastSyncAt).toBe('2026-08-10T06:00:00.000Z');
  });
});

describe('guardarContingente', () => {
  test('escribe rutas concretas con $set y no reemplaza el documento', async () => {
    // Asignar el documento entero borraria los campos que la consulta de turno no
    // traiga, que es la trampa de findOneAndUpdate en Mongoose.
    await quotaService.guardarContingente({
      orderNumber: '090006', year: 2026,
      balance: { amount: 100, unit: 'Kilogram' }
    });

    const [filtro, actualizacion] = TariffQuota.findOneAndUpdate.mock.calls[0];
    expect(filtro).toEqual({ orderNumber: '090006', year: 2026 });
    expect(actualizacion.$set).toBeDefined();
    expect(actualizacion.$set.syncedAt).toBeInstanceOf(Date);
    expect(actualizacion.$set.source).toBe('quota_dds2');
  });

  test('no guarda un contingente sin numero de orden o sin ano', async () => {
    await expect(quotaService.guardarContingente({ orderNumber: '090006' }))
      .rejects.toThrow(/ano/i);
    expect(TariffQuota.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('no convierte en cero un consumo que la fuente no da', async () => {
    await quotaService.guardarContingente({ orderNumber: '090006', year: 2026, used: undefined });

    expect(TariffQuota.findOneAndUpdate.mock.calls[0][1].$set.used).toBeNull();
  });
});
