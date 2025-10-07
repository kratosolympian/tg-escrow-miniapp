export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  createServerClientWithCookies,
  createServiceRoleClient,
} from "@/lib/supabaseServer";
import { requireRole } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  try {
    const serverClient = createServerClientWithCookies();
    // ensure the caller is at least admin
    await requireRole(serverClient as any, "admin");

    const service = createServiceRoleClient();

    // list users from auth and join profiles
    const { data: authList, error: authErr } =
      await service.auth.admin.listUsers();
    if (authErr) {
      console.error("Error listing auth users:", authErr);
      return NextResponse.json(
        { error: "Failed to list users" },
        { status: 500 },
      );
    }

    // fetch profiles for mapping
    const { data: profiles } = await (service as any)
      .from("profiles")
      .select("id, email, full_name, role, created_at");

    const users = (authList.users || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      user_metadata: u.user_metadata || {},
      profile: profiles?.find((p: any) => p.id === u.id) || null,
    }));

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error("Admin users list error:", error);
    return NextResponse.json(
      { error: "Failed to list users" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const serverClient = createServerClientWithCookies();
    await requireRole(serverClient as any, "admin");

    const body = await request.json();
    const { email, password, full_name, role = "buyer" } = body;
    if (!email || !password) {
      return NextResponse.json(
        { error: "email and password are required" },
        { status: 400 },
      );
    }

    const service = createServiceRoleClient();

    // create auth user via admin API
    const { data: created, error: createErr } =
      await service.auth.admin.createUser({
        email,
        password,
        user_metadata: { full_name },
      } as any);

    if (createErr) {
      console.error("Error creating auth user:", createErr);
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 },
      );
    }

    const userId = created.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: "Failed to create user (no id)" },
        { status: 500 },
      );
    }

    // create profile row
    const { data: profile, error: profileErr } = await (service as any)
      .from("profiles")
      .insert({ id: userId, email, full_name: full_name || "", role })
      .select()
      .single();

    if (profileErr) {
      console.error("Error creating profile after user creation:", profileErr);
      // attempt to cleanup created auth user
      try {
        await service.auth.admin.deleteUser(userId);
      } catch (e) {
        /* ignore */
      }
      return NextResponse.json(
        { error: "Failed to create profile" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, user: created.user, profile });
  } catch (error) {
    console.error("Admin create user error:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 },
    );
  }
}
