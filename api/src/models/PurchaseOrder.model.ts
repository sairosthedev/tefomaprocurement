import mongoose, { Schema, type Document } from 'mongoose';
import { requiresCooApproval } from '../services/poApprovalFlow.service.js';

export interface IPOItem {
  description: string;
  specifications?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  totalPrice: number;
  quantityReceived: number;
  quantityPending?: number;
}

export interface IApprovalHistory {
  action: 'created' | 'submitted' | 'hod_approved' | 'hod_rejected' | 'finance_approved' | 'finance_rejected' | 'coo_approved' | 'coo_rejected' | 'issued' | 'acknowledged';
  by: mongoose.Types.ObjectId | any;
  role?: string;
  comments?: string;
  timestamp?: Date;
}

export interface IPurchaseOrder extends Document {
  poNumber: string;
  quotation: mongoose.Types.ObjectId | any;
  rfq?: mongoose.Types.ObjectId | any;
  purchaseRequisition?: mongoose.Types.ObjectId | any;
  supplier: mongoose.Types.ObjectId | any;
  createdBy: mongoose.Types.ObjectId | any;
  items: IPOItem[];
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  deliverToSite?: mongoose.Types.ObjectId | any;
  deliveryAddress?: {
    street?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  };
  expectedDeliveryDate?: Date;
  paymentTerms?: string;
  termsAndConditions?: string;
  status: 'draft' | 'pending_hod' | 'pending_finance' | 'pending_coo' | 'pending_approvals' | 'approved' | 'rejected' | 'issued' | 'partially_received' | 'completed' | 'cancelled';
  hodApproved: boolean;
  hodApprovedBy?: mongoose.Types.ObjectId | any;
  hodApprovedAt?: Date;
  requiresCooApproval: boolean;
  financeApproved: boolean;
  financeApprovedBy?: mongoose.Types.ObjectId | any;
  financeApprovedAt?: Date;
  cooApproved: boolean;
  cooApprovedBy?: mongoose.Types.ObjectId | any;
  cooApprovedAt?: Date;
  approvalHistory: IApprovalHistory[];
  issuedAt?: Date;
  issuedBy?: mongoose.Types.ObjectId | any;
  version: number;
  totalInvoiced: number;
  totalPaid: number;
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const POItemSchema = new Schema<IPOItem>({
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
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  quantityReceived: {
    type: Number,
    default: 0
  },
  quantityPending: {
    type: Number
  }
});

const ApprovalHistorySchema = new Schema<IApprovalHistory>({
  action: {
    type: String,
    enum: ['created', 'submitted', 'hod_approved', 'hod_rejected', 'finance_approved', 'finance_rejected', 'coo_approved', 'coo_rejected', 'issued', 'acknowledged'],
    required: true
  },
  by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: String,
  comments: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const PurchaseOrderSchema = new Schema<IPurchaseOrder>({
  poNumber: {
    type: String,
    unique: true,
    required: true
  },
  quotation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation',
    required: true
  },
  rfq: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RFQ'
  },
  purchaseRequisition: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseRequisition'
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupplierProfile',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [POItemSchema],
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
  deliverToSite: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site'
  },
  deliveryAddress: {
    street: String,
    city: String,
    province: String,
    postalCode: String
  },
  expectedDeliveryDate: Date,
  paymentTerms: String,
  termsAndConditions: String,
  status: {
    type: String,
    enum: ['draft', 'pending_hod', 'pending_finance', 'pending_coo', 'pending_approvals', 'approved', 'rejected', 'issued', 'partially_received', 'completed', 'cancelled'],
    default: 'draft'
  },
  hodApproved: {
    type: Boolean,
    default: false
  },
  hodApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  hodApprovedAt: Date,
  requiresCooApproval: {
    type: Boolean,
    default: false
  },
  financeApproved: {
    type: Boolean,
    default: false
  },
  financeApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  financeApprovedAt: Date,
  cooApproved: {
    type: Boolean,
    default: false
  },
  cooApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cooApprovedAt: Date,
  approvalHistory: [ApprovalHistorySchema],
  issuedAt: Date,
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  version: {
    type: Number,
    default: 1
  },
  totalInvoiced: {
    type: Number,
    default: 0
  },
  totalPaid: {
    type: Number,
    default: 0
  },
  notes: String,
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Generate PO number before saving
PurchaseOrderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await (this.constructor as any).countDocuments();
    const year = new Date().getFullYear();
    this.poNumber = `PO-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  // FC-HQ-P-07 §6.3.11 — COO required above USD 5,000
  this.requiresCooApproval = requiresCooApproval(this.totalAmount);

  // Calculate pending quantities
  this.items.forEach((item: any) => {
    item.quantityPending = item.quantity - item.quantityReceived;
  });

  next();
});

export default mongoose.model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);
