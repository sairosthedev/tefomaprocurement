import React from 'react';
import { Mail, Phone } from 'lucide-react';
import { getCategoryName } from '../../lib/constants';
import type { SupplierDraft } from './SupplierProfileEditor';
import { supplierToDraft } from './SupplierProfileEditor';

function valueOrDash(value: unknown) {
  return value === null || value === undefined || value === '' ? '-' : String(value);
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-gray-900 text-sm">{valueOrDash(value)}</p>
    </div>
  );
}

type Props = {
  section: string;
  supplier: any;
};

export default function SupplierProfileView({ section, supplier }: Props) {
  const draft: SupplierDraft = supplierToDraft(supplier);
  const bank = draft.bankDetails;
  const addressLine = [
    draft.address.street,
    draft.address.city,
    draft.address.province,
    draft.address.postalCode,
    draft.address.country
  ].filter(Boolean).join(', ');

  if (section === 'overview') {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Company name" value={draft.companyName} />
          <Field label="Trading name" value={draft.tradingName} />
          <Field label="Registration no." value={draft.registrationNumber} />
          <Field label="Tax number" value={draft.taxNumber} />
          <Field label="VAT number" value={draft.vatNumber} />
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Contact</p>
            <p className="text-gray-900 text-sm flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400" />
              {valueOrDash(draft.email)}
            </p>
            <p className="text-gray-900 text-sm flex items-center gap-2 mt-1">
              <Phone className="h-4 w-4 text-gray-400" />
              {valueOrDash(draft.phone)}
            </p>
            <p className="text-gray-500 text-xs mt-1">
              {valueOrDash(`${draft.firstName} ${draft.lastName}`.trim())}
            </p>
          </div>
          <Field label="Address" value={addressLine} />
          <Field label="Registered" value={supplier.createdAt ? new Date(supplier.createdAt).toLocaleDateString('en-ZA') : '-'} />
          <Field label="Supplier status" value={supplier.status ? supplier.status.charAt(0).toUpperCase() + supplier.status.slice(1) : '-'} />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Categories</p>
          <div className="flex flex-wrap gap-1.5">
            {draft.categories.length ? (
              draft.categories.map((cat, idx) => (
                <span key={idx} className="px-2 py-1 bg-gray-100 rounded-lg text-xs text-gray-600">
                  {getCategoryName(cat)}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-400">No categories</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (section === 'corporate') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Legal name" value={draft.companyName} />
        <Field label="Trading name" value={draft.tradingName} />
        <Field label="Registration no." value={draft.registrationNumber} />
        <Field label="Tax number" value={draft.taxNumber} />
        <Field label="VAT number" value={draft.vatNumber} />
        <Field
          label="Incorporation date"
          value={draft.incorporationDate ? new Date(draft.incorporationDate).toLocaleDateString('en-ZA') : '-'}
        />
        <Field label="Country" value={draft.address.country} />
        <Field label="Website" value={draft.website} />
        <div className="sm:col-span-2">
          <Field label="Services / products" value={draft.notes} />
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Categories</p>
          <div className="flex flex-wrap gap-1.5">
            {draft.categories.length ? (
              draft.categories.map((cat, idx) => (
                <span key={idx} className="px-2 py-1 bg-gray-100 rounded-lg text-xs text-gray-600">
                  {getCategoryName(cat)}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-400">No categories</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (section === 'banking') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Bank name" value={bank.bankName} />
        <Field label="Account name" value={bank.accountName} />
        <Field label="Account number" value={bank.accountNumber} />
        <Field label="Branch code" value={bank.branchCode} />
        <Field label="Account type" value={bank.accountType} />
      </div>
    );
  }

  if (section === 'trade') {
    const products = draft.tradeProductsText
      ? draft.tradeProductsText.split(',').map((p) => p.trim()).filter(Boolean)
      : [];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Proposed business" value={draft.proposedBusiness} />
          <Field label="Volume / quantity" value={draft.tradeVolume} />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Products / goods</p>
          <div className="flex flex-wrap gap-1.5">
            {products.length ? (
              products.map((item, idx) => (
                <span key={idx} className="px-2 py-1 bg-gray-100 rounded-lg text-xs text-gray-600">{item}</span>
              ))
            ) : (
              <span className="text-sm text-gray-400">Not captured</span>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Supply categories</p>
          <div className="flex flex-wrap gap-1.5">
            {draft.categories.length ? (
              draft.categories.map((cat, idx) => (
                <span key={idx} className="px-2 py-1 bg-gray-100 rounded-lg text-xs text-gray-600">
                  {getCategoryName(cat)}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-400">No categories</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (section === 'directors') {
    return (
      <div className="space-y-3">
        {draft.contactPersons.length > 0 ? (
          draft.contactPersons.map((person, idx) => (
            <div key={idx} className="rounded-xl border border-gray-100 p-4 bg-gray-50 flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-gray-900">{person.name || '-'}</p>
                <p className="text-xs text-gray-500">{person.position || 'Role not captured'}</p>
                <p className="text-xs text-gray-500 mt-1">{person.email || '-'}</p>
                <p className="text-xs text-gray-500">{person.phone || '-'}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-white border border-gray-200 text-gray-600">
                {person.isPrimary ? 'Primary' : 'Member'}
              </span>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 p-4 text-gray-500 text-sm">
            No directors or contacts captured yet.
          </div>
        )}
      </div>
    );
  }

  if (section === 'references') {
    return (
      <div className="space-y-3">
        {draft.clientReferrals.length > 0 ? (
          draft.clientReferrals.map((ref, idx) => (
            <div key={idx} className="rounded-xl border border-gray-100 p-4 bg-gray-50">
              <p className="font-medium text-gray-900">{ref.clientName || 'Reference'}</p>
              <p className="text-xs text-gray-500">{ref.contactPerson || 'Contact not captured'}</p>
              <p className="text-xs text-gray-500">{ref.contactEmail || '-'}</p>
              <p className="text-xs text-gray-500">{ref.contactPhone || '-'}</p>
              {ref.projectDescription && (
                <p className="text-xs text-gray-600 mt-2">{ref.projectDescription}</p>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 p-4 text-gray-500 text-sm">
            No trade references captured yet.
          </div>
        )}
      </div>
    );
  }

  return null;
}
