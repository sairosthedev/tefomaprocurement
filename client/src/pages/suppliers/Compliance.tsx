import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, FileText, Loader2, ShieldCheck, UserCheck } from 'lucide-react'
import { procurementAPI } from '../../services/procurement.service'
import { useToast } from '../../components/Toast'
import PageHeader, { PageStatCard } from '../../components/PageHeader'
import Pagination from '../../components/Pagination'
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../../lib/pagination'

export default function Compliance() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(emptyPagination())

  useEffect(() => {
    load()
  }, [page])

  const load = async () => {
    try {
      setLoading(true)
      const response = await procurementAPI.getSupplierReports({ page, limit: DEFAULT_PAGE_SIZE })
      setReport(response.data.data)
      setPagination(parsePagination(response.data.pagination))
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load compliance analytics', 'error')
    } finally {
      setLoading(false)
    }
  }

  const summary = report?.summary
  const registry = report?.registry || []

  const complianceRows = useMemo(() => {
    return [...registry].sort((a, b) => {
      if (a.kysComplete !== b.kysComplete) return Number(a.kysComplete) - Number(b.kysComplete)
      if (a.kysExempt !== b.kysExempt) return Number(a.kysExempt) - Number(b.kysExempt)
      return (a.kysPercent || 0) - (b.kysPercent || 0)
    })
  }, [registry])

  const documentHeavy = useMemo(
    () => registry.filter((row) => row.documentCount >= 3).length,
    [registry]
  )

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const totalSuppliers = summary?.totalSuppliers ?? 0

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Compliance"
        subtitle="KYS verification status and document coverage across your supplier base."
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
        <PageStatCard label="Total suppliers" value={totalSuppliers} />
        <PageStatCard label="KYS verified" value={summary?.kysVerified ?? 0} valueClassName="text-emerald-600" />
        <PageStatCard label="KYS pending" value={summary?.kysPending ?? 0} valueClassName="text-rose-600" />
        <PageStatCard label="Active" value={summary?.active ?? 0} valueClassName="text-amber-600" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] items-start">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 text-gray-500 text-sm"><ShieldCheck className="h-4 w-4 text-emerald-500" /> KYS coverage</div>
              <div className="mt-3 text-3xl font-bold text-gray-900">
                {summary?.kysVerified ?? 0}/{totalSuppliers}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 text-gray-500 text-sm"><FileText className="h-4 w-4 text-blue-500" /> 3+ documents (this page)</div>
              <div className="mt-3 text-3xl font-bold text-gray-900">{documentHeavy}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 text-gray-500 text-sm"><UserCheck className="h-4 w-4 text-amber-500" /> Pending activation</div>
              <div className="mt-3 text-3xl font-bold text-gray-900">{summary?.pending ?? 0}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Compliance watchlist</h2>
                <p className="text-sm text-gray-500">Incomplete KYS first — open supplier to upload documents and verify.</p>
              </div>
            </div>
            <div className="space-y-3">
              {complianceRows.map((row, index) => {
                const statusLabel = row.kysComplete ? 'Verified' : row.kysExempt ? 'Exempt' : 'Needs review'
                const statusClass = row.kysComplete
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : row.kysExempt
                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                    : 'bg-rose-50 text-rose-700 border-rose-100'
                const progress = row.kysComplete || row.kysExempt ? 100 : Math.min(100, row.kysPercent || 0)

                return (
                  <div key={row._id || index} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{row.companyName}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {row.documentCount} document{row.documentCount === 1 ? '' : 's'} · KYS {progress}%
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass}`}>{statusLabel}</span>
                        <button
                          type="button"
                          onClick={() => navigate(
                            row.kysComplete
                              ? `/app/suppliers/${row._id}`
                              : `/app/suppliers/${row._id}?tab=documents`
                          )}
                          className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:text-primary hover:border-primary/30"
                          title="Open supplier"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white overflow-hidden">
                      <div
                        className={`h-full rounded-full ${row.kysComplete || row.kysExempt ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              {complianceRows.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-gray-500">
                  No suppliers in the registry yet. Add suppliers from the Suppliers page.
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
                <span className="text-gray-500">KYS verified</span>
                <span className="font-medium text-gray-900">{summary?.kysVerified ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <span className="text-gray-500">KYS still pending</span>
                <span className="font-medium text-gray-900">{summary?.kysPending ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <span className="text-gray-500">Blacklisted</span>
                <span className="font-medium text-gray-900">{summary?.blacklisted ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">What to do</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li>• Open pending suppliers → Documents tab.</li>
              <li>• Upload compliance files and complete the KYS checklist.</li>
              <li>• Use Verify KYS &amp; Activate when ready.</li>
            </ul>
            <button
              type="button"
              onClick={() => navigate('/app/suppliers?status=pending')}
              className="mt-4 w-full rounded-xl bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              View pending suppliers
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
