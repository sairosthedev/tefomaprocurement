import type { Request, Response } from 'express';
import { User } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { verifyLoginOtp } from '../../services/otp.service.js';
import { finalizeUserLogin } from '../../services/authLogin.service.js';
import { validateLoginOtp } from '@fossil/shared';
import { refuseInvalid } from '../../lib/validation.js';

const verifyOtp = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, otp, code } = req.body ?? {};
    const otpCode = (otp || code || '').toString().trim();

    if (refuseInvalid(res, validateLoginOtp({ email, otp: otpCode }))) return;

    const result = await verifyLoginOtp(email, otpCode);
    if (result.status !== 'success') {
      if (result.status === 'invalid_code') {
        await createAuditLog({
          action: 'login_failed',
          entity: 'User',
          entityLabel: email,
          description: `Failed OTP verification for email: ${email}`,
          req
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid or expired verification code'
      });
    }

    const user = await User.findById(result.userId);
    if (!user || user.isDeleted || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Account is not available for login'
      });
    }

    const session = await finalizeUserLogin(user, req);

    res.status(200).json({
      success: true,
      ...session
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during verification'
    });
  }
};

export default verifyOtp;
