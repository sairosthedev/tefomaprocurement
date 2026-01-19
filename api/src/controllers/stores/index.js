const receiveGoods = require('./receiveGoods.controller');
const getDeliveries = require('./getDeliveries.controller');
const getPendingDeliveries = require('./getPendingDeliveries.controller');
const getInventory = require('./getInventory.controller');
const issueStock = require('./issueStock.controller');
const acceptDelivery = require('./acceptDelivery.controller');

module.exports = {
  receiveGoods,
  getDeliveries,
  getPendingDeliveries,
  getInventory,
  issueStock,
  acceptDelivery
};

