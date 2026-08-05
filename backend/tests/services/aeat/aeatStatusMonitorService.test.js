/**
 * Tests for AEAT Status Monitor Service
 * Phase 6.1: Intelligent Status Monitoring Tests
 *
 * ESTRATEGIA DE MOCKING (fronteras, no logica bajo prueba):
 * - `cacheService.getRedisClient` -> null: fuerza el fallback in-memory del
 *   RedisBackedMap, sin necesidad de un Redis vivo. La logica del Map corre real.
 * - `aeatRealService.queryDeclarationStatus`: es la unica salida a red/AEAT del
 *   servicio; se mockea SIEMPRE para que ningun test consulte a Hacienda. El
 *   resto (analisis de riesgo, alertas, predicciones, portfolio) es logica pura
 *   que se ejecuta de verdad.
 * - `analytics/predictionsService.predictChannel`: frontera del motor ML; se
 *   mockea para probar tanto el camino feliz como el fallback heuristico.
 * - Sin Mongo: este servicio no toca Mongoose, asi que NO usamos memoryDb ni
 *   fake timers junto a BD. El polling se prueba invocando el metodo de trabajo
 *   directamente (_pollAllDeclarations) sin arrancar setInterval.
 */

// Mock cacheService to prevent Redis connection
jest.mock('../../../src/services/cacheService', () => ({
  getRedisClient: jest.fn().mockReturnValue(null)
}));

// Mock del motor ML de prediccion (frontera de predictInspectionChannel)
jest.mock('../../../src/services/analytics/predictionsService', () => ({
  predictChannel: jest.fn()
}));

// Mock logger
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock aiService
jest.mock('../../../src/services/aiService', () => ({
  analyzeWithLuci: jest.fn().mockResolvedValue({
    summary: 'Status analysis complete',
    recommendations: ['Continue monitoring'],
    predictedChannel: 'green',
    riskScore: 15
  })
}));

// Mock aeatRealService
jest.mock('../../../src/services/aeat/aeatRealService', () => ({
  queryDeclarationStatus: jest.fn().mockResolvedValue({
    success: true,
    data: {
      status: 'accepted',
      channel: 'green',
      timestamp: new Date().toISOString()
    }
  })
}));

const aeatStatusMonitorService = require('../../../src/services/aeat/aeatStatusMonitorService');

