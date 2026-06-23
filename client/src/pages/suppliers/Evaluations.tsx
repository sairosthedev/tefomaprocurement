import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,
  Star,
  X
} from 'lucide-react'
import { SUPPLIER_EVALUATION_CRITERIA, isProcurementHead } from '@fossil/shared'
import { procurementAPI } from '../../services/procurement.service'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../context/AuthContext'
import PageHeader, { PageStatCard } from '../../components/PageHeader'
import Pagination from '../../components/Pagination'
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../../lib/pagination'

type Tab = 'due' | 'all'

const STATUS_LABELS: Record<string, string> = {
  approved: 'Recorded',
  rejected: 'Rejected'
}

const STATUS_COLORS: Record<string, string> = {
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
  pending_hod: 'bg-amber-100 text-amber-800',
  pending_sec: 'bg-blue-100 text-blue-800'
}

const RECOMMENDATION_OPTIONS = [
  { value: 'approve', label: 'Approve' },
  { value: 'conditional', label: 'Conditional approval' },
  { value: 're_evaluate_later', label: 'Re-evaluate later' },
  { value: 'reject', label: 'Reject' }
]

const EVALUATION_TYPES = [
  { value: 'initial', label: 'Initial evaluation' },
  { value: 're_evaluation', label: 'Re-evaluation' },
  { value: 'quarterly_review', label: 'Quarterly review' }
]

function formatDate(value?: string) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-ZA')
}

function supplierName(evaluation: any) {
  return evaluation?.supplier?.companyName || 'Unknown supplier'
}

function emptyScores() {
  return SUPPLIER_EVALUATION_CRITERIA.reduce((acc, criterion) => {
    acc[criterion.key] = 3
    return acc
  }, {} as Record<string, number>)
}

