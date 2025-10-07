export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabaseServer";
import { generateUUID, getFileExtension, isValidImageType } from "@/lib/utils";
import { z } from "zod";
// Zod schema for file validation
const fileSchema = z.object({
  type: z.string().refine((val) => isValidImageType(val), {
    message: "Invalid image type",
  }),
  size: z.number().max(5 * 1024 * 1024, { message: "File too large" }),
});

export async function POST(request: NextRequest) {
  try {
    const service = createServiceRoleClient();
    const form = await request.formData();
    const file = form.get("image") as File | null;

    if (!file)
      return NextResponse.json({ error: "No file provided" }, { status: 400 });

    // Validate file with Zod
    const parseResult = fileSchema.safeParse({
      type: file.type,
      size: file.size,
    });
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0].message },
        { status: 400 },
      );
    }

    const id = generateUUID();
    const ext = getFileExtension((file as any).name || "upload");
    const path = `temp/${id}.${ext}`;

    const { error } = await service.storage
      .from("product-images")
      .upload(path, file, { upsert: false });
    if (error) {
      console.error("Temp upload error:", error);
      return NextResponse.json({ error: "Failed to upload" }, { status: 500 });
    }

    // Create signed URL for preview (short-lived)
    const ttlSeconds = 900; // 15 minutes
    const { data: signed, error: signErr } = await service.storage
      .from("product-images")
      .createSignedUrl(path, ttlSeconds);
    if (signErr) {
      console.warn("Signed URL error:", signErr);
    }

    // Suggest an expires_at for temp uploads so clients can re-check or move to permanent on form submit
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    return NextResponse.json({
      path,
      signedUrl: signed?.signedUrl || null,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error("upload-temp error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
