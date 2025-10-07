export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithCookies } from "@/lib/supabaseServer";
import { resetUserTelegramData } from "@/lib/telegramSession";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies();

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = user.id;
    console.log(`[ResetTelegram] Resetting Telegram data for user: ${userId}`);

    // Clear all Telegram sessions for this user
    resetUserTelegramData(userId);

    // Clear telegram_id from the user's profile in the database
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        telegram_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Error clearing telegram_id from profile:", updateError);
      return NextResponse.json(
        { error: "Failed to clear profile telegram_id" },
        { status: 500 }
      );
    }

    console.log(`[ResetTelegram] Successfully reset all Telegram data for user: ${userId}`);

    return NextResponse.json({
      success: true,
      message: "Telegram data has been reset. Please reconnect with your new Telegram account to receive notifications.",
    });

  } catch (error) {
    console.error("Reset Telegram error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}