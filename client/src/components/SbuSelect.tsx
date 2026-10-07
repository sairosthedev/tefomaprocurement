import React, { useEffect, useState } from 'react';
import http from '../services/http';
import { getSbuCode, setSbuCode } from '../lib/sbu';

interface SbuOption {
  code: string;
  name: string;
  country: string;
}

/**
 * Chooses the business unit to sign in to — and gets out of the way as soon as
 * it can.
 *
 * When each SBU answers on its own domain, the address someone typed has
 * already said which business unit they want: the API returns it as `current`,
 * this stores it and renders nothing. The chooser appears only while SBUs
 * share an address, or when the hostname is not in the registry (localhost
 * during development, a preview deployment).
 */
export default function SbuSelect({ disabled }: { disabled?: boolean }) {
  const [options, setOptions] = useState<SbuOption[]>([]);
  const [selected, setSelected] = useState<string>(getSbuCode() || '');
  const [resolvedByDomain, setResolvedByDomain] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    http
      .get('/sbus')
      .then((response) => {
        if (cancelled) return;
        const list: SbuOption[] = response.data?.data || [];
        const current: { code: string } | null = response.data?.current || null;
        setOptions(list);

        if (current?.code) {
          // The domain decided. Keep it stored so every later request carries
          // the same code even if the hostname stops resolving.
          setSbuCode(current.code);
          setSelected(current.code);
          setResolvedByDomain(true);
          return;
        }

        // Preselect, so someone with one business unit never has to choose and
        // a returning user keeps the one they used last.
        const stored = getSbuCode();
        const valid = stored && list.some((o) => o.code === stored) ? stored : null;
        const next = valid || (list.length === 1 ? list[0].code : '');
        if (next) {
          setSelected(next);
          setSbuCode(next);
        }
      })
      .catch(() => {
        // An older API without the directory endpoint still signs people in
        // against its default business unit, so this is not a blocking error.
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (failed || resolvedByDomain || options.length <= 1) return null;

  return (
    <div className="space-y-2">
      <label htmlFor="sbu" className="block text-sm font-medium text-gray-700">
        Business Unit
      </label>
      <select
        id="sbu"
        name="sbu"
        value={selected}
        disabled={disabled}
        onChange={(e) => {
          setSelected(e.target.value);
          setSbuCode(e.target.value);
        }}
        required
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all duration-200 hover:border-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <option value="" disabled>
          Select your business unit
        </option>
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}
