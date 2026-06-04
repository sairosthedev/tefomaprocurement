import type { Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { User, SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

const register = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password, firstName, lastName, role, phone, companyDetails } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      role: role || 'supplier', // Default to supplier for public registration
      phone,
      status: role === 'supplier' ? 'active' : 'active'
    });

    // If supplier, create supplier profile
    if (role === 'supplier' && companyDetails) {
      await SupplierProfile.create({
        user: user._id,
        companyName: companyDetails.companyName,
        tradingName: companyDetails.tradingName,
        registrationNumber: companyDetails.registrationNumber,
        vatNumber: companyDetails.vatNumber,
        address: companyDetails.address,
        contactPersons: [{
          name: `${firstName} ${lastName}`,
          email,
          phone,
          isPrimary: true
        }],
        status: 'pending'
      });
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRE || '7d' } as SignOptions
    );

    await createAuditLog({
      action: 'create',
      entity: 'User',
      entityId: user._id,
      user,
      description: `New user registered: ${email}`,
      newData: { email, firstName, lastName, role },
      req
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration'
    });
  }
};

export default register;
