/**
 * Exportacion centralizada de todos los modelos
 */

const User = require('./User');
const Expedition = require('./Expedition');
const ChatMessage = require('./ChatMessage');
const TaricCode = require('./TaricCode');
const Requirement = require('./Requirement');
const ParaduaneroControl = require('./ParaduaneroControl');

module.exports = {
  User,
  Expedition,
  ChatMessage,
  TaricCode,
  Requirement,
  ParaduaneroControl
};
