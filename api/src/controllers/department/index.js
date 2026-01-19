const createRequisition = require('./createRequisition.controller');
const getRequisitions = require('./getRequisitions.controller');
const getRequisitionById = require('./getRequisitionById.controller');
const submitRequisition = require('./submitRequisition.controller');
const createStoreRequisition = require('./createStoreRequisition.controller');
const getStoreRequisitions = require('./getStoreRequisitions.controller');

module.exports = {
  createRequisition,
  getRequisitions,
  getRequisitionById,
  submitRequisition,
  createStoreRequisition,
  getStoreRequisitions
};

