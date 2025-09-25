'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
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
  expires_at?: string
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
    changed_by: string
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
  const escrowPrevStatus = useRef<string | null>(null)
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
    if (escrow.status === 'waiting_payment') {
      // Use expires_at if available, otherwise calculate from created_at + 30 minutes
      const deadline = escrow.expires_at 
        ? new Date(escrow.expires_at)
        : new Date(new Date(escrow.created_at).getTime() + 30 * 60 * 1000); // 30 minutes after creation
      
      setTimerLabel('Time left to pay:');
      setTimerEnd(deadline);
    } else if (escrow.status === 'in_progress') {
      // Only recalculate timer if we don't already have one running for this in_progress period
      // This prevents timer reset on page refresh
      if (!timerEnd || !timerLabel.includes('confirm receipt') || escrowPrevStatus.current !== 'in_progress') {
        // Reset auto-confirm flag when entering in_progress status (only if it was previously not in_progress)
        if (escrowPrevStatus.current !== 'in_progress') {
          setAutoConfirmTriggered(false);
        }
        escrowPrevStatus.current = 'in_progress';
        
        // Find when escrow entered in_progress status
        const statusLogs = (escrow as any).status_logs || [];
        const inProgressLog = statusLogs.find((log: any) => log.status === 'in_progress');
        
        console.log('Timer: escrow status is in_progress, statusLogs:', statusLogs.length, 'inProgressLog:', inProgressLog);
        
        // If we have a log entry for in_progress, use that timestamp + 5 minutes
        // Otherwise, assume it just entered in_progress and start 5-minute countdown from now
        const inProgressStart = inProgressLog 
          ? new Date(inProgressLog.created_at)
          : new Date(); // Fallback to current time
        
        console.log('Timer: inProgressStart:', inProgressStart, 'current time:', new Date());
        
        const deadline = new Date(inProgressStart.getTime() + 5 * 60 * 1000); // 5 minutes after entering in_progress
        
        console.log('Timer: calculated deadline:', deadline, 'time left:', Math.max(0, deadline.getTime() - Date.now()) / 1000, 'seconds');
        
        setTimerLabel('Time left to confirm receipt:');
        setTimerEnd(deadline);
      }
    } else {
      // Clear timer for any other status (completed, cancelled, closed, refunded, etc.)
      escrowPrevStatus.current = escrow.status;
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
    fetchEscrow('initial');
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

  // Polling for escrow updates (similar to seller page)
  useEffect(() => {
    if (!escrow) return;
    
    // Don't poll for completed/cancelled/refunded escrows
    if (['completed', 'cancelled', 'refunded', 'closed'].includes(escrow.status)) {
      return;
    }
    
    const interval = setInterval(() => {
      // refresh every 5s for better UX
      fetchEscrow('polling')
    }, 5000)
    return () => {
      clearInterval(interval);
    }
  }, [escrow?.id, escrow?.status])

  const escrowProductImageUrl = useMemo(() => escrow?.product_image_url, [escrow?.product_image_url]);

  useEffect(() => {
    if (escrowProductImageUrl && user) {
      fetchProductImage()
    }
  }, [escrowProductImageUrl, user])

  useEffect(() => {
    if (escrow?.receipts && user && isUserBuyer) {
      fetchReceiptSignedUrls()
    }
  }, [escrow?.receipts, user])

  const [realtimeChannel, setRealtimeChannel] = useState<any>(null)

  const realtimeChannelRef = useRef<any>(null)
  const currentEscrowIdRef = useRef<string | null>(null)

  // Real-time subscription for escrow status changes
  useEffect(() => {
    if (!escrow?.id) {
      // Clean up channel if escrow becomes unavailable
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current)
        realtimeChannelRef.current = null
        currentEscrowIdRef.current = null
        setRealtimeChannel(null)
      }
      return
    }

    // If we already have a channel for this escrow, don't create another
    if (realtimeChannelRef.current && currentEscrowIdRef.current === escrow.id) {
      return
    }

    // Clean up previous channel if it exists
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current)
      realtimeChannelRef.current = null
    }

    currentEscrowIdRef.current = escrow.id

    const channel = supabase
      .channel(`escrow-${escrow.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'escrows',
          filter: `id=eq.${escrow.id}`
        },
        (payload) => {
          // Real-time updates may not include all related data, so fetch complete data
          console.log('Real-time escrow update detected, fetching complete data');
          fetchEscrow('realtime-update');
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Real-time: Successfully subscribed to escrow updates')
        }
      })

    realtimeChannelRef.current = channel
    setRealtimeChannel(channel)

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [escrow?.id])

  // Clean up channel on unmount
  useEffect(() => {
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current)
        realtimeChannelRef.current = null
        currentEscrowIdRef.current = null
      }
    }
  }, [])

  const fetchEscrow = async (source = 'unknown') => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await fetch(`/api/escrow/by-code/${code}`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );
      if (response.ok) {
        const data = await response.json();
        
        // Only update state if data actually changed
        setEscrow(prev => {
          if (!prev) return data;
          // Compare key fields to avoid unnecessary re-renders
          const changed = 
            prev.status !== data.status ||
            prev.buyer_id !== data.buyer_id ||
            prev.product_image_url !== data.product_image_url ||
            JSON.stringify(prev.receipts) !== JSON.stringify(data.receipts) ||
            JSON.stringify(prev.status_logs) !== JSON.stringify(data.status_logs);
          
          if (changed) {
            return data;
          } else {
            return prev;
          }
        });
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
        await fetchEscrow('join'); // Ensure latest escrow is loaded
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
    if (!escrowProductImageUrl || !user) return
    
    // If it's already a valid URL (starts with http), use it directly
    if (escrowProductImageUrl.startsWith('http://') || escrowProductImageUrl.startsWith('https://')) {
      setProductImageUrl(escrowProductImageUrl)
      return
    }
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      const response = await fetch('/api/storage/sign-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify({
          path: escrowProductImageUrl,
          bucket: 'product-images'
        })
      })

      if (response.ok) {
        const data = await response.json()
        setProductImageUrl(data.signedUrl)
      } else {
        const errorData = await response.json()
        console.error('Buyer: Sign URL API error:', errorData)
      }
    } catch (error) {
      console.error('Buyer: Error fetching product image:', error)
    }
  }

  const fetchReceiptSignedUrls = async () => {
    if (!escrow?.receipts || !user || !isUserBuyer) return

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      // Generate signed URLs for all receipts
      const receiptsWithUrls = await Promise.all(
        escrow.receipts.map(async (receipt) => {
          try {
            const response = await fetch('/api/storage/sign-url', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` })
              },
              body: JSON.stringify({
                path: receipt.file_path,
                bucket: 'receipts'
              })
            })

            if (response.ok) {
              const data = await response.json()
              return { ...receipt, signed_url: data.signedUrl }
            } else {
              console.error('Buyer: Sign URL API error for receipt:', receipt.id)
              return receipt
            }
          } catch (error) {
            console.error('Buyer: Error fetching signed URL for receipt:', receipt.id, error)
            return receipt
          }
        })
      )

      // Update escrow with signed URLs
      setEscrow(prev => prev ? { ...prev, receipts: receiptsWithUrls } : null)
    } catch (error) {
      console.error('Buyer: Error fetching receipt signed URLs:', error)
    }
  }

  // New payment proof upload logic - automatic upload on file selection
  const handlePaymentProofChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPaymentProof(file);
      // Automatically upload the file
      await handleUploadPaymentProof(file);
    }
  };

  const handleUploadPaymentProof = async (file?: File) => {
    const fileToUpload = file || paymentProof;
    if (!fileToUpload || !escrow) return;
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('escrowId', escrow.id);

      const uploadResp = await fetch('/api/escrow/upload-receipt', {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!uploadResp.ok) {
        const errorData = await uploadResp.json().catch(() => ({}));
        setError(errorData.error || 'Failed to upload payment proof');
        setUploading(false);
        return;
      }

      setPaymentProofUrl(URL.createObjectURL(fileToUpload));
      setSuccess('Payment proof uploaded successfully! Your escrow is now marked as paid and waiting for admin verification.');
      fetchEscrow('upload-receipt'); // Refresh escrow to show updated status
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload payment proof');
    } finally {
      setUploading(false);
    }
  };



  const [confirming, setConfirming] = useState(false);
  const [autoConfirmTriggered, setAutoConfirmTriggered] = useState(false);
  const handleConfirmReceived = async () => {
    if (!escrow) return;
    
    // Prevent multiple simultaneous calls
    if (confirming) {
      return;
    }
    
    // Double-check status before confirming (prevent race conditions)
    if (escrow.status !== 'in_progress') {
      console.log('Cannot confirm receipt: escrow status is', escrow.status);
      setError('Cannot confirm receipt in current status');
      return;
    }
    
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
          fetchEscrow('confirm-receipt');
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

  const expireEscrow = async () => {
    if (!escrow) return;
    
    // Don't attempt to expire if escrow is already in a terminal state
    if (['closed', 'completed', 'cancelled', 'refunded'].includes(escrow.status)) {
      console.log('Escrow is already in terminal state:', escrow.status, '- not attempting to expire');
      return;
    }
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await fetch('/api/escrow/expire', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ escrowId: escrow.id })
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Escrow expired successfully');
        // Refresh escrow data to show updated status
        fetchEscrow('expire-escrow');
      } else {
        const data = await response.json();
        console.error('Failed to expire escrow:', data.error);
        setError(data.error || 'Failed to expire transaction');
      }
    } catch (error) {
      console.error('Error expiring escrow:', error);
      setError('Failed to expire transaction');
    }
  };

  useEffect(() => {
    if (!timerEnd || !timerLabel) {
      setTimerValue('');
      return;
    }
    
    // Stop timer if escrow is in a terminal state
    if (escrow && ['closed', 'completed', 'cancelled', 'refunded'].includes(escrow.status)) {
      setTimerLabel('');
      setTimerEnd(null);
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
      
      // Auto-confirm receipt if timer expired and escrow is in_progress
      if (secs <= 0 && escrow?.status === 'in_progress' && !confirming && !autoConfirmTriggered) {
        setAutoConfirmTriggered(true);
        handleConfirmReceived();
      }
      
      // Expire escrow if payment deadline reached and still waiting for payment
      // Only expire if escrow is still in expirable status
      if (secs <= 0 && escrow?.status === 'waiting_payment' && timerLabel === 'Time left to pay:' && !['closed', 'completed', 'cancelled', 'refunded'].includes(escrow.status)) {
        console.log('Payment deadline reached, expiring escrow');
        expireEscrow();
      }
      
      // Note: No expiration for in_progress status - it auto-completes instead
      if (secs <= 0 && timerLabel === 'Time left to pay:' && escrow?.status !== 'waiting_payment') {
        console.log('Payment timer expired but escrow status changed to:', escrow?.status, '- stopping timer');
        // Clear the timer when status has changed
        setTimerLabel('');
        setTimerEnd(null);
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [timerEnd, timerLabel, escrow?.status, confirming]);

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
              {(() => {
                console.log('Buyer: About to render Image with productImageUrl:', productImageUrl)
                console.log('Buyer: Is it a valid URL?', productImageUrl.startsWith('http'))
                return null
              })()}
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
              Join this transaction to proceed with the purchase. You&apos;ll be able to make payment and track the progress.
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
        {(escrow as any).admin_bank && (isUserBuyer || ((escrow.status === 'waiting_payment' || escrow.status === 'waiting_admin') && user)) && (
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

        {/* Always show Payment Proof Upload for buyer in any active state */}
        {isUserBuyer && escrow.status === 'waiting_payment' && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">📄 Upload Payment Proof</h2>
            <div className="space-y-4">
              <p className="text-gray-600">
                After making the payment, select your proof of payment below. It will be uploaded automatically and your escrow will be marked as paid.
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
                  Supports: JPEG, PNG, WebP, PDF (max 10MB) - Upload starts automatically when selected
                </p>
              </div>
              {uploading && (
                <div className="text-blue-600 text-sm">Uploading payment proof...</div>
              )}
              {paymentProofUrl && (
                <div className="text-green-700 text-sm">✅ Payment proof uploaded! Your escrow is now marked as paid and waiting for admin verification.</div>
              )}
            </div>
          </div>
        )}

        {/* Confirm Received */}
        {canConfirmReceived && isUserBuyer && escrow.status !== 'completed' && (
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
                  {receipt.signed_url && (
                    <div>
                      {receipt.file_path.toLowerCase().endsWith('.pdf') ? (
                        <a
                          href={receipt.signed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          📄 View PDF Receipt
                        </a>
                      ) : (
                        <Image
                          src={receipt.signed_url}
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
