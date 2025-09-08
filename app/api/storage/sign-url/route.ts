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
    
    const body = await request.json()
    const { path, bucket } = signUrlSchema.parse(body)

    // Verify access based on bucket and path
    if (bucket === 'product-images') {
      // Path format: {seller_id}/{escrow_id}/{filename} or {seller_id}/{filename}
      const pathParts = path.split('/')
      if (pathParts.length >= 2) {
        const sellerId = pathParts[0]
        
        // Check if user is seller or if they have access to the escrow
        if (sellerId !== profile.id) {
          // If there's an escrow ID, check escrow access
          if (pathParts.length >= 3) {
            const { data: escrow } = await (supabase as any)
              .from('escrows')
              .select('seller_id, buyer_id')
              .eq('id', pathParts[1])
              .single()
            
            if (!escrow || !canAccessEscrow(profile, escrow)) {
              return NextResponse.json({ error: 'Access denied' }, { status: 403 })
            }
          } else {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 })
          }
        }
      }
    } else if (bucket === 'receipts') {
      // Path format: {escrow_id}/{uploader_id}/{filename}
      const pathParts = path.split('/')
      if (pathParts.length >= 2) {
        const escrowId = pathParts[0]
        
        const { data: escrow } = await (supabase as any)
          .from('escrows')
          .select('seller_id, buyer_id')
          .eq('id', escrowId)
          .single()
        
        if (!escrow || !canAccessEscrow(profile, escrow)) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 })
        }
      }
    }

    // Generate signed URL (15 minutes expiry)
    const { data, error } = await serviceClient.storage
      .from(bucket)
      .createSignedUrl(path, 900) // 15 minutes

    if (error) {
      console.error('Error creating signed URL:', error)
      return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
    }

    return NextResponse.json({ signedUrl: data.signedUrl })

  } catch (error) {
    console.error('Sign URL error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
  }
}
