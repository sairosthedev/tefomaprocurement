import type { NextFunction, Request, Response } from 'express';
import { runWithSbu, type SbuRef } from '../tenancy/sbuContext.js';
import { sbuByCode, sbuByDomain } from '../tenancy/registry.js';
import { logger } from '../lib/logger.js';

/**
 * Bind each request to one SBU, so every model call inside it reads and writes
 * that SBU's database.
 *
 * Resolution is by hostname: the `Origin` the browser sends, falling back to
 * the `Host` the request arrived on for non-browser callers. Phase 2 adds the
 * JWT binding that stops a token issued for one SBU being replayed against
 * another; until then the domain is the only signal.
 */

function strictDomains(): boolean {
  return process.env.SBU_STRICT_DOMAIN === 'true';
}

function defaultSbuCode(): string {
  return process.env.DEFAULT_SBU_CODE?.trim().toUpperCase() || 'FOSSIL';
}

export async function resolveSbuForRequest(req: Request): Promise<SbuRef | null> {
  const fromOrigin = await sbuByDomain(req.headers.origin);
  if (fromOrigin) return fromOrigin;

  const fromHost = await sbuByDomain(req.headers.host);
  if (fromHost) return fromHost;

  // Phase 1: one SBU, no domains configured yet, so an unmatched host is the
  // normal case rather than an error. Phase 2 flips SBU_STRICT_DOMAIN on and
  // an unrecognised host stops being served at all.
  if (strictDomains()) return null;

  return sbuByCode(defaultSbuCode());
}

export function sbuContextMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sbu = await resolveSbuForRequest(req);

      if (!sbu) {
        logger.warn(
          `No SBU for host "${req.headers.origin || req.headers.host || 'unknown'}"`
        );
        res.status(404).json({
          success: false,
          message: 'This address does not belong to a known business unit.'
        });
        return;
      }

      // next() runs inside the store, so the whole downstream chain — including
      // everything it awaits — sees this SBU.
      runWithSbu(sbu, () => {
        next();
      });
    } catch (error) {
      next(error);
    }
  };
}
