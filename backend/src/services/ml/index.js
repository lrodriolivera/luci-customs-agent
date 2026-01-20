/**
 * ML Services Index
 * Phase 6.5: Advanced Machine Learning
 * Exports all ML services for centralized access
 */

const channelPredictionService = require('./channelPredictionService');
const fraudDetectionService = require('./fraudDetectionService');
const classificationService = require('./classificationService');
const recommendationService = require('./recommendationService');
const autoResponseService = require('./autoResponseService');

module.exports = {
  // Channel Prediction
  predictChannel: channelPredictionService.predictChannel,
  recordChannelFeedback: channelPredictionService.recordFeedback,
  getChannelStats: channelPredictionService.getStatistics,
  batchPredictChannels: channelPredictionService.batchPredict,

  // Fraud Detection
  analyzeForFraud: fraudDetectionService.analyzeForFraud,
  quickRiskAssessment: fraudDetectionService.quickRiskAssessment,
  getFraudStats: fraudDetectionService.getStatistics,
  recordFraudFeedback: fraudDetectionService.recordFeedback,

  // Classification
  classifyProduct: classificationService.classifyProduct,
  recordClassificationFeedback: classificationService.recordClassificationFeedback,
  getClassificationStats: classificationService.getClassificationStats,
  CLASSIFICATION_PATTERNS: classificationService.CLASSIFICATION_PATTERNS,

  // Recommendations
  generateRecommendations: recommendationService.generateRecommendations,
  getQuickRecommendations: recommendationService.getQuickRecommendations,
  getRecommendationStats: recommendationService.getStatistics,
  recordRecommendationFeedback: recommendationService.recordFeedback,

  // Auto Response
  generateAutoResponse: autoResponseService.generateResponse,
  getTemplatePreview: autoResponseService.getTemplatePreview,
  listResponseTemplates: autoResponseService.listTemplates,
  getAutoResponseStats: autoResponseService.getStatistics,
  recordResponseFeedback: autoResponseService.recordFeedback,

  // Service references for advanced usage
  services: {
    channelPrediction: channelPredictionService,
    fraudDetection: fraudDetectionService,
    classification: classificationService,
    recommendation: recommendationService,
    autoResponse: autoResponseService
  }
};
