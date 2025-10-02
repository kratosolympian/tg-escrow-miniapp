"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import FeedbackBanner from "../../../../components/FeedbackBanner";
import EscrowChat from "@/components/EscrowChat";
import { formatNaira } from "@/lib/utils";
import { getStatusLabel, getStatusColor, ESCROW_STATUS } from "@/lib/status";

// Escrow/user types with nulls allowed for DB fields
export type Escrow = {
  id: string | null;
  code: string | null;
  status: string | null;
  buyer_id?: string | null;
  seller_id?: string | null;
  admin_fee?: number | null;
  product_image_url?: string | null;
  delivery_proof_url?: string | null;
  // DB uses `description` and `price` (seller page). Accept both for compatibility.
  description?: string | null;
  product_description?: string | null;
  price?: number | null;
  amount?: number | null;
  created_at?: string | null;
  receipts?: any[];
  buyer?: { email?: string | null; full_name?: string | null } | null;
  seller?: { email?: string | null; full_name?: string | null } | null;
};
export type User = { id: string; email?: string | null };

export default function BuyerEscrowPage() {
  const { code } = useParams();
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null)
  const [receiptUrls, setReceiptUrls] = useState<Record<string, string>>({})
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [uploading, setUploading] = useState(false)
  const [statusChangeNotification, setStatusChangeNotification] = useState<string | null>(null)
  const [bankDetails, setBankDetails] = useState<{
    bank_name: string;
    account_number: string;
    account_holder: string;
  } | null>(null)
  const [deliveryProofSignedUrl, setDeliveryProofSignedUrl] = useState<string | null>(null)
  const [confirmationTimeLeft, setConfirmationTimeLeft] = useState<number | null>(null)
  const [confirmingDelivery, setConfirmingDelivery] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  // Function to fetch escrow data
  const fetchEscrow = async () => {
    setLoading(true);
    setError("");
    const codeStr = Array.isArray(code) ? code[0] : code;
    try {
      const resp = await fetch(`/api/escrow/by-id/${encodeURIComponent(String(codeStr))}`, { credentials: 'include' })
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}))
        setError(j.error || 'Failed to load')
        setEscrow(null)
        if (resp.status === 403) console.warn('[dev] escrow fetch returned 403')
      } else {
        const j = await resp.json()
        setEscrow(j.escrow as Escrow)
      }
    } catch (err) {
      console.error('Error fetching escrow (server API):', err)
      setError('Failed to load')
      setEscrow(null)
    } finally {
      setLoading(false)
    }
  };

  useEffect(() => {
    if (code) fetchEscrow();
  }, [code]);

  // Add polling for real-time status updates (every 30 seconds)
  useEffect(() => {
    if (!escrow) return; // Only poll if escrow is loaded

    const interval = setInterval(() => {
      fetchEscrow(); // Reuse the same fetch function
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [escrow?.id]); // Depend on escrow ID to restart polling when escrow changes

  // Fetch current user (to determine if buyer and allow upload)
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
  const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          // API returns { user: { ... } } - prefer the nested user object but
          // fall back to the top-level response for robustness.
          setCurrentUser((data && data.user) ? data.user : data)
        }
      } catch (err) {
        // ignore
      }
    }
    fetchCurrentUser()
  }, [])

  // Instrument navigation calls during debugging: log stack traces when the page
  // is being replaced/assigned/reloaded so we can find what triggers full-page
  // navigations in the wild. This is intentionally lightweight and wrapped in
  // try/catch to avoid interfering with normal behavior.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const navLog = (kind: string, url?: string) => {
      try {
        // eslint-disable-next-line no-console
        console.warn(`[nav-instrument] ${kind}${url ? ` -> ${url}` : ''}`)
        // eslint-disable-next-line no-console
        console.trace()
      } catch (e) {}
    }

    const origReplace = window.location.replace?.bind(window.location)
    const origReload = window.location.reload?.bind(window.location)
    const origAssign = (window.location as any).assign?.bind(window.location)

    try {
      if (origReplace) {
        // @ts-ignore
        window.location.replace = (url: string) => {
          navLog('location.replace', url)
          return origReplace(url)
        }
      }
    } catch (e) {
      // ignore - not writable in some environments
    }

    try {
      if (origReload) {
        // @ts-ignore
        window.location.reload = () => {
          navLog('location.reload')
          return origReload()
        }
      }
    } catch (e) {
      // ignore
    }

    try {
      if (origAssign) {
        // @ts-ignore
        ;(window.location as any).assign = (url: string) => {
          navLog('location.assign', url)
          return origAssign(url)
        }
      }
    } catch (e) {
      // ignore
    }

    return () => {
      try { if (origReplace) (window.location as any).replace = origReplace } catch (e) {}
      try { if (origReload) (window.location as any).reload = origReload } catch (e) {}
      try { if (origAssign) (window.location as any).assign = origAssign } catch (e) {}
    }
  }, [])

  // When escrow loads, fetch signed product image and receipts if present
  useEffect(() => {
    if (!escrow) return
    const fetchProductImage = async () => {
      console.log('Escrow data:', escrow)
      console.log('Product image URL:', escrow.product_image_url)
      if (!escrow.product_image_url) {
        console.log('No product_image_url found, skipping image fetch')
        return
      }
      try {
        // If the server already returned a signed URL (preferred), use it
        if ((escrow as any).product_image_signed_url) {
          console.log('Using server-provided signed URL:', (escrow as any).product_image_signed_url)
          setProductImageUrl((escrow as any).product_image_signed_url)
          return
        }

        // Fallback: request a signed URL from the sign-url API
        console.log('Requesting signed URL for path:', escrow.product_image_url)
        const resp = await fetch('/api/storage/sign-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ path: escrow.product_image_url, bucket: 'product-images' })
        })
        console.log('Sign URL response status:', resp.status)
        if (resp.ok) {
          const d = await resp.json()
          console.log('Signed URL response:', d)
          setProductImageUrl(d.signedUrl)
        } else {
          const errorText = await resp.text()
          console.error('Sign URL error response:', errorText)
        }
      } catch (err) {
        console.error('Error fetching product image signed url', err)
      }
    }

    const fetchReceiptImages = async () => {
      if (!Array.isArray(escrow.receipts) || escrow.receipts.length === 0) return
      const urls: Record<string,string> = {}
      for (const receipt of escrow.receipts) {
        try {
          // Prefer server-provided signed_url if available
          if (receipt.signed_url) {
            urls[receipt.id] = receipt.signed_url
            continue
          }

          // Fallback to sign-url API
          const resp = await fetch('/api/storage/sign-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ path: receipt.file_path, bucket: 'receipts' })
          })
          if (resp.ok) {
            const d = await resp.json()
            urls[receipt.id] = d.signedUrl
          }
        } catch (err) {
          console.error('Error fetching receipt signed url', err)
        }
      }
      setReceiptUrls(urls)
    }

    fetchProductImage()
    fetchReceiptImages()
  }, [escrow])

  // Fetch bank details for payment instructions
  useEffect(() => {
    async function fetchBankDetails() {
      try {
        const resp = await fetch('/api/settings/bank')
        if (resp.ok) {
          const data = await resp.json()
          setBankDetails(data)
        }
      } catch (err) {
        console.error('Error fetching bank details:', err)
      }
    }
    fetchBankDetails()
  }, [])

  // Fetch delivery proof signed URL when escrow has delivery proof
  useEffect(() => {
    if (!escrow?.delivery_proof_url) {
      setDeliveryProofSignedUrl(null)
      return
    }

    const fetchDeliveryProofSignedUrl = async () => {
      try {
        // If escrow returned a signed URL for delivery proof, use it
        if ((escrow as any)?.delivery_proof_signed_url && (escrow as any).delivery_proof_signed_url.startsWith('http')) {
          setDeliveryProofSignedUrl((escrow as any).delivery_proof_signed_url)
          return
        }

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

  // Calculate and display timer based on escrow status
  useEffect(() => {
    if (!escrow) {
      setTimeLeft(null)
      return
    }

    let timerEnd: Date | null = null
    let timerLabel = ''

    if (escrow.status === 'waiting_payment') {
      // Use expires_at if set, otherwise default to 30 minutes from creation
      if ((escrow as any).expires_at) {
        timerEnd = new Date((escrow as any).expires_at)
      } else {
        timerEnd = new Date(new Date(escrow.created_at || '').getTime() + 30 * 60 * 1000)
      }
      timerLabel = 'Time left to complete payment:'
    } else if (escrow.status === 'in_progress' && confirmationTimeLeft !== null) {
      // Use the confirmation timer that's already running
      return
    }

    if (timerEnd) {
      const updateTimer = () => {
        const now = Date.now()
        const secs = Math.max(0, Math.floor((timerEnd!.getTime() - now) / 1000))
        setTimeLeft(secs)

        if (secs <= 0) {
          // Timer expired - call expire API to close the escrow
          setTimeLeft(0)
          if (escrow?.id && escrow.status === 'waiting_payment') {
            // Call expire API
            fetch('/api/escrow/expire', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ escrowId: escrow.id })
            }).then(resp => {
              if (resp.ok) {
                console.log('Escrow expired successfully')
                // The realtime subscription will update the UI
              } else {
                console.error('Failed to expire escrow')
              }
            }).catch(err => {
              console.error('Error expiring escrow:', err)
            })
          }
        }
      }

      updateTimer()
      const interval = setInterval(updateTimer, 1000)
      return () => clearInterval(interval)
    } else {
      setTimeLeft(null)
    }
  }, [escrow?.status, escrow?.created_at, confirmationTimeLeft])

  // Start confirmation timer when delivery proof is available and escrow is in progress
  useEffect(() => {
    if (escrow?.status === 'in_progress' && escrow.delivery_proof_url && currentUser?.id === escrow.buyer_id) {
      // Start 5-minute (300 seconds) countdown
      setConfirmationTimeLeft(300)

      const timer = setInterval(() => {
        setConfirmationTimeLeft(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    } else {
      setConfirmationTimeLeft(null)
    }
  }, [escrow?.status, escrow?.delivery_proof_url, currentUser?.id, escrow?.buyer_id])

  // Handle buyer confirmation of receipt
  const handleConfirmReceipt = async () => {
    if (!escrow?.id) return

    setConfirmingDelivery(true)
    try {
      const response = await fetch('/api/escrow/confirm-received', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ escrowId: escrow.id })
      })

      if (response.ok) {
        setStatusChangeNotification('Transaction completed successfully!')
        // Refresh escrow data
        window.location.reload()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to confirm receipt')
      }
    } catch (err) {
      console.error('Error confirming receipt:', err)
      setError('Failed to confirm receipt')
    } finally {
      setConfirmingDelivery(false)
    }
  }

  // Subscribe to escrow updates (status changes, receipts, etc.) so UI updates in real-time
  useEffect(() => {
    if (!escrow || !escrow.id) return
    const channel = supabase
      .channel(`escrow-updates-${escrow.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escrows', filter: `id=eq.${escrow.id}` }, (payload) => {
        try {
          console.debug('[BuyerEscrowPage] escrow payload', payload)
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newRow = payload.new as Partial<Escrow>
            setEscrow(prev => {
              const merged = { ...(prev || {}), ...(newRow || {}) } as Escrow
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
  }, [escrow?.id])

  const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!escrow) return
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('escrowId', escrow.id || '')
      const resp = await fetch('/api/escrow/upload-receipt', {
        method: 'POST',
        body: form,
        // ensure httpOnly cookie session is sent with the upload request
        credentials: 'include'
      })
      if (resp.ok) {
        // refresh escrow to pick up new receipt and status
        // Use the authenticated server API to re-fetch the escrow so we
        // receive member-only fields (receipts, signed URLs) and respect RLS.
        try {
          const codeStr = Array.isArray(code) ? code[0] : code
          const r = await fetch(`/api/escrow/by-id/${encodeURIComponent(String(codeStr))}`, { credentials: 'include' })
          if (r.ok) {
            const j = await r.json()
            setEscrow(j.escrow as Escrow)
          } else {
            const j = await r.json().catch(() => ({}))
            console.warn('Post-upload escrow refresh failed', r.status, j)
          }
        } catch (e) {
          console.error('Post-upload refresh error', e)
        }
      } else {
        const d = await resp.json().catch(() => ({}))
        setError(d.error || 'Failed to upload receipt')
      }
    } catch (err) {
      console.error('Upload receipt error', err)
      setError('Failed to upload receipt')
    } finally {
      setUploading(false)
    }
  }

  // Helper: determine if the buyer should be allowed to upload a receipt for this escrow status
  const canUploadReceipt = (status?: string | null) => {
    if (!status) return true
    // Disallow uploading once the escrow has progressed to admin review or later stages
    const disallowed = [
      ESCROW_STATUS.WAITING_ADMIN,
      ESCROW_STATUS.PAYMENT_CONFIRMED,
      ESCROW_STATUS.IN_PROGRESS,
      ESCROW_STATUS.COMPLETED,
      ESCROW_STATUS.REFUNDED,
      ESCROW_STATUS.CLOSED,
    ]
    return !disallowed.includes(status as any)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4">
      <div className="container mx-auto max-w-2xl">
        {loading && (
          <div className="text-center text-gray-400 py-20">Loading transaction...</div>
        )}
        {error && (
          <>
            <FeedbackBanner message={error} type="error" onClose={() => setError("")} />
            {/* Dev helper: if access denied, show currentUser.id and a button to fetch escrow via service role */}
            {process.env.NODE_ENV !== 'production' && error.toLowerCase().includes('access denied') && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-4 rounded">
                <div className="mb-2 text-sm text-yellow-800">Dev info: Access denied when fetching escrow.</div>
                <div className="mb-2 text-xs text-gray-700">currentUser.id: <code>{currentUser?.id || 'not-signed-in'}</code></div>
                <div className="flex gap-3">
                  <button className="btn-primary" onClick={async () => {
                    try {
                      const resp = await fetch(`/api/dev/escrow/by-code?code=${encodeURIComponent(Array.isArray(code) ? code[0] : code)}`, { credentials: 'include' })
                      const json = await resp.json()
                      // show a small popup via alert for convenience
                      alert('Dev escrow response: ' + JSON.stringify(json))
                    } catch (e) {
                      // eslint-disable-next-line no-console
                      console.error('Dev fetch escrow error', e)
                      alert('Dev fetch failed: ' + String(e))
                    }
                  }}>Fetch escrow (dev)</button>
                  <button className="btn-secondary" onClick={() => navigator.clipboard?.writeText(currentUser?.id || '')}>Copy currentUser.id</button>
                </div>
              </div>
            )}
          </>
        )}
        {statusChangeNotification && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="text-blue-400 mr-3">🔄</div>
              <p className="text-blue-800 font-medium">{statusChangeNotification}</p>
            </div>
          </div>
        )}
        {!loading && !error && escrow && (
          <div className="bg-white shadow rounded-lg p-8 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <h1 className="text-2xl font-bold text-gray-900">
                Transaction <span className="font-mono text-lg text-gray-700">{escrow.code}</span>
              </h1>
              <span className={`inline-flex items-center gap-2 px-4 py-1 rounded-full text-base font-semibold border-2 ${getStatusColor((escrow.status as any) || "created")}`}>
                {getStatusLabel((escrow.status as any) || "created")}
              </span>
            </div>
            {/* Timer Display */}
            {timeLeft !== null && timeLeft > 0 && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-yellow-600 text-xl">⏱️</div>
                  <div>
                    <div className="font-semibold text-yellow-800">Time Remaining</div>
                    <div className="text-2xl font-mono font-bold text-yellow-700">
                      {Math.floor(timeLeft / 3600).toString().padStart(2, '0')}:
                      {Math.floor((timeLeft % 3600) / 60).toString().padStart(2, '0')}:
                      {(timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-sm text-yellow-700">
                  {escrow.status === 'waiting_payment' 
                    ? 'Complete your payment before the timer expires to avoid transaction cancellation.'
                    : 'Please complete the required action before time runs out.'
                  }
                </div>
              </div>
            )}
            {productImageUrl && (
              <div className="mb-6 flex justify-center">
                <Image src={productImageUrl} alt="Product" width={320} height={220} className="rounded-2xl object-cover shadow-lg border border-gray-200" />
              </div>
            )}
            <div className="space-y-4">
              <div>
                <span className="font-semibold">Description:</span> {(escrow.description as any) || escrow.product_description || "-"}
              </div>
              <div>
                <span className="font-semibold">Amount:</span> {(escrow.price ?? escrow.amount) !== null && (escrow.price ?? escrow.amount) !== undefined ? formatNaira((escrow.price ?? escrow.amount) as number) : "-"}
              </div>
              {/* Bank Details Display */}
              {bankDetails && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold text-blue-800 mb-2">Payment Instructions</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Bank Name:</span> {bankDetails.bank_name || "-"}
                    </div>
                    <div>
                      <span className="font-medium">Account Name:</span> {bankDetails.account_holder || "-"}
                    </div>
                    <div>
                      <span className="font-medium">Account Number:</span> {bankDetails.account_number || "-"}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-blue-600">
                    Please make payment to the above account and upload your receipt below.
                  </div>
                </div>
              )}
              <div>
                <span className="font-semibold">Created At:</span> {escrow.created_at ? new Date(escrow.created_at).toLocaleString() : "-"}
              </div>
              {/* Payment Receipt Display */}
              <div>
                <span className="font-semibold">Payment Receipt:</span>{" "}
                {Array.isArray(escrow.receipts) && escrow.receipts.length > 0 ? (
                  <div className="mt-2">
                    {escrow.receipts.map((r: any) => (
                      <div key={r.id} className="mb-2">
                        {receiptUrls[r.id] ? (
                          (r.file_path || '').toLowerCase().endsWith('.pdf') ? (
                            <a href={receiptUrls[r.id]} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View receipt</a>
                          ) : (
                            <Image src={receiptUrls[r.id]} alt="Payment Receipt" width={320} height={220} className="rounded-lg border shadow max-h-48 object-contain" />
                          )
                        ) : (
                          <span className="text-gray-400">Receipt available</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="text-gray-400">No receipt uploaded</div>

                    {/* If signed-in user is the escrow buyer, show upload control */}
                    {currentUser && currentUser.id === escrow.buyer_id && canUploadReceipt(escrow.status) && (
                      <div className="flex items-center gap-3">
                        <label className="btn-secondary cursor-pointer">
                          {uploading ? 'Uploading...' : 'Upload Receipt'}
                          <input type="file" accept="image/*,.pdf" onChange={handleReceiptChange} className="hidden" />
                        </label>
                        <span className="text-sm text-gray-500">Uploading will automatically update the transaction status.</span>
                      </div>
                    )}

                    {/* If signed-in user is NOT the escrow buyer, show a clear message with actions */}
                    {currentUser && currentUser.id !== escrow.buyer_id && (
                      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                        <div className="font-semibold text-yellow-800">You're signed in as a different account</div>
                        <div className="text-sm text-gray-700 mt-1">This transaction is owned by <code>{escrow.buyer?.email || escrow.buyer_id}</code>. To upload a receipt, sign in as that buyer account.</div>
                        <div className="mt-3 flex gap-2">
                          <button
                            className="btn-primary"
                            onClick={async () => {
                              try {
                                // sign out current session then navigate to buyer landing so user can sign in
                                await (supabase as any).auth.signOut()
                                // open buyer landing page (login form)
                                window.location.href = '/buyer'
                              } catch (e) {
                                // eslint-disable-next-line no-console
                                console.error('Sign out failed', e)
                                alert('Sign out failed. Please clear cookies and try again.')
                              }
                            }}
                          >
                            Sign out
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => {
                              try {
                                const email = escrow.buyer?.email || ''
                                if (email) navigator.clipboard?.writeText(email)
                                // open buyer page where user can sign in
                                window.open('/buyer', '_blank')
                                alert('Buyer email copied to clipboard: ' + email)
                              } catch (e) {
                                // eslint-disable-next-line no-console
                                console.error(e)
                              }
                            }}
                          >
                            Open buyer login
                          </button>
                          {process.env.NODE_ENV !== 'production' && (
                            <button
                              className="btn-ghost"
                              onClick={async () => {
                                try {
                                  const email = escrow.buyer?.email || ''
                                  if (!email) return alert('No buyer email available')
                                  const resp = await fetch('/api/dev/signin', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    credentials: 'include',
                                    body: JSON.stringify({ email })
                                  })
                                  const j = await resp.json()
                                  if (resp.ok && j.user) {
                                    // reload to reflect new session
                                    window.location.reload()
                                  } else {
                                    alert('Dev sign-in failed: ' + (j.error || JSON.stringify(j)))
                                  }
                                } catch (e) {
                                  // eslint-disable-next-line no-console
                                  console.error('Dev sign-in error', e)
                                  alert('Dev sign-in error: ' + String(e))
                                }
                              }}
                            >
                              Sign in as buyer (dev)
                            </button>
                          )}
                          {process.env.NODE_ENV !== 'production' && escrow.seller?.email && (
                            <button
                              className="btn-ghost"
                              onClick={async () => {
                                try {
                                  const email = escrow.seller?.email || ''
                                  if (!email) return alert('No seller email available')
                                  const resp = await fetch('/api/dev/signin', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    credentials: 'include',
                                    body: JSON.stringify({ email })
                                  })
                                  const j = await resp.json()
                                  if (resp.ok && j.user) {
                                    // reload to reflect new session
                                    window.location.reload()
                                  } else {
                                    alert('Dev sign-in failed: ' + (j.error || JSON.stringify(j)))
                                  }
                                } catch (e) {
                                  // eslint-disable-next-line no-console
                                  console.error('Dev sign-in error', e)
                                  alert('Dev sign-in error: ' + String(e))
                                }
                              }}
                            >
                              Sign in as seller (dev)
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Delivery Proof Display */}
              {escrow.delivery_proof_url && (
                <div className="mt-6">
                  <span className="font-semibold">Delivery Proof:</span>{" "}
                  <div className="mt-2">
                    {escrow.delivery_proof_url.toLowerCase().endsWith('.pdf') ? (
                      <a
                        href={deliveryProofSignedUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline hover:text-blue-800"
                      >
                        📄 View PDF Delivery Proof
                      </a>
                    ) : (
                      deliveryProofSignedUrl && (
                        <Image
                          src={deliveryProofSignedUrl}
                          alt="Delivery Proof"
                          width={320}
                          height={220}
                          className="rounded-lg border shadow max-h-48 object-contain"
                        />
                      )
                    )}
                    {/* Confirmation Timer and Button */}
                    {escrow.status === 'in_progress' && currentUser?.id === escrow.buyer_id && confirmationTimeLeft !== null && (
                      <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h4 className="font-semibold text-green-800 mb-2">Confirm Receipt</h4>
                        <p className="text-sm text-green-700 mb-3">
                          The seller has marked this transaction as delivered. Please review the delivery proof above and confirm receipt within the time limit.
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            <span className="font-medium">Time remaining: </span>
                            <span className={`font-mono ${confirmationTimeLeft < 60 ? 'text-red-600' : 'text-green-600'}`}>
                              {Math.floor(confirmationTimeLeft / 60)}:{(confirmationTimeLeft % 60).toString().padStart(2, '0')}
                            </span>
                          </div>
                          <button
                            onClick={handleConfirmReceipt}
                            disabled={confirmingDelivery || confirmationTimeLeft === 0}
                            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {confirmingDelivery ? 'Confirming...' : 'Confirm Receipt'}
                          </button>
                        </div>
                        {confirmationTimeLeft === 0 && (
                          <p className="text-sm text-red-600 mt-2">
                            Time limit expired. Please contact support if you have issues with the delivery.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* Chat Section */}
              <div className="mt-8">
                <EscrowChat escrowId={escrow.id || ""} currentUserId={currentUser?.id || ""} supabaseClient={supabase} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
