import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName } = await request.json();

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: "Email, password, and full name required" },
        { status: 400 },
      );
    }

    // Use service client for admin operations
    const serviceClient = createServiceRoleClient();

    // Create user in auth system
    const { data, error } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.user) {
      return NextResponse.json(
        { error: "User creation failed" },
        { status: 400 },
      );
    }

    // Create admin profile
    const { data: profile, error: profileError } = await (serviceClient as any)
      .from("profiles")
      .upsert({
        id: data.user.id,
        email: email,
        full_name: fullName,
        role: "admin",
      })
      .select();

    if (profileError) {
      console.error("Profile creation error:", profileError);
      return NextResponse.json(
        { error: "Profile creation failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Admin user created successfully",
      user: {
        id: data.user.id,
        email: data.user.email,
        profile: profile,
      },
    });
  } catch (error) {
    console.error("Admin setup error:", error);
    return NextResponse.json({ error: "Setup failed" }, { status: 500 });
  }
}
