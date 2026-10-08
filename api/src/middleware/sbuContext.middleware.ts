import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { runWithSbu, type SbuRef } from '../tenancy/sbuContext.js';
import { sbuByCode, sbuByDomain } from '../tenancy/registry.js';
import { getJwtSecret } from '../config/secrets.js';
import { logger } from '../lib/logger.js';

/**
 * Bind each request to one SBU, so every model call inside it reads and writes
 * that SBU's database.
 *
 * Resolution, in order:
 *
 *   1. the hostname (Origin, then Host) matched against the registry
 *   2. an explicit `X-Sbu-Code` header
 *   3. the `sbu` claim on the bearer token
 *   4. the default SBU
 *
 * The hostname wins because it is the one signal a browser cannot be talked
 * into forging across origins. The header exists because the SBUs are going
 * live before their domains are registered: it lets a single deployment serve
 * every SBU today, with the client sending the code the user signed in under.
 * Once each SBU has its own domain, rule 1 takes over by itself and
 * SBU_STRICT_DOMAIN=true turns the rest off.
 */

export const SBU_HEADER = 'x-sbu-code';

function strictDomains(): boolean {
  return process.env.SBU_STRICT_DOMAIN === 'true';
}

function defaultSbuCode(): string {
  return process.env.DEFAULT_SBU_CODE?.trim().toUpperCase() || 'FOSSIL';
}

/** The SBU a bearer token was issued for, or null if there is no valid token. */
export function sbuCodeFromToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;

  try {
    const decoded = jwt.verify(header.slice(7), getJwtSecret()) as { sbu?: string };
    return decoded.sbu?.trim().toUpperCase() || null;
  } catch {
    // An invalid or expired token is not this middleware's problem; `protect`
    // will reject it with the right message.
    return null;
  }
}

export async function resolveSbuForRequest(req: Request): Promise<SbuRef | null> {
  const fromOrigin = await sbuByDomain(req.headers.origin);
  if (fromOrigin) return fromOrigin;

  const fromHost = await sbuByDomain(req.headers.host);
  if (fromHost) return fromHost;

  // Once every SBU has a domain, nothing below this line should be reachable.
  if (strictDomains()) return null;

  const headerCode = req.headers[SBU_HEADER];
  if (typeof headerCode === 'string' && headerCode.trim()) {
    const fromHeader = await sbuByCode(headerCode);
    if (fromHeader) return fromHeader;
    // An explicit code that does not resolve is an error, not a cue to fall
    // through to the default — silently serving Fossil's data to someone who
    // asked for Khayah's is the worst outcome available.
    return null;
  }

  const tokenCode = sbuCodeFromToken(req);
  if (tokenCode) {
    const fromToken = await sbuByCode(tokenCode);
    if (fromToken) return fromToken;
    return null;
  }

  return sbuByCode(defaultSbuCode());
}

export function sbuContextMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sbu = await resolveSbuForRequest(req);

      if (!sbu) {
        const asked =
          (typeof req.headers[SBU_HEADER] === 'string' ? req.headers[SBU_HEADER] : null) ||
          req.headers.origin ||
          req.headers.host ||
          'unknown';
        logger.warn(`No SBU resolved for "${asked}"`);
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
