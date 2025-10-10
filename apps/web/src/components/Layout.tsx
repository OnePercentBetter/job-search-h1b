import { Link, useLocation } from 'react-router-dom'
import { Search, User, Briefcase, LogOut } from 'lucide-react'
import { useAuth } from '../providers/AuthProvider'

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { user, signOut } = useAuth()

  const userInitial = user?.email?.charAt(0)?.toUpperCase()

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-bold text-primary-600">JobSearch</span>
            </div>
            <div className="flex items-center space-x-6">
              <Link
                to="/dashboard"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive('/dashboard')
                    ? 'border-primary-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <Search className="w-4 h-4 mr-2" />
                Search
              </Link>
              <Link
                to="/applications"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive('/applications')
                    ? 'border-primary-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <Briefcase className="w-4 h-4 mr-2" />
                Applications
              </Link>
              <Link
                to="/profile"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive('/profile')
                    ? 'border-primary-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </Link>
              <div className="hidden sm:flex items-center space-x-3 text-sm text-gray-600">
                {userInitial && (
                  <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-semibold">
                    {userInitial}
                  </div>
                )}
                <span>{user?.email}</span>
              </div>
              <button
                onClick={signOut}
                className="inline-flex items-center text-sm text-gray-500 hover:text-primary-600 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
