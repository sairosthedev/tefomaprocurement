"""Run one complete purchase through the local API and screenshot every step for the manual.

    python scripts/walkthrough-screenshots.py [--keep] [--cleanup-only] [out_dir]

Needs the API on http://localhost:3001 and the client on http://localhost:5174
(``npm run dev``) with OTP_EXPOSE_IN_RESPONSE=true, exactly like
capture-screenshots.py, whose helpers this reuses. It creates clearly named
temporary accounts (guide.<role>@fossil.test), a "Projects Office" department
with a budget, and three supplier registrations; activates the suppliers
through the two-person flow; then drives a requisition from draft to payment
and evaluation, screenshotting each role's screen before and after its step.
The records it creates stay (they are ordinary test records, titled
"Laptops for the projects office"); the accounts and the department are
soft-deleted at the end unless --keep is given.
"""
import asyncio
import importlib
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
cap = importlib.import_module('capture-screenshots')
call, sign_in, ensure_edge, Cdp, CLIENT, PASSWORD = cap.call, cap.sign_in, cap.ensure_edge, cap.Cdp, cap.CLIENT, cap.PASSWORD
TYPE_JS, TIDY_JS = cap.TYPE_JS, cap.TIDY_JS

ADMIN = 'admin@fossilzim.com'
DEPT = {'name': 'Projects Office', 'code': 'GUIDE', 'description': 'Projects office (manual walkthrough)'}
USERS = {
    'enduser': ('guide.enduser@fossil.test', 'Blessing', 'Dube', 'end_user', 'dept'),
    'hod': ('guide.hod@fossil.test', 'Farai', 'Ncube', 'department_head', 'dept'),
    'stores': ('guide.stores@fossil.test', 'Alfred', 'Mhlanga', 'stores_officer', 'Stores'),
    'procurement': ('guide.procurement@fossil.test', 'Tendai', 'Moyo', 'procurement_officer', 'Procurement'),
    'hop': ('guide.hop@fossil.test', 'Rudo', 'Chari', 'department_head', 'Procurement'),
    'finance': ('guide.finance@fossil.test', 'Paul', 'Kofa', 'finance', 'Finance'),
    'coo': ('guide.coo@fossil.test', 'Tino', 'Mutasa', 'coo', None),
}
SUPPLIERS = [
    ('s1', 'guide.supplier1@fossil.test', 'Grace', 'Mabika', 'Mabika Office Technology', 'GUIDE-2026-0001', 1250, 10),
    ('s2', 'guide.supplier2@fossil.test', 'Tatenda', 'Moyo', 'Northgate Computers', 'GUIDE-2026-0002', 1290, 14),
    ('s3', 'guide.supplier3@fossil.test', 'Linda', 'Chikomo', 'Mashonaland IT Traders', 'GUIDE-2026-0003', 1340, 7),
]
ITEM = 'Business laptop, 14-inch, 16 GB RAM'
TITLE = 'Laptops for the projects office'

CLICK_JS = """
(() => {
  const want = %s;
  const all = [...document.querySelectorAll('button, a, [role="tab"]')];
  const el = all.find(e => e.textContent.trim() === want) || all.find(e => e.textContent.trim().startsWith(want));
  if (!el) return 'not found';
  el.click();
  return 'clicked';
})()
"""


def iso(days: int = 0) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def must(label: str, r: dict, ok=None):
    good = r.get('success', True) if ok is None else ok(r)
    print(f'  {"+" if good else "!"} {label}' + ('' if good else f' — {r.get("message") or r}'))
    if not good:
        raise SystemExit(f'stopped at: {label}')
    return r


