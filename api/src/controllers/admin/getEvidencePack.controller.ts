import type { Request, Response } from 'express';
import {
  User,
  SupplierBankChangeRequest,
  Payment,
  PurchaseOrder,
  RFQ,
  AuditLog
} from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { maskBankNumbers } from '../../lib/bankMasking.js';
import { getSbu } from '../../tenancy/sbuContext.js';
import { RETENTION_RULES, recordsDueForReview } from '../../services/retention.service.js';

/**
 * Auditor's evidence pack.
 *
 * One export, for a stated period, of the evidence an auditor asks for when
 * testing the controls in BUSINESS_REQUIREMENTS_DOCUMENT §business rules:
 * who has access, whether every bank change had a callback and an independent
 * approver, whether payments followed a bank change suspiciously closely,
 * whether every PO went through its approval chain with distinct people, which
 * three-quote waivers were granted, and what the audit trail recorded.
 *
 * Each section lists its exceptions separately, so a clean period reads as
 * empty exception lists rather than something to be inferred. Account numbers
 * are masked throughout; the pack is meant to be handed out.
 * docs/AUDIT_EVIDENCE_PACK.md explains each section to the reader.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** A payment this soon after a bank change is the "change, pay" fraud pattern. */
const CHANGE_THEN_PAY_WINDOW_DAYS = 30;
const DORMANT_ACCOUNT_DAYS = 90;

const name = (u: any) =>
  u && typeof u === 'object' ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email : undefined;
const idOf = (v: any) => (v && typeof v === 'object' && v._id ? String(v._id) : v ? String(v) : undefined);

function parsePeriod(req: Request): { from: Date; to: Date } | null {
  const { from, to } = req.query as Record<string, string>;
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getFullYear() - 1, end.getMonth(), end.getDate());
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return null;
  if (to) end.setHours(23, 59, 59, 999);
  return { from: start, to: end };
}

async function accessReview(now: Date) {
  const users = await User.find({ isDeleted: { $ne: true } })
    .select('firstName lastName email role status lastLogin createdAt department')
    .populate('department', 'name')
    .sort({ role: 1, lastName: 1 })
    .lean();

  const dormantBefore = new Date(now.getTime() - DORMANT_ACCOUNT_DAYS * DAY_MS);
  const byRole: Record<string, number> = {};
  for (const u of users as any[]) byRole[u.role] = (byRole[u.role] || 0) + 1;

  const staff = (users as any[]).filter((u) => u.role !== 'supplier');
  return {
    totalAccounts: users.length,
    byRole,
    staff: staff.map((u) => ({
      name: name(u),
      email: u.email,
      role: u.role,
      department: u.department?.name,
      status: u.status,
      lastLogin: u.lastLogin,
      createdAt: u.createdAt
    })),
    exceptions: {
      activeButDormant: staff
        .filter((u) => u.status === 'active' && (!u.lastLogin || new Date(u.lastLogin) < dormantBefore))
        .map((u) => ({ email: u.email, role: u.role, lastLogin: u.lastLogin || null })),
      administrators: staff
        .filter((u) => u.role === 'admin' && u.status === 'active')
        .map((u) => ({ email: u.email, lastLogin: u.lastLogin || null }))
    }
  };
}

