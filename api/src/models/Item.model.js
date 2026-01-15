const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Item code is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  unit: {
    type: String,
    required: [true, 'Unit of measure is required'],
    enum: ['each', 'kg', 'litre', 'meter', 'box', 'pack', 'set', 'roll', 'sheet', 'pair'],
    default: 'each'
  },
  reorderLevel: {
    type: Number,
    default: 0
  },
  specifications: {
    type: Map,
    of: String
  },
  status: {
    type: String,
    enum: ['active', 'discontinued'],
    default: 'active'
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

ItemSchema.index({ name: 'text', description: 'text', category: 'text' });

module.exports = mongoose.model('Item', ItemSchema);

