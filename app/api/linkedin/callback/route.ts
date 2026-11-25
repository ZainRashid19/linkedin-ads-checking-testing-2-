import "server-only";
import postgres from "postgres";
import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, saveTokens } from "../../../../lib/linkedin";

export const dynamic = "force-dynamic";

// LinkedIn redirects the browser here after the person approves the consent screen.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error_description") ?? req.nextUrl.searchParams.get("error");
  const expected = req.cookies.get("li_oauth_state")?.value;
  if (error) return NextResponse.json({ ok: false, error }, { status: 400 });
  if (!code || !state || !expected || state !== expected)
    return NextResponse.json({ ok: false, error: "Missing or mismatched state. Start again at /api/linkedin/connect." }, { status: 400 });

  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, connect_timeout: 15, onnotice: () => {} });
  try {
    const tokens = await exchangeCode(code);
    await saveTokens(sql, tokens);
    const res = NextResponse.json({ ok: true, message: "LinkedIn Ads authorized. The next scheduled sync will use this token.", scope: tokens.scope ?? null });
    res.cookies.delete("li_oauth_state");
    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Authorization failed" }, { status: 500 });
  } finally {
    await sql.end({ timeout: 2 });
  }
}
