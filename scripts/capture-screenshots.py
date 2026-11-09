"""Capture screenshots of the running Procureline client for the user manual.

    python scripts/capture-screenshots.py [--provision] [--cleanup] [out_dir]

Needs the API on http://localhost:3001 and the client on http://localhost:5174
(``npm run dev``; set PROCURELINE_CLIENT if the client is on another port),
with OTP_EXPOSE_IN_RESPONSE=true in api/.env so the sign-in code comes back in
the login response, as the e2e script relies on.

Signs in as the local administrator (api/src/scripts/seed-all.ts, password
Admin@123). With --provision it first creates one clearly named documentation
account per role (docs.<role>@fossil.test) and registers a documentation
supplier, all in the development unit; --cleanup soft-deletes them again at
the end. It then drives a headless Edge through the DevTools protocol and
saves one PNG per screen into ``docs/manual-screenshots``.
"""
import asyncio
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

import websockets

API = 'http://localhost:3001/api'
CLIENT = os.environ.get('PROCURELINE_CLIENT', 'http://localhost:5174')
DEBUG_PORT = 9333
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PASSWORD = 'Admin@123'
WIDTH, HEIGHT, SCALE = 1440, 900, 1

ADMIN = 'admin@fossilzim.com'

# Documentation accounts: role -> (email, first, last, role, department name or None)
DOCS_USERS = {
    'procurement': ('docs.procurement@fossil.test', 'Tendai', 'Moyo', 'procurement_officer', 'Procurement'),
    'hop': ('docs.hop@fossil.test', 'Rudo', 'Chari', 'department_head', 'Procurement'),
    'enduser': ('docs.enduser@fossil.test', 'Blessing', 'Dube', 'end_user', 'INFORMATION TECHNOLOGY'),
    'hod': ('docs.hod@fossil.test', 'Farai', 'Ncube', 'department_head', 'INFORMATION TECHNOLOGY'),
    'stores': ('docs.stores@fossil.test', 'Alfred', 'Mhlanga', 'stores_officer', 'Stores'),
    'finance': ('docs.finance@fossil.test', 'Paul', 'Kofa', 'finance', 'Finance'),
    'coo': ('docs.coo@fossil.test', 'Tino', 'Mutasa', 'coo', None),
}
DOCS_SUPPLIER = {
    'email': 'docs.supplier@fossil.test', 'password': PASSWORD, 'firstName': 'Grace', 'lastName': 'Mabika',
    'phone': '+263771234567', 'role': 'supplier',
    'supplierProfile': {
        'companyName': 'Mabika Hardware Supplies', 'tradingName': 'Mabika Hardware',
        'registrationNumber': 'DOCS-2026-0001', 'categories': ['ICT-HW'],
        'address': {'street': '12 Samora Machel Ave', 'city': 'Harare', 'province': 'Harare'},
        'bankDetails': {'bankName': 'CBZ Bank', 'accountName': 'Mabika Hardware Supplies',
                        'accountNumber': '01234567890', 'branchCode': '6101', 'accountType': 'current'},
    },
}

# (file, role, route, click-button-text or None, optional {placeholder: text} to type first)
SHOTS = [
    ('01-sign-in', None, '/', None, {'you@example.com': '', 'Enter your password': ''}),
    ('02-register', None, '/register', None),
    ('03-dashboard-procurement', 'procurement', '/app', None),
    ('04-requisitions-end-user', 'enduser', '/app/requisitions', None),
    ('05-new-requisition', 'enduser', '/app/requisitions', 'New Requisition'),
    ('06-team-requisitions', 'hod', '/app/requisitions?view=team', None),
    ('07-stores-review', 'stores', '/app/stores-pr-review', None),
    ('08-store-requisitions', 'stores', '/app/store-requisitions', None),
    ('09-deliveries-grv', 'stores', '/app/deliveries', None),
    ('10-inventory', 'stores', '/app/inventory', None),
    ('11-stock-transfers', 'stores', '/app/stock-transfers', None),
    ('12-rfqs', 'procurement', '/app/rfqs', None),
    ('13-create-rfq', 'procurement', '/app/rfqs', 'Create RFQ'),
    ('14-quotations', 'procurement', '/app/quotations', None),
    ('15-authorizations', 'hop', '/app/authorizations', None),
    ('16-purchase-orders', 'procurement', '/app/purchase-orders', None),
    ('17-approvals-hop', 'hop', '/app/approvals', None),
    ('18-approvals-finance', 'finance', '/app/approvals', None),
    ('19-invoices', 'finance', '/app/invoices', None),
    ('20-payments', 'finance', '/app/payments', None),
    ('21-budgets', 'finance', '/app/budgets', None),
    ('22-approvals-coo', 'coo', '/app/approvals', None),
    ('23-suppliers', 'procurement', '/app/suppliers', None, {'Name, code or reg no...': 'Mabika'}),
    ('24-supplier-detail', 'procurement', '/app/suppliers', 'View'),
    ('25-bank-changes', 'procurement', '/app/bank-changes', None),
    ('26-evaluations', 'procurement', '/app/suppliers/evaluations', None),
    ('27-notifications', 'procurement', '/app/notifications', None),
    ('28-staff-team', 'admin', '/app/users', None, {'Search users...': 'docs.'}),
    ('29-departments', 'admin', '/app/departments', None),
    ('30-audit-logs', 'admin', '/app/audit-logs', None, {'Search description, user, IP…': 'docs'}),
    ('31-reports', 'admin', '/app/reports', None),
    ('32-supplier-dashboard', 'supplier', '/app', None),
    ('33-supplier-rfqs', 'supplier', '/app/my-rfqs', None),
    ('34-supplier-orders', 'supplier', '/app/my-purchase-orders', None),
    ('35-supplier-kys', 'supplier', '/app/my-kys', None),
    ('36-supplier-invoices', 'supplier', '/app/my-invoices', None),
    ('37-supplier-profile', 'supplier', '/app/supplier-profile', None),
    ('38-dashboard-stores', 'stores', '/app', None),
    ('39-dashboard-finance', 'finance', '/app', None),
]


