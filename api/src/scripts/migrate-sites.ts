/**
 * One-time migration: create HQ site and backfill site fields on existing data.
 * Run: npm run migrate:sites -w api
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '../../.env') });

import {
  Site,
  User,
  Inventory,
  StoreRequisition,
  StoreTransaction,
  PurchaseRequisition,
  PurchaseOrder,
  Delivery
} from '../models/index.js';

async function mergeInventoryInto(target: any, source: any): Promise<void> {
  target.quantityOnHand += source.quantityOnHand || 0;
  target.quantityReserved += source.quantityReserved || 0;
  if (!target.unitCost && source.unitCost) target.unitCost = source.unitCost;
  source.isDeleted = true;
  await source.save();
  await target.save();
}

async function migrate(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fossil-procure';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  let hq = await Site.findOne({ code: 'HQ', isDeleted: false });
  if (!hq) {
    hq = await Site.create({
      code: 'HQ',
      name: 'Head Office Stores',
      type: 'hq',
      hasLocalStore: true,
      status: 'active',
      address: {
        city: 'Harare',
        province: 'Harare'
      }
    });
    console.log('Created HQ site');
  } else {
    console.log('HQ site already exists');
  }

  const hqId = hq._id;

  const inventories = await Inventory.find({ isDeleted: false });
  for (const inv of inventories) {
    if (inv.site) continue;

    const existingAtHq = await Inventory.findOne({
      item: inv.item,
      site: hqId,
      isDeleted: false,
      _id: { $ne: inv._id }
    });

    if (existingAtHq) {
      await mergeInventoryInto(existingAtHq, inv);
      console.log(`Merged inventory ${inv._id} into ${existingAtHq._id}`);
    } else {
      inv.site = hqId;
      inv.location = inv.location || 'Main Store';
      await inv.save();
    }
  }

  await StoreRequisition.updateMany(
    { $or: [{ site: null }, { site: { $exists: false } }] },
    { $set: { site: hqId } }
  );

  await PurchaseRequisition.updateMany(
    { $or: [{ site: null }, { site: { $exists: false } }] },
    { $set: { site: hqId } }
  );

  await PurchaseOrder.updateMany(
    { $or: [{ deliverToSite: null }, { deliverToSite: { $exists: false } }] },
    { $set: { deliverToSite: hqId } }
  );

  await Delivery.updateMany(
    { $or: [{ receivedAtSite: null }, { receivedAtSite: { $exists: false } }] },
    { $set: { receivedAtSite: hqId } }
  );

  const transactions = await StoreTransaction.find({
    $or: [{ site: null }, { site: { $exists: false } }]
  });
  for (const tx of transactions) {
    const inv = await Inventory.findById(tx.inventory);
    if (inv?.site) {
      tx.site = inv.site;
      await tx.save();
    } else {
      tx.site = hqId;
      await tx.save();
    }
  }

  await User.updateMany(
    {
      role: { $in: ['stores_officer', 'department_head'] },
      $or: [{ homeSite: null }, { homeSite: { $exists: false } }]
    },
    { $set: { homeSite: hqId } }
  );

  console.log('Migration complete.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
