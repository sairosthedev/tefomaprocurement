import mongoose, { Schema, type Document } from 'mongoose';
import { nextNumber } from '../services/numbering.service.js';

/** Allowed reasons for waiving the minimum-quotation competitive requirement. */
export const QUOTATION_WAIVER_TYPES = [
  'service_agreement', 'single_source', 'approved_contract', 'no_quotes',
  'unique_product', 'coo_directed', 'custom_manufacture', 'coo_instruction', 'other'
] as const;

/** Machine identification carried over from the requisition line so suppliers
 *  can look the part up against the exact machine. */
export interface IRFQEquipmentDetails {
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

/** Data-plate / item photos shown to invited suppliers. */
export interface IRFQLineAttachment {
  kind: 'data_plate' | 'item_photo' | 'damage' | 'other';
  fileName: string;
  fileData: string;
  mimeType?: string;
  caption?: string;
}
export type QuotationWaiverType = (typeof QUOTATION_WAIVER_TYPES)[number];

export interface IRFQItem {
  /** Stable per-line identity (Mongoose subdocument _id). Quotation lines and
   *  the award map reference this so lines can be awarded independently. */
  _id?: mongoose.Types.ObjectId | any;
  description: string;
  categoryName?: string;
  specifications?: string;
  quantity: number;
  unit: string;
  equipment?: IRFQEquipmentDetails;
  attachments?: IRFQLineAttachment[];
}

export interface IInvitedSupplier {
  supplier: mongoose.Types.ObjectId | any;
  invitedAt: Date;
  viewedAt?: Date;
  responded: boolean;
  respondedAt?: Date;
  quotation?: mongoose.Types.ObjectId | any;
}

export interface IQuotationWaiver {
  waived: boolean;
  reason: string;
  waiverType?:
    | 'service_agreement'
    | 'single_source'
    | 'approved_contract'
    | 'no_quotes'
    | 'unique_product'
    | 'coo_directed'
    | 'custom_manufacture'
    | 'coo_instruction'
    | 'other';
  approvedBy?: mongoose.Types.ObjectId | any;
  approvedAt?: Date;
}

export interface IHodQuotationSelection {
  quotation: mongoose.Types.ObjectId | any;
  justification: string;
  approvedBy: mongoose.Types.ObjectId | any;
  approvedAt?: Date;
}

export interface IPmQuotationAuthorization {
  quotation: mongoose.Types.ObjectId | any;
  authorizedBy: mongoose.Types.ObjectId | any;
  authorizedAt?: Date;
}

/**
 * Per-line award record. Enables splitting a single RFQ across suppliers: each
 * RFQ line can be awarded to a different supplier's quotation, tracked and
 * authorized independently (HOD selection + PM authorization + waiver per line).
 */
export interface ILineAward {
  rfqLineId: mongoose.Types.ObjectId | any;
  description?: string;
  quantity?: number;
  status: 'pending' | 'awarded' | 'unquoted' | 'unawarded';
  awardedQuotation?: mongoose.Types.ObjectId | any;
  awardedSupplier?: mongoose.Types.ObjectId | any;
  awardedUnitPrice?: number;
  hodSelection?: { by?: mongoose.Types.ObjectId | any; justification?: string; at?: Date };
  pmAuthorization?: { by?: mongoose.Types.ObjectId | any; at?: Date };
  waiver?: {
    waived: boolean;
    reason?: string;
    waiverType?: string;
    approvedBy?: mongoose.Types.ObjectId | any;
    approvedAt?: Date;
  };
  poGenerated?: boolean;
  purchaseOrder?: mongoose.Types.ObjectId | any;
}

export interface IRFQ extends Document {
  rfqNumber: string;
  title: string;
  description?: string;
  site?: mongoose.Types.ObjectId | any;
  purchaseRequisition?: mongoose.Types.ObjectId | any;
  items: IRFQItem[];
  invitedSuppliers: IInvitedSupplier[];
  createdBy: mongoose.Types.ObjectId | any;
  submissionDeadline: Date;
  deliveryRequirements?: string;
  paymentTerms?: string;
  termsAndConditions?: string;
  status: 'draft' | 'open' | 'closed' | 'evaluating' | 'awarded' | 'cancelled';
  publishedAt?: Date;
  closedAt?: Date;
  selectedQuotation?: mongoose.Types.ObjectId | any;
  quotationWaiver?: IQuotationWaiver;
  hodSelection?: IHodQuotationSelection;
  pmAuthorization?: IPmQuotationAuthorization;
  /** Per-line award map for split (multi-supplier) awarding. Empty for the
   *  legacy whole-quotation path. */
  lineAwards: ILineAward[];
  /** True when the RFQ is being awarded line-by-line rather than as one quote. */
  splitAward: boolean;
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RFQItemSchema = new Schema<IRFQItem>({
  description: {
    type: String,
    required: true
  },
  categoryName: { type: String, trim: true }, // canonical supplier-category code
  specifications: String,
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unit: {
    type: String,
    required: true
  },
  equipment: {
    type: new Schema<IRFQEquipmentDetails>({
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
    }, { _id: false }),
    default: undefined
  },
  attachments: {
    type: [new Schema<IRFQLineAttachment>({
      kind: {
        type: String,
        enum: ['data_plate', 'item_photo', 'damage', 'other'],
        default: 'data_plate'
      },
      fileName: { type: String, required: true },
      fileData: { type: String, required: true },
      mimeType: String,
      caption: { type: String, trim: true }
    }, { _id: false })],
    default: undefined
  }
});

const InvitedSupplierSchema = new Schema<IInvitedSupplier>({
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupplierProfile',
    required: true
  },
  invitedAt: {
    type: Date,
    default: Date.now
  },
  viewedAt: Date,
  responded: {
    type: Boolean,
    default: false
  },
  respondedAt: Date,
  quotation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation'
  }
});

