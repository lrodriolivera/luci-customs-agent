/**
 * Knowledge Routes
 * Base de conocimiento aduanero de referencia: regímenes e incoterms.
 *
 * Son catálogos estáticos de referencia (como el catálogo TARIC), no datos de
 * un cliente, así que van sin auth.
 */

const express = require('express');
const router = express.Router();
const knowledgeController = require('../controllers/knowledgeController');

router.get('/regimes', knowledgeController.listRegimes);
router.get('/regime/:code', knowledgeController.getRegime);
router.get('/incoterms', knowledgeController.listIncoterms);
router.get('/incoterm/:code', knowledgeController.getIncoterm);

module.exports = router;
