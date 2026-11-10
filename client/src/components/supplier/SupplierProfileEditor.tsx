import React from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { CategoryMultiSelect } from '../CategorySelect';
import { PROVINCES, BANKS, ACCOUNT_TYPES } from '../../lib/constants';
import { BUSINESS_TYPE_OPTIONS, ENTITY_TYPE_OPTIONS } from '../../lib/supplierTypes';
import { validateSupplierProfileUpdate, type FieldErrors } from '@fossil/shared';
import FieldError from '../FieldError';

export type ContactPersonDraft = {
  name: string;
  position: string;
  email: string;
  phone: string;
  isPrimary: boolean;
};

export type ClientReferralDraft = {
  clientName: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  projectDescription: string;
};

export type SupplierDraft = {
  /** Shown, never sent: the code is assigned by the server and permanent. */
  supplierCode: string;
  businessType: string;
  entityType: string;
  companyName: string;
  tradingName: string;
  registrationNumber: string;
  taxNumber: string;
  vatNumber: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  address: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
  categories: string[];
  website: string;
  incorporationDate: string;
  notes: string;
  bankDetails: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    branchCode: string;
    accountType: string;
  };
  proposedBusiness: string;
  tradeVolume: string;
  tradeProductsText: string;
  contactPersons: ContactPersonDraft[];
  clientReferrals: ClientReferralDraft[];
};

export function supplierToDraft(supplier: any): SupplierDraft {
  const bank = supplier?.bankDetails || supplier?.bankingDetails || {};
  const user = supplier?.user || {};
  const address = supplier?.address || {};
  const tradeProducts = Array.isArray(supplier?.tradeProducts) ? supplier.tradeProducts : [];

  return {
    supplierCode: supplier?.supplierCode || '',
    businessType: supplier?.businessType || '',
    entityType: supplier?.entityType || '',
    companyName: supplier?.companyName || '',
    tradingName: supplier?.tradingName || supplier?.tradingAs || '',
    registrationNumber: supplier?.registrationNumber || '',
    taxNumber: supplier?.taxNumber || '',
    vatNumber: supplier?.vatNumber || '',
    email: user.email || supplier?.email || '',
    phone: user.phone || supplier?.phone || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    address: {
      street: address.street || address.physical || supplier?.physicalAddress || '',
      city: address.city || supplier?.city || '',
      province: address.province || supplier?.province || '',
      postalCode: address.postalCode || supplier?.postalCode || '',
      country: address.country || 'Zimbabwe'
    },
    categories: Array.isArray(supplier?.categories) ? [...supplier.categories] : [],
    website: supplier?.website || '',
    incorporationDate: supplier?.incorporationDate
      ? new Date(supplier.incorporationDate).toISOString().slice(0, 10)
      : '',
    notes: supplier?.notes || supplier?.businessDescription || '',
    bankDetails: {
      bankName: bank.bankName || supplier?.bankName || '',
      accountName: bank.accountName || supplier?.bankAccountName || '',
      accountNumber: bank.accountNumber || supplier?.bankAccountNumber || '',
      branchCode: bank.branchCode || supplier?.bankBranchCode || '',
      accountType: bank.accountType || ''
    },
    proposedBusiness: supplier?.proposedBusiness || '',
    tradeVolume: supplier?.tradeVolume || '',
    tradeProductsText: tradeProducts.join(', '),
    contactPersons: (Array.isArray(supplier?.contactPersons) ? supplier.contactPersons : []).map(
      (person: any) => ({
        name: person.name || '',
        position: person.position || '',
        email: person.email || '',
        phone: person.phone || '',
        isPrimary: Boolean(person.isPrimary)
      })
    ),
    clientReferrals: (Array.isArray(supplier?.clientReferrals) ? supplier.clientReferrals : []).map(
      (ref: any) => ({
        clientName: ref.clientName || ref.name || '',
        contactPerson: ref.contactPerson || '',
        contactEmail: ref.contactEmail || ref.email || '',
        contactPhone: ref.contactPhone || ref.phone || '',
        projectDescription: ref.projectDescription || ''
      })
    )
  };
}

