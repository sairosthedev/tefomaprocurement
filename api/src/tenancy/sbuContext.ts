import { AsyncLocalStorage } from 'node:async_hooks';
import { logger } from '../lib/logger.js';
import { databaseFromUri } from './mongoUri.js';

/**
 * The minimum an SBU must supply for the model resolvers to find its data.
 * Deliberately structural rather than the Mongoose document, so the context
 * module stays free of model imports (and of the import cycle that would
 * otherwise form with `models/index.ts`).
 */
export interface SbuRef {
  code: string;
  name?: string;
  /** Database on the shared cluster holding this SBU's transactions. */
  dbName: string;
  /** Env var holding a dedicated cluster URI, for SBUs not on the shared cluster. */
  connectionUriEnv?: string;
}

interface SbuStore {
  sbu: SbuRef;
}

const storage = new AsyncLocalStorage<SbuStore>();

let ambientSbu: SbuRef | null = null;
let legacySbu: SbuRef | null | undefined;
let warnedLegacy = false;

/**
 * Run `fn` — and everything it awaits — against one SBU's database. This is how
 * a request binds itself to a tenant; the model resolvers in `models/index.ts`
 * read the context back out.
 */
export function runWithSbu<T>(sbu: SbuRef, fn: () => T): T {
  return storage.run({ sbu }, fn);
}

/**
 * Bind a whole process to one SBU, for CLI scripts and jobs that have no
 * request to carry context. Prefer `runWithSbu` wherever there is a scope.
 */
export function setAmbientSbu(sbu: SbuRef | null): void {
  ambientSbu = sbu;
}

function strictContext(): boolean {
  return process.env.SBU_STRICT_CONTEXT === 'true';
}

/**
 * The single-tenant behaviour the system had before the registry existed: the
 * database named in MONGODB_URI. Phase 1 scaffolding — it keeps the 22 scripts
 * in `api/src/scripts/` and any un-migrated caller working against Fossil
 * exactly as before, instead of failing the moment the resolvers land.
 *
 * Set SBU_STRICT_CONTEXT=true to turn it off and make missing context an error.
 * Phase 2 should make strict the default once every caller sets context.
 */
function resolveLegacySbu(): SbuRef | null {
  if (legacySbu !== undefined) return legacySbu;

  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    legacySbu = null;
    return legacySbu;
  }

  const dbName = databaseFromUri(uri);

  if (!dbName) {
    legacySbu = null;
    return legacySbu;
  }

  legacySbu = {
    code: process.env.DEFAULT_SBU_CODE?.trim().toUpperCase() || 'FOSSIL',
    dbName
  };
  return legacySbu;
}

/** The SBU for the current request/scope, or null when there is none. */
export function getSbu(): SbuRef | null {
  const fromScope = storage.getStore()?.sbu;
  if (fromScope) return fromScope;
  if (ambientSbu) return ambientSbu;
  if (strictContext()) return null;

  const legacy = resolveLegacySbu();
  if (legacy && !warnedLegacy) {
    warnedLegacy = true;
    logger.warn(
      `No SBU in context; falling back to the database in MONGODB_URI as "${legacy.code}". ` +
        'Set SBU_STRICT_CONTEXT=true to make this an error.'
    );
  }
  return legacy;
}

/**
 * Fail closed: an SBU-scoped model must never quietly reach into whichever
 * database happens to be open. There is deliberately no "all SBUs" query —
 * group views fan out over the registry explicitly.
 */
export function requireSbu(): SbuRef {
  const sbu = getSbu();
  if (!sbu) {
    throw new Error(
      'No SBU in context. An SBU-scoped model was used outside a request. ' +
        'Wrap the call in runWithSbu(sbu, ...), or setAmbientSbu(sbu) in a script.'
    );
  }
  return sbu;
}

/** Test seam: forget the cached legacy fallback and any ambient binding. */
export function resetSbuContextForTests(): void {
  ambientSbu = null;
  legacySbu = undefined;
  warnedLegacy = false;
}
