import React from 'react';

export type Fact = {
  label: string;
  value: React.ReactNode;
  /** A second, quieter line under the value. */
  sub?: string;
  /** Long values (an address): two columns wide and wrapped rather than cut off. */
  wide?: boolean;
};

/**
 * The compact facts card used on detail views (as on QuotationDetail): one
 * card of label / value pairs instead of a stack of small full-width sections.
 */
export default function FactsCard({
  facts,
  cols = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  className = ''
}: {
  facts: Fact[];
  /** Grid column classes; detail pages can afford more columns than a modal. */
  cols?: string;
  className?: string;
}) {
  return (
    <section className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${className}`}>
      <dl className={`grid ${cols} gap-x-6 gap-y-3 px-5 py-4`}>
        {facts.map((fact) => (
          <div key={fact.label} className={`min-w-0 ${fact.wide ? 'col-span-2' : ''}`}>
            <dt className="text-[11px] uppercase tracking-wide text-gray-400">{fact.label}</dt>
            <dd className={`mt-0.5 text-sm font-medium text-gray-900 ${fact.wide ? 'break-words' : 'truncate'}`} title={typeof fact.value === 'string' ? fact.value : undefined}>
              {fact.value}
            </dd>
            {fact.sub && <dd className="text-xs text-gray-500 truncate" title={fact.sub}>{fact.sub}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}
