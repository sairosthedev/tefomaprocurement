import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { LayoutDashboard, Users, FileText, ShoppingCart, FileSearch, Bell, UserCircle, AlertTriangle, Loader2, Package } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const navigation = [
  { name: "Dashboard", href: "/app", icon: LayoutDashboard, roles: ['admin', 'procurement_officer', 'department_head', 'finance', 'coo', 'stores_officer'] },
  { name: "Suppliers", href: "/app/suppliers", icon: Users, roles: ['admin', 'procurement_officer'] },
  { name: "RFQs (Enquiries)", href: "/app/rfqs", icon: FileSearch, roles: ['admin', 'procurement_officer'] },
  { name: "Quotations", href: "/app/quotations", icon: FileText, roles: ['admin', 'procurement_officer'] },
  { name: "Purchase Orders", href: "/app/purchase-orders", icon: ShoppingCart, roles: ['admin', 'procurement_officer', 'finance', 'coo'] },
  { name: "Inventory", href: "/app/inventory", icon: Package, roles: ['admin', 'stores_officer'] },
  { name: "Staff Team", href: "/app/users", icon: UserCircle, roles: ['admin'] },
  { name: "Notifications", href: "/app/notifications", icon: Bell, roles: ['admin', 'procurement_officer', 'department_head', 'finance', 'coo', 'stores_officer'] },
]

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

  // Filter navigation based on user role
  const filteredNavigation = navigation.filter(item => {
    if (!user?.role) return false;
    return item.roles.includes(user.role);
  })

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-primary text-gray-100 border-r border-primary-light fixed h-full">
        <div className="flex flex-col h-full py-6">
          {/* Logo/Brand */}
          <div className="px-4 mb-8">
            <Link to="/app" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <div className="h-12 w-12 bg-white/10 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🦴</span>
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">YouProcure</h2>
                <p className="text-xs text-gray-400 font-medium">Fossil Contracting</p>
              </div>
            </Link>
          </div>

          {/* User Info */}
          <div className="px-4 mb-6">
            <div className="bg-white/10 rounded-xl p-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-white">
                    {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-gray-400 capitalize">{user?.role?.replace('_', ' ')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 flex flex-col gap-1 overflow-y-auto">
            {filteredNavigation.map((item) => {
              const isActive = item.href === '/app' 
                ? location.pathname === '/app'
                : location.pathname.startsWith(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary-light text-white shadow-sm"
                      : "text-gray-100/80 hover:bg-primary-light/50 hover:text-white",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
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
      <main className="flex-1 bg-gray-50 ml-64 px-8 min-h-screen">{children}</main>

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
