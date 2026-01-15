const { Department } = require('../../models');
const { createAuditLog } = require('../../middleware');

const createDepartment = async (req, res) => {
  try {
    const { name, code, description, head } = req.body;

    // Check if name already exists
    const existingByName = await Department.findOne({ name });
    if (existingByName) {
      return res.status(400).json({
        success: false,
        message: 'Department with this name already exists'
      });
    }

    // Only check code uniqueness if code is provided
    if (code && code.trim()) {
      const existingByCode = await Department.findOne({ code: code.trim().toUpperCase() });
      if (existingByCode) {
        return res.status(400).json({
          success: false,
          message: 'Department with this code already exists'
        });
      }
    }

    const department = await Department.create({
      name,
      code: code?.trim() || undefined, // Don't save empty strings
      description,
      head: head || undefined
    });

    await createAuditLog({
      action: 'create',
      entity: 'Department',
      entityId: department._id,
      user: req.user,
      description: `Created department: ${name}`,
      newData: { name, code, description },
      req
    });

    res.status(201).json({
      success: true,
      data: department
    });
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = createDepartment;

