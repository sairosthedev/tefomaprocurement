import type { Request, Response } from 'express';
import { PurchaseRequisition } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { resolveSiteId } from '../../lib/siteScope.js';
import {
  checkItemAvailability,
  suggestAction
} from '../../services/inventoryAvailability.service.js';

const createRequisition = async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      title,
      description, // Used as justification
      urgency, // Maps to priority
      items,
      justification,
      priority,
      requiredDate,
      notes,
      status
    } = req.body;

    // Validate required fields
    if (!title && !items?.length) {
      return res.status(400).json({
        success: false,
        message: 'Title and at least one item are required'
      });
    }

    // Calculate estimated prices and process items
    const siteId = await resolveSiteId(req.user, req.body.siteId);

    const processedItems: any[] = [];
    for (const item of items || []) {
      const line: any = {
        item: item.item || item.itemId,
        description: item.description,
        category: item.category,
        specification: item.specification || item.specifications,
        quantity: item.quantity || 1,
        unit: item.unit || 'Each',
        estimatedUnitPrice: item.estimatedUnitPrice || 0,
        estimatedTotalPrice: item.estimatedUnitPrice
          ? item.estimatedUnitPrice * item.quantity
          : 0
      };

      if (line.item) {
        const { atSite, elsewhere, total } = await checkItemAvailability(line.item, siteId);
        const suggestion = suggestAction(line.quantity, { atSite, elsewhere });
        line.storeAvailability = {
          available: total >= line.quantity,
          quantityAvailable: total,
          quantityAtSite: suggestion.quantityAtSite,
          quantityAtOtherSites: suggestion.quantityAtOtherSites,
          suggestedAction: suggestion.suggestedAction,
          checkedAt: new Date()
        };
      }

      processedItems.push(line);
    }

    // Generate requisition number
    const count = await PurchaseRequisition.countDocuments();
    const year = new Date().getFullYear();
    const requisitionNumber = `PR-${year}-${String(count + 1).padStart(5, '0')}`;

    // Map urgency to priority if needed
    let mappedPriority = priority || 'medium';
    if (urgency === 'high') mappedPriority = 'high';
    else if (urgency === 'normal') mappedPriority = 'medium';

    const requisition = await PurchaseRequisition.create({
      requisitionNumber,
      title: title || 'Untitled Requisition',
      site: siteId,
      department: req.user!.department || null,
      requestedBy: req.user!._id,
      items: processedItems,
      justification: justification || description || '',
      priority: mappedPriority,
      requiredDate: requiredDate ? new Date(requiredDate) : undefined,
      notes,
      status: status === 'pending' ? 'pending_hod' : 'draft'
    });

    await createAuditLog({
      action: 'create',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Created requisition: ${requisition.requisitionNumber}`,
      newData: { title, itemCount: processedItems.length, priority: mappedPriority },
      req
    });

    res.status(201).json({
      success: true,
      data: requisition
    });
  } catch (error: any) {
    console.error('Create requisition error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

export default createRequisition;
