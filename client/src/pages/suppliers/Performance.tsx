import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, CalendarClock, CheckCircle2, ClipboardList, Loader2, Trophy, XCircle } from 'lucide-react'
import { procurementAPI } from '../../services/procurement.service'
import { useToast } from '../../components/Toast'
import PageHeader, { PageStatCard } from '../../components/PageHeader'
import Pagination from '../../components/Pagination'
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../../lib/pagination'

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-ZA')
}

function scoreBarWidth(score: number) {
  if (!score) return 0
  return Math.round((score / 5) * 100)
}

export default function Performance() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [report, setReport] = useState<any>(null)
  const [suppliersDue, setSuppliersDue] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(emptyPagination())

  useEffect(() => {
    load()
  }, [page])

  const load = async () => {
    try {
      setLoading(true)
      const [reportResponse, dueResponse] = await Promise.all([
        procurementAPI.getSupplierReports({ page, limit: DEFAULT_PAGE_SIZE }),
        procurementAPI.getEvaluationsDue()
      ])
      setReport(reportResponse.data.data)
      setPagination(parsePagination(reportResponse.data.pagination))
      setSuppliersDue(dueResponse.data.data?.suppliersDueForReview || [])
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load performance analytics', 'error')
    } finally {
      setLoading(false)
    }
  }

  const summary = report?.summary
  const registry = report?.registry || []
  const scoreBands = summary?.scoreBands || { excellent: 0, good: 0, watch: 0, low: 0, unrated: 0 }

  const performanceRows = useMemo(() => {
    return [...registry]
      .filter((row) => row.overallScore > 0)
      .sort((a, b) => b.overallScore - a.overallScore)
  }, [registry])

  const unratedOnPage = useMemo(
    () => registry.filter((row) => !row.overallScore).length,
    [registry]
  )

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Performance"
        subtitle="Supplier scores from recorded evaluations (1–5 scale). Create evaluations under Suppliers → Evaluations."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/app/suppliers/evaluations')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
            >
              <ClipboardList className="h-4 w-4" />
              Evaluations
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/suppliers')}
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back to Suppliers
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <PageStatCard label="Active suppliers" value={summary?.active ?? 0} />
        <PageStatCard label="Evaluations recorded" value={summary?.evaluationsRecorded ?? 0} valueClassName="text-emerald-600" />
        <PageStatCard
          label="Average score"
          value={summary?.averageScore ? `${summary.averageScore}/5` : '—'}
          valueClassName="text-amber-600"
        />
        <PageStatCard label="Due for evaluation" value={summary?.dueForReview ?? 0} valueClassName="text-rose-600" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr] items-start">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 text-gray-500 text-sm"><Trophy className="h-4 w-4 text-amber-500" /> Excellent (4.5+)</div>
              <div className="mt-3 text-3xl font-bold text-gray-900">{scoreBands.excellent}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 text-gray-500 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Good (3.5+)</div>
              <div className="mt-3 text-3xl font-bold text-gray-900">{scoreBands.good}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 text-gray-500 text-sm"><CalendarClock className="h-4 w-4 text-amber-500" /> Watch (2.5+)</div>
              <div className="mt-3 text-3xl font-bold text-gray-900">{scoreBands.watch}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 text-gray-500 text-sm"><XCircle className="h-4 w-4 text-rose-500" /> Low / unrated</div>
              <div className="mt-3 text-3xl font-bold text-gray-900">{scoreBands.low + scoreBands.unrated}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Top suppliers</h2>
                <p className="text-sm text-gray-500">Ranked by latest evaluation score.</p>
              </div>
              <BarChart3 className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              {performanceRows.map((row, index) => (
                <button
                  key={row._id || index}
                  type="button"
                  onClick={() => navigate(`/app/suppliers/${row._id}?tab=performance`)}
                  className="w-full text-left rounded-2xl border border-gray-100 bg-gray-50 p-4 hover:border-primary/30 hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{row.companyName}</p>
                      <p className="text-xs text-gray-500 mt-1 capitalize">
                        {row.status} · {row.evaluationCount} evaluation{row.evaluationCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-gray-900">{row.overallScore}/5</p>
                      <p className="text-xs text-gray-500">Overall score</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500"
                      style={{ width: `${scoreBarWidth(row.overallScore)}%` }}
                    />
                  </div>
                </button>
              ))}
              {performanceRows.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-gray-500 space-y-3">
                  <p>No evaluation scores yet.</p>
                  <button
                    type="button"
                    onClick={() => navigate('/app/suppliers/evaluations')}
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Record an evaluation
                  </button>
                </div>
              )}
              {unratedOnPage > 0 && performanceRows.length > 0 && (
                <p className="text-xs text-gray-500 text-center pt-2">
                  {unratedOnPage} supplier{unratedOnPage === 1 ? '' : 's'} on this page ha{unratedOnPage === 1 ? 's' : 've'} not been evaluated yet.
                </p>
              )}
            </div>
            <Pagination
              page={page}
              pages={pagination.pages}
              total={pagination.total}
              onPageChange={setPage}
              itemLabel="suppliers"
            />
          </div>
        </div>

        <aside className="space-y-6 sticky top-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Due for evaluation</h3>
            <p className="mt-1 text-xs text-gray-500">Overdue or never evaluated (quarterly cycle).</p>
            <div className="mt-4 space-y-3">
              {suppliersDue.slice(0, 8).map((supplier) => (
                <div key={supplier._id} className="rounded-xl bg-gray-50 px-3 py-3">
                  <p className="text-sm font-medium text-gray-900">{supplier.companyName}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Last: {formatDate(supplier.lastEvaluationAt)} · Next due: {formatDate(supplier.nextEvaluationDue)}
                  </p>
                </div>
              ))}
              {suppliersDue.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
                  All active suppliers are up to date.
                </div>
              )}
            </div>
            {suppliersDue.length > 0 && (
              <button
                type="button"
                onClick={() => navigate('/app/suppliers/evaluations')}
                className="mt-4 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Open evaluations
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">How scores work</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li>• Scores come from procurement evaluations (7 criteria, 1–5 each).</li>
              <li>• Average of criteria = overall score out of 5.</li>
              <li>• Re-evaluate suppliers quarterly from the Evaluations page.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
