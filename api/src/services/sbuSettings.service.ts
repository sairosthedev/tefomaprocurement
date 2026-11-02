import Sbu, { type ISbu } from '../models/Sbu.model.js';
import { getSbu } from '../tenancy/sbuContext.js';
import { getCompanyName } from '../lib/branding.js';
import { COO_APPROVAL_THRESHOLD_USD } from '@fossil/shared';

/**
 * Per-SBU settings read from the registry: approval policy and the branding
 * printed on documents. Cached briefly, like the registry lookups in
 * tenancy/registry.ts, because every PO save and every printed page asks.
 */

const CACHE_TTL_MS = parseInt(process.env.SBU_REGISTRY_CACHE_MS || '60000', 10);
const cache = new Map<string, { value: ISbu | null; expiresAt: number }>();

async function loadSbu(code: string): Promise<ISbu | null> {
  const cached = cache.get(code);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = await Sbu.findOne({ code }).lean<ISbu>();
  cache.set(code, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

async function currentSbuDoc(): Promise<ISbu | null> {
  const code = getSbu()?.code;
  if (!code) return null;
  try {
    return await loadSbu(code);
  } catch {
    // The registry being unreachable must not stop a PO from saving; the
    // group defaults below are the same values every SBU starts with.
    return null;
  }
}

export async function getCooThresholdUsd(): Promise<number> {
  const sbu = await currentSbuDoc();
  const value = sbu?.approvalPolicy?.cooThresholdUsd;
  return typeof value === 'number' && value >= 0 ? value : COO_APPROVAL_THRESHOLD_USD;
}

export interface DocumentBranding {
  /** The issuing business, as it should appear at the top of a document. */
  legalName: string;
  address?: string;
  vatNumber?: string;
  logoUrl?: string;
  /** Logo bytes, when logoUrl resolved to an image pdfkit can embed. */
  logo?: Buffer;
}

const logoCache = new Map<string, { value: Buffer | undefined; expiresAt: number }>();

async function fetchLogo(url: string): Promise<Buffer | undefined> {
  const cached = logoCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let value: Buffer | undefined;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = res.headers.get('content-type') || '';
    // pdfkit embeds PNG and JPEG only.
    if (res.ok && /image\/(png|jpe?g)/i.test(type)) {
      value = Buffer.from(await res.arrayBuffer());
    }
  } catch {
    value = undefined;
  }
  logoCache.set(url, { value, expiresAt: Date.now() + 10 * CACHE_TTL_MS });
  return value;
}

/**
 * The issuing SBU's identity for printed and emailed documents. Falls back to
 * the deployment-wide company name only when no SBU is known, so a unit's POs
 * never carry another unit's name.
 */
export async function getDocumentBranding(): Promise<DocumentBranding> {
  const sbu = await currentSbuDoc();
  if (!sbu) return { legalName: getCompanyName() };

  const branding = sbu.branding || {};
  return {
    legalName: branding.legalName || sbu.name,
    address: branding.address || undefined,
    vatNumber: branding.vatNumber || undefined,
    logoUrl: branding.logoUrl || undefined,
    logo: branding.logoUrl ? await fetchLogo(branding.logoUrl) : undefined
  };
}

export function invalidateSbuSettingsCache(): void {
  cache.clear();
  logoCache.clear();
}