export function draftPayloadForSection(section: string, draft: SupplierDraft): Record<string, unknown> {
  switch (section) {
    case 'overview':
      return {
        companyName: draft.companyName,
        tradingName: draft.tradingName,
        registrationNumber: draft.registrationNumber,
        taxNumber: draft.taxNumber,
        vatNumber: draft.vatNumber,
        // Empty clears it; both are optional.
        businessType: draft.businessType,
        entityType: draft.entityType,
        address: draft.address,
        categories: draft.categories,
        user: {
          email: draft.email,
          phone: draft.phone,
          firstName: draft.firstName,
          lastName: draft.lastName
        }
      };
    case 'corporate':
      return {
        companyName: draft.companyName,
        tradingName: draft.tradingName,
        registrationNumber: draft.registrationNumber,
        taxNumber: draft.taxNumber,
        vatNumber: draft.vatNumber,
        businessType: draft.businessType,
        entityType: draft.entityType,
        address: draft.address,
        website: draft.website,
        incorporationDate: draft.incorporationDate || undefined,
        notes: draft.notes,
        categories: draft.categories
      };
    case 'banking':
      return { bankDetails: draft.bankDetails };
    case 'trade':
      return {
        proposedBusiness: draft.proposedBusiness,
        tradeVolume: draft.tradeVolume,
        tradeProducts: draft.tradeProductsText
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        categories: draft.categories
      };
    case 'directors':
      return { contactPersons: draft.contactPersons };
    case 'references':
      return { clientReferrals: draft.clientReferrals };
    default:
      return {};
  }
}

/**
 * What is wrong with a section's edit: the checks the API runs on the same
 * payload. `hasLogin` is false for a supplier without a sign-in, whose login
 * fields the API ignores.
 */
export function draftErrors(section: string, draft: SupplierDraft, hasLogin = true): FieldErrors {
  const payload = draftPayloadForSection(section, draft);
  return validateSupplierProfileUpdate(hasLogin ? payload : { ...payload, user: undefined }, {
    country: draft.address.country
  });
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';
const labelClass = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1';

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  /** The message under the field when its check failed. */
  error?: string;
  maxLength?: number;
};

function Field({ label, value, onChange, type = 'text', placeholder, error, maxLength }: FieldProps) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        className={inputClass}
      />
      <FieldError message={error} />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  error
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  error?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} className={inputClass}>
        <option value="">Not specified</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <FieldError message={error} />
    </div>
  );
}

/** Business and entity type: optional, edited on Overview and Corporate. */
function ClassificationFields({
  draft,
  patch,
  errors
}: {
  draft: SupplierDraft;
  patch: (p: Partial<SupplierDraft>) => void;
  errors: FieldErrors;
}) {
  return (
    <>
      <SelectField label="Business type" value={draft.businessType} onChange={(v) => patch({ businessType: v })} options={BUSINESS_TYPE_OPTIONS} error={errors.businessType} />
      <SelectField label="Entity type" value={draft.entityType} onChange={(v) => patch({ entityType: v })} options={ENTITY_TYPE_OPTIONS} error={errors.entityType} />
    </>
  );
}

type Props = {
  section: string;
  draft: SupplierDraft;
  onChange: (draft: SupplierDraft) => void;
  onSave: () => void;
  onCancel?: () => void;
  saving: boolean;
  showActions?: boolean;
  /** Messages from the section's check (see draftErrors), keyed by payload path. */
  errors?: FieldErrors;
};

