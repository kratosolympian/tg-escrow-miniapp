export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabaseServer'
import { generateUUID, getFileExtension, isValidImageType } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const service = createServiceRoleClient()
    const form = await request.formData()
    const file = form.get('image') as File | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!isValidImageType(file.type)) return NextResponse.json({ error: 'Invalid image type' }, { status: 400 })
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'File too large' }, { status: 400 })

    const id = generateUUID()
    const ext = getFileExtension((file as any).name || 'upload')
    const path = `temp/${id}.${ext}`

    const { error } = await service.storage.from('product-images').upload(path, file, { upsert: false })
    if (error) {
      console.error('Temp upload error:', error)
      return NextResponse.json({ error: 'Failed to upload' }, { status: 500 })
    }

    // Create signed URL for preview (short-lived)
    const { data: signed, error: signErr } = await service.storage.from('product-images').createSignedUrl(path, 900)
    if (signErr) {
      console.warn('Signed URL error:', signErr)
    }

    return NextResponse.json({ path, signedUrl: signed?.signedUrl || null })
  } catch (err) {
    console.error('upload-temp error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
