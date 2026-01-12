/**
 * Special Regimes Routes
 * Rutas para gestion de regimenes aduaneros especiales
 */

const express = require('express');
const router = express.Router();
const specialRegimeController = require('../controllers/specialRegimeController');
const { requireAuth } = require('../middleware/auth');

// Todas las rutas requieren autenticacion
router.use(requireAuth);

// === RUTAS PRINCIPALES ===

// Listar regimenes
router.get('/', specialRegimeController.list);

// Estadisticas
router.get('/stats', specialRegimeController.getStats);

// Regimenes por expirar
router.get('/expiring', specialRegimeController.getExpiring);

// Calcular derechos (simulacion)
router.post('/calculate-duties', specialRegimeController.calculateDuties);

// Crear nuevo regimen
router.post('/', specialRegimeController.create);

// Obtener detalle
router.get('/:id', specialRegimeController.getById);

// Actualizar regimen
router.put('/:id', specialRegimeController.update);

// Eliminar regimen
router.delete('/:id', specialRegimeController.delete);

// === ACCIONES DE ESTADO ===

// Autorizar regimen
router.post('/:id/authorize', specialRegimeController.authorize);

// Activar regimen
router.post('/:id/activate', specialRegimeController.activate);

// Vincular garantia
router.post('/:id/link-guarantee', specialRegimeController.linkGuarantee);

// Solicitar prorroga
router.post('/:id/extension', specialRegimeController.requestExtension);

// Ultimar regimen
router.post('/:id/discharge', specialRegimeController.discharge);

// === OPERACIONES CON MERCANCIAS ===

// Anadir mercancia
router.post('/:id/goods', specialRegimeController.addGoods);

// Salida parcial (deposito)
router.post('/:id/partial-exit', specialRegimeController.partialExit);

// === TRANSITO ===

// Actualizar estado de transito
router.put('/:id/transit-status', specialRegimeController.updateTransitStatus);

module.exports = router;
