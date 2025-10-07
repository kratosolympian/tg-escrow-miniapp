export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  createServerClientWithCookies,
  createServiceRoleClient,
} from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 },
      );
    }

    // First, authenticate using regular client
    const supabase = createServerClientWithCookies();

    // Sign in the user
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (!data.user) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 },
      );
    }

    // Use service client for profile check
    const serviceClient = createServiceRoleClient();

    // Check if user has admin role using service client
    const { data: profile, error: profileError } = await (serviceClient as any)
      .from("profiles")
      .select("role, email, full_name")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Admin profile not found" },
        { status: 404 },
      );
    }

    if (profile.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: profile.role,
        full_name: profile.full_name,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
