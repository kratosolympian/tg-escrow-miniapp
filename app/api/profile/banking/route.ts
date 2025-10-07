import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServerClientWithAuthHeader } from "@/lib/supabaseServer";
import { z } from "zod";

// Zod schema for banking info
const bankingSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  phone_number: z
    .string()
    .regex(
      /^(\+234|234|0)[789]\d{9}$/,
      "Please enter a valid Nigerian phone number",
    ),
  bank_name: z.string().min(1, "Bank name is required"),
  account_number: z
    .string()
    .regex(/^\d{10}$/, "Account number must be exactly 10 digits"),
  account_holder_name: z.string().min(1, "Account holder name is required"),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithAuthHeader(request) as any;

    // Get current user (authenticated against Supabase Auth server)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = bankingSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0].message },
        { status: 400 },
      );
    }
    const {
      full_name,
      phone_number,
      bank_name,
      account_number,
      account_holder_name,
    } = parseResult.data;
    // Update profile with banking information
    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name,
        phone_number,
        bank_name,
        account_number,
        account_holder_name,
        profile_completed: true,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Profile update error:", error);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: "Profile updated successfully",
      profile: data,
    });
  } catch (error) {
    console.error("Profile completion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Get current profile information
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClientWithAuthHeader(request);

    // Check for test mode (development only)
    const { searchParams } = new URL(request.url);
    const testMode =
      searchParams.get("test") === "true" &&
      process.env.NODE_ENV === "development";

    // Get current user (authenticated against Supabase Auth server)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if ((userError || !user) && !testMode) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Test mode response
    if (testMode) {
      return NextResponse.json({
        profile: {
          id: "test-user-id",
          email: "test@example.com",
          full_name: "Test User",
          phone_number: "+2341234567890",
          bank_name: "Test Bank",
          account_number: "1234567890",
          account_holder_name: "Test User",
          profile_completed: true,
          test_mode: true,
        },
      });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user!.id)
      .single();

    if (error) {
      console.error("Profile fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 },
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
