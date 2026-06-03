'use strict';

const { Inventory } = require('../models');

/**
 * Check stock for an item across sites.
 * @returns {{ atSite, elsewhere, total, suggestedAction }}
 */
async function checkItemAvailability(itemId, siteId) {
  const rows = await Inventory.find({
    item: itemId,
    isDeleted: false,
    quantityOnHand: { $gt: 0 }
  }).select('site quantityOnHand quantityReserved');

  let atSite = 0;
  let elsewhere = 0;

  for (const row of rows) {
    const available = row.quantityOnHand - (row.quantityReserved || 0);
    if (row.site.toString() === siteId.toString()) {
      atSite += available;
    } else {
      elsewhere += available;
    }
  }

  const total = atSite + elsewhere;

  return { atSite, elsewhere, total };
}

/**
 * Given quantity needed, suggest store issue, transfer, or purchase.
 */
function suggestAction(neededQty, { atSite, elsewhere }) {
  if (atSite >= neededQty) {
    return { suggestedAction: 'store_issue', quantityAtSite: atSite, quantityAtOtherSites: elsewhere };
  }
  if (atSite + elsewhere >= neededQty) {
    return {
      suggestedAction: 'stock_transfer',
      quantityAtSite: atSite,
      quantityAtOtherSites: elsewhere
    };
  }
  return {
    suggestedAction: 'purchase',
    quantityAtSite: atSite,
    quantityAtOtherSites: elsewhere
  };
}

async function enrichRequisitionItemsWithAvailability(items, siteId) {
  const enriched = [];

  for (const line of items) {
    if (!line.item) {
      enriched.push(line);
      continue;
    }

    const { atSite, elsewhere, total } = await checkItemAvailability(line.item, siteId);
    const needed = line.quantity || 1;
    const suggestion = suggestAction(needed, { atSite, elsewhere });

    enriched.push({
      ...line.toObject?.() || line,
      storeAvailability: {
        available: total >= needed,
        quantityAvailable: total,
        quantityAtSite: suggestion.quantityAtSite,
        quantityAtOtherSites: suggestion.quantityAtOtherSites,
        suggestedAction: suggestion.suggestedAction,
        checkedAt: new Date()
      }
    });
  }

  return enriched;
}

module.exports = {
  checkItemAvailability,
  suggestAction,
  enrichRequisitionItemsWithAvailability
};