async function bankChangeControl(from: Date, to: Date) {
  const requests = await SupplierBankChangeRequest.find({ createdAt: { $gte: from, $lte: to } })
    .select('-supportingDocument.fileData')
    .populate('supplier', 'companyName')
    .populate('requestedBy', 'firstName lastName email')
    .populate('callback.verifiedBy', 'firstName lastName email')
    .populate('approvedBy', 'firstName lastName email')
    .populate('rejectedBy', 'firstName lastName email')
    .sort({ createdAt: 1 })
    .lean();

  const rows = (requests as any[]).map((r) => {
    const requester = idOf(r.requestedBy);
    const verifier = idOf(r.callback?.verifiedBy);
    const approver = idOf(r.approvedBy);
    return {
      id: String(r._id),
      supplier: r.supplier?.companyName,
      requestedAt: r.createdAt,
      requestedVia: r.requestedVia,
      requestedBy: name(r.requestedBy),
      fieldsChanged: (r.changes || []).map((c: any) => c.field),
      changes: r.changes,
      status: r.status,
      callback: r.callback
        ? {
            numberCalled: r.callback.numberCalled,
            confirmedBy: r.callback.confirmedBy,
            verifiedBy: name(r.callback.verifiedBy),
            verifiedAt: r.callback.verifiedAt
          }
        : null,
      approvedBy: name(r.approvedBy),
      approvedAt: r.approvedAt,
      rejectedBy: name(r.rejectedBy),
      rejectionReason: r.rejectionReason,
      hasSupportingDocument: !!r.supportingDocument?.fileName,
      _ids: { requester, verifier, approver }
    };
  });

  const approved = rows.filter((r) => r.status === 'approved');
  return {
    total: rows.length,
    byStatus: rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {}),
    requests: rows.map(({ _ids, ...r }) => r),
    exceptions: {
      approvedWithoutCallback: approved.filter((r) => !r.callback).map((r) => r.id),
      approverNotIndependent: approved
        .filter((r) => r._ids.approver && (r._ids.approver === r._ids.requester || r._ids.approver === r._ids.verifier))
        .map((r) => r.id),
      approvedWithoutSupportingDocument: approved.filter((r) => !r.hasSupportingDocument).map((r) => r.id)
    }
  };
}

async function payments(from: Date, to: Date) {
  const list = await Payment.find({ paymentDate: { $gte: from, $lte: to }, isDeleted: { $ne: true } })
    .populate('supplier', 'companyName')
    .populate('createdBy', 'firstName lastName email')
    .populate('completedBy', 'firstName lastName email')
    .sort({ paymentDate: 1 })
    .lean();

  // Bank changes approved shortly before each payment, by supplier.
  const windowStart = new Date(from.getTime() - CHANGE_THEN_PAY_WINDOW_DAYS * DAY_MS);
  const approvedChanges = await SupplierBankChangeRequest.find({
    status: 'approved',
    approvedAt: { $gte: windowStart, $lte: to }
  })
    .select('supplier approvedAt')
    .lean();

  const rows = (list as any[]).map((p) => {
    const supplierId = idOf(p.supplier);
    const paidAt = new Date(p.paymentDate).getTime();
    const recentChange = (approvedChanges as any[]).find(
      (c) =>
        String(c.supplier) === supplierId &&
        c.approvedAt &&
        new Date(c.approvedAt).getTime() <= paidAt &&
        paidAt - new Date(c.approvedAt).getTime() <= CHANGE_THEN_PAY_WINDOW_DAYS * DAY_MS
    );
    return {
      paymentNumber: p.paymentNumber,
      supplier: p.supplier?.companyName,
      amount: p.amount,
      paymentDate: p.paymentDate,
      method: p.paymentMethod,
      status: p.status,
      paidTo: p.paidToBankDetails,
      raisedBy: name(p.createdBy),
      completedBy: name(p.completedBy),
      bankChangeApprovedAt: recentChange?.approvedAt || null,
      _sameRaiserAndCompleter: idOf(p.createdBy) && idOf(p.createdBy) === idOf(p.completedBy)
    };
  });

  return {
    total: rows.length,
    totalAmount: rows.reduce((sum, r) => sum + (r.amount || 0), 0),
    payments: rows.map(({ _sameRaiserAndCompleter, ...r }) => r),
    exceptions: {
      paidWithinWindowOfBankChange: rows
        .filter((r) => r.bankChangeApprovedAt)
        .map((r) => ({ paymentNumber: r.paymentNumber, supplier: r.supplier, bankChangeApprovedAt: r.bankChangeApprovedAt })),
      raisedAndCompletedBySamePerson: rows
        .filter((r) => r._sameRaiserAndCompleter && r.status === 'completed')
        .map((r) => r.paymentNumber),
      withoutBankSnapshot: rows
        .filter((r) => r.method !== 'cash' && !r.paidTo?.accountNumber)
        .map((r) => r.paymentNumber)
    }
  };
}

