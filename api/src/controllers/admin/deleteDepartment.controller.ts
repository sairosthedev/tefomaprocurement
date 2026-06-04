import type { Request, Response } from 'express';
import { Department, User } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

const deleteDepartment = async (req: Request, res: Response): Promise<any> => {
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
  } catch (error: any) {
    console.error('Delete department error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

export default deleteDepartment;
