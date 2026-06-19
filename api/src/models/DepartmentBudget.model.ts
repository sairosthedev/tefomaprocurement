import mongoose, { Schema, type Document } from 'mongoose';

export interface IDepartmentBudget extends Document {
  department: mongoose.Types.ObjectId;
  fiscalYear: number;
  allocatedAmount: number;
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentBudgetSchema = new Schema<IDepartmentBudget>({
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  fiscalYear: {
    type: Number,
    required: true
  },
  allocatedAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  notes: {
    type: String,
    trim: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

DepartmentBudgetSchema.index({ department: 1, fiscalYear: 1 }, { unique: true });

export default mongoose.model<IDepartmentBudget>('DepartmentBudget', DepartmentBudgetSchema);
