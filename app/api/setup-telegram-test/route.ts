import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
  try {
    const serviceClient = createServiceRoleClient();

    // Get all profiles without telegram_id
    const { data: profiles, error } = await serviceClient
      .from("profiles")
      .select("id, full_name, role, telegram_id")
      .is("telegram_id", null)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch profiles", details: error },
        { status: 500 },
      );
    }

    if (profiles.length === 0) {
      return NextResponse.json({
        message: "All profiles already have Telegram IDs set",
        profiles: [],
      });
    }

    // Assign test Telegram IDs
    const testTelegramIds = [
      "123456789", // Test ID 1
      "987654321", // Test ID 2
      "555666777", // Test ID 3
      "111222333", // Test ID 4
      "444555666", // Test ID 5
    ];

    const results = [];

    for (
      let i = 0;
      i < Math.min(profiles.length, testTelegramIds.length);
      i++
    ) {
      const profile = profiles[i];
      const testId = testTelegramIds[i];

      const { error: updateError } = await serviceClient
        .from("profiles")
        .update({
          telegram_id: testId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (updateError) {
        results.push({
          profile: profile.full_name,
          success: false,
          error: updateError.message,
        });
      } else {
        results.push({
          profile: profile.full_name,
          role: profile.role,
          telegram_id: testId,
          success: true,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      message: `Set up Telegram IDs for ${successCount} profiles`,
      results,
      instructions: [
        "Now all users should receive Telegram notifications",
        "Test notifications at: /api/test-notifications",
        "Trigger real status changes to see notifications in action",
      ],
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      {
        error: "Setup failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// GET endpoint to check current status
export async function GET(request: NextRequest) {
  try {
    const serviceClient = createServiceRoleClient();

    const { data: profiles, error } = await serviceClient
      .from("profiles")
      .select("id, full_name, role, telegram_id")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch profiles", details: error },
        { status: 500 },
      );
    }

    const withTelegram = profiles.filter((p) => p.telegram_id);
    const withoutTelegram = profiles.filter((p) => !p.telegram_id);

    return NextResponse.json({
      total_profiles: profiles.length,
      with_telegram_ids: withTelegram.length,
      without_telegram_ids: withoutTelegram.length,
      profiles: profiles.map((p) => ({
        name: p.full_name,
        role: p.role,
        has_telegram: !!p.telegram_id,
        telegram_id: p.telegram_id,
      })),
      ready_for_testing: withTelegram.length > 0,
    });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      {
        error: "Status check failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
