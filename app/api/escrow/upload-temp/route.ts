export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { generateUUID, getFileExtension, isValidImageType } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    const serviceClient = createServiceRoleClient()

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('image') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    if (!isValidImageType(file.type)) {
      return NextResponse.json({ error: 'Invalid image type' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 })
    }

    const id = generateUUID()
    const ext = getFileExtension((file as any).name || 'jpg')
    const fileName = `${id}.${ext}`
    const path = `temp/${user.id}/${fileName}`

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
