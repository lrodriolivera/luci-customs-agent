/**
 * Exportacion centralizada de todos los modelos
 */

const User = require('./User');
const Expedition = require('./Expedition');
const ChatMessage = require('./ChatMessage');
const TaricCode = require('./TaricCode');

module.exports = {
  User,
  Expedition,
  ChatMessage,
  TaricCode
};
