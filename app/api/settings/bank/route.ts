import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabaseServer";

export async function GET(request: NextRequest) {
  try {
    // Use service role client for public access to bank settings
    const supabase = createServiceRoleClient();

    // First, let's see all rows in admin_settings
    const { data: allRows, error: allError } = await (supabase as any)
      .from("admin_settings")
      .select("*");

    // Get the latest settings row by updated_at
    const { data: settings, error } = await (supabase as any)
      .from("admin_settings")
      .select("bank_name, account_number, account_holder, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error("Error fetching bank settings:", error);
      return NextResponse.json(
        { error: "No bank settings configured" },
        { status: 404 },
      );
    }

    return NextResponse.json(settings, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Get bank settings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch bank settings" },
      { status: 500 },
    );
  }
}
