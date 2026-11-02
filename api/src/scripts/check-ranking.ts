/**
 * Exercise the RFQ ranking arithmetic against fixtures.
 *
 *     npm run check:ranking --workspace=api
 *
 * Calls the pure `scoreResponses`, so no database is involved and this is safe
 * to run anywhere. The weights decide which supplier is recommended for company
 * money, so the cases that would be embarrassing to get wrong are pinned here:
 * who wins, what refuses to rank at all, and what can never be recommended.
 *
 * Exits non-zero on the first failing expectation, so it can gate a deploy.
 */
import { scoreResponses } from '../services/quotationRanking.service.js';
import { dedupeByCompany, distinctCompetitors } from '../services/supplierInvitation.service.js';

/** A fixture lookup that must hit. Fails loudly rather than reading as
 *  `undefined` and producing a confusingly-passing comparison. */
function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`fixture lookup failed: ${what}`);
  return value;
}

/** The named criterion's score on a ranked response. */
function criterion(response: any, key: string): any {
  return must(
    response.scores.find((s: any) => s.key === key),
    `criterion ${key}`
  );
}

/** The ranked response for a named supplier. */
function bySupplier(ranking: any, name: string): any {
  return must(
    ranking.responses.find((r: any) => r.supplierName === name),
    `response from ${name}`
  );
}

/** The one response marked recommended. */
function recommended(ranking: any): any {
  return must(
    ranking.responses.find((r: any) => r.recommended),
    'a recommended response'
  );
}

let pass = 0;
let fail = 0;

function check(label: string, actual: any, expected: any) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass += 1;
    console.log(`  ok    ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}\n          expected ${JSON.stringify(expected)}\n          actual   ${JSON.stringify(actual)}`);
  }
}

// Two-line RFQ.
const rfq: any = {
  _id: 'rfq1',
  rfqNumber: 'RFQ-2026-00001',
  items: [{ _id: 'L1', description: 'Laptop', quantity: 4 }, { _id: 'L2', description: 'Dock', quantity: 4 }],
  invitedSuppliers: [{ supplier: 's1' }, { supplier: 's2' }, { supplier: 's3' }]
};

const activeSupplier = (id: string, name: string) => ({
  _id: id,
  companyName: name,
  status: 'active',
  kysComplete: true,
  transactability: 'spend_authorized',
  isDeleted: false
});

const quote = (
  id: string,
  supplier: any,
  total: number,
  deliveryPeriod: number | undefined,
  lines: any[],
  extra: Record<string, any> = {}
) => ({
  _id: id,
  quotationNumber: `QT-${id}`,
  supplier,
  totalAmount: total,
  currency: 'USD',
  deliveryPeriod,
  items: lines,
  ...extra
});

const bothLines = (price: number) => [
  { rfqLineId: 'L1', description: 'Laptop', unitPrice: price, quantity: 4 },
  { rfqLineId: 'L2', description: 'Dock', unitPrice: price / 4, quantity: 4 }
];

console.log('\ncheapest and fastest wins outright');
{
  const r = scoreResponses(
    rfq,
    [
      quote('a', activeSupplier('s1', 'TechZone'), 4000, 7, bothLines(800)),
      quote('b', activeSupplier('s2', 'CodeBridge'), 5000, 14, bothLines(1000))
    ],
    new Map()
  );
  check('ranks 2 responses', r.responses.length, 2);
  check('cheapest is rank 1', must(r.responses[0], 'rank 1').supplierName, 'TechZone');
  check('cheapest recommended', must(r.responses[0], 'rank 1').recommended, true);
  check('price points are full for cheapest', criterion(r.responses[0], 'price').weighted, 50);
  check('dearer gets 80% of price points', criterion(r.responses[1], 'price').weighted, 40);
  check('percent above lowest', must(r.responses[1], 'rank 2').percentAboveLowest, 25);
  check('spread', r.spreadPercent, 25);
  check('unrated performance is the neutral default, not zero', criterion(r.responses[0], 'performance').weighted, 12);
  check('unrated flagged as assumed', criterion(r.responses[0], 'performance').assumed, true);
}

console.log('\na slightly dearer but much faster, better-rated supplier can win');
{
  const r = scoreResponses(
    rfq,
    [
      quote('a', activeSupplier('s1', 'Cheap&Slow'), 4000, 60, bothLines(800)),
      quote('b', activeSupplier('s2', 'Quick&Good'), 4100, 5, bothLines(820))
    ],
    new Map([['s2', 5]])
  );
  check('faster, better-rated wins', must(r.responses[0], 'rank 1').supplierName, 'Quick&Good');
  check('and is recommended', must(r.responses[0], 'rank 1').recommended, true);
  check('reason names the lowest-priced alternative', must(must(r.responses[0], 'rank 1').recommendationReason, 'recommendation reason').includes('Cheap&Slow'), true);
  check('reason states the premium', must(must(r.responses[0], 'rank 1').recommendationReason, 'recommendation reason').includes('2.5%'), true);
  check('reason states the days gained', must(must(r.responses[0], 'rank 1').recommendationReason, 'recommendation reason').includes('55 days faster'), true);
}

