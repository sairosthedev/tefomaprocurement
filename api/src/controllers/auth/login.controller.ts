import type { Request, Response } from 'express';
import { createAuditLog } from '../../middleware/index.js';
import { findActiveUserByEmail } from '../../services/authLogin.service.js';
import { createLoginOtp } from '../../services/otp.service.js';

const login = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    const user = await findActiveUserByEmail(email);

    if (!user) {
      await createAuditLog({
        action: 'login_failed',
        entity: 'User',
        description: `Failed login attempt for email: ${email}`,
        req
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      await createAuditLog({
        action: 'login_failed',
        entity: 'User',
        entityId: user._id,
        user,
        description: 'Failed login attempt - incorrect password',
        req
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Your account is not active. Please contact administrator.'
      });
    }

    await createLoginOtp(user);

    res.status(200).json({
      success: true,
      requiresOtp: true,
      email: user.email,
      message: 'A verification code has been sent to your email'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

export default login;
