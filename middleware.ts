import { NextRequest, NextResponse } from "next/server";
import { COOKIE, SHARE_COOKIE, shareExpiry, validSession } from "./lib/auth";

// Every page except /login, the /s/ share-link entrance and /api/cron/ (which checks its own secret) needs the password cookie or an unexpired share cookie. Nothing is fetched from the database before this check passes.
export async function middleware(req: NextRequest) {
  if (await validSession(req.cookies.get(COOKIE)?.value)) return NextResponse.next();
  if (await shareExpiry(req.cookies.get(SHARE_COOKIE)?.value)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!login|s/|api/cron/|_next/static|_next/image|favicon.ico|icon.svg).*)"] };
