'use client'

import { useState, useEffect } from 'react'
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
  bvn: string | null
  profile_completed: boolean
}

const nigerianBanks = [
  'Access Bank',
  'Fidelity Bank', 
  'First City Monument Bank (FCMB)',
  'First Bank of Nigeria',
  'Guaranty Trust Bank (GTBank)',
  'Keystone Bank',
  'Polaris Bank',
  'Providus Bank',
  'Stanbic IBTC Bank',
  'Standard Chartered Bank',
  'Sterling Bank',
  'Union Bank of Nigeria',
  'United Bank for Africa (UBA)',
  'Unity Bank',
  'Wema Bank',
  'Zenith Bank'
]

export default function ProfileSettings() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
    bank_name: '',
    account_number: '',
    account_holder_name: '',
    bvn: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
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
          account_holder_name: data.profile.account_holder_name || '',
          bvn: data.profile.bvn || ''
        })
      }
    } catch (err) {
      setError('Failed to load profile')
      console.error(err)
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
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={() => router.back()} className="text-blue-600 hover:text-blue-800">
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
          </div>
          {profile && (
            <button onClick={handleLogout} className="btn-secondary">
              🚪 Logout
            </button>
          )}
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
              <select
                id="bank_name"
                required
                value={formData.bank_name}
                onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select your bank</option>
                {nigerianBanks.map(bank => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </select>
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

            {/* BVN */}
            <div>
              <label htmlFor="bvn" className="block text-sm font-medium text-gray-700 mb-1">
                Bank Verification Number (BVN) *
              </label>
              <input
                id="bvn"
                type="text"
                required
                maxLength={11}
                value={formData.bvn}
                onChange={(e) => setFormData({...formData, bvn: e.target.value.replace(/\D/g, '')})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="11-digit BVN"
              />
              <p className="mt-1 text-xs text-gray-500">
                Required for secure payment processing and verification
              </p>
            </div>

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
