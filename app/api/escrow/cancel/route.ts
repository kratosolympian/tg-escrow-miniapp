export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  createServerClientWithAuthHeader,
  createServiceRoleClient,
} from "@/lib/supabaseServer";
import { ESCROW_STATUS, canTransition, EscrowStatus } from "@/lib/status";
import { z } from "zod";

/**
 * POST /api/escrow/cancel
 *
 * Allows sellers to cancel escrows before payment is confirmed.
 * Only works when escrow status is 'waiting_payment'.
 *
 * Request body:
 *   { escrowId: string }
 *
 * Returns:
 *   200: { success: true }
 *   400: { error: string } (validation)
 *   401: { error: string } (authentication)
 *   403: { error: string } (not seller or escrow not cancellable)
 *   404: { error: string } (escrow not found)
 *   500: { error: string } (server error)
 */
const cancelEscrowSchema = z.object({
  escrowId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientWithAuthHeader(request);
    const serviceClient = createServiceRoleClient();

    // Authenticate user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Parse and validate request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validation = cancelEscrowSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: validation.error.errors.map((e) => e.message).join(", "),
        },
        { status: 400 },
      );
    }

    const { escrowId } = validation.data;

    // Get escrow and verify ownership
    const { data: escrow, error: escrowError } = await serviceClient
      .from("escrows")
      .select("id, seller_id, status")
      .eq("id", escrowId)
      .single();

    if (escrowError || !escrow) {
      return NextResponse.json({ error: "Escrow not found" }, { status: 404 });
    }

    const escrowData = escrow as {
      id: string;
      seller_id: string;
      status: string;
    };

    // Verify user is the seller
    if (escrowData.seller_id !== user.id) {
      return NextResponse.json(
        { error: "Only the seller can cancel this escrow" },
        { status: 403 },
      );
    }

    // Check if escrow can be cancelled (only when status is 'waiting_payment')
    if (escrowData.status !== ESCROW_STATUS.WAITING_PAYMENT) {
      return NextResponse.json(
        {
          error: "Escrow can only be cancelled before payment is confirmed",
        },
        { status: 403 },
      );
    }

    // Update escrow status to closed
    const { error: updateError } = await (supabase as any)
      .from("escrows")
      .update({
        status: ESCROW_STATUS.CLOSED,
      })
      .eq("id", escrowId);

    if (updateError) {
      console.error("Error cancelling escrow:", updateError);
      return NextResponse.json(
        { error: "Failed to cancel escrow" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error in escrow cancel:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
