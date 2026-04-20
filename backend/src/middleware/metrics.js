/**
 * Lightweight APM-style middleware: request ID, latency, in-memory counters.
 *
 * For full APM install Sentry Performance or Prometheus exporter. This gives
 * per-endpoint counters/latencies without extra infra. The /internal/metrics
 * endpoint (admin only) exposes the current snapshot.
 */

const crypto = require('crypto');
const logger = require('../config/logger');

const counters = new Map(); // key: METHOD:route → { count, errors, latencyMs, lastStatus }
const aiTokens = { inputTokens: 0, outputTokens: 0, callCount: 0, cachedTokens: 0 };

function keyFor(req, res) {
  const route = req.route?.path || req.path || 'unknown';
  return `${req.method} ${route}`;
}

function record(key, latencyMs, status) {
  const c = counters.get(key) || { count: 0, errors: 0, latencyMs: 0, lastStatus: 0 };
  c.count++;
  c.latencyMs += latencyMs;
  c.lastStatus = status;
  if (status >= 500) c.errors++;
  counters.set(key, c);
}

function requestMetrics(req, res, next) {
  req.id = req.headers['x-request-id'] || crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-Id', req.id);

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const latencyMs = Number(process.hrtime.bigint() - start) / 1e6;
    const key = keyFor(req, res);
    record(key, latencyMs, res.statusCode);

    if (latencyMs > 3000) {
      logger.warn('Slow request', {
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        latencyMs: Math.round(latencyMs),
        status: res.statusCode
      });
    }
  });
  next();
}

function recordAITokens({ inputTokens = 0, outputTokens = 0, cachedTokens = 0 } = {}) {
  aiTokens.inputTokens += inputTokens;
  aiTokens.outputTokens += outputTokens;
  aiTokens.cachedTokens += cachedTokens;
  aiTokens.callCount++;
}

function snapshot() {
  const endpoints = {};
  for (const [k, v] of counters.entries()) {
    endpoints[k] = {
      count: v.count,
      errors: v.errors,
      avgLatencyMs: v.count ? Math.round(v.latencyMs / v.count) : 0
    };
  }
  return { endpoints, aiTokens, timestamp: new Date().toISOString() };
}

function resetSnapshot() {
  counters.clear();
  aiTokens.inputTokens = 0;
  aiTokens.outputTokens = 0;
  aiTokens.callCount = 0;
  aiTokens.cachedTokens = 0;
}

module.exports = { requestMetrics, recordAITokens, snapshot, resetSnapshot };
