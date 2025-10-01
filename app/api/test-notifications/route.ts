import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabaseServer'
import { sendEscrowStatusNotification, sendChatMessageNotification } from '@/lib/telegram'

export async function GET(request: NextRequest) {
  try {
    const serviceClient = createServiceRoleClient()

    // Get first escrow that has both seller and buyer with telegram IDs (for best testing)
    let { data: escrows, error } = await serviceClient
      .from('escrows')
      .select(`
        id,
        code,
        status,
        seller:profiles!seller_id(id, telegram_id, full_name, email),
        buyer:profiles!buyer_id(id, telegram_id, full_name, email),
        assigned_admin_id
      `)
      .not('buyer_id', 'is', null) // Must have a buyer
      .limit(5) // Get a few options

    if (error || !escrows || escrows.length === 0) {
      // Fallback to any escrow
      const { data: fallbackEscrows, error: fallbackError } = await serviceClient
        .from('escrows')
        .select(`
          id,
          code,
          status,
          seller:profiles!seller_id(id, telegram_id, full_name, email),
          buyer:profiles!buyer_id(id, telegram_id, full_name, email),
          assigned_admin_id
        `)
        .limit(1)

      if (fallbackError || !fallbackEscrows || fallbackEscrows.length === 0) {
        return NextResponse.json({
          error: 'No escrows found for testing',
          details: fallbackError?.message
        }, { status: 404 })
      }

      escrows = fallbackEscrows
    }

    // Find the best escrow for testing (one with most recipients)
    let testEscrow = escrows[0]
    let maxRecipients = 0

    for (const escrow of escrows) {
      let recipientCount = 0
      if (escrow.seller?.telegram_id) recipientCount++
      if (escrow.buyer?.telegram_id) recipientCount++

      // Count ALL admins with telegram_id
      const { data: allAdmins } = await serviceClient
        .from('profiles')
        .select('telegram_id')
        .in('role', ['admin', 'super_admin'])
        .not('telegram_id', 'is', null)
      recipientCount += allAdmins?.length || 0

      if (recipientCount > maxRecipients) {
        maxRecipients = recipientCount
        testEscrow = escrow
      }
    }

    // Get ALL admins for analysis
    const { data: allAdmins } = await serviceClient
      .from('profiles')
      .select('id, telegram_id, full_name, role')
      .in('role', ['admin', 'super_admin'])

    // Analyze who would receive notifications
    const recipients = {
      seller: {
        name: testEscrow.seller?.full_name || 'Unknown',
        telegram_id: testEscrow.seller?.telegram_id,
        email: testEscrow.seller?.email,
        will_receive_telegram: !!testEscrow.seller?.telegram_id,
        will_receive_email: !!testEscrow.seller?.email
      },
      buyer: {
        name: testEscrow.buyer?.full_name || 'No buyer joined yet',
        telegram_id: testEscrow.buyer?.telegram_id,
        email: testEscrow.buyer?.email,
        will_receive_telegram: !!testEscrow.buyer?.telegram_id,
        will_receive_email: !!testEscrow.buyer?.email
      },
      admins: (allAdmins || []).map(admin => ({
        name: admin.full_name || 'Unknown Admin',
        telegram_id: admin.telegram_id,
        email: admin.email,
        will_receive_telegram: !!admin.telegram_id,
        will_receive_email: !!admin.email
      }))
    }

    const totalRecipients = (recipients.seller.will_receive_telegram || recipients.seller.will_receive_email ? 1 : 0) +
                           (recipients.buyer.will_receive_telegram || recipients.buyer.will_receive_email ? 1 : 0) +
                           recipients.admins.filter(admin => admin.will_receive_telegram || admin.will_receive_email).length

    if (totalRecipients === 0) {
      return NextResponse.json({
        message: 'No users with Telegram IDs found for this escrow',
        escrow: {
          id: testEscrow.id,
          code: testEscrow.code,
          status: testEscrow.status
        },
        recipients,
        instructions: [
          'Users need telegram_id in their profiles to receive notifications',
          'Use the Telegram auth flow to associate Telegram IDs with user accounts',
          'Or manually set telegram_id in the profiles table for testing'
        ]
      })
    }

    // Test status notification
    console.log('🧪 Testing status notification for escrow:', testEscrow.code)
    await sendEscrowStatusNotification(
      testEscrow.id,
      testEscrow.status,
      'testing_status_change',
      serviceClient
    )

    // Test chat notification
    console.log('🧪 Testing chat notification for escrow:', testEscrow.code)
    const senderId = testEscrow.seller?.id || testEscrow.buyer?.id
    if (senderId) {
      await sendChatMessageNotification(
        testEscrow.id,
        senderId,
        '🧪 This is a test notification from the notification testing endpoint!',
        serviceClient
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Telegram notifications sent successfully!',
      testResults: {
        escrowCode: testEscrow.code,
        status: testEscrow.status,
        recipients,
        notificationsSent: totalRecipients,
        statusNotification: '✅ Attempted (Telegram + Email)',
        chatNotification: '✅ Attempted (Telegram only - preserves email quota)',
        expectedRecipients: [
          ...((recipients.seller.will_receive_telegram || recipients.seller.will_receive_email) ? [`${recipients.seller.name} (seller)`] : []),
          ...((recipients.buyer.will_receive_telegram || recipients.buyer.will_receive_email) ? [`${recipients.buyer.name} (buyer)`] : []),
          ...recipients.admins.filter(admin => admin.will_receive_telegram || admin.will_receive_email).map(admin => `${admin.name} (admin)`)
        ]
      },
      note: 'Check your Telegram for notifications! Status changes send both Telegram + Email, while chat messages send Telegram only (to preserve email quota). Users with telegram_id will receive Telegram messages, and users with email addresses will receive emails for status changes only.'
    })

  } catch (error) {
    console.error('Test notification error:', error)
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}