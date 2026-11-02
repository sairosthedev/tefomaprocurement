import React from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { CategoryMultiSelect } from '../CategorySelect';
import { PROVINCES, BANKS, ACCOUNT_TYPES } from '../../lib/constants';

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

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';
const labelClass = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1';

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
};

function Field({ label, value, onChange, type = 'text', placeholder }: FieldProps) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
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
};

export default function SupplierProfileEditor({ section, draft, onChange, onSave, onCancel, saving, showActions = true }: Props) {
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
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
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
          <Field label="Company name" value={draft.companyName} onChange={(v) => patch({ companyName: v })} />
          <Field label="Trading name" value={draft.tradingName} onChange={(v) => patch({ tradingName: v })} />
          <Field label="Registration no." value={draft.registrationNumber} onChange={(v) => patch({ registrationNumber: v })} />
          <Field label="Tax number" value={draft.taxNumber} onChange={(v) => patch({ taxNumber: v })} />
          <Field label="VAT number" value={draft.vatNumber} onChange={(v) => patch({ vatNumber: v })} />
          <Field label="Email" value={draft.email} onChange={(v) => patch({ email: v })} type="email" />
          <Field label="Phone" value={draft.phone} onChange={(v) => patch({ phone: v })} />
          <Field label="Contact first name" value={draft.firstName} onChange={(v) => patch({ firstName: v })} />
          <Field label="Contact last name" value={draft.lastName} onChange={(v) => patch({ lastName: v })} />
          <Field label="Street address" value={draft.address.street} onChange={(v) => patchAddress({ street: v })} />
          <Field label="City" value={draft.address.city} onChange={(v) => patchAddress({ city: v })} />
          <div>
            <label className={labelClass}>Province</label>
            <select
              value={draft.address.province}
              onChange={(e) => patchAddress({ province: e.target.value })}
              className={inputClass}
            >
              <option value="">Select province</option>
              {PROVINCES.map((p: string) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <Field label="Postal code" value={draft.address.postalCode} onChange={(v) => patchAddress({ postalCode: v })} />
          <Field label="Country" value={draft.address.country} onChange={(v) => patchAddress({ country: v })} />
        </div>
        <div>
          <label className={labelClass}>Categories</label>
          <CategoryMultiSelect
            value={draft.categories}
            onChange={(categories: string[]) => patch({ categories })}
          />
        </div>
        {saveBar}
      </div>
    );
  }

  if (section === 'corporate') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Legal name" value={draft.companyName} onChange={(v) => patch({ companyName: v })} />
          <Field label="Trading name" value={draft.tradingName} onChange={(v) => patch({ tradingName: v })} />
          <Field label="Registration no." value={draft.registrationNumber} onChange={(v) => patch({ registrationNumber: v })} />
          <Field label="Tax number" value={draft.taxNumber} onChange={(v) => patch({ taxNumber: v })} />
          <Field label="VAT number" value={draft.vatNumber} onChange={(v) => patch({ vatNumber: v })} />
          <Field label="Incorporation date" value={draft.incorporationDate} onChange={(v) => patch({ incorporationDate: v })} type="date" />
          <Field label="Country" value={draft.address.country} onChange={(v) => patchAddress({ country: v })} />
          <Field label="Website" value={draft.website} onChange={(v) => patch({ website: v })} placeholder="https://..." />
        </div>
        <div>
          <label className={labelClass}>Services / products description</label>
          <textarea
            value={draft.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            rows={3}
            className={inputClass}
            placeholder="Business description, services, or products supplied"
          />
        </div>
        <div>
          <label className={labelClass}>Categories</label>
          <CategoryMultiSelect
            value={draft.categories}
            onChange={(categories: string[]) => patch({ categories })}
          />
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
              className={inputClass}
            >
              <option value="">Select bank</option>
              {BANKS.map((bank: string) => (
                <option key={bank} value={bank}>{bank}</option>
              ))}
            </select>
          </div>
          <Field label="Account name" value={draft.bankDetails.accountName} onChange={(v) => patchBank({ accountName: v })} />
          <Field label="Account number" value={draft.bankDetails.accountNumber} onChange={(v) => patchBank({ accountNumber: v })} />
          <Field label="Branch code" value={draft.bankDetails.branchCode} onChange={(v) => patchBank({ branchCode: v })} />
          <div>
            <label className={labelClass}>Account type</label>
            <select
              value={draft.bankDetails.accountType}
              onChange={(e) => patchBank({ accountType: e.target.value })}
              className={inputClass}
            >
              <option value="">Select type</option>
              {ACCOUNT_TYPES.map((type: { value: string; label: string }) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
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
          <Field label="Proposed business" value={draft.proposedBusiness} onChange={(v) => patch({ proposedBusiness: v })} />
          <Field label="Volume / quantity" value={draft.tradeVolume} onChange={(v) => patch({ tradeVolume: v })} />
        </div>
        <Field
          label="Products / goods (comma-separated)"
          value={draft.tradeProductsText}
          onChange={(v) => patch({ tradeProductsText: v })}
          placeholder="e.g. Cement, Steel, Aggregates"
        />
        <div>
          <label className={labelClass}>Supply categories</label>
          <CategoryMultiSelect
            value={draft.categories}
            onChange={(categories: string[]) => patch({ categories })}
          />
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
                className="text-red-600 hover:text-red-700 p-1"
                aria-label="Remove contact"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Name" value={person.name} onChange={(v) => {
                const next = [...draft.contactPersons];
                next[idx] = { ...person, name: v };
                patch({ contactPersons: next });
              }} />
              <Field label="Position" value={person.position} onChange={(v) => {
                const next = [...draft.contactPersons];
                next[idx] = { ...person, position: v };
                patch({ contactPersons: next });
              }} />
              <Field label="Email" value={person.email} onChange={(v) => {
                const next = [...draft.contactPersons];
                next[idx] = { ...person, email: v };
                patch({ contactPersons: next });
              }} type="email" />
              <Field label="Phone" value={person.phone} onChange={(v) => {
                const next = [...draft.contactPersons];
                next[idx] = { ...person, phone: v };
                patch({ contactPersons: next });
              }} />
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
                className="text-red-600 hover:text-red-700 p-1"
                aria-label="Remove reference"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Client name" value={ref.clientName} onChange={(v) => {
                const next = [...draft.clientReferrals];
                next[idx] = { ...ref, clientName: v };
                patch({ clientReferrals: next });
              }} />
              <Field label="Contact person" value={ref.contactPerson} onChange={(v) => {
                const next = [...draft.clientReferrals];
                next[idx] = { ...ref, contactPerson: v };
                patch({ clientReferrals: next });
              }} />
              <Field label="Email" value={ref.contactEmail} onChange={(v) => {
                const next = [...draft.clientReferrals];
                next[idx] = { ...ref, contactEmail: v };
                patch({ clientReferrals: next });
              }} type="email" />
              <Field label="Phone" value={ref.contactPhone} onChange={(v) => {
                const next = [...draft.clientReferrals];
                next[idx] = { ...ref, contactPhone: v };
                patch({ clientReferrals: next });
              }} />
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
                className={inputClass}
              />
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
