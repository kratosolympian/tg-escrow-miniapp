'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { formatNaira } from '@/lib/utils'
import { getStatusLabel, getStatusColor } from '@/lib/status'
import StatusBadge from '@/components/StatusBadge'

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
    file_path: string
  }>
  status_logs?: Array<{
    id: string
    status: string
    created_at: string
    profiles?: { telegram_id: string }
  }>
}

export default function SellerEscrowPage() {
  const params = useParams()
  const id = params.id as string
  
  const [escrow, setEscrow] = useState<Escrow | null>(null)
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null)
  const [receiptUrls, setReceiptUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchEscrow()
  }, [id])

  useEffect(() => {
    if (escrow?.product_image_url) {
      fetchProductImage()
    }
    if (escrow?.receipts) {
      fetchReceiptImages()
    }
  }, [escrow])

  const fetchEscrow = async () => {
    try {
      const response = await fetch(`/api/escrow/by-id/${id}`)
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

  const fetchReceiptImages = async () => {
    if (!escrow?.receipts) return

    const urls: Record<string, string> = {}
    
    for (const receipt of escrow.receipts) {
      try {
        const response = await fetch('/api/storage/sign-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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

  const handleMarkDelivered = async () => {
    if (!escrow) return

    setActionLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/escrow/mark-delivered', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ escrowId: escrow.id })
      })

      if (response.ok) {
        setSuccess('Marked as delivered successfully!')
        fetchEscrow()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to mark as delivered')
      }
    } catch (error) {
      console.error('Error marking as delivered:', error)
      setError('Failed to mark as delivered')
    } finally {
      setActionLoading(false)
    }
  }

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

  const totalAmount = escrow.price + escrow.admin_fee
  const canMarkDelivered = escrow.status === 'payment_confirmed'

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-2xl">
        <div className="mb-6">
          <Link href="/seller" className="text-green-600 hover:text-green-800 mb-4 inline-block">
            ← Back to Seller Portal
          </Link>
        </div>

        {/* Transaction Header */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Transaction {escrow.code}</h1>
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
                <p className="text-lg">{formatNaira(escrow.price)}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Service Fee</h3>
                <p className="text-lg">{formatNaira(escrow.admin_fee)}</p>
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

        {/* Mark as Delivered */}
        {canMarkDelivered && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">🚚 Mark as Delivered</h2>
            <p className="text-gray-600 mb-4">
              Have you delivered the product/service to the buyer?
            </p>
            <button
              onClick={handleMarkDelivered}
              disabled={actionLoading}
              className="btn-success"
            >
              {actionLoading ? 'Processing...' : 'Mark as Delivered'}
            </button>
          </div>
        )}

        {/* Receipts */}
        {escrow.receipts && escrow.receipts.length > 0 && (
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
      </div>
    </div>
  )
}
