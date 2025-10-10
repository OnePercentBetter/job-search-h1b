import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'

export function Login() {
  const {
    session,
    signInWithEmail,
    signUpWithEmail,
    sendMagicLink,
    isLoading,
  } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [mode, setMode] = useState<'signin' | 'signup' | 'magiclink'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (session) {
      navigate('/dashboard', { replace: true })
    }
  }, [session, navigate])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      setError(null)
      setStatus(null)
      if (!email.trim()) {
        setError('Enter your email to continue.')
        return
      }
      if (mode === 'magiclink') {
        await sendMagicLink(email.trim())
        setStatus('Magic link sent. Check your inbox to finish signing in.')
        return
      }
      if (!password.trim()) {
        setError('Enter your password to continue.')
        return
      }
      if (mode === 'signup') {
        await signUpWithEmail(email.trim(), password)
        setStatus('Account created. Check your email to confirm your address if required, then sign in.')
      } else {
        await signInWithEmail(email.trim(), password)
      }
    } catch (err) {
      console.error('Email auth failed', err)
      setError('Authentication failed. Verify your credentials and try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <h2 className="text-3xl font-bold text-center mb-8">Job Search</h2>
        <p className="text-gray-600 text-center mb-6">
          Find new grad roles and internships tailored to you
        </p>

        <div className="flex items-center justify-center gap-2 text-sm mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('signin')
              setError(null)
              setStatus(null)
            }}
            className={`px-3 py-1 rounded-full ${mode === 'signin' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup')
              setError(null)
              setStatus(null)
            }}
            className={`px-3 py-1 rounded-full ${mode === 'signup' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Create account
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('magiclink')
              setError(null)
              setStatus(null)
            }}
            className={`px-3 py-1 rounded-full ${mode === 'magiclink' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Magic link
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
            {error}
          </div>
        )}
        {status && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3 mb-4">
            {status}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="you@example.com"
              required
            />
          </div>

          {mode !== 'magiclink' && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                placeholder="••••••••"
                required={mode !== 'magiclink'}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-75 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {isLoading
              ? 'Working...'
              : mode === 'signup'
              ? 'Create account'
              : mode === 'magiclink'
              ? 'Send magic link'
              : 'Sign in'}
          </button>
        </form>
        
        <p className="text-sm text-gray-500 text-center mt-6">
          By signing in, you agree to our Terms of Service
        </p>
      </div>
    </div>
  )
}
