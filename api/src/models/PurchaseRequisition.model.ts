import mongoose, { Schema, type Document } from 'mongoose';

export interface IStoreAvailability {
  available: boolean;
  quantityAvailable: number;
  quantityAtSite: number;
  quantityAtOtherSites: number;
  suggestedAction: 'store_issue' | 'stock_transfer' | 'purchase' | null;
  checkedAt?: Date;
  checkedBy?: mongoose.Types.ObjectId | any;
}

/** Machine identification for plant/vehicle spares. Every field optional —
 *  data plates are often painted over or missing on older fleets, so a line
 *  must never be blocked on them. */
export interface IEquipmentDetails {
  make?: string;
  model?: string;
  plantNumber?: string;
  registrationNumber?: string;
  chassisNumber?: string;
  engineNumber?: string;
  serialNumber?: string;
  componentSerial?: string;
  partNumber?: string;
  hourMeter?: string;
}

/** Photo or document attached to a requisition line — typically a data plate
 *  shot so the supplier can read the serial themselves. */
export interface ILineAttachment {
  kind: 'data_plate' | 'item_photo' | 'damage' | 'other';
  fileName: string;
  /** Data URI, consistent with how KYS compliance documents are stored. */
  fileData: string;
  mimeType?: string;
  caption?: string;
  uploadedBy?: mongoose.Types.ObjectId | any;
  uploadedAt?: Date;
}

export interface IRequisitionItem {
  item?: mongoose.Types.ObjectId | any;
  /** PACKAGE column on the paper IR form (e.g. box, carton, unit pack). */
  package?: string;
  description: string;
  category?: string;
  specification?: string;
  specifications?: string;
  quantity: number;
  unit: string;
  estimatedUnitPrice?: number;
  estimatedTotalPrice?: number;
  quantityFulfilledFromStock?: number;
  storeAvailability?: IStoreAvailability;
  equipment?: IEquipmentDetails;
  attachments?: ILineAttachment[];
}

export interface IStatusHistory {
  action: 'submitted' | 'hod_approved' | 'stores_reviewed' | 'fulfilled_from_stock' | 'forwarded_to_procurement' | 'accepted' | 'rejected' | 'returned' | 'rfq_created' | 'po_created' | 'item_removed' | 'cancelled';
  by: mongoose.Types.ObjectId | any;
  role?: string;
  comments?: string;
  timestamp?: Date;
}

