const mongoose = require('mongoose');

const RequisitionItemSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  quantityRequested: {
    type: Number,
    required: true,
    min: 1
  },
  quantityIssued: {
    type: Number,
    default: 0
  },
  notes: String
});

const StoreRequisitionSchema = new mongoose.Schema({
  requisitionNumber: {
    type: String,
    unique: true,
    required: true
  },
  site: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
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
  purpose: {
    type: String,
    required: [true, 'Purpose is required']
  },
  requiredDate: Date,
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'partially_issued', 'issued', 'rejected', 'cancelled'],
    default: 'draft'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  issuedAt: Date,
  notes: String,
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Generate requisition number before saving
StoreRequisitionSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments();
    const year = new Date().getFullYear();
    this.requisitionNumber = `SR-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('StoreRequisition', StoreRequisitionSchema);

