import mongoose, { Schema, type Document } from 'mongoose';

export interface IOtpChallenge extends Document {
  email: string;
  user: mongoose.Types.ObjectId;
  codeHash: string;
  purpose: 'login';
  attempts: number;
  used: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OtpChallengeSchema = new Schema<IOtpChallenge>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    codeHash: { type: String, required: true },
    purpose: { type: String, enum: ['login'], default: 'login' },
    attempts: { type: Number, default: 0 },
    used: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

OtpChallengeSchema.index({ email: 1, purpose: 1, used: 1, expiresAt: -1 });

export default mongoose.model<IOtpChallenge>('OtpChallenge', OtpChallengeSchema);
