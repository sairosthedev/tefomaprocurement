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

// Store Requisitions
router.get('/requisitions', stores.getStoreRequisitions);
router.put('/requisitions/:id/approve', stores.approveStoreRequisition);
router.put('/requisitions/:id/reject', stores.rejectStoreRequisition);
router.put('/requisitions/:id/issue', stores.issueStock);

// Stock transfers (HQ ↔ sites)
router.post('/transfers', stores.createStockTransfer);
router.get('/transfers', stores.getStockTransfers);
router.put('/transfers/:id/approve', stores.approveStockTransfer);
router.put('/transfers/:id/ship', stores.shipStockTransfer);
router.put('/transfers/:id/receive', stores.receiveStockTransfer);

module.exports = router;

