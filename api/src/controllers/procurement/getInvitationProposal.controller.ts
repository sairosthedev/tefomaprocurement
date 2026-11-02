import type { Request, Response } from 'express';

import { proposeInvitations, proposeInvitationsForRequisition } from '../../services/supplierInvitation.service.js';

/**
 * GET the proposed invitation list for an RFQ about to be raised.
 *
 * Takes either `requisitionId` (categories read from its line items) or an
 * explicit comma-separated `categories` list.
 *
 * `proposed` is what the screen should pre-tick: exact category matches, topped
 * up from related categories to the competitive minimum. `additional` is the
 * rest of the related tree, offered unticked so widening competition stays a
 * deliberate act. Both are editable — the officer is accountable for who was
 * invited, and may know things the category tree does not.
 *
 * This runs server-side for the same reason supplierMatch does: the earlier
 * client-side matching only saw the first page of suppliers, so anyone past it
 * was silently never suggested.
 */
const getInvitationProposal = async (req: Request, res: Response): Promise<any> => {
  try {
    const { requisitionId, categories, siteId } = req.query as Record<string, any>;

    const proposal = requisitionId
      ? await proposeInvitationsForRequisition(requisitionId, { siteId })
      : await proposeInvitations(
          String(categories || '')
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
          { siteId }
        );

    if (proposal.requestedCategories.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          'Provide either a requisitionId whose lines carry categories, or an explicit categories list.'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...proposal,
        proposedCount: proposal.proposed.length,
        additionalCount: proposal.additional.length
      }
    });
  } catch (error: any) {
    console.error('Get invitation proposal error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default getInvitationProposal;
