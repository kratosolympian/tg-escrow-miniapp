export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithCookies } from "@/lib/supabaseServer";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClientWithCookies();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Auth status error:", error);
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
