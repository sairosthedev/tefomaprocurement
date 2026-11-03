import React, { useEffect, useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import Pagination from './Pagination';
import FilterSelect from './FilterSelect';

type ResponseFilter = 'all' | 'responded' | 'waiting';

const th = 'text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap';
const td = 'py-2 px-3 border-b border-gray-100';

/**
 * The suppliers asked to quote on an RFQ. An RFQ can invite hundreds, so this
 * is a searchable, filterable table a page at a time rather than one card per
 * supplier.
 */
export default function InvitedSuppliersList({
  invitations,
  bidsAreSealed,
  onViewQuotation
}: {
  invitations: any[];
  bidsAreSealed: boolean;
  onViewQuotation: (quotationId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ResponseFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const respondedCount = useMemo(() => invitations.filter((i) => i.responded).length, [invitations]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invitations.filter((inv) => {
      if (filter === 'responded' && !inv.responded) return false;
      if (filter === 'waiting' && inv.responded) return false;
      if (!q) return true;
      return [inv.supplier?.companyName, inv.supplier?.contactEmail, inv.invitationReason]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [invitations, search, filter]);

  useEffect(() => setPage(1), [search, filter, pageSize]);

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = rows.slice((page - 1) * pageSize, page * pageSize);

  const filters: Array<{ key: ResponseFilter; label: string; count: number }> = [
    { key: 'all', label: 'All', count: invitations.length },
    { key: 'responded', label: 'Responded', count: respondedCount },
    { key: 'waiting', label: 'Not yet', count: invitations.length - respondedCount }
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Invited Suppliers ({invitations.length})
        </h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:ml-auto">
          <div className="relative w-full sm:w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-[7px] text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <FilterSelect
            size="sm"
            label="Response"
            options={filters.map((f) => ({ value: f.key === 'all' ? '' : f.key, label: f.label, count: f.count }))}
            value={filter === 'all' ? '' : filter}
            onChange={(v) => setFilter((v || 'all') as ResponseFilter)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className={th}>Supplier</th>
              <th className={th}>Why invited</th>
              <th className={th}>Response</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={4} className={`${td} text-center text-gray-500 py-6`}>
                  No invited suppliers match.
                </td>
              </tr>
            ) : (
              visible.map((inv, i) => (
                <tr
                  key={inv.supplier?._id || inv._id || i}
                  className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors"
                >
                  <td className={td}>
                    <p className="font-medium text-gray-900">{inv.supplier?.companyName || 'Supplier'}</p>
                    {inv.supplier?.contactEmail && <p className="text-xs text-gray-500">{inv.supplier.contactEmail}</p>}
                  </td>
                  {/* Why this supplier is on the list. Auto-invited names carry
                      the match that put them here, so the list can be defended. */}
                  <td className={`${td} text-xs text-gray-600`}>
                    {inv.autoInvited && (
                      <span className="inline-block px-1.5 py-0.5 mr-1.5 rounded bg-blue-50 text-blue-700 font-medium whitespace-nowrap">
                        {inv.basis === 'related_category_topup' ? 'Auto · related' : 'Auto · category'}
                      </span>
                    )}
                    {inv.invitationReason || '—'}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    {inv.responded ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        Submitted
                        {inv.respondedAt && ` · ${new Date(inv.respondedAt).toLocaleDateString('en-ZA')}`}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Not yet</span>
                    )}
                  </td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    {inv.quotation && !bidsAreSealed && (
                      <button
                        type="button"
                        onClick={() => onViewQuotation(inv.quotation._id)}
                        className="px-2 py-1 text-xs border border-primary rounded bg-primary text-white hover:bg-primary-dark transition-colors"
                      >
                        View quotation
                      </button>
                    )}
                    {inv.responded && bidsAreSealed && (
                      <span className="text-xs text-amber-600 font-medium">Bid sealed</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rows.length > 10 && (
        <Pagination
          page={page}
          pages={pages}
          total={rows.length}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          itemLabel="suppliers"
          className="px-0"
        />
      )}
    </div>
  );
}
