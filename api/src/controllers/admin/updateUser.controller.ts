import type { Request, Response } from 'express';
import { User } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

const updateUser = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { firstName, lastName, role, department, homeSite, phone, status, password } =
      req.body;

    const user = await User.findById(id);
    if (!user || user.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const previousData = {
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      department: user.department,
      phone: user.phone,
      status: user.status
    };

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (role) user.role = role;
    if (department !== undefined) user.department = department;
    if (homeSite !== undefined) user.homeSite = homeSite;
    if (phone !== undefined) user.phone = phone;
    if (status) user.status = status;

    // Handle password change
    if (password && password.length >= 6) {
      user.password = password;
    }

    await user.save();

    await createAuditLog({
      action: 'update',
      entity: 'User',
      entityId: user._id,
      user: req.user,
      description: `Admin updated user: ${user.email}`,
      previousData,
      newData: { firstName, lastName, role, department, phone, status },
      req
    });

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error: any) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

export default updateUser;