const APPROVAL_ACTIONS = new Set([
  'hod_approved', 'dept_hod_approved', 'proc_hod_approved', 'finance_approved', 'coo_approved'
]);
const PAST_APPROVAL = new Set(['approved', 'issued', 'partially_received', 'completed']);

async function poApprovals(from: Date, to: Date) {
  const list = await PurchaseOrder.find({ createdAt: { $gte: from, $lte: to }, isDeleted: { $ne: true } })
    .select('poNumber totalAmount status requiresCooApproval financeApproved cooApproved procHodApproved createdBy approvalHistory createdAt')
    .populate('createdBy', 'firstName lastName email')
    .populate('approvalHistory.by', 'firstName lastName email')
    .sort({ createdAt: 1 })
    .lean();

  const rows = (list as any[]).map((po) => {
    const approvals = (po.approvalHistory || []).filter((h: any) => APPROVAL_ACTIONS.has(h.action));
    const approverIds = approvals.map((h: any) => idOf(h.by));
    return {
      poNumber: po.poNumber,
      totalAmount: po.totalAmount,
      status: po.status,
      requiresCooApproval: po.requiresCooApproval,
      createdBy: name(po.createdBy),
      createdAt: po.createdAt,
      history: (po.approvalHistory || []).map((h: any) => ({
        action: h.action,
        by: name(h.by),
        role: h.role,
        at: h.timestamp,
        comments: h.comments
      })),
      _creator: idOf(po.createdBy),
      _approverIds: approverIds,
      _po: po
    };
  });

  const passed = rows.filter((r) => PAST_APPROVAL.has(r.status));
  return {
    total: rows.length,
    totalValue: rows.reduce((sum, r) => sum + (r.totalAmount || 0), 0),
    byStatus: rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {}),
    purchaseOrders: rows.map(({ _creator, _approverIds, _po, ...r }) => r),
    exceptions: {
      approvedWithoutFinance: passed.filter((r) => !r._po.financeApproved).map((r) => r.poNumber),
      overThresholdWithoutCoo: passed
        .filter((r) => r._po.requiresCooApproval && !r._po.cooApproved)
        .map((r) => r.poNumber),
      creatorApprovedOwnPo: rows
        .filter((r) => r._creator && r._approverIds.includes(r._creator))
        .map((r) => r.poNumber),
      samePersonAtTwoStages: rows
        .filter((r) => new Set(r._approverIds).size < r._approverIds.length)
        .map((r) => r.poNumber)
    }
  };
}

async function quotationWaivers(from: Date, to: Date) {
  const rfqs = await RFQ.find({
    'quotationWaiver.waived': true,
    'quotationWaiver.approvedAt': { $gte: from, $lte: to }
  })
    .select('rfqNumber title quotationWaiver')
    .populate('quotationWaiver.approvedBy', 'firstName lastName email role')
    .sort({ 'quotationWaiver.approvedAt': 1 })
    .lean();

  return {
    total: rfqs.length,
    waivers: (rfqs as any[]).map((r) => ({
      rfqNumber: r.rfqNumber,
      title: r.title,
      waiverType: r.quotationWaiver?.waiverType,
      reason: r.quotationWaiver?.reason,
      approvedBy: name(r.quotationWaiver?.approvedBy),
      approverRole: r.quotationWaiver?.approvedBy?.role,
      approvedAt: r.quotationWaiver?.approvedAt
    })),
    exceptions: {
      withoutReason: (rfqs as any[])
        .filter((r) => !String(r.quotationWaiver?.reason || '').trim())
        .map((r) => r.rfqNumber)
    }
  };
}

