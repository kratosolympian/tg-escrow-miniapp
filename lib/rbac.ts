import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './supabaseClient'

export type Profile = Database['public']['Tables']['profiles']['Row']

export async function getProfile(supabase: SupabaseClient<Database>): Promise<Profile | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    return profile
  } catch (error) {
    console.error('Error getting profile:', error)
    return null
  }
}

export async function requireRole(
  supabase: SupabaseClient<Database>,
  requiredRole: 'buyer' | 'seller' | 'admin'
): Promise<Profile> {
  const profile = await getProfile(supabase)
  
  if (!profile) {
    throw new Error('Authentication required')
  }
  
  if (profile.role !== requiredRole && profile.role !== 'admin') {
    throw new Error(`${requiredRole} role required`)
  }
  
  return profile
}

export async function requireAuth(supabase: SupabaseClient<Database>): Promise<Profile> {
  const profile = await getProfile(supabase)
  
  if (!profile) {
    throw new Error('Authentication required')
  }
  
  return profile
}

export function isAdmin(profile: Profile): boolean {
  return profile.role === 'admin'
}

export function canAccessEscrow(
  profile: Profile,
  escrow: { seller_id: string; buyer_id: string | null }
): boolean {
  return (
    isAdmin(profile) ||
    profile.id === escrow.seller_id ||
    profile.id === escrow.buyer_id
  )
}
