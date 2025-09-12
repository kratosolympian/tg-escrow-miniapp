'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface CreateEscrowForm {
  description: string
  price: string
  image?: File
}

interface CreatedEscrow {
  id: string
  code: string
}

export default function SellerPage() {
  const [form, setForm] = useState<CreateEscrowForm>({
    description: '',
    price: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdEscrow, setCreatedEscrow] = useState<CreatedEscrow | null>(null)
  const [onlineAdmins, setOnlineAdmins] = useState<Array<any>>([])
  const [selectedAdmin, setSelectedAdmin] = useState<string | null>(null)
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null)
  const [productImagePath, setProductImagePath] = useState<string | null>(null)
  const [draftRestored, setDraftRestored] = useState(false)
  
  // Auth states
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showAuthForm, setShowAuthForm] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup')
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' })
  const [authLoading, setAuthLoading] = useState(false)
  
  const router = useRouter()

  // Check authentication on load
  useEffect(() => {
    checkAuthStatus()
    fetchOnlineAdmins()
  }, [])

  // Restore draft from localStorage (description, price, selected admin, temp image path)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('seller:create-escrow:draft')
      if (raw) {
        const parsed = JSON.parse(raw)
        setForm(prev => ({ ...prev, ...parsed }))
        if (parsed.selectedAdmin) setSelectedAdmin(parsed.selectedAdmin)
        if (parsed.productImagePath) setProductImagePath(parsed.productImagePath)
        if (parsed.productImagePreview) setProductImagePreview(parsed.productImagePreview)
        setDraftRestored(true)
      }
    } catch (e) {
      // ignore
    }
  }, [])

  // Check if the current user has bank details set
  const [hasBankDetails, setHasBankDetails] = useState<boolean | null>(null)

  useEffect(() => {
    const checkBank = async () => {
      try {
        const res = await fetch('/api/profile/banking')
        if (res.ok) {
          const data = await res.json()
          const profile = data.profile ?? data
          const hasBank = !!(profile && (profile.bank_name || profile.account_number || profile.account_holder_name))
          setHasBankDetails(hasBank)
        } else {
          setHasBankDetails(false)
        }
      } catch (e) {
        console.error('Error checking bank details', e)
        setHasBankDetails(false)
      }
    }
    checkBank()
  }, [])

  const fetchOnlineAdmins = async () => {
    try {
      const res = await fetch('/api/admin/online-admins')
      if (res.ok) {
        const data = await res.json()
        setOnlineAdmins(data.admins || [])
      }
    } catch (e) {
      console.error('Error fetching admins', e)
    }
  }

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/status')
      if (response.ok) {
        setIsAuthenticated(true)
        setShowAuthForm(false)
      } else {
        setIsAuthenticated(false)
        setShowAuthForm(true)
      }
    } catch (error) {
      setIsAuthenticated(false)
      setShowAuthForm(true)
    }
  }

  // Handle authentication
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    setError('')

    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(authForm),
  credentials: 'include'
      })

      const data = await response.json()

      if (response.ok) {
        setIsAuthenticated(true)
        setShowAuthForm(false)
      } else {
        setError(data.error || 'Authentication failed')
      }
    } catch (error) {
      setError('Network error. Please try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  // Handle Telegram authentication (keep as fallback)
  useEffect(() => {
    const authenticateWithTelegram = async () => {
      // Only try Telegram auth if we've already determined the user is not authenticated
      if (isAuthenticated || !showAuthForm) return

      try {
        // Check if we're in Telegram WebApp
        const telegram = window.Telegram?.WebApp
        const isInTelegram = telegram?.initData
        
        if (isInTelegram && telegram) {
          const initData = telegram.initData
          
          if (initData) {
            // Call our Telegram auth endpoint
            const response = await fetch('/api/auth/telegram', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ initData })
            })

            if (response.ok) {
              setIsAuthenticated(true)
              setShowAuthForm(false)
              telegram.ready?.()
              telegram.expand?.()
            }
            // If Telegram auth fails, keep showAuthForm = true to show email/password form
          }
        }
        // If not in Telegram, keep showAuthForm = true to show email/password form
      } catch (error) {
        console.error('Telegram auth error:', error)
        // Keep showAuthForm = true to show email/password form
      }
    }

    authenticateWithTelegram()
  }, [isAuthenticated, showAuthForm])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm(prev => {
      const next = { ...prev, [name]: value }
      try {
        localStorage.setItem('seller:create-escrow:draft', JSON.stringify({ description: next.description, price: next.price, selectedAdmin, productImagePath, productImagePreview }))
      } catch {}
      return next
    })
  }

  const handleSelectedAdminChange = (id: string) => {
    setSelectedAdmin(id)
    try {
      localStorage.setItem('seller:create-escrow:draft', JSON.stringify({ description: form.description, price: form.price, selectedAdmin: id, productImagePath, productImagePreview }))
    } catch {}
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Upload a temporary image so it persists across navigations
      ;(async () => {
        try {
          const fd = new FormData()
          fd.append('image', file)
          const resp = await fetch('/api/escrow/upload-temp', { method: 'POST', body: fd, credentials: 'include' })
          const json = await resp.json().catch(() => null)
          if (resp.ok && json?.path) {
            const path = json.path
            setProductImagePath(path)
            // get a signed URL for preview
            try {
              const signResp = await fetch('/api/storage/sign-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, bucket: 'product-images' }), credentials: 'include' })
              const signJson = await signResp.json().catch(() => null)
              if (signResp.ok && signJson?.signedUrl) {
                setProductImagePreview(signJson.signedUrl)
              }
            } catch (e) {
              // ignore
            }

            setForm(prev => ({ ...prev, image: file }))
            try {
              localStorage.setItem('seller:create-escrow:draft', JSON.stringify({ description: form.description, price: form.price, selectedAdmin, productImagePath: path, productImagePreview }))
            } catch {}
          } else {
            // fallback: keep file in memory only
            setForm(prev => ({ ...prev, image: file }))
          }
        } catch (err) {
          console.error('Temp upload failed', err)
          setForm(prev => ({ ...prev, image: file }))
        }
      })()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.description.trim() || !form.price.trim()) return
    if (hasBankDetails === false) {
      setError('Please complete your bank details before creating an escrow.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('description', form.description.trim())
      formData.append('price', form.price)
      if (form.image) {
        formData.append('image', form.image)
      }
      if (selectedAdmin) {
        formData.append('assigned_admin_id', selectedAdmin)
      }
      if (productImagePath) {
        formData.append('productImagePath', productImagePath)
      }

      const response = await fetch('/api/escrow/create', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        setCreatedEscrow(data)
  try { localStorage.removeItem('seller:create-escrow:draft') } catch {}
      } else {
        setError(data.error || 'Failed to create transaction')
      }
    } catch (error) {
      console.error('Error creating escrow:', error)
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const copyCode = () => {
    if (createdEscrow) {
      navigator.clipboard.writeText(createdEscrow.code)
    }
  }

  const startNewTransaction = () => {
    setCreatedEscrow(null)
    setForm({ description: '', price: '' })
  try { localStorage.removeItem('seller:create-escrow:draft') } catch {}
  setError('')
  }

  const handleLogout = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST'
      })

      if (response.ok) {
        setIsAuthenticated(false)
        setShowAuthForm(true)
        setAuthForm({ email: '', password: '', name: '' })
        setAuthMode('signup')
        setError('')
        router.push('/')
      } else {
        const data = await response.json()
        setError(data.error || 'Logout failed')
      }
    } catch (error) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Show authentication form
  if (showAuthForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 flex items-center justify-center">
        <div className="card max-w-md mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              💼 Seller Account
            </h1>
            <p className="text-gray-600">
              {authMode === 'login' ? 'Sign in to your account' : 'Create your seller account'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'signup' && (
              <div>
                <label className="label">Full Name</label>
                <input
                  type="text"
                  value={authForm.name}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input"
                  placeholder="Your full name"
                  required
                />
              </div>
            )}
            
            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                value={authForm.email}
                onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                className="input"
                placeholder="your@email.com"
                required
              />
            </div>
            
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={authForm.password}
                onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                className="input"
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="btn-primary w-full"
            >
              {authLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {authMode === 'login' ? 'Signing In...' : 'Creating Account...'}
                </div>
              ) : (
                authMode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div className="text-center mt-4">
            <button
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login')
                setError('')
              }}
              className="text-blue-600 hover:text-blue-800"
            >
              {authMode === 'login' 
                ? "Don't have an account? Sign up" 
                : "Already have an account? Sign in"
              }
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show authentication error (old fallback)
  if (!isAuthenticated && error && !showAuthForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 p-4 flex items-center justify-center">
        <div className="card text-center max-w-md mx-auto">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">Authentication Failed</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Please make sure you're accessing this through the Telegram Mini App.</p>
        </div>
      </div>
    )
  }

  if (createdEscrow) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <div className="container mx-auto max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              🎉 Transaction Created!
            </h1>
          </div>

          <div className="card text-center">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">Your Transaction Code</h2>
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6">
                <p className="text-3xl font-mono font-bold text-green-600 mb-4">
                  {createdEscrow.code}
                </p>
                <button
                  onClick={copyCode}
                  className="btn-secondary"
                >
                  📋 Copy Code
                </button>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <p className="text-gray-600">
                Share this code with your buyer so they can join the transaction.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
                <p className="font-semibold text-blue-800 mb-2">Next Steps:</p>
                <ol className="text-blue-700 text-left space-y-1">
                  <li>1. Share the transaction code with your buyer</li>
                  <li>2. Buyer will make payment and upload receipt</li>
                  <li>3. Admin will verify payment</li>
                  <li>4. You can then mark as delivered</li>
                </ol>
              </div>
            </div>

            <div className="space-y-3">
              <Link 
                href={`/seller/escrow/${createdEscrow.id}`}
                className="btn-primary w-full"
              >
                View Transaction Details
              </Link>
              <button
                onClick={startNewTransaction}
                className="btn-secondary w-full"
              >
                Create Another Transaction
              </button>
              <Link href="/" className="btn-secondary w-full">
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-4">
      <div className="container mx-auto max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-green-600 hover:text-green-800 mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            💼 Seller Portal
          </h1>
          <p className="text-gray-600">
            Create a new escrow transaction
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="description" className="label">
                Product/Service Description
              </label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleInputChange}
                placeholder="Describe what you're selling..."
                className="textarea"
                rows={4}
                required
                disabled={loading}
                maxLength={1000}
              />
              <p className="mt-1 text-sm text-gray-500">
                {form.description.length}/1000 characters
              </p>
            </div>

            <div>
              <label htmlFor="price" className="label">
                Price (₦)
              </label>
              <input
                type="number"
                id="price"
                name="price"
                value={form.price}
                onChange={handleInputChange}
                placeholder="0.00"
                className="input"
                min="1"
                max="1000000"
                step="0.01"
                required
                disabled={loading}
              />
              <p className="mt-1 text-sm text-gray-500">
                A ₦300 service fee will be added to this amount
              </p>
            </div>

            <div>
              <label htmlFor="image" className="label">
                Product Image (Optional)
              </label>
              <input
                type="file"
                id="image"
                accept="image/*"
                onChange={handleImageChange}
                disabled={loading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
              />
              <p className="mt-1 text-sm text-gray-500">
                JPEG, PNG, or WebP (max 5MB)
              </p>
            </div>

            {onlineAdmins && onlineAdmins.length > 0 && (
              <div>
                <label htmlFor="assigned_admin" className="label">Assign an Online Admin (optional)</label>
                <select id="assigned_admin" value={selectedAdmin || ''} onChange={(e) => handleSelectedAdminChange(e.target.value)} className="input">
                  <option value="">-- Choose an online admin --</option>
                  {onlineAdmins.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.full_name || a.email || a.telegram_id}</option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">Pick an online admin to handle this transaction (optional).</p>
              </div>
            )}

            {draftRestored && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-yellow-900">A draft was restored from a previous session.</div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => {
                      try { localStorage.removeItem('seller:create-escrow:draft') } catch {}
                      setForm({ description: '', price: '' })
                      setSelectedAdmin(null)
                      setProductImagePath(null)
                      setProductImagePreview(null)
                      setDraftRestored(false)
                    }} className="px-3 py-1 bg-red-100 text-red-800 rounded">Discard draft</button>
                  </div>
                </div>
              </div>
            )}

            {productImagePreview && (
              <div className="mt-3">
                <label className="label">Image preview</label>
                <img src={productImagePreview} alt="preview" className="w-full rounded-md" />
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
                <div>{error}</div>
                {error.includes('bank details') && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => router.push('/settings/profile')}
                      className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Update banking info
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !form.description.trim() || !form.price.trim()}
              className="btn-primary w-full"
            >
              {loading ? 'Creating...' : 'Create Transaction'}
            </button>
          </form>

          {form.price && (
            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
              <h3 className="font-semibold text-gray-900 mb-2">Transaction Summary</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Product Price:</span>
                  <span>₦{parseFloat(form.price || '0').toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Service Fee:</span>
                  <span>₦300</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-1 mt-2">
                  <span>Buyer Pays:</span>
                  <span>₦{(parseFloat(form.price || '0') + 300).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>

  {isAuthenticated && <button onClick={handleLogout} className="btn-secondary mt-4">🚪 Logout</button>}
      </div>
    </div>
  )
}
