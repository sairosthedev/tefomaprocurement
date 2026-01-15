const mongoose = require('mongoose');

const RequisitionItemSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item'
  },
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
  },
  estimatedUnitPrice: Number,
  estimatedTotalPrice: Number,
  storeAvailability: {
    available: { type: Boolean, default: false },
    quantityAvailable: { type: Number, default: 0 },
    checkedAt: Date,
    checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
});

const ApprovalHistorySchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['submitted', 'approved', 'rejected', 'returned'],
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

const PurchaseRequisitionSchema = new mongoose.Schema({
  requisitionNumber: {
    type: String,
    unique: true,
    required: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [RequisitionItemSchema],
  justification: {
    type: String,
    required: [true, 'Justification is required']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  requiredDate: Date,
  estimatedTotal: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'approved', 'rejected', 'sourcing', 'completed', 'cancelled'],
    default: 'draft'
  },
  approvalHistory: [ApprovalHistorySchema],
  currentApprover: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rfq: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RFQ'
  },
  notes: String,
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Generate requisition number before saving
PurchaseRequisitionSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments();
    const year = new Date().getFullYear();
    this.requisitionNumber = `PR-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  
  // Calculate estimated total
  this.estimatedTotal = this.items.reduce((sum, item) => {
    return sum + (item.estimatedTotalPrice || 0);
  }, 0);
  
  next();
});

module.exports = mongoose.model('PurchaseRequisition', PurchaseRequisitionSchema);

