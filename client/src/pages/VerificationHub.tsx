import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KYS_CHECKLIST_ITEMS, computeKysCompletion } from '@fossil/shared'
import { procurementAPI } from '../services/procurement.service'
import { useToast } from '../components/Toast'
import PageHeader, { PageStatCard } from '../components/PageHeader'

export default function VerificationHub() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [verificationStatusFilter, setVerificationStatusFilter] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [verifyingSupplierId, setVerifyingSupplierId] = useState('')

  const supplierCompletion = (supplier: any) => computeKysCompletion(supplier?.kysChecklist || {})

  const verificationSections = useMemo(
    () => Array.from(new Set(KYS_CHECKLIST_ITEMS.map((item) => item.section))),
    []
  )

  const sectionProgressForSupplier = (supplier: any, section: string) => {
    const sectionItems = KYS_CHECKLIST_ITEMS.filter((item) => item.section === section)
    const complete = sectionItems.filter((item) => supplier?.kysChecklist?.[item.key]).length

    return {
      complete,
      total: sectionItems.length,
      percent: sectionItems.length ? Math.round((complete / sectionItems.length) * 100) : 0
    }
  }

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier) => {
      const completion = supplierCompletion(supplier)

      if (verificationStatusFilter === 'verified' && !completion.isComplete) return false
      if (verificationStatusFilter === 'in_progress' && !(completion.requiredComplete > 0 && !completion.isComplete)) return false
      if (verificationStatusFilter === 'not_started' && completion.requiredComplete > 0) return false

      if (selectedSection) {
        const progress = sectionProgressForSupplier(supplier, selectedSection)
        return progress.percent < 100
      }

      return true
    })
  }, [selectedSection, suppliers, verificationStatusFilter])

  useEffect(() => {
    fetchSuppliers()
  }, [search])

  const fetchSuppliers = async () => {
    try {
      setLoading(true)
      const res = await procurementAPI.getSuppliers({ search })
      setSuppliers(res.data.data || [])
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to load suppliers', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    const headers = ['Supplier', 'Code', 'Verification Status', 'Sections Complete', 'Overall Score']
    const rows = filteredSuppliers.map((supplier) => {
      const completion = supplierCompletion(supplier)
      const completedSections = verificationSections.filter((section) => sectionProgressForSupplier(supplier, section).percent === 100).length
      const status = completion.isComplete ? 'Verified' : completion.requiredComplete > 0 ? 'In Progress' : 'Not Started'

      return [
        supplier.companyName || supplier.name || '',
        supplier.code || supplier._id || '',
        status,
        `${completedSections}/${verificationSections.length}`,
        supplier.overallScore ? `${supplier.overallScore}%` : '0%'
      ]
    })

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `verification-hub-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const verifySupplier = async (supplier: any) => {
    const completion = supplierCompletion(supplier)
    if (!completion.isComplete) {
      showToast('Complete the required KYS items before verifying this supplier', 'error')
      return
    }

    const supplierId = supplier?._id || supplier?.id
    if (!supplierId) {
      showToast('Missing supplier id', 'error')
      return
    }

    try {
      setVerifyingSupplierId(supplierId)
      await procurementAPI.verifyKys(supplierId, { approveForActivation: true })
      showToast('Supplier verified successfully', 'success')
      await fetchSuppliers()
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Verification failed', 'error')
    } finally {
      setVerifyingSupplierId('')
    }
  }

  const total = filteredSuppliers.length
  const fully = filteredSuppliers.filter((supplier) => supplierCompletion(supplier).isComplete).length
  const partially = filteredSuppliers.filter((supplier) => {
    const completion = supplierCompletion(supplier)
    return completion.requiredComplete > 0 && !completion.isComplete
  }).length
  const notStarted = total - fully - partially
  const visibleSections = selectedSection ? 1 : verificationSections.length

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Verification Hub"
        subtitle="Review KYS completion, filter by checklist sections, and verify suppliers from one focused workspace."
        actions={
          <>
            <button
              type="button"
              onClick={() => setSelectedSection('')}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${!selectedSection ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              All Suppliers
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
            >
              Export CSV
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <PageStatCard label="Suppliers" value={total} />
        <PageStatCard label="Verified" value={fully} valueClassName="text-emerald-600" />
        <PageStatCard label="In Progress" value={partially} valueClassName="text-amber-600" />
        <PageStatCard label="Not Started" value={notStarted} valueClassName="text-rose-600" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px] items-start">
        <div className="space-y-6">
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px_auto] lg:items-center">
              <div className="relative">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none focus:border-blue-400 focus:bg-white"
                  placeholder="Search by supplier name or code..."
                />
              </div>
              <select
                value={verificationStatusFilter}
                onChange={(e) => setVerificationStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm outline-none focus:border-blue-400 focus:bg-white"
              >
                <option value="">All Verification Statuses</option>
                <option value="verified">Fully Verified</option>
                <option value="in_progress">In Progress</option>
                <option value="not_started">Not Started</option>
              </select>
              <select className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm outline-none focus:border-blue-400 focus:bg-white">
                <option>Filter by Department</option>
              </select>
              <button onClick={fetchSuppliers} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
                Refresh
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Verification sections</h2>
                <p className="text-xs text-gray-500 mt-1">Filter suppliers by the KYS checklist section that still needs attention.</p>
              </div>
              {selectedSection && (
                <button onClick={() => setSelectedSection('')} className="text-sm text-blue-600 hover:text-blue-700">
                  Clear filter
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {verificationSections.map((section) => {
                const active = selectedSection === section
                return (
                  <button
                    key={section}
                    onClick={() => setSelectedSection(active ? '' : section)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-blue-300 hover:text-blue-700'}`}
                  >
                    {section}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-4">
            {loading && <div className="text-center text-gray-500 py-16">Loading...</div>}
            {!loading && filteredSuppliers.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-gray-500">
                No suppliers match the current filters.
              </div>
            )}
            {!loading && filteredSuppliers.map((supplier: any) => {
              const completion = supplierCompletion(supplier)
              const completedSections = verificationSections.filter((section) => sectionProgressForSupplier(supplier, section).percent === 100).length
              const sectionStatus = completion.isComplete ? 'Verified' : completion.requiredComplete > 0 ? 'In Progress' : 'Not Started'
              const supplierId = supplier._id || supplier.id
              const isVerifying = verifyingSupplierId === supplierId

              return (
                <div key={supplierId} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-lg font-semibold text-gray-900 truncate">{supplier.companyName || supplier.name}</div>
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">Code: {supplier.code || supplier._id}</span>
                        <span className="text-xs text-gray-500">{sectionStatus}</span>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px]">
                        <div>
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                            <span>Overall Progress</span>
                            <span>{supplier.kysProgress || 0}%</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-400 rounded-full" style={{ width: `${supplier.kysProgress || 0}%` }} />
                          </div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                          <div className="text-xs text-gray-500">Sections complete</div>
                          <div className="mt-1 text-lg font-semibold text-gray-900">{completedSections}/{verificationSections.length}</div>
                          <div className="text-xs text-gray-500 mt-1">{completion.requiredComplete} required items complete</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row xl:flex-col gap-2 xl:w-52">
                      <button
                        type="button"
                        onClick={() => navigate(`/app/suppliers/${supplierId}/kys`)}
                        className="px-3 py-2 rounded-xl text-sm border border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Open KYS
                      </button>
                      <button
                        type="button"
                        onClick={() => verifySupplier(supplier)}
                        disabled={isVerifying || completion.isComplete === false}
                        className="px-3 py-2 rounded-xl text-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:hover:bg-green-600"
                        title={completion.isComplete ? 'Verify and activate supplier' : 'Complete required KYS items first'}
                      >
                        {isVerifying ? 'Verifying...' : 'Verify Supplier'}
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-2 flex-wrap">
                    {verificationSections.map((section) => {
                      const progress = sectionProgressForSupplier(supplier, section)
                      const isComplete = progress.percent === 100
                      const active = selectedSection === section

                      return (
                        <button
                          key={section}
                          onClick={() => setSelectedSection(active ? '' : section)}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${active ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-blue-300'} ${isComplete ? 'opacity-80' : ''}`}
                          title={`${progress.complete}/${progress.total} checklist items complete in ${section}`}
                        >
                          {section} {progress.percent === 100 ? '• done' : `• ${progress.percent}%`}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <aside className="space-y-4 sticky top-6">
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900">View summary</h3>
            <p className="mt-1 text-xs text-gray-500">Current filter state and the scope of this hub.</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <span className="text-gray-500">Section filter</span>
                <span className="font-medium text-gray-900">{selectedSection || 'All sections'}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <span className="text-gray-500">Sections visible</span>
                <span className="font-medium text-gray-900">{visibleSections}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <span className="text-gray-500">Search term</span>
                <span className="font-medium text-gray-900">{search || 'None'}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <span className="text-gray-500">Verification status</span>
                <span className="font-medium text-gray-900">
                  {verificationStatusFilter ? verificationStatusFilter.replace('_', ' ') : 'All'}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
