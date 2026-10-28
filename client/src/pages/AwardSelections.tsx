import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { departmentAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import PageHeader from '../components/PageHeader';
import { Loader2, Trophy, ChevronRight, Inbox } from 'lucide-react';

/**
 * RFQs from the department head's own requisitions that have closed and are
 * waiting for them to choose the winning supplier. Each opens the line-by-line
 * award page, where the selection and its justification are recorded.
 */
export default function AwardSelections() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rfqs, setRfqs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await departmentAPI.getPendingAwardSelections();
        setRfqs(res.data.data || []);
      } catch (e: any) {
        showToast(e.response?.data?.message || 'Failed to load award selections', 'error');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Award Selections"
        subtitle="Closed RFQs from your department's requisitions, waiting for you to choose the winning supplier."
      />

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : rfqs.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <Inbox className="h-10 w-10 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 font-medium">Nothing waiting for your selection</p>
          <p className="text-sm text-gray-400 mt-1">RFQs appear here once they close and their bids are revealed.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
          {rfqs.map((r) => (
            <button
              key={r._id}
              onClick={() => navigate(`/app/rfqs/${r._id}/award`)}
              className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Trophy className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{r.title}</p>
                <p className="text-sm text-gray-500 truncate">
                  {r.rfqNumber}
                  {r.requisition?.requisitionNumber && ` · ${r.requisition.requisitionNumber}`}
                  {r.requisition?.department && ` · ${r.requisition.department}`}
                </p>
              </div>
              <div className="text-right text-sm shrink-0">
                <p className="text-gray-700">{r.quotationCount} {r.quotationCount === 1 ? 'quote' : 'quotes'}</p>
                <p className="text-gray-400">
                  {r.pendingLines} of {r.lineCount} {r.lineCount === 1 ? 'line' : 'lines'} to select
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-300 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
