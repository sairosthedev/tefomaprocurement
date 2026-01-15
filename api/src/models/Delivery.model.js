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
    required: true
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
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
    enum: ['received', 'inspected', 'accepted', 'partially_accepted', 'rejected'],
    default: 'received'
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

// Generate GRV number before saving
DeliverySchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments();
    const year = new Date().getFullYear();
    this.grvNumber = `GRV-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Delivery', DeliverySchema);

