'use strict';

/**
 * Tiny helpers that enforce a consistent JSON envelope across the API:
 *
 *   { success: true, data, meta? }
 *   { success: false, message, code?, details? }
 */
function ok(res, data, meta) {
  const payload = { success: true, data };
  if (meta !== undefined) payload.meta = meta;
  return res.status(200).json(payload);
}

function created(res, data, meta) {
  const payload = { success: true, data };
  if (meta !== undefined) payload.meta = meta;
  return res.status(201).json(payload);
}

function noContent(res) {
  return res.status(204).end();
}

function fail(res, statusCode, message, extras = {}) {
  const payload = { success: false, message, ...extras };
  return res.status(statusCode).json(payload);
}

module.exports = { ok, created, noContent, fail };
