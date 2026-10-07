import type { Document } from 'mongoose';
import type { ICounter } from '../models/Counter.model.js';

/**
 * Reserve the next number in a sequence.
 *
 * The counter is read off `doc.db` — the connection the document is being
 * saved on — so it always lands in the same SBU database as the document, with
 * no dependency on the request context being set.
 */
export async function nextSequence(doc: Document, type: string, year: number): Promise<number> {
  const Counter = doc.db.model<ICounter>('Counter');

  const counter = await Counter.findOneAndUpdate(
    { _id: counterKey(type, year) },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean<{ seq: number }>();

  // `new: true` guarantees a document; the non-null assertion documents that.
  return counter!.seq;
}

export function counterKey(type: string, year: number): string {
  return `${type}:${year}`;
}

/**
 * Reserve the next number and render it in this system's house format,
 * `<PREFIX>-<year>-<zero-padded sequence>`.
 */
export async function nextNumber(
  doc: Document,
  options: { type: string; prefix: string; pad?: number; year?: number }
): Promise<string> {
  const year = options.year ?? new Date().getFullYear();
  const seq = await nextSequence(doc, options.type, year);
  return `${options.prefix}-${year}-${String(seq).padStart(options.pad ?? 5, '0')}`;
}
