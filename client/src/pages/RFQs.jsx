import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementAPI } from '../lib/api';
import { 
  Search, 
  Plus, 
  MoreVertical, 
  FileSearch,
  Calendar,
  Users,
  Loader2,
  Send
} from 'lucide-react';
import ViewButton from '../components/ViewButton';

const statusColors = {
  draft: 'bg-gray-100 text-gray-700',
  open: 'bg-blue-100 text-blue-700',
  closed: 'bg-amber-100 text-amber-700',
  evaluating: 'bg-purple-100 text-purple-700',
  awarded: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700'
};

export default function RFQs() {
  const navigate = useNavigate();
  const [rfqs, setRFQs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchRFQs();
  }, [search, statusFilter]);

  const fetchRFQs = async () => {
    try {
      setLoading(true);
      const response = await procurementAPI.getRFQs({ 
        search, 
        status: statusFilter 
      });
      setRFQs(response.data.data);
    } catch (error) {
      console.error('Error fetching RFQs:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RFQs (Enquiries)</h1>
          <p className="text-gray-500 mt-1">Manage requests for quotations</p>
        </div>
        <button 
          onClick={() => navigate('/app/rfqs/create')}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 px-4 rounded-xl transition-colors"
        >
          <Plus className="h-5 w-5" />
          Create RFQ
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search RFQs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="evaluating">Evaluating</option>
            <option value="awarded">Awarded</option>
          </select>
        </div>
      </div>

      {/* RFQ Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      ) : rfqs.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
          <FileSearch className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No RFQs found</h3>
          <p className="text-gray-500 mt-1">Create your first RFQ to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rfqs.map((rfq) => (
            <div 
              key={rfq._id}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColors[rfq.status]}`}>
                    {rfq.status.charAt(0).toUpperCase() + rfq.status.slice(1)}
                  </span>
                  <h3 className="font-semibold text-gray-900 mt-3">{rfq.rfqNumber}</h3>
                </div>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <MoreVertical className="h-5 w-5 text-gray-400" />
                </button>
              </div>
              
              <p className="text-gray-700 font-medium line-clamp-2 mb-4">{rfq.title}</p>
              
              <div className="space-y-2 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Deadline: {new Date(rfq.submissionDeadline).toLocaleDateString('en-ZA')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-700 mb-1">
                      {rfq.invitedSuppliers?.length || 0} supplier{rfq.invitedSuppliers?.length !== 1 ? 's' : ''} invited
                    </div>
                    {rfq.invitedSuppliers && rfq.invitedSuppliers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {rfq.invitedSuppliers.slice(0, 3).map((invited, idx) => {
                          const supplierName = invited.supplier?.companyName || 
                                             (typeof invited.supplier === 'string' ? 'Loading...' : 'Unknown Supplier');
                          return (
                            <span 
                              key={invited.supplier?._id || invited.supplier || idx} 
                              className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-md truncate max-w-[120px]"
                              title={supplierName}
                            >
                              {supplierName}
                            </span>
                          );
                        })}
                        {rfq.invitedSuppliers.length > 3 && (
                          <span className="inline-block px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-md font-medium">
                            +{rfq.invitedSuppliers.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6 pt-4 border-t border-gray-100">
                <ViewButton
                  onClick={() => navigate(`/app/rfqs/${rfq._id}`)}
                  className="flex-1 justify-center"
                />
                {rfq.status === 'draft' && (
                  <button className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors">
                    <Send className="h-4 w-4" />
                    Publish
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

