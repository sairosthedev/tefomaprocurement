import type { Document } from 'mongoose';
import type { ICounter } from '../models/Counter.model.js';
import { getSbu } from '../tenancy/sbuContext.js';

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
 * The issuing SBU's code, leading every document number. Each SBU numbers in
 * its own database, so without it two units issue the same `PO-2026-00001`
 * and one supplier can hold two different orders under one number.
 */
export function sbuNumberPrefix(): string {
  const code = getSbu()?.code;
  return code ? `${code}-` : '';
}

/**
 * Reserve the next number and render it in this system's house format,
 * `<SBU>-<PREFIX>-<year>-<zero-padded sequence>`, e.g. `KHAYAH_CEMENT-PO-2026-00001`.
 *
 * The counter key is unchanged by the SBU prefix, so sequences carry on from
 * the numbers issued before it was added.
 */
export async function nextNumber(
  doc: Document,
  options: { type: string; prefix: string; pad?: number; year?: number }
): Promise<string> {
  const year = options.year ?? new Date().getFullYear();
  const seq = await nextSequence(doc, options.type, year);
  return `${sbuNumberPrefix()}${options.prefix}-${year}-${String(seq).padStart(options.pad ?? 5, '0')}`;
}
