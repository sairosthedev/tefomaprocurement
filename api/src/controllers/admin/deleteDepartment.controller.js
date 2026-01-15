const { Department, User } = require('../../models');
const { createAuditLog } = require('../../middleware');

const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const department = await Department.findById(id);
    if (!department || department.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Check if any users are assigned to this department
    const usersInDept = await User.countDocuments({ department: id, isDeleted: false });
    if (usersInDept > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete department with ${usersInDept} active user(s). Please reassign users first.`
      });
    }

    // Soft delete
    department.isDeleted = true;
    await department.save();

    await createAuditLog({
      action: 'delete',
      entity: 'Department',
      entityId: department._id,
      user: req.user,
      description: `Deleted department: ${department.name}`,
      previousData: { name: department.name, code: department.code },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Department deleted successfully'
    });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = deleteDepartment;


