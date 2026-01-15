import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { LayoutDashboard, Users, FileText, ShoppingCart, FileSearch, Bell, UserCircle, AlertTriangle, Loader2 } from 'lucide-react'
import fossilLogo from '../../assets/fossilLogo.png'

const navigation = [
  { name: "Dashboard", href: "/app", icon: LayoutDashboard },
  { name: "Suppliers", href: "/app/suppliers", icon: Users },
  { name: "RFQS (Enquiries)", href: "/app/rfqs", icon: FileSearch },
  { name: "Quotations", href: "/app/quotations", icon: FileText },
  { name: "Purchase Orders", href: "/app/purchase-orders", icon: ShoppingCart },
  { name: "Staff Team", href: "/app/users", icon: UserCircle },
  { name: "Notifications", href: "/app/notifications", icon: Bell },
]

export function SidebarLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    // Simulate logout process
    await new Promise(resolve => setTimeout(resolve, 1500))
    setIsLoggingOut(false)
    setShowLogoutModal(false)
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-primary text-gray-100 border-r border-primary-light">
        <div className="flex flex-col h-full py-6">
          {/* Logo/Brand */}
          <div className="px-4 mb-8">
            <Link to="/app" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <img 
                src={fossilLogo} 
                alt="Fossil Contracting" 
                className="h-12 object-contain"
              />
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">YouProcure</h2>
                <p className="text-xs text-gray-400 font-medium">Fossil Contracting</p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 flex flex-col gap-2">
            {navigation.map((item) => {
              // For dashboard, only match exact path. For others, match if path starts with href
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
          <div className="px-3 mt-auto">
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
      <main className="flex-1 bg-gray-50 px-8">{children}</main>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => !isLoggingOut && setShowLogoutModal(false)}
          />
          
          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl transform transition-all">
              {/* Icon */}
              <div className="pt-8 pb-4 flex justify-center">
                <div className="p-4 bg-red-100 rounded-full">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </div>

              {/* Content */}
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

