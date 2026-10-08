import mongoose, { type Document, type Model } from 'mongoose';
import { platformConnection } from '../tenancy/connections.js';
import { resolvingModel } from './modelProxy.js';

/** Countries the group trades in today. Drives which compliance rules apply. */
export const SBU_COUNTRIES = ['ZW', 'ZA', 'SZ'] as const;
export type SbuCountry = (typeof SBU_COUNTRIES)[number];

export const SBU_CURRENCIES = ['USD', 'ZWG', 'ZAR', 'SZL'] as const;
export type SbuCurrency = (typeof SBU_CURRENCIES)[number];

export const SBU_STATUSES = ['active', 'onboarding', 'suspended'] as const;
export type SbuStatus = (typeof SBU_STATUSES)[number];

export interface ISbuBranding {
  legalName?: string;
  logoUrl?: string;
  address?: string;
  vatNumber?: string;
}

export interface ISbu extends Document {
  code: string;
  name: string;
  country: SbuCountry;
  baseCurrency: SbuCurrency;
  status: SbuStatus;
  /** Hostnames that resolve to this SBU. A hostname belongs to exactly one SBU. */
  domains: string[];
  /** Database on the shared cluster holding this SBU's transactions. */
  dbName: string;
  /** Env var holding a dedicated cluster URI, when the SBU is not on the shared cluster. */
  connectionUriEnv?: string;
  branding: ISbuBranding;
  createdAt: Date;
  updatedAt: Date;
}

const SbuSchema = new mongoose.Schema<ISbu>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      // Matches the command centre's SBU codes, so group figures key cleanly.
      match: [/^[A-Z][A-Z0-9_]*$/, 'SBU code must be upper-case letters, digits and underscores']
    },
    name: { type: String, required: true, trim: true },
    country: { type: String, required: true, enum: SBU_COUNTRIES },
    baseCurrency: { type: String, required: true, enum: SBU_CURRENCIES },
    status: { type: String, required: true, enum: SBU_STATUSES, default: 'onboarding' },
    domains: {
      type: [{ type: String, lowercase: true, trim: true }],
      default: []
    },
    dbName: { type: String, required: true, unique: true, trim: true },
    connectionUriEnv: { type: String, trim: true },
    branding: {
      legalName: { type: String, trim: true },
      logoUrl: { type: String, trim: true },
      address: { type: String, trim: true },
      vatNumber: { type: String, trim: true }
    }
  },
  { timestamps: true }
);

// A hostname must identify exactly one SBU, or domain-based resolution would
// be ambiguous. A partial index applies the uniqueness only to SBUs that
// actually have a domain: a plain sparse index treats every empty `domains`
// array as the same undefined key, so the second SBU without a domain would
// collide with the first.
SbuSchema.index(
  { domains: 1 },
  { unique: true, partialFilterExpression: { 'domains.0': { $exists: true } } }
);
SbuSchema.index({ status: 1 });

const BaseSbu = mongoose.model<ISbu>('Sbu', SbuSchema);

/**
 * The registry lives in the platform database, not in any SBU's — it is the
 * one piece of group-wide state in a design where SBUs are otherwise fully
 * separate.
 */
function platformConnectionWithSbu(): ReturnType<typeof platformConnection> {
  const connection = platformConnection();
  if (!connection.models.Sbu) {
    connection.model<ISbu>('Sbu', SbuSchema);
  }
  return connection;
}

const Sbu: Model<ISbu> = resolvingModel(BaseSbu, platformConnectionWithSbu);

export { SbuSchema };
export default Sbu;
