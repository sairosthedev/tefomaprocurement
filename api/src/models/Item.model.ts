import mongoose, { Schema, type Document } from 'mongoose';

export interface IItem extends Document {
  code: string;
  name: string;
  description?: string;
  category: string;
  unit: 'each' | 'kg' | 'litre' | 'meter' | 'box' | 'pack' | 'set' | 'roll' | 'sheet' | 'pair';
  reorderLevel: number;
  specifications?: Map<string, string>;
  status: 'active' | 'discontinued';
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ItemSchema = new Schema<IItem>({
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
    // Construction units were missing, so a contractor's catalogue could not
    // hold cement by the bag or aggregate by the cubic metre — the shared
    // UNITS_OF_MEASUREMENT list already offered both, and saving one failed
    // validation here. Added rather than replaced: every existing value stays
    // valid. (The shared list is title-case and this one lower-case; they
    // should be reconciled, but not by invalidating stored data.)
    enum: [
      'each', 'kg', 'litre', 'meter', 'box', 'pack', 'set', 'roll', 'sheet', 'pair',
      'bag', 'cubic metre', 'square metre', 'tonne', 'drum', 'carton'
    ],
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

export default mongoose.model<IItem>('Item', ItemSchema);
