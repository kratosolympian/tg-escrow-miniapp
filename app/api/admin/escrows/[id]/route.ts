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

    // delete escrow row — receipts and logs are set to cascade in schema
    const { data, error } = await (service as any)
      .from("escrows")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting escrow:", error);
      return NextResponse.json(
        { error: "Failed to delete escrow" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, deleted: data });
  } catch (error) {
    console.error("Admin delete escrow error:", error);
    return NextResponse.json(
      { error: "Failed to delete escrow" },
      { status: 500 },
    );
  }
}
