/**
 * Netherlands DMS/DECO Status Monitor
 * Monitors declaration statuses, correction deadlines, and system health
 */
const logger = require('../../../config/logger');

class NLStatusMonitor {
  constructor(netherlandsService) {
    this.service = netherlandsService;
    this.pollingInterval = null;
    this.pendingDeclarations = new Map();
  }

  /**
   * Start monitoring a declaration
   */
  track(expeditionId, mrn) {
    this.pendingDeclarations.set(mrn, {
      expeditionId,
      mrn,
      trackedSince: new Date(),
      lastChecked: null,
      status: 'submitted',
      checks: 0
    });

    logger.info(`NLStatusMonitor: Tracking ${mrn} for expedition ${expeditionId}`);
  }

  /**
   * Stop monitoring a declaration
   */
  untrack(mrn) {
    return this.pendingDeclarations.delete(mrn);
  }

  /**
   * Check status of all tracked declarations
   */
  async checkAll() {
    const results = [];

    for (const [mrn, tracking] of this.pendingDeclarations) {
      try {
        const status = await this.service.queryStatus(mrn);
        tracking.lastChecked = new Date();
        tracking.checks++;
        tracking.status = status.status;

        results.push({
          mrn,
          expeditionId: tracking.expeditionId,
          status: status.status,
          correctionRequired: status.correctionRequired || false,
          channel: status.channel
        });

        // Remove from tracking if terminal state
        if (['ACCEPTED', 'RELEASED', 'INVALIDATED', 'REJECTED'].includes(status.status)) {
          this.pendingDeclarations.delete(mrn);
          logger.info(`NLStatusMonitor: ${mrn} reached terminal state: ${status.status}`);
        }
      } catch (error) {
        results.push({ mrn, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get system health/status for DECO and DMS
   */
  async getSystemHealth() {
    const decoStatus = await this._checkEndpoint('DECO');
    const dmsStatus = await this._checkEndpoint('DMS');

    const isConfigured = this.service ? this.service.isConfigured() : false;
    const environment = this.service ? (this.service.environment || 'test') : 'unknown';

    return {
      timestamp: new Date(),
      systems: {
        deco: {
          status: decoStatus.available ? 'operational' : 'unavailable',
          responseTime: decoStatus.responseTime,
          configured: isConfigured,
          environment: environment
        },
        dms: {
          status: dmsStatus.available ? 'operational' : 'unavailable',
          responseTime: dmsStatus.responseTime,
          configured: isConfigured,
          environment: environment
        },
        digipoort: {
          status: isConfigured ? 'configured' : 'not_configured',
          certificate: isConfigured ? 'valid' : 'missing'
        }
      },
      tracking: {
        pending: this.pendingDeclarations.size,
        declarations: Array.from(this.pendingDeclarations.values()).map(t => ({
          mrn: t.mrn,
          status: t.status,
          trackedSince: t.trackedSince,
          checks: t.checks
        }))
      }
    };
  }

  async _checkEndpoint(system) {
    const start = Date.now();
    try {
      // In simulation mode, always "available"
      if (!this.service || !this.service.isConfigured()) {
        return { available: true, responseTime: 0, simulated: true };
      }
      // Real health check would ping the endpoint
      return { available: true, responseTime: Date.now() - start };
    } catch (error) {
      return { available: false, responseTime: Date.now() - start, error: error.message };
    }
  }

  /**
   * Get stats summary
   */
  getStats() {
    const tracked = Array.from(this.pendingDeclarations.values());
    return {
      totalTracked: tracked.length,
      byStatus: tracked.reduce((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      }, {}),
      oldestTracked: tracked.length > 0 ?
        tracked.sort((a, b) => a.trackedSince - b.trackedSince)[0].trackedSince : null
    };
  }
}

module.exports = NLStatusMonitor;
