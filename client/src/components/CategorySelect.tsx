import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { SUPPLIER_CATEGORY_GROUPS, getCategoryName } from '../lib/constants';
import { ChevronDown, X, Search, Check } from 'lucide-react';

const PANEL_MAX_HEIGHT = 320;

type DropdownPlacement = 'auto' | 'top' | 'bottom';

function useDropdownPanelStyle(
  open: boolean,
  containerRef: React.RefObject<HTMLDivElement | null>,
  placement: DropdownPlacement
) {
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  const updatePosition = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropUp = placement === 'top'
      || (placement === 'auto' && spaceBelow < PANEL_MAX_HEIGHT && spaceAbove > spaceBelow);

    const maxHeight = dropUp
      ? Math.min(PANEL_MAX_HEIGHT, spaceAbove - 8)
      : Math.min(PANEL_MAX_HEIGHT, spaceBelow - 8);

    setStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(maxHeight, 160),
      zIndex: 9999,
      visibility: 'visible',
      ...(dropUp
        ? { top: 'auto', bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4, bottom: 'auto' })
    });
  }, [containerRef, placement]);

  useEffect(() => {
    if (!open) return;

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  return style;
}

/**
 * Single category picker rendered as a searchable, grouped dropdown.
 * Stores the category CODE, shows the NAME (grouped by section).
 */
export function CategorySelect({
  value,
  onChange,
  required,
  placeholder = 'Select category',
  className = ''
}: {
  value: string;
  onChange: (code: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SUPPLIER_CATEGORY_GROUPS;
    return SUPPLIER_CATEGORY_GROUPS.map((group) => ({
      section: group.section,
      options: group.options.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          o.value.toLowerCase().includes(q) ||
          group.section.toLowerCase().includes(q)
      )
    })).filter((g) => g.options.length > 0);
  }, [query]);

  const select = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          className ||
          'w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white'
        }
      >
        <span className={value ? 'text-gray-900' : 'text-gray-500'}>
          {value ? getCategoryName(value) : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Keep a hidden input so native `required` validation still works */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value || ''}
          onChange={() => {}}
          className="absolute opacity-0 h-0 w-0 pointer-events-none"
        />
      )}

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search categories…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="overflow-y-auto">
            {filteredGroups.length === 0 && (
              <p className="px-3 py-4 text-sm text-gray-400 text-center">No matches</p>
            )}
            {filteredGroups.map((group) => (
              <div key={group.section}>
                <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-50 sticky top-0">
                  {group.section}
                </p>
                {group.options.map((opt) => {
                  const selected = value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => select(opt.value)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50"
                    >
                      <span className={selected ? 'text-primary font-medium' : 'text-gray-700'}>
                        {opt.label}
                        <span className="text-gray-300 ml-1">· {opt.value}</span>
                      </span>
                      {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Multi-select category picker (searchable, grouped by section) used for
 * supplier categories. Stores an array of category CODES.
 */
export function CategoryMultiSelect({
  value,
  onChange,
  placeholder = 'Select categories…',
  placement = 'auto'
}: {
  value: string[];
  onChange: (codes: string[]) => void;
  placeholder?: string;
  placement?: DropdownPlacement;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelStyle = useDropdownPanelStyle(open, containerRef, placement);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target)
        || panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SUPPLIER_CATEGORY_GROUPS;
    return SUPPLIER_CATEGORY_GROUPS.map((group) => ({
      section: group.section,
      options: group.options.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          o.value.toLowerCase().includes(q) ||
          group.section.toLowerCase().includes(q)
      )
    })).filter((g) => g.options.length > 0);
  }, [query]);

  const toggle = (code: string) => {
    if (value.includes(code)) {
      onChange(value.filter((c) => c !== code));
    } else {
      onChange([...value, code]);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
            >
              {getCategoryName(code)}
              <button
                type="button"
                onClick={() => toggle(code)}
                className="hover:text-primary-dark"
                aria-label={`Remove ${getCategoryName(code)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
      >
        <span className="text-gray-500">
          {value.length > 0 ? `${value.length} selected` : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={panelStyle}
          className="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden flex flex-col"
        >
          <div className="p-2 border-b border-gray-100 shrink-0 bg-white">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search categories…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="overflow-y-auto min-h-0 flex-1">
            {filteredGroups.length === 0 && (
              <p className="px-3 py-4 text-sm text-gray-400 text-center">No matches</p>
            )}
            {filteredGroups.map((group) => (
              <div key={group.section}>
                <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-50 sticky top-0">
                  {group.section}
                </p>
                {group.options.map((opt) => {
                  const selected = value.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggle(opt.value)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50"
                    >
                      <span className={selected ? 'text-primary font-medium' : 'text-gray-700'}>
                        {opt.label}
                        <span className="text-gray-300 ml-1">· {opt.value}</span>
                      </span>
                      {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
