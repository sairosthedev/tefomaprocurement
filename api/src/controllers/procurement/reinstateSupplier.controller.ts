import type { Request, Response } from 'express';
import { SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { createNotification } from '../../services/notification.service.js';

/**
 * Lift a blacklisting.
 *
 * Blacklisting was previously a one-way door: `setSupplierStatus` refuses to
 * touch a blacklisted supplier ("cannot have their status changed here",
 * implying a route that did not exist), so a supplier blacklisted in error
 * could never be recovered.
 *
 * Reinstatement returns the supplier to `pending` rather than `active` — they
 * must be re-approved through the normal KYS gate, and transactability is
 * withdrawn until that happens. The blacklist history is deliberately kept
 * rather than cleared.
 */
const reinstateSupplier = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { reason } = req.body as { reason?: string };

    if (!reason?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A reason is required to lift a blacklisting'
      });
    }

    const supplier = await SupplierProfile.findById(id).populate('user');
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    if (supplier.status !== 'blacklisted') {
      return res.status(400).json({
        success: false,
        message: `Only blacklisted suppliers can be reinstated (this one is ${supplier.status})`
      });
    }

    const previousStatus = supplier.status;
    const previousReason = supplier.blacklistReason;

    // Back to pending, never straight to active: re-approval goes through KYS.
    supplier.status = 'pending';
    supplier.transactability = 'none';
    supplier.transactabilityChangedBy = req.user!._id;
    supplier.transactabilityChangedAt = new Date();
    // Keep blacklistReason/By/At as history; record the lifting in notes.
    supplier.notes = `Blacklisting lifted ${new Date().toISOString().slice(0, 10)}: ${reason.trim()}`;

    await supplier.save();

    await createAuditLog({
      action: 'status_change',
      entity: 'SupplierProfile',
      entityId: supplier._id,
      user: req.user,
      description: `Lifted blacklisting for ${supplier.companyName}. Reason: ${reason.trim()}`,
      previousData: { status: previousStatus, blacklistReason: previousReason },
      newData: { status: 'pending', transactability: 'none' },
      req
    });

    if (supplier.user) {
      await createNotification({
        recipient: supplier.user._id,
        type: 'supplier_status_change',
        title: 'Blacklisting lifted',
        message: `The blacklisting on your account for ${supplier.companyName} has been lifted. Your account is pending re-approval.`,
        entity: 'SupplierProfile',
        entityId: supplier._id,
        relatedUser: req.user!._id,
        metadata: { companyName: supplier.companyName, status: 'pending' }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Blacklisting lifted. The supplier is pending re-approval.',
      data: supplier
    });
  } catch (error: any) {
    console.error('Reinstate supplier error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default reinstateSupplier;
