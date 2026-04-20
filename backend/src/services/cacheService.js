/**
 * Pluggable cache with TTL.
 *
 * - CACHE_BACKEND=memory (default): in-process Map, fast but NOT shared across PM2 workers.
 * - CACHE_BACKEND=redis: uses ioredis via REDIS_URL. Shared across workers/hosts.
 *
 * Both backends expose the same async API: get/set/del/delPattern/flushAll/stats.
 *
 * Values are JSON-serialized transparently for Redis; memory cache stores raw objects.
 */

const logger = require('../config/logger');

class MemoryCache {
  constructor({ maxEntries = 5000 } = {}) {
    this.store = new Map();
    this.maxEntries = maxEntries;
  }

  _evictIfNeeded() {
    if (this.store.size <= this.maxEntries) return;
    const toEvict = Math.ceil(this.maxEntries * 0.1);
    const keys = this.store.keys();
    for (let i = 0; i < toEvict; i++) {
      const k = keys.next().value;
      if (k) this.store.delete(k);
    }
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, ttlSeconds) {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
    this._evictIfNeeded();
  }

  async del(key) { this.store.delete(key); }

  async delPattern(prefix) {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) this.store.delete(k);
    }
  }

  async flushAll() { this.store.clear(); }

  stats() { return { backend: 'memory', size: this.store.size, maxEntries: this.maxEntries }; }
}

class RedisCache {
  constructor(client, { keyPrefix = 'luci:' } = {}) {
    this.client = client;
    this.keyPrefix = keyPrefix;
  }

  _k(k) { return this.keyPrefix + k; }

  async get(key) {
    const raw = await this.client.get(this._k(key));
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  }

  async set(key, value, ttlSeconds) {
    const s = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.set(this._k(key), s, 'EX', Math.ceil(ttlSeconds));
    } else {
      await this.client.set(this._k(key), s);
    }
  }

  async del(key) { await this.client.del(this._k(key)); }

  async delPattern(prefix) {
    const pattern = this._k(prefix) + '*';
    const stream = this.client.scanStream({ match: pattern, count: 200 });
    const toDelete = [];
    await new Promise((resolve, reject) => {
      stream.on('data', keys => toDelete.push(...keys));
      stream.on('end', resolve);
      stream.on('error', reject);
    });
    if (toDelete.length) await this.client.del(...toDelete);
  }

  async flushAll() {
    const stream = this.client.scanStream({ match: this.keyPrefix + '*', count: 500 });
    const toDelete = [];
    await new Promise((resolve, reject) => {
      stream.on('data', keys => toDelete.push(...keys));
      stream.on('end', resolve);
      stream.on('error', reject);
    });
    if (toDelete.length) await this.client.del(...toDelete);
  }

  stats() { return { backend: 'redis', keyPrefix: this.keyPrefix, status: this.client.status }; }
}

let cache;
let redisClient;

function getRedisClient() {
  if (redisClient) return redisClient;
  try {
    const Redis = require('ioredis');
    const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: false
    });
    redisClient.on('error', (err) => logger.warn('Redis error', { error: err.message }));
    redisClient.on('connect', () => logger.info('Redis connected'));
    return redisClient;
  } catch (err) {
    logger.warn('ioredis not available, falling back to memory cache', { error: err.message });
    return null;
  }
}

function getCache() {
  if (cache) return cache;
  if (process.env.CACHE_BACKEND === 'redis') {
    const client = getRedisClient();
    if (client) {
      cache = new RedisCache(client, { keyPrefix: process.env.CACHE_PREFIX || 'luci:' });
      logger.info('Cache initialized', cache.stats());
      return cache;
    }
  }
  cache = new MemoryCache({ maxEntries: Number(process.env.CACHE_MAX_ENTRIES) || 5000 });
  logger.info('Cache initialized', cache.stats());
  return cache;
}

module.exports = { getCache, getRedisClient };
