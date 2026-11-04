import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';
import { 
  FileSearch, Clock, Send, 
  Calendar, AlertCircle, CheckCircle, PartyPopper
} from 'lucide-react';
import ViewButton from '../../components/ViewButton';
import Modal from '../../components/Modal';
import PageHeader from '../../components/PageHeader';
import Pagination from '../../components/Pagination';
import TableSkeleton from '../../components/TableSkeleton';
import { SubmitQuotationDrawer } from '../../components/QuotationForm';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../../lib/pagination';

const statusColors: any = {
  open: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  awarded: 'bg-purple-100 text-purple-700',
  accepted: 'bg-emerald-100 text-emerald-700'
};

// Simple Confetti Component
const Confetti = ({ show }: any) => {
  const canvasRef = useRef<any>(null);

  useEffect(() => {
    if (!show) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const confetti: any[] = [];
    const colors = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#fbbf24', '#fcd34d', '#fde68a'];

    // Create confetti pieces
    for (let i = 0; i < 100; i++) {
      confetti.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        r: Math.random() * 6 + 4,
        d: Math.random() * 5 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 5,
        tiltAngleIncrement: Math.random() * 0.1 + 0.05,
        tiltAngle: 0
      });
    }

    let animationId: any;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      confetti.forEach((c: any, i: any) => {
        ctx.beginPath();
        ctx.lineWidth = c.r;
        ctx.strokeStyle = c.color;
        ctx.moveTo(c.x + c.tilt + c.r, c.y);
        ctx.lineTo(c.x + c.tilt, c.y + c.tilt + c.r);
        ctx.stroke();

        c.tiltAngle += c.tiltAngleIncrement;
        c.y += (Math.cos(c.d) + 3 + c.r / 2) / 2;
        c.tilt = Math.sin(c.tiltAngle - i / 3) * 15;

        if (c.y > canvas.height) {
          confetti[i] = {
            ...c,
            x: Math.random() * canvas.width,
            y: -20,
            tilt: Math.random() * 10 - 5
          };
        }
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    // Stop after 3 seconds
    const timeout = setTimeout(() => {
      if (animationId) cancelAnimationFrame(animationId);
    }, 3000);

    return () => {
      clearTimeout(timeout);
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [show]);

  if (!show) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999
      }}
    />
  );
};

