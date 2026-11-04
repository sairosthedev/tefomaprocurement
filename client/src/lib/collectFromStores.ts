import api, { departmentAPI } from './api';

/** Store requisition statuses still on the way to being issued. */
export const OPEN_STORE_REQUISITION = ['draft', 'pending', 'approved'];

export const storeRequisitionStatusLabel: Record<string, string> = {
  draft: 'Draft',
  pending: 'With stores',
  approved: 'Ready to collect',
  partially_issued: 'Partly collected',
  issued: 'Collected',
  rejected: 'Rejected by stores',
  cancelled: 'Cancelled'
};

/**
 * Raise a store requisition to collect an IR's delivered goods. It carries the
 * IR's id, so the IR shows the store requisition and the store requisition
 * shows the IR. Returns the new store requisition.
 */
export async function requestDeliveredItems(requisition: any): Promise<any> {
  // The list leaves out PO line items, so load them from the requisition.
  let order = requisition.purchaseOrder;
  if (!order?.items) {
    const detail = await api.get(`/department/requisitions/${requisition._id}`);
    order = detail.data?.data?.purchaseOrder || order;
  }

  // Only what has actually arrived in stores.
  const items = (order?.items || [])
    .map((poItem: any) => ({
      description: poItem.description,
      quantity: poItem.quantityReceived || 0,
      unit: poItem.unit || 'Each'
    }))
    .filter((item: any) => item.quantity > 0);

  if (items.length === 0) {
    throw new Error('Nothing has been delivered yet. Please wait for delivery confirmation.');
  }

  const res = await departmentAPI.createStoreRequisition({
    purchaseRequisitionId: requisition._id,
    purpose: `Collect delivered items from ${order?.poNumber || 'the purchase order'} for ${requisition.requisitionNumber}`,
    items
  });
  return res.data.data;
}
