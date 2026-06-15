import express from 'express';
import controllers from '../controllers/index.js';
import { protect, authorize } from '../middleware/index.js';

const { stores } = controllers;
const router = express.Router();

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
router.post('/inventory', stores.addInventoryItem);
router.post('/inventory/bulk', stores.bulkImportInventory);

// Stock Movements
router.get('/movements', stores.getMovements);

// Purchase requisitions — stores gate
router.get('/purchase-requisitions/pending', stores.getPendingPurchaseRequisitions);
router.put('/purchase-requisitions/:id/auto-process', stores.autoProcessRequisition);
router.put('/purchase-requisitions/:id/fulfill', stores.fulfillRequisitionFromStock);
router.put('/purchase-requisitions/:id/forward', stores.forwardRequisitionToProcurement);

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

export default router;
