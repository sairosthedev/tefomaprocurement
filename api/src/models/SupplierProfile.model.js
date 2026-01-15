const mongoose = require('mongoose');

const ContactPersonSchema = new mongoose.Schema({
  name: { type: String, required: true },
  position: String,
  email: { type: String, required: true },
  phone: { type: String, required: true },
  isPrimary: { type: Boolean, default: false }
});

const ComplianceDocumentSchema = new mongoose.Schema({
  documentType: {
    type: String,
    enum: ['tax_clearance', 'registration_certificate', 'bee_certificate', 'insurance', 'bank_confirmation', 'other'],
    required: true
  },
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  expiryDate: Date,
  uploadedAt: { type: Date, default: Date.now },
  verified: { type: Boolean, default: false },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date
});

const SupplierProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true
  },
  tradingName: {
    type: String,
    trim: true
  },
  registrationNumber: {
    type: String,
    required: [true, 'Registration number is required'],
    trim: true
  },
  vatNumber: {
    type: String,
    trim: true
  },
  taxNumber: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    province: String,
    postalCode: String,
    country: { type: String, default: 'South Africa' }
  },
  contactPersons: [ContactPersonSchema],
  bankDetails: {
    bankName: String,
    accountName: String,
    accountNumber: String,
    branchCode: String,
    accountType: { type: String, enum: ['current', 'savings', 'cheque'] }
  },
  categories: [{
    type: String,
    trim: true
  }],
  complianceDocuments: [ComplianceDocumentSchema],
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'blacklisted'],
    default: 'pending'
  },
  blacklistReason: String,
  blacklistedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  blacklistedAt: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  notes: String,
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for searching
SupplierProfileSchema.index({ companyName: 'text', tradingName: 'text', categories: 'text' });

module.exports = mongoose.model('SupplierProfile', SupplierProfileSchema);

