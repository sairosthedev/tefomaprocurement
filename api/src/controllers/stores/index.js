const receiveGoods = require('./receiveGoods.controller');
const getDeliveries = require('./getDeliveries.controller');
const getPendingDeliveries = require('./getPendingDeliveries.controller');
const getInventory = require('./getInventory.controller');
const getMovements = require('./getMovements.controller');
const issueStock = require('./issueStock.controller');
const acceptDelivery = require('./acceptDelivery.controller');
const getStoreRequisitions = require('./getStoreRequisitions.controller');
const approveStoreRequisition = require('./approveStoreRequisition.controller');
const rejectStoreRequisition = require('./rejectStoreRequisition.controller');
const createStockTransfer = require('./createStockTransfer.controller');
const getStockTransfers = require('./getStockTransfers.controller');
const approveStockTransfer = require('./approveStockTransfer.controller');
const shipStockTransfer = require('./shipStockTransfer.controller');
const receiveStockTransfer = require('./receiveStockTransfer.controller');

module.exports = {
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

