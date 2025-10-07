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
