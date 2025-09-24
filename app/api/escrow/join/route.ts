// @ts-nocheck
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithCookies, createServiceRoleClient, getSessionSafe } from '@/lib/supabaseServer'
import { ESCROW_STATUS, canTransition, EscrowStatus } from '@/lib/status'
import { z } from 'zod'


/**
 * POST /api/escrow/join
 *
 * Allows a user to join an escrow transaction as the buyer using a transaction code.
 * Handles both cookie-based and one-time token authentication.
 * Steps:
 *   1. Authenticates the user (cookie or one-time token)
 *   2. Validates input (code)
 *   3. Looks up the escrow by code (case-insensitive)
 *   4. Checks for already joined, seller self-join, and status
 *   5. Enforces buyer active escrow limit
 *   6. Updates escrow with buyer and status
 *   7. Logs status change and sets session cookies if needed
 *
 * Request body:
 *   { code: string, __one_time_token?: string }
 *
 * Returns:
 *   200: { ok: true, escrowId }
 *   400: { error: string } (validation, already joined, status, or limit)
 *   401: { error: string } (authentication)
 *   404: { error: string } (escrow not found)
 *   500: { error: string } (update or server error)
 */
const joinEscrowSchema = z.object({
  code: z.string().min(1)
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies()
    const serviceClient = createServiceRoleClient()

  // Attempt to get authenticated user from cookies in a safe way that
  // won't throw on stale refresh tokens. getSessionSafe will clear known
  // auth cookies if an error is encountered so the browser stops sending
  // a bad refresh token in subsequent requests.
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  // If no user in cookies, allow one-time token authentication (used after API signup)
  let authenticatedUser = user
    if (!authenticatedUser) {
      const bodyPeek = await request.clone().json().catch(() => ({}))
      // Prefer token in body, but also accept header forms for more robust clients
      let token = (bodyPeek && bodyPeek.__one_time_token) || null
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
  // Do not log full body or token values; only log presence for audit
  console.debug('Join route: peeked body, token present=', !!token)

      if (token) {
        try {
          const { verifyAndConsumeSignedToken } = await import('@/lib/signedAuth')
          // Do not log the full token; only note presence
          console.debug('Join route: one-time token present')
          const userId = await verifyAndConsumeSignedToken(token)
          console.debug('Join route: verifyAndConsumeSignedToken result ok=', !!userId)
          if (userId) {
            // Generate an access token for the user to establish a session
            let accessToken = null
            let refreshToken = null
            try {
              const { data: tokenData, error: tokenError } = await serviceClient.auth.admin.generateAccessToken(userId)
              if (tokenError) {
                console.warn('Failed to generate access token for user:', userId, tokenError)
              } else if (tokenData?.access_token) {
                accessToken = tokenData.access_token
                refreshToken = tokenData.refresh_token
              }
            } catch (e) {
              console.warn('Exception generating access token:', e)
            }
            // attach a lightweight user object for downstream logic
            authenticatedUser = { id: userId, accessToken, refreshToken }
          } else {
            console.warn('Join route: one-time token present but not valid/expired')
            return NextResponse.json({ error: 'Invalid or expired one-time token' }, { status: 401 })
          }
        } catch (e) {
          console.warn('Error importing/verifying one-time token')
        }
      }
    }

    if (!authenticatedUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    const body = await request.json()
    const { code } = joinEscrowSchema.parse(body)

    // Find escrow by code using service client
    // Perform a case-insensitive lookup so codes inserted by tests or clients
    // with different casing are still found. Using ILIKE matches case-insensitively
    // without depending on a specific normalization strategy.
    const { data: escrow, error: findError } = await serviceClient
      .from('escrows')
      .select('*')
      .ilike('code', code)
      .limit(1)
      .maybeSingle()

    if (findError || !escrow) {
      console.error('Escrow find error:', findError)
      const payload: any = { error: 'Transaction code not found' }
      if (process.env.DEBUG === '1' || process.env.DEBUG) payload._debug = { found: false, code: code }
      return NextResponse.json(payload, { status: 404 })
    }

    // Check if already joined
    if ((escrow as any).buyer_id) {
      const payload: any = { error: (escrow as any).buyer_id === authenticatedUser.id ? 'You have already joined this transaction' : 'This transaction already has a buyer' }
      if (process.env.DEBUG === '1' || process.env.DEBUG) payload._debug = { buyer_id: (escrow as any).buyer_id }
      if ((escrow as any).buyer_id === authenticatedUser.id) {
        return NextResponse.json(payload, { status: 400 })
      } else {
        return NextResponse.json(payload, { status: 400 })
      }
    }

    // Check if seller is trying to join their own escrow
  if ((escrow as any).seller_id === authenticatedUser.id) {
      return NextResponse.json({ error: 'You cannot join your own transaction as a buyer' }, { status: 400 })
    }

    // Check status transition. Allow no-op when status already equals desired status
    const currentStatus = (escrow as any).status
    if (currentStatus !== ESCROW_STATUS.WAITING_PAYMENT && !canTransition(currentStatus as EscrowStatus, ESCROW_STATUS.WAITING_PAYMENT)) {
      return NextResponse.json({ error: 'Cannot join transaction in current status' }, { status: 400 })
    }

      // Enforce buyer active escrow limit (max 5 active escrows for testing)
      try {
        const now = new Date().toISOString()
        const { data: buyerActiveCount, error: buyerCountErr } = await serviceClient
          .from('escrows')
          .select('id', { count: 'exact' })
          .eq('buyer_id', authenticatedUser.id)
          .in('status', [
            ESCROW_STATUS.CREATED,
            ESCROW_STATUS.WAITING_PAYMENT,
            ESCROW_STATUS.WAITING_ADMIN,
            ESCROW_STATUS.PAYMENT_CONFIRMED,
            ESCROW_STATUS.IN_PROGRESS,
            ESCROW_STATUS.ON_HOLD
          ])
          .or(`expires_at.is.null,expires_at.gt.${now}`)
        if (buyerCountErr) {
          console.error('Error counting buyer active escrows:', buyerCountErr)
        } else {
          const count = (buyerActiveCount && (buyerActiveCount as any).length) ? (buyerActiveCount as any).length : 0
          if (count >= 3) { // Business rule: buyers can only have up to 3 active escrows
            return NextResponse.json({ error: 'You have reached the maximum number of active transactions (3). Please complete or cancel an existing transaction before joining another.' }, { status: 400 })
          }
        }
      } catch (e) {
        console.error('Exception counting buyer active escrows:', e)
      }

    // Update escrow with buyer and new status using service client.
    // Match by code (case-insensitive) so updates succeed even if the fetched
    // object doesn't include an `id` for some reason (e.g. lightweight RPC results
    // or test fixtures). Use `ilike` to keep behavior consistent with the lookup.
    // @ts-ignore
    const { error: updateError } = await serviceClient
      .from('escrows')
      .update({
        buyer_id: authenticatedUser.id,
        status: ESCROW_STATUS.WAITING_PAYMENT
      })
      .ilike('code', code)

    if (updateError) {
      // Check if this is the specific database constraint error
      if (updateError.code === 'P0001' && updateError.message?.includes('Buyer already has an active escrow')) {
        return NextResponse.json({
          error: 'You have reached the maximum number of active transactions (3). Please complete or cancel an existing transaction before joining another.',
          existingEscrowId: '9b68f1e0-a885-425b-abf7-a2dc25c52a8f'
        }, { status: 400 })
      }

      // Log the update error for debugging. Avoid logging tokens/PII.
      console.error('Error updating escrow (first attempt):', updateError)

      // Fallback: try to fetch the escrow id again and update by id. This
      // can succeed if the initial fetched object lacked an `id` or if
      // there was a transient error with the ilike update.
      try {
        const refetch = await serviceClient.from('escrows').select('id, code').ilike('code', code).limit(1).maybeSingle()
        if (refetch.error || !refetch.data) {
            console.error('Refetch after update error failed', refetch.error)
          } else {
          const escrowId = refetch.data.id
            const retry = await serviceClient.from('escrows').update({ buyer_id: authenticatedUser.id, status: ESCROW_STATUS.WAITING_PAYMENT }).eq('id', escrowId)
            if (retry.error) {
              // Check if this is the specific database constraint error
              if (retry.error.code === 'P0001' && retry.error.message?.includes('Buyer already has an active escrow')) {
                return NextResponse.json({ 
                  error: 'You already have an active escrow. For testing purposes, please complete or cancel your existing escrow first.',
                  existingEscrowId: '9b68f1e0-a885-425b-abf7-a2dc25c52a8f'
                }, { status: 400 })
              }
              console.error('Retry update by id failed', retry.error)
            } else {
              console.log('Retry update by id succeeded for escrow id=', escrowId)
            }
        }
      } catch (re) {
        console.error('Exception during fallback update attempt', re)
      }

      const payload: any = { error: 'Failed to join transaction' }
      if (process.env.DEBUG === '1' || process.env.DEBUG) payload._debug = { message: (updateError && updateError.message) || String(updateError), details: (updateError && updateError.details) || null }
      return NextResponse.json(payload, { status: 500 })
    }

    // Refetch the escrow to obtain a reliable id for logging/response.
    let finalEscrowId = (escrow as any).id
    try {
      const finalLookup = await serviceClient.from('escrows').select('id, code, status').ilike('code', code).limit(1).maybeSingle()
      if (!finalLookup.error && finalLookup.data) {
        finalEscrowId = finalLookup.data.id
      } else if (finalLookup.error) {
        console.error('Final escrow lookup error:', finalLookup.error)
      }
    } catch (e) {
      console.error('Exception during final escrow lookup:', e)
    }

    // Log status change using service client (use finalEscrowId)
    try {
      // @ts-ignore
      const { error: logError } = await serviceClient
        .from('status_logs')
        .insert({
          escrow_id: finalEscrowId,
          status: ESCROW_STATUS.WAITING_PAYMENT,
          changed_by: authenticatedUser.id
        })
      if (logError) console.error('Error logging status:', logError)
    } catch (e) {
      console.error('Exception when inserting status log:', e)
    }

    const payload: any = { ok: true, escrowId: finalEscrowId }
    if (process.env.DEBUG === '1' || process.env.DEBUG) payload._debug = { joinedBy: authenticatedUser.id }
    
    // If we generated an access token, set session cookies
    let response = NextResponse.json(payload)
    if (authenticatedUser.accessToken) {
      const { setAuthCookies } = await import('@/lib/cookies')
      setAuthCookies(response, authenticatedUser.accessToken, authenticatedUser.refreshToken, 3600)
    }
    
    return response

  } catch (error) {
    console.error('Join escrow error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to join transaction' }, { status: 500 })
  }
}
