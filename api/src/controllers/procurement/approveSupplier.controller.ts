import type { Request, Response } from 'express';

import { computeKysCompletion } from '@fossil/shared';
import { SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { createNotification } from '../../services/notification.service.js';

const approveSupplier = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { notes, overrideKys, reason } = req.body;

    const supplier = await SupplierProfile.findById(id).populate('user');
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    const completion = computeKysCompletion(supplier.kysChecklist as Record<string, boolean>);

    if (overrideKys) {
      if (!reason?.trim()) {
        return res.status(400).json({
          success: false,
          message: 'A reason is required to activate a supplier without KYS'
        });
      }

      supplier.kysExempt = true;
      supplier.kysExemptReason = reason.trim();
      supplier.kysExemptBy = req.user!._id;
      supplier.kysExemptAt = new Date();
    } else if (!completion.isComplete && !supplier.kysExempt) {
      return res.status(400).json({
        success: false,
        message: `Cannot activate this supplier yet: KYS is incomplete (${completion.requiredComplete}/${completion.requiredTotal} required items). Upload the required documents first, or use the KYS override.`,
        data: { requiresKys: true, completion }
      });
    }

    const previousStatus = supplier.status;
    supplier.status = 'active';
    supplier.approvedBy = req.user!._id;
    supplier.approvedAt = new Date();

    if (!overrideKys) {
      supplier.kysComplete = true;
      if (!supplier.kysChecklist.verifiedAt) {
        supplier.kysChecklist.verifiedBy = req.user!._id;
        supplier.kysChecklist.verifiedAt = new Date();
      }
    }

    if (notes) supplier.notes = notes;

    await supplier.save();

    await createAuditLog({
      action: 'approve',
      entity: 'SupplierProfile',
      entityId: supplier._id,
      user: req.user,
      description: overrideKys
        ? `Activated supplier without KYS override: ${supplier.companyName}. Reason: ${reason.trim()}`
        : `Approved supplier: ${supplier.companyName}`,
      previousData: { status: previousStatus },
      newData: {
        status: 'active',
        kysExempt: supplier.kysExempt,
        overrideKys: !!overrideKys
      },
      req
    });

    if (supplier.user) {
      await createNotification({
        recipient: supplier.user._id,
        type: 'supplier_approved',
        title: 'Supplier account approved',
        message: `Your supplier account for ${supplier.companyName} has been approved. You can now receive RFQ invitations and submit quotations.`,
        entity: 'SupplierProfile',
        entityId: supplier._id,
        relatedUser: req.user!._id,
        metadata: { companyName: supplier.companyName, notes: supplier.notes || undefined }
      });
    }

    res.status(200).json({
      success: true,
      message: overrideKys
        ? 'Supplier activated without KYS (override applied)'
        : 'Supplier approved successfully',
      data: supplier
    });
  } catch (error: any) {
    console.error('Approve supplier error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default approveSupplier;
