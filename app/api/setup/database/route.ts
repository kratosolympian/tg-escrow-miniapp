import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();

    // Test connection by trying to query a table that should exist
    const { error } = await supabase
      .from("profiles")
      .select("count", { count: "exact", head: true });

    if (error) {
      if (error.message.includes('relation "public.profiles" does not exist')) {
        return NextResponse.json(
          {
            error: "Database tables not set up",
            message:
              "The database schema has not been applied. Please run the SQL files in your Supabase dashboard.",
            instructions: [
              "1. Go to your Supabase project dashboard",
              "2. Navigate to the SQL Editor",
              "3. Run SQL/schema.sql first",
              "4. Then run SQL/rls.sql",
              "5. Finally run SQL/storage.sql",
            ],
            sqlFiles: {
              schema: "/SQL/schema.sql",
              rls: "/SQL/rls.sql",
              storage: "/SQL/storage.sql",
            },
          },
          { status: 400 },
        );
      } else {
        return NextResponse.json(
          {
            error: "Database connection failed",
            details: error.message,
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Database connection successful and tables exist",
    });
  } catch (error) {
    console.error("Database test error:", error);
    return NextResponse.json(
      {
        error: "Unexpected error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
