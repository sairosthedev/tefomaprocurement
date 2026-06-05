/**
 * FC-HQ-P-07 §6.2.3 — Know Your Supplier (KYS) requirements
 */
export const KYS_DOCUMENT_TYPES = Object.freeze({
  COMPANY_REGISTRATION_CR14: 'company_registration_cr14',
  REGISTERED_ADDRESS_CR6: 'registered_address_cr6',
  TAX_CLEARANCE: 'tax_clearance',
  NSSA_COMPLIANCE: 'nssa_compliance',
  NEC_REGISTRATION: 'nec_registration',
  INDUSTRY_LICENCE: 'industry_licence',
  ISO_CERTIFICATION: 'iso_certification',
  COMPANY_PROFILE: 'company_profile',
  CLIENT_REFERRAL: 'client_referral',
  AUDITED_FINANCIALS: 'audited_financials',
  BANK_REFERENCE: 'bank_reference',
  INSURANCE: 'insurance',
  ENVIRONMENTAL_POLICY: 'environmental_policy',
  SAFETY_RECORDS: 'safety_records',
  DISASTER_PREPAREDNESS: 'disaster_preparedness',
  OTHER: 'other'
} as const);

export type KysDocumentType = (typeof KYS_DOCUMENT_TYPES)[keyof typeof KYS_DOCUMENT_TYPES];

export const KYS_CHECKLIST_ITEMS = Object.freeze([
  { key: 'cr14Directors', label: 'Valid company registration — CR14 (List of Directors)', required: true, section: '6.2.3(a)' },
  { key: 'cr6Address', label: 'Valid registered address — CR6', required: true, section: '6.2.3(a)' },
  { key: 'taxClearance', label: 'Valid TAX clearance certificate', required: true, section: '6.2.3(b)' },
  { key: 'nssaCompliance', label: 'NSSA compliance certificate', required: true, section: '6.2.3(c)' },
  { key: 'necRegistration', label: 'NEC registration (if applicable)', required: false, section: '6.2.3(d)' },
  { key: 'industryLicences', label: 'Industry-specific licences (if applicable)', required: false, section: '6.2.3(e)' },
  { key: 'isoCertification', label: 'ISO certifications (preferred)', required: false, section: '6.2.3(f)' },
  { key: 'companyProfile', label: 'Company profile (experience, projects, equipment, workforce)', required: true, section: '6.2.3(g)' },
  { key: 'clientReferrals', label: 'Referrals from at least 3 previous clients', required: true, section: '6.2.3(h)' },
  { key: 'auditedFinancials', label: 'Audited financial statements (past 3 years)', required: true, section: '6.2.3(i)' },
  { key: 'bankReferences', label: 'Bank references and creditworthiness', required: true, section: '6.2.3(j)' },
  { key: 'paymentTerms', label: 'Payment terms and credit facilities', required: true, section: '6.2.3(k)' },
  { key: 'liquidityRatios', label: 'Liquidity ratios and financial stability', required: true, section: '6.2.3(l)' },
  { key: 'warranties', label: 'Warranties and guarantees offered', required: true, section: '6.2.3(m)' },
  { key: 'afterSalesSupport', label: 'After-sales support and training provisions', required: true, section: '6.2.3(n)' },
  { key: 'sampleTesting', label: 'Sample testing (for product suppliers)', required: false, section: '6.2.3(o)' },
  { key: 'safetyRecords', label: 'Safety records', required: true, section: '6.2.3(p)' },
  { key: 'environmentalPolicy', label: 'Environmental policies', required: true, section: '6.2.3(q)' },
  { key: 'insuranceCoverage', label: 'Insurance coverage', required: true, section: '6.2.3(r)' },
  { key: 'disasterPreparedness', label: 'Disaster preparedness plan', required: true, section: '6.2.3(s)' }
] as const);

export type KysChecklistKey = (typeof KYS_CHECKLIST_ITEMS)[number]['key'];

/**
 * Document-backed KYS requirements. Each entry maps an uploadable document
 * type to the checklist key it satisfies, so uploading a document can
 * auto-tick the corresponding checklist item. `required` mirrors the
 * mandatory/optional split in §6.2.3.
 */
