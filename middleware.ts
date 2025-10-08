import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  createServerClientWithCookies,
  createServiceRoleClient,
} from "./lib/supabaseServer";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  // Create a Supabase client configured to use Next's cookie adapter
  const supabase = createServerClientWithCookies();

  // Get user (do not log full user object)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  const userId = user?.id;

  // Get the current pathname
  const { pathname } = request.nextUrl;

  // Define public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/register',
    '/admin/login'
  ];

  // Define protected route patterns
  const protectedRoutePatterns = [
    /^\/admin\/(?!login).*/,  // All admin routes except login
    /^\/buyer.*/,             // All buyer routes
    /^\/seller.*/,            // All seller routes
    /^\/settings.*/,          // All settings routes
    /^\/profile.*/,           // All profile routes
  ];

  // Check if current route is public
  const isPublicRoute = publicRoutes.includes(pathname);

  // Check if current route is protected
  const isProtectedRoute = protectedRoutePatterns.some(pattern => pattern.test(pathname));

  // If user is authenticated
  if (user) {
    // If accessing public routes while authenticated, redirect to appropriate dashboard
    if (isPublicRoute) {
      try {
        // Fetch user profile to determine role
        const serviceClient = createServiceRoleClient();
        const { data: profile, error: profileError } = await (serviceClient as any)
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .single();

        if (profileError) {
          console.error('Middleware profile fetch error:', profileError);
          // Default to buyer if profile fetch fails
          return NextResponse.redirect(new URL('/buyer', request.url));
        }

        // Redirect based on user role
        switch (profile.role) {
          case 'admin':
          case 'super_admin':
            return NextResponse.redirect(new URL('/admin/dashboard', request.url));
          case 'seller':
            return NextResponse.redirect(new URL('/seller', request.url));
          case 'buyer':
          default:
            return NextResponse.redirect(new URL('/buyer', request.url));
        }
      } catch (profileError) {
        console.error('Middleware profile fetch exception:', profileError);
        // Default to buyer dashboard on error
        return NextResponse.redirect(new URL('/buyer', request.url));
      }
    }

    // Protect admin routes - check if user is admin
    if (pathname.startsWith("/admin") &&
        !pathname.startsWith("/admin/login") &&
        !pathname.startsWith("/admin/test") &&
        !pathname.startsWith("/admin/init-admin") &&
        !pathname.startsWith("/admin/check-access")) {

      const serviceClient = createServiceRoleClient();
      const { data: profile, error: profileError } = await (serviceClient as any)
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      // Allow both regular admins and super admins
      const role = profile?.role;
      if (
        profileError ||
        !profile ||
        (role !== "admin" && role !== "super_admin")
      ) {
        return NextResponse.redirect(new URL("/admin/login", request.url));
      }
    }

    return response;
  }

  // If user is not authenticated
  else {
    // If accessing protected routes while not authenticated, redirect to home
    if (isProtectedRoute) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Allow access to public routes
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
