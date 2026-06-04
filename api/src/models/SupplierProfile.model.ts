import mongoose, { Schema, type Document } from 'mongoose';

export interface IContactPerson {
  name: string;
  position?: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

export interface IComplianceDocument {
  documentType: 'tax_clearance' | 'registration_certificate' | 'bee_certificate' | 'insurance' | 'bank_confirmation' | 'other';
  fileName: string;
  filePath: string;
  expiryDate?: Date;
  uploadedAt: Date;
  verified: boolean;
  verifiedBy?: mongoose.Types.ObjectId | any;
  verifiedAt?: Date;
}

export interface ISupplierProfile extends Document {
  user: mongoose.Types.ObjectId | any;
  companyName: string;
  tradingName?: string;
  registrationNumber: string;
  vatNumber?: string;
  taxNumber?: string;
  address?: {
    street?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };
  contactPersons: IContactPerson[];
  bankDetails?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    branchCode?: string;
    accountType?: 'current' | 'savings' | 'cheque';
  };
  categories: string[];
  complianceDocuments: IComplianceDocument[];
  status: 'pending' | 'active' | 'suspended' | 'blacklisted';
  blacklistReason?: string;
  blacklistedBy?: mongoose.Types.ObjectId | any;
  blacklistedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId | any;
  approvedAt?: Date;
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ContactPersonSchema = new Schema<IContactPerson>({
  name: { type: String, required: true },
  position: String,
  email: { type: String, required: true },
  phone: { type: String, required: true },
  isPrimary: { type: Boolean, default: false }
});

const ComplianceDocumentSchema = new Schema<IComplianceDocument>({
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

const SupplierProfileSchema = new Schema<ISupplierProfile>({
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

export default mongoose.model<ISupplierProfile>('SupplierProfile', SupplierProfileSchema);
