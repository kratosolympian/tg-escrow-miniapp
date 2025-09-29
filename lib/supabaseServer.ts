import { NextRequest } from 'next/server.js';
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers.js';
import { createClient } from '@supabase/supabase-js'
import type { Database } from './supabaseClient'

// Create a Supabase client using the Authorization header (Bearer token) if present, else cookies
export function createServerClientWithAuthHeader(request?: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  let accessToken: string | undefined;
  if (request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.replace('Bearer ', '');
    }
  }
  if (accessToken) {
    return createClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  // Fallback to cookies (for SSR or legacy flows)
  return createServerClientWithCookies();
}

export function createServerClientWithCookies() {
  const cookieStore = cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

export function createServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
