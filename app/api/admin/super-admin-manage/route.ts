import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabaseServer";
import { isSuperAdmin } from "@/lib/rbac";

export async function POST(request: NextRequest) {
  if (request.method !== "POST") {
    return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
  }
  try {
    const { email, action = "add", requester_email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!["add", "remove"].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "add" or "remove"' },
        { status: 400 },
      );
    }

    // Check if requester is super admin (for security)
    if (requester_email && !isSuperAdmin(requester_email)) {
      return NextResponse.json(
        {
          error: "Only super admin can manage other admins",
        },
        { status: 403 },
      );
    }

    // Prevent removal of super admin
    if (isSuperAdmin(email) && action === "remove") {
      return NextResponse.json(
        {
          error:
            "Cannot remove super admin privileges from the primary admin account",
        },
        { status: 403 },
      );
    }

    const supabase = createServiceRoleClient();

    // Get the user by email from auth
    const { data: authData, error: authError } =
      await supabase.auth.admin.listUsers();
    if (authError) {
      console.error("Error fetching users:", authError);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 },
      );
    }

    const targetUser = authData.users.find((user) => user.email === email);
    if (!targetUser) {
      return NextResponse.json(
        { error: `User with email ${email} not found in auth` },
        { status: 404 },
      );
    }

    const newRole = action === "add" ? "admin" : "buyer"; // Default to buyer when removing admin role
    const roleType = isSuperAdmin(email) ? "Super Admin" : "Admin";

    if (process.env.DEBUG)
      console.log(
        `${action === "add" ? "Adding" : "Removing"} ${roleType} ${action === "add" ? "to" : "from"} user id:`,
        targetUser.id,
      );

    // First, check if profile exists
    const { data: existingProfile, error: checkError } = await (supabase as any)
      .from("profiles")
      .select("*")
      .eq("id", targetUser.id)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking profile");
      return NextResponse.json(
        { error: "Failed to check profile" },
        { status: 500 },
      );
    }

    if (existingProfile) {
      // Update existing profile role
      const { data: updatedProfile, error: updateError } = await (
        supabase as any
      )
        .from("profiles")
        .update({ role: newRole })
        .eq("id", targetUser.id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating profile role");
        return NextResponse.json(
          {
            error: "Failed to update role",
            details: updateError?.message || "Unknown",
          },
          { status: 500 },
        );
      }

      const message =
        action === "add"
          ? `${roleType} role assigned successfully`
          : "Admin role removed successfully";

      return NextResponse.json({
        success: true,
        message,
        profile: { ...updatedProfile, is_super_admin: isSuperAdmin(email) },
      });
    } else {
      if (action === "remove") {
        return NextResponse.json(
          { error: "User profile not found" },
          { status: 404 },
        );
      }

      // Create new profile with admin role
      const { data: newProfile, error: createError } = await (supabase as any)
        .from("profiles")
        .insert({
          id: targetUser.id,
          email: targetUser.email,
          full_name: targetUser.user_metadata?.full_name || "",
          role: newRole,
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating profile");
        return NextResponse.json(
          {
            error: "Failed to create profile",
            details: createError?.message || "Unknown",
          },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        message: `${roleType} profile created successfully`,
        profile: { ...newProfile, is_super_admin: isSuperAdmin(email) },
      });
    }
  } catch (error) {
    console.error("Role management error");
    return NextResponse.json(
      { error: "Failed to manage role" },
      { status: 500 },
    );
  }
}

// GET method to list all admins with super admin flag
export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    // Get all admin profiles
    const { data: adminProfiles, error } = await (supabase as any)
      .from("profiles")
      .select("id, email, full_name, role, created_at, updated_at")
      .eq("role", "admin")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching admin profiles:", error);
      return NextResponse.json(
        { error: "Failed to fetch admins" },
        { status: 500 },
      );
    }

    // Add super admin flag to each profile
    const adminsWithFlags = adminProfiles.map((profile: any) => ({
      ...profile,
      is_super_admin: isSuperAdmin(profile.email),
    }));

    // Separate super admin from regular admins
    const superAdmin = adminsWithFlags.filter(
      (profile: any) => profile.is_super_admin,
    );
    const regularAdmins = adminsWithFlags.filter(
      (profile: any) => !profile.is_super_admin,
    );

    return NextResponse.json({
      success: true,
      super_admin: superAdmin[0] || null,
      admins: regularAdmins,
      total_count: adminsWithFlags.length,
      super_admin_exists: superAdmin.length > 0,
      regular_admin_count: regularAdmins.length,
    });
  } catch (error) {
    console.error("Admin list error:", error);
    return NextResponse.json(
      { error: "Failed to list admins" },
      { status: 500 },
    );
  }
}