export interface IPurchaseRequisition extends Document {
  requisitionNumber: string;
  title: string;
  /** WORK ORDER on the paper IR form — job / project reference. */
  workOrder?: string;
  /** STORES ISSUE NO — assigned when stock is issued from stores. */
  storesIssueNumber?: string;
  site?: mongoose.Types.ObjectId | any;
  department?: mongoose.Types.ObjectId | any;
  requestedBy: mongoose.Types.ObjectId | any;
  items: IRequisitionItem[];
  justification?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requiredDate?: Date;
  estimatedTotal: number;
  status: 'draft' | 'pending_hod' | 'stores_review' | 'fulfilled' | 'pending_acceptance' | 'accepted' | 'rejected' | 'sourcing' | 'quoted' | 'ordered' | 'completed' | 'cancelled';
  hodApprovedBy?: mongoose.Types.ObjectId | any;
  hodApprovedAt?: Date;
  storesReviewedBy?: mongoose.Types.ObjectId | any;
  storesReviewedAt?: Date;
  storesReviewNotes?: string;
  statusHistory: IStatusHistory[];
  processedBy?: mongoose.Types.ObjectId | any;
  rfq?: mongoose.Types.ObjectId | any;
  notes?: string;
  cancelledBy?: mongoose.Types.ObjectId | any;
  cancelledAt?: Date;
  cancellationReason?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EquipmentDetailsSchema = new Schema<IEquipmentDetails>({
  make: { type: String, trim: true },
  model: { type: String, trim: true },
  plantNumber: { type: String, trim: true },
  registrationNumber: { type: String, trim: true },
  chassisNumber: { type: String, trim: true },
  engineNumber: { type: String, trim: true },
  serialNumber: { type: String, trim: true },
  componentSerial: { type: String, trim: true },
  partNumber: { type: String, trim: true },
  hourMeter: { type: String, trim: true }
}, { _id: false });

const LineAttachmentSchema = new Schema<ILineAttachment>({
  kind: {
    type: String,
    enum: ['data_plate', 'item_photo', 'damage', 'other'],
    default: 'data_plate'
  },
  fileName: { type: String, required: true },
  fileData: { type: String, required: true },
  mimeType: String,
  caption: { type: String, trim: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const RequisitionItemSchema = new Schema<IRequisitionItem>({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item'
  },
  package: { type: String, trim: true },
  description: {
    type: String,
    required: true
  },
  category: { type: String, trim: true }, // canonical supplier-category code
  specification: String, // Singular - from frontend
  specifications: String, // Plural - alternate field name
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unit: {
    type: String,
    default: 'Each'
  },
  estimatedUnitPrice: Number,
  estimatedTotalPrice: Number,
  equipment: { type: EquipmentDetailsSchema, default: undefined },
  attachments: { type: [LineAttachmentSchema], default: undefined },
  // How much of this line was issued from existing stock during stores review.
  quantityFulfilledFromStock: { type: Number, default: 0 },
  storeAvailability: {
    available: { type: Boolean, default: false },
    quantityAvailable: { type: Number, default: 0 },
    quantityAtSite: { type: Number, default: 0 },
    quantityAtOtherSites: { type: Number, default: 0 },
    suggestedAction: {
      type: String,
      enum: ['store_issue', 'stock_transfer', 'purchase', null],
      default: null
    },
    checkedAt: Date,
    checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
});

const StatusHistorySchema = new Schema<IStatusHistory>({
  action: {
    type: String,
    enum: ['submitted', 'hod_approved', 'stores_reviewed', 'fulfilled_from_stock', 'forwarded_to_procurement', 'accepted', 'rejected', 'returned', 'rfq_created', 'po_created', 'item_removed', 'cancelled'],
    required: true
  },
  by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: String,
  comments: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const PurchaseRequisitionSchema = new Schema<IPurchaseRequisition>({
  requisitionNumber: {
    type: String,
    unique: true
    // Not required - auto-generated in pre-save
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  workOrder: { type: String, trim: true },
  storesIssueNumber: { type: String, trim: true, unique: true, sparse: true },
  site: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site'
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
    // Optional - some users may not have departments
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [RequisitionItemSchema],
  justification: {
    type: String
    // Optional - description/reason for the request
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  requiredDate: Date,
  estimatedTotal: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'pending_hod', 'stores_review', 'fulfilled', 'pending_acceptance', 'accepted', 'rejected', 'sourcing', 'quoted', 'ordered', 'completed', 'cancelled'],
    default: 'draft'
  },
  statusHistory: [StatusHistorySchema],
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rfq: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RFQ'
  },
  notes: String,
  hodApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  hodApprovedAt: Date,
  storesReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  storesReviewedAt: Date,
  storesReviewNotes: String,
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelledAt: Date,
  cancellationReason: String,
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Generate requisition number before saving (if not already set)
PurchaseRequisitionSchema.pre('save', async function(next) {
  if (this.isNew && !this.requisitionNumber) {
    const count = await (this.constructor as any).countDocuments();
    const year = new Date().getFullYear();
    this.requisitionNumber = `PR-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  // Calculate estimated total
  this.estimatedTotal = this.items.reduce((sum: number, item: any) => {
    return sum + (item.estimatedTotalPrice || 0);
  }, 0);

  next();
});

export default mongoose.model<IPurchaseRequisition>('PurchaseRequisition', PurchaseRequisitionSchema);
