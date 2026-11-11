/**
 * The two business units the QA Testing Guide allows testing on, their
 * addresses, test accounts and the goods each one buys.
 *
 * Every account's password is Test@1234 (override with QA_PASSWORD).
 * An @dokuma.test address only works on the Dokuma address, and an
 * @fossil.test address only on Fossil.
 */
const PASSWORD = process.env.QA_PASSWORD || 'Test@1234';
const API_URL = (process.env.QA_API_URL || 'https://api.sourceline.co.zw').replace(/\/$/, '');

const UNITS = {
  dokuma: {
    key: 'dokuma',
    name: 'Dokuma',
    code: 'DOKUMA',
    baseURL: process.env.DOKUMA_URL || 'https://dokuma.sourceline.co.zw',
    currency: 'USD',
    accounts: {
      requester: 'requester@dokuma.test',
      requester2: 'requester2@dokuma.test',
      head: 'icthead@dokuma.test',
      otherHead: 'opshead@dokuma.test',
      stores: 'stores@dokuma.test',
      buyer: 'buyer@dokuma.test',
      procHead: 'prochead@dokuma.test',
      finance: 'finance@dokuma.test',
      coo: 'coo@dokuma.test',
      admin: 'admin@dokuma.test'
    },
    departments: { requester: 'ICT', requester2: 'Operations' },
    // The three suppliers the main run-through quotes as. The first one wins.
    quotingSuppliers: [
      { company: 'TechZone Hardware', email: 'techzone@dokuma.test' },
      { company: 'CodeBridge Solutions', email: 'codebridge@dokuma.test' },
      { company: 'ProFix Maintenance', email: 'profix@dokuma.test' }
    ],
    otherSuppliers: [
      { company: 'NetLink Telecom', email: 'netlink@dokuma.test' },
      { company: 'Zimplow Industrial Supplies', email: 'zimplow@dokuma.test' },
      { company: 'SafeGuard Safety Equipment', email: 'safeguard@dokuma.test' }
    ],
    // What the main run-through asks for: 4 laptops.
    item: {
      search: 'laptop',
      newItemName: 'Laptop 14in business notebook',
      quantity: 4,
      unit: 'Each',
      category: 'Computers, Printers, Photocopiers & Networking Equipment',
      package: 'Box',
      specification: 'Core i5, 16GB RAM, 512GB SSD'
    }
  },
  fossil: {
    key: 'fossil',
    name: 'Fossil Contracting',
    code: 'FOSSIL',
    baseURL: process.env.FOSSIL_URL || 'https://fossil.sourceline.co.zw',
    currency: 'USD',
    accounts: {
      requester: 'requester@fossil.test',
      requester2: 'requester2@fossil.test',
      head: 'projhead@fossil.test',
      otherHead: 'planthead@fossil.test',
      stores: 'stores@fossil.test',
      buyer: 'buyer@fossil.test',
      procHead: 'prochead@fossil.test',
      finance: 'finance@fossil.test',
      coo: 'coo@fossil.test',
      admin: 'admin@fossil.test'
    },
    departments: { requester: 'Contracts & Projects', requester2: 'Plant & Equipment' },
    quotingSuppliers: [
      { company: 'Mutare Quarry & Aggregates', email: 'mutarequarry@fossil.test' },
      { company: 'Hunyani Sand & Stone', email: 'hunyanisand@fossil.test' },
      { company: 'Zimbabwe Cement Supplies', email: 'zimcement@fossil.test' }
    ],
    otherSuppliers: [
      { company: 'SafeGuard Safety Equipment', email: 'safeguard@fossil.test' },
      { company: 'Timberline Lumber & Boards', email: 'timberline@fossil.test' }
    ],
    // What the main run-through asks for in Fossil: 200 bags of cement.
    item: {
      search: 'cement',
      newItemName: 'Portland cement 42.5N 50kg bag',
      quantity: 200,
      unit: 'Bag',
      category: 'Construction Materials & Aggregates',
      package: 'Bag',
      specification: 'CEM II 42.5N, 50kg'
    }
  }
};

/** The unit a Playwright project runs against. */
function unitFor(testInfo) {
  const key = testInfo.project.metadata?.unit || testInfo.project.name;
  const unit = UNITS[key];
  if (!unit) throw new Error(`No business unit is configured for project "${testInfo.project.name}"`);
  return unit;
}

/** Everyone the COO limit is checked against: USD 5,000 by default. */
const COO_LIMIT_USD = Number(process.env.QA_COO_LIMIT || 5000);

module.exports = { UNITS, PASSWORD, API_URL, COO_LIMIT_USD, unitFor };
