import type { Request, Response } from 'express';
import { StoreRequisition, Item, PurchaseRequisition } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifyUsersByRole } from '../../services/notification.service.js';
import { resolveSiteId } from '../../lib/siteScope.js';
import { canActOnDepartment } from '../../lib/departmentScope.js';
import { escapeRegex } from '../../lib/regex.js';

/** A store requisition still on its way to being issued. */
const OPEN_STATUSES = ['draft', 'pending', 'approved'];

const createStoreRequisition = async (req: Request, res: Response): Promise<any> => {
  try {
    const { items, purpose, requiredDate, notes, purchaseRequisitionId } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required'
      });
    }

    // Store requisitions only collect an IR's delivered goods. Anything else
    // from stores is asked for with an IR, which stores issue from stock or
    // pass to procurement.
    if (!purchaseRequisitionId) {
      return res.status(400).json({
        success: false,
        message: 'Raise a requisition instead. Stores issue it from stock, or pass it to procurement.'
      });
    }

    // Link the two, so each shows the other.
    const linkedRequisition: any = await PurchaseRequisition.findOne({ _id: purchaseRequisitionId, isDeleted: false })
      .select('requisitionNumber department')
      .lean();
    if (!linkedRequisition) {
      return res.status(404).json({ success: false, message: 'Requisition not found' });
    }
    if (!(await canActOnDepartment(req.user, linkedRequisition.department))) {
      return res.status(403).json({
        success: false,
        message: 'You can only collect goods for your own department'
      });
    }
    const open = await StoreRequisition.findOne({
      purchaseRequisition: linkedRequisition._id,
      status: { $in: OPEN_STATUSES },
      isDeleted: false
    })
      .select('requisitionNumber')
      .lean();
    if (open) {
      return res.status(409).json({
        success: false,
        message: `${open.requisitionNumber} is already with stores for ${linkedRequisition.requisitionNumber}`
      });
    }

    const requisitionPurpose = purpose || `Collect delivered items for ${linkedRequisition.requisitionNumber}`;

    // Process items - find or create Item records
    const processedItems: any[] = [];
    for (const itemData of items) {
      const { itemId, itemCode, description, quantity } = itemData;

      if (!description || !quantity || quantity < 1) {
        continue; // Skip invalid items
      }

      let item: any;

      // A line picked from the stock catalogue carries the item's id, so use it
      // directly. Re-matching such a line by name is how a typo ends up
      // creating a near-duplicate item that stores can never issue against.
      if (itemId) {
        item = await Item.findOne({ _id: itemId, isDeleted: false });
      }

      // Try to find existing item by code or name/description
      if (!item && itemCode) {
        item = await Item.findOne({
          code: { $regex: new RegExp(`^${escapeRegex(String(itemCode))}$`, 'i') },
          isDeleted: false
        });
      }

      if (!item && description) {
        item = await Item.findOne({
          $or: [
            { name: { $regex: new RegExp(`^${escapeRegex(String(description))}$`, 'i') } },
            { description: { $regex: new RegExp(`^${escapeRegex(String(description))}$`, 'i') } }
          ],
          isDeleted: false
        });
      }

      // If item doesn't exist, create it
      if (!item) {
        // Generate item code if not provided
        const count = await Item.countDocuments();
        const year = new Date().getFullYear();
        const newItemCode = itemCode || `ITM-${year}-${String(count + 1).padStart(5, '0')}`;

        item = await Item.create({
          code: newItemCode.toUpperCase(),
          name: description,
          description: description,
          category: 'General',
          unit: 'each',
          status: 'active'
        });
      }

      processedItems.push({
        item: item._id,
        quantityRequested: parseInt(quantity),
        notes: itemData.notes
      });
    }

    if (processedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid items to process'
      });
    }

    // Generate requisition number
    const count = await StoreRequisition.countDocuments();
    const year = new Date().getFullYear();
    const requisitionNumber = `SR-${year}-${String(count + 1).padStart(5, '0')}`;

    const siteId = await resolveSiteId(req.user, req.body.siteId);

    const requisition = await StoreRequisition.create({
      requisitionNumber,
      site: siteId,
      department: req.user!.department,
      requestedBy: req.user!._id,
      purchaseRequisition: linkedRequisition?._id,
      items: processedItems,
      purpose: requisitionPurpose,
      requiredDate: requiredDate ? new Date(requiredDate) : undefined,
      notes,
      status: 'pending'
    });

    await createAuditLog({
      action: 'create',
      entity: 'StoreRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Created store requisition ${requisition.requisitionNumber}`,
      newData: { requisitionNumber: requisition.requisitionNumber, itemsCount: processedItems.length },
      req
    });

    // Notify stores officers
    await notifyUsersByRole('stores_officer', {
      type: 'store_requisition_created',
      title: 'New Store Requisition',
      message: `A new store requisition ${requisition.requisitionNumber} has been created and requires your review.`,
      entity: 'StoreRequisition',
      entityId: requisition._id,
      relatedUser: req.user!._id,
      metadata: { requisitionNumber: requisition.requisitionNumber, itemsCount: processedItems.length }
    });

    const populatedRequisition = await StoreRequisition.findById(requisition._id)
      .populate('requestedBy', 'firstName lastName')
      .populate('site', 'code name type')
      .populate('department', 'name')
      .populate('purchaseRequisition', 'requisitionNumber title')
      .populate('items.item', 'code description unit');

    res.status(201).json({
      success: true,
      data: populatedRequisition
    });
  } catch (error: any) {
    console.error('Create store requisition error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

export default createStoreRequisition;
