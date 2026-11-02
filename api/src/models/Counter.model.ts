import mongoose from 'mongoose';

/**
 * Atomic document numbering.
 *
 * Numbers used to be generated as `countDocuments() + 1` inside a `pre('save')`
 * hook, which issues the same number twice whenever two documents are saved
 * concurrently — two users raising a requisition at the same moment would both
 * read the same count. `findOneAndUpdate` with `$inc` is a single atomic
 * operation on the server, so each caller gets a distinct sequence value.
 *
 * One counter document per type and year, in the SBU's own database, so each
 * SBU numbers independently.
 */
export interface ICounter {
  /** `<type>:<year>`, e.g. `purchaseOrder:2026`. */
  _id: string;
  seq: number;
}

const CounterSchema = new mongoose.Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 }
  },
  { versionKey: false, _id: false }
);

export default mongoose.model<ICounter>('Counter', CounterSchema);
