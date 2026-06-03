const mongoose = require('mongoose');

const QuotationItemSchema = new mongoose.Schema({
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

const QuotationSchema = new mongoose.Schema({
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
    enum: ['draft', 'submitted', 'under_review', 'accepted', 'rejected', 'expired'],
    default: 'draft'
  },
  submittedAt: Date,
  isLocked: {
    type: Boolean,
    default: false
  },
  lockedAt: Date,
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
    const count = await this.constructor.countDocuments();
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

module.exports = mongoose.model('Quotation', QuotationSchema);

