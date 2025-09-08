import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient } from '@/lib/supabaseServer'
import { requireAuth } from '@/lib/rbac'
import { generateUUID, getFileExtension, isValidReceiptType } from '@/lib/utils'
import { ESCROW_STATUS, canTransition } from '@/lib/status'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    const serviceClient = createServiceRoleClient()
    
    // Require authentication
    const profile = await requireAuth(supabase)
    
    const formData = await request.formData()
    const escrowId = formData.get('escrowId') as string
    const receiptFile = formData.get('file') as File

    if (!escrowId || !receiptFile) {
      return NextResponse.json({ error: 'Escrow ID and file are required' }, { status: 400 })
    }

    // Get escrow
    const { data: escrow, error: escrowError } = await supabase
      .from('escrows')
      .select('*')
      .eq('id', escrowId)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Check if user is the buyer
    if (escrow.buyer_id !== profile.id) {
      return NextResponse.json({ error: 'Only the buyer can upload receipts' }, { status: 403 })
    }

    // Validate file
    if (!isValidReceiptType(receiptFile.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only JPEG, PNG, WebP, and PDF are allowed.' 
      }, { status: 400 })
    }

    if (receiptFile.size > 10 * 1024 * 1024) { // 10MB limit
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 })
    }

    // Generate unique filename
    const fileId = generateUUID()
    const extension = getFileExtension(receiptFile.name)
    const fileName = `${fileId}.${extension}`
    const filePath = `${escrow.id}/${profile.id}/${fileName}`

    // Upload to storage using service client
    const { error: uploadError } = await serviceClient.storage
      .from('receipts')
      .upload(filePath, receiptFile, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Error uploading receipt:', uploadError)
      return NextResponse.json({ error: 'Failed to upload receipt' }, { status: 500 })
    }

    // Insert receipt record
    const { error: receiptError } = await supabase
      .from('receipts')
      .insert({
        escrow_id: escrow.id,
        uploaded_by: profile.id,
        file_path: filePath
      })

    if (receiptError) {
      console.error('Error creating receipt record:', receiptError)
      
      // Clean up uploaded file
      await serviceClient.storage
        .from('receipts')
        .remove([filePath])
      
      return NextResponse.json({ error: 'Failed to save receipt' }, { status: 500 })
    }

    // Update escrow status to waiting_admin if transitioning from waiting_payment
    if (escrow.status === ESCROW_STATUS.WAITING_PAYMENT && 
        canTransition(escrow.status, ESCROW_STATUS.WAITING_ADMIN)) {
      
      await supabase
        .from('escrows')
        .update({ status: ESCROW_STATUS.WAITING_ADMIN })
        .eq('id', escrow.id)

      // Log status change
      await supabase
        .from('status_logs')
        .insert({
          escrow_id: escrow.id,
          status: ESCROW_STATUS.WAITING_ADMIN,
          changed_by: profile.id
        })
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('Upload receipt error:', error)
    return NextResponse.json({ error: 'Failed to upload receipt' }, { status: 500 })
  }
}
