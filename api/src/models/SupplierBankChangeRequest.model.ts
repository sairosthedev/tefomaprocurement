import mongoose, { Schema, type Document } from 'mongoose';

/**
 * A pending change to a supplier's banking details.
 *
 * Bank details were previously overwritten in place by supplier self-service,
 * with no diff, no notification and no re-verification — the classic
 * payment-redirection fraud vector (FBI IC3: $55.5bn across 305,033 BEC
 * incidents, 2013-2023). A change is now a *request* that takes effect only
 * once approved, and while one is pending, payments to that supplier pause.
 *
 * Modelled on Oracle Fusion's supplier bank-account change approval: the
 * fields that trigger approval are the ones that redirect money (account
 * number, bank name, branch, account name/type). The callback step records
 * an out-of-band verification made on a number ALREADY ON FILE — never one
 * supplied in the request itself, which is how the fraud usually arrives.
 */

export interface IBankSnapshot {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  branchCode?: string;
  accountType?: 'current' | 'savings' | 'cheque';
}

/** One changed field, kept as an explicit before/after pair for audit. */
export interface IBankFieldChange {
  field: string;
  from?: string;
  to?: string;
}

export interface ICallbackVerification {
  /** The number called — must be one already held on file. */
  numberCalled: string;
  /** Who at the supplier confirmed the change. */
  confirmedBy: string;
  verifiedBy: mongoose.Types.ObjectId | any;
  verifiedAt: Date;
  notes?: string;
}

export interface ISupplierBankChangeRequest extends Document {
  supplier: mongoose.Types.ObjectId | any;
  requestedBy: mongoose.Types.ObjectId | any;
  /** Whether the supplier asked for this themselves, or staff did. */
  requestedVia: 'supplier_portal' | 'procurement';
  previousDetails: IBankSnapshot;
  requestedDetails: IBankSnapshot;
  changes: IBankFieldChange[];
  /** Supporting evidence (bank letter etc.), mandatory for account changes. */
  supportingDocument?: {
    fileName: string;
    fileData: string;
    mimeType?: string;
    uploadedAt: Date;
  };
  status: 'pending_verification' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';
  callback?: ICallbackVerification;
  /** Approver must differ from whoever requested and whoever called back. */
  approvedBy?: mongoose.Types.ObjectId | any;
  approvedAt?: Date;
  rejectedBy?: mongoose.Types.ObjectId | any;
  rejectedAt?: Date;
  rejectionReason?: string;
  appliedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BankSnapshotSchema = new Schema<IBankSnapshot>({
  bankName: String,
  accountName: String,
  accountNumber: String,
  branchCode: String,
  accountType: { type: String, enum: ['current', 'savings', 'cheque'] }
}, { _id: false });

const SupplierBankChangeRequestSchema = new Schema<ISupplierBankChangeRequest>({
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupplierProfile',
    required: true,
    index: true
  },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requestedVia: {
    type: String,
    enum: ['supplier_portal', 'procurement'],
    default: 'supplier_portal'
  },
  previousDetails: { type: BankSnapshotSchema, default: () => ({}) },
  requestedDetails: { type: BankSnapshotSchema, required: true },
  changes: [new Schema<IBankFieldChange>({
    field: { type: String, required: true },
    from: String,
    to: String
  }, { _id: false })],
  supportingDocument: {
    fileName: String,
    fileData: String,
    mimeType: String,
    uploadedAt: Date
  },
  status: {
    type: String,
    enum: ['pending_verification', 'pending_approval', 'approved', 'rejected', 'cancelled'],
    default: 'pending_verification',
    index: true
  },
  callback: {
    numberCalled: String,
    confirmedBy: String,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: Date,
    notes: String
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedAt: Date,
  rejectionReason: String,
  appliedAt: Date
}, { timestamps: true });

/** Open requests are the ones that pause payment. */
SupplierBankChangeRequestSchema.index({ supplier: 1, status: 1 });

export default mongoose.model<ISupplierBankChangeRequest>(
  'SupplierBankChangeRequest',
  SupplierBankChangeRequestSchema
);
