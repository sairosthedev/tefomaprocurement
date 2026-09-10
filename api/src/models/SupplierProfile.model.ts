import mongoose, { Schema, type Document } from 'mongoose';

export interface IContactPerson {
  name: string;
  position?: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

export interface IClientReferral {
  clientName: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  projectDescription?: string;
}

export interface IKysChecklist {
  cr14Directors?: boolean;
  cr6Address?: boolean;
  taxClearance?: boolean;
  nssaCompliance?: boolean;
  necRegistration?: boolean;
  industryLicences?: boolean;
  isoCertification?: boolean;
  companyProfile?: boolean;
  clientReferrals?: boolean;
  auditedFinancials?: boolean;
  bankReferences?: boolean;
  paymentTerms?: boolean;
  liquidityRatios?: boolean;
  warranties?: boolean;
  afterSalesSupport?: boolean;
  sampleTesting?: boolean;
  safetyRecords?: boolean;
  environmentalPolicy?: boolean;
  insuranceCoverage?: boolean;
  disasterPreparedness?: boolean;
  completedAt?: Date;
  completedBy?: mongoose.Types.ObjectId | any;
  verifiedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId | any;
}

export interface IComplianceDocument {
  documentType:
    | 'tax_clearance'
    | 'registration_certificate'
    | 'bee_certificate'
    | 'insurance'
    | 'bank_confirmation'
    | 'company_registration_cr14'
    | 'registered_address_cr6'
    | 'nssa_compliance'
    | 'nec_registration'
    | 'industry_licence'
    | 'iso_certification'
    | 'company_profile'
    | 'client_referral'
    | 'audited_financials'
    | 'bank_reference'
    | 'environmental_policy'
    | 'safety_records'
    | 'disaster_preparedness'
    | 'other';
  fileName: string;
  filePath: string;
  mimeType?: string;
  fileSize?: number;
  uploadedBy?: mongoose.Types.ObjectId | any;
  expiryDate?: Date;
  uploadedAt: Date;
  verified: boolean;
  verifiedBy?: mongoose.Types.ObjectId | any;
  verifiedAt?: Date;
  notes?: string;
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
  kysChecklist: IKysChecklist;
  clientReferrals: IClientReferral[];
  kysComplete: boolean;
  kysExempt: boolean;
  kysExemptReason?: string;
  kysExemptBy?: mongoose.Types.ObjectId | any;
  kysExemptAt?: Date;
  lastEvaluationAt?: Date;
  nextEvaluationDue?: Date;
  status: 'pending' | 'active' | 'suspended' | 'blacklisted' | 'dormant';
  /**
   * Whether the supplier may be transacted with, kept separate from the
   * lifecycle `status` above. Mature platforms all split these (Oracle:
   * Prospective vs Spend Authorized; Zycus: Potential vs Operational),
   * because one field with many writers is how a supplier accidentally
   * becomes awardable. `prospective` may be invited to source and quote;
   * only `spend_authorized` may be awarded or issued a PO.
   */
  transactability: 'none' | 'prospective' | 'spend_authorized';
  transactabilityChangedBy?: mongoose.Types.ObjectId | any;
  transactabilityChangedAt?: Date;
  /**
   * Diligence depth band. Required KYS coverage is proportionate to this
   * rather than uniform: ISO 37001 8.2 triggers due diligence only on
   * "more than low" risk, and ISO 9001 8.4.2(c) scales control by impact.
   */
  tier: 'critical' | 'strategic' | 'tactical' | 'transactional' | 'unclassified';
  tierReason?: string;
  tierSetBy?: mongoose.Types.ObjectId | any;
  tierSetAt?: Date;
  /** Set when a required compliance document has lapsed (see expiry job). */
  hasExpiredDocuments: boolean;
  expiredDocumentTypes?: string[];
  blacklistReason?: string;
  blacklistedBy?: mongoose.Types.ObjectId | any;
  blacklistedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId | any;
  approvedAt?: Date;
  notes?: string;
  website?: string;
  incorporationDate?: Date;
  proposedBusiness?: string;
  tradeVolume?: string;
  tradeProducts?: string[];
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
    enum: [
      'tax_clearance', 'registration_certificate', 'bee_certificate', 'insurance', 'bank_confirmation',
      'company_registration_cr14', 'registered_address_cr6', 'nssa_compliance', 'nec_registration',
      'industry_licence', 'iso_certification', 'company_profile', 'client_referral',
      'audited_financials', 'bank_reference', 'environmental_policy', 'safety_records',
      'disaster_preparedness', 'other'
    ],
    required: true
  },
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  mimeType: String,
  fileSize: Number,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  expiryDate: Date,
  uploadedAt: { type: Date, default: Date.now },
  verified: { type: Boolean, default: false },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
  notes: String
});

const ClientReferralSchema = new Schema<IClientReferral>({
  clientName: { type: String, required: true },
  contactPerson: String,
  contactEmail: String,
  contactPhone: String,
  projectDescription: String
}, { _id: true });

const KysChecklistSchema = new Schema<IKysChecklist>({
  cr14Directors: Boolean,
  cr6Address: Boolean,
  taxClearance: Boolean,
  nssaCompliance: Boolean,
  necRegistration: Boolean,
  industryLicences: Boolean,
  isoCertification: Boolean,
  companyProfile: Boolean,
  clientReferrals: Boolean,
  auditedFinancials: Boolean,
  bankReferences: Boolean,
  paymentTerms: Boolean,
  liquidityRatios: Boolean,
  warranties: Boolean,
  afterSalesSupport: Boolean,
  sampleTesting: Boolean,
  safetyRecords: Boolean,
  environmentalPolicy: Boolean,
  insuranceCoverage: Boolean,
  disasterPreparedness: Boolean,
  completedAt: Date,
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

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
    country: { type: String, default: 'Zimbabwe' }
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
  kysChecklist: { type: KysChecklistSchema, default: () => ({}) },
  clientReferrals: [ClientReferralSchema],
  kysComplete: { type: Boolean, default: false },
  kysExempt: { type: Boolean, default: false },
  kysExemptReason: String,
  kysExemptBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  kysExemptAt: Date,
  lastEvaluationAt: Date,
  nextEvaluationDue: Date,
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'blacklisted', 'dormant'],
    default: 'pending'
  },
  transactability: {
    type: String,
    enum: ['none', 'prospective', 'spend_authorized'],
    default: 'none',
    index: true
  },
  transactabilityChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  transactabilityChangedAt: Date,
  tier: {
    type: String,
    enum: ['critical', 'strategic', 'tactical', 'transactional', 'unclassified'],
    default: 'unclassified',
    index: true
  },
  tierReason: String,
  tierSetBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tierSetAt: Date,
  hasExpiredDocuments: { type: Boolean, default: false },
  expiredDocumentTypes: [{ type: String }],
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
  website: String,
  incorporationDate: Date,
  proposedBusiness: String,
  tradeVolume: String,
  tradeProducts: [{ type: String, trim: true }],
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
