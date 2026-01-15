const { AuditLog } = require('../models');

const createAuditLog = async (options) => {
  try {
    const {
      action,
      entity,
      entityId,
      user,
      description,
      previousData,
      newData,
      req
    } = options;

    await AuditLog.create({
      action,
      entity,
      entityId,
      user: user?._id || user,
      userEmail: user?.email,
      userRole: user?.role,
      description,
      previousData,
      newData,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers?.['user-agent']
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
};

module.exports = { createAuditLog };