class Shots:
    def __init__(self, cdp: Cdp, sessions: dict, out_dir: str):
        self.cdp, self.sessions, self.out, self.current, self.n = cdp, sessions, out_dir, object(), 0

    async def use(self, role):
        if role == self.current:
            return
        await self.cdp.goto(CLIENT + '/', 0.5)
        if role:
            token, user = self.sessions[role]
            await self.cdp.evaluate(
                "localStorage.setItem('token', %s); localStorage.setItem('user', %s); "
                "sessionStorage.setItem('splashShown', '1'); 'ok'" % (json.dumps(token), json.dumps(json.dumps(user))))
        else:
            await self.cdp.evaluate("localStorage.removeItem('token'); localStorage.removeItem('user'); "
                                    "sessionStorage.setItem('splashShown', '1'); 'ok'")
        self.current = role

    async def take(self, name, role, route, click=None, typing=None, settle=3.0):
        await self.use(role)
        await self.cdp.goto(CLIENT + route, settle)
        for placeholder, value in (typing or {}).items():
            print(f'    type "{placeholder}":', await self.cdp.evaluate(TYPE_JS % (json.dumps(placeholder), json.dumps(value))))
        if typing:
            await asyncio.sleep(1.5)
        if click:
            for c in ([click] if isinstance(click, str) else click):
                print(f'    click "{c}":', await self.cdp.evaluate(CLICK_JS % json.dumps(c)))
                await asyncio.sleep(2.0)
        await self.cdp.evaluate(TIDY_JS)
        self.n += 1
        path = os.path.join(self.out, f'{name}.png')
        await self.cdp.screenshot(path)
        print(f'  [{self.n:02}] {name}')


def provision(admin_token: str) -> dict:
    """Create the department, users and suppliers. Returns ids by key."""
    ids = {}
    deps = {d['name']: d['_id'] for d in (call('GET', '/admin/departments', token=admin_token).get('data') or [])}
    all_deps = call('GET', '/admin/departments', token=admin_token).get('data') or []
    existing = next((d for d in all_deps if d.get('code') == DEPT['code'] or d.get('name') == DEPT['name']), None)
    if existing:
        r = {'success': True, 'data': existing, 'message': 'reused existing department'}
    else:
        r = call('POST', '/admin/departments', DEPT, admin_token)
    dept_id = (r.get('data') or {}).get('_id')
    must('department ' + DEPT['name'], {'success': bool(dept_id), 'message': r.get('message')})
    ids['dept'] = dept_id
    deps[DEPT['name']] = dept_id
    for key, (email, first, last, role, dep) in USERS.items():
        dep_id = dept_id if dep == 'dept' else (deps.get(dep) if dep else None)
        r = call('POST', '/admin/users', {'email': email, 'password': PASSWORD, 'firstName': first, 'lastName': last,
                                          'role': role, 'department': dep_id, 'status': 'active'}, admin_token)
        print(f'  user {key:12} {email}: {r.get("message") or ("created" if r.get("success") else r)}')
        if r.get('success'):
            ids[key] = (r.get('data') or {}).get('_id')
    users = call('GET', '/admin/users?limit=500', token=admin_token).get('data') or []
    for key, (email, *_r) in USERS.items():
        ids.setdefault(key, next((u['_id'] for u in users if u.get('email') == email), None))
    must('set department head', call('PUT', f'/admin/departments/{dept_id}', {'head': ids['hod']}, admin_token))
    for key, email, first, last, company, reg, _price, _days in SUPPLIERS:
        r = call('POST', '/auth/register', {
            'email': email, 'password': PASSWORD, 'firstName': first, 'lastName': last, 'phone': '+263771234567',
            'role': 'supplier',
            'supplierProfile': {'companyName': company, 'tradingName': company.split(' ')[0], 'registrationNumber': reg,
                                'categories': ['ICT-HW'],
                                'address': {'street': '12 Samora Machel Ave', 'city': 'Harare', 'province': 'Harare'},
                                'bankDetails': {'bankName': 'CBZ Bank', 'accountName': company, 'accountNumber': '0123456789',
                                                'branchCode': '6101', 'accountType': 'current'}}})
        print(f'  supplier {key:8} {company}: {r.get("message") or ("registered" if r.get("token") else r)}')
    return ids


