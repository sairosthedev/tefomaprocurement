'use strict';

const { Site } = require('../models');

const GLOBAL_SITE_ROLES = Object.freeze([
  'admin',
  'procurement_officer',
  'finance',
  'coo'
]);

function canAccessAllSites(user) {
  return user && GLOBAL_SITE_ROLES.includes(user.role);
}

function userSiteId(user) {
  return user?.homeSite?._id?.toString?.() || user?.homeSite?.toString?.() || null;
}

/**
 * Build a Mongo filter fragment for site-scoped queries.
 * @param {object} user - req.user
 * @param {string} [querySiteId] - optional ?site= from query/body
 */
function buildSiteFilter(user, querySiteId) {
  if (canAccessAllSites(user)) {
    return querySiteId ? { site: querySiteId } : {};
  }

  const home = userSiteId(user);
  if (!home) {
    return { site: { $exists: false } };
  }

  if (querySiteId && querySiteId !== home) {
    const err = new Error('Not authorized to access this site');
    err.statusCode = 403;
    throw err;
  }

  return { site: home };
}

async function getDefaultHqSite() {
  return Site.findOne({ type: 'hq', status: 'active', isDeleted: false });
}

/**
 * Resolve which site applies to the current action.
 */
async function resolveSiteId(user, explicitSiteId) {
  if (explicitSiteId) {
    if (!canAccessAllSites(user)) {
      const home = userSiteId(user);
      if (home && explicitSiteId.toString() !== home) {
        const err = new Error('Not authorized for this site');
        err.statusCode = 403;
        throw err;
      }
    }
    const site = await Site.findOne({ _id: explicitSiteId, isDeleted: false, status: 'active' });
    if (!site) {
      const err = new Error('Site not found or inactive');
      err.statusCode = 404;
      throw err;
    }
    return site._id;
  }

  const home = userSiteId(user);
  if (home) return home;

  const hq = await getDefaultHqSite();
  if (!hq) {
    const err = new Error('No site configured. Run npm run migrate:sites or create HQ in admin.');
    err.statusCode = 400;
    throw err;
  }
  return hq._id;
}

async function findOrCreateInventory(itemId, siteId) {
  const { Inventory } = require('../models');

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

module.exports = {
  GLOBAL_SITE_ROLES,
  canAccessAllSites,
  userSiteId,
  buildSiteFilter,
  getDefaultHqSite,
  resolveSiteId,
  findOrCreateInventory
};
