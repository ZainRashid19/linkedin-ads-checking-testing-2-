import "server-only";
import { timingSafeEqual } from "node:crypto";
import postgres from "postgres";
import { NextRequest, NextResponse } from "next/server";
import { runSync } from "../../../../lib/sync/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called by Vercel Cron, which sends "Authorization: Bearer <CRON_SECRET>". Anyone else gets 401 before anything runs.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (!secret || given.length !== want.length || !timingSafeEqual(Buffer.from(given), Buffer.from(want)))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, connect_timeout: 15, onnotice: () => {} });
  try {
    return NextResponse.json({ results: await runSync(sql, req.nextUrl.searchParams.get("source") ?? undefined) });
  } finally {
    await sql.end({ timeout: 2 });
  }
}
