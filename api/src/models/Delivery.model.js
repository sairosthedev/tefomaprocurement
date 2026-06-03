const mongoose = require('mongoose');

const DeliveryItemSchema = new mongoose.Schema({
  poItem: {
    type: mongoose.Schema.Types.ObjectId
  },
  description: String,
  quantityOrdered: Number,
  quantityReceived: {
    type: Number,
    required: true,
    min: 0
  },
  quantityRejected: {
    type: Number,
    default: 0
  },
  rejectionReason: String,
  condition: {
    type: String,
    enum: ['good', 'damaged', 'defective'],
    default: 'good'
  },
  notes: String
});

const DeliverySchema = new mongoose.Schema({
  grvNumber: {
    type: String,
    unique: true,
    sparse: true // Allow multiple pending deliveries without GRV numbers
  },
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
  deliveryNoteNumber: {
    type: String,
    trim: true
  },
  deliveryDate: {
    type: Date,
    required: true
  },
  expectedDeliveryDate: {
    type: Date
  },
  receivedAtSite: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site'
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  items: [DeliveryItemSchema],
  isPartialDelivery: {
    type: Boolean,
    default: false
  },
  isFinalDelivery: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'received', 'inspected', 'accepted', 'partially_accepted', 'rejected'],
    default: 'pending'
  },
  inspectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  inspectedAt: Date,
  notes: String,
  attachments: [{
    fileName: String,
    filePath: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Generate GRV number before saving (only for non-pending deliveries)
DeliverySchema.pre('save', async function(next) {
  // For pending deliveries, don't generate GRV number
  if (this.status === 'pending') {
    // Don't set grvNumber for pending deliveries
    return next();
  }

  // Generate GRV when status is not pending
  if (this.isNew && this.status !== 'pending') {
    const count = await this.constructor.countDocuments({ status: { $ne: 'pending' } });
    const year = new Date().getFullYear();
    this.grvNumber = `GRV-${year}-${String(count + 1).padStart(5, '0')}`;
  } else if (this.isModified('status') && this.status !== 'pending' && !this.grvNumber) {
    // When status changes from pending to received, generate GRV
    const count = await this.constructor.countDocuments({ status: { $ne: 'pending' } });
    const year = new Date().getFullYear();
    this.grvNumber = `GRV-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Delivery', DeliverySchema);

