import React, { useEffect, useState } from 'react';
import http from '../services/http';
import { getSbuCode, setSbuCode } from '../lib/sbu';

interface SbuOption {
  code: string;
  name: string;
  country: string;
}

/**
 * Chooses the business unit to sign in to.
 *
 * A temporary measure: once each SBU answers on its own domain the hostname
 * identifies it and this disappears. Until then one deployment serves all of
 * them, so the user has to say which.
 *
 * Renders nothing when there is only one business unit, so a single-tenant
 * deployment shows no choice at all.
 */
export default function SbuSelect({ disabled }: { disabled?: boolean }) {
  const [options, setOptions] = useState<SbuOption[]>([]);
  const [selected, setSelected] = useState<string>(getSbuCode() || '');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    http
      .get('/sbus')
      .then((response) => {
        if (cancelled) return;
        const list: SbuOption[] = response.data?.data || [];
        setOptions(list);

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

  if (failed || options.length <= 1) return null;

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
