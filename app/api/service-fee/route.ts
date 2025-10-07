export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabaseServer";

export async function GET(request: NextRequest) {
  try {
    // Use service role client to bypass RLS and get admin settings
    const service = createServiceRoleClient();

    // Get the latest admin settings (highest ID)
    const { data: settings, error } = await (service as any)
      .from("admin_settings")
      .select("service_fee")
      .order("id", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "no rows returned"
      console.error("[get-service-fee] Query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch service fee" },
        { status: 500 },
      );
    }

    // Return the service fee, defaulting to 300 if no settings exist
    const serviceFee = settings?.service_fee ?? 300;

    return NextResponse.json({
      success: true,
      service_fee: serviceFee,
    });
  } catch (error) {
    console.error("[get-service-fee] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}