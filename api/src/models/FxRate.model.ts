import mongoose, { type Document, type Model } from 'mongoose';
import { platformConnection } from '../tenancy/connections.js';
import { resolvingModel } from './modelProxy.js';
import { SBU_CURRENCIES } from './Sbu.model.js';

/**
 * One exchange rate against USD, effective from a date. Rates are never
 * edited in place: a new row is added, so a PO assessed last month can still
 * be explained by the rate that applied then.
 *
 * Like the SBU registry this lives in the platform database — the group sets
 * one rate for everyone, and every SBU's approval checks read the same figure.
 */
export interface IFxRate extends Document {
  currency: string;
  /** How many units of `currency` buy one US dollar, e.g. 18.5 for ZAR. */
  unitsPerUsd: number;
  effectiveFrom: Date;
  source?: string;
  setBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FxRateSchema = new mongoose.Schema<IFxRate>(
  {
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      enum: SBU_CURRENCIES.filter((c) => c !== 'USD')
    },
    unitsPerUsd: { type: Number, required: true, min: [0.000001, 'Rate must be positive'] },
    effectiveFrom: { type: Date, required: true, default: Date.now },
    source: { type: String, trim: true },
    setBy: { type: String, trim: true }
  },
  { timestamps: true }
);

FxRateSchema.index({ currency: 1, effectiveFrom: -1 });

const BaseFxRate = mongoose.model<IFxRate>('FxRate', FxRateSchema);

function platformConnectionWithFxRate(): ReturnType<typeof platformConnection> {
  const connection = platformConnection();
  if (!connection.models.FxRate) {
    connection.model<IFxRate>('FxRate', FxRateSchema);
  }
  return connection;
}

const FxRate: Model<IFxRate> = resolvingModel(BaseFxRate, platformConnectionWithFxRate);

export { FxRateSchema };
export default FxRate;
