describe('metrics middleware', () => {
  let metrics;
  beforeEach(() => {
    jest.resetModules();
    metrics = require('../src/middleware/metrics');
    metrics.resetSnapshot();
  });

  function mockReqRes(method, path, status) {
    const listeners = {};
    const req = { method, path, originalUrl: path, route: { path }, headers: {} };
    const res = {
      statusCode: status,
      setHeader: () => {},
      on: (evt, fn) => { listeners[evt] = fn; }
    };
    return { req, res, fire: () => listeners.finish && listeners.finish() };
  }

  test('attaches X-Request-Id header and request id', (done) => {
    const { req, res } = mockReqRes('GET', '/api/test', 200);
    let headerSet = null;
    res.setHeader = (k, v) => { if (k === 'X-Request-Id') headerSet = v; };
    metrics.requestMetrics(req, res, () => {
      expect(req.id).toBeDefined();
      expect(headerSet).toBe(req.id);
      done();
    });
  });

  test('records successful endpoint hit', () => {
    const { req, res, fire } = mockReqRes('GET', '/api/x', 200);
    metrics.requestMetrics(req, res, () => {});
    fire();
    const snap = metrics.snapshot();
    expect(snap.endpoints['GET /api/x']).toBeDefined();
    expect(snap.endpoints['GET /api/x'].count).toBe(1);
    expect(snap.endpoints['GET /api/x'].errors).toBe(0);
  });

  test('records 5xx as error', () => {
    const { req, res, fire } = mockReqRes('POST', '/api/fail', 500);
    metrics.requestMetrics(req, res, () => {});
    fire();
    expect(metrics.snapshot().endpoints['POST /api/fail'].errors).toBe(1);
  });

  test('recordAITokens accumulates', () => {
    metrics.recordAITokens({ inputTokens: 100, outputTokens: 50 });
    metrics.recordAITokens({ inputTokens: 200, outputTokens: 75, cachedTokens: 30 });
    const snap = metrics.snapshot();
    expect(snap.aiTokens).toEqual({
      inputTokens: 300,
      outputTokens: 125,
      cachedTokens: 30,
      callCount: 2
    });
  });
});
