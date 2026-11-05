import mongoose, { Schema, type Document } from 'mongoose';
import { nextSequence, sbuNumberPrefix } from '../services/numbering.service.js';

/** What kind of business the supplier runs, as they describe it. Optional. */
export const SUPPLIER_BUSINESS_TYPES = [
  'manufacturer',
  'distributor',
  'wholesaler',
  'retailer',
  'service_provider',
  'contractor',
  'other'
] as const;
export type SupplierBusinessType = (typeof SUPPLIER_BUSINESS_TYPES)[number];

/** Whether the supplier is a registered company or a person trading alone. Optional. */
export const SUPPLIER_ENTITY_TYPES = ['company', 'individual'] as const;
export type SupplierEntityType = (typeof SUPPLIER_ENTITY_TYPES)[number];

export const SUPPLIER_STATUSES = ['pending', 'active', 'suspended', 'blacklisted', 'dormant', 'rejected'] as const;

/**
 * A pending supplier put forward for activation, waiting on a second person.
 * Present only while the request is open; approval, return and rejection all
 * clear it.
 */
export interface IActivationRequest {
  requestedBy: mongoose.Types.ObjectId | any;
  requestedAt: Date;
  notes?: string;
  /** True when the supplier goes forward without a complete KYS for its tier. */
  kysOverride: boolean;
  kysOverrideReason?: string;
}

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

/** One lifecycle status change and why it was made. */
export interface IStatusChange {
  from?: string;
  to: string;
  reason?: string;
  by?: mongoose.Types.ObjectId | any;
  at: Date;
}

export interface ISupplierProfile extends Document {
  user: mongoose.Types.ObjectId | any;
  /**
   * Permanent register number, e.g. `DOKUMA-SUP-00042`. Assigned on first
   * save and never changed: it outlives name and registration-number edits.
   */
  supplierCode?: string;
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
  businessType?: SupplierBusinessType;
  entityType?: SupplierEntityType;
  /**
   * `rejected` is a registration that was turned down. Unlike `blacklisted`
   * it says nothing against the company; it was never let on the register.
   */
  status: (typeof SUPPLIER_STATUSES)[number];
  /**
   * Activation takes two people: one submits (this request), the Head of
   * Procurement or the COO approves. One officer could once take a supplier
   * from pending to paid alone, KYS override included.
   */
  activationRequest?: IActivationRequest;
  rejectionReason?: string;
  rejectedBy?: mongoose.Types.ObjectId | any;
  rejectedAt?: Date;
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
  /**
   * Reasons given for suspensions, reactivations, approvals and liftings.
   * These used to overwrite `notes`, which is the supplier's description of
   * their services, so each status change erased it.
   */
  statusHistory?: IStatusChange[];
  notes?: string;
  website?: string;
  incorporationDate?: Date;
  proposedBusiness?: string;
  tradeVolume?: string;
  tradeProducts?: string[];
  /**
   * How this supplier was sourced onto the register (6.2.1). 'newspaper' means
   * they responded to a public newspaper invitation — recorded for audit trail
   * even though the invitation itself happens outside the system.
   */
  onboardingMethod?: 'newspaper' | 'direct_application' | 'referral' | 'existing' | 'other';
  onboardingMethodNotes?: string;
  /** Site visit / vetting record (clause 5.5). */
  siteVisitDate?: Date;
  siteVisitBy?: string;
  siteVisitNotes?: string;
  vettingStatus?: 'not_started' | 'in_progress' | 'passed' | 'failed';
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

const StatusChangeSchema = new Schema<IStatusChange>({
  from: String,
  to: { type: String, required: true },
  reason: { type: String, trim: true },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  at: { type: Date, default: Date.now }
}, { _id: false });

const ActivationRequestSchema = new Schema<IActivationRequest>({
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requestedAt: { type: Date, required: true, default: Date.now },
  notes: { type: String, trim: true },
  kysOverride: { type: Boolean, default: false },
  kysOverrideReason: { type: String, trim: true }
}, { _id: false });

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
  supplierCode: { type: String, trim: true },
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
  businessType: { type: String, enum: SUPPLIER_BUSINESS_TYPES },
  entityType: { type: String, enum: SUPPLIER_ENTITY_TYPES },
  status: {
    type: String,
    enum: SUPPLIER_STATUSES,
    default: 'pending'
  },
  // No default: only a supplier with an open request carries one.
  activationRequest: { type: ActivationRequestSchema, default: undefined },
  rejectionReason: { type: String, trim: true },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedAt: Date,
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
  // No default: records without a status change carry no empty array.
  statusHistory: { type: [StatusChangeSchema], default: undefined },
  notes: String,
  website: String,
  incorporationDate: Date,
  proposedBusiness: String,
  tradeVolume: String,
  tradeProducts: [{ type: String, trim: true }],
  onboardingMethod: {
    type: String,
    enum: ['newspaper', 'direct_application', 'referral', 'existing', 'other']
  },
  onboardingMethodNotes: { type: String, trim: true },
  siteVisitDate: Date,
  siteVisitBy: { type: String, trim: true },
  siteVisitNotes: { type: String, trim: true },
  vettingStatus: {
    type: String,
    enum: ['not_started', 'in_progress', 'passed', 'failed'],
    default: 'not_started'
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for searching
SupplierProfileSchema.index({ companyName: 'text', tradingName: 'text', categories: 'text' });
// Sparse: records created before codes existed have none until backfilled.
SupplierProfileSchema.index({ supplierCode: 1 }, { sparse: true });

/**
 * Supplier codes have no year: they are permanent, so the counter does not
 * restart each January. The key is `supplier:0`.
 */
export const SUPPLIER_CODE_COUNTER = { type: 'supplier', year: 0 } as const;
/** Reads the sequence back out of a code, with or without the SBU prefix. */
export const SUPPLIER_CODE_PATTERN = /^(?:[A-Z][A-Z0-9_]*-)?SUP-(\d+)$/;

/** Reserve the next supplier code in the document's own SBU database. */
export async function nextSupplierCode(doc: Document): Promise<string> {
  const seq = await nextSequence(doc, SUPPLIER_CODE_COUNTER.type, SUPPLIER_CODE_COUNTER.year);
  return `${sbuNumberPrefix()}SUP-${String(seq).padStart(5, '0')}`;
}

// Numbering runs on `pre('validate')`, as for every numbered document. A
// record loaded with a projection that left the code out is not given a new
// one over the top of it.
SupplierProfileSchema.pre('validate', async function () {
  if (!this.supplierCode && this.isSelected('supplierCode')) {
    this.supplierCode = await nextSupplierCode(this);
  }
});

export default mongoose.model<ISupplierProfile>('SupplierProfile', SupplierProfileSchema);
