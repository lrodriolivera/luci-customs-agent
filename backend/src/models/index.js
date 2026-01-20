/**
 * Exportacion centralizada de todos los modelos
 */

const User = require('./User');
const Expedition = require('./Expedition');
const ChatMessage = require('./ChatMessage');
const TaricCode = require('./TaricCode');
const Requirement = require('./Requirement');
const ParaduaneroControl = require('./ParaduaneroControl');
const H7Declaration = require('./H7Declaration');
const Guarantee = require('./Guarantee');
const SpecialRegime = require('./SpecialRegime');
const Transit = require('./Transit');
const OEA = require('./OEA');
const Deadline = require('./Deadline');
const Inspection = require('./Inspection');
const InspectorCommunication = require('./InspectorCommunication');

module.exports = {
  User,
  Expedition,
  ChatMessage,
  TaricCode,
  Requirement,
  ParaduaneroControl,
  H7Declaration,
  Guarantee,
  SpecialRegime,
  Transit,
  OEA,
  Deadline,
  Inspection,
  InspectorCommunication
};