export default function Evaluations() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('due')
  const [suppliersDue, setSuppliersDue] = useState<any[]>([])
  const [allEvaluations, setAllEvaluations] = useState<any[]>([])
  const [allPage, setAllPage] = useState(1)
  const [allPagination, setAllPagination] = useState(emptyPagination())

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)

  const [evaluationType, setEvaluationType] = useState('initial')
  const [recommendation, setRecommendation] = useState('approve')
  const [scores, setScores] = useState<Record<string, number>>(emptyScores)
  const [otherNotes, setOtherNotes] = useState('')

  const canCreate = user?.role === 'admin' || user?.role === 'procurement_officer' || isProcurementHead(user)

  useEffect(() => {
    loadDue()
    loadAllEvaluations()
  }, [])

  useEffect(() => {
    if (activeTab === 'all') {
      loadAllEvaluations()
    }
  }, [activeTab, allPage])

  const loadDue = async () => {
    try {
      const dueResponse = await procurementAPI.getEvaluationsDue()
      setSuppliersDue(dueResponse.data.data?.suppliersDueForReview || [])
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load due suppliers', 'error')
    }
  }

  const loadAllEvaluations = async () => {
    try {
      setLoading(true)
      const allResponse = await procurementAPI.getEvaluations({ page: allPage, limit: DEFAULT_PAGE_SIZE })
      setAllEvaluations(allResponse.data.data || [])
      setAllPagination(parsePagination(allResponse.data.pagination))
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load evaluations', 'error')
    } finally {
      setLoading(false)
    }
  }

  const refresh = async () => {
    await Promise.all([loadDue(), loadAllEvaluations()])
  }

  const totals = useMemo(() => ({
    due: suppliersDue.length,
    total: allPagination.total || allEvaluations.length,
    approved: allEvaluations.filter((e) => e.status === 'approved').length,
    rejected: allEvaluations.filter((e) => e.status === 'rejected').length
  }), [suppliersDue.length, allPagination.total, allEvaluations])

  const openCreateModal = (supplier: any) => {
    setSelectedSupplier(supplier)
    setEvaluationType('initial')
    setRecommendation('approve')
    setScores(emptyScores())
    setOtherNotes('')
    setShowCreateModal(true)
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
    setSelectedSupplier(null)
  }

  const handleCreateEvaluation = async () => {
    if (!selectedSupplier?._id) return

    const missing = SUPPLIER_EVALUATION_CRITERIA.filter(
      (criterion) => !scores[criterion.key] || scores[criterion.key] < 1 || scores[criterion.key] > 5
    )
    if (missing.length > 0) {
      showToast('Please score every evaluation criterion (1–5)', 'error')
      return
    }

    try {
      setSubmitting(true)
      await procurementAPI.createSupplierEvaluation(selectedSupplier._id, {
        evaluationType,
        recommendation,
        scores: { ...scores, otherNotes }
      })
      showToast('Evaluation saved', 'success')
      closeCreateModal()
      await refresh()
      setActiveTab('all')
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to save evaluation', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && allEvaluations.length === 0 && suppliersDue.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Evaluations"
        subtitle="Score suppliers against procurement criteria and track quarterly re-evaluations. Evaluations are saved immediately — no approval step."
        actions={
          <button
            type="button"
            onClick={() => navigate('/app/suppliers')}
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Suppliers
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <PageStatCard label="Due for review" value={totals.due} valueClassName="text-amber-600" />
        <PageStatCard label="Total recorded" value={totals.total} />
        <PageStatCard label="Positive" value={totals.approved} valueClassName="text-emerald-600" />
        <PageStatCard label="Rejected" value={totals.rejected} valueClassName="text-rose-600" />
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          { key: 'due', label: `Due for review (${totals.due})` },
          { key: 'all', label: `All evaluations (${totals.total})` }
        ] as const).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-primary text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'due' && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Suppliers due for evaluation</h2>
            <p className="text-sm text-gray-500 mt-1">Active suppliers with no recent evaluation or overdue quarterly review.</p>
          </div>
          <div className="divide-y divide-gray-100">
            {suppliersDue.map((supplier) => (
              <div key={supplier._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="font-semibold text-gray-900">{supplier.companyName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span className="capitalize">{supplier.status}</span>
                    <span>Last evaluation: {formatDate(supplier.lastEvaluationAt)}</span>
                    <span>Next due: {formatDate(supplier.nextEvaluationDue)}</span>
                    {supplier.kysComplete && (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        KYS complete
                      </span>
                    )}
                  </div>
                </div>
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => openCreateModal(supplier)}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                  >
                    <Plus className="h-4 w-4" />
                    Evaluate
                  </button>
                )}
              </div>
            ))}
            {suppliersDue.length === 0 && (
              <div className="px-5 py-10 text-center text-gray-500">
                No suppliers are currently due for evaluation.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'all' && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3">Supplier</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Score</th>
                  <th className="px-5 py-3">Recommendation</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Next review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allEvaluations.map((evaluation) => (
                  <tr key={evaluation._id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 font-medium text-gray-900">{supplierName(evaluation)}</td>
                    <td className="px-5 py-4 capitalize text-gray-600">{String(evaluation.evaluationType || '').replace(/_/g, ' ')}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 font-semibold text-gray-900">
                        <Star className="h-3.5 w-3.5 text-amber-500" />
                        {evaluation.overallScore}/5
                      </span>
                    </td>
                    <td className="px-5 py-4 capitalize text-gray-600">{evaluation.recommendation}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[evaluation.status] || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABELS[evaluation.status] || evaluation.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-600">{formatDate(evaluation.createdAt)}</td>
                    <td className="px-5 py-4 text-gray-600">{formatDate(evaluation.nextReviewDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {allEvaluations.length === 0 && (
            <div className="px-5 py-10 text-center text-gray-500">
              No evaluations recorded yet.
            </div>
          )}
          <Pagination
            page={allPage}
            pages={allPagination.pages}
            total={allPagination.total}
            onPageChange={setAllPage}
            itemLabel="evaluations"
          />
        </div>
      )}

      {showCreateModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Evaluate supplier</h2>
                <p className="text-sm text-gray-500">{selectedSupplier.companyName}</p>
              </div>
              <button type="button" onClick={closeCreateModal} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Evaluation type</label>
                  <select
                    value={evaluationType}
                    onChange={(e) => setEvaluationType(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  >
                    {EVALUATION_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recommendation</label>
                  <select
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  >
                    {RECOMMENDATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Scoring criteria (1 = poor, 5 = excellent)</h3>
                <div className="space-y-4">
                  {SUPPLIER_EVALUATION_CRITERIA.map((criterion) => (
                    <div key={criterion.key}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm text-gray-700">{criterion.label}</label>
                        <span className="text-sm font-semibold text-primary">{scores[criterion.key]}/5</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        value={scores[criterion.key]}
                        onChange={(e) => setScores({ ...scores, [criterion.key]: Number(e.target.value) })}
                        className="w-full accent-primary"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={otherNotes}
                  onChange={(e) => setOtherNotes(e.target.value)}
                  rows={3}
                  placeholder="Additional comments..."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm resize-none"
                />
              </div>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-100 bg-white px-6 py-4">
              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateEvaluation}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                Save evaluation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
