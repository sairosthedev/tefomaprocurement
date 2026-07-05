/**
 * Probe all API GET routes using an admin session.
 * Usage: node api/src/scripts/smoke-test-admin-probe.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'https://fosssil-procure-api.vercel.app').replace(/\/$/, '');
const API = `${BASE}/api`;

const GET_ROUTES = [
  '/',
  '/auth/me',
  '/dashboard/stats',
  '/notifications',
  '/notifications/unread-count',
  '/sites',
  '/admin/users',
  '/admin/departments',
  '/admin/sites',
  '/admin/audit-logs',
  '/procurement/evaluations/due',
  '/procurement/evaluations',
  '/procurement/supplier-reports',
  '/procurement/suppliers',
  '/procurement/requisitions',
  '/procurement/rfqs',
  '/procurement/quotations',
  '/procurement/purchase-orders',
  '/procurement/purchase-orders/cancellation-meta',
  '/department/requisitions',
  '/department/requisitions/cancellation-meta',
  '/department/catalog-items?q=a',
  '/department/store-requisitions',
  '/department/pending-po-approvals',
  '/department/evaluations/pending',
  '/finance/pending-approvals',
  '/finance/purchase-orders',
  '/finance/invoices',
  '/finance/payments',
  '/finance/budgets',
  '/coo/pending-approvals',
  '/stores/inventory',
  '/stores/deliveries',
  '/stores/pending-deliveries',
  '/stores/purchase-requisitions/pending',
  '/stores/movements',
  '/stores/requisitions',
  '/stores/transfers',
  '/stores/sites',
  '/supplier/profile'
];

async function request(method, path, token, body) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

async function adminLogin() {
  const login = await request('POST', '/auth/login', null, {
    email: 'admin@fossilzim.com',
    password: 'Admin@123'
  });
  if (!login.data?.debugOtp) throw new Error('Admin login failed — no debugOtp');
  const verify = await request('POST', '/auth/verify-otp', null, {
    email: 'admin@fossilzim.com',
    otp: String(login.data.debugOtp)
  });
  if (!verify.data?.token) throw new Error('OTP verify failed');
  return verify.data.token;
}

async function main() {
  console.log(`Admin probe: ${BASE}\n`);
  const token = await adminLogin();
  console.log('Admin session OK\n');

  let pass = 0, warn = 0, fail = 0;
  for (const path of GET_ROUTES) {
    const res = await request('GET', path, token);
    const ok = res.status === 200;
    const forbidden = res.status === 403;
    const icon = ok ? '✓' : forbidden ? '!' : '✗';
    const label = ok ? 'OK' : forbidden ? '403 (role)' : `FAIL ${res.status}`;
    console.log(`${icon} ${label.padEnd(12)} GET ${path}`);
    if (ok) pass++;
    else if (forbidden) warn++;
    else fail++;
  }

  console.log(`\nOK: ${pass}  Role-blocked: ${warn}  Fail: ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
