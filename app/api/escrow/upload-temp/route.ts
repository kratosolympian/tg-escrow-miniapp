export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithAuthHeader, createServiceRoleClient } from '@/lib/supabaseServer'
import { generateUUID, getFileExtension, isValidImageType } from '@/lib/utils'
import { z } from 'zod'

// Zod schema for file validation
const fileSchema = z.object({
  type: z.string().refine((val) => isValidImageType(val), {
    message: 'Invalid image type',
  }),
  size: z.number().max(5 * 1024 * 1024, { message: 'File too large' }),
})

/**
 * POST /api/escrow/upload-temp
 *
 * Handles secure upload of a temporary image file for an escrow transaction.
 * Steps:
 *   1. Authenticates the user
 *   2. Accepts a file (image) via multipart/form-data
 *   3. Validates file type and size
 *   4. Uploads the file to a temporary location in Supabase Storage
 *   5. Returns the storage path for later use
 *
 * Request: multipart/form-data with fields:
 *   - file: File (or 'image')
 *
 * Returns:
 *   200: { path: string }
 *   400: { error: string } (validation or file error)
 *   401: { error: string } (authentication)
 *   500: { error: string } (upload or server error)
 */
export async function POST(request: NextRequest) {
  try {
  const supabase = createServerClientWithAuthHeader(request)
    const serviceClient = createServiceRoleClient()

  const formData = await request.formData()
  // Accept both 'file' and 'image' as field names
  let file = formData.get('file') as File | null
  if (!file) file = formData.get('image') as File | null

  // Extract one-time token if present
  let token = formData.get('__one_time_token') as string
  if (!token) {
    const headerToken = request.headers.get('x-one-time-token') || null
    if (headerToken) token = headerToken
  }
  if (!token) {
    const authHeader = request.headers.get('authorization') || ''
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.slice(7).trim()
    }
  }

  let authenticatedUser = null

  if (token) {
    try {
      const { verifyAndConsumeSignedToken } = await import('@/lib/signedAuth')
      console.debug('Upload temp: one-time token present')
      const userId = await verifyAndConsumeSignedToken(token)
      console.debug('Upload temp: verifyAndConsumeSignedToken result ok=', !!userId)
      if (userId) {
        authenticatedUser = { id: userId }
      } else {
        console.warn('Upload temp: one-time token present but not valid/expired')
        // Don't return error yet - try session auth as fallback
      }
    } catch (e) {
      console.warn('Error importing/verifying one-time token')
    }
  }

  // If no valid one-time token, try session authentication
  if (!authenticatedUser) {
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    authenticatedUser = user
  }

  if (!authenticatedUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // Validate file with Zod
  const parseResult = fileSchema.safeParse({ type: file.type, size: file.size })
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.errors[0].message }, { status: 400 })
  }

    const id = generateUUID()
    const ext = getFileExtension((file as any).name || 'jpg')
    const fileName = `${id}.${ext}`
    const path = `temp/${authenticatedUser.id}/${fileName}`

    const { error: uploadError } = await serviceClient.storage.from('product-images').upload(path, file, { upsert: true })
    if (uploadError) {
      console.error('Temp upload error:', uploadError)
      return NextResponse.json({ error: 'Upload failed', details: uploadError.message }, { status: 500 })
    }

    return NextResponse.json({ path })
  } catch (err) {
    console.error('Temp upload exception:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
