import mongoose, { Schema, type Document } from 'mongoose';

export interface IStoreTransaction extends Document {
  transactionNumber: string;
  type: 'receipt' | 'issue' | 'adjustment' | 'transfer' | 'return';
  item: mongoose.Types.ObjectId | any;
  site: mongoose.Types.ObjectId | any;
  inventory: mongoose.Types.ObjectId | any;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  unitCost?: number;
  totalValue?: number;
  reference?: {
    type?: 'grv' | 'store_requisition' | 'adjustment' | 'transfer' | 'stock_transfer';
    document?: mongoose.Types.ObjectId | any;
  };
  department?: mongoose.Types.ObjectId | any;
  reason?: string;
  performedBy: mongoose.Types.ObjectId | any;
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StoreTransactionSchema = new Schema<IStoreTransaction>({
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
  site: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
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
      enum: ['grv', 'store_requisition', 'adjustment', 'transfer', 'stock_transfer']
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
    const count = await (this.constructor as any).countDocuments();
    const year = new Date().getFullYear();
    const typePrefix = this.type.substring(0, 3).toUpperCase();
    this.transactionNumber = `ST-${typePrefix}-${year}-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

export default mongoose.model<IStoreTransaction>('StoreTransaction', StoreTransactionSchema);
