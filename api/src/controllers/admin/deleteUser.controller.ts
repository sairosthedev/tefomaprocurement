import type { Request, Response } from 'express';
import { User } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

const deleteUser = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user || user.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Soft delete
    user.isDeleted = true;
    user.status = 'inactive';
    await user.save();

    await createAuditLog({
      action: 'delete',
      entity: 'User',
      entityId: user._id,
      user: req.user,
      description: `Admin deleted user: ${user.email}`,
      previousData: { email: user.email, status: 'active' },
      req
    });

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default deleteUser;
