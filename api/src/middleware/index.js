const { protect, authorize } = require('./auth.middleware');
const { createAuditLog } = require('./audit.middleware');

module.exports = {
  protect,
  authorize,
  createAuditLog
};

