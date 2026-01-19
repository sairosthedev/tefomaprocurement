const getMyProfile = require('./getMyProfile.controller');
const updateProfile = require('./updateProfile.controller');
const getMyRFQs = require('./getMyRFQs.controller');
const getRFQById = require('./getRFQById.controller');
const submitQuotation = require('./submitQuotation.controller');
const getMyQuotations = require('./getMyQuotations.controller');
const getMyPurchaseOrders = require('./getMyPurchaseOrders.controller');
const acknowledgePurchaseOrder = require('./acknowledgePurchaseOrder.controller');
const getMyDeliveries = require('./getMyDeliveries.controller');

module.exports = {
  getMyProfile,
  updateProfile,
  getMyRFQs,
  getRFQById,
  submitQuotation,
  getMyQuotations,
  getMyPurchaseOrders,
  acknowledgePurchaseOrder,
  getMyDeliveries
};

