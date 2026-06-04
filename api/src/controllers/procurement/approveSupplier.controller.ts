import type { Request, Response } from 'express';

import { SupplierProfile, User } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { createNotification } from '../../services/notification.service.js';
import { sendEmailNotification } from '../../services/email.service.js';

const approveSupplier = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const supplier = await SupplierProfile.findById(id).populate('user');
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    const previousStatus = supplier.status;
    supplier.status = 'active';
    supplier.approvedBy = req.user!._id;
    supplier.approvedAt = new Date();
    if (notes) supplier.notes = notes;

    await supplier.save();

    await createAuditLog({
      action: 'approve',
      entity: 'SupplierProfile',
      entityId: supplier._id,
      user: req.user,
      description: `Approved supplier: ${supplier.companyName}`,
      previousData: { status: previousStatus },
      newData: { status: 'active' },
      req
    });

    // Create notification for the supplier
    if (supplier.user) {
      await createNotification({
        recipient: supplier.user._id,
        type: 'supplier_approved',
        title: 'Supplier Account Approved',
        message: `Your supplier account for ${supplier.companyName} has been approved. You can now receive RFQ invitations and submit quotations.`,
        entity: 'SupplierProfile',
        entityId: supplier._id,
        relatedUser: req.user!._id,
        metadata: { companyName: supplier.companyName }
      });

      // Send approval email to supplier
      const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const user = await User.findById(supplier.user._id).select('email firstName lastName');
      
      if (user && user.email) {
        await sendEmailNotification({
          emailTo: user.email,
          subject: 'Supplier Account Approved - FosssilProcure',
          headingText: 'Your Supplier Account Has Been Approved!',
          subText: `Congratulations! Your supplier account for ${supplier.companyName} has been approved. You can now receive RFQ invitations, submit quotations, and manage your orders through the supplier dashboard.`,
          subSubText: supplier.notes ? `Notes: ${supplier.notes}` : null,
          actionButtonText: 'Access Supplier Dashboard',
          actionButtonLink: `${baseUrl}/app`
        }).catch(err => {
          console.error('Failed to send approval email to supplier:', err);
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Supplier approved successfully',
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
