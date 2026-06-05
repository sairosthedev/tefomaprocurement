import getMyProfile from './getMyProfile.controller.js';
import updateProfile from './updateProfile.controller.js';
import getMyRFQs from './getMyRFQs.controller.js';
import getRFQById from './getRFQById.controller.js';
import submitQuotation from './submitQuotation.controller.js';
import getMyQuotations from './getMyQuotations.controller.js';
import getMyPurchaseOrders from './getMyPurchaseOrders.controller.js';
import acknowledgePurchaseOrder from './acknowledgePurchaseOrder.controller.js';
import getMyDeliveries from './getMyDeliveries.controller.js';
import submitInvoice from './submitInvoice.controller.js';
import getMyInvoices from './getMyInvoices.controller.js';
import uploadKysDocument from './uploadKysDocument.controller.js';
import deleteKysDocument from './deleteKysDocument.controller.js';

export default {
  getMyProfile,
  updateProfile,
  uploadKysDocument,
  deleteKysDocument,
  getMyRFQs,
  getRFQById,
  submitQuotation,
  getMyQuotations,
  getMyPurchaseOrders,
  acknowledgePurchaseOrder,
  getMyDeliveries,
  submitInvoice,
  getMyInvoices
};