async function auditTrail(from: Date, to: Date) {
  const range = { createdAt: { $gte: from, $lte: to } };
  const [total, byAction, byEntity, failedLogins, systemActions, oldest] = await Promise.all([
    AuditLog.countDocuments(range),
    AuditLog.aggregate([{ $match: range }, { $group: { _id: '$action', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    AuditLog.aggregate([{ $match: range }, { $group: { _id: '$entity', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    AuditLog.aggregate([
      { $match: { ...range, action: 'login_failed' } },
      { $group: { _id: '$userEmail', count: { $sum: 1 }, last: { $max: '$createdAt' } } },
      { $sort: { count: -1 } },
      { $limit: 50 }
    ]),
    // Records wiped, users created or re-roled: the admin actions an auditor reviews line by line.
    AuditLog.find({
      ...range,
      $or: [{ entity: 'System' }, { entity: 'User', action: { $in: ['create', 'update', 'delete'] } }]
    })
      .select('action entity entityLabel userEmail userRole description changes createdAt ipAddress')
      .sort({ createdAt: 1 })
      .limit(500)
      .lean(),
    AuditLog.findOne().sort({ createdAt: 1 }).select('createdAt').lean()
  ]);

  return {
    total,
    earliestEntryHeld: (oldest as any)?.createdAt || null,
    byAction: Object.fromEntries(byAction.map((a: any) => [a._id, a.count])),
    byEntity: Object.fromEntries(byEntity.map((e: any) => [e._id, e.count])),
    failedLoginsByAccount: failedLogins.map((f: any) => ({ email: f._id, count: f.count, last: f.last })),
    systemAndUserAdministration: systemActions
  };
}

const getEvidencePack = async (req: Request, res: Response): Promise<any> => {
  try {
    const period = parsePeriod(req);
    if (!period) {
      return res.status(400).json({ success: false, message: 'from and to must be valid dates, with from before to' });
    }
    const { from, to } = period;
    const now = new Date();

    const [access, bankChanges, pays, pos, waivers, audit, retentionDue] = await Promise.all([
      accessReview(now),
      bankChangeControl(from, to),
      payments(from, to),
      poApprovals(from, to),
      quotationWaivers(from, to),
      auditTrail(from, to),
      recordsDueForReview(now)
    ]);

    const sbu = getSbu();
    const pack = maskBankNumbers({
      meta: {
        title: 'Procurement controls evidence pack',
        businessUnit: sbu ? { code: sbu.code, name: sbu.name } : null,
        periodFrom: from,
        periodTo: to,
        generatedAt: now,
        generatedBy: { name: name(req.user), email: (req.user as any)?.email, role: (req.user as any)?.role },
        guide: 'docs/AUDIT_EVIDENCE_PACK.md',
        note: 'Bank account numbers are masked to their last four digits. Exceptions lists are empty when no exception was found.'
      },
      summary: {
        accessExceptions:
          access.exceptions.activeButDormant.length,
        bankChangeExceptions:
          bankChanges.exceptions.approvedWithoutCallback.length +
          bankChanges.exceptions.approverNotIndependent.length,
        paymentExceptions:
          pays.exceptions.paidWithinWindowOfBankChange.length +
          pays.exceptions.raisedAndCompletedBySamePerson.length,
        purchaseOrderExceptions:
          pos.exceptions.approvedWithoutFinance.length +
          pos.exceptions.overThresholdWithoutCoo.length +
          pos.exceptions.creatorApprovedOwnPo.length +
          pos.exceptions.samePersonAtTwoStages.length,
        quotationWaivers: waivers.total
      },
      accessReview: access,
      bankChangeControl: bankChanges,
      payments: pays,
      purchaseOrderApprovals: pos,
      quotationWaivers: waivers,
      auditTrail: audit,
      retention: { policy: RETENTION_RULES, recordsDueForReview: retentionDue }
    });

    // Producing the pack is itself an auditable event.
    await createAuditLog({
      action: 'download',
      entity: 'EvidencePack',
      user: req.user,
      description: `Generated auditor evidence pack for ${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`,
      metadata: { from, to },
      req
    });

    const fileName = `evidence-pack_${sbu?.code || 'unit'}_${from.toISOString().slice(0, 10)}_${to
      .toISOString()
      .slice(0, 10)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.status(200).json({ success: true, data: pack });
  } catch (error: any) {
    console.error('Evidence pack error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getEvidencePack;
