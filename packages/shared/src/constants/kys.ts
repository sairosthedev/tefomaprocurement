/**
 * Know Your Supplier (KYS) requirements
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
  { key: 'cr14Directors', label: 'Valid company registration — CR14 (List of Directors)', required: true, section: 'Registration & Statutory' },
  { key: 'cr6Address', label: 'Valid registered address — CR6', required: true, section: 'Registration & Statutory' },
  { key: 'taxClearance', label: 'Valid TAX clearance certificate', required: true, section: 'Tax Compliance' },
  { key: 'nssaCompliance', label: 'NSSA compliance certificate', required: true, section: 'Statutory Compliance' },
  { key: 'necRegistration', label: 'NEC registration (if applicable)', required: false, section: 'Statutory Compliance' },
  { key: 'industryLicences', label: 'Industry-specific licences (if applicable)', required: false, section: 'Licences & Certifications' },
  { key: 'isoCertification', label: 'ISO certifications (preferred)', required: false, section: 'Licences & Certifications' },
  { key: 'companyProfile', label: 'Company profile (experience, projects, equipment, workforce)', required: true, section: 'Company Capability' },
  { key: 'clientReferrals', label: 'Referrals from at least 3 previous clients', required: true, section: 'Company Capability' },
  { key: 'auditedFinancials', label: 'Audited financial statements (past 3 years)', required: true, section: 'Financial Standing' },
  { key: 'bankReferences', label: 'Bank references and creditworthiness', required: true, section: 'Financial Standing' },
  { key: 'paymentTerms', label: 'Payment terms and credit facilities', required: true, section: 'Financial Standing' },
  { key: 'liquidityRatios', label: 'Liquidity ratios and financial stability', required: true, section: 'Financial Standing' },
  { key: 'warranties', label: 'Warranties and guarantees offered', required: true, section: 'Commercial & Operations' },
  { key: 'afterSalesSupport', label: 'After-sales support and training provisions', required: true, section: 'Commercial & Operations' },
  { key: 'sampleTesting', label: 'Sample testing (for product suppliers)', required: false, section: 'Commercial & Operations' },
  { key: 'safetyRecords', label: 'Safety records', required: true, section: 'Health, Safety & Environment' },
  { key: 'environmentalPolicy', label: 'Environmental policies', required: true, section: 'Health, Safety & Environment' },
  { key: 'insuranceCoverage', label: 'Insurance coverage', required: true, section: 'Health, Safety & Environment' },
  { key: 'disasterPreparedness', label: 'Disaster preparedness plan', required: true, section: 'Health, Safety & Environment' }
] as const);

export type KysChecklistKey = (typeof KYS_CHECKLIST_ITEMS)[number]['key'];

/**
 * Document-backed KYS requirements. Each entry maps an uploadable document
 * type to the checklist key it satisfies, so uploading a document can
 * auto-tick the corresponding checklist item.
 */
export const KYS_DOCUMENT_REQUIREMENTS = Object.freeze([
  { documentType: 'company_registration_cr14', label: 'Company Registration — CR14 (List of Directors)', checklistKey: 'cr14Directors', required: true, section: 'Registration & Statutory' },
  { documentType: 'registered_address_cr6', label: 'Registered Address — CR6', checklistKey: 'cr6Address', required: true, section: 'Registration & Statutory' },
  { documentType: 'tax_clearance', label: 'Tax Clearance Certificate', checklistKey: 'taxClearance', required: true, section: 'Tax Compliance' },
  { documentType: 'nssa_compliance', label: 'NSSA Compliance Certificate', checklistKey: 'nssaCompliance', required: true, section: 'Statutory Compliance' },
  { documentType: 'nec_registration', label: 'NEC Registration', checklistKey: 'necRegistration', required: false, section: 'Statutory Compliance' },
  { documentType: 'industry_licence', label: 'Industry-specific Licence(s)', checklistKey: 'industryLicences', required: false, section: 'Licences & Certifications' },
  { documentType: 'iso_certification', label: 'ISO Certification(s)', checklistKey: 'isoCertification', required: false, section: 'Licences & Certifications' },
  { documentType: 'company_profile', label: 'Company Profile', checklistKey: 'companyProfile', required: true, section: 'Company Capability' },
  { documentType: 'client_referral', label: 'Client Referrals (3 previous clients)', checklistKey: 'clientReferrals', required: true, section: 'Company Capability' },
  { documentType: 'audited_financials', label: 'Audited Financial Statements (past 3 years)', checklistKey: 'auditedFinancials', required: true, section: 'Financial Standing' },
  { documentType: 'bank_reference', label: 'Bank Reference / Creditworthiness', checklistKey: 'bankReferences', required: true, section: 'Financial Standing' },
  { documentType: 'safety_records', label: 'Safety Records', checklistKey: 'safetyRecords', required: true, section: 'Health, Safety & Environment' },
  { documentType: 'environmental_policy', label: 'Environmental Policy', checklistKey: 'environmentalPolicy', required: true, section: 'Health, Safety & Environment' },
  { documentType: 'insurance', label: 'Insurance Coverage', checklistKey: 'insuranceCoverage', required: true, section: 'Health, Safety & Environment' },
  { documentType: 'disaster_preparedness', label: 'Disaster Preparedness Plan', checklistKey: 'disasterPreparedness', required: true, section: 'Health, Safety & Environment' }
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

/** COO authorization required above this amount (USD) */
export const COO_APPROVAL_THRESHOLD_USD = 5000;

/** Minimum competitive quotations required */
export const MIN_QUOTATIONS_REQUIRED = 3;

/** Supplier evaluation criteria */
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
