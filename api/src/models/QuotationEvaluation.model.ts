import mongoose, { Schema, type Document } from 'mongoose';

export interface IScore {
  criterion: string;
  weight: number;
  score: number;
  weightedScore: number;
  comments?: string;
}

export interface IQuotationScore {
  quotation: mongoose.Types.ObjectId | any;
  supplier: mongoose.Types.ObjectId | any;
  scores: IScore[];
  totalScore: number;
  rank?: number;
  recommendation?: string;
}

export interface IEvaluationCriterion {
  criterion?: string;
  weight?: number;
  description?: string;
}

export interface IQuotationEvaluation extends Document {
  rfq: mongoose.Types.ObjectId | any;
  evaluatedBy: mongoose.Types.ObjectId | any;
  evaluationCriteria: IEvaluationCriterion[];
  quotationScores: IQuotationScore[];
  recommendedQuotation?: mongoose.Types.ObjectId | any;
  justification?: string;
  status: 'in_progress' | 'completed' | 'approved';
  approvedBy?: mongoose.Types.ObjectId | any;
  approvedAt?: Date;
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ScoreSchema = new Schema<IScore>({
  criterion: {
    type: String,
    required: true
  },
  weight: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 10
  },
  weightedScore: {
    type: Number,
    required: true
  },
  comments: String
});

const QuotationScoreSchema = new Schema<IQuotationScore>({
  quotation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation',
    required: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupplierProfile',
    required: true
  },
  scores: [ScoreSchema],
  totalScore: {
    type: Number,
    required: true
  },
  rank: Number,
  recommendation: String
});

const QuotationEvaluationSchema = new Schema<IQuotationEvaluation>({
  rfq: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RFQ',
    required: true,
    unique: true
  },
  evaluatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  evaluationCriteria: [{
    criterion: String,
    weight: Number,
    description: String
  }],
  quotationScores: [QuotationScoreSchema],
  recommendedQuotation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation'
  },
  justification: String,
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'approved'],
    default: 'in_progress'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  notes: String,
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

export default mongoose.model<IQuotationEvaluation>('QuotationEvaluation', QuotationEvaluationSchema);
