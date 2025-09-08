import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { requireAuth } from '@/lib/rbac'
import { shortCode, generateUUID, getFileExtension, isValidImageType } from '@/lib/utils'
import { ESCROW_STATUS } from '@/lib/status'
import { z } from 'zod'

const createEscrowSchema = z.object({
  description: z.string().min(1).max(1000),
  price: z.number().positive().max(1000000)
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    const serviceClient = createServiceRoleClient()
    
    // For development/testing - create a test user when no auth is available
    let profile
    try {
      profile = await requireAuth(supabase)
    } catch (authError) {
      // Check if we're in development mode and create a test user
      const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'preview'
      
      if (isDev) {
        // Use a consistent test user ID
        const testUserId = 'test-seller-dev'
        
        // Try to get existing test profile or create one
        let { data: existingProfile } = await (serviceClient as any)
          .from('profiles')
          .select('*')
          .eq('id', testUserId)
          .single()
        
        if (!existingProfile) {
          const { data: newProfile, error: createError } = await (serviceClient as any)
            .from('profiles')
            .insert({
              id: testUserId,
              email: 'test-seller@example.com',
              role: 'seller',
              telegram_id: 123456789,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single()
          
          if (createError) {
            console.error('Error creating test profile:', createError)
            return NextResponse.json({ error: 'Authentication required. Please access through Telegram.' }, { status: 401 })
          }
          
          existingProfile = newProfile
        }
        
        profile = existingProfile
      } else {
        return NextResponse.json({ error: 'Authentication required. Please access through Telegram.' }, { status: 401 })
      }
    }
    
    const formData = await request.formData()
    const description = formData.get('description') as string
    const price = parseFloat(formData.get('price') as string)
    const imageFile = formData.get('image') as File | null

    // Validate input
    const { description: validDescription, price: validPrice } = createEscrowSchema.parse({
      description,
      price
    })

    let productImageUrl: string | null = null

    // Handle image upload if provided
    if (imageFile && imageFile.size > 0) {
      if (!isValidImageType(imageFile.type)) {
        return NextResponse.json({ error: 'Invalid image type. Only JPEG, PNG, and WebP are allowed.' }, { status: 400 })
      }

      if (imageFile.size > 5 * 1024 * 1024) { // 5MB limit
        return NextResponse.json({ error: 'Image file too large. Maximum size is 5MB.' }, { status: 400 })
      }

      // Generate unique filename
      const fileId = generateUUID()
      const extension = getFileExtension(imageFile.name)
      const fileName = `${fileId}.${extension}`
      const filePath = `${profile.id}/${fileName}`

      // Upload to storage using service client
      const { error: uploadError } = await serviceClient.storage
        .from('product-images')
        .upload(filePath, imageFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Error uploading image:', uploadError)
        return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
      }

      productImageUrl = filePath
    }

    // Generate unique transaction code
    let code: string
    let codeExists = true
    
    // Keep generating until we get a unique code
    while (codeExists) {
      code = shortCode()
      const { data: existing } = await (supabase as any)
        .from('escrows')
        .select('id')
        .eq('code', code)
        .single()
      
      codeExists = !!existing
    }

    // Create escrow
    const { data: escrow, error: escrowError } = await (supabase as any)
      .from('escrows')
      .insert({
        code: code!,
        seller_id: profile.id,
        description: validDescription,
        price: validPrice,
        admin_fee: 300,
        product_image_url: productImageUrl,
        status: ESCROW_STATUS.CREATED
      })
      .select()
      .single()

    if (escrowError) {
      console.error('Error creating escrow:', escrowError)
      return NextResponse.json({ error: 'Failed to create escrow' }, { status: 500 })
    }

    // Log status change
    await (supabase as any)
      .from('status_logs')
      .insert({
        escrow_id: (escrow as any).id,
        status: ESCROW_STATUS.CREATED,
        changed_by: profile.id
      })

    return NextResponse.json({
      id: (escrow as any).id,
      code: (escrow as any).code
    })

  } catch (error) {
    console.error('Create escrow error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create escrow' }, { status: 500 })
  }
}
