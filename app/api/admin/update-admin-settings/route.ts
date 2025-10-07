export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  createServerClientWithCookies,
  createServiceRoleClient,
} from "@/lib/supabaseServer";
import { requireRole, requireAuth } from "@/lib/rbac";
import { z } from "zod";

const updateAdminSettingsSchema = z.object({
  bank_name: z.string().min(1).max(100),
  account_number: z.string().min(6).max(20),
  account_holder: z.string().min(1).max(100),
  service_fee: z.number().min(0).max(10000),
  // Only super admin can update platform settings
  scope: z.enum(["platform"]).default("platform"),
});

export async function POST(request: NextRequest) {
  if (request.method !== "POST") {
    return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
  }

  try {
    const supabase = createServerClientWithCookies();

    // Require authentication and super admin role
    const profile = await requireAuth(supabase);
    const roleStr = String(profile.role);
    if (roleStr !== "super_admin") {
      console.error(
        "[update-admin-settings] Forbidden: only super_admin may update admin settings",
      );
      return NextResponse.json(
        { error: "Only super admin may update admin settings" },
        { status: 403 },
      );
    }

    const body = await request.json();
    if (process.env.DEBUG)
      console.log("[update-admin-settings] request received");

    // Validate input
    const parsed = updateAdminSettingsSchema.safeParse(body);
    if (!parsed.success) {
      console.error(
        "[update-admin-settings] Validation failed:",
        parsed.error.format(),
      );
      return NextResponse.json(
        { error: "Invalid input data", details: parsed.error.format() },
        { status: 400 },
      );
    }

    const { bank_name, account_number, account_holder, service_fee } =
      parsed.data;

    // Use service role client for platform-level writes
    const service = createServiceRoleClient();

    // Insert new admin settings (latest row wins due to bigserial)
    const { data: inserted, error: insertError } = await (service as any)
      .from("admin_settings")
      .insert({
        bank_name,
        account_number,
        account_holder,
        service_fee,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[update-admin-settings] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to update admin settings" },
        { status: 500 },
      );
    }

    if (process.env.DEBUG)
      console.log("[update-admin-settings] Settings updated successfully");

    return NextResponse.json({
      success: true,
      message: "Admin settings updated successfully",
      data: inserted,
    });
  } catch (error) {
    console.error("[update-admin-settings] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies();

    // Require authentication and admin role
    const profile = await requireAuth(supabase);
    const roleStr = String(profile.role);
    if (!["admin", "super_admin"].includes(roleStr)) {
      console.error(
        "[get-admin-settings] Forbidden: only admins may view admin settings",
      );
      return NextResponse.json(
        { error: "Only admins may view admin settings" },
        { status: 403 },
      );
    }

    // Use service role client to bypass RLS
    const service = createServiceRoleClient();

    // Get the latest admin settings (highest ID)
    const { data: settings, error } = await (service as any)
      .from("admin_settings")
      .select("*")
      .order("id", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "no rows returned"
      console.error("[get-admin-settings] Query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch admin settings" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: settings || {
        bank_name: "",
        account_number: "",
        account_holder: "",
        service_fee: 300,
      },
    });
  } catch (error) {
    console.error("[get-admin-settings] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
