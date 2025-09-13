import { NextResponse } from 'next/server'

export async function POST() {
  // When a stale redirect or client replay POSTs to the dashboard page,
  // convert it into a 303 See Other so the client will follow with a GET.
  // This is a defensive, low-risk measure to avoid 405 responses for POST.
  return NextResponse.redirect('/admin/dashboard', { status: 303 })
}