export const KYS_DOCUMENT_REQUIREMENTS = Object.freeze([
  { documentType: 'company_registration_cr14', label: 'Company Registration — CR14 (List of Directors)', checklistKey: 'cr14Directors', required: true, section: '6.2.3(a)' },
  { documentType: 'registered_address_cr6', label: 'Registered Address — CR6', checklistKey: 'cr6Address', required: true, section: '6.2.3(a)' },
  { documentType: 'tax_clearance', label: 'Tax Clearance Certificate', checklistKey: 'taxClearance', required: true, section: '6.2.3(b)' },
  { documentType: 'nssa_compliance', label: 'NSSA Compliance Certificate', checklistKey: 'nssaCompliance', required: true, section: '6.2.3(c)' },
  { documentType: 'nec_registration', label: 'NEC Registration', checklistKey: 'necRegistration', required: false, section: '6.2.3(d)' },
  { documentType: 'industry_licence', label: 'Industry-specific Licence(s)', checklistKey: 'industryLicences', required: false, section: '6.2.3(e)' },
  { documentType: 'iso_certification', label: 'ISO Certification(s)', checklistKey: 'isoCertification', required: false, section: '6.2.3(f)' },
  { documentType: 'company_profile', label: 'Company Profile', checklistKey: 'companyProfile', required: true, section: '6.2.3(g)' },
  { documentType: 'client_referral', label: 'Client Referrals (3 previous clients)', checklistKey: 'clientReferrals', required: true, section: '6.2.3(h)' },
  { documentType: 'audited_financials', label: 'Audited Financial Statements (past 3 years)', checklistKey: 'auditedFinancials', required: true, section: '6.2.3(i)' },
  { documentType: 'bank_reference', label: 'Bank Reference / Creditworthiness', checklistKey: 'bankReferences', required: true, section: '6.2.3(j)' },
  { documentType: 'safety_records', label: 'Safety Records', checklistKey: 'safetyRecords', required: true, section: '6.2.3(p)' },
  { documentType: 'environmental_policy', label: 'Environmental Policy', checklistKey: 'environmentalPolicy', required: true, section: '6.2.3(q)' },
  { documentType: 'insurance', label: 'Insurance Coverage', checklistKey: 'insuranceCoverage', required: true, section: '6.2.3(r)' },
  { documentType: 'disaster_preparedness', label: 'Disaster Preparedness Plan', checklistKey: 'disasterPreparedness', required: true, section: '6.2.3(s)' }
] as const);

const DOC_TYPE_TO_CHECKLIST: Readonly<Record<string, string>> = Object.freeze(
  KYS_DOCUMENT_REQUIREMENTS.reduce((acc, req) => {
    acc[req.documentType] = req.checklistKey;
    return acc;
  }, {} as Record<string, string>)
);

/** Returns the checklist key a given document type satisfies (if any). */
export function getChecklistKeyForDocType(documentType: string): string | undefined {
  return DOC_TYPE_TO_CHECKLIST[documentType];
}

/** True if the document type is one of the recognised KYS document types. */
export function isKnownKysDocumentType(documentType: string): boolean {
  return Object.prototype.hasOwnProperty.call(DOC_TYPE_TO_CHECKLIST, documentType);
}

/** FC-HQ-P-07 §6.3.11 — COO authorization required above this amount (USD) */
export const COO_APPROVAL_THRESHOLD_USD = 5000;

/** FC-HQ-P-07 §6.3.3 — minimum competitive quotations required */
export const MIN_QUOTATIONS_REQUIRED = 3;

/** FC-HQ-P-07 §6.2.4 — Supplier evaluation criteria */
export const SUPPLIER_EVALUATION_CRITERIA = Object.freeze([
  { key: 'creditTerms', label: 'Provides products/services on credit' },
  { key: 'contractualAgreements', label: 'Existing contractual agreements' },
  { key: 'marketReputation', label: 'Market reputation' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'deliveryEfficiency', label: 'Efficiency in delivery' },
  { key: 'easeInDealings', label: 'Ease in dealings' },
  { key: 'consistentQuality', label: 'Consistent quality' }
] as const);

export function computeKysCompletion(checklist: Record<string, boolean | undefined>): {
  requiredTotal: number;
  requiredComplete: number;
  optionalTotal: number;
  optionalComplete: number;
  percentComplete: number;
  isComplete: boolean;
} {
  const required = KYS_CHECKLIST_ITEMS.filter((i) => i.required);
  const optional = KYS_CHECKLIST_ITEMS.filter((i) => !i.required);

  const requiredComplete = required.filter((i) => checklist[i.key]).length;
  const optionalComplete = optional.filter((i) => checklist[i.key]).length;

  return {
    requiredTotal: required.length,
    requiredComplete,
    optionalTotal: optional.length,
    optionalComplete,
    percentComplete: Math.round((requiredComplete / required.length) * 100),
    isComplete: requiredComplete === required.length
  };
}