describe('AEAT Status Monitor Service', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Clear tracked declarations using the RedisBackedMap's clear method (falls back to in-memory)
    await aeatStatusMonitorService.trackedDeclarations.clear();
  });

  describe('Declaration Tracking', () => {
    test('should track a declaration', async () => {
      const result = await aeatStatusMonitorService.trackDeclaration('26ESTEST123456', 'H1', {
        expeditionId: 'exp-001',
        userId: 'user-001'
      });

      expect(result).toBeDefined();
      expect(result.mrn).toBe('26ESTEST123456');
      expect(result.success).toBe(true);
      expect(result.tracking).toBeDefined();
      expect(result.tracking.type).toBe('H1');
    });

    test('should list tracked declarations', async () => {
      await aeatStatusMonitorService.trackDeclaration('MRN1', 'H1', {});
      await aeatStatusMonitorService.trackDeclaration('MRN2', 'AES', {});

      const result = await aeatStatusMonitorService.listTrackedDeclarations();

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('declarations');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('luciAnalysis');
      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(result.declarations)).toBe(true);
    });

    test('should get specific declaration tracking info', async () => {
      await aeatStatusMonitorService.trackDeclaration('TEST-MRN', 'H1', {});

      const result = await aeatStatusMonitorService.getTrackedDeclaration('TEST-MRN');

      expect(result).toBeDefined();
      expect(result.mrn).toBe('TEST-MRN');
    });

    test('should untrack a declaration', async () => {
      await aeatStatusMonitorService.trackDeclaration('MRN-TO-REMOVE', 'H1', {});
      const tracked = await aeatStatusMonitorService.getTrackedDeclaration('MRN-TO-REMOVE');
      expect(tracked).toBeDefined();

      const result = await aeatStatusMonitorService.untrackDeclaration('MRN-TO-REMOVE');

      expect(result.success).toBe(true);
      const afterRemove = await aeatStatusMonitorService.getTrackedDeclaration('MRN-TO-REMOVE');
      expect(afterRemove).toBeUndefined();
    });
  });

  describe('Channel Prediction', () => {
    test('should calculate risk-based probabilities', () => {
      const lowRisk = aeatStatusMonitorService._calculateChannelProbabilities(5);
      const highRisk = aeatStatusMonitorService._calculateChannelProbabilities(80);

      expect(lowRisk.green).toBeGreaterThan(highRisk.green);
      expect(highRisk.red).toBeGreaterThan(lowRisk.red);
    });

    test('should return all channel probabilities', () => {
      const probs = aeatStatusMonitorService._calculateChannelProbabilities(30);

      expect(probs).toHaveProperty('green');
      expect(probs).toHaveProperty('orange');
      expect(probs).toHaveProperty('red');
      expect(probs).toHaveProperty('yellow');
    });

    test('probabilities should sum to 1', () => {
      const probs = aeatStatusMonitorService._calculateChannelProbabilities(50);
      const sum = probs.green + probs.orange + probs.red + probs.yellow;

      expect(sum).toBeCloseTo(1, 2);
    });
  });

  describe('Alert Management', () => {
    test('should get active alerts from tracked declarations', async () => {
      // Track a declaration first
      await aeatStatusMonitorService.trackDeclaration('TEST-MRN', 'H1', {});

      // getActiveAlerts returns { total, critical, warning, alerts }
      const result = await aeatStatusMonitorService.getActiveAlerts();

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('alerts');
      expect(Array.isArray(result.alerts)).toBe(true);
    });
  });

  describe('Polling Configuration', () => {
    test('should have polling config', () => {
      expect(aeatStatusMonitorService.pollingConfig).toBeDefined();
    });

    test('should have start and stop polling methods', () => {
      expect(typeof aeatStatusMonitorService.startPolling).toBe('function');
      expect(typeof aeatStatusMonitorService.stopPolling).toBe('function');
    });
  });

  describe('Service Methods', () => {
    test('should have trackDeclaration method', () => {
      expect(typeof aeatStatusMonitorService.trackDeclaration).toBe('function');
    });

    test('should have refreshDeclarationStatus method', () => {
      expect(typeof aeatStatusMonitorService.refreshDeclarationStatus).toBe('function');
    });

    test('should have listTrackedDeclarations method', () => {
      expect(typeof aeatStatusMonitorService.listTrackedDeclarations).toBe('function');
    });

    test('should have getTrackedDeclaration method', () => {
      expect(typeof aeatStatusMonitorService.getTrackedDeclaration).toBe('function');
    });

    test('should have getActiveAlerts method', () => {
      expect(typeof aeatStatusMonitorService.getActiveAlerts).toBe('function');
    });

    test('should have getInfo method', () => {
      expect(typeof aeatStatusMonitorService.getInfo).toBe('function');
    });
  });

  describe('Service Info', () => {
    test('should return service information', async () => {
      const info = await aeatStatusMonitorService.getInfo();

      expect(info).toBeDefined();
      expect(info).toHaveProperty('service');
      expect(info).toHaveProperty('trackedDeclarations');
      expect(info).toHaveProperty('pollingEnabled');
    });
  });

  describe('Filtering Tracked Declarations', () => {
    beforeEach(async () => {
      await aeatStatusMonitorService.trackedDeclarations.clear();
      await aeatStatusMonitorService.trackDeclaration('MRN-H1', 'H1', {});
      await aeatStatusMonitorService.trackDeclaration('MRN-AES', 'AES', {});
    });

    test('should filter by type', async () => {
      const result = await aeatStatusMonitorService.listTrackedDeclarations({ type: 'H1' });

      expect(result.declarations.length).toBeGreaterThanOrEqual(1);
      // Check that at least one result has type H1
      const hasH1 = result.declarations.some(d => d.type === 'H1');
      expect(hasH1).toBe(true);
    });

    test('filtra por status', async () => {
      const result = await aeatStatusMonitorService.listTrackedDeclarations({ status: 'PENDING' });
      expect(result.declarations.every(d => d.currentStatus === 'PENDING')).toBe(true);
    });

    test('filtra por channel (ninguno tiene canal aun)', async () => {
      const result = await aeatStatusMonitorService.listTrackedDeclarations({ channel: 'green' });
      expect(result.declarations.length).toBe(0);
    });

    test('filtra por hasAlerts (ninguno tiene alertas aun)', async () => {
      const result = await aeatStatusMonitorService.listTrackedDeclarations({ hasAlerts: true });
      expect(result.declarations.length).toBe(0);
    });
  });
});

