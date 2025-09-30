'use client'

import { useEffect, useState, useRef } from 'react'
import FeedbackBanner from '../../../../components/FeedbackBanner'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { formatNaira } from '@/lib/utils'
import { getStatusLabel, getStatusColor } from '@/lib/status'
import StatusBadge from '@/components/StatusBadge'
import EscrowChat from '@/components/EscrowChat'
import { supabase } from '@/lib/supabaseClient'

interface Escrow {
  id: string
  code: string
  description: string
  price: number
  admin_fee: number
  product_image_url?: string
  delivery_proof_url?: string | null
  status: string
  created_at: string
  seller_id: string
  buyer_id?: string
  seller?: { telegram_id: string }
  buyer?: { telegram_id: string }
  receipts?: Array<{
    id: string
    created_at: string
    file_path: string
    signed_url?: string
  }>
  status_logs?: Array<{
    id: string
    status: string
    created_at: string
    profiles?: { telegram_id: string }
  }>
}

export default function SellerEscrowPage() {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  // State for Edit Escrow modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Prefill modal fields when opening
  const openEditModal = () => {
    setEditDescription(escrow?.description || '');
    setEditPrice(escrow?.price?.toString() || '');
    setEditError('');
    setEditSuccess('');
    setShowEditModal(true);
  };
  // Feedback auto-dismiss
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);
  const params = useParams()
  const id = params.id as string
  
  const [escrow, setEscrow] = useState<Escrow | null>(null)
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null)
  const [receiptUrls, setReceiptUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [deliveryProof, setDeliveryProof] = useState<File | null>(null)
  const [deliveryProofUrl, setDeliveryProofUrl] = useState<string | null>(null)
  const [deliveryProofSignedUrl, setDeliveryProofSignedUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [statusChangeNotification, setStatusChangeNotification] = useState<string | null>(null)

  useEffect(() => {
    fetchEscrow()
    fetchCurrentUser()
    const interval = setInterval(() => {
      // poll escrow to pick up status changes, but only if escrow loaded
      if (escrow) {
        // refresh every 30s as fallback
        fetchEscrow()
      }
    }, 30000)
    // real-time subscription for escrow updates (status changes, receipts)
    // Re-enabled for real-time updates
    let channel: any = null
    if (id) {
      try {
        const ch = supabase.channel(`escrow-updates-${id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'escrows', filter: `id=eq.${id}` }, (payload: any) => {
          console.debug('[SellerEscrowPage] escrow realtime payload', payload)
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setEscrow(prev => {
              const merged = { ...(prev || {}), ...(payload.new || {}) }
              // Check if status changed
              if (prev && prev.status !== merged.status) {
                setStatusChangeNotification(`Status changed to: ${merged.status}`)
                // Auto-dismiss notification after 5 seconds
                setTimeout(() => setStatusChangeNotification(null), 5000)
              }
              return merged
            })
          }
        }).subscribe()
        channel = ch
      } catch (e) {
        // ignore, fall back to polling
      }
    }
    return () => clearInterval(interval)
  }, [id])

  useEffect(() => {
    if (escrow?.product_image_url) {
      fetchProductImage()
    }
    if (escrow?.receipts) {
      fetchReceiptImages()
    }
    // Delivery proof signed URL
    if (escrow?.delivery_proof_url) {
      fetchDeliveryProofSignedUrl(escrow.delivery_proof_url)
    } else {
      setDeliveryProofSignedUrl(null)
    }
    // compute expiry timestamp: prefer expires_at, otherwise fallback to created_at + 30 minutes
    const expiresIso = (escrow as any)?.expires_at ?? null
    let expiryTs: number | null = null

    if (expiresIso) {
      expiryTs = new Date(expiresIso).getTime()
    } else if (escrow?.created_at) {
      expiryTs = new Date(escrow.created_at).getTime() + 30 * 60 * 1000
    }

    // only show a countdown for active waiting_payment escrows with a future expiry
    if (escrow?.status === 'waiting_payment' && expiryTs && expiryTs > Date.now()) {
      const diff = Math.max(0, Math.floor((expiryTs - Date.now()) / 1000))
      setTimeLeft(diff)

      // start countdown tick
      const tid = setInterval(() => {
        setTimeLeft(prev => {
          if (prev === null) return null
          if (prev <= 1) {
            // expired - refresh
            fetchEscrow()
            clearInterval(tid)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(tid)
    } else {
      setTimeLeft(null)
    }
  }, [escrow])

  // Fetch signed URL for delivery proof
  const fetchDeliveryProofSignedUrl = async (path: string) => {
    try {
      // If escrow returned a signed URL for delivery proof, use it
      // Note: the escrow object might contain delivery_proof_signed_url or similar
      if ((escrow as any)?.delivery_proof_signed_url && (escrow as any).delivery_proof_signed_url.startsWith('http')) {
        setDeliveryProofSignedUrl((escrow as any).delivery_proof_signed_url)
        return
      }

      const response = await fetch('/api/storage/sign-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, bucket: 'product-images' }),
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setDeliveryProofSignedUrl(data.signedUrl)
      } else {
        setDeliveryProofSignedUrl(null)
      }
    } catch {
      setDeliveryProofSignedUrl(null)
    }
  }

  const fetchEscrow = async () => {
    // Try a few times to tolerate brief eventual consistency between insert and read
    const maxAttempts = 3
    const delayMs = 700
    let attempt = 0
    let lastError: any = null
    while (attempt < maxAttempts) {
      try {
  const response = await fetch(`/api/escrow/by-id/${id}`, { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          setEscrow(data.escrow)
          lastError = null
          break
        } else if (response.status === 404) {
          lastError = 'Transaction not found'
          // wait and retry
          attempt++
          if (attempt < maxAttempts) await new Promise(r => setTimeout(r, delayMs))
          continue
        } else {
          const errJson = await response.json().catch(() => ({}))
          lastError = errJson.error || 'Transaction not found'
          break
        }
      } catch (error) {
        lastError = 'Failed to load transaction'
        console.error('Error fetching escrow:', error)
        break
      }
    }

    if (lastError) setError(lastError)
    setLoading(false)
  }

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setCurrentUser((data && data.user) ? data.user : data)
      }
    } catch (error) {
      console.error('[SellerPage] Error fetching current user:', error)
    }
  }

  const fetchProductImage = async () => {
    if (!escrow?.product_image_url) return

    try {
      // Prefer server-provided signed URL if present
      if ((escrow as any).product_image_signed_url) {
        setProductImageUrl((escrow as any).product_image_signed_url)
        return
      }

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

  const fetchReceiptImages = async () => {
    if (!escrow?.receipts) return

    const urls: Record<string, string> = {}
    
    for (const receipt of escrow.receipts) {
      try {
        // Prefer server-provided signed_url
        if (receipt.signed_url) {
          urls[receipt.id] = receipt.signed_url
          continue
        }
        const response = await fetch('/api/storage/sign-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            path: receipt.file_path,
            bucket: 'receipts'
          })
        })

        if (response.ok) {
          const data = await response.json()
          urls[receipt.id] = data.signedUrl
        }
      } catch (error) {
        console.error('Error fetching receipt:', error)
      }
    }
    
    setReceiptUrls(urls)
  }

  const handleDeliveryProofChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setDeliveryProof(file);
      // Automatically upload and mark as delivered
      await handleMarkDelivered(file);
    }
  };



  const handleMarkDelivered = async (file?: File) => {
    if (!escrow) return;
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      let deliveryProofPath = deliveryProofUrl;
      // If a file is provided or selected but not uploaded yet, upload it now
      const fileToUpload = file || deliveryProof;
      if (fileToUpload && !deliveryProofUrl) {
        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('escrowId', escrow.id);
        const uploadResp = await fetch('/api/escrow/upload-temp', {
          method: 'POST',
          body: formData
        });
        if (!uploadResp.ok) {
          setError('Failed to upload delivery proof');
          setActionLoading(false);
          return;
        }
        const { path } = await uploadResp.json();
        deliveryProofPath = path;
        setDeliveryProofUrl(path);
      }
      // Mark as delivered, optionally with proof
      const response = await fetch('/api/escrow/mark-delivered', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ escrowId: escrow.id, deliveryProof: deliveryProofPath })
      });
      if (response.ok) {
        setSuccess('Successfully marked as delivered! The transaction is now in progress.');
        setDeliveryProof(null);
        setDeliveryProofUrl(null);
        fetchEscrow();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to mark as delivered');
      }
    } catch (error) {
      setError('Failed to mark as delivered');
    } finally {
      setActionLoading(false);
    }
  };

  const copyCode = () => {
    if (escrow) {
      navigator.clipboard.writeText(escrow.code)
      setSuccess('Transaction code copied to clipboard!')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
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
          <Link href="/seller" className="btn-primary">
            Back to Seller Portal
          </Link>
        </div>
      </div>
    )
  }

  // Defensive: ensure price and admin_fee are valid numbers
  const price = typeof escrow.price === 'number' && !isNaN(escrow.price) ? escrow.price : 0
  const adminFee = typeof escrow.admin_fee === 'number' && !isNaN(escrow.admin_fee) ? escrow.admin_fee : 0
  const totalAmount = price + adminFee
  const canMarkDelivered = escrow.status === 'payment_confirmed'

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-2xl">
        <div className="mb-6">
          <Link href="/seller" className="text-green-600 hover:text-green-800 mb-4 inline-block">
            ← Back to Seller Portal
          </Link>
        </div>

        {/* Transaction Header with dynamic timer */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Transaction {escrow.code}</h1>
              {/* Dynamic Timer Section for Seller */}
              {(() => {
                let timerLabel = ''
                let timerEnd: Date | null = null
                if ((escrow as any).status_logs) {
                  if (escrow.status === 'waiting_payment') {
                    timerLabel = 'Time left for buyer to pay:'
                    timerEnd = new Date(new Date(escrow.created_at).getTime() + 30 * 60 * 1000)
                  } else if (escrow.status === 'payment_confirmed') {
                    const log = (escrow as any).status_logs.find((l: any) => l.status === 'payment_confirmed')
                    if (log) {
                      timerLabel = 'Time left for you to deliver:'
                      timerEnd = new Date(new Date(log.created_at).getTime() + 30 * 60 * 1000)
                    }
                  } else if (escrow.status === 'in_progress') {
                    const log = (escrow as any).status_logs.find((l: any) => l.status === 'delivered')
                    if (log) {
                      timerLabel = 'Time left for buyer to confirm receipt:'
                      timerEnd = new Date(new Date(log.created_at).getTime() + 5 * 60 * 1000)
                    }
                  }
                }
                if (timerLabel && timerEnd) {
                  const now = Date.now()
                  const secs = Math.max(0, Math.floor((timerEnd.getTime() - now) / 1000))
                  const h = Math.floor(secs / 3600)
                  const m = Math.floor((secs % 3600) / 60)
                  const s = secs % 60
                  return (
                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="text-yellow-600 text-xl">⏱️</div>
                        <div>
                          <div className="font-semibold text-yellow-800">Time Remaining</div>
                          <div className="text-2xl font-mono font-bold text-yellow-700">
                            {h.toString().padStart(2, '0')}:{m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-yellow-700">
                        {timerLabel.replace('Time left for ', '').replace('Time left for you to ', '').replace(':', '')}
                      </div>
                    </div>
                  )
                }
                return null
              })()}
              <button 
                onClick={copyCode}
                className="text-sm text-blue-600 hover:text-blue-800 mt-1"
              >
                📋 Copy Code
              </button>
            </div>
            <StatusBadge status={escrow.status as any} />
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
                <p className="text-lg">{formatNaira(price)}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Service Fee</h3>
                <p className="text-lg">{formatNaira(adminFee)}</p>
              </div>
            </div>
            <div className="pt-3 border-t">
              <h3 className="font-semibold text-gray-900">Total (Buyer Pays)</h3>
              <p className="text-2xl font-bold text-green-600">{formatNaira(totalAmount)}</p>
            </div>
            {escrow.buyer && (
              <div className="pt-3 border-t">
                <h3 className="font-semibold text-gray-900">Buyer</h3>
                <p className="text-gray-600">@{escrow.buyer.telegram_id}</p>
              </div>
            )}
          </div>
        </div>

        {/* Seller Actions for New Escrows */}
        {escrow.status === 'waiting_payment' && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">🕒 Waiting for Buyer Payment</h2>
            <p className="text-gray-600 mb-4">
              This escrow is awaiting payment from the buyer. You can:
            </p>
            <div className="flex flex-col gap-2 mb-4">
              <button
                    className="btn-secondary"
                    disabled={actionLoading || escrow.status !== 'waiting_payment'}
                    onClick={openEditModal}
                  >
                    ✏️ Edit Escrow
                  </button>
              {/* Edit Escrow Modal */}
              {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
                  <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
                    <h2 className="text-xl font-bold mb-4">Edit Escrow</h2>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      setEditError('');
                      setEditSuccess('');
                      setEditLoading(true);
                      try {
                        const resp = await fetch('/api/escrow/edit', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            escrowId: escrow.id,
                            description: editDescription,
                            price: parseFloat(editPrice)
                          })
                        });
                        const data = await resp.json();
                        if (resp.ok && data.success) {
                          setEditSuccess('Escrow updated successfully.');
                          setShowEditModal(false);
                          fetchEscrow();
                        } else {
                          setEditError(data.error || 'Failed to update escrow.');
                        }
                      } catch (e) {
                        setEditError('Failed to update escrow.');
                      } finally {
                        setEditLoading(false);
                      }
                    }}>
                      <div className="mb-4">
                        <label className="block font-semibold mb-1">Description</label>
                        <textarea
                          className="w-full border rounded p-2"
                          value={editDescription}
                          onChange={e => setEditDescription(e.target.value)}
                          required
                          disabled={editLoading}
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block font-semibold mb-1">Price</label>
                        <input
                          type="number"
                          className="w-full border rounded p-2"
                          value={editPrice}
                          onChange={e => setEditPrice(e.target.value)}
                          min={1}
                          required
                          disabled={editLoading}
                        />
                      </div>
                      {editError && <div className="text-red-600 mb-2">{editError}</div>}
                      {editSuccess && <div className="text-green-600 mb-2">{editSuccess}</div>}
                      <div className="flex gap-2 justify-end">
                        <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)} disabled={editLoading}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={editLoading}>Save</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
              <button
                className="btn-secondary"
                disabled={actionLoading || !escrow.buyer || !escrow.buyer.telegram_id}
                onClick={async () => {
                  if (!escrow || !escrow.buyer || !escrow.buyer.telegram_id) {
                    setError('Buyer has not linked Telegram.');
                    return;
                  }
                  setActionLoading(true);
                  setError('');
                  setSuccess('');
                  try {
                    const resp = await fetch('/api/escrow/nudge', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ escrowId: escrow.id })
                    });
                    const data = await resp.json();
                    if (resp.ok && data.success) {
                      setSuccess('Nudge sent to buyer via Telegram.');
                    } else {
                      setError(data.error || 'Failed to nudge buyer.');
                    }
                  } catch (e) {
                    setError('Failed to nudge buyer.');
                  } finally {
                    setActionLoading(false);
                  }
                }}
              >
                🔔 Nudge Buyer
              </button>
              <button
                className="btn-danger"
                disabled={actionLoading}
                onClick={async () => {
                  if (!escrow) return;
                  if (!window.confirm('Are you sure you want to cancel this escrow? This cannot be undone.')) return;
                  setActionLoading(true);
                  setError('');
                  setSuccess('');
                  try {
                    const resp = await fetch('/api/escrow/cancel', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ escrowId: escrow.id })
                    });
                    const data = await resp.json();
                    if (resp.ok && data.success) {
                      setSuccess('Escrow cancelled successfully.');
                      fetchEscrow();
                    } else {
                      setError(data.error || 'Failed to cancel escrow.');
                    }
                  } catch (e) {
                    setError('Failed to cancel escrow.');
                  } finally {
                    setActionLoading(false);
                  }
                }}
              >
                ❌ Cancel Escrow
              </button>
            </div>
            <div className="text-gray-500 text-sm">
              You may edit or cancel this escrow before payment is made.
            </div>
          </div>
        )}

        {/* Delivery Proof Upload & Mark as Delivered */}
        {canMarkDelivered && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">🚚 Mark as Delivered</h2>
            <p className="text-gray-600 mb-4">
              Upload delivery proof (optional) and mark the transaction as delivered. Upload starts automatically when you select a file.
            </p>
            <div className="flex flex-col gap-2 mb-4">
              <input
                type="file"
                accept="image/*,.pdf"
                ref={fileInputRef}
                onChange={handleDeliveryProofChange}
                className="file-input"
                disabled={actionLoading}
              />
              <p className="text-sm text-gray-500">
                Supports: JPEG, PNG, WebP, PDF (max 10MB) - Optional delivery proof
              </p>
              {actionLoading && (
                <div className="text-blue-600 text-sm">Uploading and marking as delivered...</div>
              )}
              {deliveryProofUrl && (
                <div className="text-green-700 text-sm">✅ Delivery proof uploaded and marked as delivered!</div>
              )}
            </div>
          </div>
        )}

        {/* Receipts & Delivery Proof */}
        {(escrow.receipts && escrow.receipts.length > 0) && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">📄 Payment Receipts</h2>
            <div className="space-y-4">
              {escrow.receipts.map((receipt) => (
                <div key={receipt.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">
                      Uploaded on {new Date(receipt.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {receiptUrls[receipt.id] && (
                    <div>
                      {receipt.file_path.toLowerCase().endsWith('.pdf') ? (
                        <a 
                          href={receiptUrls[receipt.id]} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          📄 View PDF Receipt
                        </a>
                      ) : (
                        <Image
                          src={receiptUrls[receipt.id]}
                          alt="Payment Receipt"
                          width={200}
                          height={150}
                          className="rounded object-cover"
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Delivery Proof Display (if uploaded and attached to escrow) */}
        {escrow.delivery_proof_url && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">📦 Delivery Proof</h2>
            <div>
              {escrow.delivery_proof_url.toLowerCase().endsWith('.pdf') ? (
                <a
                  href={deliveryProofSignedUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  📄 View PDF Delivery Proof
                </a>
              ) : (
                deliveryProofSignedUrl && (
                  <Image
                    src={deliveryProofSignedUrl}
                    alt="Delivery Proof"
                    width={200}
                    height={150}
                    className="rounded object-cover"
                  />
                )
              )}
            </div>
          </div>
        )}

        {/* Status Timeline */}
        {escrow.status_logs && escrow.status_logs.length > 0 && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">📈 Status Timeline</h2>
            <div className="space-y-4">
              {escrow.status_logs.map((log, index) => (
                <div key={log.id} className="flex items-start gap-4">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <p className="font-medium">{getStatusLabel(log.status as any)}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                      {log.profiles && ` • @${log.profiles.telegram_id}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Communication Chat (always show, even if buyer not present) */}
        <div className="mt-8">
          <EscrowChat
            escrowId={escrow.id || ""}
            currentUserId={currentUser?.id || ""}
            isAdmin={false}
            supabaseClient={supabase}
          />
          {!escrow.buyer && (
            <div className="text-gray-500 text-sm mt-2">Waiting for buyer to join. Messages will be delivered when buyer joins.</div>
          )}
        </div>

        {/* Feedback banners */}
        {error && (
          <FeedbackBanner
            message={error}
            type="error"
            onClose={() => setError('')}
          />
        )}
        {success && !error && (
          <FeedbackBanner
            message={success}
            type="success"
            onClose={() => setSuccess('')}
          />
        )}

        {statusChangeNotification && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="text-blue-400 mr-3">🔄</div>
              <p className="text-blue-800 font-medium">{statusChangeNotification}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
