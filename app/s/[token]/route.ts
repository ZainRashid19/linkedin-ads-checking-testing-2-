import { NextRequest, NextResponse } from "next/server";
import { SHARE_COOKIE, shareExpiry } from "../../../lib/auth";

// Entrance for an expiring share link. A good link sets a cookie that lasts until the link's own expiry, then opens the dashboard.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const exp = await shareExpiry(token);
  const to = req.nextUrl.clone();
  to.search = "";
  if (!exp) { to.pathname = "/login"; return NextResponse.redirect(to); }
  to.pathname = "/";
  const res = NextResponse.redirect(to);
  res.cookies.set(SHARE_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: Math.floor((exp - Date.now()) / 1000),
  });
  return res;
}
