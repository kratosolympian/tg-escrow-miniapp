import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
  try {
    const serviceClient = createServiceRoleClient();

    // Get an escrow without a buyer
    const { data: escrow, error: escrowError } = await serviceClient
      .from("escrows")
      .select("id, code, seller_id, buyer_id")
      .is("buyer_id", null)
      .limit(1)
      .single();

    if (escrowError || !escrow) {
      return NextResponse.json(
        { error: "No available escrow found" },
        { status: 404 },
      );
    }

    const escrowData = escrow as {
      id: string;
      code: string;
      seller_id: string | null;
      buyer_id: string | null;
    };

    // Get a buyer with telegram_id
    const buyerQuery = serviceClient
      .from("profiles")
      .select("id, full_name, telegram_id")
      .not("telegram_id", "is", null);

    // Don't assign seller as buyer (only if seller_id exists)
    if (escrowData.seller_id) {
      buyerQuery.neq("id", escrowData.seller_id);
    }

    const { data: buyers, error: buyerError } = await buyerQuery.limit(5);

    if (buyerError || !buyers || buyers.length === 0) {
      return NextResponse.json(
        { error: "No buyers with telegram_id found" },
        { status: 404 },
      );
    }

    // Pick the first available buyer
    const buyer = buyers[0] as {
      id: string;
      full_name: string | null;
      telegram_id: string | null;
    };

    // Assign buyer to escrow
    const { error: updateError } = await (serviceClient as any)
      .from("escrows")
      .update({
        buyer_id: buyer.id,
        status: "waiting_payment", // Reset to allow testing
        updated_at: new Date().toISOString(),
      })
      .eq("id", escrowData.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to assign buyer", details: updateError },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Assigned buyer "${buyer.full_name}" to escrow "${escrowData.code}"`,
      escrow: {
        id: escrowData.id,
        code: escrowData.code,
        seller: "Seller Test",
        buyer: buyer.full_name,
        buyer_telegram_id: buyer.telegram_id,
      },
      note: "Now test notifications at /api/test-notifications to see both seller and buyer receive them!",
    });
  } catch (error) {
    console.error("Assign buyer error:", error);
    return NextResponse.json(
      {
        error: "Assignment failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
