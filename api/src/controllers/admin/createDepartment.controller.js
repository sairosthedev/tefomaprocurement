const { Department } = require('../../models');
const { createAuditLog } = require('../../middleware');

const createDepartment = async (req, res) => {
  try {
    const { name, code, description, head } = req.body;

    const existingDept = await Department.findOne({ 
      $or: [{ name }, { code }] 
    });
    
    if (existingDept) {
      return res.status(400).json({
        success: false,
        message: 'Department with this name or code already exists'
      });
    }

    const department = await Department.create({
      name,
      code,
      description,
      head
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

