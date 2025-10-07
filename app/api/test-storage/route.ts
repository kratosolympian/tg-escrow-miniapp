import { NextRequest, NextResponse } from "next/server.js";
import { createServiceRoleClient } from "@/lib/supabaseServer";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();

    // Test storage access
    const { data: buckets, error: bucketError } =
      await supabase.storage.listBuckets();

    if (bucketError) {
      console.error("Error listing buckets:", bucketError);
      return NextResponse.json(
        {
          error: "Failed to list buckets",
          details: bucketError,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      buckets: buckets,
    });
  } catch (error) {
    console.error("Storage test error:", error);
    return NextResponse.json({ error: "Storage test failed" }, { status: 500 });
  }
}
