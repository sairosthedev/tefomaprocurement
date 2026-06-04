import mongoose, { Schema, type Document } from 'mongoose';

export interface IStoreRequisitionItem {
  item: mongoose.Types.ObjectId | any;
  quantityRequested: number;
  quantityIssued: number;
  notes?: string;
}

export interface IStoreRequisition extends Document {
  requisitionNumber: string;
  site: mongoose.Types.ObjectId | any;
  department: mongoose.Types.ObjectId | any;
  requestedBy: mongoose.Types.ObjectId | any;
  items: IStoreRequisitionItem[];
  purpose: string;
  requiredDate?: Date;
  status: 'draft' | 'pending' | 'approved' | 'partially_issued' | 'issued' | 'rejected' | 'cancelled';
  approvedBy?: mongoose.Types.ObjectId | any;
  approvedAt?: Date;
  issuedBy?: mongoose.Types.ObjectId | any;
  issuedAt?: Date;
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RequisitionItemSchema = new Schema<IStoreRequisitionItem>({
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
  quantityIssued: {
    type: Number,
    default: 0
  },
  notes: String
});

const StoreRequisitionSchema = new Schema<IStoreRequisition>({
  requisitionNumber: {
    type: String,
    unique: true,
    required: true
  },
  site: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [RequisitionItemSchema],
  purpose: {
    type: String,
    required: [true, 'Purpose is required']
  },
  requiredDate: Date,
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'partially_issued', 'issued', 'rejected', 'cancelled'],
    default: 'draft'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  issuedAt: Date,
  notes: String,
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Generate requisition number before saving
StoreRequisitionSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await (this.constructor as any).countDocuments();
    const year = new Date().getFullYear();
    this.requisitionNumber = `SR-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

export default mongoose.model<IStoreRequisition>('StoreRequisition', StoreRequisitionSchema);
