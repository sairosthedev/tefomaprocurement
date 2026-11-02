/**
 * Full-system API smoke test.
 * Usage: node api/src/scripts/smoke-test.mjs [baseUrl]
 * Default baseUrl: https://fosssil-procure-api.vercel.app
 */
const BASE = (process.argv[2] || 'https://fosssil-procure-api.vercel.app').replace(/\/$/, '');
const API = `${BASE}/api`;
const PASSWORD = 'Admin@123';

const ACCOUNTS = [
  { role: 'admin', email: 'admin@fossilzim.com' },
  { role: 'procurement_officer', email: 'macdonald@fossilzim.com' },
  { role: 'department_head (Procurement)', email: 'jb@fossilzim.com' },
  { role: 'department_head (ICT)', email: 'mac@fossilzim.com' },
  { role: 'end_user', email: 'james@fossilzim.com' },
  { role: 'finance', email: 'paul@fossilzim.com' },
  { role: 'coo', email: 'tino@fossilzim.com' },
  { role: 'stores_officer', email: 'alfred@fossilzim.com' },
  { role: 'supplier', email: 'ict.hw@techzone.co.zw' }
];

const ROLE_ENDPOINTS = {
  admin: [
    '/admin/users',
    '/admin/departments',
    '/admin/sites',
    '/admin/audit-logs'
  ],
  procurement_officer: [
    '/procurement/suppliers',
    '/procurement/requisitions',
    '/procurement/rfqs',
    '/procurement/quotations',
    '/procurement/purchase-orders',
    '/procurement/evaluations/due',
    '/procurement/evaluations',
    '/procurement/supplier-reports'
  ],
  'department_head (Procurement)': [
    '/department/requisitions',
    '/department/pending-po-approvals',
    '/department/store-requisitions',
    '/department/catalog-items?q=test'
  ],
  'department_head (ICT)': [
    '/department/requisitions',
    '/department/pending-po-approvals',
    '/department/store-requisitions'
  ],
  end_user: [
    '/department/requisitions',
    '/department/catalog-items?q=test',
    '/department/requisitions/cancellation-meta'
  ],
  finance: [
    '/finance/pending-approvals',
    '/finance/purchase-orders',
    '/finance/invoices',
    '/finance/payments',
    '/finance/budgets'
  ],
  coo: ['/coo/pending-approvals'],
  stores_officer: [
    '/stores/inventory',
    '/stores/deliveries',
    '/stores/pending-deliveries',
    '/stores/purchase-requisitions/pending',
    '/stores/movements',
    '/stores/requisitions',
    '/stores/transfers',
    '/stores/sites'
  ],
  supplier: [
    '/supplier/profile',
    '/supplier/rfqs',
    '/supplier/quotations',
    '/supplier/purchase-orders',
    '/supplier/deliveries',
    '/supplier/invoices'
  ]
};

const SHARED_AUTHENTICATED = ['/dashboard/stats', '/notifications', '/notifications/unread-count', '/sites'];

const results = { pass: 0, fail: 0, skip: 0, items: [] };

function record(name, ok, detail = '') {
  const status = ok ? 'PASS' : 'FAIL';
  if (ok) results.pass++;
  else results.fail++;
  results.items.push({ status, name, detail });
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} ${status}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function request(method, path, { token, body, origin } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  if (origin) headers.Origin = origin;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { status: res.status, data, headers: res.headers };
}

async function login(email) {
  const loginRes = await request('POST', '/auth/login', {
    body: { email, password: PASSWORD }
  });

  if (loginRes.status !== 200 || !loginRes.data?.requiresOtp) {
    return { error: `login ${loginRes.status}: ${loginRes.data?.message || 'unexpected'}` };
  }

  const otp = loginRes.data.debugOtp;
  if (!otp) {
    return { error: 'no debugOtp in response (set OTP_EXPOSE_IN_RESPONSE on API or use email OTP manually)' };
  }

  const verifyRes = await request('POST', '/auth/verify-otp', {
    body: { email, otp: String(otp) }
  });

  if (verifyRes.status !== 200 || !verifyRes.data?.token) {
    return { error: `verify-otp ${verifyRes.status}: ${verifyRes.data?.message || 'unexpected'}` };
  }

  return { token: verifyRes.data.token, user: verifyRes.data.user };
}

