import { ChevronDown, Filter } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface FilterOption {
  value: string;
  label: string;
  /** Shown after the label, e.g. "Accepted (4)". */
  count?: number;
}

interface FilterSelectProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  /** What is being filtered, e.g. "Status". Read by screen readers and shown as a prefix. */
  label?: string;
  className?: string;
  /** `sm` matches the compact toolbar buttons (36px tall). */
  size?: 'md' | 'sm';
}

/**
 * The system's list filter: one dropdown rather than a row of tabs, so a
 * filter with many values never wraps or scrolls sideways. Native <select>
 * underneath, so it behaves properly on phones and with the keyboard.
 */
export default function FilterSelect({ options, value, onChange, label = 'Status', className, size = 'md' }: FilterSelectProps) {
  const sm = size === 'sm';
  return (
    <label className={cn('relative flex items-center shrink-0', sm ? 'md:w-48' : 'md:w-64', className)}>
      <span className="sr-only">{label}</span>
      <Filter className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full appearance-none pl-9 pr-9 ${sm ? 'py-[7px] rounded-lg' : 'py-2.5 rounded-xl'} border border-gray-300 bg-white text-sm text-gray-700 focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.value === '' ? `${label}: ${option.label}` : option.label}
            {typeof option.count === 'number' ? ` (${option.count})` : ''}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-gray-400" />
    </label>
  );
}
