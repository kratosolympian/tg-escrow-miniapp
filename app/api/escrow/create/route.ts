export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server.js";
import {
  createServerClientWithAuthHeader,
  createServiceRoleClient,
} from "@/lib/supabaseServer";
import {
  shortCode,
  generateUUID,
  getFileExtension,
  isValidImageType,
} from "@/lib/utils";
import { ESCROW_STATUS } from "@/lib/status";
import { z } from "zod";
import { sendEscrowStatusNotification } from "@/lib/telegram";

/**
 * POST /api/escrow/create
 *
 * Creates a new escrow transaction as a seller.
 * Handles both cookie-based and one-time token authentication.
 * Steps:
 *   1. Authenticates the user (cookie or one-time token)
 *   2. Validates input (description, price)
 *   3. Generates a unique code and UUID
 *   4. Inserts the escrow into the database
 *   5. Returns the escrow code and ID
 *
 * Request body:
 *   { description: string, price: number, __one_time_token?: string }
 *
 * Returns:
 *   200: { ok: true, code, escrowId }
 *   400: { error: string } (validation)
 *   401: { error: string } (authentication)
 *   500: { error: string } (insert or server error)
 */
const createEscrowSchema = z.object({
  description: z.string().min(1).max(1000),
  price: z.number().positive().max(1000000),
});

