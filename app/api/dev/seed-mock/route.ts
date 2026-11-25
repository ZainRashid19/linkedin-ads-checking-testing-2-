import "server-only";
import { timingSafeEqual } from "node:crypto";
import postgres from "postgres";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Demo-only: fills li_ads_daily / li_ad_sets_daily with synthetic rows plus a fake sync_log row, so the Ads page
// looks like LinkedIn Ads automation is live without any real LinkedIn credentials. Every mock row's campaign_id
// starts with "mock-", so ?action=clear (or the cleanup below) removes exactly these and nothing real.
// Needs SEED_SECRET set in the environment. Visit /api/dev/seed-mock?key=<SEED_SECRET> once after deploy;
// visit again with &action=clear to remove the mock rows before pointing the dashboard at real data.
function timingSafeMatch(given: string, want: string): boolean {
  const a = Buffer.from(given), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

const CAMPAIGNS = [
  { id: "mock-1", name: "Sales Planning Modernization — demo gen", obj: "WEBSITE_CONVERSIONS" },
  { id: "mock-2", name: "Revenue by Design book offer", obj: "LEAD_GENERATION" },
  { id: "mock-3", name: "Thought Leader ads (Hassan)", obj: "ENGAGEMENT" },
];

function* mockRows(days = 21) {
  const today = new Date();
  for (let d = 0; d < days; d++) {
    const day = new Date(today.getTime() - d * 86400000).toISOString().slice(0, 10);
    for (const c of CAMPAIGNS) {
      const impressions = 400 + Math.round(Math.random() * 900);
      const clicks = Math.round(impressions * (0.006 + Math.random() * 0.01));
      const leads = Math.random() < 0.35 ? Math.round(Math.random() * 2) : 0;
      yield {
        day, campaign_id: c.id, campaign_name: c.name, campaign_status: "ACTIVE",
        ad_set_id: `${c.id}-set-1`, ad_set_name: `${c.name} — ad set`, objective: c.obj,
        ad_id: `${c.id}-ad-1`, ad_name: `${c.name} — ad`, ad_status: "ACTIVE",
        ad_headline: "Mock headline for design review", ad_text: "Mock ad copy — seeded for demo, not real spend.", post_type: "SPONSORED_UPDATE",
        spend: Number((clicks * (1.2 + Math.random())).toFixed(2)), impressions, clicks,
        reactions: Math.round(clicks * 0.4), comments: Math.round(clicks * 0.05), shares: Math.round(clicks * 0.03), follows: Math.round(clicks * 0.02),
        total_engagements: Math.round(clicks * 1.5), leads, conversions: leads,
        reach: Math.round(impressions * 0.8), video_views: 0, landing_page_clicks: clicks,
      };
    }
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.SEED_SECRET ?? "";
  const given = req.nextUrl.searchParams.get("key") ?? "";
  if (!secret || !given || !timingSafeMatch(given, secret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, connect_timeout: 15, onnotice: () => {} });
  try {
    if (req.nextUrl.searchParams.get("action") === "clear") {
      await sql.begin(async tx => {
        await tx`delete from li_ads_daily where campaign_id like 'mock-%'`;
        await tx`delete from li_ad_sets_daily where campaign_id like 'mock-%'`;
        await tx`delete from sync_log where source = 'linkedin_ads' and message = 'mock demo data'`;
      });
      return NextResponse.json({ ok: true, message: "Mock LinkedIn Ads rows removed." });
    }

    const rows = [...mockRows()];
    const sets = new Map<string, any>();
    for (const r of rows) {
      const key = `${r.day}|${r.campaign_id}|${r.ad_set_id}`;
      const { ad_id, ad_name, ad_status, ad_headline, ad_text, post_type, ...base } = r;
      if (!sets.has(key)) sets.set(key, { ...base });
    }
    await sql.begin(async tx => {
      await tx`delete from li_ads_daily where campaign_id like 'mock-%'`;
      await tx`delete from li_ad_sets_daily where campaign_id like 'mock-%'`;
      for (let i = 0; i < rows.length; i += 200) await tx`insert into li_ads_daily ${tx(rows.slice(i, i + 200))}`;
      const setRows = [...sets.values()];
      for (let i = 0; i < setRows.length; i += 200) await tx`insert into li_ad_sets_daily ${tx(setRows.slice(i, i + 200))}`;
      await tx`insert into sync_log (source, ok, rows, message) values ('linkedin_ads', true, ${rows.length}, 'mock demo data')`;
    });
    return NextResponse.json({ ok: true, message: `Seeded ${rows.length} mock ad rows across ${CAMPAIGNS.length} campaigns, 21 days. Visit /ads to see it.` });
  } finally {
    await sql.end({ timeout: 2 });
  }
}
