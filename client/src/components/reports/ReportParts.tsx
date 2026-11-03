import React from 'react';

/**
 * The Reports tabs with the open tab's own controls on the same line, so the
 * controls don't need a row of their own.
 */
export function ReportsTabRow({ tabs, children }: { tabs?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4 ${
        tabs ? 'border-b border-gray-200' : ''
      }`}
    >
      <div className="-mb-px">{tabs}</div>
      {children && <div className="flex flex-wrap items-center gap-2 pb-2">{children}</div>}
    </div>
  );
}

/** Headline numbers in one compact card, however many there are. */
export function StatStrip({ stats }: { stats: { label: string; value: React.ReactNode; tone?: string }[] }) {
  if (!stats.length) return null;
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <dl className="flex flex-wrap gap-x-10 gap-y-3 px-5 py-3">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <dt className="text-[11px] uppercase tracking-wide text-gray-400">{stat.label}</dt>
            <dd className={`mt-0.5 text-xl font-semibold truncate ${stat.tone || 'text-gray-900'}`}>{stat.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** A titled white card for a list or chart. */
export function ReportCard({ title, className = '', children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 ${className}`}>
      <h2 className="text-sm font-semibold text-gray-900 mb-2">{title}</h2>
      {children}
    </section>
  );
}

export const TOOLBAR_BUTTON =
  'inline-flex items-center gap-1.5 px-3 py-[7px] text-sm font-medium text-gray-700 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors';
export const TOOLBAR_SELECT =
  'px-3 py-[7px] text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary';
