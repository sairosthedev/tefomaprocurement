const { User, SupplierProfile } = require('../../models');
const { createAuditLog } = require('../../middleware');

const createSupplier = async (req, res) => {
  try {
    const {
      companyName,
      tradingAs,
      registrationNumber,
      taxNumber,
      vatNumber,
      firstName,
      lastName,
      email,
      password,
      phone,
      physicalAddress,
      city,
      province,
      postalCode,
      categories,
      bankName,
      bankAccountName,
      bankAccountNumber,
      bankBranchCode
    } = req.body;

    // Validate required fields
    if (!companyName || !email || !firstName || !lastName || !registrationNumber) {
      return res.status(400).json({
        success: false,
        message: 'Company name, email, first name, last name, and registration number are required'
      });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check if email already exists (excluding deleted users)
    const existingUser = await User.findOne({ 
      email: normalizedEmail,
      isDeleted: { $ne: true }
    });
    
    if (existingUser) {
      console.log('Existing user found:', {
        email: existingUser.email,
        id: existingUser._id,
        role: existingUser.role,
        isDeleted: existingUser.isDeleted
      });
      return res.status(400).json({
        success: false,
        message: `A user with email ${email} already exists`
      });
    }

    // Also check if a supplier profile already exists with this email
    const existingSupplier = await SupplierProfile.findOne({
      email: normalizedEmail,
      isDeleted: { $ne: true }
    }).populate('user');
    
    if (existingSupplier) {
      console.log('Existing supplier found:', {
        email: existingSupplier.email,
        id: existingSupplier._id,
        userId: existingSupplier.user?._id,
        userDeleted: existingSupplier.user?.isDeleted
      });
      
      // Only block if the associated user exists and is not deleted
      if (existingSupplier.user && !existingSupplier.user.isDeleted) {
        return res.status(400).json({
          success: false,
          message: `A supplier with email ${email} already exists`
        });
      }
    }

    // Use provided password or default to "password"
    const userPassword = password || 'password';

    // Validate password length
    if (userPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Create user account for supplier
    const user = await User.create({
      email: normalizedEmail,
      password: userPassword,
      firstName,
      lastName,
      role: 'supplier',
      phone,
      status: 'active'
    });

    // Create supplier profile
    const supplierProfile = await SupplierProfile.create({
      user: user._id,
      companyName,
      tradingAs,
      registrationNumber,
      taxNumber,
      vatNumber,
      contactPerson: `${firstName} ${lastName}`,
      email: normalizedEmail,
      phone,
      address: {
        physical: physicalAddress,
        city,
        province,
        postalCode
      },
      categories: categories || [],
      bankDetails: {
        bankName,
        accountName: bankAccountName,
        accountNumber: bankAccountNumber,
        branchCode: bankBranchCode
      },
      status: 'active', // Pre-approved when added by procurement (using 'active' instead of 'approved')
      approvedBy: req.user._id,
      approvedAt: new Date()
    });

    await createAuditLog({
      action: 'create',
      entity: 'SupplierProfile',
      entityId: supplierProfile._id,
      user: req.user,
      description: `Created new supplier: ${companyName}`,
      newData: { companyName, email, categories },
      req
    });

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: {
        id: supplierProfile._id,
        companyName: supplierProfile.companyName,
        email: supplierProfile.email,
        status: supplierProfile.status,
        password: userPassword // Return the password used
      }
    });
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = createSupplier;