console.log('\na materially cheaper bid is NOT displaced by a better-liked supplier');
{
  const r = scoreResponses(
    rfq,
    [
      quote('a', activeSupplier('s1', 'Cheap'), 4000, 10, bothLines(800)),
      quote('b', activeSupplier('s2', 'Beloved'), 7000, 10, bothLines(1400))
    ],
    new Map([['s2', 5], ['s1', 1]])
  );
  check('cheapest still wins on a 75% price gap', must(r.responses[0], 'rank 1').supplierName, 'Cheap');
}

console.log('\npartial response is ranked but never recommended');
{
  const r = scoreResponses(
    rfq,
    [
      quote('a', activeSupplier('s1', 'HalfQuote'), 1000, 3, [
        { rfqLineId: 'L1', description: 'Laptop', unitPrice: 250, quantity: 4 }
      ]),
      quote('b', activeSupplier('s2', 'FullQuote'), 5000, 20, bothLines(1000))
    ],
    new Map()
  );
  const half = bySupplier(r, 'HalfQuote');
  check('partial scores top on price and speed', half.rank, 1);
  check('partial is not complete', half.isComplete, false);
  check('partial lines quoted', half.linesQuoted, 1);
  check('partial is not recommended', half.recommended, false);
  check('partial says why', half.disqualifiers[0].includes('Priced 1 of 2 lines'), true);
  check('the complete quote is recommended instead', recommended(r).supplierName, 'FullQuote');
}

console.log('\nzero-priced lines count as not quoted');
{
  const r = scoreResponses(
    rfq,
    [
      quote('a', activeSupplier('s1', 'Skipper'), 1000, 5, [
        { rfqLineId: 'L1', description: 'Laptop', unitPrice: 250, quantity: 4 },
        { rfqLineId: 'L2', description: 'Dock', unitPrice: 0, quantity: 4 }
      ])
    ],
    new Map()
  );
  check('zero-priced line not counted', must(r.responses[0], 'rank 1').linesQuoted, 1);
  check('so the response is incomplete', must(r.responses[0], 'rank 1').isComplete, false);
}

console.log('\nmixed currency refuses to rank');
{
  const r = scoreResponses(
    rfq,
    [
      quote('a', activeSupplier('s1', 'UsdCo'), 4000, 7, bothLines(800)),
      quote('b', activeSupplier('s2', 'ZarCo'), 70000, 7, bothLines(14000), { currency: 'ZAR' })
    ],
    new Map()
  );
  check('flags mixed currency', r.mixedCurrency, true);
  check('lists both currencies', r.currencies.sort(), ['USD', 'ZAR']);
  check('scores nothing', r.responses.every((x: any) => x.score === 0), true);
  check('recommends nobody', r.recommendedQuotationId, undefined);
  check('says why', must(r.responses[0], 'rank 1').disqualifiers[0].includes('more than one currency'), true);
}

console.log('\nan ineligible supplier is ranked but cannot be recommended');
{
  const pending = { _id: 's1', companyName: 'NoKys', status: 'pending', kysComplete: false, isDeleted: false };
  const r = scoreResponses(
    rfq,
    [
      quote('a', pending, 4000, 5, bothLines(800)),
      quote('b', activeSupplier('s2', 'Proper'), 6000, 20, bothLines(1200))
    ],
    new Map()
  );
  const bad = bySupplier(r, 'NoKys');
  check('cheapest+fastest is rank 1', bad.rank, 1);
  check('but flagged not awardable', bad.notAwardable, true);
  check('and not recommended', bad.recommended, false);
  check('eligible supplier recommended instead', recommended(r).supplierName, 'Proper');
}

console.log('\nexpired validity blocks a recommendation');
{
  const r = scoreResponses(
    rfq,
    [
      quote('a', activeSupplier('s1', 'Lapsed'), 4000, 5, bothLines(800), {
        validUntil: new Date(Date.now() - 86400000)
      }),
      quote('b', activeSupplier('s2', 'Valid'), 6000, 20, bothLines(1200), {
        validUntil: new Date(Date.now() + 86400000)
      })
    ],
    new Map()
  );
  const lapsed = bySupplier(r, 'Lapsed');
  check('expired flagged', lapsed.expired, true);
  check('expired not recommended', lapsed.recommended, false);
  check('valid one recommended', recommended(r).supplierName, 'Valid');
}

console.log('\nno responses, and the all-disqualified case');
{
  const empty = scoreResponses(rfq, [], new Map());
  check('no responses ranks nothing', empty.responses.length, 0);
  check('and recommends nobody', empty.recommendedQuotationId, undefined);

  const allBad = scoreResponses(
    rfq,
    [quote('a', activeSupplier('s1', 'Partial'), 1000, 5, [
      { rfqLineId: 'L1', description: 'Laptop', unitPrice: 250, quantity: 4 }
    ])],
    new Map()
  );
  check('every response disqualified means no recommendation', allBad.recommendedQuotationId, undefined);
  check('but it is still ranked and shown', allBad.responses.length, 1);
}