const RFQSchema = new Schema<IRFQ>({
  rfqNumber: {
    type: String,
    unique: true,
    required: true
  },
  title: {
    type: String,
    required: [true, 'RFQ title is required'],
    trim: true
  },
  description: String,
  site: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site'
  },
  purchaseRequisition: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseRequisition'
  },
  items: [RFQItemSchema],
  invitedSuppliers: [InvitedSupplierSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  submissionDeadline: {
    type: Date,
    required: [true, 'Submission deadline is required']
  },
  deliveryRequirements: String,
  paymentTerms: String,
  termsAndConditions: String,
  status: {
    type: String,
    enum: ['draft', 'open', 'closed', 'evaluating', 'awarded', 'cancelled'],
    default: 'draft'
  },
  publishedAt: Date,
  closedAt: Date,
  selectedQuotation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation'
  },
  quotationWaiver: {
    waived: { type: Boolean, default: false },
    reason: String,
    waiverType: {
      type: String,
      enum: QUOTATION_WAIVER_TYPES
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date
  },
  hodSelection: {
    quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
    justification: String,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date
  },
  pmAuthorization: {
    quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
    authorizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    authorizedAt: Date
  },
  splitAward: {
    type: Boolean,
    default: false
  },
  lineAwards: [
    {
      rfqLineId: { type: mongoose.Schema.Types.ObjectId, required: true },
      description: String,
      quantity: Number,
      status: {
        type: String,
        enum: ['pending', 'awarded', 'unquoted', 'unawarded'],
        default: 'pending'
      },
      awardedQuotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
      awardedSupplier: { type: mongoose.Schema.Types.ObjectId, ref: 'SupplierProfile' },
      awardedUnitPrice: Number,
      hodSelection: {
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        justification: String,
        at: Date
      },
      pmAuthorization: {
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: Date
      },
      waiver: {
        waived: { type: Boolean, default: false },
        reason: String,
        waiverType: String,
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approvedAt: Date
      },
      poGenerated: { type: Boolean, default: false },
      purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' }
    }
  ],
  notes: String,
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Numbering runs on `pre('validate')`, not `pre('save')`: Mongoose validates
// before user save hooks, so a required number field assigned in `pre('save')`
// fails validation and the hook never runs at all.
RFQSchema.pre('validate', async function () {
  if (this.isNew && !this.rfqNumber) {
    this.rfqNumber = await nextNumber(this, { type: 'rfq', prefix: 'RFQ' });
  }
});

export default mongoose.model<IRFQ>('RFQ', RFQSchema);
