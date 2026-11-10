import type { Request, Response } from 'express';
import {
  PR_TERMINAL_STATUSES,
  categoryCodeForStock,
  effectiveReorderLevel,
  getCategoryName,
  isValidCategoryCode,
  stockStatus,
  validateRestock
} from '@fossil/shared';

import { Department, Inventory, PurchaseRequisition } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { refuseInvalid } from '../../lib/validation.js';
import { submitRequisitionForApproval } from '../../services/requisitionApproval.service.js';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

/**
 * Stores asks for its own shelf to be refilled.
 *
 * A low-stock alert used to end with stores telling someone in a department to
 * raise a requisition, because stores could not raise one. A restock is an
 * ordinary requisition from the stores officer's department, approved by that
 * department's head and charged to its budget, with two differences carried by
 * its `restock` flag: it skips the stock check (stores already know the shelf
 * is short), and its goods go into stock on delivery rather than being
 * collected by a department.
 */
const createRestockRequisition = async (req: Request, res: Response): Promise<any> => {
  try {
    const user = req.user!;
    const { inventoryId, justification, priority } = req.body;

    // A blank category is filled from the item below, so only a given one is checked here.
    if (refuseInvalid(res, validateRestock(req.body, { categoryFromItem: true }))) return;
    const quantity = Number(req.body.quantity);

    const inventory: any = await Inventory.findOne({ _id: inventoryId, isDeleted: false })
      .populate('item')
      .populate('site', 'name code');
    if (!inventory || !inventory.item || inventory.item.isDeleted) {
      return res.status(404).json({ success: false, message: 'Stock record not found' });
    }
    const item = inventory.item;

    // It goes straight to procurement, where suppliers are matched by
    // category, so the category is settled here rather than in stores review.
    // The item's own catalogue category is used when it maps to one; stores
    // is asked only when it does not.
    const category = String(req.body.category || categoryCodeForStock(item.category) || '').trim();
    if (!isValidCategoryCode(category)) {
      return res.status(400).json({
        success: false,
        message: `Choose a category for ${item.name}`,
        errors: { category: `Choose a category for ${item.name}` }
      });
    }

    if (!user.department) {
      return res.status(400).json({
        success: false,
        message: 'You are not in a department, so there is nobody to approve a restock. Ask an administrator to add you to one.'
      });
    }
    const department: any = await Department.findOne({ _id: user.department, isDeleted: false })
      .select('name head deputyHead')
      .lean();
    if (!department?.head && !department?.deputyHead) {
      return res.status(400).json({
        success: false,
        message: `${department?.name || 'Your department'} has no head or deputy to approve a restock. Ask an administrator to name one under Departments.`
      });
    }

    const open = await PurchaseRequisition.findOne({
      restock: true,
      site: inventory.site?._id || inventory.site,
      'items.item': item._id,
      status: { $nin: PR_TERMINAL_STATUSES as unknown as string[] },
      isDeleted: false
    })
      .select('requisitionNumber')
      .lean();
    if (open) {
      return res.status(409).json({
        success: false,
        message: `${(open as any).requisitionNumber} is already restocking ${item.name} here`
      });
    }

    const { level } = effectiveReorderLevel(inventory.reorderLevel, item.reorderLevel);
    const onHand = inventory.quantityOnHand || 0;
    const status = stockStatus(onHand, level);
    const siteName = inventory.site?.name || 'the store';
    const unit = item.unit || 'each';
    const unitPrice = inventory.unitCost || 0;

    const requisition = await PurchaseRequisition.create({
      title: `Restock ${item.name}`,
      restock: true,
      site: inventory.site?._id || inventory.site,
      department: user.department,
      requestedBy: user._id,
      priority: PRIORITIES.includes(priority) ? priority : status === 'out' ? 'high' : 'medium',
      justification:
        String(justification || '').trim() ||
        (status === 'out'
          ? `${item.name} is out of stock at ${siteName}. Reorder level ${level} ${unit}.`
          : `${item.name} is down to ${onHand} ${unit} at ${siteName}, at or below its reorder level of ${level}.`),
      items: [
        {
          item: item._id,
          description: item.name,
          category,
          quantity,
          unit,
          estimatedUnitPrice: unitPrice,
          estimatedTotalPrice: unitPrice * quantity
        }
      ],
      status: 'draft'
    });

    await createAuditLog({
      action: 'create',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      entityLabel: requisition.requisitionNumber,
      user,
      description: `Raised restock ${requisition.requisitionNumber}: ${quantity} ${unit} ${item.name} (${getCategoryName(category)}) at ${siteName}`,
      newData: { restock: true, item: item._id, quantity, onHand, reorderLevel: level },
      req
    });

    // Remember a category stores had to pick, so the item is not asked about
    // again. Items whose category already maps keep their own wording.
    if (!categoryCodeForStock(item.category)) {
      item.category = category;
      await item.save();
    }

    // From here it is any other requisition: budget check, then the head.
    const { requisition: submitted, budgetCheck } = await submitRequisitionForApproval(requisition, req);

    res.status(201).json({
      success: true,
      message: `${submitted.requisitionNumber} sent to your department head for approval`,
      data: submitted,
      budgetCheck
    });
  } catch (error: any) {
    console.error('Create restock requisition error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default createRestockRequisition;