console.log('\nlegacy quotes with no rfqLineId match by description');
{
  const r = scoreResponses(
    rfq,
    [
      quote('a', activeSupplier('s1', 'Legacy'), 4000, 7, [
        { description: 'laptop', unitPrice: 800, quantity: 4 },
        { description: '  DOCK ', unitPrice: 200, quantity: 4 }
      ])
    ],
    new Map()
  );
  check('description match, case and space insensitive', must(r.responses[0], 'rank 1').linesQuoted, 2);
  check('so it counts as complete', must(r.responses[0], 'rank 1').isComplete, true);
}

console.log('\nunstated delivery period scores zero, not full marks');
{
  const r = scoreResponses(
    rfq,
    [
      quote('a', activeSupplier('s1', 'NoLeadTime'), 4000, undefined, bothLines(800)),
      quote('b', activeSupplier('s2', 'Stated'), 4000, 10, bothLines(800))
    ],
    new Map()
  );
  const vague = bySupplier(r, 'NoLeadTime');
  check('unstated delivery earns no delivery points', criterion(vague, 'delivery').weighted, 0);
  check('so the supplier who stated one ranks first', must(r.responses[0], 'rank 1').supplierName, 'Stated');
}

console.log('\nduplicate supplier records collapse to one competitor');
{
  const m = (id: string, companyName: string, extra: Record<string, any> = {}) => ({
    supplier: { _id: id, companyName, status: 'active', kysComplete: true, ...extra },
    matchType: 'exact' as const,
    matchedCategories: ['ICT-SW'],
    matchedCategoryNames: ['ICT software'],
    notYetActivated: false
  });

  // Same registration number is the same legal entity: one record survives.
  const byReg = dedupeByCompany([
    m('a', 'CodeBridge Solutions', { registrationNumber: '1234/2020' }),
    m('b', 'Codebridge Solutions (Pvt) Ltd', { registrationNumber: ' 1234/2020 ' })
  ]);
  check('same registration number collapses', byReg.unique.length, 1);
  check('and the collapse is reported', byReg.collapsed.length, 1);

  // Same name, DIFFERENT registration numbers — the real Dokuma case. Both are
  // kept, because dropping a possibly-genuine supplier is the worse error, but
  // they count as one competitor so the three-quote rule is not satisfied by it.
  const sameName = dedupeByCompany([
    m('a', 'CodeBridge Solutions', { registrationNumber: 'DEMO-SW-002' }),
    m('b', 'CodeBridge Solutions', { registrationNumber: 'ICT-2024-002' })
  ]);
  check('both records are kept', sameName.unique.length, 2);
  check('nothing was dropped', sameName.collapsed.length, 0);
  check('but it is flagged as a suspected duplicate', sameName.suspectedDuplicates.length, 1);
  check(
    'and names both registration numbers',
    must(sameName.suspectedDuplicates[0], 'flagged duplicate').registrationNumbers,
    ['DEMO-SW-002', 'ICT-2024-002']
  );
  check('and counts as ONE competitor, not two', distinctCompetitors(sameName.unique), 1);

  // Differently-named firms are separate competitors even if related.
  check(
    'different names count separately',
    distinctCompetitors([
      m('a', 'NetLink Telecom', { registrationNumber: '1/1' }),
      m('b', 'NetLink Telecom Zimbabwe', { registrationNumber: '2/2' })
    ]),
    2
  );

  // No registration number: fall back to the normalised name.
  const byName = dedupeByCompany([
    m('a', 'CodeBridge  Solutions'),
    m('b', 'codebridge solutions')
  ]);
  check('normalised name collapses', byName.unique.length, 1);

  // Different companies are left alone.
  const distinct = dedupeByCompany([
    m('a', 'TechZone', { registrationNumber: '1/2020' }),
    m('b', 'CodeBridge', { registrationNumber: '2/2020' })
  ]);
  check('distinct companies both kept', distinct.unique.length, 2);
  check('and nothing reported collapsed', distinct.collapsed.length, 0);

  // The awardable record survives, not merely the first one seen.
  const pickBest = dedupeByCompany([
    m('weak', 'ProFix', { registrationNumber: '9/2020', status: 'pending', kysComplete: false }),
    m('strong', 'ProFix', { registrationNumber: '9/2020', status: 'active', kysComplete: true })
  ]);
  check(
    'the awardable record is the one kept',
    must(pickBest.unique[0], 'survivor').supplier._id,
    'strong'
  );

  // A company matched under two codes keeps both reasons.
  const merged = dedupeByCompany([
    {
      ...m('a', 'NetLink', { registrationNumber: '5/2020' }),
      matchedCategories: ['ICT-TELECOM'],
      matchedCategoryNames: ['Telecoms']
    },
    {
      ...m('b', 'NetLink', { registrationNumber: '5/2020' }),
      matchedCategories: ['ICT-RADIO'],
      matchedCategoryNames: ['Radio']
    }
  ]);
  check(
    'both matched codes are kept on the survivor',
    must(merged.unique[0], 'survivor').matchedCategories.sort(),
    ['ICT-RADIO', 'ICT-TELECOM']
  );
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
