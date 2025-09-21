'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import FeedbackBanner from '../../../../components/FeedbackBanner'
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
  payment_deadline?: string
  seller?: { telegram_id: string }
  buyer?: { telegram_id: string }
  receipts?: Array<{
    id: string
    created_at: string
    file_path: string
  }>
}

interface BankSettings {
  bank_name: string
  account_number: string
  account_holder: string
}


export default function BuyerEscrowPage() {
  // ...existing code...
  // All hooks must be at the top, before any return or conditional
  // All hooks must be at the top, before any return or conditional
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const params = useParams()
  const code = params.code as string
  const [escrow, setEscrow] = useState<Escrow | null>(null)
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [paymentProof, setPaymentProof] = useState<File | null>(null)
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [user, setUser] = useState<User | null>(null)
  const [supabaseUser, setSupabaseUser] = useState<any>(null)
  const [showAuthForm, setShowAuthForm] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup')
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' })
  const [authLoading, setAuthLoading] = useState(false)
  const [joining, setJoining] = useState(false)
  const authFormRef = useRef<HTMLDivElement | null>(null)
  // Timer hooks (must be declared here)
  const [timerLabel, setTimerLabel] = useState<string>('');
  const [timerEnd, setTimerEnd] = useState<Date | null>(null);
  const [timerValue, setTimerValue] = useState<string>('');

  // Always show timer for buyer in any active state, fallback if missing
  useEffect(() => {
    if (!escrow || !user) {
      setTimerLabel('');
      setTimerEnd(null);
      return;
    }
    const isBuyer = String(escrow.buyer_id) === String(user.id);
    if (!isBuyer) {
      setTimerLabel('');
      setTimerEnd(null);
      return;
    }
    if (escrow.status !== 'completed' && escrow.status !== 'cancelled') {
      if (escrow.payment_deadline) {
        setTimerLabel('Time left to pay:');
        setTimerEnd(new Date(escrow.payment_deadline));
      } else {
        setTimerLabel('No payment deadline set.');
        setTimerEnd(null);
      }
    } else {
      setTimerLabel('');
      setTimerEnd(null);
    }
  }, [escrow, user]);

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

  useEffect(() => {
    // Check Supabase auth state
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUser({ id: data.user.id ?? '', email: data.user.email ?? '' });
        setSupabaseUser(data.user);
        setShowAuthForm(false);
      } else {
        setUser(null);
        setSupabaseUser(null);
      }
    });
    fetchEscrow();
    fetchCurrentUser();
    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id ?? '', email: session.user.email ?? '' });
        setSupabaseUser(session.user);
        setShowAuthForm(false);
      } else {
        setUser(null);
        setSupabaseUser(null);
      }
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [code]);

  useEffect(() => {
    if (escrow?.product_image_url) {
      fetchProductImage()
    }
  }, [escrow])

  const fetchEscrow = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await fetch(`/api/escrow/by-code/${code}`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );
      if (response.ok) {
        const data = await response.json();
        setEscrow(data);
      } else {
        setError('Transaction not found');
      }
    } catch (error) {
      console.error('Error fetching escrow:', error);
      setError('Failed to load transaction');
    } finally {
      setLoading(false);
    }
  };

  // fetchBankSettings removed

  // checkAuthStatus removed (now handled by Supabase SDK)

  const fetchCurrentUser = async () => {
    // Optionally fetch additional user info if needed, or remove if not used
    // setCurrentUser(supabaseUser) or fetch from your DB if needed
    setCurrentUser(supabaseUser);
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setError('');
    try {
      if (authMode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authForm.email,
          password: authForm.password,
        });
        if (error) {
          setError(error.message || 'Authentication failed');
        } else if (data.user) {
          setUser({ id: data.user.id ?? '', email: data.user.email ?? '' });
          setSupabaseUser(data.user);
          setShowAuthForm(false);
          setAuthForm({ email: '', password: '', name: '' });
          setSuccess('Logged in successfully!');
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: authForm.email,
          password: authForm.password,
        });
        if (error) {
          setError(error.message || 'Signup failed');
        } else if (data.user) {
          setUser({ id: data.user.id ?? '', email: data.user.email ?? '' });
          setSupabaseUser(data.user);
          setShowAuthForm(false);
          setAuthForm({ email: '', password: '', name: '' });
          setSuccess('Account created successfully!');
        }
      }
    } catch (error) {
      setError('Authentication failed. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleJoinTransaction = async () => {
    if (!user || !escrow) return;
    setJoining(true);
    setError('');
    try {
      // Force a session refresh to get the latest token
      await supabase.auth.refreshSession();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
  // Do not log tokens to console in client-side code.
      if (!token) {
        setError('Authentication failed: No token present. Please log out and log in again.');
        setJoining(false);
        return;
      }
      const response = await fetch('/api/escrow/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ code: escrow.code })
      });
      const data = await response.json();
      if (response.ok) {
        setSuccess('Successfully joined the transaction!');
        await fetchEscrow(); // Ensure latest escrow is loaded
      } else {
        setError(data.error || 'Failed to join transaction');
      }
    } catch (error) {
      console.error('Join error:', error);
      setError('Failed to join transaction. Please try again.');
    } finally {
      setJoining(false);
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

  // New payment proof upload logic
  const handlePaymentProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPaymentProof(e.target.files[0]);
    }
  };

  const handleUploadPaymentProof = async () => {
    if (!paymentProof || !escrow) return;
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      // Step 1: Upload to temp
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const formData = new FormData();
      formData.append('file', paymentProof);
      formData.append('escrowId', escrow.id);
      const uploadResp = await fetch('/api/escrow/upload-temp', {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!uploadResp.ok) {
        setError('Failed to upload payment proof');
        setUploading(false);
        return;
      }
      const uploadJson = await uploadResp.json();
      const tempPath = uploadJson.path || uploadJson.tempPath;
      if (!tempPath) {
        setError('Upload failed: no temp path returned');
        setUploading(false);
        return;
      }
      // Step 2: Finalize receipt (move to permanent, update escrow)
      const finalizeResp = await fetch('/api/escrow/finalize-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ escrowId: escrow.id, tempPath })
      });
      if (!finalizeResp.ok) {
        setError('Failed to finalize receipt');
        setUploading(false);
        return;
      }
      const { receiptUrl } = await finalizeResp.json();
      setPaymentProofUrl(receiptUrl);
      setSuccess('Payment proof uploaded!');
      fetchEscrow(); // Refresh escrow to show receipt
    } catch (err) {
      setError('Failed to upload payment proof');
    } finally {
      setUploading(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!escrow) return;
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      // Only allow if a receipt is uploaded (either in this session or already present)
      const hasUploadedReceipt = !!paymentProofUrl || (escrow.receipts && escrow.receipts.length > 0);
      if (!hasUploadedReceipt) {
        setError('Please upload a payment receipt before marking as paid.');
        setUploading(false);
        return;
      }
      // Mark as paid API call (send only escrow_id)
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await fetch('/api/escrow/mark-paid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ escrow_id: escrow.id })
      });
      if (response.ok) {
        setSuccess('Marked as paid!');
        setPaymentProof(null);
        setPaymentProofUrl(null);
        fetchEscrow();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to mark as paid');
      }
    } catch (err) {
      setError('Failed to mark as paid');
    } finally {
      setUploading(false);
    }
  };

  const [confirming, setConfirming] = useState(false);
  const handleConfirmReceived = async () => {
    if (!escrow) return;
    setConfirming(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await fetch('/api/escrow/confirm-received', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ escrowId: escrow.id })
      });
      if (response.ok) {
        setSuccess('Receipt confirmed successfully!');
        // Wait a moment to ensure DB is updated, then fetch fresh
        setTimeout(() => {
          fetchEscrow();
          setConfirming(false);
        }, 800);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to confirm receipt');
        setConfirming(false);
      }
    } catch (error) {
      console.error('Error confirming receipt:', error);
      setError('Failed to confirm receipt');
      setConfirming(false);
    }
  };

  useEffect(() => {
    if (!timerEnd || !timerLabel) {
      setTimerValue('');
      return;
    }
    const updateTimer = () => {
      const now = Date.now();
      const secs = Math.max(0, Math.floor((timerEnd.getTime() - now) / 1000));
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      setTimerValue(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [timerEnd, timerLabel]);

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
  const canJoinTransaction = escrow.status === 'created' && !escrow.buyer_id && (!user || String(escrow.seller_id) !== String(user.id));
  const canJoinPublic = escrow.status === 'created' && !(escrow as any).has_buyer; // For unauthenticated users
  const isUserBuyer = user && String(escrow.buyer_id) === String(user.id);
  const isUserSeller = user && String(escrow.seller_id) === String(user.id);
  const needsAuthentication = (canJoinTransaction || canJoinPublic) && !user;

  if (process.env.NEXT_PUBLIC_DEBUG === '1' || process.env.DEBUG) {
    // debug flag enabled; no client-side token/log leakage in production build
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Debug banner removed — do not leak tokens in UI */}
      <div className="container mx-auto max-w-2xl">
        <div className="mb-6">
          <Link href="/buyer" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Buyer Portal
          </Link>
        </div>

        {/* Transaction Header with dynamic timer */}
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
            {/* Timer for buyer in any active state */}
            {isUserBuyer && timerLabel && (
              <div>
                <span className="text-gray-500">{timerLabel}</span>{timerValue && timerEnd ? <span className="font-mono font-semibold"> {timerValue}</span> : null}
              </div>
            )}
            {/* Always show admin bank details for buyer in any active state */}
            {isUserBuyer && (escrow as any).admin_bank && escrow.status !== 'completed' && escrow.status !== 'cancelled' && (
              <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900">Pay To</h3>
                <div>
                  <span className="font-medium">Bank Name:</span> {(escrow as any).admin_bank.bank_name || <span className='text-red-600'>Missing</span>}
                </div>
                <div>
                  <span className="font-medium">Account Number:</span> <span className="font-mono text-lg">{(escrow as any).admin_bank.account_number || <span className='text-red-600'>Missing</span>}</span>
                </div>
                <div>
                  <span className="font-medium">Account Holder:</span> {(escrow as any).admin_bank.account_holder || (escrow as any).admin_bank.account_holder_name || <span className='text-red-600'>Missing</span>}
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

        {/* Bank Details (from admin_bank only) */}
        {(escrow as any).admin_bank && (isUserBuyer || (canUploadReceipt && user)) && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">💳 Payment Details</h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-gray-900">Bank Name</h3>
                <p className="text-gray-600">{(escrow as any).admin_bank.bank_name}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Account Number</h3>
                <p className="text-lg font-mono">{(escrow as any).admin_bank.account_number}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Account Holder</h3>
                <p className="text-gray-600">{(escrow as any).admin_bank.account_holder || (escrow as any).admin_bank.account_holder_name}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Amount to Pay</h3>
                <p className="text-xl font-bold text-green-600">{formatNaira(totalAmount)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Always show Payment Proof Upload & Mark as Paid for buyer in any active state */}
        {isUserBuyer && escrow.status !== 'completed' && escrow.status !== 'cancelled' && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">📄 Upload Payment Proof</h2>
            <div className="space-y-4">
              <p className="text-gray-600">
                After making the payment, upload your proof here for verification, then mark as paid.
              </p>
              <div>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  ref={fileInputRef}
                  onChange={handlePaymentProofChange}
                  disabled={uploading}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Supports: JPEG, PNG, WebP, PDF (max 10MB)
                </p>
              </div>
              {paymentProof && (
                <div className="flex items-center gap-2">
                  <span className="text-sm">Selected: {paymentProof.name}</span>
                  <button
                    type="button"
                    className="btn-secondary btn-xs"
                    onClick={handleUploadPaymentProof}
                    disabled={uploading}
                  >
                    {uploading ? 'Uploading...' : 'Upload Proof'}
                  </button>
                </div>
              )}
              {paymentProofUrl && (
                <div className="text-green-700 text-sm">Proof uploaded!</div>
              )}
              <button
                onClick={handleMarkAsPaid}
                disabled={
                  uploading ||
                  (!!paymentProof && !paymentProofUrl) ||
                  (!paymentProofUrl && (!escrow.receipts || escrow.receipts.length === 0))
                }
                className="btn-success mt-2"
              >
                {uploading ? 'Processing...' : 'Mark as Paid'}
              </button>
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
              disabled={confirming}
            >
              {confirming ? 'Processing...' : 'Confirm Received'}
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

        {/* Receipts Preview */}
        {escrow.receipts && escrow.receipts.length > 0 && isUserBuyer && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">📄 Uploaded Receipts</h2>
            <div className="space-y-4">
              {escrow.receipts.map((receipt) => (
                <div key={receipt.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">
                      Uploaded on {new Date(receipt.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {receipt.file_path && (
                    <div>
                      {receipt.file_path.toLowerCase().endsWith('.pdf') ? (
                        <a
                          href={receipt.file_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          📄 View PDF Receipt
                        </a>
                      ) : (
                        <Image
                          src={receipt.file_path}
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
      </div>
    </div>
  )
}
