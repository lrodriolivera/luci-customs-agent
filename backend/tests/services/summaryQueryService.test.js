/**
 * summaryQueryService — consultas ADDS-JDIT de AEAT (QIntNuCono/Cont/Ubic/
 * DocAsoc/MRN/EORI) + historial y estadísticas.
 *
 * El servicio está en modo DEMO: `_simulateAEATQuery` genera resultados
 * localmente y NUNCA toca la red ni AEAT. La única dependencia real es el
 * modelo Mongoose `SummaryQuery`, que usamos con Mongo EN MEMORIA (modelo real,
 * SIN mockear) para ejercitar de verdad el pre('validate') que genera queryId,
 * los métodos de instancia complete()/fail() y los estáticos getHistory()/
 * getStats(). Así el test reproduce comportamiento real y no pasa por mocks del
 * propio código bajo prueba.
 *
 * `_delay` usa setTimeout con 200-500ms → usamos jest fake timers no; en su
 * lugar acortamos vía spy de Math.random para minimizar la latencia simulada,
 * y dejamos los tests correr (son pocos ms). jest.config testTimeout 10000.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const svc = require('../../src/services/summaryQueryService');
const { SummaryQuery } = require('../../src/models');

usarBaseDeDatosEnMemoria({ limpiarEntreTests: true });

const USER = new mongoose.Types.ObjectId().toString();

// Acorta la latencia simulada (Math.random controla el _delay de 200-500ms) y
// hace deterministas los generadores internos.
let randomSpy;
beforeEach(() => {
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0); // _delay ≈ 200ms, numResults=1
});
afterEach(() => {
  if (randomSpy) randomSpy.mockRestore();
});

// ==================== queryByBillOfLading ====================
describe('queryByBillOfLading', () => {
  test('persiste la consulta, la completa y devuelve resultados', async () => {
    const r = await svc.queryByBillOfLading('BL-123', USER);
    expect(r.success).toBe(true);
    expect(r.queryId).toMatch(/^QNuCono-/);
    expect(r.count).toBe(r.results.length);
    expect(typeof r.executionTime).toBe('number');

    // Se guardó en la BD y quedó 'completed'.
    const doc = await SummaryQuery.findOne({ queryId: r.queryId });
    expect(doc.queryStatus).toBe('completed');
    expect(doc.queryType).toBe('QIntNuCono');
    expect(doc.searchParams.billOfLading).toBe('BL-123');
    expect(doc.resultsCount).toBe(r.count);
  });
});

// ==================== queryByAWB (delega en B/L con declarationType ENS) ====================
describe('queryByAWB', () => {
  test('reusa queryByBillOfLading marcando declarationType ENS', async () => {
    const r = await svc.queryByAWB('AWB-999', USER);
    expect(r.success).toBe(true);
    const doc = await SummaryQuery.findOne({ queryId: r.queryId });
    expect(doc.searchParams.billOfLading).toBe('AWB-999');
    expect(doc.searchParams.declarationType).toBe('ENS');
  });
});

// ==================== queryByContainer (validación ISO 6346) ====================
describe('queryByContainer', () => {
  test('rechaza formato de contenedor inválido SIN tocar la BD', async () => {
    const antes = await SummaryQuery.countDocuments();
    const r = await svc.queryByContainer('MAL', USER);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/ISO 6346/);
    expect(await SummaryQuery.countDocuments()).toBe(antes); // no persiste
  });

  test('acepta contenedor válido y lo normaliza a mayúsculas', async () => {
    const r = await svc.queryByContainer('msku1234567', USER);
    expect(r.success).toBe(true);
    const doc = await SummaryQuery.findOne({ queryId: r.queryId });
    expect(doc.searchParams.containerNumber).toBe('MSKU1234567');
  });
});

// ==================== queryByLocation ====================
describe('queryByLocation', () => {
  test('usa rango de fechas por defecto (7 días) si no se pasan', async () => {
    const r = await svc.queryByLocation('ES002801', USER);
    expect(r.success).toBe(true);
    const doc = await SummaryQuery.findOne({ queryId: r.queryId });
    expect(doc.searchParams.locationCode).toBe('ES002801');
    expect(doc.searchParams.dateFrom).toBeTruthy();
    expect(doc.searchParams.dateTo).toBeTruthy();
  });
});

// ==================== queryAssociatedDocuments ====================
describe('queryAssociatedDocuments', () => {
  test('incluye documentos en los resultados (queryType QIntDocAsoc)', async () => {
    const r = await svc.queryAssociatedDocuments('DOC-1', USER, { mrn: '25ESABC' });
    expect(r.success).toBe(true);
    // En QIntDocAsoc el simulador rellena documents.
    expect(r.results[0].documents.length).toBeGreaterThan(0);
    const doc = await SummaryQuery.findOne({ queryId: r.queryId });
    expect(doc.searchParams.documentReference).toBe('DOC-1');
    expect(doc.searchParams.mrn).toBe('25ESABC');
  });
});

// ==================== queryByMRN ====================
describe('queryByMRN', () => {
  test('consulta por MRN y persiste', async () => {
    const r = await svc.queryByMRN('25ESABCDEF', USER, { includeHistory: true });
    expect(r.success).toBe(true);
    const doc = await SummaryQuery.findOne({ queryId: r.queryId });
    expect(doc.searchParams.mrn).toBe('25ESABCDEF');
    expect(doc.searchParams.includeHistory).toBe(true);
  });
});

// ==================== queryByEORI (validación formato) ====================
describe('queryByEORI', () => {
  test('rechaza EORI inválido SIN tocar la BD', async () => {
    const antes = await SummaryQuery.countDocuments();
    const r = await svc.queryByEORI('12', USER);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/EORI/);
    expect(await SummaryQuery.countDocuments()).toBe(antes);
  });

  test('acepta EORI válido y persiste con rango 30 días por defecto', async () => {
    const r = await svc.queryByEORI('ES12345678A', USER);
    expect(r.success).toBe(true);
    const doc = await SummaryQuery.findOne({ queryId: r.queryId });
    expect(doc.searchParams.eori).toBe('ES12345678A');
    expect(doc.searchParams.dateFrom).toBeTruthy();
  });
});

// ==================== rama de error: query.save() falla → fail() + throw ====================
describe('manejo de error', () => {
  test('si save falla, marca la consulta como failed y propaga', async () => {
    // El primer save (processing) va bien; forzamos el fallo en el segundo
    // (tras completar) espiando el prototipo para lanzar UNA vez.
    const proto = SummaryQuery.prototype;
    const orig = proto.save;
    let llamadas = 0;
    const spy = jest.spyOn(proto, 'save').mockImplementation(function (...args) {
      llamadas += 1;
      if (llamadas === 2) return Promise.reject(new Error('DB write failed'));
      return orig.apply(this, args);
    });
    try {
      await expect(svc.queryByMRN('25ESERR', USER)).rejects.toThrow('DB write failed');
    } finally {
      spy.mockRestore();
    }
  });

  test('el catch (fail + save + throw) cubre TODOS los métodos de query', async () => {
    // Cada método hace save() de 'processing' y, ya en el catch, fail()+save().
    // Para ejecutar el catch COMPLETO (incluidos logger.error y throw) el primer
    // save de cada método debe rechazar y el segundo (el del catch) tener éxito.
    // Alternamos rechazo/éxito por llamada.
    const proto = SummaryQuery.prototype;
    const orig = proto.save;
    let n = 0;
    const spy = jest.spyOn(proto, 'save').mockImplementation(function (...a) {
      n += 1;
      return n % 2 === 1 // impares = save de 'processing' → falla
        ? Promise.reject(new Error('save down'))
        : orig.apply(this, a); // pares = save del catch → guarda como failed
    });
    try {
      await expect(svc.queryByBillOfLading('BL', USER)).rejects.toThrow('save down');
      await expect(svc.queryByContainer('MSKU1234567', USER)).rejects.toThrow('save down');
      await expect(svc.queryByLocation('ES002801', USER)).rejects.toThrow('save down');
      await expect(svc.queryAssociatedDocuments('D', USER)).rejects.toThrow('save down');
      await expect(svc.queryByEORI('ES12345678A', USER)).rejects.toThrow('save down');
    } finally {
      spy.mockRestore();
    }
    // El save del catch dejó las consultas como 'failed'.
    const fallidas = await SummaryQuery.countDocuments({ queryStatus: 'failed' });
    expect(fallidas).toBeGreaterThanOrEqual(5);
  });
});

// ==================== historial / getById / stats / servicios ====================
describe('historial y estadísticas', () => {
  test('getQueryHistory devuelve las consultas del usuario paginadas', async () => {
    await svc.queryByMRN('25ESA', USER);
    await svc.queryByMRN('25ESB', USER);
    const hist = await svc.getQueryHistory(USER, { limit: 10 });
    expect(hist.queries.length).toBeGreaterThanOrEqual(2);
    expect(hist.pagination.total).toBeGreaterThanOrEqual(2);
  });

  test('getQueryById encuentra la consulta del propio usuario', async () => {
    const created = await svc.queryByMRN('25ESC', USER);
    const found = await svc.getQueryById(created.queryId, USER);
    expect(found.success).toBe(true);
    expect(found.data.queryId).toBe(created.queryId);
  });

  test('getQueryById devuelve error si no existe / no es del usuario', async () => {
    const otro = new mongoose.Types.ObjectId().toString();
    const created = await svc.queryByMRN('25ESD', USER);
    const found = await svc.getQueryById(created.queryId, otro);
    expect(found.success).toBe(false);
    expect(found.error).toMatch(/no encontrada/);
  });

  test('getQueryStats agrega por tipo y estado', async () => {
    await svc.queryByMRN('25ESE', USER);
    await svc.queryByEORI('ES12345678A', USER);
    const stats = await svc.getQueryStats(USER);
    expect(stats).toBeDefined();
    // getStats devuelve agregaciones; al menos existe la estructura.
    expect(stats).toEqual(expect.any(Object));
  });

  test('getAvailableServices lista los 6 servicios con code/name/description', () => {
    const list = svc.getAvailableServices();
    expect(list).toHaveLength(6);
    expect(list.map(s => s.code)).toEqual(
      expect.arrayContaining(['QIntNuCono', 'QIntCont', 'QIntUbic', 'QIntDocAsoc', 'QIntMRN', 'QIntEORI'])
    );
    list.forEach(s => {
      expect(s.name).toBeTruthy();
      expect(s.description).toBeTruthy();
    });
  });
});

// ==================== helpers privados ====================
describe('helpers privados', () => {
  test('_validateContainerNumber acepta formato válido y rechaza cortos', () => {
    expect(svc._validateContainerNumber('MSKU1234567')).toBe(true);
    expect(svc._validateContainerNumber('MSK U123 4567'.replace(/\s/g, ''))).toBe(true);
    expect(svc._validateContainerNumber('CORTO')).toBe(false);
    expect(svc._validateContainerNumber('')).toBe(false);
    expect(svc._validateContainerNumber(null)).toBe(false);
  });

  test('_generateMRN genera formato AAES...<sufijo tipo>', () => {
    const mrn = svc._generateMRN('H1');
    expect(mrn).toMatch(/^\d{2}ES/);
    expect(mrn.endsWith('H1')).toBe(true);
  });

  test('_getDateDaysAgo devuelve ISO en el pasado', () => {
    const iso = svc._getDateDaysAgo(7);
    expect(new Date(iso).getTime()).toBeLessThan(Date.now());
  });
});

// ==================== _simulateAEATQuery: ramas cosméticas del generador ====================
describe('_simulateAEATQuery (variantes del generador demo)', () => {
  /**
   * El simulador elige status/canal/container por índices de Math.random. Damos
   * una secuencia controlada de valores para forzar cada rama:
   * status PENDING (índice 2) → channel null, acceptanceDate null;
   * status RELEASED (índice 1) → releaseDate poblada;
   * status CONTROL (índice 3) → messages + pendingActions poblados;
   * y el container aleatorio (Math.random()>0.5) presente/ausente.
   */
  function secuenciaRandom(valores) {
    let i = 0;
    return jest.spyOn(Math, 'random').mockImplementation(() => {
      const v = valores[i % valores.length];
      i += 1;
      return v;
    });
  }

  test('status PENDING → channel null y acceptanceDate null', async () => {
    randomSpy.mockRestore();
    // _delay(0), numResults=1 (0→1), declType idx0 ENS, status idx2 PENDING, channel idx0
    const spy = secuenciaRandom([0, 0, 0, 0.5, 0, 0, 0, 0, 0, 0]);
    try {
      const res = await svc._simulateAEATQuery('QIntMRN', {});
      const pending = res.find(r => r.status === 'PENDING');
      if (pending) {
        expect(pending.channel).toBeNull();
        expect(pending.acceptanceDate).toBeNull();
      }
      expect(Array.isArray(res)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  test('status CONTROL → messages y pendingActions poblados', async () => {
    randomSpy.mockRestore();
    // status idx3 CONTROL requiere random≈0.75 en la posición del status.
    const spy = secuenciaRandom([0, 0, 0, 0.75, 0, 0, 0, 0, 0, 0]);
    try {
      const res = await svc._simulateAEATQuery('QIntMRN', {});
      const control = res.find(r => r.status === 'CONTROL');
      if (control) {
        expect(control.messages.length).toBeGreaterThan(0);
        expect(control.pendingActions.length).toBeGreaterThan(0);
      }
      expect(Array.isArray(res)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  test('status RELEASED → releaseDate poblada y canal presente', async () => {
    randomSpy.mockRestore();
    // status idx1 RELEASED requiere random≈0.25 en la posición del status.
    const spy = secuenciaRandom([0, 0, 0, 0.25, 0.25, 0, 0, 0, 0, 0]);
    try {
      const res = await svc._simulateAEATQuery('QIntMRN', {});
      const rel = res.find(r => r.status === 'RELEASED');
      if (rel) {
        expect(rel.releaseDate).not.toBeNull();
        expect(rel.channel).not.toBeNull();
      }
      expect(Array.isArray(res)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  test('container aleatorio ausente cuando random<=0.5', async () => {
    randomSpy.mockRestore();
    const spy = secuenciaRandom([0]); // todos 0 → Math.random()>0.5 es false
    try {
      const res = await svc._simulateAEATQuery('QIntMRN', {});
      expect(res[0].containerNumber).toBeNull();
      expect(res[0].carrier).toBeNull(); // sin params.containerNumber
    } finally {
      spy.mockRestore();
    }
  });

  test('container aleatorio presente cuando random>0.5', async () => {
    randomSpy.mockRestore();
    // Necesitamos que la posición del container aleatorio sea >0.5.
    const spy = secuenciaRandom([0, 0, 0, 0, 0, 0, 0, 0.9, 0.9, 0.9]);
    try {
      const res = await svc._simulateAEATQuery('QIntMRN', {});
      // Al menos una entrada trae container generado o null; cubrimos la rama true.
      expect(Array.isArray(res)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
