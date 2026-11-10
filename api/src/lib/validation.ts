import type { Response } from 'express';
import { firstError, hasErrors, type FieldErrors } from '@fossil/shared';

import { ApiError } from './ApiError.js';

/**
 * Refuses a request that fails its form's shared validator (see
 * packages/shared/src/validation). The answer is a 400 whose `message` is the
 * first problem, for screens that show one line, and whose `errors` names
 * every field, for forms that mark each one:
 *
 *   { success: false, message: 'Enter the site name', errors: { name: 'Enter the site name' } }
 *
 * Returns true when it refused, so a controller can stop:
 *
 *   if (refuseInvalid(res, validateSite(req.body))) return;
 */
export function refuseInvalid(res: Response, errors: FieldErrors): boolean {
  if (!hasErrors(errors)) return false;
  res.status(400).json({ success: false, message: firstError(errors), errors });
  return true;
}

/** The same refusal for code that throws to the error handler; the fields go out as `details`. */
export function validationError(errors: FieldErrors): ApiError {
  return ApiError.badRequest(firstError(errors) || 'Check the highlighted fields', {
    code: 'VALIDATION_FAILED',
    details: errors
  });
}
