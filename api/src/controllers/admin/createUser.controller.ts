import type { Request, Response } from 'express';
import { User } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { validateStaffUser } from '@fossil/shared';
import { refuseInvalid } from '../../lib/validation.js';

const createUser = async (req: Request, res: Response): Promise<any> => {
  try {
    if (refuseInvalid(res, validateStaffUser(req.body ?? {}, { isNew: true }))) return;

    const { email, password, firstName, lastName, role, department, homeSite, phone, status } =
      req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
        errors: { email: 'A user with this email already exists' }
      });
    }

    const user = await User.create({
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      role,
      department: department || null,
      homeSite: homeSite || null,
      phone,
      status: status || 'active'
    });

    await createAuditLog({
      action: 'create',
      entity: 'User',
      entityId: user._id,
      user: req.user,
      entityLabel: email,
      description: `Admin created new user: ${email} with role ${role}`,
      newData: { email, firstName, lastName, role, department },
      req
    });

    res.status(201).json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status
      }
    });
  } catch (error: any) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

export default createUser;
