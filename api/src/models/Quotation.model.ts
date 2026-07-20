import mongoose, { Schema, type Document } from 'mongoose';

export interface IQuotationItem {
  /** The RFQ line this quote line answers, for per-line comparison and award.
   *  Falls back to description match for legacy quotes without it. */
  rfqLineId?: mongoose.Types.ObjectId | any;
  description: string;
  specifications?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  totalPrice: number;
  vatIncluded: boolean;
}

export interface IRevisionRequest {
  requestedBy: mongoose.Types.ObjectId | any;
  reason: string;
  /** Optional target-price guidance the officer gives the supplier. */
  targetNote?: string;
  requestedAt: Date;
}

export interface IQuotation extends Document {
  quotationNumber: string;
  rfq: mongoose.Types.ObjectId | any;
  site?: mongoose.Types.ObjectId | any;
  supplier: mongoose.Types.ObjectId | any;
  submittedBy: mongoose.Types.ObjectId | any;
  items: IQuotationItem[];
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  validityPeriod: number;
  validUntil?: Date;
  deliveryPeriod: number;
  paymentTerms: string;
  currency: 'USD' | 'ZWG' | 'ZAR';
  notes?: string;
  status:
    | 'draft'
    | 'submitted'
    | 'under_review'
    | 'revision_requested'
    | 'superseded'
    | 'accepted'
    | 'rejected'
    | 'expired';
  submittedAt?: Date;
  isLocked: boolean;
  lockedAt?: Date;
  // Price-negotiation trail. A revision resubmission is a NEW quotation linked
  // back to the one it replaces via `revisionOf`; the old one becomes 'superseded'.
  revisionOf?: mongoose.Types.ObjectId | any;
  revisionRound: number;
  revisionRequests: IRevisionRequest[];
  supersededBy?: mongoose.Types.ObjectId | any;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const QuotationItemSchema = new Schema<IQuotationItem>({
  rfqLineId: {
    type: mongoose.Schema.Types.ObjectId
  },
  description: {
    type: String,
    required: true
  },
  specifications: String,
  quantity: {
    type: Number,
    required: true
  },
  unit: String,
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true
  },
  vatIncluded: {
    type: Boolean,
    default: false
  }
});

const QuotationSchema = new Schema<IQuotation>({
  quotationNumber: {
    type: String,
    unique: true,
    required: true
  },
  rfq: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RFQ',
    required: true
  },
  site: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site'
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
  items: [QuotationItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  vatAmount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  validityPeriod: {
    type: Number, // days
    default: 30
  },
  validUntil: Date,
  deliveryPeriod: {
    type: Number, // days
    required: true
  },
  paymentTerms: {
    type: String,
    required: true
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'ZWG', 'ZAR']
  },
  notes: String,
  status: {
    type: String,
    enum: [
      'draft', 'submitted', 'under_review', 'revision_requested',
      'superseded', 'accepted', 'rejected', 'expired'
    ],
    default: 'draft'
  },
  submittedAt: Date,
  isLocked: {
    type: Boolean,
    default: false
  },
  lockedAt: Date,
  revisionOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation'
  },
  revisionRound: {
    type: Number,
    default: 0
  },
  revisionRequests: [
    {
      requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: String,
      targetNote: String,
      requestedAt: { type: Date, default: Date.now }
    }
  ],
  supersededBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation'
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Generate quotation number and lock on submission
QuotationSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await (this.constructor as any).countDocuments();
    const year = new Date().getFullYear();
    this.quotationNumber = `QT-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  // Lock quotation when submitted
  if (this.isModified('status') && this.status === 'submitted' && !this.isLocked) {
    this.isLocked = true;
    this.lockedAt = new Date();
    this.submittedAt = new Date();
    this.validUntil = new Date(Date.now() + this.validityPeriod * 24 * 60 * 60 * 1000);
  }

  next();
});

export default mongoose.model<IQuotation>('Quotation', QuotationSchema);
