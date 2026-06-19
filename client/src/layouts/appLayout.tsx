import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '../../lib/utils'
import Logo from '../components/Logo'
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  ShoppingCart, 
  FileSearch, 
  Bell, 
  UserCircle, 
  AlertTriangle, 
  Loader2, 
  Package,
  ClipboardList,
  Plus,
  CheckSquare,
  BarChart3,
  Truck,
  ArrowLeftRight,
  Building2,
  MapPin,
  FileCheck,
  DollarSign,
  CreditCard,
  TrendingUp,
  Send,
  Archive,
  Settings,
  ShieldCheck
} from 'lucide-react'
import { ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isProcurementHead } from '@fossil/shared'
import { notificationsAPI } from '../lib/api'

// Role-based navigation configuration
const roleNavigation: any = {
  admin: [
    { name: "Dashboard", href: "/app", icon: LayoutDashboard },
    { name: "Staff Team", href: "/app/users", icon: Users },
    { name: "Departments", href: "/app/departments", icon: Building2 },
    { name: "Sites", href: "/app/sites", icon: MapPin },
    { name: "Suppliers", icon: Users, children: [
      { name: 'All Suppliers', href: '/app/suppliers', icon: Users },
      { name: 'Verification Hub', href: '/app/verification-hub', icon: FileSearch },
      { name: 'Analytics', icon: TrendingUp, children: [
        { name: 'Performance', href: '/app/suppliers/analytics/performance', icon: TrendingUp },
        { name: 'Compliance', href: '/app/suppliers/analytics/compliance', icon: BarChart3 }
      ] },
      { name: 'Evaluations', href: '/app/suppliers/evaluations', icon: ClipboardList },
      { name: 'Reports', href: '/app/suppliers/reports', icon: BarChart3 }
    ] },
    { name: "RFQs", href: "/app/rfqs", icon: FileSearch },
    { name: "Quotations", href: "/app/quotations", icon: FileText },
    { name: "Purchase Orders", href: "/app/purchase-orders", icon: ShoppingCart },
    { name: "Reports", href: "/app/reports", icon: BarChart3 },
    { name: "Audit Logs", href: "/app/audit-logs", icon: FileCheck },
    { name: "Notifications", href: "/app/notifications", icon: Bell },
  ],
  
  department_head: [
    { name: "Dashboard", href: "/app", icon: LayoutDashboard },
    { name: "Approvals", href: "/app/approvals", icon: CheckSquare },
    { name: "My Requisitions", href: "/app/requisitions", icon: ClipboardList },
    { name: "Store Requisitions", href: "/app/store-requisitions", icon: Package },
    { name: "Reports", href: "/app/reports", icon: BarChart3 },
    { name: "Notifications", href: "/app/notifications", icon: Bell },
    { name: "Profile", href: "/app/profile", icon: UserCircle },
  ],

  end_user: [
    { name: "Dashboard", href: "/app", icon: LayoutDashboard },
    { name: "My Requisitions", href: "/app/requisitions", icon: ClipboardList },
    { name: "Notifications", href: "/app/notifications", icon: Bell },
    { name: "Profile", href: "/app/profile", icon: UserCircle },
  ],
  
  procurement_officer: [
    { name: "Dashboard", href: "/app", icon: LayoutDashboard },
    { name: "Requisitions", href: "/app/requisitions", icon: ClipboardList },
    { name: "RFQs", href: "/app/rfqs", icon: FileSearch },
    { name: "Quotations", href: "/app/quotations", icon: FileText },
    { name: "Purchase Orders", href: "/app/purchase-orders", icon: ShoppingCart },
    { name: "Suppliers", icon: Users, children: [
      { name: 'All Suppliers', href: '/app/suppliers', icon: Users },
      { name: 'Verification Hub', href: '/app/verification-hub', icon: FileSearch },
      { name: 'Analytics', icon: TrendingUp, children: [
        { name: 'Performance', href: '/app/suppliers/analytics/performance', icon: TrendingUp },
        { name: 'Compliance', href: '/app/suppliers/analytics/compliance', icon: BarChart3 }
      ] },
      { name: 'Evaluations', href: '/app/suppliers/evaluations', icon: ClipboardList },
      { name: 'Reports', href: '/app/suppliers/reports', icon: BarChart3 }
    ] },
    { name: "Reports", href: "/app/reports", icon: BarChart3 },
    { name: "Notifications", href: "/app/notifications", icon: Bell },
    { name: "Profile", href: "/app/profile", icon: UserCircle },
  ],

  // Head of the Procurement department: full procurement access plus the
  // department-head approval queue.
  procurement_head: [
    { name: "Dashboard", href: "/app", icon: LayoutDashboard },
    { name: "Approvals", href: "/app/approvals", icon: CheckSquare },
    { name: "Requisitions", href: "/app/requisitions", icon: ClipboardList },
    { name: "RFQs", href: "/app/rfqs", icon: FileSearch },
    { name: "Quotations", href: "/app/quotations", icon: FileText },
    { name: "Purchase Orders", href: "/app/purchase-orders", icon: ShoppingCart },
    { name: "Suppliers", icon: Users, children: [
      { name: 'All Suppliers', href: '/app/suppliers', icon: Users },
      { name: 'Verification Hub', href: '/app/verification-hub', icon: FileSearch },
      { name: 'Analytics', icon: TrendingUp, children: [
        { name: 'Performance', href: '/app/suppliers/analytics/performance', icon: TrendingUp },
        { name: 'Compliance', href: '/app/suppliers/analytics/compliance', icon: BarChart3 }
      ] },
      { name: 'Evaluations', href: '/app/suppliers/evaluations', icon: ClipboardList },
      { name: 'Reports', href: '/app/suppliers/reports', icon: BarChart3 }
    ] },
    { name: "Reports", href: "/app/reports", icon: BarChart3 },
    { name: "Notifications", href: "/app/notifications", icon: Bell },
    { name: "Profile", href: "/app/profile", icon: UserCircle },
  ],
  
  finance: [
    { name: "Dashboard", href: "/app", icon: LayoutDashboard },
    { name: "Approvals", href: "/app/approvals", icon: CheckSquare },
    { name: "Invoices", href: "/app/invoices", icon: FileText },
    { name: "Payments", href: "/app/payments", icon: CreditCard },
    { name: "Budgets", href: "/app/budgets", icon: DollarSign },
    { name: "Purchase Orders", href: "/app/purchase-orders", icon: ShoppingCart },
    { name: "Reports", href: "/app/reports", icon: BarChart3 },
    { name: "Notifications", href: "/app/notifications", icon: Bell },
    { name: "Profile", href: "/app/profile", icon: UserCircle },
  ],
  
  coo: [
    { name: "Dashboard", href: "/app", icon: LayoutDashboard },
    { name: "Approvals", href: "/app/approvals", icon: CheckSquare },
    { name: "Reports", href: "/app/reports", icon: BarChart3 },
    { name: "Suppliers", icon: Users, children: [
      { name: 'All Suppliers', href: '/app/suppliers', icon: Users },
      { name: 'Verification Hub', href: '/app/verification-hub', icon: FileSearch },
      { name: 'Analytics', icon: TrendingUp, children: [
        { name: 'Performance', href: '/app/suppliers/analytics/performance', icon: TrendingUp },
        { name: 'Compliance', href: '/app/suppliers/analytics/compliance', icon: BarChart3 }
      ] },
      { name: 'Evaluations', href: '/app/suppliers/evaluations', icon: ClipboardList },
      { name: 'Reports', href: '/app/suppliers/reports', icon: BarChart3 }
    ] },
    { name: "Notifications", href: "/app/notifications", icon: Bell },
    { name: "Profile", href: "/app/profile", icon: UserCircle },
  ],
  
  stores_officer: [
    { name: "Dashboard", href: "/app", icon: LayoutDashboard },
    { name: "PR Stores Review", href: "/app/stores-pr-review", icon: ClipboardList },
    { name: "Deliveries (GRV)", href: "/app/deliveries", icon: Truck },
    { name: "Inventory", href: "/app/inventory", icon: Package },
    { name: "Store Requisitions", href: "/app/store-requisitions", icon: ClipboardList },
    { name: "Stock Movements", href: "/app/stock-movements", icon: ArrowLeftRight },
    { name: "Stock Transfers", href: "/app/stock-transfers", icon: Truck },
    { name: "Reports", href: "/app/reports", icon: BarChart3 },
    { name: "Notifications", href: "/app/notifications", icon: Bell },
    { name: "Profile", href: "/app/profile", icon: UserCircle },
  ],
  
  supplier: [
    { name: "Dashboard", href: "/app", icon: LayoutDashboard },
    { name: "My RFQs", href: "/app/my-rfqs", icon: FileSearch },
    { name: "My Submitted Quotations", href: "/app/my-submitted-quotations", icon: FileText },
    { name: "My Purchase Orders", href: "/app/my-purchase-orders", icon: ShoppingCart },
    { name: "My Invoices", href: "/app/my-invoices", icon: FileText },
    { name: "Deliveries", href: "/app/my-deliveries", icon: Truck },
    { name: "KYS Documents", href: "/app/my-kys", icon: ShieldCheck },
    { name: "My Profile", href: "/app/supplier-profile", icon: Building2 },
    { name: "Notifications", href: "/app/notifications", icon: Bell },
  ],
}

