const { protect, authorize } = require('./auth.middleware');
const { createAuditLog } = require('./audit.middleware');
const { notFoundHandler, errorHandler } = require('./errorHandler.middleware');

module.exports = {
  protect,
  authorize,
  createAuditLog,
  notFoundHandler,
  errorHandler
};
