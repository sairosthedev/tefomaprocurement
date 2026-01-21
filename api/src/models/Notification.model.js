const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'requisition_submitted',
      'requisition_approved',
      'requisition_rejected',
      'requisition_accepted',
      'requisition_rejected_procurement',
      'rfq_published',
      'quotation_submitted',
      'quotation_accepted',
      'quotation_rejected',
      'po_created',
      'po_finance_approved',
      'po_finance_rejected',
      'po_coo_approved',
      'po_coo_rejected',
      'po_submitted',
      'goods_received',
      'delivery_accepted',
      'delivery_rejected',
      'store_requisition_created',
      'store_requisition_approved',
      'store_requisition_rejected',
      'stock_issued',
      'low_stock',
      'rfq_deadline_approaching'
    ]
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  entity: {
    type: String,
    required: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  relatedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: Date,
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Compound index for unread notifications
NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

// Index for entity lookups
NotificationSchema.index({ entity: 1, entityId: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);

