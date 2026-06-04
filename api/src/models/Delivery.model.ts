import mongoose, { Schema, type Document } from 'mongoose';

export interface IDeliveryItem {
  poItem?: mongoose.Types.ObjectId | any;
  description?: string;
  quantityOrdered?: number;
  quantityReceived: number;
  quantityRejected: number;
  rejectionReason?: string;
  condition: 'good' | 'damaged' | 'defective';
  notes?: string;
}

export interface IDeliveryAttachment {
  fileName?: string;
  filePath?: string;
  uploadedAt: Date;
}

export interface IDelivery extends Document {
  grvNumber?: string;
  purchaseOrder: mongoose.Types.ObjectId | any;
  supplier: mongoose.Types.ObjectId | any;
  deliveryNoteNumber?: string;
  deliveryDate: Date;
  expectedDeliveryDate?: Date;
  receivedAtSite?: mongoose.Types.ObjectId | any;
  receivedBy?: mongoose.Types.ObjectId | any;
  items: IDeliveryItem[];
  isPartialDelivery: boolean;
  isFinalDelivery: boolean;
  status: 'pending' | 'received' | 'inspected' | 'accepted' | 'partially_accepted' | 'rejected';
  inspectedBy?: mongoose.Types.ObjectId | any;
  inspectedAt?: Date;
  notes?: string;
  attachments: IDeliveryAttachment[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryItemSchema = new Schema<IDeliveryItem>({
  poItem: {
    type: mongoose.Schema.Types.ObjectId
  },
  description: String,
  quantityOrdered: Number,
  quantityReceived: {
    type: Number,
    required: true,
    min: 0
  },
  quantityRejected: {
    type: Number,
    default: 0
  },
  rejectionReason: String,
  condition: {
    type: String,
    enum: ['good', 'damaged', 'defective'],
    default: 'good'
  },
  notes: String
});

const DeliverySchema = new Schema<IDelivery>({
  grvNumber: {
    type: String,
    unique: true,
    sparse: true // Allow multiple pending deliveries without GRV numbers
  },
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    required: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupplierProfile',
    required: true
  },
  deliveryNoteNumber: {
    type: String,
    trim: true
  },
  deliveryDate: {
    type: Date,
    required: true
  },
  expectedDeliveryDate: {
    type: Date
  },
  receivedAtSite: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site'
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  items: [DeliveryItemSchema],
  isPartialDelivery: {
    type: Boolean,
    default: false
  },
  isFinalDelivery: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'received', 'inspected', 'accepted', 'partially_accepted', 'rejected'],
    default: 'pending'
  },
  inspectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  inspectedAt: Date,
  notes: String,
  attachments: [{
    fileName: String,
    filePath: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Generate GRV number before saving (only for non-pending deliveries)
DeliverySchema.pre('save', async function(next) {
  // For pending deliveries, don't generate GRV number
  if (this.status === 'pending') {
    // Don't set grvNumber for pending deliveries
    return next();
  }

  // Generate GRV when status is not pending
  const status = this.status as string;
  if (this.isNew && status !== 'pending') {
    const count = await (this.constructor as any).countDocuments({ status: { $ne: 'pending' } });
    const year = new Date().getFullYear();
    this.grvNumber = `GRV-${year}-${String(count + 1).padStart(5, '0')}`;
  } else if (this.isModified('status') && status !== 'pending' && !this.grvNumber) {
    // When status changes from pending to received, generate GRV
    const count = await (this.constructor as any).countDocuments({ status: { $ne: 'pending' } });
    const year = new Date().getFullYear();
    this.grvNumber = `GRV-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

export default mongoose.model<IDelivery>('Delivery', DeliverySchema);
