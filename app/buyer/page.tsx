'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function BuyerPage() {
  const [user, setUser] = useState<any | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { supabase } = await import('@/lib/supabaseClient')
        const { data } = await supabase.auth.getUser()
        if (mounted) setUser(data?.user ?? null)
      } catch (e) {
        console.error('Failed to get user on mount', e)
      }
    })()

    return () => { mounted = false }
  }, [])
  const handleLogout = async () => {
    try {
      const { supabase } = await import('@/lib/supabaseClient')
      await supabase.auth.signOut()
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.href = '/'
    } catch (error) {
      console.error('Logout error:', error)
    }
  }
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authName, setAuthName] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const router = useRouter()

  const handleJoinEscrow = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
  // Allow the request to proceed even if the user is not locally known.
  // The server will return 401 if authentication is required; handle that below.
    setLoading(true)
    setError('')

    try {
      const response = await doJoin(code.trim())
      if (response.ok) {
        router.push(`/buyer/escrow/${code.trim().toUpperCase()}`)
        return
      }

      const data = await response.json().catch(() => null)
      if (response.status === 401) {
        setShowAuthPrompt(true)
      }
      setError(data?.error || 'Failed to join transaction')
    } catch (error) {
      console.error('Error joining escrow:', error)
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Helper to perform join POST (returns fetch Response)
  async function doJoin(joinCode: string, oneTimeToken?: string) {
    const body: any = { code: joinCode }
    if (oneTimeToken) body.__one_time_token = oneTimeToken
    return fetch('/api/escrow/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    })
  }

  // Attempt auth (login or register) inline and retry join on success
  const handleAuthSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    try {
      const { supabase } = await import('@/lib/supabaseClient')
      if (authMode === 'login') {
        // Use server login so the HTTP-only cookie is set on the server response
        const resp = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authEmail, password: authPassword }),
          credentials: 'include'
        })
        const respJson = await resp.json().catch(() => null)
        if (!resp.ok) {
          throw new Error(respJson?.error || 'Login failed')
        }
      } else {
        // register via server API so we receive the one-time token that allows
        // an immediate server-side join without relying on cookie plumbing.
        const resp = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authEmail, password: authPassword, name: authName }),
          credentials: 'include',
        })
        const respJson = await resp.json().catch(() => null)
        if (!resp.ok) {
          // Surface a friendly message inline instead of throwing.
          const friendly = respJson?.error || respJson?.message || (typeof respJson === 'string' ? respJson : null) || 'Registration failed. Please try again.'
          setAuthError(friendly)
          setAuthLoading(false)
          return
        }

        const token = respJson?.__one_time_token
        // On success, hide auth prompt and immediately call join with token
        setShowAuthPrompt(false)
        setAuthLoading(false)
        setAuthError('')

        const joinResp = await doJoin(code.trim(), token)
        if (joinResp.ok) {
          router.push(`/buyer/escrow/${code.trim().toUpperCase()}`)
          return
        }
        const joinData = await joinResp.json().catch(() => null)
        setError(joinData?.error || 'Failed to join after registration')
        if (joinResp.status === 401) setShowAuthPrompt(true)
        setAuthLoading(false)
        return
      }

      // On success (login path), hide auth prompt and retry join
      setShowAuthPrompt(false)
      setAuthLoading(false)
      setAuthError('')

      // retry join and navigate if successful
      const response = await doJoin(code.trim())
      if (response.ok) {
        router.push(`/buyer/escrow/${code.trim().toUpperCase()}`)
      } else {
        const data = await response.json().catch(() => null)
        setError(data?.error || 'Failed to join after authentication')
        if (response.status === 401) setShowAuthPrompt(true)
      }
    } catch (err: any) {
      console.error('Auth error:', err)
      setAuthError(err?.message || 'Authentication failed')
      setAuthLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="container mx-auto max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🛒 Buyer Portal
          </h1>
          <p className="text-gray-600">
            Enter your transaction code to join an escrow
          </p>
          {user && <button onClick={handleLogout} className="btn-secondary mt-4">🚪 Logout</button>}
        </div>

        <div className="card">
          <form onSubmit={handleJoinEscrow} className="space-y-6">
            <div>
              <label htmlFor="code" className="label">
                Transaction Code
              </label>
              <input
                type="text"
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Enter transaction code"
                className="input"
                required
                disabled={loading}
              />
              <p className="mt-2 text-sm text-gray-500">
                Get this code from the seller
              </p>
              </div>

            {showAuthPrompt && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-900">
                <div className="mb-2 font-medium">Authentication required</div>

                <div className="mb-3">
                  <div className="flex gap-2 mb-2">
                    <button type="button" onClick={() => setAuthMode('login')} className={"px-3 py-1 rounded " + (authMode === 'login' ? 'bg-yellow-200' : 'bg-white')}>Sign in</button>
                    <button type="button" onClick={() => setAuthMode('register')} className={"px-3 py-1 rounded " + (authMode === 'register' ? 'bg-yellow-200' : 'bg-white')}>Register</button>
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); handleAuthSubmit(e) }} className="space-y-2">
                    <div>
                      <label className="label">Email</label>
                      <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="input" required />
                    </div>
                    {authMode === 'register' && (
                      <div>
                        <label className="label">Full name</label>
                        <input type="text" value={authName} onChange={(e) => setAuthName(e.target.value)} className="input" required />
                      </div>
                    )}
                    <div>
                      <label className="label">Password</label>
                      <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="input" required minLength={6} />
                    </div>

                    {authError && <div className="text-sm text-red-700">{authError}</div>}

                    <div className="flex gap-2">
                      <button type="submit" disabled={authLoading} className="btn-primary">
                        {authLoading ? 'Processing...' : (authMode === 'login' ? 'Sign in' : 'Register & Sign in')}
                      </button>
                      <button type="button" onClick={() => setShowAuthPrompt(false)} className="btn-secondary">Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="btn-primary w-full"
            >
              {loading ? 'Joining...' : 'Join Transaction'}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <h3 className="font-semibold mb-4">How it works:</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs flex-shrink-0 mt-0.5">1</span>
              <p>Enter the transaction code provided by the seller</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs flex-shrink-0 mt-0.5">2</span>
              <p>Review product details and total amount (price + ₦300 fee)</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs flex-shrink-0 mt-0.5">3</span>
              <p>Make payment to the provided bank account</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs flex-shrink-0 mt-0.5">4</span>
              <p>Upload payment receipt for verification</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