def cleanup(admin_token: str, dept_id=None) -> None:
    wanted = {e for e, *_ in USERS.values()} | {s[1] for s in SUPPLIERS}
    for u in call('GET', '/admin/users?limit=500', token=admin_token).get('data') or []:
        if u.get('email') in wanted:
            r = call('DELETE', f'/admin/users/{u["_id"]}', token=admin_token)
            print(f'  removed {u["email"]}: {r.get("message") or r.get("success")}')
    deps = {d['name']: d['_id'] for d in (call('GET', '/admin/departments', token=admin_token).get('data') or [])}
    dep = dept_id or deps.get(DEPT['name'])
    if dep:
        r = call('DELETE', f'/admin/departments/{dep}', token=admin_token)
        print(f'  removed department {DEPT["name"]}: {r.get("message") or r.get("success")}')


async def run(out_dir: str, keep: bool) -> int:
    admin = sign_in(ADMIN)
    if not admin:
        sys.exit('cannot sign in as the administrator')
    print('provisioning')
    ids = provision(admin[0])

    tok, sessions = {}, {'admin': admin}
    for key, (email, *_r) in USERS.items():
        s = must(f'sign in {key}', {'success': bool(sign_in(email))}) and sign_in(email)
        sessions[key] = s
        tok[key] = s[0]
    for key, email, *_r in SUPPLIERS:
        s = sign_in(email)
        must(f'sign in {key}', {'success': bool(s)})
        sessions[key] = s
        tok[key] = s[0]

    # budget for the department
    must('budget set', call('PUT', '/finance/budgets', {'departmentId': ids['dept'], 'fiscalYear': datetime.now().year,
                                                         'allocatedAmount': 20000}, tok['finance']))

    ws_url = ensure_edge()
    import websockets
    async with websockets.connect(ws_url, max_size=None) as ws:
        cdp = Cdp(ws)
        target = await cdp.send('Target.createTarget', {'url': 'about:blank'}, session=False)
        attached = await cdp.send('Target.attachToTarget', {'targetId': target['targetId'], 'flatten': True}, session=False)
        cdp.session = attached['sessionId']
        await cdp.send('Page.enable')
        await cdp.send('Runtime.enable')
        await cdp.send('Emulation.setDeviceMetricsOverride', {'width': cap.WIDTH, 'height': cap.HEIGHT, 'deviceScaleFactor': 1, 'mobile': False})
        await cdp.goto(CLIENT + '/', 1)
        S = Shots(cdp, sessions, out_dir)

        # ---------- supplier activation (two people) ----------
        pending = call('GET', '/procurement/suppliers?status=pending&limit=100', token=tok['procurement']).get('data') or []
        sup_ids = {}
        for key, email, *_r in SUPPLIERS:
            sup_ids[key] = next((s['_id'] for s in pending if (s.get('user') or {}).get('email') == email), None)
            must(f'find supplier {key}', {'success': bool(sup_ids[key])})
        await S.take('w01-supplier-kys-pending', 's1', '/app/my-kys')
        await S.take('w02-supplier-detail-pending', 'procurement', f'/app/suppliers/{sup_ids["s1"]}?tab=documents')
        await S.take('w03-supplier-submit-activation', 'procurement', f'/app/suppliers/{sup_ids["s1"]}?tab=documents', click='Submit for activation')
        for key in ('s1', 's2', 's3'):
            must(f'submit {key} for activation', call('PUT', f'/procurement/suppliers/{sup_ids[key]}/kys/verify',
                 {'overrideKys': True, 'approveForActivation': True,
                  'reason': 'Walkthrough: documents received on paper, to be uploaded'}, tok['procurement']))
        await S.take('w04-suppliers-awaiting-approval', 'hop', '/app/suppliers?approval=awaiting_me')
        await S.take('w05-supplier-approve-banner', 'hop', f'/app/suppliers/{sup_ids["s1"]}')
        await S.take('w06-supplier-approve-confirm', 'hop', f'/app/suppliers/{sup_ids["s1"]}', click='Approve activation')
        for key in ('s1', 's2', 's3'):
            must(f'approve {key}', call('PUT', f'/procurement/suppliers/{sup_ids[key]}/activation/approve', {}, tok['hop']))
        await S.take('w07-supplier-active', 'hop', f'/app/suppliers/{sup_ids["s1"]}')
        await S.take('w08-supplier-kys-active', 's1', '/app/my-kys')

        # ---------- requisition ----------
        r = must('create requisition', call('POST', '/department/requisitions', {
            'title': TITLE, 'workOrder': 'WO-2026-041', 'justification': 'Four new site engineers start in January',
            'items': [{'description': ITEM, 'category': 'ICT-HW', 'quantity': 4, 'unit': 'Each', 'estimatedUnitPrice': 1000}]
        }, tok['enduser']))
        pr_id = r['data']['_id']
        await S.take('w10-requisition-draft-list', 'enduser', '/app/requisitions')
        await S.take('w11-requisition-draft-detail', 'enduser', f'/app/requisitions/{pr_id}')
        must('submit requisition', call('PUT', f'/department/requisitions/{pr_id}/submit', {}, tok['enduser']))
        await S.take('w12-requisition-pending-hod', 'enduser', '/app/requisitions')
        await S.take('w13-dashboard-hod', 'hod', '/app')
        await S.take('w14-team-requisitions', 'hod', '/app/requisitions?view=team')
        await S.take('w15-approve-requisition-modal', 'hod', '/app/requisitions?view=team', click='Approve')
        await S.take('w16-requisition-detail-hod', 'hod', f'/app/requisitions/{pr_id}')
        r = call('PUT', f'/department/requisitions/{pr_id}/approve', {'comments': 'Approved. Within the office budget.'}, tok['hod'])
        if not r.get('success'):
            r = call('PUT', f'/department/requisitions/{pr_id}/approve',
                     {'comments': 'Approved.', 'budgetOverrideReason': 'Walkthrough: replacement equipment'}, tok['hod'])
        must('HOD approves requisition', r)
        await S.take('w17-requisition-stores-review', 'enduser', f'/app/requisitions/{pr_id}')

        # ---------- stores ----------
        await S.take('w20-dashboard-stores', 'stores', '/app')
        await S.take('w21-stores-review-list', 'stores', '/app/stores-pr-review')
        await S.take('w22-stores-review-drawer', 'stores', '/app/stores-pr-review', click='Review')
        must('stores forwards', call('PUT', f'/stores/purchase-requisitions/{pr_id}/forward',
                                     {'notes': 'Not stocked — forward to procurement'}, tok['stores']))
        await S.take('w23-stores-sent-on', 'stores', '/app/stores-pr-review', click='Sent on')

        # ---------- procurement accepts, RFQ ----------
        await S.take('w30-dashboard-procurement', 'procurement', '/app')
        await S.take('w31-requisitions-pending-acceptance', 'procurement', '/app/requisitions')
        await S.take('w32-accept-requisition-modal', 'procurement', '/app/requisitions', click='Accept')
        must('procurement accepts', call('PUT', f'/procurement/requisitions/{pr_id}/accept', {'comments': 'Accepted for sourcing'}, tok['procurement']))
        r = must('create RFQ (draft)', call('POST', '/procurement/rfqs', {
            'title': TITLE, 'purchaseRequisitionId': pr_id, 'supplierIds': [sup_ids['s1'], sup_ids['s2'], sup_ids['s3']],
            'submissionDeadline': iso(7), 'deliveryRequiredBy': iso(21), 'status': 'draft',
            'description': 'Four business laptops with Windows 11 Pro and a three-year warranty.',
            'items': [{'description': ITEM, 'quantity': 4, 'unit': 'Each', 'categoryName': 'ICT Hardware'}]
        }, tok['procurement']))
        rfq_id = r['data']['_id']
        await S.take('w33-rfq-draft-detail', 'procurement', f'/app/rfqs/{rfq_id}')
        must('publish RFQ', call('PUT', f'/procurement/rfqs/{rfq_id}/publish', {}, tok['procurement']))
        await S.take('w34-rfq-open-detail', 'procurement', f'/app/rfqs/{rfq_id}')
        await S.take('w35-rfqs-list-open', 'procurement', '/app/rfqs')
        await S.take('w36-quotations-sealed', 'procurement', '/app/quotations')

        # ---------- suppliers quote ----------
        await S.take('w40-supplier-dashboard', 's1', '/app')
        await S.take('w41-supplier-my-rfqs', 's1', '/app/my-rfqs')
        await S.take('w42-supplier-rfq-detail', 's1', f'/app/my-rfqs/{rfq_id}')
        await S.take('w43-supplier-submit-quote-drawer', 's1', f'/app/my-rfqs/{rfq_id}', click='Submit Quote')
        quotes = {}
        for key, email, first, last, company, reg, price, days in SUPPLIERS:
            r = must(f'{key} quotes', call('POST', '/supplier/quotations', {
                'rfqId': rfq_id, 'validityPeriod': 30, 'deliveryPeriod': days, 'paymentTerms': 'Net 30', 'currency': 'USD',
                'items': [{'description': ITEM, 'quantity': 4, 'unit': 'Each', 'unitPrice': price, 'totalPrice': price * 4,
                           'vatIncluded': False, 'brand': 'Lenovo ThinkPad' if key != 's3' else 'HP EliteBook'}]
            }, tok[key]))
            quotes[key] = r['data']['_id']
        await S.take('w44-supplier-submitted-quotations', 's1', '/app/my-submitted-quotations')

        # ---------- close, rank, select, authorise, accept ----------
        must('close RFQ', call('PUT', f'/procurement/rfqs/{rfq_id}/close', {}, tok['procurement']))
        await S.take('w50-rfq-closed-ranking', 'procurement', f'/app/rfqs/{rfq_id}')
        await S.take('w51-quotations-revealed', 'procurement', '/app/quotations')
        await S.take('w52-quotation-detail-before-selection', 'procurement', f'/app/quotations/{quotes["s1"]}')
        must('select winner', call('PUT', f'/procurement/rfqs/{rfq_id}/select-quotation',
                                   {'quotationId': quotes['s1'], 'justification': 'Lowest price, 10-day delivery, same specification as requested'}, tok['procurement']))
        await S.take('w53-authorizations-queue', 'hop', '/app/authorizations')
        await S.take('w54-quotation-detail-authorize', 'hop', f'/app/quotations/{quotes["s1"]}')
        must('HoP authorises', call('PUT', f'/procurement/rfqs/{rfq_id}/authorize-quotation',
                                    {'quotationId': quotes['s1'], 'comments': 'Authorised'}, tok['hop']))
        await S.take('w55-quotation-fully-authorized', 'procurement', f'/app/quotations/{quotes["s1"]}')
        must('accept quotation', call('PUT', f'/procurement/quotations/{quotes["s1"]}/accept', {'comments': 'Accepted'}, tok['procurement']))
        await S.take('w56-quotation-accepted', 'procurement', f'/app/quotations/{quotes["s1"]}')
        await S.take('w57-supplier-quote-not-selected', 's2', '/app/my-submitted-quotations')

        # ---------- purchase order and approvals ----------
        r = must('create PO', call('POST', '/procurement/purchase-orders',
                                   {'quotationId': quotes['s1'], 'expectedDeliveryDate': iso(14), 'notes': 'Deliver to the projects office, ground floor'}, tok['procurement']))
        po_id, po_total = r['data']['_id'], r['data'].get('totalAmount')
        await S.take('w60-po-draft-detail', 'procurement', f'/app/purchase-orders/{po_id}')
        must('submit PO', call('PUT', f'/procurement/purchase-orders/{po_id}/submit', {}, tok['procurement']))
        await S.take('w61-po-list-pending', 'procurement', '/app/purchase-orders')
        await S.take('w62-approvals-hop', 'hop', '/app/approvals')
        await S.take('w63-approvals-hop-review-modal', 'hop', '/app/approvals', click='Review')
        po = call('GET', f'/procurement/purchase-orders/{po_id}', token=tok['procurement']).get('data') or {}
        path = 'proc-approve' if po.get('status') == 'pending_proc_hod' else 'approve'
        must('HoP approves PO', call('PUT', f'/department/purchase-orders/{po_id}/{path}', {'comments': 'Approved'}, tok['hop']))
        await S.take('w64-dashboard-finance', 'finance', '/app')
        await S.take('w65-approvals-finance', 'finance', '/app/approvals')
        await S.take('w66-approvals-finance-review-modal', 'finance', '/app/approvals', click='Review')
        must('Finance approves PO', call('PUT', f'/finance/purchase-orders/{po_id}/approve', {'comments': 'Approved'}, tok['finance']))
        po = call('GET', f'/procurement/purchase-orders/{po_id}', token=tok['procurement']).get('data') or {}
        if po.get('status') == 'pending_coo':
            await S.take('w67-dashboard-coo', 'coo', '/app')
            await S.take('w68-approvals-coo', 'coo', '/app/approvals')
            await S.take('w69-approvals-coo-review-modal', 'coo', '/app/approvals', click='Review')
            must('COO approves PO', call('PUT', f'/coo/purchase-orders/{po_id}/approve', {'comments': 'Approved'}, tok['coo']))
        else:
            print(f'  (PO total {po_total} below the COO limit; COO stage skipped)')
        await S.take('w70-po-approved-detail', 'procurement', f'/app/purchase-orders/{po_id}')
        await S.take('w71-requisition-ordered', 'enduser', f'/app/requisitions/{pr_id}')

        # ---------- supplier acknowledges ----------
        await S.take('w72-supplier-po-list', 's1', '/app/my-purchase-orders')
        await S.take('w73-supplier-acknowledge-modal', 's1', '/app/my-purchase-orders', click='Acknowledge')
        must('supplier acknowledges', call('PUT', f'/supplier/purchase-orders/{po_id}/acknowledge',
                                           {'deliveryNoteNumber': 'DN-2026-0187', 'expectedDeliveryDate': iso(7)}, tok['s1']))
        await S.take('w74-supplier-po-acknowledged', 's1', '/app/my-purchase-orders')
        await S.take('w75-supplier-deliveries-pending', 's1', '/app/my-deliveries')

        # ---------- goods receipt ----------
        await S.take('w80-deliveries-awaiting', 'stores', '/app/deliveries')
        await S.take('w81-receive-goods-wizard', 'stores', '/app/deliveries', click='Receive')
        po = call('GET', f'/procurement/purchase-orders/{po_id}', token=tok['procurement']).get('data') or {}
        r = must('stores receives (GRV)', call('POST', '/stores/deliveries', {
            'purchaseOrderId': po_id, 'deliveryNoteNumber': 'DN-2026-0187', 'deliveryDate': iso(0),
            'deliveredBy': {'name': 'Kudakwashe Banda', 'idNumber': '63-123456-A-42', 'vehicleRegistration': 'AEX 4471', 'contactNumber': '+263 77 555 0199'},
            'items': [{'poItem': it['_id'], 'quantityReceived': it['quantity'], 'quantityRejected': 0, 'condition': 'good'} for it in po.get('items', [])]
        }, tok['stores']))
        delivery_id, dstatus = r['data']['_id'], r['data'].get('status')
        await S.take('w82-deliveries-received', 'stores', '/app/deliveries')
        await S.take('w83-grv-details-modal', 'stores', '/app/deliveries', click='View')
        if dstatus != 'accepted':
            must('stores accepts delivery', call('PUT', f'/stores/deliveries/{delivery_id}/accept', {'status': 'accepted', 'notes': 'All four in good condition'}, tok['stores']))
        await S.take('w84-inventory-after-receipt', 'stores', '/app/inventory')
        await S.take('w85-supplier-delivery-accepted', 's1', '/app/my-deliveries')
        await S.take('w86-stock-movements', 'stores', '/app/stock-movements')

        # ---------- invoice, match, payment ----------
        await S.take('w90-supplier-invoices-empty', 's1', '/app/my-invoices')
        await S.take('w91-supplier-submit-invoice-drawer', 's1', '/app/my-invoices', click='Submit invoice')
        r = must('supplier invoices', call('POST', '/supplier/invoices', {
            'purchaseOrderId': po_id, 'vendorInvoiceNumber': 'INV-2026-0442', 'invoiceDate': iso(0),
            'items': [{'description': it['description'], 'quantity': it['quantity'], 'unitPrice': it['unitPrice'], 'totalPrice': it['totalPrice'], 'poItemIndex': i}
                      for i, it in enumerate(po.get('items', []))],
            'vatAmount': po.get('vatAmount') or 0
        }, tok['s1']))
        inv_id, inv_status = r['data']['_id'], r['data'].get('status')
        await S.take('w92-supplier-invoice-submitted', 's1', '/app/my-invoices')
        await S.take('w93-invoices-finance', 'finance', '/app/invoices')
        await S.take('w94-invoice-three-way-match', 'finance', f'/app/invoices/{inv_id}')
        must('finance approves invoice', call('PUT', f'/finance/invoices/{inv_id}/approve',
                                              {'comments': 'Matched', 'forceApprove': inv_status == 'variance'}, tok['finance']))
        await S.take('w95-invoice-approved', 'finance', f'/app/invoices/{inv_id}')
        must('finance records payment', call('POST', '/finance/payments', {
            'invoiceIds': [inv_id], 'paymentDate': iso(0), 'paymentMethod': 'bank_transfer', 'reference': 'TT-2026-11-0063', 'complete': True
        }, tok['finance']))
        await S.take('w96-payments-list', 'finance', '/app/payments')
        await S.take('w97-supplier-invoice-paid', 's1', '/app/my-invoices', click='View')
        await S.take('w98-budgets-after', 'finance', '/app/budgets')

        # ---------- evaluation, completion ----------
        await S.take('w100-evaluations-due', 'procurement', '/app/suppliers/evaluations')
        await S.take('w101-evaluate-drawer', 'procurement', '/app/suppliers/evaluations', click='Evaluate')
        must('evaluation recorded', call('POST', f'/procurement/suppliers/{sup_ids["s1"]}/evaluations', {
            'evaluationType': 'initial', 'recommendation': 'approve',
            'scores': {'creditTerms': 4, 'contractualAgreements': 3, 'marketReputation': 4, 'pricing': 5, 'deliveryEfficiency': 5,
                       'easeInDealings': 4, 'consistentQuality': 4, 'otherNotes': 'Delivered early, all units as specified'}
        }, tok['procurement']))
        await S.take('w102-supplier-performance', 'procurement', f'/app/suppliers/{sup_ids["s1"]}?tab=performance')
        await S.take('w103-requisition-completed', 'enduser', f'/app/requisitions/{pr_id}')
        await S.take('w104-notifications-enduser', 'enduser', '/app/notifications')
        await S.take('w105-audit-logs', 'admin', '/app/audit-logs', typing={'Search description, user, IP…': 'guide'})
        await S.take('w106-reports-overview', 'admin', '/app/reports')
        await S.take('w107-dashboard-enduser', 'enduser', '/app')

        await cdp.send('Target.closeTarget', {'targetId': target['targetId']}, session=False)
        cdp.reader.cancel()

    print(f'{S.n} screenshots in {out_dir}')
    if not keep:
        print('removing temporary accounts and department')
        cleanup(admin[0], ids.get('dept'))
    return 0


def main(argv):
    keep = '--keep' in argv
    rest = [a for a in argv if not a.startswith('--')]
    out_dir = rest[0] if rest else 'docs/manual-screenshots'
    os.makedirs(out_dir, exist_ok=True)
    if '--cleanup-only' in argv:
        admin = sign_in(ADMIN)
        cleanup(admin[0])
        return 0
    return asyncio.run(run(out_dir, keep))


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
