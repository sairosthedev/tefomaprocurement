import mongoose, { Schema, type Document } from 'mongoose';

export interface IPayment extends Document {
  paymentNumber: string;
  supplier: mongoose.Types.ObjectId;
  invoices: mongoose.Types.ObjectId[];
  amount: number;
  paymentDate: Date;
  paymentMethod: 'bank_transfer' | 'cheque' | 'eft' | 'cash' | 'other';
  reference?: string;
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

PaymentSchema.pre('save', async function (next) {
  if (this.isNew && !this.paymentNumber) {
    const count = await (this.constructor as typeof mongoose.Model).countDocuments();
    const year = new Date().getFullYear();
    this.paymentNumber = `PAY-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

export default mongoose.model<IPayment>('Payment', PaymentSchema);
