const jwt = require('jsonwebtoken');
const { User, SupplierProfile } = require('../../models');
const { createAuditLog } = require('../../middleware');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email, isDeleted: false }).select('+password');

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

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      await createAuditLog({
        action: 'login_failed',
        entity: 'User',
        entityId: user._id,
        user,
        description: `Failed login attempt - incorrect password`,
        req
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Your account is not active. Please contact administrator.'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Generate token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    // Get supplier profile if user is a supplier
    let supplierProfile = null;
    if (user.role === 'supplier') {
      supplierProfile = await SupplierProfile.findOne({ user: user._id });
    }

    await createAuditLog({
      action: 'login',
      entity: 'User',
      entityId: user._id,
      user,
      description: `User logged in successfully`,
      req
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
        supplierProfile: supplierProfile?._id
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

module.exports = login;

