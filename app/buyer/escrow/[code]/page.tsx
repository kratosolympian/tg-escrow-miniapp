'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { formatNaira } from '@/lib/utils'
import { getStatusLabel, getStatusColor } from '@/lib/status'

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
  seller?: { telegram_id: string }
  buyer?: { telegram_id: string }
  receipts?: Array<{
    id: string
    created_at: string
  }>
}

interface BankSettings {
  bank_name: string
  account_number: string
  account_holder: string
}

export default function BuyerEscrowPage() {
  const params = useParams()
  const code = params.code as string
  
  const [escrow, setEscrow] = useState<Escrow | null>(null)
  const [bankSettings, setBankSettings] = useState<BankSettings | null>(null)
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchEscrow()
    fetchBankSettings()
  }, [code])

  useEffect(() => {
    if (escrow?.product_image_url) {
      fetchProductImage()
    }
  }, [escrow])

  const fetchEscrow = async () => {
    try {
      const response = await fetch(`/api/escrow/by-code/${code}`)
      if (response.ok) {
        const data = await response.json()
        setEscrow(data)
      } else {
        setError('Transaction not found')
      }
    } catch (error) {
      console.error('Error fetching escrow:', error)
      setError('Failed to load transaction')
    } finally {
      setLoading(false)
    }
  }

  const fetchBankSettings = async () => {
    try {
      const response = await fetch('/api/settings/bank')
      if (response.ok) {
        const data = await response.json()
        setBankSettings(data)
      }
    } catch (error) {
      console.error('Error fetching bank settings:', error)
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

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !escrow) return

    setUploading(true)
    setError('')
    setSuccess('')

    try {
      const formData = new FormData()
      formData.append('escrowId', escrow.id)
      formData.append('file', file)

      const response = await fetch('/api/escrow/upload-receipt', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        setSuccess('Receipt uploaded successfully!')
        fetchEscrow() // Refresh escrow data
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to upload receipt')
      }
    } catch (error) {
      console.error('Error uploading receipt:', error)
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleConfirmReceived = async () => {
    if (!escrow) return

    try {
      const response = await fetch('/api/escrow/confirm-received', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ escrowId: escrow.id })
      })

      if (response.ok) {
        setSuccess('Receipt confirmed successfully!')
        fetchEscrow()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to confirm receipt')
      }
    } catch (error) {
      console.error('Error confirming receipt:', error)
      setError('Failed to confirm receipt')
    }
  }

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

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-2xl">
        <div className="mb-6">
          <Link href="/buyer" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Buyer Portal
          </Link>
        </div>

        {/* Transaction Header */}
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
          </div>
        </div>

        {/* Bank Details */}
        {bankSettings && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">💳 Payment Details</h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-gray-900">Bank Name</h3>
                <p className="text-gray-600">{bankSettings.bank_name}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Account Number</h3>
                <p className="text-lg font-mono">{bankSettings.account_number}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Account Holder</h3>
                <p className="text-gray-600">{bankSettings.account_holder}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Amount to Pay</h3>
                <p className="text-xl font-bold text-green-600">{formatNaira(totalAmount)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Receipt Upload */}
        {canUploadReceipt && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">📄 Upload Payment Receipt</h2>
            <div className="space-y-4">
              <p className="text-gray-600">
                After making the payment, upload your receipt here for verification.
              </p>
              
              <div>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleReceiptUpload}
                  disabled={uploading}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Supports: JPEG, PNG, WebP, PDF (max 10MB)
                </p>
              </div>
              
              {uploading && (
                <div className="text-blue-600">
                  Uploading receipt...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confirm Received */}
        {canConfirmReceived && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">✅ Confirm Product Received</h2>
            <p className="text-gray-600 mb-4">
              Have you received the product/service and are satisfied with it?
            </p>
            <button
              onClick={handleConfirmReceived}
              className="btn-success"
            >
              Confirm Received
            </button>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 mb-4">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-800 mb-4">
            {success}
          </div>
        )}

        {/* Receipt Status */}
        {escrow.receipts && escrow.receipts.length > 0 && (
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Receipt Status</h2>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-green-800">
                ✅ Receipt uploaded successfully and is being reviewed by admin.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
