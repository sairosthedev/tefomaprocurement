import type { Request, Response } from 'express';

import { SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { createNotification } from '../../services/notification.service.js';

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

    if (status === 'active' && !supplier.kysComplete && !supplier.kysExempt) {
      return res.status(400).json({
        success: false,
        message: 'Cannot activate supplier until KYS verification is complete, or apply a KYS override'
      });
    }

    const previousStatus = supplier.status;
    supplier.status = status;
    if (reason) supplier.notes = reason;
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
      newData: { status },
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
      data: supplier
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
