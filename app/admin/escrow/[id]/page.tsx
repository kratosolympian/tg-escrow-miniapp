'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { formatNaira } from '@/lib/utils'
import StatusBadge from '@/components/StatusBadge'
import EscrowChat from '@/components/EscrowChat'

interface EscrowDetail {
  id: string
  code: string
  seller_id: string
  buyer_id: string | null
  description: string
  price: number
  admin_fee: number
  product_image_url: string | null
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
    receipt_url: string
    uploaded_at: string
    filename: string
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

  useEffect(() => {
    if (escrowId) {
      fetchEscrowDetails()
      fetchAdminActions()
    }
  }, [escrowId])

  useEffect(() => {
    fetchCurrentUser()
  }, [])

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me')
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
      const response = await fetch(`/api/escrow/by-id/${escrowId}`)
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
      const response = await fetch(`/api/admin/escrow-actions/${escrowId}`)
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
      const endpoint = action === 'confirm-payment' ? '/api/admin/confirm-payment' 
                    : action === 'release-funds' ? '/api/admin/release-funds'
                    : action === 'refund' ? '/api/admin/refund'
                    : null

      if (!endpoint) {
        setError('Invalid action')
        return
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          escrow_id: escrow.id,
          admin_notes: notes || adminNotes || undefined
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setSuccess(result.message || `${action.replace('-', ' ')} completed successfully`)
        fetchEscrowDetails() // Refresh escrow details
        fetchAdminActions() // Refresh admin actions
        setAdminNotes('')
        setShowNotesForm(false)
      } else {
        setError(result.error || `Failed to ${action.replace('-', ' ')}`)
      }
    } catch (error) {
      console.error(`Error ${action}:`, error)
      setError(`Failed to ${action.replace('-', ' ')}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'created': return 'text-blue-600'
      case 'joined': return 'text-purple-600'
      case 'waiting_admin': return 'text-yellow-600'
      case 'payment_confirmed': return 'text-green-600'
      case 'delivered': return 'text-indigo-600'
      case 'completed': return 'text-green-700'
      case 'on_hold': return 'text-red-600'
      case 'refunded': return 'text-gray-600'
      default: return 'text-gray-500'
    }
  }

  const getAvailableActions = () => {
    if (!escrow) return []
    
    switch (escrow.status) {
      case 'waiting_admin':
        return ['confirm-payment']
      case 'payment_confirmed':
        return ['release-funds', 'refund']
      case 'delivered':
        return ['release-funds', 'refund']
      default:
        return []
    }
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
            {currentUser && (
              <button onClick={handleLogout} className="btn-secondary">
                🚪 Logout
              </button>
            )}
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
                    <div><span className="text-gray-500">Created:</span> {formatDateTime(escrow.created_at)}</div>
                    <div><span className="text-gray-500">Updated:</span> {formatDateTime(escrow.updated_at)}</div>
                    <div><span className="text-gray-500">Status:</span> <span className={getStatusColor(escrow.status)}>{escrow.status.replace('_', ' ').toUpperCase()}</span></div>
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
                          src={receipt.receipt_url} 
                          alt={`Receipt ${receipt.filename}`}
                          className="w-full h-48 object-cover rounded border"
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{receipt.filename}</span>
                        <a 
                          href={receipt.receipt_url} 
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
                    {Math.ceil((new Date().getTime() - new Date(escrow.created_at).getTime()) / (1000 * 3600 * 24))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Updated:</span>
                  <span className="font-semibold">
                    {Math.ceil((new Date().getTime() - new Date(escrow.updated_at).getTime()) / (1000 * 3600))}h ago
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
            />
          </div>
        )}
      </div>
    </div>
  )
}
