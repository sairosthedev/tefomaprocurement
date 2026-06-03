const mongoose = require('mongoose');

const TransferItemSchema = new mongoose.Schema({
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
  quantityShipped: {
    type: Number,
    default: 0,
    min: 0
  },
  quantityReceived: {
    type: Number,
    default: 0,
    min: 0
  },
  notes: String
});

const StockTransferSchema = new mongoose.Schema(
  {
    transferNumber: {
      type: String,
      unique: true,
      required: true
    },
    fromSite: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
      required: true
    },
    toSite: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
      required: true
    },
    items: [TransferItemSchema],
    status: {
      type: String,
      enum: [
        'draft',
        'pending',
        'approved',
        'in_transit',
        'received',
        'partially_received',
        'cancelled',
        'rejected'
      ],
      default: 'pending'
    },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    shippedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    shippedAt: Date,
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receivedAt: Date,
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: Date,
    rejectionReason: String,
    notes: String,
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

StockTransferSchema.pre('save', async function (next) {
  if (this.isNew && !this.transferNumber) {
    const count = await this.constructor.countDocuments();
    const year = new Date().getFullYear();
    this.transferNumber = `TRF-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('StockTransfer', StockTransferSchema);
