import mongoose, { Schema, type Document } from 'mongoose';

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
  lines: IMatchLineResult[];
  messages: string[];
  matchedAt?: Date;
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
  lines: [MatchLineSchema],
  messages: [String],
  matchedAt: Date
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
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedAt: Date,
  rejectionReason: String,
  notes: String,
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

InvoiceSchema.pre('save', async function (next) {
  if (this.isNew && !this.invoiceNumber) {
    const count = await (this.constructor as typeof mongoose.Model).countDocuments();
    const year = new Date().getFullYear();
    this.invoiceNumber = `INV-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  this.totalAmount = this.subtotal + (this.vatAmount || 0);
  this.balanceDue = Math.max(0, this.totalAmount - (this.amountPaid || 0));
  next();
});

export default mongoose.model<IInvoice>('Invoice', InvoiceSchema);
