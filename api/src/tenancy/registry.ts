import Sbu, { type ISbu } from '../models/Sbu.model.js';
import type { SbuRef } from './sbuContext.js';

/**
 * Reads of the registry are cached briefly: every request resolves an SBU, and
 * without a cache that is one extra round trip to the platform database per
 * request. The TTL is short so an SBU suspended in the admin screens stops
 * serving within the minute.
 */
const CACHE_TTL_MS = parseInt(process.env.SBU_REGISTRY_CACHE_MS || '60000', 10);

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

let allSbus: CacheEntry<SbuRef[]> | null = null;

/** Strip the port and lower-case, so `Fossil.example.com:3001` matches `fossil.example.com`. */
export function normaliseHost(host: string | undefined): string {
  if (!host) return '';
  return host.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
}

async function loadSbus(): Promise<SbuRef[]> {
  const now = Date.now();
  if (allSbus && allSbus.expiresAt > now) return allSbus.value;

  const docs = await Sbu.find({ status: { $ne: 'suspended' } }).lean<ISbu[]>();
  const value: SbuRef[] = docs.map((doc) => ({
    code: doc.code,
    name: doc.name,
    dbName: doc.dbName,
    connectionUriEnv: doc.connectionUriEnv || undefined
  }));
  allSbus = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
}

/** Keep the domain list alongside the ref, only for resolution. */
const domainIndex = new Map<string, string>();
let domainIndexExpiresAt = 0;

async function loadDomainIndex(): Promise<Map<string, string>> {
  const now = Date.now();
  if (domainIndexExpiresAt > now) return domainIndex;

  const docs = await Sbu.find({ status: { $ne: 'suspended' } })
    .select('code domains')
    .lean<Array<Pick<ISbu, 'code' | 'domains'>>>();

  domainIndex.clear();
  for (const doc of docs) {
    for (const domain of doc.domains || []) {
      domainIndex.set(normaliseHost(domain), doc.code);
    }
  }
  domainIndexExpiresAt = now + CACHE_TTL_MS;
  return domainIndex;
}

export async function sbuByCode(code: string): Promise<SbuRef | null> {
  const wanted = code.trim().toUpperCase();
  const sbus = await loadSbus();
  return sbus.find((sbu) => sbu.code === wanted) || null;
}

export async function sbuByDomain(host: string | undefined): Promise<SbuRef | null> {
  const normalised = normaliseHost(host);
  if (!normalised) return null;

  const index = await loadDomainIndex();
  const code = index.get(normalised);
  return code ? sbuByCode(code) : null;
}

/** Every SBU a job or group view should iterate. Suspended SBUs are excluded. */
export async function activeSbus(): Promise<SbuRef[]> {
  return loadSbus();
}

export function invalidateSbuCache(): void {
  allSbus = null;
  domainIndex.clear();
  domainIndexExpiresAt = 0;
}
