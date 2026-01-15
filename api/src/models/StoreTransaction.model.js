const mongoose = require('mongoose');

const StoreTransactionSchema = new mongoose.Schema({
  transactionNumber: {
    type: String,
    unique: true,
    required: true
  },
  type: {
    type: String,
    enum: ['receipt', 'issue', 'adjustment', 'transfer', 'return'],
    required: true
  },
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  inventory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  previousQuantity: {
    type: Number,
    required: true
  },
  newQuantity: {
    type: Number,
    required: true
  },
  unitCost: Number,
  totalValue: Number,
  reference: {
    type: {
      type: String,
      enum: ['grv', 'store_requisition', 'adjustment', 'transfer']
    },
    document: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'reference.type'
    }
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  reason: String,
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: String,
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Generate transaction number before saving
StoreTransactionSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments();
    const year = new Date().getFullYear();
    const typePrefix = this.type.substring(0, 3).toUpperCase();
    this.transactionNumber = `ST-${typePrefix}-${year}-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('StoreTransaction', StoreTransactionSchema);

