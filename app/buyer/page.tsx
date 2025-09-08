'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function BuyerPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleJoinEscrow = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/escrow/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: code.trim() }),
      })

      const data = await response.json()

      if (response.ok) {
        router.push(`/buyer/escrow/${code.trim().toUpperCase()}`)
      } else {
        setError(data.error || 'Failed to join transaction')
      }
    } catch (error) {
      console.error('Error joining escrow:', error)
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="container mx-auto max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🛒 Buyer Portal
          </h1>
          <p className="text-gray-600">
            Enter your transaction code to join an escrow
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleJoinEscrow} className="space-y-6">
            <div>
              <label htmlFor="code" className="label">
                Transaction Code
              </label>
              <input
                type="text"
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Enter transaction code"
                className="input"
                required
                disabled={loading}
              />
              <p className="mt-2 text-sm text-gray-500">
                Get this code from the seller
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="btn-primary w-full"
            >
              {loading ? 'Joining...' : 'Join Transaction'}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <h3 className="font-semibold mb-4">How it works:</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs flex-shrink-0 mt-0.5">1</span>
              <p>Enter the transaction code provided by the seller</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs flex-shrink-0 mt-0.5">2</span>
              <p>Review product details and total amount (price + ₦300 fee)</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs flex-shrink-0 mt-0.5">3</span>
              <p>Make payment to the provided bank account</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs flex-shrink-0 mt-0.5">4</span>
              <p>Upload payment receipt for verification</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
