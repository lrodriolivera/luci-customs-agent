/**
 * Integrations Module
 * Exports all integration services
 */

const vuaService = require('./vuaService');
const tracesService = require('./tracesService');
const nctsService = require('./nctsService');
const integrationManager = require('./integrationManager');

module.exports = {
  vuaService,
  tracesService,
  nctsService,
  integrationManager
};