// ============================================================================
// Bloque ampliado: cubre las ramas de analisis (prediccion de riesgo, cambios
// de estado, siguiente paso, estimacion, portfolio) y el polling. Todo logica
// pura salvo aeatRealService, que esta mockeado.
// ============================================================================

const aeatRealService = require('../../../src/services/aeat/aeatRealService');
const predictionsService = require('../../../src/services/analytics/predictionsService');
const svc = aeatStatusMonitorService;

describe('AEAT Status Monitor - analisis y ramas', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await svc.trackedDeclarations.clear();
    svc.stopPolling();
  });

  afterEach(() => {
    svc.stopPolling();
  });

  // ------------------- _generateInitialPrediction (via trackDeclaration) -----
  describe('prediccion inicial de riesgo', () => {
    async function trackYLeer(metadata) {
      await svc.trackDeclaration('MRN-RISK', 'H1', metadata);
      // _generateInitialPrediction corre en un Promise.resolve no esperado;
      // le damos un tick para que persista antes de leer.
      await new Promise(r => setImmediate(r));
      return svc.getTrackedDeclaration('MRN-RISK');
    }

    test('pais de origen de alto riesgo suma 15 al score', async () => {
      const t = await trackYLeer({ originCountry: 'CN' });
      expect(t.luciPredictions.riskScore).toBeGreaterThanOrEqual(15);
      expect(t.luciPredictions.riskFactors.some(f => f.factor.includes('País de origen'))).toBe(true);
    });

    test('capitulo TARIC sensible suma 10', async () => {
      const t = await trackYLeer({ taricCode: '6109100010' });
      expect(t.luciPredictions.riskFactors.some(f => f.factor.includes('producto sensible'))).toBe(true);
    });

    test('valor alto por encima del umbral suma 12', async () => {
      const t = await trackYLeer({ customsValue: 100000 });
      expect(t.luciPredictions.riskFactors.some(f => f.factor.includes('Valor alto'))).toBe(true);
    });

    test('primera operacion con proveedor suma 8', async () => {
      const t = await trackYLeer({ firstTimeSupplier: true });
      expect(t.luciPredictions.riskFactors.some(f => f.factor.includes('Primera operación'))).toBe(true);
    });

    test('varios factores a la vez elevan el riskLevel a high', async () => {
      const t = await trackYLeer({ originCountry: 'CN', taricCode: '8501000000', customsValue: 100000, firstTimeSupplier: true });
      expect(t.luciPredictions.riskLevel).toBe('high');
    });

    test('sin factores de riesgo el nivel es low', async () => {
      const t = await trackYLeer({ originCountry: 'DE', taricCode: '9403000000', customsValue: 100 });
      expect(t.luciPredictions.riskLevel).toBe('low');
    });
  });

  // ------------------- _calculateChannelProbabilities (todos los tramos) -----
  describe('_calculateChannelProbabilities por tramos de score', () => {
    test.each([
      [5, 0.92],
      [15, 0.78],
      [25, 0.55],
      [40, 0.30],
      [60, 0.15]
    ])('score %i -> green %f', (score, greenEsperado) => {
      const p = svc._calculateChannelProbabilities(score);
      expect(p.green).toBe(greenEsperado);
    });
  });

  // ------------------- _generateRiskRecommendations --------------------------
  describe('_generateRiskRecommendations', () => {
    test('alta probabilidad de control genera recomendacion high de documentacion', () => {
      const recs = svc._generateRiskRecommendations([], { green: 0.5, orange: 0.3, red: 0.2, yellow: 0 });
      expect(recs.some(r => r.priority === 'high')).toBe(true);
    });

    test('recomendacion especifica por pais de origen', () => {
      const recs = svc._generateRiskRecommendations(
        [{ factor: 'País de origen de alto riesgo', country: 'CN' }],
        { green: 0.9, orange: 0.05, red: 0.05, yellow: 0 }
      );
      expect(recs.some(r => r.action.includes('certificado de origen'))).toBe(true);
    });

    test('recomendacion por valor alto', () => {
      const recs = svc._generateRiskRecommendations(
        [{ factor: 'Valor alto declarado' }],
        { green: 0.9, orange: 0.05, red: 0.05, yellow: 0 }
      );
      expect(recs.some(r => r.action.includes('justificación de valor'))).toBe(true);
    });

    test('recomendacion por producto sensible', () => {
      const recs = svc._generateRiskRecommendations(
        [{ factor: 'Categoría de producto sensible' }],
        { green: 0.9, orange: 0.05, red: 0.05, yellow: 0 }
      );
      expect(recs.some(r => r.action.includes('requisitos específicos'))).toBe(true);
    });

    test('bajo riesgo (>0.80 verde) genera recomendacion info', () => {
      const recs = svc._generateRiskRecommendations([], { green: 0.92, orange: 0.06, red: 0.02, yellow: 0 });
      expect(recs.some(r => r.priority === 'info')).toBe(true);
    });
  });

  // ------------------- refreshDeclarationStatus ------------------------------
  describe('refreshDeclarationStatus', () => {
    test('devuelve error si la declaracion no esta en seguimiento', async () => {
      const r = await svc.refreshDeclarationStatus('NO-EXISTE', 'cert', 'pass');
      expect(r.success).toBe(false);
      expect(r.error).toContain('no encontrada');
    });

    test('actualiza estado y canal cuando AEAT responde OK', async () => {
      await svc.trackDeclaration('MRN-REF', 'H1', {});
      aeatRealService.queryDeclarationStatus.mockResolvedValue({
        success: true, status: 'PROCESSING', channel: 'green', messages: []
      });
      const r = await svc.refreshDeclarationStatus('MRN-REF', 'cert', 'pass');
      expect(r.success).toBe(true);
      expect(r.tracking.currentStatus).toBe('PROCESSING');
      expect(r.tracking.channel).toBe('green');
      expect(r.changed).toBe(true);
    });

    test('canal naranja genera alerta warning y emite evento', async () => {
      await svc.trackDeclaration('MRN-ORANGE', 'H1', {});
      aeatRealService.queryDeclarationStatus.mockResolvedValue({
        success: true, status: 'PROCESSING', channel: 'orange', messages: []
      });
      const evento = new Promise(res => svc.once('statusChange', res));
      const r = await svc.refreshDeclarationStatus('MRN-ORANGE', 'cert', 'pass');
      expect(r.tracking.alerts.some(a => a.type === 'channel_orange')).toBe(true);
      await evento; // confirma que se emitio statusChange
    });

    test('canal rojo genera alerta critical', async () => {
      await svc.trackDeclaration('MRN-RED', 'H1', {});
      aeatRealService.queryDeclarationStatus.mockResolvedValue({
        success: true, status: 'INSPECTION', channel: 'red', messages: []
      });
      const r = await svc.refreshDeclarationStatus('MRN-RED', 'cert', 'pass');
      expect(r.tracking.alerts.some(a => a.level === 'critical' && a.type === 'channel_red')).toBe(true);
    });

    test('estado RELEASED genera alerta de levante', async () => {
      await svc.trackDeclaration('MRN-REL', 'H1', {});
      aeatRealService.queryDeclarationStatus.mockResolvedValue({
        success: true, status: 'RELEASED', channel: 'green', messages: []
      });
      const r = await svc.refreshDeclarationStatus('MRN-REL', 'cert', 'pass');
      expect(r.tracking.alerts.some(a => a.type === 'released')).toBe(true);
    });

    test('estado REJECTED genera alerta critical de rechazo', async () => {
      await svc.trackDeclaration('MRN-REJ', 'H1', {});
      aeatRealService.queryDeclarationStatus.mockResolvedValue({
        success: true, status: 'REJECTED', channel: null, messages: []
      });
      const r = await svc.refreshDeclarationStatus('MRN-REJ', 'cert', 'pass');
      expect(r.tracking.alerts.some(a => a.type === 'rejected')).toBe(true);
    });

    test('sin cambio de estado ni canal, changed es false y no hay alerta nueva', async () => {
      await svc.trackDeclaration('MRN-SAME', 'H1', {});
      // Primer refresh fija PENDING -> se queda igual porque el mock devuelve PENDING/null
      aeatRealService.queryDeclarationStatus.mockResolvedValue({
        success: true, status: 'PENDING', channel: null, messages: []
      });
      const r = await svc.refreshDeclarationStatus('MRN-SAME', 'cert', 'pass');
      expect(r.changed).toBe(false);
    });

    test('propaga la respuesta cuando AEAT devuelve success:false', async () => {
      await svc.trackDeclaration('MRN-FAIL', 'H1', {});
      aeatRealService.queryDeclarationStatus.mockResolvedValue({ success: false, error: 'timeout AEAT' });
      const r = await svc.refreshDeclarationStatus('MRN-FAIL', 'cert', 'pass');
      expect(r.success).toBe(false);
      expect(r.error).toBe('timeout AEAT');
    });

    test('captura excepciones del servicio real', async () => {
      await svc.trackDeclaration('MRN-THROW', 'H1', {});
      aeatRealService.queryDeclarationStatus.mockRejectedValue(new Error('conexion caida'));
      const r = await svc.refreshDeclarationStatus('MRN-THROW', 'cert', 'pass');
      expect(r.success).toBe(false);
      expect(r.error).toBe('conexion caida');
    });
  });

  // ------------------- _analyzeNextStep --------------------------------------
  describe('_analyzeNextStep', () => {
    test('RELEASED -> paso Completado', () => {
      expect(svc._analyzeNextStep({}, { status: 'RELEASED' }).step).toBe('Completado');
    });
    test('canal verde -> esperar levante', () => {
      expect(svc._analyzeNextStep({}, { channel: 'green' }).step).toBe('Esperar levante');
    });
    test('canal naranja -> responder requerimiento', () => {
      expect(svc._analyzeNextStep({}, { channel: 'orange' }).step).toBe('Responder requerimiento');
    });
    test('canal rojo -> coordinar inspeccion', () => {
      expect(svc._analyzeNextStep({}, { channel: 'red' }).step).toBe('Coordinar inspección');
    });
    test('sin canal ni estado -> Pendiente', () => {
      expect(svc._analyzeNextStep({}, {}).step).toBe('Pendiente');
    });
  });

  // ------------------- _estimateCompletion -----------------------------------
  describe('_estimateCompletion', () => {
    test.each(['green', 'orange', 'red', 'yellow'])('estima para canal %s', (canal) => {
      const e = svc._estimateCompletion({}, { channel: canal });
      expect(e.channel).toBe(canal);
      expect(e.estimate).toBeDefined();
    });
    test('canal desconocido usa el estimado por defecto', () => {
      const e = svc._estimateCompletion({}, { channel: 'desconocido' });
      expect(e.estimate.max).toBe(30);
    });
    test('canal verde incluye nota de levante automatico', () => {
      const e = svc._estimateCompletion({}, { channel: 'green' });
      expect(e.note).toContain('automático');
    });
  });

  // ------------------- _evaluatePrediction -----------------------------------
  describe('_evaluatePrediction', () => {
    test('null si no hay probabilidades previas', () => {
      expect(svc._evaluatePrediction({}, 'green')).toBeNull();
    });
    test('marca correct cuando el canal mas probable coincide', () => {
      const ev = svc._evaluatePrediction(
        { channelProbabilities: { green: 0.9, orange: 0.05, red: 0.05, yellow: 0 } }, 'green'
      );
      expect(ev.correct).toBe(true);
    });
    test('marca incorrecto cuando difiere', () => {
      const ev = svc._evaluatePrediction(
        { channelProbabilities: { green: 0.9, orange: 0.05, red: 0.05, yellow: 0 } }, 'red'
      );
      expect(ev.correct).toBe(false);
    });
  });

  // ------------------- _analyzePortfolio (via listTrackedDeclarations) -------
  describe('portfolio', () => {
    test('portfolio vacio devuelve status empty', async () => {
      const r = await svc.listTrackedDeclarations();
      expect(r.luciAnalysis.status).toBe('empty');
    });

    test('portfolio con declaracion en naranja recomienda gestionarla', async () => {
      await svc.trackDeclaration('MRN-P1', 'H1', {});
      aeatRealService.queryDeclarationStatus.mockResolvedValue({ success: true, status: 'PROCESSING', channel: 'orange' });
      await svc.refreshDeclarationStatus('MRN-P1', 'c', 'p');
      const r = await svc.listTrackedDeclarations();
      expect(r.luciAnalysis.recommendations.some(rec => rec.action.includes('naranja'))).toBe(true);
    });

    test('portfolio con declaracion en rojo genera recomendacion critical', async () => {
      await svc.trackDeclaration('MRN-P2', 'H1', {});
      aeatRealService.queryDeclarationStatus.mockResolvedValue({ success: true, status: 'INSPECTION', channel: 'red' });
      await svc.refreshDeclarationStatus('MRN-P2', 'c', 'p');
      const r = await svc.listTrackedDeclarations();
      expect(r.luciAnalysis.recommendations.some(rec => rec.priority === 'critical')).toBe(true);
    });
  });

  // ------------------- getActiveAlerts (orden por nivel) ---------------------
  describe('getActiveAlerts ordenacion', () => {
    test('ordena critical antes que warning', async () => {
      await svc.trackDeclaration('MRN-A1', 'H1', {});
      aeatRealService.queryDeclarationStatus.mockResolvedValue({ success: true, status: 'PROCESSING', channel: 'orange' });
      await svc.refreshDeclarationStatus('MRN-A1', 'c', 'p');
      await svc.trackDeclaration('MRN-A2', 'H1', {});
      aeatRealService.queryDeclarationStatus.mockResolvedValue({ success: true, status: 'INSPECTION', channel: 'red' });
      await svc.refreshDeclarationStatus('MRN-A2', 'c', 'p');

      const res = await svc.getActiveAlerts();
      expect(res.critical).toBeGreaterThanOrEqual(1);
      expect(res.warning).toBeGreaterThanOrEqual(1);
      // Guard del bug del sort: la primera posicion DEBE ser critical. El
      // codigo original usaba `levelOrder[a.level] || 99` y como el indice de
      // critical es 0 (falsy) las alertas criticas caian al final.
      const idxCritical = res.alerts.findIndex(a => a.level === 'critical');
      const idxWarning = res.alerts.findIndex(a => a.level === 'warning');
      expect(idxCritical).toBeLessThan(idxWarning);
      expect(res.alerts[0].level).toBe('critical');
    });
  });

  // ------------------- polling -----------------------------------------------
  describe('polling', () => {
    test('startPolling arranca y stopPolling detiene', () => {
      const start = svc.startPolling('cert', 'pass');
      expect(start.success).toBe(true);
      const stop = svc.stopPolling();
      expect(stop.success).toBe(true);
    });

    test('startPolling dos veces avisa de que ya esta activo', () => {
      svc.startPolling('c', 'p');
      const segundo = svc.startPolling('c', 'p');
      expect(segundo.success).toBe(false);
      svc.stopPolling();
    });

    test('stopPolling sin polling activo devuelve success:false', () => {
      const r = svc.stopPolling();
      expect(r.success).toBe(false);
    });

    test('_pollAllDeclarations no hace nada si polling deshabilitado', async () => {
      svc.pollingConfig.enabled = false;
      await svc.trackDeclaration('MRN-POLL', 'H1', {});
      await svc._pollAllDeclarations();
      expect(aeatRealService.queryDeclarationStatus).not.toHaveBeenCalled();
    });

    test('_pollAllDeclarations salta declaraciones completadas', async () => {
      svc.pollingConfig.enabled = true;
      svc.pollingConfig.certificateId = 'c';
      svc.pollingConfig.password = 'p';
      // Una RELEASED (se salta) y una PENDING (se consulta)
      await svc.trackDeclaration('MRN-DONE', 'H1', {});
      let done = await svc.getTrackedDeclaration('MRN-DONE');
      done.currentStatus = 'RELEASED';
      await svc.trackedDeclarations.set('MRN-DONE', done);
      await svc.trackDeclaration('MRN-LIVE', 'H1', {});
      aeatRealService.queryDeclarationStatus.mockResolvedValue({ success: true, status: 'PROCESSING', channel: 'green' });

      await svc._pollAllDeclarations();

      // Solo se consulto la declaracion viva, no la RELEASED
      const mrnsConsultados = aeatRealService.queryDeclarationStatus.mock.calls.map(c => c[0]);
      expect(mrnsConsultados).toContain('MRN-LIVE');
      expect(mrnsConsultados).not.toContain('MRN-DONE');
      svc.pollingConfig.enabled = false;
    });

    test('_pollAllDeclarations con lista vacia no revienta', async () => {
      svc.pollingConfig.enabled = true;
      await svc._pollAllDeclarations();
      svc.pollingConfig.enabled = false;
    });
  });

  // ------------------- predictInspectionChannel ------------------------------
  describe('predictInspectionChannel', () => {
    test('usa el motor ML cuando responde', async () => {
      predictionsService.predictChannel.mockResolvedValue({ channel: 'orange', probability: 0.6 });
      const r = await svc.predictInspectionChannel({
        operationData: { operationType: 'import', originCountry: 'DE' },
        goods: [{ taricCode: '8471300000' }],
        transport: { mode: '3' }
      });
      expect(r.method).toBe('historical_ml');
      expect(r.channel).toBe('orange');
    });

    test('mapea operationType export', async () => {
      predictionsService.predictChannel.mockResolvedValue({ channel: 'green' });
      await svc.predictInspectionChannel({ operationData: { operationType: 'export' } });
      expect(predictionsService.predictChannel.mock.calls[0][0].type).toBe('export');
    });

    test('fallback heuristico: origen alto riesgo + TARIC sensible -> rojo', async () => {
      predictionsService.predictChannel.mockRejectedValue(new Error('ML caido'));
      const r = await svc.predictInspectionChannel({
        operationData: { originCountry: 'CN' },
        goods: [{ taricCode: '2402200000' }]
      });
      expect(r.method).toBe('heuristic_fallback');
      expect(r.channel).toBe('red');
    });

    test('fallback heuristico: solo un factor de riesgo -> naranja', async () => {
      predictionsService.predictChannel.mockRejectedValue(new Error('ML caido'));
      const r = await svc.predictInspectionChannel({
        operationData: { originCountry: 'CN' },
        goods: [{ taricCode: '9403000000' }]
      });
      expect(r.channel).toBe('orange');
    });

    test('fallback heuristico: sin factores -> verde', async () => {
      predictionsService.predictChannel.mockRejectedValue(new Error('ML caido'));
      const r = await svc.predictInspectionChannel({
        operationData: { originCountry: 'DE' },
        goods: [{ taricCode: '9403000000' }]
      });
      expect(r.channel).toBe('green');
    });

    test('sin argumentos usa defaults sin reventar', async () => {
      predictionsService.predictChannel.mockResolvedValue({ channel: 'green' });
      const r = await svc.predictInspectionChannel();
      expect(r).toBeDefined();
    });
  });

  // ------------------- getInfo -----------------------------------------------
  describe('getInfo', () => {
    test('refleja el numero de declaraciones en seguimiento', async () => {
      await svc.trackDeclaration('MRN-INFO', 'H1', {});
      const info = await svc.getInfo();
      expect(info.trackedDeclarations).toBeGreaterThanOrEqual(1);
      expect(info.features.length).toBeGreaterThan(0);
    });
  });

  // ------------------- untrack de declaracion inexistente --------------------
  describe('untrackDeclaration', () => {
    test('devuelve success:false si no existia', async () => {
      const r = await svc.untrackDeclaration('NO-EXISTE-JAMAS');
      expect(r.success).toBe(false);
    });
  });
});
