const getMyProfile = require('./getMyProfile.controller');
const updateProfile = require('./updateProfile.controller');
const getMyRFQs = require('./getMyRFQs.controller');
const submitQuotation = require('./submitQuotation.controller');
const getMyQuotations = require('./getMyQuotations.controller');
const getMyPurchaseOrders = require('./getMyPurchaseOrders.controller');

module.exports = {
  getMyProfile,
  updateProfile,
  getMyRFQs,
  submitQuotation,
  getMyQuotations,
  getMyPurchaseOrders
};

