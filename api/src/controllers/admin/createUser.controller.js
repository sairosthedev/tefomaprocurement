const { User } = require('../../models');
const { createAuditLog } = require('../../middleware');

const createUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, department, phone, status } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, first name, last name, and role are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    const user = await User.create({
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      role,
      department: department || null,
      phone,
      status: status || 'active'
    });

    await createAuditLog({
      action: 'create',
      entity: 'User',
      entityId: user._id,
      user: req.user,
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
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = createUser;

