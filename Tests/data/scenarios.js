const { qaTitle, runId, money, amountPattern, datetimeLocalInDays, INITIALS } = require('../utils/testData');
const { COO_LIMIT_USD } = require('./units');

/**
 * Everything one main run-through enters, built once so every later role can
 * assert it sees exactly what an earlier role typed.
 *
 * `band` is 'above' (order of USD 5,000 or more: Head of Procurement, Finance,
 * then COO) or 'below' (the COO step is skipped). The guide asks for the run
 * to be done once each way.
 */
function buildRunThrough(unit, band) {
  const id = runId();
  const item = unit.item;
  const qty = item.quantity;

  // The winning unit price puts the order on the chosen side of the limit.
  const targetTotal = band === 'above' ? COO_LIMIT_USD * 1.2 : COO_LIMIT_USD * 0.5;
  const winningUnitPrice = money(targetTotal / qty);
  const [winner, second, third] = unit.quotingSuppliers;
  const quotes = [
    { ...winner, unitPrice: winningUnitPrice, deliveryDays: 5, paymentTerms: 'Net 30', validDays: 30 },
    { ...second, unitPrice: money(winningUnitPrice * 1.1), deliveryDays: 7, paymentTerms: 'Net 14', validDays: 21 },
    { ...third, unitPrice: money(winningUnitPrice * 1.2), deliveryDays: 10, paymentTerms: 'Net 60', validDays: 14 }
  ].map((q) => ({
    ...q,
    total: money(q.unitPrice * qty),
    totalPattern: amountPattern(q.unitPrice * qty),
    unitPricePattern: amountPattern(q.unitPrice),
    notes: `${q.company} quote for ${id}: price held for ${q.validDays} days`
  }));

  // A new item named for this run, so stores must categorise it and every
  // screen can be searched for exactly this line.
  const line = {
    description: qaTitle(item.newItemName, id),
    quantity: qty,
    unit: item.unit,
    package: item.package,
    specification: item.specification,
    estimatedUnitPrice: winningUnitPrice,
    category: item.category
  };

  const what = unit.key === 'fossil' ? `${qty} bags of cement` : `${qty} laptops for new hires`;
  return {
    id,
    band,
    unit,
    requisition: {
      title: qaTitle(`${what} (${band} COO limit)`, id),
      description: `Raised by Playwright run ${id}. ${what} for the ${unit.departments.requester} department.`,
      workOrder: `WO-${INITIALS}-${id}`,
      urgency: 'normal',
      items: [line]
    },
    line,
    rfq: {
      description: `Please quote for ${what}. Run ${id}.`,
      terms: `Delivery to the ${unit.name} main store. Run ${id}.`,
      deadline: datetimeLocalInDays(3)
    },
    quotes,
    winner: quotes[0],
    justification: `Lowest price and fastest delivery (${quotes[0].deliveryDays} days). Run ${id}.`,
    po: {
      notes: `PO notes for run ${id}`,
      terms: `Payment ${quotes[0].paymentTerms} from invoice. Run ${id}.`
    },
    delivery: {
      deliveryNote: `DN-${id}`,
      deliveredBy: 'Tinashe Moyo',
      vehicle: 'AEB 1234',
      witnesses: { mt: 'Rudo Banda', security: 'Farai Dube', sheq: 'Nyasha Phiri' },
      acceptNotes: `All items in good condition. Run ${id}.`
    },
    collection: { name: 'Tapiwa Ncube', employeeNo: `EMP-${id}`, department: unit.departments.requester, phone: '0772000000' },
    invoice: { vendorInvoiceNumber: `SUP-INV-${id}` },
    evaluation: {
      scores: [4, 3, 4, 5, 5, 4, 4],
      recommendation: 'Approve',
      notes: `Delivered on time for run ${id}.`
    },
    requiresCoo: band === 'above'
  };
}

module.exports = { buildRunThrough };
