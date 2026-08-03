/**
 * Analytics Routes
 * Phase 6.2: Analytics and Business Intelligence
 */

const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { auth } = require('../middleware/auth');

// Expone datos operativos y de clientes: exige sesion.
router.use(auth);

// Middleware for permission checking
const requirePermission = (permission) => (req, res, next) => {
  // In production, check actual user permissions
  // For now, allow all authenticated requests
  next();
};

// ==================== Dashboard & Metrics ====================

// GET /api/analytics/dashboard - Get dashboard metrics
router.get('/dashboard', analyticsController.getDashboardMetrics);

// GET /api/analytics/realtime - Get real-time metrics
router.get('/realtime', analyticsController.getRealTimeMetrics);

// GET /api/analytics/declarations - Get declaration analytics
router.get('/declarations', analyticsController.getDeclarationAnalytics);

// GET /api/analytics/financial - Get financial analytics
router.get('/financial', analyticsController.getFinancialAnalytics);

// GET /api/analytics/compliance - Get compliance analytics
router.get('/compliance', analyticsController.getComplianceAnalytics);

// GET /api/analytics/performance - Get performance analytics
router.get('/performance', analyticsController.getPerformanceAnalytics);

// GET /api/analytics/compare - Get comparison report between periods
router.get('/compare', analyticsController.getComparisonReport);

// POST /api/analytics/query - Execute custom analytics query
router.post('/query', analyticsController.executeQuery);

// ==================== Reports ====================

// GET /api/analytics/reports/types - Get available report types
router.get('/reports/types', analyticsController.getReportTypes);

// POST /api/analytics/reports/generate - Generate a new report
router.post('/reports/generate', analyticsController.generateReport);

// POST /api/analytics/reports/preview - Preview a report
router.post('/reports/preview', analyticsController.previewReport);

// POST /api/analytics/reports/schedule - Schedule recurring report
router.post('/reports/schedule', requirePermission('canConfigureSystem'), analyticsController.scheduleReport);

// GET /api/analytics/reports - List all reports
router.get('/reports', analyticsController.listReports);

// GET /api/analytics/reports/:id - Get specific report
router.get('/reports/:id', analyticsController.getReport);

// GET /api/analytics/reports/:id/download - Download report
router.get('/reports/:id/download', analyticsController.downloadReport);

// DELETE /api/analytics/reports/:id - Delete report
router.delete('/reports/:id', analyticsController.deleteReport);

// ==================== KPIs ====================

// GET /api/analytics/kpis/dashboard - Get KPI dashboard
router.get('/kpis/dashboard', analyticsController.getKPIDashboard);

// GET /api/analytics/kpis/definitions - Get KPI definitions
router.get('/kpis/definitions', analyticsController.getKPIDefinitions);

// GET /api/analytics/kpis/compare - Compare KPIs between periods
router.get('/kpis/compare', analyticsController.compareKPIs);

// GET /api/analytics/kpis/alerts - Get active KPI alerts
router.get('/kpis/alerts', analyticsController.getKPIAlerts);

// POST /api/analytics/kpis/alerts/:id/acknowledge - Acknowledge alert
router.post('/kpis/alerts/:id/acknowledge', analyticsController.acknowledgeKPIAlert);

// DELETE /api/analytics/kpis/alerts/:id - Dismiss alert
router.delete('/kpis/alerts/:id', analyticsController.dismissKPIAlert);

// GET /api/analytics/kpis - Get all KPIs
router.get('/kpis', analyticsController.getAllKPIs);

// GET /api/analytics/kpis/:id - Calculate specific KPI
router.get('/kpis/:id', analyticsController.calculateKPI);

// GET /api/analytics/kpis/:id/history - Get KPI history
router.get('/kpis/:id/history', analyticsController.getKPIHistory);

// PUT /api/analytics/kpis/:id/target - Set custom KPI target
router.put('/kpis/:id/target', requirePermission('canConfigureSystem'), analyticsController.setKPITarget);

// ==================== Predictions ====================

// GET /api/analytics/predictions/models - Get model metrics
router.get('/predictions/models', analyticsController.getModelMetrics);

// POST /api/analytics/predictions/volume - Predict volume
router.post('/predictions/volume', analyticsController.predictVolume);

// POST /api/analytics/predictions/channel - Predict channel assignment
router.post('/predictions/channel', analyticsController.predictChannel);

// POST /api/analytics/predictions/inspection - Predict inspection likelihood
router.post('/predictions/inspection', analyticsController.predictInspection);

// POST /api/analytics/predictions/processing-time - Predict processing time
router.post('/predictions/processing-time', analyticsController.predictProcessingTime);

// POST /api/analytics/predictions/duties - Predict duties
router.post('/predictions/duties', analyticsController.predictDuties);

// POST /api/analytics/predictions/anomalies - Detect anomalies
router.post('/predictions/anomalies', analyticsController.detectAnomalies);

// POST /api/analytics/predictions/trends - Analyze trends
router.post('/predictions/trends', analyticsController.analyzeTrends);

// ==================== AI Endpoints - LUCI Integration ====================

// POST /api/analytics/ai/insights - Generate automatic insights
router.post('/ai/insights', analyticsController.aiGenerateInsights);

// POST /api/analytics/ai/anomalies - Detect anomalies with AI
router.post('/ai/anomalies', analyticsController.aiDetectAnomalies);

// POST /api/analytics/ai/trends - Predict trends with AI
router.post('/ai/trends', analyticsController.aiPredictTrends);

// POST /api/analytics/ai/executive-report - Generate executive report
router.post('/ai/executive-report', analyticsController.aiGenerateExecutiveReport);

// POST /api/analytics/ai/kpi-analysis - Analyze KPI deviations
router.post('/ai/kpi-analysis', analyticsController.aiAnalyzeKPIDeviations);

// POST /api/analytics/ai/full-analysis - Full analytics analysis
router.post('/ai/full-analysis', analyticsController.aiFullAnalysis);

module.exports = router;
