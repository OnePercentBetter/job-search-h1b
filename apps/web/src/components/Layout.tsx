import { Link, useLocation } from 'react-router-dom'
import { Search, User, Briefcase, LogOut } from 'lucide-react'
import { useAuth } from '../providers/AuthProvider'

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { user, signOut } = useAuth()

  const userInitial = user?.email?.charAt(0)?.toUpperCase()

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-white text-slate-800">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center font-semibold shadow-md">
                JS
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">JobSearch</p>
                <p className="text-xs text-slate-500">Find your next visa-friendly role</p>
              </div>
            </div>
            <nav className="flex flex-wrap items-center gap-4 text-sm font-medium">
              <Link
                to="/dashboard"
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 transition-all ${
                  isActive('/dashboard')
                    ? 'bg-sky-500/10 text-sky-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Search className="w-4 h-4" />
                Search
              </Link>
              <Link
                to="/applications"
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 transition-all ${
                  isActive('/applications')
                    ? 'bg-sky-500/10 text-sky-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                Applications
              </Link>
              <Link
                to="/profile"
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 transition-all ${
                  isActive('/profile')
                    ? 'bg-sky-500/10 text-sky-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <User className="w-4 h-4" />
                Profile
              </Link>
            </nav>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              {userInitial && (
                <div className="hidden sm:flex h-9 w-9 rounded-full bg-sky-500/15 text-sky-600 items-center justify-center font-semibold">
                  {userInitial}
                </div>
              )}
              <span className="hidden sm:inline-flex">{user?.email}</span>
              <button
                onClick={signOut}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-slate-500 hover:border-sky-300 hover:text-sky-600 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="pb-16">{children}</main>
    </div>
  )
}
