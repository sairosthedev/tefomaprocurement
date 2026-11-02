import crypto from 'crypto';
import type { Request, Response } from 'express';
import { User } from '../../models/index.js';
import { sendPasswordResetEmail } from '../../services/email.service.js';
import { getClientUrl } from '../../lib/branding.js';

const forgotPassword = async (req: Request, res: Response): Promise<any> => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email, isDeleted: false, status: 'active' });

    // Always respond success to avoid email enumeration
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists for that email, a reset link has been sent.'
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const resetLink = `${getClientUrl()}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    await sendPasswordResetEmail(user.email, resetLink, user.firstName);

    res.status(200).json({
      success: true,
      message: 'If an account exists for that email, a reset link has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default forgotPassword;
