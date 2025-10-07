import { NextRequest, NextResponse } from "next/server";
import {
  createServerClientWithCookies,
  createServiceRoleClient,
} from "@/lib/supabaseServer";
import { requireAuth } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies();
    const profile = await requireAuth(supabase);

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread_only") === "true";
    const limit = parseInt(searchParams.get("limit") || "10");

    let query = supabase
      .from("user_notifications")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq("is_read", false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error("Error fetching notifications:", error);
      return NextResponse.json(
        { error: "Failed to fetch notifications" },
        { status: 500 },
      );
    }

    return NextResponse.json({ notifications: notifications || [] });
  } catch (error) {
    console.error("Notifications API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies();
    const profile = await requireAuth(supabase);

    const body = await request.json();
    const { notificationIds } = body;

    if (!Array.isArray(notificationIds)) {
      return NextResponse.json(
        { error: "notificationIds must be an array" },
        { status: 400 },
      );
    }

    // Mark notifications as read
    const { error } = await supabase
      .from("user_notifications")
      .update({ is_read: true })
      .in("id", notificationIds)
      .eq("user_id", profile.id);

    if (error) {
      console.error("Error marking notifications as read:", error);
      return NextResponse.json(
        { error: "Failed to update notifications" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark read API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
