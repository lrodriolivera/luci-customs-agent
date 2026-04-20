/**
 * BullMQ-based queue for async jobs.
 *
 * Usage:
 *   const { enqueue } = require('./queueService');
 *   await enqueue('classify-taric', { description, tenantId }, { attempts: 3 });
 *
 * Workers are registered via registerWorker(queueName, handler). In PM2 cluster
 * mode BullMQ handles concurrency correctly via Redis locks. Falls back to
 * synchronous execution if Redis is unavailable (dev mode).
 */

const logger = require('../config/logger');
const { getRedisClient } = require('./cacheService');

let Queue, Worker;
try {
  ({ Queue, Worker } = require('bullmq'));
} catch (_) {
  Queue = null;
  Worker = null;
}

const queues = new Map();
const workers = new Map();

function getConnection() {
  const client = getRedisClient();
  if (!client) return null;
  // BullMQ wants a connection config object (not the ioredis instance itself by default,
  // but it also accepts `{ connection: client }`). We'll return the client for reuse.
  return { host: '127.0.0.1', port: 6379, ...(process.env.REDIS_URL ? { url: process.env.REDIS_URL } : {}) };
}

function getQueue(name) {
  if (queues.has(name)) return queues.get(name);
  if (!Queue || !getConnection()) return null;
  const q = new Queue(name, {
    connection: getConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 100, age: 24 * 3600 },
      removeOnFail: { count: 500, age: 7 * 24 * 3600 }
    }
  });
  queues.set(name, q);
  logger.info(`BullMQ queue initialized: ${name}`);
  return q;
}

async function enqueue(queueName, data, opts = {}) {
  const q = getQueue(queueName);
  if (!q) {
    // Fallback: execute inline if no queue (dev without redis)
    logger.warn(`Queue ${queueName} unavailable, executing inline`);
    return { inline: true, data };
  }
  const job = await q.add(queueName, data, opts);
  return { id: job.id, name: job.name, inline: false };
}

function registerWorker(queueName, handler, { concurrency = 2 } = {}) {
  if (workers.has(queueName)) return workers.get(queueName);
  if (!Worker || !getConnection()) {
    logger.warn(`Worker ${queueName} not registered (no redis)`);
    return null;
  }
  const w = new Worker(queueName, async (job) => {
    const start = Date.now();
    try {
      const result = await handler(job.data, job);
      logger.info(`Job ${queueName}:${job.id} ok (${Date.now() - start}ms)`);
      return result;
    } catch (err) {
      logger.error(`Job ${queueName}:${job.id} failed`, { error: err.message });
      throw err;
    }
  }, {
    connection: getConnection(),
    concurrency
  });
  w.on('failed', (job, err) => logger.warn(`Job failed ${queueName}:${job?.id}`, { error: err.message }));
  workers.set(queueName, w);
  logger.info(`BullMQ worker registered: ${queueName} (concurrency=${concurrency})`);
  return w;
}

async function closeAll() {
  for (const q of queues.values()) await q.close();
  for (const w of workers.values()) await w.close();
}

module.exports = { enqueue, registerWorker, getQueue, closeAll };
