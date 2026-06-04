import mongoose, { Schema, type Document } from 'mongoose';

export interface IDepartment extends Document {
  name: string;
  code?: string;
  description?: string;
  head?: mongoose.Types.ObjectId | any;
  status: 'active' | 'inactive';
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>({
  name: {
    type: String,
    required: [true, 'Department name is required'],
    unique: true,
    trim: true
  },
  code: {
    type: String,
    uppercase: true,
    trim: true,
    sparse: true // Allow multiple null values while keeping unique constraint for non-null
  },
  description: {
    type: String,
    trim: true
  },
  head: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
}, {
  timestamps: true
});

export default mongoose.model<IDepartment>('Department', DepartmentSchema);
