const authControllers = require('./auth');
const adminControllers = require('./admin');
const procurementControllers = require('./procurement');
const supplierControllers = require('./supplier');
const departmentControllers = require('./department');
const financeControllers = require('./finance');
const cooControllers = require('./coo');
const storesControllers = require('./stores');

module.exports = {
  auth: authControllers,
  admin: adminControllers,
  procurement: procurementControllers,
  supplier: supplierControllers,
  department: departmentControllers,
  finance: financeControllers,
  coo: cooControllers,
  stores: storesControllers
};

