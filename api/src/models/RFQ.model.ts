import mongoose, { Schema, type Document } from 'mongoose';

export interface IRFQItem {
  description: string;
  specifications?: string;
  quantity: number;
  unit: string;
}

export interface IInvitedSupplier {
  supplier: mongoose.Types.ObjectId | any;
  invitedAt: Date;
  viewedAt?: Date;
  responded: boolean;
  respondedAt?: Date;
  quotation?: mongoose.Types.ObjectId | any;
}

export interface IRFQ extends Document {
  rfqNumber: string;
  title: string;
  description?: string;
  site?: mongoose.Types.ObjectId | any;
  purchaseRequisition?: mongoose.Types.ObjectId | any;
  items: IRFQItem[];
  invitedSuppliers: IInvitedSupplier[];
  createdBy: mongoose.Types.ObjectId | any;
  submissionDeadline: Date;
  deliveryRequirements?: string;
  paymentTerms?: string;
  termsAndConditions?: string;
  status: 'draft' | 'open' | 'closed' | 'evaluating' | 'awarded' | 'cancelled';
  publishedAt?: Date;
  closedAt?: Date;
  selectedQuotation?: mongoose.Types.ObjectId | any;
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RFQItemSchema = new Schema<IRFQItem>({
  description: {
    type: String,
    required: true
  },
  specifications: String,
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unit: {
    type: String,
    required: true
  }
});

const InvitedSupplierSchema = new Schema<IInvitedSupplier>({
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupplierProfile',
    required: true
  },
  invitedAt: {
    type: Date,
    default: Date.now
  },
  viewedAt: Date,
  responded: {
    type: Boolean,
    default: false
  },
  respondedAt: Date,
  quotation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation'
  }
});

const RFQSchema = new Schema<IRFQ>({
  rfqNumber: {
    type: String,
    unique: true,
    required: true
  },
  title: {
    type: String,
    required: [true, 'RFQ title is required'],
    trim: true
  },
  description: String,
  site: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site'
  },
  purchaseRequisition: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseRequisition'
  },
  items: [RFQItemSchema],
  invitedSuppliers: [InvitedSupplierSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  submissionDeadline: {
    type: Date,
    required: [true, 'Submission deadline is required']
  },
  deliveryRequirements: String,
  paymentTerms: String,
  termsAndConditions: String,
  status: {
    type: String,
    enum: ['draft', 'open', 'closed', 'evaluating', 'awarded', 'cancelled'],
    default: 'draft'
  },
  publishedAt: Date,
  closedAt: Date,
  selectedQuotation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation'
  },
  notes: String,
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Generate RFQ number before saving
RFQSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await (this.constructor as any).countDocuments();
    const year = new Date().getFullYear();
    this.rfqNumber = `RFQ-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

export default mongoose.model<IRFQ>('RFQ', RFQSchema);
