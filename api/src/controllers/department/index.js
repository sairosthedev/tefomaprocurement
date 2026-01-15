const createRequisition = require('./createRequisition.controller');
const getRequisitions = require('./getRequisitions.controller');
const submitRequisition = require('./submitRequisition.controller');
const approveRequisition = require('./approveRequisition.controller');

module.exports = {
  createRequisition,
  getRequisitions,
  submitRequisition,
  approveRequisition
};

