export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const cookie = request.headers.get("cookie");
    return NextResponse.json({ cookie: cookie || null });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[API] debug/cookies error", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
