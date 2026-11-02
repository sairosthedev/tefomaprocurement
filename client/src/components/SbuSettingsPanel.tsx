import { useEffect, useState } from 'react';
import { Building2, Loader2, AlertTriangle, Info } from 'lucide-react';
import { adminAPI } from '../lib/api';
import { formatCurrency } from '../lib/constants';
import { setSbuCurrency } from '../lib/sbu';

interface SbuSettings {
  code: string;
  name: string;
  country: string;
  baseCurrency: string;
  approvalPolicy: {
    cooThresholdUsd: number;
    fxRateToUsd: number | null;
    cooThresholdLocal: number | null;
  };
  branding: {
    legalName: string;
    address: string | null;
    vatNumber: string | null;
    logoUrl: string | null;
  };
}

/**
 * Read-only view of the signed-in business unit's currency, COO limit and
 * document branding, for admins. Group operators change these values; an
 * SBU's own admin cannot move the limit their approvals are held to.
 */
export default function SbuSettingsPanel() {
  const [settings, setSettings] = useState<SbuSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminAPI
      .getSbuSettings()
      .then((response: any) => {
        if (cancelled) return;
        const data: SbuSettings | null = response.data?.data || null;
        setSettings(data);
        // Keep the cached currency used for totals in step with the server.
        if (data?.baseCurrency) setSbuCurrency(data.baseCurrency);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const policy = settings?.approvalPolicy;
  const branding = settings?.branding;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mt-6">
      <div className="flex items-center gap-2 text-gray-700 font-medium">
        <Building2 className="h-5 w-5" />
        Business unit settings
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : failed || !settings ? (
        <p className="mt-4 text-sm text-gray-500">Business unit settings could not be loaded.</p>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Business unit</dt>
              <dd className="font-medium text-gray-900 break-words">
                {settings.name} <span className="font-mono text-xs text-gray-500 break-all">({settings.code})</span>
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Country</dt>
              <dd className="font-medium text-gray-900">{settings.country || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Base currency</dt>
              <dd className="font-medium text-gray-900">{settings.baseCurrency}</dd>
            </div>
            <div>
              <dt className="text-gray-500">COO approval limit</dt>
              <dd className="font-medium text-gray-900">
                {formatCurrency(policy?.cooThresholdUsd ?? 0, 'USD')}
                {settings.baseCurrency !== 'USD' && policy?.cooThresholdLocal != null && (
                  <span className="text-gray-500 font-normal">
                    {' '}≈ {formatCurrency(policy.cooThresholdLocal, settings.baseCurrency)}
                  </span>
                )}
              </dd>
              {settings.baseCurrency !== 'USD' && policy?.fxRateToUsd != null && (
                <p className="text-xs text-gray-500 mt-0.5">
                  At 1 USD = {policy.fxRateToUsd} {settings.baseCurrency}
                </p>
              )}
            </div>
          </dl>

          {settings.baseCurrency !== 'USD' && policy?.cooThresholdLocal == null && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                No {settings.baseCurrency} exchange rate on file — every PO routes to the COO.
              </span>
            </div>
          )}

          <div className="mt-6 border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Document branding</p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Legal name</dt>
                <dd className="font-medium text-gray-900 break-words">{branding?.legalName || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">VAT number</dt>
                <dd className="font-medium text-gray-900">{branding?.vatNumber || '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-gray-500">Address</dt>
                <dd className="font-medium text-gray-900 whitespace-pre-line break-words">
                  {branding?.address || '—'}
                </dd>
              </div>
              {branding?.logoUrl && (
                <div className="sm:col-span-2">
                  <dt className="text-gray-500 mb-1">Logo</dt>
                  <dd>
                    <img src={branding.logoUrl} alt={`${branding.legalName} logo`} className="h-12 object-contain" />
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <p className="mt-6 flex items-start gap-2 text-xs text-gray-500">
            <Info className="h-4 w-4 flex-shrink-0" />
            These settings are read-only here. Changes to the currency, COO limit, exchange rate or
            branding are made by group operators.
          </p>
        </>
      )}
    </div>
  );
}