export function SidebarLayout({ children }: any) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [showLogoutModal, setShowLogoutModal] = useState<any>(false)
  const [isLoggingOut, setIsLoggingOut] = useState<any>(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    const loadUnread = async () => {
      if (!user) return
      try {
        const res = await notificationsAPI.getUnreadCount()
        if (!cancelled && res.data.success) {
          setUnreadCount(res.data.count ?? res.data.data?.count ?? 0)
        }
      } catch {
        // ignore — badge is optional
      }
    }

    loadUnread()
    const interval = setInterval(loadUnread, 60000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [user?._id, user?.id, location.pathname])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await new Promise((resolve: any) => setTimeout(resolve, 800))
    logout()
    setIsLoggingOut(false)
    setShowLogoutModal(false)
    navigate('/')
  }

  // Get navigation items for current user's role. The procurement department
  // head gets a combined procurement + approvals menu.
  const procurementHead = isProcurementHead(user)
  const navigation = procurementHead
    ? roleNavigation.procurement_head
    : roleNavigation[user?.role] || roleNavigation.admin

  const getRoleDisplayName = (role: any) => {
    if (procurementHead) return 'Head of Procurement'
    const names: any = {
      admin: 'System Administrator',
      procurement_officer: 'Procurement Officer',
      department_head: 'Department Head',
      end_user: 'End User',
      finance: 'Finance Manager',
      coo: 'Chief Operating Officer',
      stores_officer: 'Stores Officer',
      supplier: 'Supplier'
    }
    return names[role] || role
  }

  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})

  const toggleOpen = (name: string) => setOpenItems(prev => ({ ...prev, [name]: !prev[name] }))

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-primary text-gray-100 border-r border-primary-light fixed h-full">
        <div className="flex flex-col h-full py-6">
          {/* Logo/Brand */}
          <div className="px-4 mb-6">
            <Link to="/app" className="block hover:opacity-90 transition-opacity">
              <Logo variant="compact" showText={true} className="text-white" />
            </Link>
          </div>

          {/* User Info */}
          <div className="px-4 mb-5">
            <div className="bg-white/10 rounded-xl p-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-white">
                    {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user?.firstName} {user?.lastName}</p>
                  <p className="text-[11px] text-gray-400">{getRoleDisplayName(user?.role)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 flex flex-col gap-0.5 overflow-y-auto">
            {navigation.map((item: any) => {
              const Icon = item.icon

              // If item has children render a collapsible group
              if (item.children && Array.isArray(item.children)) {
                const anyChildActive = item.children.some((c: any) => location.pathname.startsWith(c.href))
                const isOpen = openItems[item.name] ?? anyChildActive

                return (
                  <div key={item.name}>
                    <button
                      onClick={() => toggleOpen(item.name)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-all duration-200",
                        "outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                        "focus-visible:bg-primary-light focus-visible:text-white",
                        anyChildActive
                          ? "bg-primary-light text-white shadow-sm"
                          : "text-gray-100/80 hover:bg-primary-light hover:text-white active:bg-primary-light",
                      )}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      <span className="flex-1 text-left">{item.name}</span>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen ? "rotate-180" : "rotate-0")} />
                    </button>

                    {isOpen && (
                      <div className="mt-1 ml-3 flex flex-col gap-1">
                        {item.children.map((child: any) => {
                          // If the child itself has children (nested group), render another collapsible group
                          if (child.children && Array.isArray(child.children)) {
                            const anySubActive = child.children.some((sc: any) => location.pathname.startsWith(sc.href))
                            const childKey = `${item.name}-${child.name}`
                            const isChildOpen = openItems[childKey] ?? anySubActive
                            const ChildIcon = child.icon || Users

                            return (
                              <div key={child.name}>
                                <button
                                  onClick={() => toggleOpen(childKey)}
                                  className={cn(
                                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
                                    "outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                                    anySubActive
                                      ? "bg-primary-light text-white shadow-sm"
                                      : "text-gray-100/80 hover:bg-primary-light hover:text-white",
                                  )}
                                >
                                  <ChildIcon className="h-[13px] w-[13px] shrink-0 opacity-80" />
                                  <span className="flex-1 text-left">{child.name}</span>
                                  <ChevronDown className={cn("h-3 w-3 transition-transform", isChildOpen ? "rotate-180" : "rotate-0")} />
                                </button>

                                {isChildOpen && (
                                  <div className="mt-1 ml-4 flex flex-col gap-1">
                                    {child.children.map((sub: any) => {
                                      const SubIcon = sub.icon || Users
                                      const subActive = location.pathname.startsWith(sub.href)
                                      return (
                                        <Link
                                          key={sub.name}
                                          to={sub.href}
                                          className={cn(
                                            "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
                                            subActive
                                              ? "bg-primary-light text-white shadow-sm"
                                              : "text-gray-100/80 hover:bg-primary-light hover:text-white"
                                          )}
                                        >
                                          <SubIcon className="h-[12px] w-[12px] shrink-0 opacity-80" />
                                          {sub.name}
                                        </Link>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          }

                          // Otherwise a normal child link
                          const ChildIcon = child.icon || Users
                          const childActive = child.href ? location.pathname.startsWith(child.href) : false
                          return (
                            <Link
                              key={child.name}
                              to={child.href}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
                                childActive
                                  ? "bg-primary-light text-white shadow-sm"
                                  : "text-gray-100/80 hover:bg-primary-light hover:text-white"
                              )}
                            >
                              <ChildIcon className="h-[14px] w-[14px] shrink-0 opacity-80" />
                              {child.name}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              // Regular item (no children)
              let isActive: any;
              if (item.href === '/app/my-rfqs') {
                isActive = location.pathname.startsWith(item.href) || location.pathname.startsWith('/app/submit-quotation');
              } else if (item.href === '/app') {
                isActive = location.pathname === '/app';
              } else {
                isActive = location.pathname.startsWith(item.href);
              }

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-all duration-200",
                    "outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                    "focus-visible:bg-primary-light focus-visible:text-white",
                    isActive
                      ? "bg-primary-light text-white shadow-sm"
                      : "text-gray-100/80 hover:bg-primary-light hover:text-white active:bg-primary-light",
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="flex-1">{item.name}</span>
                  {item.href === '/app/notifications' && unreadCount > 0 && (
                    <span className="min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-semibold">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Logout Button */}
          <div className="px-3 mt-4">
            <button
              onClick={() => setShowLogoutModal(true)}
              className="w-full flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 bg-red-600 hover:bg-red-700 text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-50 ml-64 min-h-screen px-4 md:px-8">{children}</main>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => !isLoggingOut && setShowLogoutModal(false)}
          />
          
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl transform transition-all">
              <div className="pt-8 pb-4 flex justify-center">
                <div className="p-4 bg-red-100 rounded-full">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </div>

              <div className="px-6 pb-6 text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {isLoggingOut ? 'Logging out...' : 'Confirm Logout'}
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  {isLoggingOut 
                    ? 'Please wait while we securely log you out.'
                    : 'Are you sure you want to logout? You will need to sign in again to access the dashboard.'
                  }
                </p>

                {isLoggingOut ? (
                  <div className="flex items-center justify-center gap-3 py-3">
                    <Loader2 className="h-6 w-6 text-red-600 animate-spin" />
                    <span className="text-sm font-medium text-gray-600">Logging out securely...</span>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowLogoutModal(false)}
                      className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors"
                    >
                      Yes, Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
