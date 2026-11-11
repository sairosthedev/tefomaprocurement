/**
 * Test data that is unique to one run.
 *
 * The QA Testing Guide asks every tester to start each title with "QA" and
 * their initials so records are easy to find among other testers' work. The
 * run id keeps two runs by the same tester apart, and lets a later role find
 * exactly the record an earlier role created.
 */
const INITIALS = (process.env.QA_INITIALS || 'PW').toUpperCase();

function runId() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${pad(now.getMonth() + 1)}${pad(now.getDate())}-` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

/** A title such as "QA-PW 1111-142530 laptops for new hires". */
function qaTitle(text, id = runId()) {
  return `QA-${INITIALS} ${id} ${text}`;
}

/** Round to cents, the way the app shows money. */
function money(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Every way the app may print an amount: "1,234.50", "1 234,50" (en-ZA),
 * "1234.50". Used to assert a figure appears without depending on the
 * locale's grouping character.
 */
function amountPattern(n) {
  const fixed = money(n).toFixed(2);
  const [whole, cents] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '[,\\s\\u00a0\\u202f]?');
  return new RegExp(`${grouped}[.,]${cents}`);
}

/** Matches either of two amounts, e.g. a total before or after VAT. */
function eitherAmountPattern(a, b) {
  return new RegExp(`(${amountPattern(a).source})|(${amountPattern(b).source})`);
}

/** The next Tuesday or Thursday on or after a date, as YYYY-MM-DD (payment runs). */
function nextPaymentRunDate(from = new Date()) {
  const d = new Date(from);
  while (![2, 4].includes(d.getDay())) d.setDate(d.getDate() + 1);
  return toIsoDate(d);
}

function toIsoDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A value for an <input type="datetime-local">, some days ahead. */
function datetimeLocalInDays(days, hour = 16) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${toIsoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * A document number such as PR-2026-00012. Some carry the unit's code in
 * front (DOKUMA-QT-2026-00003), so that part is optional.
 */
function docNumberPattern(prefix, { anchored = false } = {}) {
  const body = `(?:[A-Z]+-)?${prefix}-\\d{4}-\\d+`;
  return new RegExp(anchored ? `^${body}$` : body);
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  INITIALS,
  runId,
  qaTitle,
  money,
  amountPattern,
  eitherAmountPattern,
  nextPaymentRunDate,
  toIsoDate,
  datetimeLocalInDays,
  escapeRegExp,
  docNumberPattern
};