export default function MyRFQs() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [rfqs, setRFQs] = useState<any[]>([]);
  const [loading, setLoading] = useState<any>(true);
  const [selectedRFQ, setSelectedRFQ] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState<any>(false);
  const [showConfetti, setShowConfetti] = useState<any>(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(emptyPagination());
  // The RFQ open in the quotation drawer, priced from its row without leaving the list.
  const [quoting, setQuoting] = useState<any>(null);

  useEffect(() => {
    fetchMyRFQs();
  }, [page, limit]);

  const handleQuoted = () => {
    setQuoting(null);
    // The quoted RFQ now shows as submitted.
    fetchMyRFQs();
  };

  const fetchMyRFQs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/supplier/rfqs', { params: { page, limit } });
      if (response.data.success) {
        setRFQs(response.data.data || []);
        setPagination(parsePagination(response.data.pagination));
      }
    } catch (error: any) {
      console.error('Failed to fetch RFQs:', error);
      showToast('Failed to load RFQs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getRemainingTime = (deadline: any) => {
    const now = new Date();
    const end = new Date(deadline);
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return { text: 'Closed', urgent: false };
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return { text: `${days}d ${hours}h remaining`, urgent: days <= 2 };
    return { text: `${hours}h remaining`, urgent: true };
  };

  return (
    <div className="p-8">
      <Confetti show={showConfetti} />
      <PageHeader
        title="My RFQs"
        subtitle="View and respond to Request for Quotations"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 rounded-2xl p-5 border border-green-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-xl">
              <FileSearch className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-green-600">Open RFQs</p>
              <p className="text-2xl font-bold text-green-700">
                {rfqs.filter((r: any) => r.status === 'open' && !r.hasSubmitted).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Send className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-600">Submitted</p>
              <p className="text-2xl font-bold text-blue-700">
                {rfqs.filter((r: any) => r.hasSubmitted && r.quotationStatus !== 'accepted').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <PartyPopper className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-emerald-600">Accepted</p>
              <p className="text-2xl font-bold text-emerald-700">
                {rfqs.filter((r: any) => r.quotationStatus === 'accepted').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-xl">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-amber-600">Closing Soon</p>
              <p className="text-2xl font-bold text-amber-700">
                {rfqs.filter((r: any) => {
                  const remaining = getRemainingTime(r.submissionDeadline);
                  return remaining.urgent && r.status === 'open';
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RFQs List */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">RFQ #</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Title</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Items</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Closing</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Status</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          {loading ? (
            <TableSkeleton cols={6} />
          ) : rfqs.length === 0 ? (
            <tbody>
              <tr><td colSpan={6} className="text-center py-12 text-gray-500">
                <FileSearch className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p>No RFQs available</p>
                <p className="text-sm text-gray-400 mt-1">You'll be notified when new RFQs are published</p>
              </td></tr>
            </tbody>
          ) : (
            <tbody>
              {rfqs.map((rfq: any) => {
                const remaining = getRemainingTime(rfq.submissionDeadline);
                const canSubmit = rfq.status === 'open' && !rfq.hasSubmitted && remaining.text !== 'Closed';

                return (
                  <tr key={rfq._id} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                    <td className="py-2 px-3 border-b border-gray-100">
                      <span className="font-mono font-medium text-primary">
                        {rfq.rfqNumber || `RFQ-${rfq._id.slice(-6).toUpperCase()}`}
                      </span>
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100">
                      <p className="font-medium text-gray-900">{rfq.title}</p>
                      <p className="text-xs text-gray-500 truncate max-w-xs">{rfq.description}</p>
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100">
                      <span className="text-gray-600">{rfq.items?.length || 0} items</span>
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <Clock className={`h-4 w-4 ${remaining.urgent ? 'text-red-500' : 'text-gray-400'}`} />
                        <span className={`${remaining.urgent ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                          {remaining.text}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(rfq.submissionDeadline).toLocaleDateString('en-ZA')}
                      </p>
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100">
                      {rfq.quotationStatus === 'accepted' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          <PartyPopper className="h-3.5 w-3.5" />
                          Accepted
                        </span>
                      ) : rfq.hasSubmitted ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          Submitted
                        </span>
                      ) : (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[rfq.status] || statusColors.open}`}>
                          {rfq.status === 'open' ? 'Open' : rfq.status}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <ViewButton
                          onClick={() => navigate(`/app/my-rfqs/${rfq._id}`)}
                        />
                        {canSubmit && (
                          <button
                            onClick={() => setQuoting(rfq)}
                            className="px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                          >
                            Submit Quote
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      </div>
      {!loading && <Pagination
        page={page}
        pages={pagination.pages}
        total={pagination.total}
        onPageChange={setPage}
        pageSize={limit}
        onPageSizeChange={(s) => { setLimit(s); setPage(1); }}
        itemLabel="RFQs"
      />}

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title="RFQ Details"
        size="xl"
      >
        {selectedRFQ && (
          <div className="space-y-6">
            {/* Celebration Banner for Accepted Quotations */}
            {selectedRFQ.quotationStatus === 'accepted' && (
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-xl p-4 flex items-center gap-3 animate-pulse">
                <PartyPopper className="h-8 w-8 text-emerald-600" />
                <div className="flex-1">
                  <p className="font-bold text-emerald-800 text-lg">🎉 Congratulations! Your Quotation Has Been Accepted!</p>
                  <p className="text-sm text-emerald-700 mt-1">Your quotation for this RFQ has been accepted by the procurement team.</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">RFQ Number</label>
                <p className="font-mono font-medium text-primary">
                  {selectedRFQ.rfqNumber || `RFQ-${selectedRFQ._id.slice(-6).toUpperCase()}`}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Submission Deadline</label>
                <p className="text-gray-900">
                  {new Date(selectedRFQ.submissionDeadline).toLocaleString('en-ZA')}
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500">Title</label>
              <p className="text-gray-900 font-medium">{selectedRFQ.title}</p>
            </div>

            <div>
              <label className="text-sm text-gray-500">Description</label>
              <p className="text-gray-900">{selectedRFQ.description || 'No description provided'}</p>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-2 block">Items Required</label>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">#</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Description</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Quantity</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Specification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRFQ.items?.map((item: any, index: any) => (
                      <tr key={index} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                        <td className="py-2 px-3 border-b border-gray-100">{index + 1}</td>
                        <td className="py-2 px-3 border-b border-gray-100 font-medium">{item.description}</td>
                        <td className="py-2 px-3 border-b border-gray-100">{item.quantity} {item.unit}</td>
                        <td className="py-2 px-3 border-b border-gray-100 text-gray-500">{item.specifications || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedRFQ.terms && (
              <div>
                <label className="text-sm text-gray-500">Terms & Conditions</label>
                <p className="text-gray-900 text-sm whitespace-pre-wrap">{selectedRFQ.terms}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <SubmitQuotationDrawer
        isOpen={!!quoting}
        rfqId={quoting?._id}
        rfq={quoting}
        onClose={() => setQuoting(null)}
        onSaved={handleQuoted}
      />
    </div>
  );
}