export async function POST(request: NextRequest) {
  try {
    let parsedBody: any;
    try {
      const formData = await request.formData();
      parsedBody = {
        description: formData.get("description")?.toString() || "",
        price: parseFloat(formData.get("price")?.toString() || "0"),
        assigned_admin_id: formData.get("assigned_admin_id")?.toString(),
        productImagePath: formData.get("productImagePath")?.toString(),
        image: formData.get("image") as File | null,
      };
    } catch (error) {
      console.error("Failed to parse FormData body:", error);
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const supabase = createServerClientWithAuthHeader(request);
    const serviceClient = createServiceRoleClient();

    // Check for test mode (development only)
    const { searchParams } = new URL(request.url);
    const testMode =
      searchParams.get("test") === "true" &&
      process.env.NODE_ENV === "development";

    // Log authentication attempt

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    let authenticatedUser = user;

    if (!authenticatedUser && !testMode) {
      let token =
        parsedBody?.__one_time_token ||
        request.headers.get("x-one-time-token") ||
        null;
      if (!token) {
        const authHeader = request.headers.get("authorization") || "";
        if (authHeader.toLowerCase().startsWith("bearer ")) {
          token = authHeader.slice(7).trim();
        }
      }

      if (token) {
        try {
          const { verifyAndConsumeSignedToken } = await import(
            "@/lib/signedAuth"
          );

          const userId = await verifyAndConsumeSignedToken(token);

          if (userId) {
            const { data: userData, error: userFetchError } =
              await serviceClient
                .from("profiles")
                .select("id, email, full_name")
                .eq("id", userId)
                .single();

            // Adjust authenticatedUser assignment to match the expected User type
            authenticatedUser = {
              id: userId,
              email: userData?.email || "test@example.com",
              app_metadata: {},
              user_metadata: {},
              aud: "authenticated",
              created_at: new Date().toISOString(),
            };
          }
        } catch (e) {
          console.warn("One-time token verification failed:", e);
        }
      }
    }

    // Test mode fallback (development only)
    if (!authenticatedUser && testMode) {
      authenticatedUser = {
        id: "test-user-id",
        email: "test@example.com",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      };
    }

    if (!authenticatedUser) {
      console.error("Authentication failed:", { userError, authenticatedUser });
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Validate input data
    const validationResult = createEscrowSchema.safeParse({
      description: parsedBody.description,
      price: parsedBody.price,
    });

    if (!validationResult.success) {
      console.error("Validation failed:", validationResult.error);
      return NextResponse.json(
        {
          error: "Invalid input data",
          details: validationResult.error.issues,
        },
        { status: 400 },
      );
    }

    const { description: validDescription, price: validPrice } =
      validationResult.data;

    // Test mode response (development only)
    if (testMode) {
      return NextResponse.json({
        ok: true,
        code: "TEST123",
        escrowId: "test-escrow-id",
        test_mode: true,
        message: "Test mode enabled - escrow creation bypassed",
      });
    }

    // Ensure profile exists

    const { data: existingProfile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("id", authenticatedUser.id)
      .single();

    if (!existingProfile) {
      const { error: profileError } = await serviceClient
        .from("profiles")
        .insert({
          id: authenticatedUser.id,
          email: authenticatedUser.email || "unknown@example.com",
          full_name: authenticatedUser.user_metadata?.full_name || "",
          role: "seller",
        });
      if (profileError) {
        console.error("Failed to create profile:", profileError);
        return NextResponse.json(
          { error: "Failed to create profile" },
          { status: 500 },
        );
      }
    }

    // Check if seller already has an active escrow

    const { data: activeEscrows, error: activeError } = await serviceClient
      .from("escrows")
      .select("id, code, description, price, status, created_at")
      .eq("seller_id", authenticatedUser.id)
      .not(
        "status",
        "in",
        `(${ESCROW_STATUS.COMPLETED},${ESCROW_STATUS.REFUNDED},${ESCROW_STATUS.CLOSED})`,
      );

    if (activeError) {
      console.error("Error checking active escrows:", activeError);
      return NextResponse.json(
        { error: "Failed to check active escrows" },
        { status: 500 },
      );
    }

    if (activeEscrows && activeEscrows.length > 0) {
      return NextResponse.json(
        {
          error:
            "You already have an ongoing transaction. Please complete or cancel it before creating a new one.",
          activeEscrow: activeEscrows[0],
        },
        { status: 409 },
      );
    }

    // Get current service fee from admin settings
    let currentServiceFee = 300; // Default fallback
    try {
      const { data: adminSettings, error: settingsError } = await serviceClient
        .from("admin_settings")
        .select("service_fee")
        .order("id", { ascending: false })
        .limit(1)
        .single();

      if (
        !settingsError &&
        adminSettings &&
        (adminSettings as any).service_fee
      ) {
        currentServiceFee = (adminSettings as any).service_fee;
      }
    } catch (error) {
      // If service_fee column doesn't exist yet, use default
      console.log("Using default service fee (column may not exist yet):", 300);
    }

    // Prepare insert data
    const insertData: any = {
      code: shortCode(),
      seller_id: authenticatedUser.id,
      description: validDescription,
      price: validPrice,
      admin_fee: currentServiceFee,
      status: ESCROW_STATUS.CREATED,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
    };
    if (parsedBody.assigned_admin_id) {
      insertData.assigned_admin_id = parsedBody.assigned_admin_id;
    }

    // Handle product image: move from temp to permanent location asynchronously
    if (parsedBody.productImagePath) {
      try {
        const tempPath = parsedBody.productImagePath;
        const fileName = tempPath.split("/").pop(); // Extract filename from temp path
        const escrowId = generateUUID(); // Generate ID for permanent path
        const permanentPath = `products/${escrowId}/${fileName}`;

        // Set the escrow ID and image path immediately
        insertData.id = escrowId;
        insertData.product_image_url = permanentPath;

        // Process image move asynchronously (fire-and-forget, don't block escrow creation)
        (async () => {
          try {
            // Add timeout for download operation
            const downloadPromise = serviceClient.storage
              .from("product-images")
              .download(tempPath);

            const timeoutPromise = new Promise(
              (_, reject) =>
                setTimeout(
                  () => reject(new Error("Image download timeout")),
                  30000,
                ), // 30 second timeout
            );

            const { data: fileData, error: downloadError } =
              (await Promise.race([downloadPromise, timeoutPromise])) as any;

            if (!downloadError && fileData) {
              // Upload to permanent location with timeout
              const uploadPromise = serviceClient.storage
                .from("product-images")
                .upload(permanentPath, fileData, { upsert: true });

              const uploadTimeoutPromise = new Promise((_, reject) =>
                setTimeout(
                  () => reject(new Error("Image upload timeout")),
                  30000,
                ),
              );

              const { error: uploadError } = (await Promise.race([
                uploadPromise,
                uploadTimeoutPromise,
              ])) as any;

              if (!uploadError) {
                console.log(`Successfully moved image for escrow ${escrowId}`);
                // Clean up temp file
                try {
                  await serviceClient.storage
                    .from("product-images")
                    .remove([tempPath]);
                  console.log(`Cleaned up temp file: ${tempPath}`);
                } catch (cleanupError) {
                  console.warn("Failed to cleanup temp file:", cleanupError);
                }
              } else {
                console.error("Error uploading permanent image:", uploadError);
              }
            } else {
              console.error("Error downloading temp image:", downloadError);
            }
          } catch (imageError) {
            console.error(
              "Error processing product image asynchronously:",
              imageError,
            );
          }
        })().catch((err) => {
          console.error("Unhandled error in async image processing:", err);
        });
      } catch (imageError) {
        console.error("Error setting up image processing:", imageError);
        // Continue without image - don't fail the escrow creation
      }
    }

    // Insert escrow into database

    const { data: escrow, error: escrowError } = await serviceClient
      .from("escrows")
      .insert(insertData)
      .select()
      .single();

    if (escrowError) {
      console.error("Error creating escrow:", escrowError);

      // Check if this is the specific error about seller having an active escrow
      if (escrowError.code === 'P0001' && escrowError.message?.includes('Seller already has an active escrow')) {
        // Extract the active escrow ID from the error message
        const activeEscrowIdMatch = escrowError.message.match(/active_escrow_id=([a-f0-9-]+)/);
        const activeEscrowId = activeEscrowIdMatch ? activeEscrowIdMatch[1] : null;

        let activeEscrowDetails = null;
        if (activeEscrowId) {
          // Fetch the active escrow details
          const { data: activeEscrow } = await serviceClient
            .from("escrows")
            .select("code, description, price, status, created_at")
            .eq("id", activeEscrowId)
            .single();

          if (activeEscrow) {
            activeEscrowDetails = {
              id: activeEscrowId,
              code: activeEscrow.code,
              description: activeEscrow.description,
              price: activeEscrow.price,
              status: activeEscrow.status,
              createdAt: activeEscrow.created_at,
            };
          }
        }

        return NextResponse.json(
          {
            error: "You already have an active escrow transaction",
            type: "ACTIVE_ESCROW_EXISTS",
            message: "You can only have one active escrow at a time. Please complete or cancel your existing transaction before creating a new one.",
            activeEscrow: activeEscrowDetails,
            actionRequired: activeEscrowDetails ? {
              text: `View your active escrow (${activeEscrowDetails.code})`,
              url: `/seller/escrow/${activeEscrowDetails.id}`,
            } : null,
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        { error: "Failed to create escrow", details: escrowError.message },
        { status: 500 },
      );
    }

    // Send notification to admins about new escrow creation
    try {
      await sendEscrowStatusNotification(
        escrow.id,
        "created", // old status (doesn't exist yet)
        escrow.status,
        serviceClient,
        process.env.TELEGRAM_MINIAPP_URL,
      );
    } catch (notificationError) {
      console.error(
        "Error sending escrow creation notification:",
        notificationError,
      );
      // Don't fail the escrow creation if notification fails
    }

    return NextResponse.json({
      ok: true,
      code: escrow.code,
      escrowId: escrow.id,
    });
  } catch (error) {
    console.error("Unhandled error in POST /api/escrow/create:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
