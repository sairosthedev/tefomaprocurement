const { Department } = require('../../models');
const { createAuditLog } = require('../../middleware');

const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, head, status } = req.body;

    const department = await Department.findById(id);
    if (!department || department.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Check if name already exists (for another department)
    if (name && name !== department.name) {
      const existingByName = await Department.findOne({ name, _id: { $ne: id } });
      if (existingByName) {
        return res.status(400).json({
          success: false,
          message: 'Department with this name already exists'
        });
      }
    }

    // Check code uniqueness if code is provided
    if (code && code.trim() && code.toUpperCase() !== department.code) {
      const existingByCode = await Department.findOne({ 
        code: code.trim().toUpperCase(), 
        _id: { $ne: id } 
      });
      if (existingByCode) {
        return res.status(400).json({
          success: false,
          message: 'Department with this code already exists'
        });
      }
    }

    const previousData = {
      name: department.name,
      code: department.code,
      description: department.description,
      head: department.head,
      status: department.status
    };

    // Update fields
    if (name) department.name = name;
    if (code !== undefined) department.code = code?.trim() || undefined;
    if (description !== undefined) department.description = description;
    if (head !== undefined) department.head = head || undefined;
    if (status) department.status = status;

    await department.save();

    await createAuditLog({
      action: 'update',
      entity: 'Department',
      entityId: department._id,
      user: req.user,
      description: `Updated department: ${department.name}`,
      previousData,
      newData: { name, code, description, head, status },
      req
    });

    // Populate head before returning
    await department.populate('head', 'firstName lastName email');

    res.status(200).json({
      success: true,
      data: department
    });
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = updateDepartment;






