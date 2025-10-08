export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  createServerClientWithCookies,
  createServiceRoleClient,
} from "@/lib/supabaseServer";
import { requireRole } from "@/lib/rbac";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = params.id;
  try {
    const serverClient = createServerClientWithCookies();
    await requireRole(serverClient as any, "admin");

    const service = createServiceRoleClient();

    // Delete auth user — if profiles.id FK is ON DELETE CASCADE, profile and dependent rows will be removed too
    const { error: delErr } = await service.auth.admin.deleteUser(id);
    if (delErr) {
      console.error("Error deleting auth user:", delErr);
      return NextResponse.json(
        { error: "Failed to delete auth user" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin delete user error:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = params.id;
  try {
    const serverClient = createServerClientWithCookies();
    await requireRole(serverClient as any, "admin");

    const service = createServiceRoleClient();
    const body = await request.json();
    const { telegram_id } = body;

    // Validate telegram_id if provided
    if (telegram_id !== null && telegram_id !== undefined) {
      if (typeof telegram_id !== "string" || telegram_id.trim() === "") {
        return NextResponse.json(
          { error: "telegram_id must be a non-empty string or null" },
          { status: 400 },
        );
      }
    }

    // Update the user's profile telegram_id
    const { error: updateErr } = await (service as any)
      .from("profiles")
      .update({
        telegram_id: telegram_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) {
      console.error("Error updating user telegram_id:", updateErr);
      return NextResponse.json(
        { error: "Failed to update user telegram_id" },
        { status: 500 },
      );
    }

    // If we're setting a telegram_id, also clear any existing sessions for this user
    // to ensure clean state when they reconnect
    if (telegram_id) {
      // Import and use the reset function
      const { resetUserTelegramData } = await import("@/lib/telegramSession");
      resetUserTelegramData(id);
    }

    return NextResponse.json({
      success: true,
      message: telegram_id
        ? "Telegram ID updated and sessions cleared"
        : "Telegram ID cleared"
    });
  } catch (error) {
    console.error("Admin update user telegram error:", error);
    return NextResponse.json(
      { error: "Failed to update user telegram" },
      { status: 500 },
    );
  }
}
