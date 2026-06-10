import { useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { ChevronDown, Search, Package, Loader2 } from 'lucide-react';

export interface CatalogItem {
  _id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  unit: string;
  quantityAvailable: number;
}

interface ItemSelectProps {
  value: CatalogItem | null;
  onChange: (item: CatalogItem | null) => void;
  onFreeText?: (text: string) => void;
  freeTextValue?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Searchable stock-catalog picker. Links requisition lines to inventory items
 * so stores can match stock exactly (BuildSmart / paper IR best practice).
 */
export function ItemSelect({
  value,
  onChange,
  onFreeText,
  freeTextValue = '',
  placeholder = 'Search stock catalog or type description…',
  className = ''
}: ItemSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(freeTextValue || value?.name || '');
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await api.get('/department/catalog-items', { params: { search: query, limit: 15 } });
        setResults(res.data.data || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, open]);

  const select = (item: CatalogItem) => {
    onChange(item);
    setQuery(item.name);
    setOpen(false);
  };

  const handleInput = (text: string) => {
    setQuery(text);
    onChange(null);
    onFreeText?.(text);
    if (!open) setOpen(true);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={
            className ||
            'w-full pl-8 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary'
          }
        />
        <ChevronDown
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {value && (
        <p className="text-[11px] text-emerald-600 mt-0.5 flex items-center gap-1">
          <Package className="h-3 w-3" />
          Catalog: {value.code} · {value.quantityAvailable} in stock
        </p>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-4 text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-500">
              {query.trim() ? 'No catalog match — will be treated as non-stock item' : 'Type to search catalog…'}
            </p>
          ) : (
            results.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => select(item)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
              >
                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">
                  {item.code} · {item.unit}
                  <span className={item.quantityAvailable > 0 ? ' text-emerald-600' : ' text-amber-600'}>
                    {' '}
                    · {item.quantityAvailable} available
                  </span>
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
