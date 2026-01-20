/**
 * ML Routes
 * Phase 6.5: Advanced Machine Learning
 * REST API endpoints for ML services
 */

const express = require('express');
const router = express.Router();
const mlController = require('../controllers/mlController');

// ==================== Channel Prediction ====================

/**
 * @route POST /api/ml/predict-channel
 * @desc Predict customs channel for a declaration
 * @access Private
 */
router.post('/predict-channel', mlController.predictChannel);

/**
 * @route POST /api/ml/predict-channel/batch
 * @desc Batch predict channels for multiple declarations
 * @access Private
 */
router.post('/predict-channel/batch', mlController.batchPredictChannels);

/**
 * @route POST /api/ml/predict-channel/feedback
 * @desc Record channel prediction feedback
 * @access Private
 */
router.post('/predict-channel/feedback', mlController.recordChannelFeedback);

/**
 * @route GET /api/ml/predict-channel/stats
 * @desc Get channel prediction statistics
 * @access Private
 */
router.get('/predict-channel/stats', mlController.getChannelStats);

// ==================== Fraud Detection ====================

/**
 * @route POST /api/ml/fraud/analyze
 * @desc Analyze declaration for potential fraud
 * @access Private
 */
router.post('/fraud/analyze', mlController.analyzeForFraud);

/**
 * @route POST /api/ml/fraud/quick-check
 * @desc Quick risk assessment
 * @access Private
 */
router.post('/fraud/quick-check', mlController.quickRiskAssessment);

/**
 * @route GET /api/ml/fraud/stats
 * @desc Get fraud detection statistics
 * @access Private
 */
router.get('/fraud/stats', mlController.getFraudStats);

/**
 * @route POST /api/ml/fraud/feedback
 * @desc Record fraud detection feedback
 * @access Private
 */
router.post('/fraud/feedback', mlController.recordFraudFeedback);

// ==================== Classification ====================

/**
 * @route POST /api/ml/classify
 * @desc Classify product with ML-enhanced TARIC codes
 * @access Private
 */
router.post('/classify', mlController.classifyProduct);

/**
 * @route POST /api/ml/classify/feedback
 * @desc Record classification feedback
 * @access Private
 */
router.post('/classify/feedback', mlController.recordClassificationFeedback);

/**
 * @route GET /api/ml/classify/stats
 * @desc Get classification statistics
 * @access Private
 */
router.get('/classify/stats', mlController.getClassificationStats);

/**
 * @route GET /api/ml/classify/patterns
 * @desc Get classification patterns
 * @access Private
 */
router.get('/classify/patterns', mlController.getClassificationPatterns);

// ==================== Recommendations ====================

/**
 * @route POST /api/ml/recommendations
 * @desc Generate proactive recommendations
 * @access Private
 */
router.post('/recommendations', mlController.generateRecommendations);

/**
 * @route GET /api/ml/recommendations/quick
 * @desc Get quick recommendations
 * @access Private
 */
router.get('/recommendations/quick', mlController.getQuickRecommendations);

/**
 * @route GET /api/ml/recommendations/stats
 * @desc Get recommendation statistics
 * @access Private
 */
router.get('/recommendations/stats', mlController.getRecommendationStats);

/**
 * @route POST /api/ml/recommendations/feedback
 * @desc Record recommendation feedback
 * @access Private
 */
router.post('/recommendations/feedback', mlController.recordRecommendationFeedback);

// ==================== Auto Response ====================

/**
 * @route POST /api/ml/auto-response
 * @desc Generate auto-response for AEAT requirement
 * @access Private
 */
router.post('/auto-response', mlController.generateAutoResponse);

/**
 * @route POST /api/ml/auto-response/preview
 * @desc Get template preview
 * @access Private
 */
router.post('/auto-response/preview', mlController.getTemplatePreview);

/**
 * @route GET /api/ml/auto-response/templates
 * @desc List available response templates
 * @access Private
 */
router.get('/auto-response/templates', mlController.listResponseTemplates);

/**
 * @route GET /api/ml/auto-response/stats
 * @desc Get auto-response statistics
 * @access Private
 */
router.get('/auto-response/stats', mlController.getAutoResponseStats);

/**
 * @route POST /api/ml/auto-response/feedback
 * @desc Record auto-response feedback
 * @access Private
 */
router.post('/auto-response/feedback', mlController.recordResponseFeedback);

// ==================== Combined Stats ====================

/**
 * @route GET /api/ml/stats
 * @desc Get overall ML system statistics
 * @access Private
 */
router.get('/stats', mlController.getOverallStats);

module.exports = router;
