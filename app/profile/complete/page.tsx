'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface BankingInfo {
  full_name: string
  phone_number: string
  bank_name: string
  account_number: string
  account_holder_name: string
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

export default function CompleteProfile() {
  const [formData, setFormData] = useState<BankingInfo>({
    full_name: '',
    phone_number: '',
    bank_name: '',
    account_number: '',
    account_holder_name: ''
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState<any>(null)
  
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/admin/login')
        return
      }

      setUser(user)

      // Check if profile is already completed
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
  .eq('id', user.id)
        .single()
      
      if (profile?.profile_completed) {
        router.push('/')
        return
      }
      
      // Pre-fill existing data
      if (profile) {
        setFormData({
          full_name: profile.full_name || '',
          phone_number: profile.phone_number || '',
          bank_name: profile.bank_name || '',
          account_number: profile.account_number || '',
          account_holder_name: profile.account_holder_name || ''
        })
      }
    }
    
    checkUser()
    }, [router, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Validate required fields
      if (!formData.full_name || !formData.phone_number || !formData.bank_name || 
          !formData.account_number || !formData.account_holder_name) {
        throw new Error('All fields are required')
      }

      // Validate account number (Nigerian banks typically 10 digits)
      if (!/^\d{10}$/.test(formData.account_number)) {
        throw new Error('Account number must be exactly 10 digits')
      }


      // Validate phone number (Nigerian format)
      if (!/^(\+234|234|0)[789]\d{9}$/.test(formData.phone_number)) {
        throw new Error('Please enter a valid Nigerian phone number')
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          ...formData,
          profile_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      router.push('/')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof BankingInfo, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Complete Your Profile
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            We need your banking information to process payments and refunds securely
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                Full Name *
              </label>
              <input
                id="full_name"
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => handleChange('full_name', e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Enter your full name as on your ID"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">
                Phone Number *
              </label>
              <input
                id="phone_number"
                type="tel"
                required
                value={formData.phone_number}
                onChange={(e) => handleChange('phone_number', e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="e.g. +2348012345678 or 08012345678"
              />
            </div>

            {/* Bank Name */}
            <div>
              <label htmlFor="bank_name" className="block text-sm font-medium text-gray-700">
                Bank Name *
              </label>
              <input
                id="bank_name"
                list="banks-list"
                required
                value={formData.bank_name}
                onChange={(e) => handleChange('bank_name', e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
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
              <label htmlFor="account_number" className="block text-sm font-medium text-gray-700">
                Account Number *
              </label>
              <input
                id="account_number"
                type="text"
                required
                maxLength={10}
                value={formData.account_number}
                onChange={(e) => handleChange('account_number', e.target.value.replace(/\D/g, ''))}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="10-digit account number"
              />
            </div>

            {/* Account Holder Name */}
            <div>
              <label htmlFor="account_holder_name" className="block text-sm font-medium text-gray-700">
                Account Holder Name *
              </label>
              <input
                id="account_holder_name"
                type="text"
                required
                value={formData.account_holder_name}
                onChange={(e) => handleChange('account_holder_name', e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Name as it appears on your bank account"
              />
            </div>

            {/* BVN removed — not required */}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Complete Profile'}
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Security & Privacy
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    Your banking information is encrypted and stored securely. It will only be used for:
                  </p>
                  <ul className="list-disc list-inside mt-1">
                    <li>Processing escrow payments</li>
                    <li>Issuing refunds when necessary</li>
                    <li>Verifying your identity for security</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
