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
  rejectStoreRequisition
};

