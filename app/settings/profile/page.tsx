'use client'

import { useState, useEffect } from 'react'
import FeedbackBanner from '../../../components/FeedbackBanner'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  phone_number: string | null
  bank_name: string | null
  account_number: string | null
  account_holder_name: string | null
  profile_completed: boolean
}

const nigerianBanks = [
  'Access Bank plc',
  'Alpha Morgan Bank',
  'Citibank Nigeria Ltd',
  'Ecobank Nigeria Plc',
  'Fidelity Bank Plc',
  'First Bank Nigeria Ltd',
  'First City Monument Bank Plc',
  'Globus Bank Ltd',
  'Guaranty Trust Bank Plc',
  'Keystone Bank Ltd',
  'Nova Commercial Bank Ltd',
  'Optimus Bank',
  'Parallex Bank Ltd',
  'Polaris Bank Plc',
  'Premium Trust Bank',
  'Providus Bank Ltd',
  'Signature Bank Ltd',
  'Stanbic IBTC Bank Plc',
  'Standard Chartered Bank Nigeria Ltd',
  'Sterling Bank Plc',
  'SunTrust Bank Nigeria Ltd',
  'Titan Trust Bank Ltd',
  'Union Bank of Nigeria Plc',
  'United Bank For Africa Plc',
  'Unity Bank Plc',
  'Wema Bank Plc',
  'Zenith Bank Plc',
  'Accion Microfinance Bank',
  'Advans La Fayette Microfinance Bank',
  'Aj Microfinance Bank',
  'Alekun Microfinance Bank',
  'Al-Barakah Microfinance Bank',
  'Amju Microfinance Bank',
  'Apex Trust Microfinance Bank',
  'Auchi Microfinance Bank',
  'Bricks and Mortar Microfinance Bank',
  'Covenant Microfinance Bank',
  'Empire Trust Microfinance Bank',
  'Finca Microfinance Bank',
  'Infinity Microfinance Bank',
  'LAPO Microfinance Bank',
  'Mainstreet Microfinance Bank',
  'Moneyfield Microfinance Bank',
  'Mutual Trust Microfinance Bank',
  'Peace Microfinance Bank',
  'Pecan Trust Microfinance Bank',
  'Rephidim Microfinance Bank',
  'Shepherd Trust Microfinance Bank',
  'Solid Allianze Microfinance Bank',
  'ALAT by Wema',
  'Carbon',
  'FairMoney Microfinance Bank',
  'Kuda Bank',
  'Moniepoint',
  'OPay',
  'Paga',
  'PalmPay',
  'PocketApp by PiggyVest',
  'Sparkle',
  'V Bank'
]

export default function ProfileSettings() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
    bank_name: '',
    account_number: '',
    account_holder_name: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      const response = await fetch('/api/profile/banking')
      const data = await response.json()

      if (data.profile) {
        setProfile(data.profile)
        setFormData({
          full_name: data.profile.full_name || '',
          phone_number: data.profile.phone_number || '',
          bank_name: data.profile.bank_name || '',
          account_number: data.profile.account_number || '',
          account_holder_name: data.profile.account_holder_name || ''
        })
      }
    } catch (err) {
      setError('Failed to load profile')
  // ...removed for production...
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/profile/banking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile')
      }

      setSuccess('Profile updated successfully!')
      setProfile(data.profile)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="container mx-auto flex items-center">
          <button onClick={() => router.back()} className="text-blue-600 hover:text-blue-800 mr-4">
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
        </div>
      </div>

      <div className="container mx-auto p-4 max-w-2xl">
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

        {/* Profile Form */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Banking Information</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name *
              </label>
              <input
                id="full_name"
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your full name as on your ID"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <input
                id="phone_number"
                type="tel"
                required
                value={formData.phone_number}
                onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. +2348012345678 or 08012345678"
              />
            </div>

            {/* Bank Name */}
            <div>
              <label htmlFor="bank_name" className="block text-sm font-medium text-gray-700 mb-1">
                Bank Name *
              </label>
              <input
                id="bank_name"
                list="banks-list"
                required
                value={formData.bank_name}
                onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Type or select your bank"
              />
              <datalist id="banks-list">
                {nigerianBanks.map(bank => (
                  <option key={bank} value={bank} />
                ))}
              </datalist>
            </div>

            {/* Account Number */}
            <div>
              <label htmlFor="account_number" className="block text-sm font-medium text-gray-700 mb-1">
                Account Number *
              </label>
              <input
                id="account_number"
                type="text"
                required
                maxLength={10}
                value={formData.account_number}
                onChange={(e) => setFormData({...formData, account_number: e.target.value.replace(/\D/g, '')})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="10-digit account number"
              />
            </div>

            {/* Account Holder Name */}
            <div>
              <label htmlFor="account_holder_name" className="block text-sm font-medium text-gray-700 mb-1">
                Account Holder Name *
              </label>
              <input
                id="account_holder_name"
                type="text"
                required
                value={formData.account_holder_name}
                onChange={(e) => setFormData({...formData, account_holder_name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Name as it appears on your bank account"
              />
            </div>

            {/* BVN removed — not required */}

            <div className="pt-4">
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Update Profile'}
              </button>
            </div>
          </form>
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
        {/* Security Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <div className="flex">
            <div className="text-blue-400 mr-3">🔒</div>
            <div>
              <h3 className="text-sm font-medium text-blue-800 mb-1">
                Security & Privacy
              </h3>
              <div className="text-sm text-blue-700">
                <p className="mb-2">
                  Your banking information is encrypted and stored securely. It will only be used for:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Processing escrow payments when you're the seller</li>
                  <li>Issuing refunds when you're the buyer</li>
                  <li>Verifying your identity for security purposes</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
