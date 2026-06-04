import mongoose, { Schema, type Document } from 'mongoose';

export interface ISite extends Document {
  code: string;
  name: string;
  type: 'hq' | 'site';
  parentSite?: mongoose.Types.ObjectId | any;
  address?: {
    street?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  };
  manager?: mongoose.Types.ObjectId | any;
  hasLocalStore: boolean;
  status: 'active' | 'inactive';
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SiteSchema = new Schema<ISite>(
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

export default mongoose.model<ISite>('Site', SiteSchema);
