import { Site, Inventory } from '../models/index.js';

export const GLOBAL_SITE_ROLES: readonly string[] = Object.freeze([
  'admin',
  'procurement_officer',
  'finance',
  'coo'
]);

export function canAccessAllSites(user: any): boolean {
  return Boolean(user) && GLOBAL_SITE_ROLES.includes(user.role);
}

export function userSiteId(user: any): string | null {
  return (
    user?.homeSite?._id?.toString?.() || user?.homeSite?.toString?.() || null
  );
}

interface HttpError extends Error {
  statusCode?: number;
}

function httpError(message: string, statusCode: number): HttpError {
  const err: HttpError = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Build a Mongo filter fragment for site-scoped queries (sync).
 * Prefer {@link buildSiteFilterAsync} when the user may have no homeSite assigned.
 */
export function buildSiteFilter(
  user: any,
  querySiteId?: string
): Record<string, unknown> {
  if (canAccessAllSites(user)) {
    return querySiteId ? { site: querySiteId } : {};
  }

  const home = userSiteId(user);
  if (!home) {
    throw httpError(
      'Site context required. Assign homeSite or use async site filter.',
      400
    );
  }

  if (querySiteId && querySiteId !== home) {
    throw httpError('Not authorized to access this site', 403);
  }

  return { site: home };
}

/**
 * Build a site filter using the same resolution rules as writes (import, receive, etc.).
 * Falls back to HQ when the user has no homeSite.
 */
export async function buildSiteFilterAsync(
  user: any,
  querySiteId?: string
): Promise<Record<string, unknown>> {
  if (canAccessAllSites(user)) {
    return querySiteId ? { site: querySiteId } : {};
  }

  const siteId = await resolveSiteId(user, querySiteId);
  return { site: siteId };
}

export async function getDefaultHqSite(): Promise<any> {
  return Site.findOne({ type: 'hq', status: 'active', isDeleted: false });
}

/**
 * Resolve which site applies to the current action.
 */
export async function resolveSiteId(user: any, explicitSiteId?: any): Promise<any> {
  if (explicitSiteId) {
    if (!canAccessAllSites(user)) {
      const home = userSiteId(user);
      if (home && explicitSiteId.toString() !== home) {
        throw httpError('Not authorized for this site', 403);
      }
    }
    const site = await Site.findOne({
      _id: explicitSiteId,
      isDeleted: false,
      status: 'active'
    });
    if (!site) {
      throw httpError('Site not found or inactive', 404);
    }
    return site._id;
  }

  const home = userSiteId(user);
  if (home) return home;

  const hq = await getDefaultHqSite();
  if (!hq) {
    throw httpError(
      'No site configured. Run npm run migrate:sites or create HQ in admin.',
      400
    );
  }
  return hq._id;
}

export async function findOrCreateInventory(itemId: any, siteId: any): Promise<any> {
  let inventory = await Inventory.findOne({
    item: itemId,
    site: siteId,
    isDeleted: false
  });

  if (!inventory) {
    inventory = await Inventory.create({
      item: itemId,
      site: siteId,
      quantityOnHand: 0,
      quantityReserved: 0,
      unitCost: 0
    });
  }

  return inventory;
}