export default function SupplierProfileEditor({
  section,
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
  showActions = true,
  errors = {}
}: Props) {
  const patch = (partial: Partial<SupplierDraft>) => onChange({ ...draft, ...partial });
  const patchAddress = (partial: Partial<SupplierDraft['address']>) =>
    onChange({ ...draft, address: { ...draft.address, ...partial } });
  const patchBank = (partial: Partial<SupplierDraft['bankDetails']>) =>
    onChange({ ...draft, bankDetails: { ...draft.bankDetails, ...partial } });

  const emptyContact = (): ContactPersonDraft => ({
    name: '',
    position: '',
    email: '',
    phone: '',
    isPrimary: draft.contactPersons.length === 0
  });

  const emptyReference = (): ClientReferralDraft => ({
    clientName: '',
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    projectDescription: ''
  });

  const saveBar = showActions ? (
    <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save changes
      </button>
    </div>
  ) : null;

  if (section === 'overview') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Company name" value={draft.companyName} onChange={(v) => patch({ companyName: v })} error={errors.companyName} maxLength={200} />
          <Field label="Trading name" value={draft.tradingName} onChange={(v) => patch({ tradingName: v })} error={errors.tradingName} maxLength={200} />
          <Field label="Registration no." value={draft.registrationNumber} onChange={(v) => patch({ registrationNumber: v })} error={errors.registrationNumber} maxLength={50} />
          <Field label="Tax number" value={draft.taxNumber} onChange={(v) => patch({ taxNumber: v })} error={errors.taxNumber} maxLength={50} />
          <Field label="VAT number" value={draft.vatNumber} onChange={(v) => patch({ vatNumber: v })} error={errors.vatNumber} maxLength={50} />
          <ClassificationFields draft={draft} patch={patch} errors={errors} />
          <Field label="Email" value={draft.email} onChange={(v) => patch({ email: v })} type="email" error={errors['user.email']} maxLength={254} />
          <Field label="Phone" value={draft.phone} onChange={(v) => patch({ phone: v })} error={errors['user.phone']} maxLength={30} />
          <Field label="Contact first name" value={draft.firstName} onChange={(v) => patch({ firstName: v })} error={errors['user.firstName']} maxLength={120} />
          <Field label="Contact last name" value={draft.lastName} onChange={(v) => patch({ lastName: v })} error={errors['user.lastName']} maxLength={120} />
          <Field label="Street address" value={draft.address.street} onChange={(v) => patchAddress({ street: v })} error={errors['address.street']} maxLength={200} />
          <Field label="City" value={draft.address.city} onChange={(v) => patchAddress({ city: v })} error={errors['address.city']} maxLength={80} />
          <div>
            <label className={labelClass}>Province</label>
            <select
              value={draft.address.province}
              onChange={(e) => patchAddress({ province: e.target.value })}
              aria-invalid={errors['address.province'] ? true : undefined}
              className={inputClass}
            >
              <option value="">Select province</option>
              {PROVINCES.map((p: string) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <FieldError message={errors['address.province']} />
          </div>
          <Field label="Postal code" value={draft.address.postalCode} onChange={(v) => patchAddress({ postalCode: v })} error={errors['address.postalCode']} maxLength={20} />
          <Field label="Country" value={draft.address.country} onChange={(v) => patchAddress({ country: v })} error={errors['address.country']} maxLength={80} />
        </div>
        <div>
          <label className={labelClass}>Categories</label>
          <CategoryMultiSelect
            value={draft.categories}
            onChange={(categories: string[]) => patch({ categories })}
            invalid={!!errors.categories}
          />
          <FieldError message={errors.categories} />
        </div>
        {saveBar}
      </div>
    );
  }

  if (section === 'corporate') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Legal name" value={draft.companyName} onChange={(v) => patch({ companyName: v })} error={errors.companyName} maxLength={200} />
          <Field label="Trading name" value={draft.tradingName} onChange={(v) => patch({ tradingName: v })} error={errors.tradingName} maxLength={200} />
          <Field label="Registration no." value={draft.registrationNumber} onChange={(v) => patch({ registrationNumber: v })} error={errors.registrationNumber} maxLength={50} />
          <Field label="Tax number" value={draft.taxNumber} onChange={(v) => patch({ taxNumber: v })} error={errors.taxNumber} maxLength={50} />
          <Field label="VAT number" value={draft.vatNumber} onChange={(v) => patch({ vatNumber: v })} error={errors.vatNumber} maxLength={50} />
          <Field label="Incorporation date" value={draft.incorporationDate} onChange={(v) => patch({ incorporationDate: v })} type="date" error={errors.incorporationDate} />
          <ClassificationFields draft={draft} patch={patch} errors={errors} />
          <Field label="Country" value={draft.address.country} onChange={(v) => patchAddress({ country: v })} error={errors['address.country']} maxLength={80} />
          <Field label="Website" value={draft.website} onChange={(v) => patch({ website: v })} placeholder="https://..." error={errors.website} maxLength={200} />
        </div>
        <div>
          <label className={labelClass}>Services / products description</label>
          <textarea
            value={draft.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            rows={3}
            maxLength={2000}
            aria-invalid={errors.notes ? true : undefined}
            className={inputClass}
            placeholder="Business description, services, or products supplied"
          />
          <FieldError message={errors.notes} />
        </div>
        <div>
          <label className={labelClass}>Categories</label>
          <CategoryMultiSelect
            value={draft.categories}
            onChange={(categories: string[]) => patch({ categories })}
            invalid={!!errors.categories}
          />
          <FieldError message={errors.categories} />
        </div>
        {saveBar}
      </div>
    );
  }

  if (section === 'banking') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Bank name</label>
            <select
              value={draft.bankDetails.bankName}
              onChange={(e) => patchBank({ bankName: e.target.value })}
              aria-invalid={errors['bankDetails.bankName'] ? true : undefined}
              className={inputClass}
            >
              <option value="">Select bank</option>
              {BANKS.map((bank: string) => (
                <option key={bank} value={bank}>{bank}</option>
              ))}
            </select>
            <FieldError message={errors['bankDetails.bankName']} />
          </div>
          <Field label="Account name" value={draft.bankDetails.accountName} onChange={(v) => patchBank({ accountName: v })} error={errors['bankDetails.accountName']} maxLength={200} />
          <Field label="Account number" value={draft.bankDetails.accountNumber} onChange={(v) => patchBank({ accountNumber: v })} error={errors['bankDetails.accountNumber']} maxLength={42} />
          <Field label="Branch code" value={draft.bankDetails.branchCode} onChange={(v) => patchBank({ branchCode: v })} error={errors['bankDetails.branchCode']} maxLength={40} />
          <div>
            <label className={labelClass}>Account type</label>
            <select
              value={draft.bankDetails.accountType}
              onChange={(e) => patchBank({ accountType: e.target.value })}
              aria-invalid={errors['bankDetails.accountType'] ? true : undefined}
              className={inputClass}
            >
              <option value="">Select type</option>
              {ACCOUNT_TYPES.map((type: { value: string; label: string }) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <FieldError message={errors['bankDetails.accountType']} />
          </div>
        </div>
        {saveBar}
      </div>
    );
  }

  if (section === 'trade') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Proposed business" value={draft.proposedBusiness} onChange={(v) => patch({ proposedBusiness: v })} error={errors.proposedBusiness} maxLength={200} />
          <Field label="Volume / quantity" value={draft.tradeVolume} onChange={(v) => patch({ tradeVolume: v })} error={errors.tradeVolume} maxLength={200} />
        </div>
        <Field
          label="Products / goods (comma-separated)"
          value={draft.tradeProductsText}
          onChange={(v) => patch({ tradeProductsText: v })}
          placeholder="e.g. Cement, Steel, Aggregates"
          error={errors.tradeProducts}
        />
        <div>
          <label className={labelClass}>Supply categories</label>
          <CategoryMultiSelect
            value={draft.categories}
            onChange={(categories: string[]) => patch({ categories })}
            invalid={!!errors.categories}
          />
          <FieldError message={errors.categories} />
        </div>
        {saveBar}
      </div>
    );
  }

  if (section === 'directors') {
    return (
      <div className="space-y-4">
        {draft.contactPersons.length === 0 && (
          <p className="text-sm text-gray-500">No directors or contacts yet. Add one below.</p>
        )}
        {draft.contactPersons.map((person, idx) => (
          <div key={idx} className="rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">Contact {idx + 1}</p>
              <button
                type="button"
                onClick={() => patch({ contactPersons: draft.contactPersons.filter((_, i) => i !== idx) })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                aria-label="Remove contact"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Name" value={person.name} onChange={(v) => {
                const next = [...draft.contactPersons];
                next[idx] = { ...person, name: v };
                patch({ contactPersons: next });
              }} error={errors[`contactPersons.${idx}.name`]} maxLength={120} />
              <Field label="Position" value={person.position} onChange={(v) => {
                const next = [...draft.contactPersons];
                next[idx] = { ...person, position: v };
                patch({ contactPersons: next });
              }} error={errors[`contactPersons.${idx}.position`]} maxLength={120} />
              <Field label="Email" value={person.email} onChange={(v) => {
                const next = [...draft.contactPersons];
                next[idx] = { ...person, email: v };
                patch({ contactPersons: next });
              }} type="email" error={errors[`contactPersons.${idx}.email`]} maxLength={254} />
              <Field label="Phone" value={person.phone} onChange={(v) => {
                const next = [...draft.contactPersons];
                next[idx] = { ...person, phone: v };
                patch({ contactPersons: next });
              }} error={errors[`contactPersons.${idx}.phone`]} maxLength={30} />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={person.isPrimary}
                onChange={(e) => {
                  const next = draft.contactPersons.map((p, i) => ({
                    ...p,
                    isPrimary: i === idx ? e.target.checked : false
                  }));
                  patch({ contactPersons: next });
                }}
              />
              Primary contact
            </label>
          </div>
        ))}
        <button
          type="button"
          onClick={() => patch({ contactPersons: [...draft.contactPersons, emptyContact()] })}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5"
        >
          <Plus className="h-4 w-4" />
          Add director / contact
        </button>
        {saveBar}
      </div>
    );
  }

  if (section === 'references') {
    return (
      <div className="space-y-4">
        {draft.clientReferrals.length === 0 && (
          <p className="text-sm text-gray-500">No trade references yet. Add at least three for KYS.</p>
        )}
        {draft.clientReferrals.map((ref, idx) => (
          <div key={idx} className="rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">Reference {idx + 1}</p>
              <button
                type="button"
                onClick={() => patch({ clientReferrals: draft.clientReferrals.filter((_, i) => i !== idx) })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                aria-label="Remove reference"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Client name" value={ref.clientName} onChange={(v) => {
                const next = [...draft.clientReferrals];
                next[idx] = { ...ref, clientName: v };
                patch({ clientReferrals: next });
              }} error={errors[`clientReferrals.${idx}.clientName`]} maxLength={200} />
              <Field label="Contact person" value={ref.contactPerson} onChange={(v) => {
                const next = [...draft.clientReferrals];
                next[idx] = { ...ref, contactPerson: v };
                patch({ clientReferrals: next });
              }} error={errors[`clientReferrals.${idx}.contactPerson`]} maxLength={120} />
              <Field label="Email" value={ref.contactEmail} onChange={(v) => {
                const next = [...draft.clientReferrals];
                next[idx] = { ...ref, contactEmail: v };
                patch({ clientReferrals: next });
              }} type="email" error={errors[`clientReferrals.${idx}.contactEmail`]} maxLength={254} />
              <Field label="Phone" value={ref.contactPhone} onChange={(v) => {
                const next = [...draft.clientReferrals];
                next[idx] = { ...ref, contactPhone: v };
                patch({ clientReferrals: next });
              }} error={errors[`clientReferrals.${idx}.contactPhone`]} maxLength={30} />
            </div>
            <div>
              <label className={labelClass}>Project description</label>
              <textarea
                value={ref.projectDescription}
                onChange={(e) => {
                  const next = [...draft.clientReferrals];
                  next[idx] = { ...ref, projectDescription: e.target.value };
                  patch({ clientReferrals: next });
                }}
                rows={2}
                maxLength={2000}
                aria-invalid={errors[`clientReferrals.${idx}.projectDescription`] ? true : undefined}
                className={inputClass}
              />
              <FieldError message={errors[`clientReferrals.${idx}.projectDescription`]} />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => patch({ clientReferrals: [...draft.clientReferrals, emptyReference()] })}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5"
        >
          <Plus className="h-4 w-4" />
          Add reference
        </button>
        {saveBar}
      </div>
    );
  }

  return null;
}
