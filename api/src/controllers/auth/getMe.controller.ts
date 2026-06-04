import type { Request, Response } from 'express';
import { User, SupplierProfile } from '../../models/index.js';

const getMe = async (req: Request, res: Response): Promise<any> => {
  try {
    const user = await User.findById(req.user!._id)
      .populate('department', 'name code')
      .populate('homeSite', 'code name type hasLocalStore');

    let supplierProfile = null;
    if (user.role === 'supplier') {
      supplierProfile = await SupplierProfile.findOne({ user: user._id });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
        homeSite: user.homeSite,
        phone: user.phone,
        status: user.status,
        lastLogin: user.lastLogin,
        supplierProfile
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getMe;
