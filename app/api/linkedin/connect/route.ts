import "server-only";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeUrl } from "../../../../lib/linkedin";

export const dynamic = "force-dynamic";

// Sits behind the dashboard password (middleware protects everything except /login, /s/ and /api/cron/).
// Visit this once to authorize, and again whenever the token needs renewing.
export async function GET() {
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("li_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/api/linkedin" });
  return res;
}
