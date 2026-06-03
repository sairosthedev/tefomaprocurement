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
  specification: String, // Singular - from frontend
  specifications: String, // Plural - alternate field name
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unit: {
    type: String,
    default: 'Each'
  },
  estimatedUnitPrice: Number,
  estimatedTotalPrice: Number,
  storeAvailability: {
    available: { type: Boolean, default: false },
    quantityAvailable: { type: Number, default: 0 },
    quantityAtSite: { type: Number, default: 0 },
    quantityAtOtherSites: { type: Number, default: 0 },
    suggestedAction: {
      type: String,
      enum: ['store_issue', 'stock_transfer', 'purchase', null],
      default: null
    },
    checkedAt: Date,
    checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
});

const StatusHistorySchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['submitted', 'accepted', 'rejected', 'returned', 'rfq_created', 'po_created'],
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
    unique: true
    // Not required - auto-generated in pre-save
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  site: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site'
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
    // Optional - some users may not have departments
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [RequisitionItemSchema],
  justification: {
    type: String
    // Optional - description/reason for the request
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
    enum: ['draft', 'pending_acceptance', 'accepted', 'rejected', 'sourcing', 'quoted', 'ordered', 'completed', 'cancelled'],
    default: 'draft'
  },
  statusHistory: [StatusHistorySchema],
  processedBy: {
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

// Generate requisition number before saving (if not already set)
PurchaseRequisitionSchema.pre('save', async function(next) {
  if (this.isNew && !this.requisitionNumber) {
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

