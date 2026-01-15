const mongoose = require('mongoose');

const ScoreSchema = new mongoose.Schema({
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

const QuotationScoreSchema = new mongoose.Schema({
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

const QuotationEvaluationSchema = new mongoose.Schema({
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

module.exports = mongoose.model('QuotationEvaluation', QuotationEvaluationSchema);

