import type { Request, Response } from 'express';
import { User } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

const updateProfile = async (req: Request, res: Response): Promise<any> => {
  try {
    const { firstName, lastName, phone } = req.body;

    const user = await User.findById(req.user!._id).populate('department', 'name code');
    if (!user || user.isDeleted) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (firstName !== undefined) {
      const trimmed = String(firstName).trim();
      if (!trimmed) {
        return res.status(400).json({ success: false, message: 'First name is required' });
      }
      user.firstName = trimmed;
    }

    if (lastName !== undefined) {
      const trimmed = String(lastName).trim();
      if (!trimmed) {
        return res.status(400).json({ success: false, message: 'Last name is required' });
      }
      user.lastName = trimmed;
    }

    if (phone !== undefined) {
      user.phone = String(phone).trim();
    }

    await user.save();

    await createAuditLog({
      action: 'update',
      entity: 'User',
      entityId: user._id,
      user: req.user,
      description: 'Updated profile',
      req
    });

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
        phone: user.phone,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default updateProfile;