def call(method: str, path: str, body=None, token=None) -> dict:
    headers = {'Accept': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    data = None
    if body is not None:
        headers['Content-Type'] = 'application/json'
        data = json.dumps(body).encode()
    req = urllib.request.Request(API + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return json.load(e)
        except Exception:
            return {'success': False, 'message': str(e)}


def sign_in(email: str):
    """Return (token, user) for a local test account, or None."""
    first = call('POST', '/auth/login', {'email': email, 'password': PASSWORD})
    otp = first.get('debugOtp')
    if not first.get('requiresOtp') or not otp:
        return None
    second = call('POST', '/auth/verify-otp', {'email': email, 'otp': str(otp)})
    token = second.get('token') or (second.get('data') or {}).get('token')
    user = second.get('user') or (second.get('data') or {}).get('user')
    return (token, user) if token else None


def provision(admin_token: str) -> None:
    deps = {d['name']: d['_id'] for d in (call('GET', '/admin/departments', token=admin_token).get('data') or [])}
    for role, (email, first, last, sys_role, dep) in DOCS_USERS.items():
        body = {'email': email, 'password': PASSWORD, 'firstName': first, 'lastName': last, 'role': sys_role,
                'department': deps.get(dep) if dep else None, 'status': 'active'}
        r = call('POST', '/admin/users', body, admin_token)
        print(f'  {role:12} {email}: {r.get("message") or ("created" if r.get("success") else r)}')
    r = call('POST', '/auth/register', DOCS_SUPPLIER)
    print(f'  {"supplier":12} {DOCS_SUPPLIER["email"]}: {r.get("message") or ("registered" if r.get("token") else r)}')


def cleanup(admin_token: str) -> None:
    wanted = {e for e, *_ in DOCS_USERS.values()} | {DOCS_SUPPLIER['email']}
    users = call('GET', '/admin/users?limit=500', token=admin_token).get('data') or []
    for u in users:
        if u.get('email') in wanted:
            r = call('DELETE', f'/admin/users/{u["_id"]}', token=admin_token)
            print(f'  removed {u["email"]}: {r.get("message") or r.get("success")}')


def ensure_edge() -> str:
    try:
        return json.load(urllib.request.urlopen(f'http://127.0.0.1:{DEBUG_PORT}/json/version'))['webSocketDebuggerUrl']
    except Exception:
        pass
    profile = os.path.join(os.environ.get('TEMP', '.'), 'procureline-shots-profile')
    subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', f'--remote-debugging-port={DEBUG_PORT}',
                      f'--user-data-dir={profile}', f'--window-size={WIDTH},{HEIGHT}', 'about:blank'],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        time.sleep(0.5)
        try:
            return json.load(urllib.request.urlopen(f'http://127.0.0.1:{DEBUG_PORT}/json/version'))['webSocketDebuggerUrl']
        except Exception:
            continue
    sys.exit('Edge did not open its debugging port')


class Cdp:
    def __init__(self, ws):
        self.ws, self.n, self.pending, self.session = ws, 0, {}, None
        self.reader = asyncio.create_task(self._read())

    async def _read(self):
        async for raw in self.ws:
            msg = json.loads(raw)
            if 'id' in msg and msg['id'] in self.pending:
                self.pending.pop(msg['id']).set_result(msg)

    async def send(self, method, params=None, session=True):
        self.n += 1
        msg = {'id': self.n, 'method': method, 'params': params or {}}
        if session and self.session:
            msg['sessionId'] = self.session
        fut = asyncio.get_event_loop().create_future()
        self.pending[self.n] = fut
        await self.ws.send(json.dumps(msg))
        reply = await asyncio.wait_for(fut, 60)
        if 'error' in reply:
            raise RuntimeError(f'{method}: {reply["error"]}')
        return reply.get('result', {})

    async def evaluate(self, expression):
        r = await self.send('Runtime.evaluate', {'expression': expression, 'returnByValue': True, 'awaitPromise': True})
        return r.get('result', {}).get('value')

    async def goto(self, url, settle=3.0):
        await self.send('Page.navigate', {'url': url})
        for _ in range(40):
            await asyncio.sleep(0.25)
            if await self.evaluate('document.readyState') == 'complete':
                break
        await asyncio.sleep(settle)

    async def screenshot(self, path):
        r = await self.send('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False})
        with open(path, 'wb') as f:
            f.write(base64.b64decode(r['data']))


TYPE_JS = """
(() => {
  const want = %s, value = %s;
  const el = [...document.querySelectorAll('input')].find(e => e.placeholder === want);
  if (!el) return 'not found';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return 'typed';
})()
"""

TIDY_JS = "document.querySelectorAll('.fixed.bottom-3.left-3').forEach(e => e.remove()); 'ok'"

CLICK_JS = """
(() => {
  const want = %s;
  const el = [...document.querySelectorAll('button, a')].find(e => e.textContent.trim() === want);
  if (!el) return 'not found';
  el.click();
  return 'clicked';
})()
"""


async def capture(sessions: dict, out_dir: str) -> int:
    ws_url = ensure_edge()
    done = 0
    async with websockets.connect(ws_url, max_size=None) as ws:
        cdp = Cdp(ws)
        target = await cdp.send('Target.createTarget', {'url': 'about:blank'}, session=False)
        attached = await cdp.send('Target.attachToTarget', {'targetId': target['targetId'], 'flatten': True}, session=False)
        cdp.session = attached['sessionId']
        await cdp.send('Page.enable')
        await cdp.send('Runtime.enable')
        await cdp.send('Emulation.setDeviceMetricsOverride',
                       {'width': WIDTH, 'height': HEIGHT, 'deviceScaleFactor': SCALE, 'mobile': False})
        await cdp.goto(CLIENT + '/', 1)

        current = object()
        for name, role, route, click, *typing in SHOTS:
            if role and role not in sessions:
                print(f'  skip {name}: no {role} session')
                continue
            if role != current:
                await cdp.goto(CLIENT + '/', 0.5)
                if role:
                    token, user = sessions[role]
                    await cdp.evaluate(
                        "localStorage.setItem('token', %s); localStorage.setItem('user', %s); "
                        "sessionStorage.setItem('splashShown', '1'); 'ok'" % (json.dumps(token), json.dumps(json.dumps(user))))
                else:
                    await cdp.evaluate("localStorage.removeItem('token'); localStorage.removeItem('user'); "
                                       "sessionStorage.setItem('splashShown', '1'); 'ok'")
                current = role
            await cdp.goto(CLIENT + route)
            for placeholder, value in (typing[0] if typing else {}).items():
                result = await cdp.evaluate(TYPE_JS % (json.dumps(placeholder), json.dumps(value)))
                print(f'  type into "{placeholder}": {result}')
            if typing:
                await asyncio.sleep(1.5)
            if click:
                result = await cdp.evaluate(CLICK_JS % json.dumps(click))
                print(f'  click "{click}": {result}')
                await asyncio.sleep(2.0)
            await cdp.evaluate(TIDY_JS)
            path = os.path.join(out_dir, name + '.png')
            await cdp.screenshot(path)
            done += 1
            print(f'  saved {path}')
        await cdp.send('Target.closeTarget', {'targetId': target['targetId']}, session=False)
        cdp.reader.cancel()
    return done


def main(argv: list[str]) -> int:
    do_provision = '--provision' in argv
    do_cleanup = '--cleanup' in argv
    cleanup_only = '--cleanup-only' in argv
    rest = [a for a in argv if not a.startswith('--')]
    out_dir = rest[0] if rest else 'docs/manual-screenshots'
    os.makedirs(out_dir, exist_ok=True)

    admin = sign_in(ADMIN)
    if not admin:
        sys.exit(f'cannot sign in as {ADMIN}: is the API running with OTP_EXPOSE_IN_RESPONSE=true?')
    if do_provision:
        print('provisioning documentation accounts')
        provision(admin[0])

    if cleanup_only:
        cleanup(admin[0])
        return 0

    sessions = {'admin': admin}
    for role, (email, *_rest) in DOCS_USERS.items():
        s = sign_in(email)
        if s:
            sessions[role] = s
        else:
            print(f'no session for {role} ({email})')
    s = sign_in(DOCS_SUPPLIER['email'])
    if s:
        sessions['supplier'] = s
    else:
        print(f'no session for supplier ({DOCS_SUPPLIER["email"]})')

    done = asyncio.run(capture(sessions, out_dir))
    print(f'{done} screenshots in {out_dir}')

    if do_cleanup:
        print('removing documentation accounts')
        cleanup(admin[0])
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
