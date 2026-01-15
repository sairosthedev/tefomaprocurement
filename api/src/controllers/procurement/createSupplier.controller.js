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
      contactPerson,
      email,
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
    if (!companyName || !email || !contactPerson) {
      return res.status(400).json({
        success: false,
        message: 'Company name, email, and contact person are required'
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }

    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';

    // Create user account for supplier
    const user = await User.create({
      email: email.toLowerCase(),
      password: tempPassword,
      firstName: contactPerson.split(' ')[0] || contactPerson,
      lastName: contactPerson.split(' ').slice(1).join(' ') || '',
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
      contactPerson,
      email: email.toLowerCase(),
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
      status: 'approved', // Pre-approved when added by procurement
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
        tempPassword // In production, send this via email
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

