"use client"

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AuthCard from '@/components/AuthCard'

interface CreateEscrowForm {
  description: string
  price: string
  image?: File
}

interface CreatedEscrow {
  id: string
  code: string
}

export default function SellerPortalClient() {
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
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' })
  const [authLoading, setAuthLoading] = useState(false)
  const [user, setUser] = useState<any>(null);
  
  const router = useRouter()

  const fetchOnlineAdmins = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch('/api/admin/online-admins', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok) {
        const data = await res.json();
        setOnlineAdmins(data.admins || []);
      }
    } catch (e) {
      console.error('Error fetching admins', e);
    }
  };

  // Check authentication on load
  useEffect(() => {
    // Check Supabase auth state
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setIsAuthenticated(true);
        setUser(data.user);
        setShowAuthForm(false);
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setShowAuthForm(true);
      }
    });
    fetchOnlineAdmins();
    fetchActiveEscrows();
    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        setUser(session.user);
        setShowAuthForm(false);
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setShowAuthForm(true);
      }
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const [activeEscrows, setActiveEscrows] = useState<Array<any>>([])
  const [blockedCreationInfo, setBlockedCreationInfo] = useState<any | null>(null)

  const fetchActiveEscrows = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch('/api/escrow/my-active', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok) {
        const j = await res.json();
        const sellerEscrows = j.seller || [];
        setActiveEscrows(sellerEscrows);
        // Client-side redirect fallback in case server redirect didn't run
        if (sellerEscrows.length > 0) {
          try {
            const first = sellerEscrows[0];
            const escrowId = first.id || first.escrow_id || first.id;
            if (!window.location.pathname.startsWith('/seller/escrow')) {
              router.push(`/seller/escrow/${escrowId}`);
            }
          } catch (e) {
            // ignore redirect errors
          }
        }
      }
    } catch (e) {
      console.error('Error fetching admins', e);
    }
  };

  // Check if the current user has bank details set
  const [hasBankDetails, setHasBankDetails] = useState<boolean | null>(null)

  // Extracted so we can call it after authentication completes
  const checkBank = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch('/api/profile/banking', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok) {
        const data = await res.json();
        const profile = data.profile ?? data;
        const hasBank = !!(profile && (profile.bank_name || profile.account_number || profile.account_holder_name));
        setHasBankDetails(hasBank);
      } else {
        setHasBankDetails(false);
      }
    } catch (e) {
      console.error('Error checking bank details', e);
      setHasBankDetails(false);
    }
  };

  // Handle authentication
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setError('');
    try {
      // Use server endpoints which set httpOnly cookies so SSR can observe session
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup'
      const payload: any = { email: authForm.email, password: authForm.password }
      if (authMode === 'signup' && authForm.name) payload.name = authForm.name

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setError(json.error || 'Authentication failed')
      } else {
        // If we just signed up, the signup endpoint returns a one-time token but
        // does not always set httpOnly cookies. To ensure SSR can observe the
        // session, perform a login POST which will set the cookies on the response.
        const oneTime = json.__one_time_token
        if (authMode === 'signup' && !oneTime) {
          // fallback: attempt explicit login to ensure cookie set
          try {
            await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: authForm.email, password: authForm.password }),
            })
          } catch (e) {
            // ignore
          }
        }

        setIsAuthenticated(true)
        setUser(json.user || null)
        setShowAuthForm(false)
        try { checkBank(); } catch {}

        // If we received a one-time token, redirect to seller page with token
        if (oneTime) {
          try {
            window.location.href = `/seller?__one_time_token=${encodeURIComponent(oneTime)}`
            return
          } catch (e) {
            // ignore and fallthrough to reload
          }
        }

        // Otherwise reload so server cookies (if set) are attached to next SSR request
        try { window.location.reload() } catch (e) {}
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Telegram authentication (keep as fallback)
  useEffect(() => {
    const authenticateWithTelegram = async () => {
      if (isAuthenticated || !showAuthForm) return

      try {
        const telegram = window.Telegram?.WebApp
        const isInTelegram = telegram?.initData
        
        if (isInTelegram && telegram) {
          const initData = telegram.initData
          
          if (initData) {
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
          }
        }
      } catch (error) {
        console.error('Telegram auth error:', error)
      }
    }

    authenticateWithTelegram()
  }, [isAuthenticated, showAuthForm])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm(prev => {
      const next = { ...prev, [name]: value }
      try {
        localStorage.setItem('seller:create-escrow:draft', JSON.stringify({ description: next.description, price: next.price, selectedAdmin, productImagePath }))
      } catch {}
      return next
    })
  }

  const handleSelectedAdminChange = (id: string) => {
    setSelectedAdmin(id)
    try {
      localStorage.setItem('seller:create-escrow:draft', JSON.stringify({ description: form.description, price: form.price, selectedAdmin: id, productImagePath }))
    } catch {}
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      ;(async () => {
        try {
          const fd = new FormData()
          fd.append('image', file)
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          const resp = await fetch('/api/escrow/upload-temp', {
            method: 'POST',
            body: fd,
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          });
          const json = await resp.json().catch(() => null);
          if (resp.ok && json?.path) {
            const path = json.path
            setProductImagePath(path)
            try {
              const { data: sessionData } = await supabase.auth.getSession();
              const token = sessionData.session?.access_token;
              const signResp = await fetch('/api/storage/sign-url', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ path, bucket: 'product-images' }),
              });
              const signJson = await signResp.json().catch(() => null);
              if (signResp.ok && signJson?.signedUrl) {
                setProductImagePreview(signJson.signedUrl);
              }
            } catch (e) {
            }

            setForm(prev => ({ ...prev, image: file }))
            try {
              localStorage.setItem('seller:create-escrow:draft', JSON.stringify({ description: form.description, price: form.price, selectedAdmin, productImagePath: path }))
            } catch {}
          } else {
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
      const priceValue = Number(form.price)
      formData.append('price', isNaN(priceValue) ? '' : priceValue.toString())
      if (form.image) {
        formData.append('image', form.image)
      }
      if (selectedAdmin) {
        formData.append('assigned_admin_id', selectedAdmin)
      }
      if (productImagePath) {
        formData.append('productImagePath', productImagePath)
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await fetch('/api/escrow/create', {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      const data = await response.json()

      if (response.ok) {
        try {
          if (data?.id) {
            router.push(`/seller/escrow/${data.id}`)
            return
          }
        } catch (e) {
          // ignore navigation errors
        }
        setCreatedEscrow(data)
        try { localStorage.removeItem('seller:create-escrow:draft') } catch {}
        setBlockedCreationInfo(null)
      } else {
        if (data?.activeEscrow) {
          setActiveEscrows([data.activeEscrow])
          setBlockedCreationInfo({ message: data.error || 'You already have an ongoing transaction', escrow: data.activeEscrow })
          setError('')
        } else {
          setError(data.error || 'Failed to create transaction')
        }
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
    try {
      localStorage.removeItem('seller:create-escrow:draft')
    } catch (e) {
      // ignore
    }
    setError('')
  }

  const handleLogout = async () => {
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setError(error.message || 'Logout failed');
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setShowAuthForm(true);
        setAuthForm({ email: '', password: '', name: '' });
        setAuthMode('signup');
        setError('');
        router.push('/');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

  // ...existing UI rendering (kept intact) ...
  // Render the shared AuthCard component and wire up its handlers
  const handleAuthInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setAuthForm(prev => ({ ...prev, [name]: value }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white p-6">
      <div className="max-w-2xl mx-auto">
        <AuthCard
          authMode={authMode}
          authForm={authForm}
          authLoading={authLoading}
          error={error}
          onChange={handleAuthInputChange}
          onSubmit={handleAuth}
          setAuthMode={(m) => { setAuthMode(m); setError('') }}
        />
      </div>
    </div>
  )
}
