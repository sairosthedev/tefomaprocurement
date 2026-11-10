import crypto from 'crypto';
import type { Request, Response } from 'express';
import { User } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { validateResetPassword } from '@fossil/shared';
import { refuseInvalid } from '../../lib/validation.js';

const resetPassword = async (req: Request, res: Response): Promise<any> => {
  try {
    if (refuseInvalid(res, validateResetPassword(req.body ?? {}))) return;

    const { token, email, newPassword } = req.body;

    const hashedToken = crypto.createHash('sha256').update(String(token)).digest('hex');

    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
      isDeleted: false
    }).select('+password');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset link. Please request a new one.'
      });
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    await createAuditLog({
      action: 'update',
      entity: 'User',
      entityId: user._id,
      user: user,
      description: 'Password reset via email link',
      req
    });

    res.status(200).json({
      success: true,
      message: 'Password updated successfully. You can sign in now.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default resetPassword;
