import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

interface AuthContextValue {
  session: Session | null
  user: User | null
  isLoading: boolean
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  sendMagicLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
  getAccessToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadSession = async () => {
      setIsLoading(true)
      const { data } = await supabase.auth.getSession()
      if (!isMounted) return
      setSession(data.session ?? null)
      setIsLoading(false)
    }

    loadSession()

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return
      setSession(newSession)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setIsLoading(false)
    if (error) {
      throw error
    }
  }, [])

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) {
      setIsLoading(false)
      throw error
    }
    setIsLoading(false)
  }, [])

  const sendMagicLink = useCallback(async (email: string) => {
    setIsLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) {
      setIsLoading(false)
      throw error
    }
    setIsLoading(false)
  }, [])

  const signOut = useCallback(async () => {
    setIsLoading(true)
    const { error } = await supabase.auth.signOut()
    if (error) {
      setIsLoading(false)
      throw error
    }
    setSession(null)
    setIsLoading(false)
  }, [])

  const refreshSession = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await supabase.auth.refreshSession()
    if (error) {
      setIsLoading(false)
      throw error
    }
    setSession(data.session)
    setIsLoading(false)
  }, [])

  const getAccessToken = useCallback(async () => {
    if (session?.access_token) {
      return session.access_token
    }
    const { data } = await supabase.auth.getSession()
    setSession(data.session ?? null)
    return data.session?.access_token ?? null
  }, [session])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      signInWithEmail,
      signUpWithEmail,
      sendMagicLink,
      signOut,
      refreshSession,
      getAccessToken,
    }),
    [session, isLoading, signInWithEmail, signUpWithEmail, sendMagicLink, signOut, refreshSession, getAccessToken]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
