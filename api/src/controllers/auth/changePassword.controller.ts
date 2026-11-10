import type { Request, Response } from 'express';
import { User } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { validateChangePassword } from '@fossil/shared';
import { refuseInvalid } from '../../lib/validation.js';

const changePassword = async (req: Request, res: Response): Promise<any> => {
  try {
    if (refuseInvalid(res, validateChangePassword(req.body ?? {}))) return;

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user!._id).select('+password');
    if (!user || user.isDeleted) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const matches = await user.comparePassword(String(currentPassword));
    if (!matches) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
        errors: { currentPassword: 'Current password is incorrect' }
      });
    }

    user.password = newPassword;
    await user.save();

    await createAuditLog({
      action: 'update',
      entity: 'User',
      entityId: user._id,
      user: req.user,
      entityLabel: user.email,
      description: 'Changed own password',
      // The value is never stored; the audit trail records only that it changed.
      newData: { passwordChanged: true, passwordChangedAt: new Date() },
      req
    });

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default changePassword;
