import React, { useState } from 'react'
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
  FileCheck,
  DollarSign,
  TrendingUp,
  Send,
  Archive,
  Settings
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// Role-based navigation configuration
const roleNavigation = {
  admin: [
    { name: "Dashboard", href: "/app", icon: LayoutDashboard },
    { name: "Staff Team", href: "/app/users", icon: Users },
    { name: "Departments", href: "/app/departments", icon: Building2 },
    { name: "Suppliers", href: "/app/suppliers", icon: Users },
    { name: "RFQs", href: "/app/rfqs", icon: FileSearch },
    { name: "Quotations", href: "/app/quotations", icon: FileText },
    { name: "Purchase Orders", href: "/app/purchase-orders", icon: ShoppingCart },
    { name: "Reports", href: "/app/reports", icon: BarChart3 },
    { name: "Audit Logs", href: "/app/audit-logs", icon: FileCheck },
    { name: "Notifications", href: "/app/notifications", icon: Bell },
  ],
  
  department_head: [
    { name: "Dashboard", href: "/app", icon: LayoutDashboard },
    { name: "My Requisitions", href: "/app/requisitions", icon: ClipboardList },
    { name: "Store Requisitions", href: "/app/store-requisitions", icon: Package },
    { name: "Reports", href: "/app/reports", icon: BarChart3 },
    { name: "Notifications", href: "/app/notifications", icon: Bell },
    { name: "Profile", href: "/app/profile", icon: UserCircle },
  ],
  
  procurement_officer: [
    { name: "Dashboard", href: "/app", icon: LayoutDashboard },
    { name: "Requisitions", href: "/app/requisitions", icon: ClipboardList },
    { name: "RFQs", href: "/app/rfqs", icon: FileSearch },
    { name: "Quotations", href: "/app/quotations", icon: FileText },
    { name: "Purchase Orders", href: "/app/purchase-orders", icon: ShoppingCart },
    { name: "Suppliers", href: "/app/suppliers", icon: Users },
    { name: "Reports", href: "/app/reports", icon: BarChart3 },
    { name: "Notifications", href: "/app/notifications", icon: Bell },
    { name: "Profile", href: "/app/profile", icon: UserCircle },
  ],
  
  finance: [
    { name: "Dashboard", href: "/app", icon: LayoutDashboard },
    { name: "Approvals", href: "/app/approvals", icon: CheckSquare },
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
    { name: "Suppliers", href: "/app/suppliers", icon: Users },
    { name: "Notifications", href: "/app/notifications", icon: Bell },
    { name: "Profile", href: "/app/profile", icon: UserCircle },
  ],
  
  stores_officer: [
    { name: "Dashboard", href: "/app", icon: LayoutDashboard },
    { name: "Deliveries (GRV)", href: "/app/deliveries", icon: Truck },
    { name: "Inventory", href: "/app/inventory", icon: Package },
    { name: "Store Requisitions", href: "/app/store-requisitions", icon: ClipboardList },
    { name: "Stock Movements", href: "/app/stock-movements", icon: ArrowLeftRight },
    { name: "Reports", href: "/app/reports", icon: BarChart3 },
    { name: "Notifications", href: "/app/notifications", icon: Bell },
    { name: "Profile", href: "/app/profile", icon: UserCircle },
  ],
  
  supplier: [
    { name: "Dashboard", href: "/app", icon: LayoutDashboard },
    { name: "My RFQs", href: "/app/my-rfqs", icon: FileSearch },
    { name: "My Purchase Orders", href: "/app/my-purchase-orders", icon: ShoppingCart },
    { name: "Deliveries", href: "/app/my-deliveries", icon: Truck },
    { name: "My Profile", href: "/app/supplier-profile", icon: Building2 },
    { name: "Notifications", href: "/app/notifications", icon: Bell },
  ],
}

export function SidebarLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await new Promise(resolve => setTimeout(resolve, 800))
    logout()
    setIsLoggingOut(false)
    setShowLogoutModal(false)
    navigate('/login')
  }

  // Get navigation items for current user's role
  const navigation = roleNavigation[user?.role] || roleNavigation.admin

  const getRoleDisplayName = (role) => {
    const names = {
      admin: 'System Administrator',
      procurement_officer: 'Procurement Officer',
      department_head: 'Department Head',
      finance: 'Finance Manager',
      coo: 'Chief Operating Officer',
      stores_officer: 'Stores Officer',
      supplier: 'Supplier'
    }
    return names[role] || role
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-primary text-gray-100 border-r border-primary-light fixed h-full">
        <div className="flex flex-col h-full py-6">
          {/* Logo/Brand */}
          <div className="px-4 mb-6">
            <Link to="/app" className="flex items-center hover:opacity-90 transition-opacity">
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
            {navigation.map((item) => {
              const isActive = item.href === '/app' 
                ? location.pathname === '/app'
                : location.pathname.startsWith(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-all duration-200",
                    "outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                    "focus-visible:bg-primary-light/70 focus-visible:text-white",
                    isActive
                      ? "bg-primary-light text-white shadow-sm"
                      : "text-gray-100/80 hover:bg-primary-light/50 hover:text-white active:bg-primary-light/60",
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {item.name}
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
