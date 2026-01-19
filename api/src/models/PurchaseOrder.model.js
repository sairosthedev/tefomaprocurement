const mongoose = require('mongoose');

const POItemSchema = new mongoose.Schema({
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

const ApprovalHistorySchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['created', 'submitted', 'finance_approved', 'finance_rejected', 'coo_approved', 'coo_rejected', 'issued', 'acknowledged'],
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

const PurchaseOrderSchema = new mongoose.Schema({
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
    enum: ['draft', 'pending_finance', 'pending_coo', 'pending_approvals', 'approved', 'rejected', 'issued', 'partially_received', 'completed', 'cancelled'],
    default: 'draft'
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
    const count = await this.constructor.countDocuments();
    const year = new Date().getFullYear();
    this.poNumber = `PO-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  
  // Calculate pending quantities
  this.items.forEach(item => {
    item.quantityPending = item.quantity - item.quantityReceived;
  });
  
  next();
});

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema);

