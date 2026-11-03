import type { Request, Response } from 'express';

import { RFQ, Quotation } from '../../models/index.js';

/** What a row on the RFQ list shows, plus each invitation's supplier and
 *  whether they responded (the list counts invitations). */
const RFQ_LIST_FIELDS = [
  'rfqNumber', 'title', 'status', 'site', 'purchaseRequisition', 'createdBy',
  'submissionDeadline', 'publishedAt', 'closedAt', 'splitAward', 'createdAt', 'updatedAt',
  'invitedSuppliers.supplier', 'invitedSuppliers.responded'
].join(' ');

const getRFQs = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query as Record<string, any>;
    
    const query: any = { isDeleted: false };
    
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { rfqNumber: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const [rfqs, total] = await Promise.all([
      // A list row, not the RFQ: line items (and their photos), the award
      // trail and each invitation's audit detail stay with GET /rfqs/:id.
      RFQ.find(query)
        .select(RFQ_LIST_FIELDS)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      RFQ.countDocuments(query)
    ]);

    // Attach the number of bids received per RFQ (count only, no values).
    // Counted while the references populate, since both need only the ids.
    if (rfqs.length > 0) {
      const [, counts] = await Promise.all([
        RFQ.populate(rfqs, [
          { path: 'createdBy', select: 'firstName lastName', options: { lean: true } },
          { path: 'purchaseRequisition', select: 'requisitionNumber', options: { lean: true } },
          { path: 'invitedSuppliers.supplier', select: 'companyName', options: { lean: true } }
        ]),
        Quotation.aggregate([
          {
            $match: {
              rfq: { $in: rfqs.map((r) => r._id) },
              status: { $in: ['submitted', 'under_review', 'accepted', 'rejected'] },
              isDeleted: false
            }
          },
          { $group: { _id: '$rfq', count: { $sum: 1 } } }
        ])
      ]);
      const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));
      rfqs.forEach((r) => {
        (r as any).bidCount = countMap.get(r._id.toString()) || 0;
      });
    }

    res.status(200).json({
      success: true,
      data: rfqs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Get RFQs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getRFQs;
