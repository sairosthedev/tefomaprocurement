import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type PaginationProps = {
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
  itemLabel?: string;
};

export default function Pagination({
  page,
  pages,
  total,
  onPageChange,
  className = '',
  itemLabel = 'items'
}: PaginationProps) {
  if (total === 0) return null;

  const safePages = Math.max(pages, 1);

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-6 py-4 border-t border-gray-100 ${className}`}>
      <p className="text-sm text-gray-500">
        Page {page} of {safePages} · {total} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(page - 1, 1))}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(page + 1, safePages))}
          disabled={page >= safePages}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
