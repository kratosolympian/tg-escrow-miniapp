// Temporary fix for Supabase TypeScript issues during deployment
// This file provides helper functions to bypass strict typing

export function anySupabaseQuery(query: any): any {
  return query as any;
}

export function anySupabaseResult(result: any): any {
  return result as any;
}
