/**
 * Regulations Routes - BOE and EUR-Lex Search
 * Handles regulation search and LUCI analysis endpoints
 *
 * Stock Logistic - LUCI Customs Agent
 */

const express = require('express');
const router = express.Router();
const regulationController = require('../controllers/regulationController');

// ============================================
// Search Endpoints
// ============================================

// GET /api/regulations/search - Combined search (BOE + EUR-Lex)
router.get('/search', regulationController.searchAll);

// GET /api/regulations/boe/search - Search BOE only
router.get('/boe/search', regulationController.searchBOE);

// GET /api/regulations/eurlex/search - Search EUR-Lex only
router.get('/eurlex/search', regulationController.searchEURLex);

// ============================================
// Catalog & Reference
// ============================================

// GET /api/regulations/cau/catalog - Get CAU regulations catalog
router.get('/cau/catalog', regulationController.getCAUCatalog);

// GET /api/regulations/boe/catalog - Get BOE regulations catalog
router.get('/boe/catalog', regulationController.getBOECatalog);

// ============================================
// Document Access
// ============================================

// GET /api/regulations/document - Get full document content
router.get('/document', regulationController.getDocument);

// GET /api/regulations/article - Search specific article
router.get('/article', regulationController.searchArticle);

// ============================================
// LUCI Analysis
// ============================================

// POST /api/regulations/analyze - Analyze regulation with LUCI
router.post('/analyze', regulationController.analyzeRegulation);

// POST /api/regulations/analyze-classification - Analyze TARIC classification
router.post('/analyze-classification', regulationController.analyzeClassification);

// POST /api/regulations/query - Quick query about regulations
router.post('/query', regulationController.queryRegulations);

module.exports = router;
