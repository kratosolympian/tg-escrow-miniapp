'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { formatNaira } from '@/lib/utils'
import { getStatusLabel, getStatusColor } from '@/lib/status'
import EscrowChat from '@/components/EscrowChat'

interface User {
  id: string
  email: string
}

interface Escrow {
  id: string
  code: string
  description: string
  price: number
  admin_fee: number
  product_image_url?: string
  status: string
  created_at: string
  seller_id: string
  buyer_id?: string
  seller?: { telegram_id: string }
  buyer?: { telegram_id: string }
  receipts?: Array<{
    id: string
    created_at: string
  }>
}

interface BankSettings {
  bank_name: string
  account_number: string
  account_holder: string
}

export default function BuyerEscrowPage() {
  const params = useParams()
  const code = params.code as string
  
  const [escrow, setEscrow] = useState<Escrow | null>(null)
  const [bankSettings, setBankSettings] = useState<BankSettings | null>(null)
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  // Authentication states
  const [user, setUser] = useState<User | null>(null)
  const [showAuthForm, setShowAuthForm] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup')
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' })
  const [authLoading, setAuthLoading] = useState(false)
  const [joining, setJoining] = useState(false)
  const authFormRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    checkAuthStatus()
    fetchEscrow()
    fetchBankSettings()
    fetchCurrentUser()
  }, [code])

  useEffect(() => {
    if (escrow?.product_image_url) {
      fetchProductImage()
    }
  }, [escrow])

  const fetchEscrow = async () => {
    try {
      const response = await fetch(`/api/escrow/by-code/${code}`)
      if (response.ok) {
        const data = await response.json()
        setEscrow(data)
      } else {
        setError('Transaction not found')
      }
    } catch (error) {
      console.error('Error fetching escrow:', error)
      setError('Failed to load transaction')
    } finally {
      setLoading(false)
    }
  }

  const fetchBankSettings = async () => {
    try {
      const response = await fetch('/api/settings/bank')
      if (response.ok) {
        const data = await response.json()
        setBankSettings(data)
      }
    } catch (error) {
      console.error('Error fetching bank settings:', error)
    }
  }

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/status')
      if (response.ok) {
        const data = await response.json()
        if (data.authenticated) {
          setUser(data.user)
          setShowAuthForm(false)
        } else {
          setUser(null)
        }
      }
    } catch (error) {
      console.error('Auth check error:', error)
      setUser(null)
    }
  }

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setCurrentUser(data)
      }
    } catch (error) {
      console.error('Error fetching current user:', error)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    setError('')

    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(authForm)
      })

      const data = await response.json()

      if (response.ok) {
        setUser(data.user)
        setShowAuthForm(false)
        setAuthForm({ email: '', password: '', name: '' })
        setSuccess(authMode === 'login' ? 'Logged in successfully!' : 'Account created successfully!')
        // If the transaction is joinable, attempt to join automatically after auth
        try {
          if (escrow && escrow.status === 'created' && !escrow.buyer_id && escrow.seller_id !== data.user.id) {
            // attempt join using credentials-aware request
            const joinRes = await fetch('/api/escrow/join', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ code: escrow.code })
            })
            const joinJson = await joinRes.json().catch(() => null)
            if (joinRes.ok) {
              setSuccess('Successfully joined the transaction!')
              fetchEscrow()
            } else {
              // don't overwrite existing success message
              setError(joinJson?.error || 'Failed to join transaction after login')
            }
          }
        } catch (joinErr) {
          console.error('Auto-join after auth error:', joinErr)
        }
      } else {
        setError(data.error || 'Authentication failed')
      }
    } catch (error) {
      console.error('Auth error:', error)
      setError('Authentication failed. Please try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleJoinTransaction = async () => {
    if (!user || !escrow) return

    setJoining(true)
    setError('')

    try {
      const response = await fetch('/api/escrow/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ code: escrow.code })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('Successfully joined the transaction!')
        fetchEscrow() // Refresh to show updated status
      } else {
        setError(data.error || 'Failed to join transaction')
      }
    } catch (error) {
      console.error('Join error:', error)
      setError('Failed to join transaction. Please try again.')
    } finally {
      setJoining(false)
    }
  }

  const fetchProductImage = async () => {
    if (!escrow?.product_image_url) return

    try {
      const response = await fetch('/api/storage/sign-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: escrow.product_image_url,
          bucket: 'product-images'
        })
      })

      if (response.ok) {
        const data = await response.json()
        setProductImageUrl(data.signedUrl)
      }
    } catch (error) {
      console.error('Error fetching product image:', error)
    }
  }

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !escrow) return

    setUploading(true)
    setError('')
    setSuccess('')

    try {
      const formData = new FormData()
      formData.append('escrowId', escrow.id)
      formData.append('file', file)

      const response = await fetch('/api/escrow/upload-receipt', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        setSuccess('Receipt uploaded successfully!')
        fetchEscrow() // Refresh escrow data
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to upload receipt')
      }
    } catch (error) {
      console.error('Error uploading receipt:', error)
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleConfirmReceived = async () => {
    if (!escrow) return

    try {
      const response = await fetch('/api/escrow/confirm-received', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ escrowId: escrow.id })
      })

      if (response.ok) {
        setSuccess('Receipt confirmed successfully!')
        fetchEscrow()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to confirm receipt')
      }
    } catch (error) {
      console.error('Error confirming receipt:', error)
      setError('Failed to confirm receipt')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading transaction...</p>
        </div>
      </div>
    )
  }

  if (!escrow) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Transaction not found'}</p>
          <Link href="/buyer" className="btn-primary">
            Back to Buyer Portal
          </Link>
        </div>
      </div>
    )
  }

  const totalAmount = escrow.price + escrow.admin_fee
  const canUploadReceipt = escrow.status === 'waiting_payment' || escrow.status === 'waiting_admin'
  const canConfirmReceived = escrow.status === 'in_progress'
  
  // Check if user can join this transaction
  // For public view, we use has_buyer field since seller_id/buyer_id are not returned when not authenticated
  const canJoinTransaction = escrow.status === 'created' && !escrow.buyer_id && (!user || escrow.seller_id !== user.id) 
  const canJoinPublic = escrow.status === 'created' && !(escrow as any).has_buyer // For unauthenticated users
  const isUserBuyer = user && escrow.buyer_id === user.id
  const isUserSeller = user && escrow.seller_id === user.id
  const needsAuthentication = (canJoinTransaction || canJoinPublic) && !user

  console.log('DEBUG - Conditional variables:', {
    escrowStatus: escrow.status,
    buyerId: escrow.buyer_id,
    sellerId: escrow.seller_id,
    hasBuyer: (escrow as any).has_buyer,
    userId: user?.id,
    canJoinTransaction,
    canJoinPublic,
    isUserBuyer,
    isUserSeller,
    needsAuthentication
  })

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-2xl">
        <div className="mb-6">
          <Link href="/buyer" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Buyer Portal
          </Link>
        </div>

        {/* Transaction Header */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Transaction {escrow.code}</h1>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(escrow.status as any)}`}>
              {getStatusLabel(escrow.status as any)}
            </span>
          </div>
          
          {productImageUrl && (
            <div className="mb-4">
              <Image
                src={productImageUrl}
                alt="Product"
                width={300}
                height={200}
                className="rounded-lg object-cover"
              />
            </div>
          )}

          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-gray-900">Description</h3>
              <p className="text-gray-600">{escrow.description}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold text-gray-900">Price</h3>
                <p className="text-lg">{formatNaira(escrow.price)}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Service Fee</h3>
                <p className="text-lg">{formatNaira(escrow.admin_fee)}</p>
              </div>
            </div>
            
            <div className="pt-3 border-t">
              <h3 className="font-semibold text-gray-900">Total Amount</h3>
              <p className="text-2xl font-bold text-green-600">{formatNaira(totalAmount)}</p>
            </div>

            {/* Show admin bank details for buyer payments */}
            {(escrow as any).admin_bank && (
              <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900">Pay To</h3>
                <div>
                  <span className="font-medium">Bank Name:</span> {(escrow as any).admin_bank.bank_name}
                </div>
                <div>
                  <span className="font-medium">Account Number:</span> {(escrow as any).admin_bank.account_number}
                </div>
                <div>
                  <span className="font-medium">Account Holder:</span> {(escrow as any).admin_bank.account_holder || (escrow as any).admin_bank.account_holder_name}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Prominent Auth Banner for buyers who need to sign in */}
        {needsAuthentication && !showAuthForm && (
          <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-blue-800">Sign in to Join</h3>
              <p className="text-sm text-blue-700">Create an account or sign in to join this transaction and make a payment.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setAuthMode('signup'); setShowAuthForm(true); setTimeout(() => authFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150) }}
                className="btn-primary"
              >
                Sign Up
              </button>
              <button
                onClick={() => { setAuthMode('login'); setShowAuthForm(true); setTimeout(() => authFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150) }}
                className="btn-secondary"
              >
                Login
              </button>
            </div>
          </div>
        )}

        {/* Join Transaction Section */}
        {needsAuthentication && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">🔑 Join This Transaction</h2>
            <p className="text-gray-600 mb-4">
              To join this transaction, you need to create an account or sign in.
            </p>
            
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => { setAuthMode('signup'); setShowAuthForm(true); }}
                className={`px-4 py-2 rounded-lg ${authMode === 'signup' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                Sign Up
              </button>
              <button
                onClick={() => { setAuthMode('login'); setShowAuthForm(true); }}
                className={`px-4 py-2 rounded-lg ${authMode === 'login' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                Login
              </button>
            </div>

            {showAuthForm && (
              <div ref={authFormRef}>
              <form onSubmit={handleAuth} className="space-y-4">
                {authMode === 'signup' && (
                  <div>
                    <label htmlFor="name" className="label">Full Name</label>
                    <input
                      type="text"
                      id="name"
                      value={authForm.name}
                      onChange={(e) => setAuthForm(prev => ({ ...prev, name: e.target.value }))}
                      className="input"
                      required
                      disabled={authLoading}
                    />
                  </div>
                )}
                
                <div>
                  <label htmlFor="email" className="label">Email</label>
                  <input
                    type="email"
                    id="email"
                    value={authForm.email}
                    onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                    className="input"
                    required
                    disabled={authLoading}
                  />
                </div>
                
                <div>
                  <label htmlFor="password" className="label">Password</label>
                  <input
                    type="password"
                    id="password"
                    value={authForm.password}
                    onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                    className="input"
                    required
                    disabled={authLoading}
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={authLoading}
                  className="btn-primary w-full"
                >
                  {authLoading ? 'Processing...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
                </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Join Transaction Button */}
        {canJoinTransaction && user && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">🚀 Ready to Join?</h2>
            <p className="text-gray-600 mb-4">
              Join this transaction to proceed with the purchase. You'll be able to make payment and track the progress.
            </p>
            
            <button
              onClick={handleJoinTransaction}
              disabled={joining}
              className="btn-primary w-full"
            >
              {joining ? 'Joining Transaction...' : 'Join Transaction'}
            </button>
          </div>
        )}

        {/* User Status Information */}
        {isUserSeller && (
          <div className="card mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="font-semibold text-blue-800 mb-2">👨‍💼 You are the seller</h3>
              <p className="text-blue-600">
                This is your transaction. Share the code <strong>{escrow.code}</strong> with your buyer.
              </p>
            </div>
          </div>
        )}

        {escrow.buyer_id && !isUserBuyer && !isUserSeller && (
          <div className="card mb-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Transaction Unavailable</h3>
              <p className="text-yellow-600">
                This transaction already has a buyer and is no longer available to join.
              </p>
            </div>
          </div>
        )}

        {/* Bank Details */}
        {bankSettings && (isUserBuyer || (canUploadReceipt && user)) && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">💳 Payment Details</h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-gray-900">Bank Name</h3>
                <p className="text-gray-600">{bankSettings.bank_name}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Account Number</h3>
                <p className="text-lg font-mono">{bankSettings.account_number}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Account Holder</h3>
                <p className="text-gray-600">{bankSettings.account_holder}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Amount to Pay</h3>
                <p className="text-xl font-bold text-green-600">{formatNaira(totalAmount)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Receipt Upload */}
        {canUploadReceipt && isUserBuyer && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">📄 Upload Payment Receipt</h2>
            <div className="space-y-4">
              <p className="text-gray-600">
                After making the payment, upload your receipt here for verification.
              </p>
              
              <div>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleReceiptUpload}
                  disabled={uploading}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Supports: JPEG, PNG, WebP, PDF (max 10MB)
                </p>
              </div>
              
              {uploading && (
                <div className="text-blue-600">
                  Uploading receipt...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confirm Received */}
        {canConfirmReceived && isUserBuyer && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">✅ Confirm Product Received</h2>
            <p className="text-gray-600 mb-4">
              Have you received the product/service and are satisfied with it?
            </p>
            <button
              onClick={handleConfirmReceived}
              className="btn-success"
            >
              Confirm Received
            </button>
          </div>
        )}

        {/* Communication Chat */}
        {escrow.seller && isUserBuyer && currentUser && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">💬 Communication</h2>
            <EscrowChat 
              escrowId={escrow.id}
              currentUserId={currentUser.id}
              isAdmin={false}
            />
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 mb-4">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-800 mb-4">
            {success}
          </div>
        )}

        {/* Receipt Status */}
        {escrow.receipts && escrow.receipts.length > 0 && isUserBuyer && (
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Receipt Status</h2>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-green-800">
                ✅ Receipt uploaded successfully and is being reviewed by admin.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
