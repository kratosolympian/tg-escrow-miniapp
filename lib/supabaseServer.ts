import { NextRequest } from 'next/server.js';
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers.js';
import { createClient } from '@supabase/supabase-js'
import type { Database } from './supabaseClient'

// Create a Supabase client using the Authorization header (Bearer token) if present, else cookies
export function createServerClientWithAuthHeader(request?: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hbphcrwgmxapqrecmunh.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhicGhjcndnbXhhcHFyZWNtdW5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMjk2MTcsImV4cCI6MjA3MjkwNTYxN30.Cy033qSbGGHTqg8q66_523T1q1AmaQdT-7MPooIiCCU';
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
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hbphcrwgmxapqrecmunh.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhicGhjcndnbXhhcHFyZWNtdW5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMjk2MTcsImV4cCI6MjA3MjkwNTYxN30.Cy033qSbGGHTqg8q66_523T1q1AmaQdT-7MPooIiCCU',
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
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hbphcrwgmxapqrecmunh.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhicGhjcndnbXhhcHFyZWNtdW5oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzMyOTYxNywiZXhwIjoyMDcyOTA1NjE3fQ.MdmItnBTJ7TkzymtDgY8LM3FFJIg_1AMFng5bI3e6Ao',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
