import mongoose, { Schema, type Document } from 'mongoose';
import { nextNumber } from '../services/numbering.service.js';

export interface IInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  poItemIndex?: number;
}

export interface IMatchLineResult {
  description: string;
  poQuantity: number;
  receivedQuantity: number;
  invoicedQuantity: number;
  poLineTotal: number;
  receivedValue: number;
  invoicedLineTotal: number;
  quantityVariance: number;
  amountVariance: number;
  matched: boolean;
}

export interface IThreeWayMatchResult {
  poNumber: string;
  poTotal: number;
  receivedValue: number;
  invoicedTotal: number;
  varianceAmount: number;
  matched: boolean;
  withinTolerance: boolean;
  /** GRV numbers whose receipted quantities back this match. */
  grvNumbers?: string[];
  /** Whether stores has raised any GRV for the PO at all. */
  hasGrv?: boolean;
  lines: IMatchLineResult[];
  messages: string[];
  matchedAt?: Date;
}

/** Record of a finance user approving an invoice despite a failed match. */
export interface IVarianceOverride {
  reason: string;
  approvedBy: mongoose.Types.ObjectId;
  approvedAt: Date;
  varianceAmount: number;
  hadGrv: boolean;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  vendorInvoiceNumber?: string;
  purchaseOrder: mongoose.Types.ObjectId;
  supplier: mongoose.Types.ObjectId;
  submittedBy: mongoose.Types.ObjectId;
  items: IInvoiceItem[];
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  invoiceDate: Date;
  dueDate?: Date;
  status:
    | 'draft'
    | 'submitted'
    | 'variance'
    | 'approved'
    | 'rejected'
    | 'partially_paid'
    | 'paid'
    | 'cancelled';
  matchResult?: IThreeWayMatchResult;
  varianceOverride?: IVarianceOverride;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectedBy?: mongoose.Types.ObjectId;
  rejectedAt?: Date;
  rejectionReason?: string;
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceItemSchema = new Schema<IInvoiceItem>({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number, required: true, min: 0 },
  poItemIndex: Number
});

const MatchLineSchema = new Schema<IMatchLineResult>({
  description: String,
  poQuantity: Number,
  receivedQuantity: Number,
  invoicedQuantity: Number,
  poLineTotal: Number,
  receivedValue: Number,
  invoicedLineTotal: Number,
  quantityVariance: Number,
  amountVariance: Number,
  matched: Boolean
}, { _id: false });

const MatchResultSchema = new Schema<IThreeWayMatchResult>({
  poNumber: String,
  poTotal: Number,
  receivedValue: Number,
  invoicedTotal: Number,
  varianceAmount: Number,
  matched: Boolean,
  withinTolerance: Boolean,
  grvNumbers: [String],
  hasGrv: Boolean,
  lines: [MatchLineSchema],
  messages: [String],
  matchedAt: Date
}, { _id: false });

const VarianceOverrideSchema = new Schema<IVarianceOverride>({
  reason: { type: String, required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedAt: { type: Date, required: true },
  varianceAmount: Number,
  hadGrv: Boolean
}, { _id: false });

const InvoiceSchema = new Schema<IInvoice>({
  invoiceNumber: { type: String, unique: true },
  vendorInvoiceNumber: String,
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    required: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupplierProfile',
    required: true
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [InvoiceItemSchema],
  subtotal: { type: Number, required: true, default: 0 },
  vatAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true, default: 0 },
  amountPaid: { type: Number, default: 0 },
  balanceDue: { type: Number, default: 0 },
  invoiceDate: { type: Date, required: true },
  dueDate: Date,
  status: {
    type: String,
    enum: ['draft', 'submitted', 'variance', 'approved', 'rejected', 'partially_paid', 'paid', 'cancelled'],
    default: 'submitted'
  },
  matchResult: MatchResultSchema,
  varianceOverride: VarianceOverrideSchema,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedAt: Date,
  rejectionReason: String,
  notes: String,
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

InvoiceSchema.pre('save', async function (next) {
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  this.totalAmount = this.subtotal + (this.vatAmount || 0);
  this.balanceDue = Math.max(0, this.totalAmount - (this.amountPaid || 0));
  next();
});

// Numbering runs on `pre('validate')`, not `pre('save')`: Mongoose validates
// before user save hooks, so a required number field assigned in `pre('save')`
// fails validation and the hook never runs at all.
InvoiceSchema.pre('validate', async function () {
  if (this.isNew && !this.invoiceNumber) {
    this.invoiceNumber = await nextNumber(this, { type: 'invoice', prefix: 'INV' });
  }
});

export default mongoose.model<IInvoice>('Invoice', InvoiceSchema);
