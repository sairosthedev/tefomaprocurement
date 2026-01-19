const express = require('express');
const router = express.Router();
const { stores } = require('../controllers');
const { protect, authorize } = require('../middleware');

// All routes require stores_officer role
router.use(protect);
router.use(authorize('stores_officer', 'admin'));

// Deliveries / GRV
router.post('/deliveries', stores.receiveGoods);
router.get('/deliveries', stores.getDeliveries);
router.get('/pending-deliveries', stores.getPendingDeliveries);
router.put('/deliveries/:id/accept', stores.acceptDelivery);

// Inventory
router.get('/inventory', stores.getInventory);

// Stock Movements
router.get('/movements', stores.getMovements);

// Stock issue
router.put('/requisitions/:id/issue', stores.issueStock);

module.exports = router;