async function testPublic() {
  console.log('\n=== Public / unauthenticated ===');

  const health = await fetch(`${BASE}/health`);
  record('GET /health', health.status === 200, `status ${health.status}`);

  const root = await request('GET', '/');
  record('GET /api/', root.status === 200 && root.data?.success, `status ${root.status}`);

  const badLogin = await request('POST', '/auth/login', { body: { email: 'x@y.com', password: 'wrong' } });
  record('POST /auth/login invalid creds → 401', badLogin.status === 401, `status ${badLogin.status}`);

  const emptyLogin = await request('POST', '/auth/login', { body: {} });
  record('POST /auth/login missing fields → 400', emptyLogin.status === 400, `status ${emptyLogin.status}`);

  const noAuth = await request('GET', '/auth/me');
  record('GET /auth/me without token → 401', noAuth.status === 401, `status ${noAuth.status}`);

  const cors = await fetch(`${API}/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://fossilprocure.vercel.app',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type'
    }
  });
  const allowOrigin = cors.headers.get('access-control-allow-origin');
  record(
    'OPTIONS /auth/login CORS for fossilprocure.vercel.app',
    cors.status === 204 && allowOrigin === 'https://fossilprocure.vercel.app',
    `status ${cors.status}, origin=${allowOrigin || 'missing'}`
  );
}

async function testRole(account) {
  console.log(`\n=== Role: ${account.role} (${account.email}) ===`);

  const session = await login(account.email);
  if (session.error) {
    record(`${account.role} login`, false, session.error);
    results.skip += (ROLE_ENDPOINTS[account.role]?.length || 0) + SHARED_AUTHENTICATED.length;
    return;
  }

  record(`${account.role} login + OTP`, true);

  const me = await request('GET', '/auth/me', { token: session.token });
  record(`${account.role} GET /auth/me`, me.status === 200, `status ${me.status}`);

  for (const path of SHARED_AUTHENTICATED) {
    const res = await request('GET', path, { token: session.token });
    record(`${account.role} GET ${path}`, res.status === 200, `status ${res.status}`);
  }

  const paths = ROLE_ENDPOINTS[account.role] || [];
  for (const path of paths) {
    const res = await request('GET', path, { token: session.token });
    const ok = res.status === 200 && res.data?.success !== false;
    record(`${account.role} GET ${path}`, ok, `status ${res.status}`);
  }
}

async function testCrossRoleDenial() {
  console.log('\n=== Cross-role access (expect 403) ===');

  const endUser = await login('james@fossilzim.com');
  if (endUser.error) {
    record('cross-role setup', false, endUser.error);
    return;
  }

  const denied = await request('GET', '/admin/users', { token: endUser.token });
  record('end_user GET /admin/users → 403', denied.status === 403, `status ${denied.status}`);
}

async function main() {
  console.log(`Smoke test target: ${BASE}`);
  console.log(`Started: ${new Date().toISOString()}`);

  await testPublic();

  for (const account of ACCOUNTS) {
    await testRole(account);
  }

  await testCrossRoleDenial();

  console.log('\n=== Summary ===');
  console.log(`PASS: ${results.pass}  FAIL: ${results.fail}  SKIP: ${results.skip}`);
  console.log(`Finished: ${new Date().toISOString()}`);

  if (results.fail > 0) {
    console.log('\nFailed checks:');
    results.items.filter((i) => i.status === 'FAIL').forEach((i) => console.log(`  - ${i.name}: ${i.detail}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
