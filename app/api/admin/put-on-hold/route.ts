export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  createServerClientWithCookies,
  createServiceRoleClient,
} from "@/lib/supabaseServer";
import { requireRole } from "@/lib/rbac";
import { ESCROW_STATUS, canTransition, EscrowStatus } from "@/lib/status";
import { z } from "zod";
import { sendEscrowStatusNotification } from "@/lib/telegram";

const holdSchema = z.object({
  escrowId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies();
    const serviceClient = createServiceRoleClient();

    // Require admin role
    const profile = await requireRole(supabase, "admin");

    const body = await request.json();
    const { escrowId } = holdSchema.parse(body);

    // Get escrow
    const { data: escrow, error: escrowError } = await (serviceClient as any)
      .from("escrows")
      .select("*")
      .eq("id", escrowId)
      .single();

    if (escrowError || !escrow) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
      );
    }

    // Check if can transition to on_hold
    if (!canTransition(escrow.status as EscrowStatus, ESCROW_STATUS.ON_HOLD)) {
      return NextResponse.json(
        {
          error: "Cannot put transaction on hold in current status",
        },
        { status: 400 },
      );
    }

    // Update escrow status to on_hold
    const { error: updateError } = await (serviceClient as any)
      .from("escrows")
      .update({ status: ESCROW_STATUS.ON_HOLD })
      .eq("id", escrow.id);

    if (updateError) {
      console.error("Error updating escrow:", updateError);
      return NextResponse.json(
        { error: "Failed to update transaction" },
        { status: 500 },
      );
    }

    // Send Telegram notifications
    await sendEscrowStatusNotification(
      escrow.id,
      escrow.status,
      ESCROW_STATUS.ON_HOLD,
      serviceClient,
      process.env.TELEGRAM_MINIAPP_URL,
      profile.id,
    );

    // Log status change
    await (serviceClient as any).from("status_logs").insert({
      escrow_id: escrow.id,
      status: ESCROW_STATUS.ON_HOLD,
      changed_by: profile.id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Put on hold error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to put transaction on hold" },
      { status: 500 },
    );
  }
}
