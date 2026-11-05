import type { Request, Response } from 'express';

import { SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { createNotification } from '../../services/notification.service.js';
import { transitionSupplierStatus } from '../../services/supplierEligibility.service.js';
import { withoutDocumentFiles } from '../../services/supplierDocuments.service.js';

type TargetStatus = 'active' | 'suspended' | 'dormant';

const ALLOWED_TARGETS: TargetStatus[] = ['active', 'suspended', 'dormant'];

const setSupplierStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body as { status?: TargetStatus; reason?: string };

    if (!status || !ALLOWED_TARGETS.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${ALLOWED_TARGETS.join(', ')}`
      });
    }

    if (status === 'suspended' && !reason) {
      return res.status(400).json({
        success: false,
        message: 'A reason is required to suspend a supplier'
      });
    }

    const supplier = await SupplierProfile.findById(id).populate('user');
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    if (supplier.status === 'blacklisted') {
      return res.status(400).json({
        success: false,
        message: 'Blacklisted suppliers cannot have their status changed here'
      });
    }

    if (supplier.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: "This supplier's registration was rejected. Reopen the registration before changing its status."
      });
    }

    // Reactivating a suspended or dormant supplier is one person's call; a
    // pending one is onboarding, which takes a submitter and a second approver.
    if (status === 'active' && supplier.status === 'pending') {
      return res.status(400).json({
        success: false,
        message:
          'A pending supplier is activated by submitting it for activation, which the Head of Procurement or the COO then approves.'
      });
    }

    if (status === 'active' && !supplier.kysComplete && !supplier.kysExempt) {
      return res.status(400).json({
        success: false,
        message: 'Cannot activate supplier until KYS verification is complete, or apply a KYS override'
      });
    }

    const previousStatus = supplier.status;
    // Keeps transactability in step — reactivation restores spend
    // authorization, suspension and dormancy withdraw it — and records the
    // reason in the status history rather than over the supplier's notes.
    transitionSupplierStatus(supplier, status, req.user!._id, reason);
    // A pending supplier set aside is no longer up for activation.
    supplier.activationRequest = undefined;
    if (status === 'active') {
      supplier.approvedBy = req.user!._id;
      supplier.approvedAt = new Date();
    }

    await supplier.save();

    const labels: Record<TargetStatus, string> = {
      active: 'Reactivated',
      suspended: 'Suspended',
      dormant: 'Marked dormant'
    };

    await createAuditLog({
      action: 'status_change',
      entity: 'SupplierProfile',
      entityId: supplier._id,
      user: req.user,
      description: `${labels[status]} supplier: ${supplier.companyName}${reason ? `. Reason: ${reason}` : ''}`,
      previousData: { status: previousStatus },
      newData: { status, transactability: supplier.transactability },
      req
    });

    if (supplier.user) {
      const messages: Record<TargetStatus, string> = {
        active: `Your supplier account for ${supplier.companyName} has been reactivated.`,
        suspended: `Your supplier account for ${supplier.companyName} has been suspended.${reason ? ` Reason: ${reason}` : ''}`,
        dormant: `Your supplier account for ${supplier.companyName} has been marked dormant.`
      };
      await createNotification({
        recipient: supplier.user._id,
        type: 'supplier_status_change',
        title: `Supplier Account ${labels[status]}`,
        message: messages[status],
        entity: 'SupplierProfile',
        entityId: supplier._id,
        relatedUser: req.user!._id,
        metadata: { companyName: supplier.companyName, status }
      });
    }

    res.status(200).json({
      success: true,
      message: `Supplier ${labels[status].toLowerCase()} successfully`,
      data: withoutDocumentFiles(supplier)
    });
  } catch (error: any) {
    console.error('Set supplier status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default setSupplierStatus;
