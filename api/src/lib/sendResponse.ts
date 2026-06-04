import type { Response } from 'express';

/**
 * Tiny helpers that enforce a consistent JSON envelope across the API:
 *
 *   { success: true, data, meta? }
 *   { success: false, message, code?, details? }
 */
export function ok(res: Response, data: unknown, meta?: unknown): Response {
  const payload: Record<string, unknown> = { success: true, data };
  if (meta !== undefined) payload.meta = meta;
  return res.status(200).json(payload);
}

export function created(res: Response, data: unknown, meta?: unknown): Response {
  const payload: Record<string, unknown> = { success: true, data };
  if (meta !== undefined) payload.meta = meta;
  return res.status(201).json(payload);
}

export function noContent(res: Response): Response {
  return res.status(204).end();
}

export function fail(
  res: Response,
  statusCode: number,
  message: string,
  extras: Record<string, unknown> = {}
): Response {
  const payload = { success: false, message, ...extras };
  return res.status(statusCode).json(payload);
}
