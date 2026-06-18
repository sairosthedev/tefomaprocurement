import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, CalendarClock, CheckCircle2, Loader2, Trophy, XCircle } from 'lucide-react'
import { procurementAPI } from '../../services/procurement.service'
import { useToast } from '../../components/Toast'
import PageHeader, { PageStatCard } from '../../components/PageHeader'

export default function Performance() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [pendingEvaluations, setPendingEvaluations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      const [suppliersResponse, dueResponse] = await Promise.all([
        procurementAPI.getSuppliers(),
        procurementAPI.getEvaluationsDue()
      ])
      setSuppliers(suppliersResponse.data.data || [])
      setPendingEvaluations(dueResponse.data.data?.pendingEvaluations || [])
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load supplier analytics', 'error')
    } finally {
      setLoading(false)
    }
  }

  const performanceRows = useMemo(() => {
    return suppliers
      .map((supplier) => ({
        ...supplier,
        score: Number(supplier.overallScore || 0),
        statusLabel: supplier.status || 'unknown'
      }))
      .sort((a, b) => b.score - a.score)
  }, [suppliers])

  const totals = useMemo(() => {
    const active = suppliers.filter((supplier) => supplier.status === 'active').length
    const verified = suppliers.filter((supplier) => supplier.kysComplete).length
    const averageScore = suppliers.length
      ? Math.round(suppliers.reduce((sum, supplier) => sum + Number(supplier.overallScore || 0), 0) / suppliers.length)
      : 0
    const dueReviews = pendingEvaluations.length
    return { active, verified, averageScore, dueReviews }
  }, [pendingEvaluations.length, suppliers])

  const scoreBands = useMemo(() => {
    const bands = {
      excellent: 0,
      good: 0,
      watch: 0,
      low: 0
    }

    suppliers.forEach((supplier) => {
      const score = Number(supplier.overallScore || 0)
      if (score >= 85) bands.excellent += 1
      else if (score >= 70) bands.good += 1
      else if (score >= 50) bands.watch += 1
      else bands.low += 1
    })

    return bands
  }, [suppliers])

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
        subtitle="Review supplier scoring, evaluation backlog, and the highest-performing vendors across the portfolio."
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
        <PageStatCard label="Active suppliers" value={totals.active} />
        <PageStatCard label="Verified" value={totals.verified} valueClassName="text-emerald-600" />
        <PageStatCard label="Average score" value={`${totals.averageScore}%`} valueClassName="text-amber-600" />
        <PageStatCard label="Due reviews" value={totals.dueReviews} valueClassName="text-rose-600" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr] items-start">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 text-gray-500 text-sm"><Trophy className="h-4 w-4 text-amber-500" /> Excellent</div>
              <div className="mt-3 text-3xl font-bold text-gray-900">{scoreBands.excellent}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 text-gray-500 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Good</div>
              <div className="mt-3 text-3xl font-bold text-gray-900">{scoreBands.good}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 text-gray-500 text-sm"><CalendarClock className="h-4 w-4 text-amber-500" /> Watchlist</div>
              <div className="mt-3 text-3xl font-bold text-gray-900">{scoreBands.watch}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 text-gray-500 text-sm"><XCircle className="h-4 w-4 text-rose-500" /> Low</div>
              <div className="mt-3 text-3xl font-bold text-gray-900">{scoreBands.low}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Top suppliers</h2>
                <p className="text-sm text-gray-500">Ranked by overall score.</p>
              </div>
              <BarChart3 className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              {performanceRows.slice(0, 6).map((supplier, index) => (
                <div key={supplier._id || supplier.id || index} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{supplier.companyName || supplier.name || 'Unnamed supplier'}</p>
                      <p className="text-xs text-gray-500 mt-1">{supplier.statusLabel}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-gray-900">{supplier.score}%</p>
                      <p className="text-xs text-gray-500">Overall score</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500" style={{ width: `${supplier.score}%` }} />
                  </div>
                </div>
              ))}
              {performanceRows.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-gray-500">
                  No suppliers available for performance analysis.
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-6 sticky top-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Evaluation backlog</h3>
            <p className="mt-1 text-xs text-gray-500">Pending evaluations pulled from the due list.</p>
            <div className="mt-4 space-y-3">
              {pendingEvaluations.slice(0, 5).map((evaluation, index) => (
                <div key={evaluation._id || index} className="rounded-xl bg-gray-50 px-3 py-3">
                  <p className="text-sm font-medium text-gray-900">{evaluation.supplier?.companyName || 'Supplier evaluation'}</p>
                  <p className="text-xs text-gray-500 mt-1 capitalize">{String(evaluation.status || 'pending').replace('_', ' ')}</p>
                </div>
              ))}
              {pendingEvaluations.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
                  No pending evaluations.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Performance notes</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li>• Use this page to identify strong and weak suppliers quickly.</li>
              <li>• Scores below 50% should be treated as intervention candidates.</li>
              <li>• Due reviews represent suppliers that need evaluation attention.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
