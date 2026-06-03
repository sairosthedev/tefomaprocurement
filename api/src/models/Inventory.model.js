const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true
    },
    site: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
      required: true
    },
    /** @deprecated use site — kept for legacy reads during migration */
    location: {
      type: String,
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
  },
  { timestamps: true }
);

InventorySchema.pre('save', function (next) {
  this.quantityAvailable = this.quantityOnHand - this.quantityReserved;
  this.totalValue = this.quantityOnHand * this.unitCost;
  next();
});

InventorySchema.index({ item: 1, site: 1 }, { unique: true });

module.exports = mongoose.model('Inventory', InventorySchema);
