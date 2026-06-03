const mongoose = require('mongoose');

const RFQItemSchema = new mongoose.Schema({
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

const InvitedSupplierSchema = new mongoose.Schema({
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

const RFQSchema = new mongoose.Schema({
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
    const count = await this.constructor.countDocuments();
    const year = new Date().getFullYear();
    this.rfqNumber = `RFQ-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('RFQ', RFQSchema);

