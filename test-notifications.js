#!/usr/bin/env node

/**
 * Test script for Telegram notifications
 * This script tests the notification functions we implemented
 * Run with: node test-notifications.js
 */

import { createServiceRoleClient } from './lib/supabaseServer.js'
import { sendEscrowStatusNotification, sendChatMessageNotification } from './lib/telegram.js'

async function testNotifications() {
  console.log('🧪 Testing Telegram Notification Functions\n')

  try {
    // Initialize Supabase client
    const serviceClient = createServiceRoleClient()

    // Test 1: Check if we have any escrows with telegram IDs
    console.log('1️⃣ Checking for escrows with Telegram IDs...')
    const { data: escrows, error } = await serviceClient
      .from('escrows')
      .select(`
        id,
        code,
        status,
        seller:profiles!seller_id(telegram_id, full_name),
        buyer:profiles!buyer_id(telegram_id, full_name)
      `)
      .limit(5)

    if (error) {
      console.error('❌ Error fetching escrows:', error)
      return
    }

    console.log(`Found ${escrows.length} escrows`)
    escrows.forEach((escrow, i) => {
      console.log(`  ${i+1}. ${escrow.code} - Status: ${escrow.status}`)
      console.log(`     Seller: ${escrow.seller?.full_name || 'N/A'} (TG: ${escrow.seller?.telegram_id || 'N/A'})`)
      console.log(`     Buyer: ${escrow.buyer?.full_name || 'N/A'} (TG: ${escrow.buyer?.telegram_id || 'N/A'})`)
    })

    // Test 2: Try to send a test notification if we have an escrow with telegram IDs
    const testEscrow = escrows.find(e => e.seller?.telegram_id || e.buyer?.telegram_id)
    if (testEscrow) {
      console.log('\n2️⃣ Testing status change notification...')
      console.log(`Using escrow: ${testEscrow.code}`)

      try {
        await sendEscrowStatusNotification(
          testEscrow.id,
          testEscrow.status,
          'testing', // This will show as "testing" in the message
          serviceClient
        )
        console.log('✅ Status notification sent successfully!')
      } catch (err) {
        console.error('❌ Status notification failed:', err.message)
      }

      // Test 3: Test chat notification
      console.log('\n3️⃣ Testing chat message notification...')
      try {
        await sendChatMessageNotification(
          testEscrow.id,
          testEscrow.seller?.id || testEscrow.buyer?.id,
          'This is a test chat message from our notification system!',
          serviceClient
        )
        console.log('✅ Chat notification sent successfully!')
      } catch (err) {
        console.error('❌ Chat notification failed:', err.message)
      }
    } else {
      console.log('\n⚠️ No escrows found with Telegram IDs for testing')
      console.log('To test notifications, you need users with telegram_id in their profiles')
    }

    console.log('\n🎉 Notification testing complete!')

  } catch (error) {
    console.error('❌ Test script error:', error)
  }
}

// Run the test
testNotifications()