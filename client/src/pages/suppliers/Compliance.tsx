import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Loader2, ShieldCheck, Sparkles, UserCheck } from 'lucide-react'
import { procurementAPI } from '../../services/procurement.service'
import { useToast } from '../../components/Toast'
import PageHeader, { PageStatCard } from '../../components/PageHeader'
import Pagination from '../../components/Pagination'
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../../lib/pagination'

export default function Compliance() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(emptyPagination())

  useEffect(() => {
    load()
  }, [page])

  const load = async () => {
    try {
      setLoading(true)
      const response = await procurementAPI.getSuppliers({ page, limit: DEFAULT_PAGE_SIZE })
      setSuppliers(response.data.data || [])
      setPagination(parsePagination(response.data.pagination))
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load compliance analytics', 'error')
    } finally {
      setLoading(false)
    }
  }

  const metrics = useMemo(() => {
    const total = suppliers.length
    const verified = suppliers.filter((supplier) => supplier.kysComplete).length
    const exempt = suppliers.filter((supplier) => supplier.kysExempt).length
    const active = suppliers.filter((supplier) => supplier.status === 'active').length
    const pending = suppliers.filter((supplier) => !supplier.kysComplete && supplier.status !== 'blacklisted').length
    const documentHeavy = suppliers.filter((supplier) => Array.isArray(supplier.complianceDocuments) && supplier.complianceDocuments.length >= 3).length
    return { total, verified, exempt, active, pending, documentHeavy }
  }, [suppliers])

  const complianceRows = useMemo(() => {
    return suppliers
      .map((supplier) => ({
        ...supplier,
        docs: Array.isArray(supplier.complianceDocuments) ? supplier.complianceDocuments.length : 0,
        score: Number(supplier.overallScore || 0)
      }))
      .sort((a, b) => Number(a.kysComplete) - Number(b.kysComplete) || b.docs - a.docs)
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
        title="Compliance"
        subtitle="Track KYS completion, document coverage, and compliance risk across the supplier base."
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
        <PageStatCard label="Total suppliers" value={metrics.total} />
        <PageStatCard label="Verified" value={metrics.verified} valueClassName="text-emerald-600" />
        <PageStatCard label="Exempt" value={metrics.exempt} valueClassName="text-amber-600" />
        <PageStatCard label="Pending" value={metrics.pending} valueClassName="text-rose-600" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] items-start">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 text-gray-500 text-sm"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Compliance coverage</div>
              <div className="mt-3 text-3xl font-bold text-gray-900">{metrics.verified}/{metrics.total}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 text-gray-500 text-sm"><FileText className="h-4 w-4 text-blue-500" /> Document rich</div>
              <div className="mt-3 text-3xl font-bold text-gray-900">{metrics.documentHeavy}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 text-gray-500 text-sm"><UserCheck className="h-4 w-4 text-amber-500" /> Active suppliers</div>
              <div className="mt-3 text-3xl font-bold text-gray-900">{metrics.active}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Compliance watchlist</h2>
                <p className="text-sm text-gray-500">Suppliers needing attention, ordered by completion and document count.</p>
              </div>
              <Sparkles className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              {complianceRows.map((supplier, index) => {
                const statusLabel = supplier.kysComplete ? 'Compliant' : supplier.kysExempt ? 'Exempt' : 'Needs review'
                const statusClass = supplier.kysComplete
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : supplier.kysExempt
                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                    : 'bg-rose-50 text-rose-700 border-rose-100'

                return (
                  <div key={supplier._id || supplier.id || index} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{supplier.companyName || supplier.name || 'Unnamed supplier'}</p>
                        <p className="text-xs text-gray-500 mt-1">{supplier.docs} documents uploaded</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass}`}>{statusLabel}</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white overflow-hidden">
                      <div className={`h-full rounded-full ${supplier.kysComplete ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${supplier.kysComplete ? 100 : Math.min(100, supplier.docs * 15)}` }} />
                    </div>
                  </div>
                )
              })}
              {complianceRows.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-gray-500">
                  No suppliers available for compliance analysis.
                </div>
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
            <h3 className="text-sm font-semibold text-gray-900">Compliance summary</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <span className="text-gray-500">Suppliers with KYS complete</span>
                <span className="font-medium text-gray-900">{metrics.verified}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <span className="text-gray-500">KYS exemptions</span>
                <span className="font-medium text-gray-900">{metrics.exempt}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <span className="text-gray-500">Suppliers needing review</span>
                <span className="font-medium text-gray-900">{metrics.pending}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">What this page is for</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li>• Spot suppliers missing KYS completion.</li>
              <li>• Identify profiles with low document coverage.</li>
              <li>• Separate verified, exempt, and unreviewed suppliers at a glance.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Trend note</h3>
            <p className="mt-2 text-sm text-gray-600">
              Compliance analytics can later be expanded with document age, approval status, and overdue review timelines.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
