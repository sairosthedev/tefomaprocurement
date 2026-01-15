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

// Inventory
router.get('/inventory', stores.getInventory);

// Stock issue
router.put('/requisitions/:id/issue', stores.issueStock);

module.exports = router;

