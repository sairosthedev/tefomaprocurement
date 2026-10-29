/**
 * Give every existing money document a currency.
 *
 * PurchaseOrder, Invoice, Payment, PurchaseRequisition and DepartmentBudget had
 * no currency field; their amounts were entered in the SBU's own money. This
 * stamps each document missing one with its SBU's base currency.
 *
 *   npm run backfill:currency -- --dry-run
 *   npm run backfill:currency
 *   npm run backfill:currency -- --only MANGETHE,ENVIRO_PLASTIC
 *
 * Quotations already had a currency, but the supplier form defaulted it to USD,
 * so in a non-USD SBU a "USD" quote may well be rand. They are reported, not
 * changed, unless --quotes-usd-to-base is given after checking them.
 *
 * Open POs (submitted, not yet approved) are re-assessed against the FX rate
 * and the SBU's COO limit and listed where the outcome would change. Their
 * approval route is never altered here — moving a PO out of the COO's queue
 * is a decision for a person, not a migration.
 */
import mongoose from 'mongoose';
import { loadEnvFiles } from '../config/loadEnv.js';

loadEnvFiles();

import { activeSbus } from '../tenancy/registry.js';
import { connectionForSbu } from '../tenancy/connections.js';
import { runWithSbu, type SbuRef } from '../tenancy/sbuContext.js';
import { assessCooRequirement } from '../services/poApprovalFlow.service.js';

const MONEY_MODELS = ['PurchaseOrder', 'Invoice', 'Payment', 'PurchaseRequisition', 'DepartmentBudget'];
const OPEN_PO_STATUSES = ['pending_hod', 'pending_dept_hod', 'pending_proc_hod', 'pending_finance', 'pending_coo', 'pending_approvals'];

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : null;
}

async function backfillSbu(sbu: SbuRef, dryRun: boolean, quotesToBase: boolean): Promise<void> {
  const base = sbu.baseCurrency || 'USD';
  const connection = connectionForSbu(sbu);
  console.log(`\n${sbu.code}  (${sbu.dbName}, ${base})`);

  const missing = { $or: [{ currency: { $exists: false } }, { currency: null }, { currency: '' }] };

  for (const name of MONEY_MODELS) {
    const Model = connection.model(name);
    const count = await Model.countDocuments(missing);
    if (count === 0) continue;
    if (!dryRun) await Model.updateMany(missing, { $set: { currency: base } });
    console.log(`  ${dryRun ? '~' : '+'} ${name.padEnd(20)} ${count} set to ${base}${dryRun ? '  (dry run)' : ''}`);
  }

  if (base !== 'USD') {
    const Quotation = connection.model('Quotation');
    const usdQuotes = await Quotation.countDocuments({ currency: 'USD', isDeleted: { $ne: true } });
    if (usdQuotes > 0) {
      if (quotesToBase && !dryRun) {
        await Quotation.updateMany({ currency: 'USD' }, { $set: { currency: base } });
        // POs copied their figures from these quotes, so they follow.
        await connection.model('PurchaseOrder').updateMany({ currency: 'USD' }, { $set: { currency: base } });
        console.log(`  + Quotation            ${usdQuotes} USD quote(s) and their POs set to ${base}`);
      } else {
        console.log(`  ! Quotation            ${usdQuotes} quote(s) marked USD in a ${base} SBU — check them;` +
          ' --quotes-usd-to-base converts them');
      }
    }
  }

  const PurchaseOrder = connection.model('PurchaseOrder');
  const open = await PurchaseOrder.find({ status: { $in: OPEN_PO_STATUSES }, isDeleted: { $ne: true } })
    .select('poNumber status totalAmount currency requiresCooApproval')
    .lean<Array<{ poNumber: string; status: string; totalAmount: number; currency?: string; requiresCooApproval?: boolean }>>();

  for (const po of open) {
    const currency = po.currency || base;
    const assessment = await runWithSbu(sbu, () => assessCooRequirement(po.totalAmount, currency));
    if (assessment.required === Boolean(po.requiresCooApproval)) continue;
    const usd = assessment.amountUsd == null ? `no ${currency} rate` : `≈ USD ${assessment.amountUsd.toLocaleString('en-US')}`;
    console.log(
      `  ? ${po.poNumber.padEnd(28)} ${po.status.padEnd(18)} ${currency} ${po.totalAmount.toLocaleString('en-US')} (${usd}) ` +
        `now ${assessment.required ? 'needs' : 'does not need'} COO — left as it is`
    );
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const quotesToBase = process.argv.includes('--quotes-usd-to-base');
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);
  if (dryRun) console.log('DRY RUN - nothing will be written');

  let sbus = await activeSbus();
  if (sbus.length === 0) throw new Error('The SBU registry is empty. Run seed:sbu-registry first.');

  const only = arg('only');
  if (only) {
    const wanted = new Set(only.split(',').map((code) => code.trim().toUpperCase()).filter(Boolean));
    sbus = sbus.filter((sbu) => wanted.has(sbu.code));
  }

  for (const sbu of sbus) await backfillSbu(sbu, dryRun, quotesToBase);

  console.log(dryRun ? '\nDry run complete.' : '\nCurrency backfill complete.');
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Currency backfill failed:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
