import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { procurementAPI } from '../lib/api';
import PageHeader from '../components/PageHeader';
import { CheckCircle, Clock, Loader2, Layers, FileText } from 'lucide-react';
import { formatCurrency } from '../lib/constants';
import { getCurrentSbuCurrency } from '../lib/sbu';

/**
 * The Head of Procurement's queue: winning quotations (or split-award lines)
 * that procurement has selected and that wait on their authorization. The
 * authorize control itself lives on the quotation and award pages, so each row
 * links there.
 */
export default function Authorizations() {
  const { showToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const response = await procurementAPI.getPendingAuthorizations();
      if (response.data.success) {
        setItems(response.data.data || []);
      }
    } catch (error: any) {
      console.error('Failed to fetch pending authorizations:', error);
      showToast(error.response?.data?.message || 'Failed to load authorizations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const linkFor = (item: any) =>
    item.kind === 'quotation' ? `/app/quotations/${item.quotationId}` : `/app/rfqs/${item.rfqId}/award`;

  const valueOf = (item: any) => {
    const amount = item.kind === 'quotation' ? item.totalAmount : item.linesTotal;
    if (typeof amount !== 'number') return '—';
    return formatCurrency(amount, item.currency || getCurrentSbuCurrency());
  };

  // Rows the user selected themselves cannot be authorized by them, so they
  // are not counted as waiting on them.
  const actionable = items.filter((i: any) => !i.selectedByMe).length;

  return (
    <div className="p-8">
      <PageHeader
        title="Authorizations"
        subtitle="Winning quotations selected by procurement that need your authorization"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-xl">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-amber-600 font-medium">Awaiting You</p>
              <p className="text-2xl font-bold text-amber-700">{actionable}</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-600 font-medium">Whole Quotations</p>
              <p className="text-2xl font-bold text-blue-700">
                {items.filter((i: any) => i.kind === 'quotation').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 rounded-2xl p-5 border border-purple-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Layers className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-purple-600 font-medium">Split Awards</p>
              <p className="text-2xl font-bold text-purple-700">
                {items.filter((i: any) => i.kind === 'lines').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="h-12 w-12 text-green-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Nothing awaiting authorization</p>
            <p className="text-sm text-gray-400 mt-1">
              Quotations appear here once procurement selects a winner
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">RFQ</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Award</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Value</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Justification</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Selected</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item: any) => (
                  <tr key={`${item.rfqId}-${item.kind}`} className="hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm font-medium text-primary break-all">{item.rfqNumber}</span>
                      <p className="text-sm text-gray-500 truncate max-w-xs">{item.title}</p>
                    </td>
                    <td className="py-4 px-6">
                      {item.kind === 'quotation' ? (
                        <>
                          <p className="font-medium text-gray-900">{item.supplierName || 'Unknown supplier'}</p>
                          <p className="text-xs text-gray-500 font-mono">{item.quotationNumber}</p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-gray-900">
                            {item.lineCount} {item.lineCount === 1 ? 'line' : 'lines'}
                          </p>
                          <p className="text-xs text-gray-500">Split award</p>
                        </>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-semibold text-gray-900">{valueOf(item)}</span>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm text-gray-600 max-w-xs line-clamp-2">
                        {item.justification || (item.kind === 'lines' ? 'See each line' : '—')}
                      </p>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-500">
                      <p className="text-gray-900">{item.selectedBy || '—'}</p>
                      {item.selectedAt && (
                        <p className="text-xs">{new Date(item.selectedAt).toLocaleDateString('en-ZA')}</p>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      {item.selectedByMe ? (
                        // The API refuses self-authorization; say so rather
                        // than send them to a button that will fail.
                        <div className="flex flex-col gap-1">
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 w-fit">
                            You selected this
                          </span>
                          <Link to={linkFor(item)} className="text-xs text-primary hover:underline">
                            View
                          </Link>
                        </div>
                      ) : (
                        <Link
                          to={linkFor(item)}
                          className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                        >
                          Review
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
