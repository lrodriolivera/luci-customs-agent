const CustomsServiceFactory = require('./customsServiceFactory');
const BaseCustomsService = require('./common/baseCustomsService');
const UCCDataMapper = require('./common/uccDataMapper');
const SpainCustomsService = require('./spain/spainCustomsService');
const NetherlandsCustomsService = require('./netherlands/netherlandsCustomsService');

module.exports = {
  CustomsServiceFactory,
  BaseCustomsService,
  UCCDataMapper,
  SpainCustomsService,
  NetherlandsCustomsService,
};
