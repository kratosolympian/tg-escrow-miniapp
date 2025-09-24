// RBAC utility for super admin check
const SUPER_ADMIN_EMAIL = 'ceo@kratos.ng'

export function isSuperAdmin(email: string): boolean {
  return email === SUPER_ADMIN_EMAIL
}
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './supabaseClient'

export type Profile = Database['public']['Tables']['profiles']['Row']

export async function getProfile(supabase: SupabaseClient<Database>): Promise<Profile | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile, error } = await (supabase as any)
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // If profile doesn't exist, create it
    if (error && error.code === 'PGRST116') {
  if (process.env.DEBUG) console.log('Profile not found, creating one for user:', user.id)
      const { data: newProfile, error: createError } = await (supabase as any)
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || '',
          role: 'seller'
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating profile:', createError)
        return null
      }

      return newProfile
    }

    if (error) {
      console.error('Error getting profile:', error)
      return null
    }

    return profile
  } catch (error) {
    console.error('Error getting profile:', error)
    return null
  }
}

export async function requireRole(
  supabase: SupabaseClient<Database>,
  requiredRole: 'buyer' | 'seller' | 'admin' | 'super_admin'
): Promise<Profile> {
  const profile = await getProfile(supabase)
  
  if (!profile) {
    throw new Error('Authentication required')
  }
  
  // super_admin should be treated as admin for permission checks
  const roleStr = String(profile.role)
  if (roleStr !== requiredRole && roleStr !== 'admin' && roleStr !== 'super_admin') {
    throw new Error(`${requiredRole} role required`)
  }
  
  return profile
}

export async function requireAuth(supabase: SupabaseClient<Database>): Promise<Profile> {
  console.log('requireAuth: Starting authentication check');

  const profile = await getProfile(supabase);

  if (!profile) {
    console.warn('requireAuth: Authentication failed, no profile found');
    console.log('requireAuth: Decoded token payload:', supabase.auth.getUser());
    throw new Error('Authentication required');
  }

  console.log('requireAuth: Authentication successful, profile:', profile);
  return profile;
}

export function isAdmin(profile: Profile): boolean {
  const roleVal = String(profile.role)
  return roleVal === 'admin' || roleVal === 'super_admin'
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
