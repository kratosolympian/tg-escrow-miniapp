import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    const serviceClient = createServiceRoleClient()

    // Get all admin profiles
    const { data: allAdmins, error: allError } = await serviceClient
      .from('profiles')
      .select('id, full_name, role, telegram_id')
      .in('role', ['admin', 'super_admin'])

    if (allError) {
      return NextResponse.json({ error: 'Failed to fetch admin profiles', details: allError }, { status: 500 })
    }

    // Filter to those without telegram_id (null or empty string)
    const adminProfiles = allAdmins.filter(profile => !profile.telegram_id || profile.telegram_id === '')

    if (adminProfiles.length === 0) {
      return NextResponse.json({
        message: 'All admin profiles already have Telegram IDs set',
        profiles: []
      })
    }

    // Assign test Telegram IDs to admins
    const adminTestIds = [
      '111111111', // Admin Test ID 1
      '222222222', // Admin Test ID 2
      '333333333', // Admin Test ID 3
    ]

    const results = []

    for (let i = 0; i < Math.min(adminProfiles.length, adminTestIds.length); i++) {
      const profile = adminProfiles[i]
      const testId = adminTestIds[i]

      const { error: updateError } = await serviceClient
        .from('profiles')
        .update({
          telegram_id: testId,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id)

      if (updateError) {
        results.push({
          profile: profile.full_name,
          role: profile.role,
          telegram_id: testId,
          success: false,
          error: updateError.message
        })
      } else {
        results.push({
          profile: profile.full_name,
          role: profile.role,
          telegram_id: testId,
          success: true
        })
      }
    }

    return NextResponse.json({
      message: `Set up Telegram IDs for ${results.filter(r => r.success).length} admin profiles`,
      results,
      instructions: [
        'All admins should now receive Telegram notifications',
        'Test notifications at: /api/test-notifications',
        'Trigger real status changes to see notifications in action'
      ]
    })

  } catch (error) {
    console.error('Setup admin telegram error:', error)
    return NextResponse.json({
      error: 'Setup failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}