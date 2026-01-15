const receiveGoods = require('./receiveGoods.controller');
const getDeliveries = require('./getDeliveries.controller');
const getInventory = require('./getInventory.controller');
const issueStock = require('./issueStock.controller');

module.exports = {
  receiveGoods,
  getDeliveries,
  getInventory,
  issueStock
};

