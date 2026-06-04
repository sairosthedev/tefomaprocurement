import receiveGoods from './receiveGoods.controller.js';
import getDeliveries from './getDeliveries.controller.js';
import getPendingDeliveries from './getPendingDeliveries.controller.js';
import getInventory from './getInventory.controller.js';
import getMovements from './getMovements.controller.js';
import issueStock from './issueStock.controller.js';
import acceptDelivery from './acceptDelivery.controller.js';
import getStoreRequisitions from './getStoreRequisitions.controller.js';
import approveStoreRequisition from './approveStoreRequisition.controller.js';
import rejectStoreRequisition from './rejectStoreRequisition.controller.js';
import createStockTransfer from './createStockTransfer.controller.js';
import getStockTransfers from './getStockTransfers.controller.js';
import approveStockTransfer from './approveStockTransfer.controller.js';
import shipStockTransfer from './shipStockTransfer.controller.js';
import receiveStockTransfer from './receiveStockTransfer.controller.js';

export default {
  receiveGoods,
  getDeliveries,
  getPendingDeliveries,
  getInventory,
  getMovements,
  issueStock,
  acceptDelivery,
  getStoreRequisitions,
  approveStoreRequisition,
  rejectStoreRequisition,
  createStockTransfer,
  getStockTransfers,
  approveStockTransfer,
  shipStockTransfer,
  receiveStockTransfer
};
