export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  createServerClientWithAuthHeader,
  createServiceRoleClient,
} from "@/lib/supabaseServer";

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } },
) {
  try {
    const supabase = createServerClientWithAuthHeader(request);
    const serviceClient = createServiceRoleClient();

    // Get user if authenticated (but don't require auth for public escrow view)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Find escrow by code using service client to bypass RLS
    const { data: escrow, error: findError } = await serviceClient
      .from("escrows")
      .select("*")
      .eq("code", params.code.toUpperCase())
      .single();

    if (findError || !escrow) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
      );
    }

    // If user is not authenticated or not a member, return limited info
    if (
      !user ||
      ((escrow as any).seller_id !== user.id &&
        (escrow as any).buyer_id !== user.id)
    ) {
      return NextResponse.json({
        id: (escrow as any).id,
        code: (escrow as any).code,
        description: (escrow as any).description,
        price: (escrow as any).price,
        admin_fee: (escrow as any).admin_fee,
        status: (escrow as any).status,
        created_at: (escrow as any).created_at,
        has_buyer: !!(escrow as any).buyer_id,
      });
    }

    // Return full details for members - get related data
    const { data: statusLogs } = await serviceClient
      .from("status_logs")
      .select("id, status, created_at, changed_by")
      .eq("escrow_id", (escrow as any).id)
      .order("created_at", { ascending: true });

    let { data: receipts, error: receiptsError } = await serviceClient
      .from("receipts")
      .select("id, file_path, created_at, uploaded_by")
      .eq("escrow_id", (escrow as any).id)
      .order("created_at", { ascending: true });

    if (receiptsError) {
      console.error(
        "Error fetching receipts for escrow",
        (escrow as any).id,
        receiptsError,
      );
    }

    // Attach signed URLs to receipts (non-fatal)
    if (Array.isArray(receipts) && receipts.length > 0) {
      try {
        const signed = await Promise.all(
          receipts.map(async (r: any) => {
            try {
              const { data: signedData, error: signError } =
                await createServiceRoleClient()
                  .storage.from("receipts")
                  .createSignedUrl(r.file_path, 900);

              return {
                ...r,
                signed_url: signError ? null : signedData?.signedUrl || null,
              };
            } catch (e) {
              console.error("Error creating signed URL for receipt", e);
              return { ...r, signed_url: null };
            }
          }),
        );
        receipts = signed;
      } catch (e) {
        console.error("Error while attaching signed urls to receipts", e);
      }
    }

    // Attach assigned admin bank data (profile) or platform fallback
    let adminBank: any = null;
    if ((escrow as any).assigned_admin_id) {
      const { data: adminProfile } = await serviceClient
        .from("profiles")
        .select("bank_name, account_number, account_holder_name")
        .eq("id", (escrow as any).assigned_admin_id)
        .single();
      adminBank = adminProfile || null;
    }

    if (!adminBank) {
      const { data: platform } = await serviceClient
        .from("admin_settings")
        .select("bank_name, account_number, account_holder")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();
      adminBank = platform || null;
    }

    return NextResponse.json({
      ...(escrow as any),
      status_logs: statusLogs || [],
      receipts: receipts || [],
      admin_bank: adminBank,
    });
  } catch (error) {
    console.error("Get escrow by code error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transaction" },
      { status: 500 },
    );
  }
}
