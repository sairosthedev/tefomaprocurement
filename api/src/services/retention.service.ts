import { Notification, OtpChallenge, SupplierProfile, Payment, PurchaseOrder, AuditLog } from '../models/index.js';
import { logger } from '../lib/logger.js';

/**
 * Record retention.
 *
 * The policy lives here, as data, so the written policy
 * (docs/DATA_RETENTION_POLICY.md), the purge job and the auditor's evidence
 * pack all read the same numbers. Change a period here and in the policy
 * document together.
 *
 * Only short-lived operational data is deleted automatically. Financial and
 * procurement records are never auto-deleted: their periods are legal minimums
 * (Zimbabwe Income Tax Act / VAT Act: 6 years; South Africa Companies Act:
 * 7 years), a deletion cannot be undone, and an open dispute or audit can
 * extend them. The evidence pack reports what has passed its period so a
 * person can decide.
 */

export type RetentionAction = 'auto_delete' | 'review_then_dispose' | 'keep';

export interface RetentionRule {
  key: string;
  record: string;
  period: string;
  /** Months after the trigger event; null means kept for the system's life. */
  months: number | null;
  trigger: string;
  action: RetentionAction;
  basis: string;
}

const YEARS = (n: number) => n * 12;

/** Seven years satisfies the longer of the Zimbabwean and South African minimums. */
export const FINANCIAL_RECORD_MONTHS = YEARS(7);

export const RETENTION_RULES: readonly RetentionRule[] = Object.freeze([
  {
    key: 'financial_records',
    record: 'Purchase orders, invoices, payments, GRVs, quotations, RFQs and requisitions',
    period: '7 years',
    months: FINANCIAL_RECORD_MONTHS,
    trigger: 'end of the financial year in which the record closed',
    action: 'review_then_dispose',
    basis: 'ZW Income Tax Act [Ch. 23:06] and VAT Act [Ch. 23:12] (6 yrs); SA Companies Act s24 (7 yrs), Tax Administration Act s29 (5 yrs)'
  },
  {
    key: 'audit_log',
    record: 'Audit trail entries',
    period: '7 years',
    months: FINANCIAL_RECORD_MONTHS,
    trigger: 'date of the entry',
    action: 'review_then_dispose',
    basis: 'Evidence for the financial records above; kept as long as they are'
  },
  {
    key: 'bank_change_requests',
    record: 'Supplier bank-change requests, callback records and bank letters',
    period: '7 years',
    months: FINANCIAL_RECORD_MONTHS,
    trigger: 'date the request was closed',
    action: 'review_then_dispose',
    basis: 'Fraud and payment-dispute evidence; tied to the payments they affected'
  },
  {
    key: 'supplier_master_active',
    record: 'Supplier profiles, contacts and bank details of suppliers still trading',
    period: 'While the relationship lasts',
    months: null,
    trigger: '—',
    action: 'keep',
    basis: 'Necessary to perform the contract (CDPA s8 / POPIA s11(1)(b))'
  },
  {
    key: 'supplier_master_inactive',
    record: 'Supplier profiles of suppliers no longer trading (dormant, blacklisted, never approved)',
    period: '7 years after last transaction; 2 years if never transacted',
    months: YEARS(2),
    trigger: 'last update to the profile',
    action: 'review_then_dispose',
    basis: 'Minimisation (CDPA s13 / POPIA s14); blacklisting history is kept for the 7-year period'
  },
  {
    key: 'user_accounts',
    record: 'Staff user accounts',
    period: '2 years after the account is deactivated',
    months: YEARS(2),
    trigger: 'deactivation',
    action: 'review_then_dispose',
    basis: 'Approvals they made must stay attributable; the name is kept on records, the account is closed'
  },
  {
    key: 'notifications',
    record: 'In-app notifications',
    period: '12 months (read) / 24 months (unread)',
    months: 12,
    trigger: 'creation',
    action: 'auto_delete',
    basis: 'Operational only; the underlying record and audit entry are kept'
  },
  {
    key: 'otp_challenges',
    record: 'Sign-in one-time codes',
    period: '1 day after expiry',
    months: 0,
    trigger: 'expiry',
    action: 'auto_delete',
    basis: 'Security material with no value once expired'
  }
]);

const monthsAgo = (months: number, from = new Date()) => {
  const d = new Date(from);
  d.setMonth(d.getMonth() - months);
  return d;
};

const dayAgo = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

export interface PurgeResult {
  notifications: number;
  otpChallenges: number;
}

/** Delete the short-lived records the policy marks auto_delete. Current SBU only. */
export async function purgeExpiredOperationalData(now = new Date()): Promise<PurgeResult> {
  const [readNotifications, unreadNotifications, otp] = await Promise.all([
    Notification.deleteMany({ read: true, createdAt: { $lt: monthsAgo(12, now) } }),
    Notification.deleteMany({ read: { $ne: true }, createdAt: { $lt: monthsAgo(24, now) } }),
    OtpChallenge.deleteMany({ expiresAt: { $lt: dayAgo() } })
  ]);
  return {
    notifications: (readNotifications.deletedCount || 0) + (unreadNotifications.deletedCount || 0),
    otpChallenges: otp.deletedCount || 0
  };
}

export interface RetentionReviewItem {
  key: string;
  record: string;
  dueForReview: number;
}

/**
 * Counts of records past their period that a person must review — never
 * deleted here. Feeds the evidence pack and the annual disposal review.
 */
export async function recordsDueForReview(now = new Date()): Promise<RetentionReviewItem[]> {
  const financialCutoff = monthsAgo(FINANCIAL_RECORD_MONTHS, now);
  const inactiveCutoff = monthsAgo(YEARS(2), now);

  const [pos, payments, audit, inactiveSuppliers] = await Promise.all([
    PurchaseOrder.countDocuments({ createdAt: { $lt: financialCutoff } }),
    Payment.countDocuments({ createdAt: { $lt: financialCutoff } }),
    AuditLog.countDocuments({ createdAt: { $lt: financialCutoff } }),
    SupplierProfile.countDocuments({
      // Blacklisted suppliers are excluded: that history is kept the full 7 years.
      status: { $in: ['pending', 'dormant'] },
      updatedAt: { $lt: inactiveCutoff }
    })
  ]);

  return [
    { key: 'financial_records', record: 'Purchase orders older than 7 years', dueForReview: pos },
    { key: 'financial_records', record: 'Payments older than 7 years', dueForReview: payments },
    { key: 'audit_log', record: 'Audit entries older than 7 years', dueForReview: audit },
    {
      key: 'supplier_master_inactive',
      record: 'Pending or dormant supplier profiles untouched for 2 years',
      dueForReview: inactiveSuppliers
    }
  ];
}

/** Scheduler entry point. Logs and swallows so one SBU cannot stop the tick. */
export async function runRetentionJob(): Promise<void> {
  try {
    const result = await purgeExpiredOperationalData();
    if (result.notifications || result.otpChallenges) {
      logger.info(
        `Retention purge: ${result.notifications} notifications, ${result.otpChallenges} expired sign-in codes`
      );
    }
  } catch (error) {
    logger.error('Retention purge failed', error);
  }
}
