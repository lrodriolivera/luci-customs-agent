/**
 * Example worker: TARIC classification batch jobs.
 *
 * Boots alongside the HTTP server. Handles jobs from the 'classify-taric-batch'
 * queue. Adds a new job via queueService.enqueue(...) from a controller.
 *
 * Starts only if ENABLE_QUEUE_WORKERS=true (set it in .env of ONE worker host
 * only, or in a dedicated worker process, to avoid duplicated processing in
 * PM2 cluster).
 */

const { registerWorker } = require('../services/queueService');
const logger = require('../config/logger');

function start() {
  if (process.env.ENABLE_QUEUE_WORKERS !== 'true') {
    logger.info('Queue workers disabled (ENABLE_QUEUE_WORKERS=false)');
    return;
  }
  registerWorker('classify-taric-batch', async (data, job) => {
    const { items = [], tenantId } = data;
    const results = [];
    for (const [idx, item] of items.entries()) {
      // Placeholder: call aiService.classifyTaric(item.description)
      results.push({ index: idx, classified: true });
      if (idx % 5 === 0) await job.updateProgress(Math.round((idx / items.length) * 100));
    }
    return { tenantId, processed: results.length };
  }, { concurrency: 2 });
}

module.exports = { start };
