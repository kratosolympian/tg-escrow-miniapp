export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  createServerClientWithCookies,
  createServiceRoleClient,
} from "@/lib/supabaseServer";
import { ESCROW_STATUS } from "@/lib/status";

// Helper to check if string is UUID
function isUUID(str: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    str,
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const makeJson = (payload: any, user?: any, status?: number) => {
    try {
      if (process.env.DEBUG) {
        payload._debug = payload._debug || {};
        payload._debug.cookie = request.headers.get("cookie") || null;
        // if user variable exists, include its id
        try {
          payload._debug.serverUser = user ? user.id : null;
        } catch (e) {}
        payload._debug.ts = Date.now();
      }
    } catch (e) {}
    return typeof status === "number"
      ? NextResponse.json(payload, { status })
      : NextResponse.json(payload);
  };

  try {
    const supabase = createServerClientWithCookies();
    const serviceClient = createServiceRoleClient();

    // Get authenticated user directly to bypass profile lookup issue
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return makeJson({ error: "Authentication required" }, null, 401);
    }

    let escrow = null;
    let findError = null;
    let idOrCode = params.id;

    if (isUUID(idOrCode)) {
      // Find by UUID
      const result = await (serviceClient as any)
        .from("escrows")
        .select(
          `
          *,
          seller:profiles!seller_id(telegram_id, email, full_name, bank_name, account_number, account_holder_name, phone_number),
          buyer:profiles!buyer_id(telegram_id, email, full_name, bank_name, account_number, account_holder_name, phone_number)
        `,
        )
        .eq("id", idOrCode)
        .single();
      escrow = result.data;
      findError = result.error;
    } else {
      // Try to find by code (case-insensitive)
      const result = await (serviceClient as any)
        .from("escrows")
        .select(
          `
          *,
          seller:profiles!seller_id(telegram_id, email, full_name, bank_name, account_number, account_holder_name, phone_number),
          buyer:profiles!buyer_id(telegram_id, email, full_name, bank_name, account_number, account_holder_name, phone_number)
        `,
        )
        .ilike("code", idOrCode.trim())
        .single();
      escrow = result.data;
      findError = result.error;
    }

    if (findError || !escrow) {
      console.error("Escrow find error:", findError);
      return makeJson({ error: "Transaction not found" }, 404);
    }

    // Resolve final escrow id to use for subsequent queries (handles lookup-by-code)
    const escrowId = (escrow as any)?.id || params.id;

    // If escrow has an expires_at and it's passed, expire it (only if created or waiting for payment)
    try {
      if ((escrow as any)?.expires_at) {
        const expiresAt = new Date((escrow as any).expires_at).getTime();
        const now = Date.now();
        if (
          now > expiresAt &&
          ((escrow as any).status === ESCROW_STATUS.CREATED ||
            (escrow as any).status === ESCROW_STATUS.WAITING_PAYMENT)
        ) {
          // mark as closed
          const { error: updateError } = await (serviceClient as any)
            .from("escrows")
            .update({ status: ESCROW_STATUS.CLOSED })
            .eq("id", escrowId);

          if (!updateError) {
            // log status change
            await (serviceClient as any).from("status_logs").insert({
              escrow_id: escrowId,
              status: ESCROW_STATUS.CLOSED,
              changed_by: null,
            });
            (escrow as any).status = ESCROW_STATUS.CLOSED;
          }
        }
      }
    } catch (e) {
      // non-fatal
      console.error("Error checking expiry:", e);
    }
    // Check access - user must be seller, buyer, or admin
    // Get user profile to check if admin
    const { data: userProfile } = await (serviceClient as any)
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin =
      (userProfile as any)?.role === "admin" ||
      (userProfile as any)?.role === "super_admin";
    const isBuyer = (escrow as any).buyer_id === user.id;
    const isSeller = (escrow as any).seller_id === user.id;
    const hasAccess = isAdmin || isBuyer || isSeller;

    if (!hasAccess) {
      return makeJson({ error: "Access denied" }, 403);
    }

    // Get receipts with more detailed info using service client
    // Only return receipts for buyer and admin users (not sellers for confidentiality)
    let receipts = null;
    if (isBuyer || isAdmin) {
      let { data: receiptsData, error: receiptsError } = await serviceClient
        .from("receipts")
        .select(
          `
          id,
          file_path,
          created_at,
          uploaded_by
        `,
        )
        .eq("escrow_id", escrowId)
        .order("created_at", { ascending: true });

      if (receiptsError) {
        console.error(
          "Error fetching receipts for escrow",
          escrowId,
          receiptsError,
        );
      }

      // Attempt to generate signed URLs for each receipt (non-fatal)
      if (Array.isArray(receiptsData) && receiptsData.length > 0) {
        try {
          const signedPromises = receiptsData.map(async (r: any) => {
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
              console.error("Error signing receipt url", e);
              return { ...r, signed_url: null };
            }
          });

          const signedResults = await Promise.all(signedPromises);
          // Replace receipts with signed-url-augmented versions
          receiptsData = signedResults as any;
        } catch (e) {
          console.error("Error while creating signed URLs for receipts", e);
        }
      }
      receipts = receiptsData;
    }

    // Include assigned admin bank info (if any), falling back to platform settings
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

    // Fetch status logs for timer/action logic
    const { data: statusLogs, error: statusLogsError } = await serviceClient
      .from("status_logs")
      .select("id, status, created_at, changed_by")
      .eq("escrow_id", escrowId)
      .order("created_at", { ascending: true });

    if (statusLogsError) {
      console.error(
        "Error fetching status_logs for escrow",
        escrowId,
        statusLogsError,
      );
    }

    return makeJson({
      success: true,
      escrow: {
        ...(escrow as any),
        receipts: receipts || [],
        delivery_proof_url: (escrow as any).delivery_proof_url || null,
        status_logs: statusLogs || [],
      },
    });
  } catch (error) {
    console.error("Get escrow by ID error:", error);
    return makeJson({ error: "Failed to fetch transaction" }, 500);
  }
}
