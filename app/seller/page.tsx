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
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/status')
      if (response.ok) {
        setIsAuthenticated(true)
      } else {
        setShowAuthForm(true)
      }
    } catch (error) {
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
        body: JSON.stringify(authForm)
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
      if (isAuthenticated || showAuthForm) return

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
              telegram.ready?.()
              telegram.expand?.()
            } else {
              setShowAuthForm(true)
            }
          }
        }
      } catch (error) {
        console.error('Telegram auth error:', error)
        setShowAuthForm(true)
      }
    }

    authenticateWithTelegram()
  }, [isAuthenticated, showAuthForm])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setForm(prev => ({ ...prev, image: file }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.description.trim() || !form.price.trim()) return

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('description', form.description.trim())
      formData.append('price', form.price)
      if (form.image) {
        formData.append('image', form.image)
      }

      const response = await fetch('/api/escrow/create', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        setCreatedEscrow(data)
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
    setError('')
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

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
                {error}
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
      </div>
    </div>
  )
}
