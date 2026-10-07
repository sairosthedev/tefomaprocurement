import mongoose, { Schema, type Document } from 'mongoose';
import { nextNumber } from '../services/numbering.service.js';

export interface IPayment extends Document {
  paymentNumber: string;
  supplier: mongoose.Types.ObjectId;
  invoices: mongoose.Types.ObjectId[];
  amount: number;
  paymentDate: Date;
  paymentMethod: 'bank_transfer' | 'cheque' | 'eft' | 'cash' | 'other';
  reference?: string;
  /**
   * The banking details as they stood when this payment was raised.
   *
   * Without this the system could not say which account a historical payment
   * was directed to — supplier bank details were mutable in place, so the
   * only record was a diff of audit blobs by timestamp. Snapshotting here
   * makes each payment self-describing and is what lets a "change, pay,
   * change back" pattern be detected after the fact.
   */
  paidToBankDetails?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    branchCode?: string;
    accountType?: string;
  };
  status: 'draft' | 'completed' | 'cancelled';
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  completedBy?: mongoose.Types.ObjectId;
  completedAt?: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>({
  paymentNumber: { type: String, unique: true },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupplierProfile',
    required: true
  },
  invoices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  }],
  amount: { type: Number, required: true, min: 0 },
  paymentDate: { type: Date, required: true },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'cheque', 'eft', 'cash', 'other'],
    default: 'bank_transfer'
  },
  reference: String,
  paidToBankDetails: {
    bankName: String,
    accountName: String,
    accountNumber: String,
    branchCode: String,
    accountType: String
  },
  status: {
    type: String,
    enum: ['draft', 'completed', 'cancelled'],
    default: 'draft'
  },
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completedAt: Date,
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// Numbering runs on `pre('validate')`, not `pre('save')`: Mongoose validates
// before user save hooks, so a required number field assigned in `pre('save')`
// fails validation and the hook never runs at all.
PaymentSchema.pre('validate', async function () {
  if (this.isNew && !this.paymentNumber) {
    this.paymentNumber = await nextNumber(this, { type: 'payment', prefix: 'PAY' });
  }
});

export default mongoose.model<IPayment>('Payment', PaymentSchema);
