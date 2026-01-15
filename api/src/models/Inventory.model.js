const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  location: {
    type: String,
    default: 'Main Store',
    trim: true
  },
  quantityOnHand: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  quantityReserved: {
    type: Number,
    default: 0,
    min: 0
  },
  quantityAvailable: {
    type: Number,
    default: 0
  },
  unitCost: {
    type: Number,
    default: 0
  },
  totalValue: {
    type: Number,
    default: 0
  },
  lastReceivedDate: Date,
  lastIssuedDate: Date,
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Calculate available quantity and total value before saving
InventorySchema.pre('save', function(next) {
  this.quantityAvailable = this.quantityOnHand - this.quantityReserved;
  this.totalValue = this.quantityOnHand * this.unitCost;
  next();
});

// Compound index for item and location
InventorySchema.index({ item: 1, location: 1 }, { unique: true });

module.exports = mongoose.model('Inventory', InventorySchema);

