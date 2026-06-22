/** Canonical Tefoma branding — used in emails, OTP, and system copy. */
export const DEFAULT_COMPANY_NAME = 'Tefoma Construction';
export const DEFAULT_PRODUCT_NAME = 'Tefoma Procurement';
export const DEFAULT_CLIENT_URL = 'https://fossilprocure.vercel.app';

export function getCompanyName(): string {
  return process.env.COMPANY_NAME?.trim() || DEFAULT_COMPANY_NAME;
}

export function getProductName(): string {
  return process.env.PRODUCT_NAME?.trim() || DEFAULT_PRODUCT_NAME;
}

/** Full name for email footers and formal copy, e.g. "Tefoma Construction". */
export function getBrandLabel(): string {
  return getCompanyName();
}

export function getClientUrl(): string {
  return (process.env.CLIENT_URL || DEFAULT_CLIENT_URL).replace(/\/$/, '');
}

export function getAppUrl(): string {
  return `${getClientUrl()}/app`;
}

/** Email subject suffix, e.g. "Requisition Approved — Tefoma Procurement". */
export function brandSubject(title: string): string {
  return `${title} — ${getProductName()}`;
}

export function getEmailFromAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    `${getProductName()} <notifications@miccstechnologies.co.zw>`
  );
}
