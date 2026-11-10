import type { Request, Response } from 'express';
import { User } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { validateMyProfile } from '@fossil/shared';
import { refuseInvalid } from '../../lib/validation.js';

const updateProfile = async (req: Request, res: Response): Promise<any> => {
  try {
    // Only the fields sent are checked and changed; the email is not among them.
    const { firstName, lastName, phone } = req.body;

    const user = await User.findById(req.user!._id).populate('department', 'name code');
    if (!user || user.isDeleted) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    // A phone saved before the format check is let through while unchanged.
    if (refuseInvalid(res, validateMyProfile(req.body ?? {}, { currentPhone: user.phone ?? '' }))) return;

    const before = {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone
    };

    if (firstName !== undefined) {
      user.firstName = String(firstName).trim();
    }

    if (lastName !== undefined) {
      user.lastName = String(lastName).trim();
    }

    if (phone !== undefined) {
      user.phone = phone === null ? '' : String(phone).trim();
    }

    await user.save();

    await createAuditLog({
      action: 'update',
      entity: 'User',
      entityId: user._id,
      user: req.user,
      entityLabel: user.email,
      description: 'Updated own profile',
      previousData: before,
      newData: { firstName: user.firstName, lastName: user.lastName, phone: user.phone },
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
