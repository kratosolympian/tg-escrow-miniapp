export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { requireAuth, canAccessEscrow } from '@/lib/rbac'
import { z } from 'zod'

const signUrlSchema = z.object({
  path: z.string().min(1),
  bucket: z.enum(['product-images', 'receipts'])
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    const serviceClient = createServiceRoleClient()

    // Require authentication
    const profile = await requireAuth(supabase)
    console.log('Authenticated user profile:', profile)

    const body = await request.json()
    const { path, bucket } = signUrlSchema.parse(body)
    console.log('Request body parsed:', { path, bucket })

    // Verify access based on bucket and path
    if (bucket === 'product-images') {
      const pathParts = path.split('/')
      console.log('Path parts for product-images:', pathParts)

      if (pathParts[0] === 'temp') {
        console.log('Temporary path detected, skipping seller ID check')
      } else if (pathParts.length >= 2) {
        const sellerId = pathParts[0]
        console.log('Seller ID from path:', sellerId)

        if (sellerId !== profile.id) {
          console.log('User is not the seller. Checking escrow access...')

          if (pathParts.length >= 3) {
            const escrowId = pathParts[1]
            console.log('Escrow ID from path:', escrowId)

            const { data: escrow, error: escrowError } = await supabase
              .from('escrows')
              .select('seller_id, buyer_id')
              .eq('id', escrowId)
              .single()

            console.log('Escrow data:', escrow, 'Error:', escrowError)

            if (!escrow) {
              console.warn('Escrow not found for ID:', escrowId)
              return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
            }

            if (escrow.buyer_id !== profile.id) {
              console.warn('Access denied: User is not the buyer for this escrow')
              return NextResponse.json({ error: 'Access denied' }, { status: 403 })
            }
          } else {
            console.warn('Access denied: Insufficient path parts for escrow check')
            return NextResponse.json({ error: 'Access denied' }, { status: 403 })
          }
        }
      }
    } else if (bucket === 'receipts') {
      const pathParts = path.split('/')
      console.log('Path parts for receipts:', pathParts)

      if (pathParts.length >= 2) {
        const escrowId = pathParts[0]
        const { data: escrow, error: escrowError } = await (supabase as any)
          .from('escrows')
          .select('seller_id, buyer_id')
          .eq('id', escrowId)
          .single()

        console.log('Escrow data for receipts:', escrow, 'Error:', escrowError)

        if (!escrow || !canAccessEscrow(profile, escrow)) {
          console.warn('Access denied for receipts bucket:', { profile, escrow })
          return NextResponse.json({ error: 'Access denied' }, { status: 403 })
        }
      }
    }

    // Generate signed URL (15 minutes expiry)
    const { data, error } = await serviceClient.storage
      .from(bucket)
      .createSignedUrl(path, 900) // 15 minutes

    console.log('Sign URL API - path:', path, 'bucket:', bucket)
    console.log('Sign URL API - data:', data)
    console.log('Sign URL API - error:', error)

    if (error) {
      console.error('Error creating signed URL:', error)
      return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
    }

    console.log('Sign URL API - returning signedUrl:', data.signedUrl)
    return NextResponse.json({ signedUrl: data.signedUrl })

  } catch (error) {
    // Handle common expected errors more gracefully
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.errors)
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    // Authentication failures are expected for anonymous requests; return 401 instead of 500
    if (error instanceof Error && error.message === 'Authentication required') {
      console.warn('Authentication required error:', error)
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    console.error('Sign URL error:', error)
    return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
  }
}
