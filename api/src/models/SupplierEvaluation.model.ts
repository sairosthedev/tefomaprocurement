import mongoose, { Schema, type Document } from 'mongoose';

export interface IEvaluationScores {
  creditTerms?: number;
  contractualAgreements?: number;
  marketReputation?: number;
  pricing?: number;
  deliveryEfficiency?: number;
  easeInDealings?: number;
  consistentQuality?: number;
  otherNotes?: string;
}

export interface ISupplierEvaluation extends Document {
  supplier: mongoose.Types.ObjectId;
  evaluationType: 'initial' | 're_evaluation' | 'quarterly_review';
  scores: IEvaluationScores;
  overallScore: number;
  recommendation: 'approve' | 'reject' | 'conditional' | 're_evaluate_later';
  evaluatedBy: mongoose.Types.ObjectId;
  hodReviewedBy?: mongoose.Types.ObjectId;
  hodReviewedAt?: Date;
  procurementManagerApprovedBy?: mongoose.Types.ObjectId;
  procurementManagerApprovedAt?: Date;
  secApproved: boolean;
  secApprovedBy?: mongoose.Types.ObjectId;
  secApprovedAt?: Date;
  secNotes?: string;
  nextReviewDue?: Date;
  status: 'draft' | 'pending_hod' | 'pending_procurement_manager' | 'pending_sec' | 'approved' | 'rejected';
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EvaluationScoresSchema = new Schema<IEvaluationScores>({
  creditTerms: { type: Number, min: 1, max: 5 },
  contractualAgreements: { type: Number, min: 1, max: 5 },
  marketReputation: { type: Number, min: 1, max: 5 },
  pricing: { type: Number, min: 1, max: 5 },
  deliveryEfficiency: { type: Number, min: 1, max: 5 },
  easeInDealings: { type: Number, min: 1, max: 5 },
  consistentQuality: { type: Number, min: 1, max: 5 },
  otherNotes: String
}, { _id: false });

const SupplierEvaluationSchema = new Schema<ISupplierEvaluation>({
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupplierProfile',
    required: true
  },
  evaluationType: {
    type: String,
    enum: ['initial', 're_evaluation', 'quarterly_review'],
    default: 'initial'
  },
  scores: { type: EvaluationScoresSchema, required: true },
  overallScore: { type: Number, default: 0 },
  recommendation: {
    type: String,
    enum: ['approve', 'reject', 'conditional', 're_evaluate_later'],
    required: true
  },
  evaluatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  hodReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  hodReviewedAt: Date,
  procurementManagerApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  procurementManagerApprovedAt: Date,
  secApproved: { type: Boolean, default: false },
  secApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  secApprovedAt: Date,
  secNotes: String,
  nextReviewDue: Date,
  status: {
    type: String,
    enum: ['draft', 'pending_hod', 'pending_procurement_manager', 'pending_sec', 'approved', 'rejected'],
    default: 'approved'
  },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

SupplierEvaluationSchema.pre('save', function (next) {
  const scoreKeys = [
    'creditTerms', 'contractualAgreements', 'marketReputation', 'pricing',
    'deliveryEfficiency', 'easeInDealings', 'consistentQuality'
  ] as const;
  const values = scoreKeys
    .map((k) => this.scores[k])
    .filter((v): v is number => typeof v === 'number');
  this.overallScore = values.length
    ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
    : 0;

  if (this.isNew && !this.nextReviewDue) {
    const due = new Date();
    due.setMonth(due.getMonth() + 3); // quarterly review
    this.nextReviewDue = due;
  }
  next();
});

export default mongoose.model<ISupplierEvaluation>('SupplierEvaluation', SupplierEvaluationSchema);
