const mongoose = require('mongoose');

const SiteSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Site code is required'],
      unique: true,
      uppercase: true,
      trim: true
    },
    name: {
      type: String,
      required: [true, 'Site name is required'],
      trim: true
    },
    type: {
      type: String,
      enum: ['hq', 'site'],
      default: 'site'
    },
    parentSite: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site'
    },
    address: {
      street: String,
      city: String,
      province: String,
      postalCode: String
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    hasLocalStore: {
      type: Boolean,
      default: true
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

SiteSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('Site', SiteSchema);
