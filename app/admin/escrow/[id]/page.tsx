'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { formatNaira } from '@/lib/utils'
import StatusBadge from '@/components/StatusBadge'
import EscrowChat from '@/components/EscrowChat'
import { supabase } from '@/lib/supabaseClient'

interface EscrowDetail {
  id: string
  code: string
  seller_id: string
  buyer_id: string | null
  description: string
  price: number
  admin_fee: number
  expires_at?: string | null
  product_image_url: string | null
  delivery_proof_url: string | null
  status: string
  created_at: string
  updated_at: string
  seller: {
    telegram_id: string | null
    email: string
    full_name: string
    bank_name: string | null
    account_number: string | null
    account_holder_name: string | null
    phone_number: string | null
  }
  buyer: {
    telegram_id: string | null
    email: string
    full_name: string
    bank_name: string | null
    account_number: string | null
    account_holder_name: string | null
    phone_number: string | null
  } | null
  receipts: Array<{
    id: string
    signed_url: string
    uploaded_at: string
    filename: string
  }>
  status_logs?: Array<{
    id: string
    status: string
    created_at: string
    changed_by: string | null
  }>
}

interface AdminAction {
  id: string
  action: string
  admin_email: string
  notes: string | null
  created_at: string
}

export default function AdminEscrowDetailPage() {
  const params = useParams()
  const escrowId = params.id as string
  
  const [escrow, setEscrow] = useState<EscrowDetail | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [adminActions, setAdminActions] = useState<AdminAction[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [showNotesForm, setShowNotesForm] = useState(false)
  const [statusChangeNotification, setStatusChangeNotification] = useState<string | null>(null)
  const [deliveryProofSignedUrl, setDeliveryProofSignedUrl] = useState<string | null>(null)
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null)

  // Countdown state: show time until escrow expires (uses `expires_at` if present,
  // otherwise falls back to created_at + 30 minutes)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  const computeExpiry = (e: EscrowDetail | null) => {
    if (!e) return null
    if (e.expires_at) return new Date(e.expires_at)
    return new Date(new Date(e.created_at).getTime() + 30 * 60 * 1000)
  }

  useEffect(() => {
    if (!escrow) {
      setSecondsLeft(null)
      return
    }

    const expiry = computeExpiry(escrow)
    if (!expiry) return

    const update = () => {
      const s = Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 1000))
      setSecondsLeft(s)
    }

    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [escrow?.expires_at, escrow?.created_at, escrow])

  useEffect(() => {
    if (escrowId) {
      fetchEscrowDetails()
      fetchAdminActions()
    }
  }, [escrowId])

  useEffect(() => {
    fetchCurrentUser()
  }, [])

  // Fetch delivery proof signed URL when escrow has delivery proof
  useEffect(() => {
    if (!escrow?.delivery_proof_url) {
      setDeliveryProofSignedUrl(null)
      return
    }

    const fetchDeliveryProofSignedUrl = async () => {
      try {
        const response = await fetch('/api/storage/sign-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: escrow.delivery_proof_url, bucket: 'product-images' }),
          credentials: 'include'
        })
        if (response.ok) {
          const data = await response.json()
          setDeliveryProofSignedUrl(data.signedUrl)
        } else {
          setDeliveryProofSignedUrl(null)
        }
      } catch (err) {
        console.error('Error fetching delivery proof signed url:', err)
        setDeliveryProofSignedUrl(null)
      }
    }

    fetchDeliveryProofSignedUrl()
  }, [escrow?.delivery_proof_url])

  // Fetch product image signed URL when escrow loads
  useEffect(() => {
    if (!escrow?.product_image_url) {
      setProductImageUrl(null)
      return
    }

    const fetchProductImageSignedUrl = async () => {
      try {
        const response = await fetch('/api/storage/sign-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: escrow.product_image_url, bucket: 'product-images' }),
          credentials: 'include'
        })
        if (response.ok) {
          const data = await response.json()
          setProductImageUrl(data.signedUrl)
        } else {
          setProductImageUrl(null)
        }
      } catch (err) {
        console.error('Error fetching product image signed url:', err)
        setProductImageUrl(null)
      }
    }

    fetchProductImageSignedUrl()
  }, [escrow?.product_image_url])

  // Subscribe to escrow updates (status changes, receipts, etc.) so UI updates in real-time
  useEffect(() => {
    if (!escrowId) return
    const channel = supabase
      .channel(`escrow-updates-${escrowId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escrows', filter: `id=eq.${escrowId}` }, (payload) => {
        try {
          console.debug('[AdminEscrowPage] escrow payload', payload)
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newRow = payload.new as Partial<EscrowDetail>
            setEscrow(prev => {
              const merged = { ...(prev || {}), ...(newRow || {}) } as EscrowDetail
              // Check if status changed
              if (prev && prev.status !== merged.status) {
                setStatusChangeNotification(`Status changed to: ${merged.status}`)
                // Auto-dismiss notification after 5 seconds
                setTimeout(() => setStatusChangeNotification(null), 5000)
              }
              return merged
            })
            // If receipts or product image changed, let existing effects pick up signed urls
          }
        } catch (err) {
          console.error('Error handling escrow realtime payload', err)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [escrowId])

  const fetchCurrentUser = async () => {
    try {
  const response = await fetch('/api/auth/me', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setCurrentUser(data.user)
      }
    } catch (error) {
      console.error('Error fetching current user:', error)
    }
  }

  const fetchEscrowDetails = async () => {
    try {
      setLoading(true)
  const response = await fetch(`/api/escrow/by-id/${escrowId}`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setEscrow(data.escrow)
      } else {
        setError('Failed to fetch escrow details')
      }
    } catch (error) {
      console.error('Error fetching escrow:', error)
      setError('Failed to fetch escrow details')
    } finally {
      setLoading(false)
    }
  }

  const fetchAdminActions = async () => {
    try {
      // This would be a new API endpoint to fetch admin action history
  const response = await fetch(`/api/admin/escrow-actions/${escrowId}`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setAdminActions(data.actions || [])
      }
    } catch (error) {
      console.error('Error fetching admin actions:', error)
    }
  }

  const handleAdminAction = async (action: string, notes?: string) => {
    if (!escrow) return

    // Confirmation for destructive actions
    if (action === 'refund') {
      if (!confirm(`Are you sure you want to refund this transaction to the buyer?`)) return
    }
    if (action === 'release-funds') {
      if (!confirm(`Are you sure you want to release funds to the seller?`)) return
    }

    setActionLoading(action)
    setError('')
    setSuccess('')

    try {
      // Map action to endpoint and request body key
      let endpoint: string | null = null;
      let body: any = {};
      if (action === 'confirm-payment') {
        endpoint = '/api/admin/confirm-payment';
        body = { escrowId: escrow.id };
      } else if (action === 'release-funds') {
        endpoint = '/api/admin/release-funds';
        body = { escrowId: escrow.id, admin_notes: notes || adminNotes || undefined };
      } else if (action === 'refund') {
        endpoint = '/api/admin/refund';
        body = { escrowId: escrow.id, admin_notes: notes || adminNotes || undefined };
      } else if (action === 'put-on-hold') {
        endpoint = '/api/admin/put-on-hold';
        body = { escrowId: escrow.id, admin_notes: notes || adminNotes || undefined };
      } else if (action === 'take-off-hold') {
        endpoint = '/api/admin/take-off-hold';
        body = { escrowId: escrow.id };
      } else if (action === 'force-complete') {
        endpoint = '/api/admin/force-complete';
        body = { escrowId: escrow.id };
      } else if (action === 'close') {
        endpoint = '/api/admin/close';
        body = { escrowId: escrow.id, admin_notes: notes || adminNotes || undefined };
      }

      if (!endpoint) {
        setError('Invalid action');
        return;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include'
      });

      const result = await response.json();

      // Accept both { ok: true } and { success: true } for compatibility
      if (response.ok && (result.success || result.ok)) {
        setSuccess(result.message || `${action.replace('-', ' ')} completed successfully`);
        fetchEscrowDetails(); // Refresh escrow details
        fetchAdminActions(); // Refresh admin actions
        setAdminNotes('');
        setShowNotesForm(false);
      } else {
        setError(result.error || `Failed to ${action.replace('-', ' ')}`);
      }
    } catch (error) {
      console.error(`Error ${action}:`, error);
      setError(`Failed to ${action.replace('-', ' ')}`);
    } finally {
      setActionLoading(null);
    }
  }

  const handleLogout = async () => {
    try {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      window.location.href = '/'
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }



  // Expanded admin actions for all statuses
  const getAvailableActions = () => {
    if (!escrow) return [];
    const actions = [];
    if (escrow.status === 'waiting_admin') actions.push('confirm-payment');
    if (escrow.status === 'payment_confirmed' || escrow.status === 'delivered') actions.push('release-funds', 'refund');
    if (escrow.status !== 'on_hold' && escrow.status !== 'completed' && escrow.status !== 'refunded' && escrow.status !== 'closed') actions.push('put-on-hold');
    if (escrow.status === 'on_hold') actions.push('take-off-hold');
    if (escrow.status !== 'completed' && escrow.status !== 'refunded') actions.push('close');
    if (escrow.status !== 'completed' && escrow.status !== 'refunded' && escrow.status !== 'closed') actions.push('force-complete');
    return Array.from(new Set(actions));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading escrow details...</p>
        </div>
      </div>
    )
  }

  if (error && !escrow) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h2 className="text-xl font-semibold mb-2">Error Loading Escrow</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link href="/admin/dashboard" className="btn-primary">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (!escrow) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold mb-2">Escrow Not Found</h2>
          <p className="text-gray-600 mb-4">The requested escrow transaction could not be found.</p>
          <Link href="/admin/dashboard" className="btn-primary">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const availableActions = getAvailableActions()

  const expiryDate = escrow ? computeExpiry(escrow) : null

  const formatCountdown = (secs: number) => {
    if (secs <= 0) return '00:00:00'
    const days = Math.floor(secs / 86400)
    const hours = Math.floor((secs % 86400) / 3600)
    const minutes = Math.floor((secs % 3600) / 60)
    const seconds = secs % 60
    if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/admin/dashboard" className="text-blue-600 hover:text-blue-800">
              ← Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              Escrow Details: <span className="font-mono">{escrow.code}</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin/settings" className="btn-secondary">
              ⚙️ Settings
            </Link>
            {/* Logout button removed; only in header */}
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4 max-w-6xl">
        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="text-red-400 mr-3">❌</div>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="text-green-400 mr-3">✅</div>
              <p className="text-green-800">{success}</p>
            </div>
          </div>
        )}

        {statusChangeNotification && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="text-blue-400 mr-3">🔄</div>
              <p className="text-blue-800 font-medium">{statusChangeNotification}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Transaction Overview */}
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Transaction Overview</h2>
                <StatusBadge status={escrow.status as any} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Basic Information</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-500">Code:</span> <span className="font-mono font-semibold">{escrow.code}</span></div>
                    <div><span className="text-gray-500">Created:</span> {isNaN(Date.parse(escrow.created_at)) ? 'N/A' : formatDateTime(escrow.created_at)}</div>
                    <div><span className="text-gray-500">Updated:</span> {isNaN(Date.parse(escrow.updated_at)) ? 'N/A' : formatDateTime(escrow.updated_at)}</div>
                    {/* Timer Section using status_logs */}
                    {(() => {
                      let timerLabel = ''
                      let timerEnd: Date | null = null
                      if (escrow.status === 'waiting_payment') {
                        timerLabel = 'Time left for buyer to pay:'
                        timerEnd = new Date(new Date(escrow.created_at).getTime() + 30 * 60 * 1000)
                      } else if (escrow.status === 'payment_confirmed') {
                        const log = escrow.status_logs?.find((l: any) => l.status === 'payment_confirmed')
                        if (log) {
                          timerLabel = 'Time left for seller to deliver:'
                          timerEnd = new Date(new Date(log.created_at).getTime() + 30 * 60 * 1000)
                        }
                      } else if (escrow.status === 'in_progress') {
                        const log = escrow.status_logs?.find((l: any) => l.status === 'delivered')
                        if (log) {
                          timerLabel = 'Time left for buyer to confirm receipt:'
                          timerEnd = new Date(new Date(log.created_at).getTime() + 5 * 60 * 1000)
                        }
                      }
                      if (timerLabel && timerEnd) {
                        const now = Date.now()
                        const secs = Math.max(0, Math.floor((timerEnd.getTime() - now) / 1000))
                        const h = Math.floor(secs / 3600)
                        const m = Math.floor((secs % 3600) / 60)
                        const s = secs % 60
                        return (
                          <div>
                            <span className="text-gray-500">{timerLabel}</span> <span className="font-mono font-semibold">{`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`}</span>
                          </div>
                        )
                      }
                      return null
                    })()}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Financial Details</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-500">Product Price:</span> <span className="font-semibold">{formatNaira(escrow.price)}</span></div>
                    <div><span className="text-gray-500">Admin Fee:</span> <span className="font-semibold">{formatNaira(escrow.admin_fee)}</span></div>
                    <div><span className="text-gray-500">Total Amount:</span> <span className="font-semibold text-lg">{formatNaira(escrow.price + escrow.admin_fee)}</span></div>
                  </div>
                </div>
              </div>

              {/* Product Image */}
              {productImageUrl && (
                <div className="mt-6">
                  <h3 className="font-semibold text-gray-700 mb-2">Product Image</h3>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <img
                      src={productImageUrl}
                      alt="Product"
                      className="w-full max-w-md h-auto rounded-lg object-cover border"
                    />
                  </div>
                </div>
              )}

              <div className="mt-6">
                <h3 className="font-semibold text-gray-700 mb-2">Description</h3>
                <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">{escrow.description}</p>
              </div>
            </div>

            {/* Parties Information */}
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Parties</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Seller */}
                <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                  <div className="flex items-center mb-3">
                    <div className="text-2xl mr-3">💼</div>
                    <h3 className="font-semibold text-gray-900">Seller</h3>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div><span className="text-gray-500">Name:</span> {escrow.seller.full_name || 'Not set'}</div>
                    <div><span className="text-gray-500">Email:</span> {escrow.seller.email}</div>
                    <div><span className="text-gray-500">Telegram:</span> @{escrow.seller.telegram_id || 'Not set'}</div>
                    {escrow.seller.phone_number && (
                      <div><span className="text-gray-500">Phone:</span> {escrow.seller.phone_number}</div>
                    )}
                    {escrow.seller.bank_name && (
                      <div className="pt-2 border-t border-blue-300 mt-2">
                        <h4 className="font-semibold text-blue-800 mb-1">💰 Banking Details</h4>
                        <div><span className="text-gray-600">Bank:</span> {escrow.seller.bank_name}</div>
                        <div><span className="text-gray-600">Account:</span> {escrow.seller.account_number}</div>
                        <div><span className="text-gray-600">Name:</span> {escrow.seller.account_holder_name}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Buyer */}
                <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                  <div className="flex items-center mb-3">
                    <div className="text-2xl mr-3">🛒</div>
                    <h3 className="font-semibold text-gray-900">Buyer</h3>
                  </div>
                  {escrow.buyer ? (
                    <div className="space-y-1 text-sm">
                      <div><span className="text-gray-500">Name:</span> {escrow.buyer.full_name || 'Not set'}</div>
                      <div><span className="text-gray-500">Email:</span> {escrow.buyer.email}</div>
                      <div><span className="text-gray-500">Telegram:</span> @{escrow.buyer.telegram_id || 'Not set'}</div>
                      {escrow.buyer.phone_number && (
                        <div><span className="text-gray-500">Phone:</span> {escrow.buyer.phone_number}</div>
                      )}
                      {escrow.buyer.bank_name && (
                        <div className="pt-2 border-t border-green-300 mt-2">
                          <h4 className="font-semibold text-green-800 mb-1">💰 Banking Details</h4>
                          <div><span className="text-gray-600">Bank:</span> {escrow.buyer.bank_name}</div>
                          <div><span className="text-gray-600">Account:</span> {escrow.buyer.account_number}</div>
                          <div><span className="text-gray-600">Name:</span> {escrow.buyer.account_holder_name}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No buyer has joined this escrow yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Receipts */}
            {escrow.receipts && escrow.receipts.length > 0 && (
              <div className="card">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Payment Receipts</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {escrow.receipts.map((receipt) => (
                    <div key={receipt.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">Receipt #{receipt.id.slice(0, 8)}</h3>
                        <span className="text-xs text-gray-500">{formatDateTime(receipt.uploaded_at)}</span>
                      </div>
                      <div className="mb-3">
                        <img 
                          src={receipt.signed_url} 
                          alt={`Receipt ${receipt.filename}`}
                          className="w-full h-48 object-cover rounded border"
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{receipt.filename}</span>
                        <a 
                          href={receipt.signed_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View Full Size →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delivery Proof */}
            {escrow.delivery_proof_url && (
              <div className="card">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">📦 Delivery Proof</h2>
                
                <div className="border rounded-lg p-4">
                  <div className="mb-3">
                    {escrow.delivery_proof_url.toLowerCase().endsWith('.pdf') ? (
                      <a
                        href={deliveryProofSignedUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-lg"
                      >
                        📄 View PDF Delivery Proof
                      </a>
                    ) : (
                      deliveryProofSignedUrl && (
                        <img
                          src={deliveryProofSignedUrl}
                          alt="Delivery Proof"
                          className="w-full h-48 object-cover rounded border"
                        />
                      )
                    )}
                  </div>
                  {deliveryProofSignedUrl && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Delivery proof uploaded by seller</span>
                      <a
                        href={deliveryProofSignedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View Full Size →
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Admin Actions Sidebar */}
          <div className="space-y-6">
            {/* Available Actions */}
            {availableActions.length > 0 && (
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Actions</h3>
                
                <div className="space-y-3">
                  {availableActions.includes('confirm-payment') && (
                    <button
                      onClick={() => handleAdminAction('confirm-payment')}
                      disabled={!!actionLoading}
                      className="w-full btn-primary"
                    >
                      {actionLoading === 'confirm-payment' ? 'Confirming...' : '✅ Confirm Payment'}
                    </button>
                  )}
                  {availableActions.includes('release-funds') && (
                    <button
                      onClick={() => handleAdminAction('release-funds')}
                      disabled={!!actionLoading}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
                    >
                      {actionLoading === 'release-funds' ? 'Releasing...' : '💰 Release Funds'}
                    </button>
                  )}
                  {availableActions.includes('refund') && (
                    <button
                      onClick={() => handleAdminAction('refund')}
                      disabled={!!actionLoading}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
                    >
                      {actionLoading === 'refund' ? 'Processing...' : '↩️ Refund to Buyer'}
                    </button>
                  )}
                  {availableActions.includes('put-on-hold') && (
                    <button
                      onClick={() => handleAdminAction('put-on-hold')}
                      disabled={!!actionLoading}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
                    >
                      {actionLoading === 'put-on-hold' ? 'Putting on Hold...' : '⏸️ Put on Hold'}
                    </button>
                  )}
                  {availableActions.includes('take-off-hold') && (
                    <button
                      onClick={() => handleAdminAction('take-off-hold')}
                      disabled={!!actionLoading}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
                    >
                      {actionLoading === 'take-off-hold' ? 'Resuming...' : '▶️ Take Off Hold'}
                    </button>
                  )}
                  {availableActions.includes('force-complete') && (
                    <button
                      onClick={() => handleAdminAction('force-complete')}
                      disabled={!!actionLoading}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
                    >
                      {actionLoading === 'force-complete' ? 'Completing...' : '✅ Force Complete'}
                    </button>
                  )}
                  {availableActions.includes('close') && (
                    <button
                      onClick={() => handleAdminAction('close')}
                      disabled={!!actionLoading}
                      className="w-full bg-gray-500 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
                    >
                      {actionLoading === 'close' ? 'Closing...' : '❌ Close/Cancel Escrow'}
                    </button>
                  )}
                </div>

                {/* Admin Notes Form */}
                <div className="mt-4 pt-4 border-t">
                  <button
                    onClick={() => setShowNotesForm(!showNotesForm)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {showNotesForm ? '❌ Cancel Notes' : '📝 Add Admin Notes'}
                  </button>
                  
                  {showNotesForm && (
                    <div className="mt-3">
                      <textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Add notes about this action..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Transaction Status */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Information</h3>
              
              <div className="space-y-3">
                <div className="text-center">
                  <StatusBadge status={escrow.status as any} size="lg" />
                </div>
                
                <div className="text-sm text-gray-600">
                  {escrow.status === 'created' && 'Waiting for buyer to join'}
                  {escrow.status === 'joined' && 'Buyer joined, waiting for payment'}
                  {escrow.status === 'waiting_admin' && 'Payment uploaded, needs admin confirmation'}
                  {escrow.status === 'payment_confirmed' && 'Payment confirmed, awaiting delivery'}
                  {escrow.status === 'delivered' && 'Delivery confirmed, ready for fund release'}
                  {escrow.status === 'completed' && 'Transaction completed successfully'}
                  {escrow.status === 'on_hold' && 'Transaction on hold pending review'}
                  {escrow.status === 'refunded' && 'Funds refunded to buyer'}
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Receipts:</span>
                  <span className="font-semibold">{escrow.receipts?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Days Active:</span>
                  <span className="font-semibold">
                    {(() => {
                      const created = Date.parse(escrow.created_at)
                      if (isNaN(created)) return 'N/A'
                      return Math.max(1, Math.ceil((Date.now() - created) / (1000 * 3600 * 24)))
                    })()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Updated:</span>
                  <span className="font-semibold">
                    {(() => {
                      const updated = Date.parse(escrow.updated_at)
                      if (isNaN(updated)) return 'N/A'
                      const hours = Math.floor((Date.now() - updated) / (1000 * 3600))
                      if (hours < 1) {
                        const mins = Math.floor((Date.now() - updated) / (1000 * 60))
                        return mins <= 0 ? 'just now' : `${mins}m ago`
                      }
                      return `${hours}h ago`
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Interface */}
        {escrow && currentUser && (
          <div className="mt-6">
            <EscrowChat 
              escrowId={escrow.id} 
              currentUserId={currentUser.id}
              isAdmin={true}
              supabaseClient={supabase}
            />
          </div>
        )}
      </div>
    </div>
  )
}
