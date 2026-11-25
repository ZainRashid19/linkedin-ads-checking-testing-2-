// Pulls daily ad performance from the LinkedIn Ads Reporting API into li_ads_daily and li_ad_sets_daily.
// Needs LINKEDIN_AD_ACCOUNT_ID and an authorized token (see ../linkedin.ts; authorize once at /api/linkedin/connect).
// LinkedIn's object model: Campaign Group = our "campaign", Campaign = our "ad set", Creative = our "ad".
// Field names below are LinkedIn's documented Ad Analytics fields as of this writing — verify against a live response
// once real API access is granted (Development tier apps can return a reduced field set until reviewed).
import type { Sql } from "postgres";
import { getAccessToken } from "../linkedin";

const API = "https://api.linkedin.com/rest";
const VERSION = "202501"; // LinkedIn REST APIs are versioned by month; bump if LinkedIn deprecates this one.
const LOOKBACK_DAYS = 14; // re-pulls the last two weeks each run so late-arriving/corrected data gets picked up

async function li<T>(path: string, token: string): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "LinkedIn-Version": VERSION, "X-Restli-Protocol-Version": "2.0.0" },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`LinkedIn ${path.split("?")[0]} returned ${r.status}: ${await r.text()}`);
  return (await r.json()) as T;
}

const idOf = (urn: string) => urn.split(":").pop()!;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const dateParam = (d: Date) => `(year:${d.getUTCFullYear()},month:${d.getUTCMonth() + 1},day:${d.getUTCDate()})`;

type AnalyticsRow = {
  dateRange: { start: { year: number; month: number; day: number } };
  pivotValues: string[]; // [creative URN] when pivot=CREATIVE
  impressions?: number; clicks?: number; costInLocalCurrency?: string;
  likes?: number; comments?: number; shares?: number; follows?: number;
  oneClickLeads?: number; externalWebsiteConversions?: number; landingPageClicks?: number; videoViews?: number;
  approximateMemberReach?: number; totalEngagements?: number;
};

async function fetchAnalytics(token: string, accountId: string, start: Date, end: Date): Promise<AnalyticsRow[]> {
  const fields = ["dateRange", "pivotValues", "impressions", "clicks", "costInLocalCurrency", "likes", "comments", "shares",
    "follows", "oneClickLeads", "externalWebsiteConversions", "landingPageClicks", "videoViews", "approximateMemberReach", "totalEngagements"].join(",");
  const q = `q=analytics&pivot=CREATIVE&timeGranularity=DAILY&accounts=List(urn%3Ali%3AsponsoredAccount%3A${accountId})` +
    `&dateRange=(start:${dateParam(start)},end:${dateParam(end)})&fields=${fields}`;
  const out: AnalyticsRow[] = [];
  let start_ = 0;
  for (;;) {
    const page = await li<{ elements: AnalyticsRow[]; paging: { start: number; count: number; total?: number } }>(
      `/adAnalytics?${q}&start=${start_}&count=100`, token);
    out.push(...page.elements);
    if (page.elements.length < 100) break;
    start_ += 100;
  }
  return out;
}

// Creative -> (campaign, campaign group) lookup, batched. LinkedIn caps batch GETs at ~20 ids per call.
async function fetchCreativeContext(token: string, creativeIds: string[]) {
  const creatives = new Map<string, { campaignId: string; name: string | null; type: string | null; intro: string | null; headline: string | null }>();
  for (let i = 0; i < creativeIds.length; i += 20) {
    const batch = creativeIds.slice(i, i + 20);
    const ids = batch.map(id => `urn:li:sponsoredCreative:${id}`).join(",");
    const res = await li<{ results: Record<string, any> }>(`/creatives?ids=List(${encodeURIComponent(ids)})`, token);
    for (const [urn, c] of Object.entries(res.results ?? {})) {
      creatives.set(idOf(urn), {
        campaignId: idOf(c.campaign ?? ""),
        name: c.name ?? null,
        type: c.type ?? null,
        intro: c.content?.reference ? null : (c.inlineContent?.textAd?.text ?? null),
        headline: c.inlineContent?.textAd?.headline ?? null,
      });
    }
  }
  const campaignIds = [...new Set([...creatives.values()].map(c => c.campaignId).filter(Boolean))];
  const campaigns = new Map<string, { name: string; status: string; groupId: string }>();
  for (let i = 0; i < campaignIds.length; i += 20) {
    const batch = campaignIds.slice(i, i + 20);
    const ids = batch.map(id => `urn:li:sponsoredCampaign:${id}`).join(",");
    const res = await li<{ results: Record<string, any> }>(`/adCampaigns?ids=List(${encodeURIComponent(ids)})`, token);
    for (const [urn, c] of Object.entries(res.results ?? {}))
      campaigns.set(idOf(urn), { name: c.name, status: c.status, groupId: idOf(c.campaignGroup ?? "") });
  }
  const groupIds = [...new Set([...campaigns.values()].map(c => c.groupId).filter(Boolean))];
  const groups = new Map<string, string>();
  for (let i = 0; i < groupIds.length; i += 20) {
    const batch = groupIds.slice(i, i + 20);
    const ids = batch.map(id => `urn:li:sponsoredCampaignGroup:${id}`).join(",");
    const res = await li<{ results: Record<string, any> }>(`/adCampaignGroups?ids=List(${encodeURIComponent(ids)})`, token);
    for (const [urn, g] of Object.entries(res.results ?? {})) groups.set(idOf(urn), g.name);
  }
  return { creatives, campaigns, groups };
}

export async function syncLinkedInAds(sql: Sql): Promise<{ rows: number; message: string }> {
  const accountId = process.env.LINKEDIN_AD_ACCOUNT_ID;
  if (!accountId) throw new Error("LINKEDIN_AD_ACCOUNT_ID is not set");
  const token = await getAccessToken(sql);

  const end = new Date();
  const start = new Date(end.getTime() - LOOKBACK_DAYS * 86400000);
  const analytics = await fetchAnalytics(token, accountId, start, end);
  if (!analytics.length) return { rows: 0, message: "No ad activity in the lookback window" };

  const creativeIds = [...new Set(analytics.map(a => idOf(a.pivotValues[0])))];
  const { creatives, campaigns, groups } = await fetchCreativeContext(token, creativeIds);

  const rows = analytics.map(a => {
    const creativeId = idOf(a.pivotValues[0]);
    const creative = creatives.get(creativeId);
    const campaign = creative ? campaigns.get(creative.campaignId) : undefined;
    const groupName = campaign ? groups.get(campaign.groupId) : undefined;
    const d = a.dateRange.start;
    return {
      day: `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`,
      campaign_id: campaign?.groupId ?? null, campaign_name: groupName ?? null, campaign_status: campaign?.status ?? null,
      ad_set_id: creative?.campaignId ?? null, ad_set_name: campaign?.name ?? null, objective: null,
      ad_id: creativeId, ad_name: creative?.name ?? null, ad_status: null, ad_headline: creative?.headline ?? null,
      ad_text: creative?.intro ?? null, post_type: creative?.type ?? null,
      spend: a.costInLocalCurrency ? Number(a.costInLocalCurrency) : 0, impressions: a.impressions ?? 0, clicks: a.clicks ?? 0,
      reactions: a.likes ?? 0, comments: a.comments ?? 0, shares: a.shares ?? 0, follows: a.follows ?? 0,
      total_engagements: a.totalEngagements ?? ((a.likes ?? 0) + (a.comments ?? 0) + (a.shares ?? 0) + (a.follows ?? 0) + (a.clicks ?? 0)),
      leads: a.oneClickLeads ?? 0, conversions: a.externalWebsiteConversions ?? 0, reach: a.approximateMemberReach ?? null,
      video_views: a.videoViews ?? 0, landing_page_clicks: a.landingPageClicks ?? 0,
    };
  });

  const adSets = new Map<string, Record<string, any>>();
  for (const r of rows) {
    const key = `${r.day}|${r.campaign_id}|${r.ad_set_id}`;
    const { ad_id, ad_name, ad_status, ad_headline, ad_text, post_type, ...base } = r;
    if (!adSets.has(key)) adSets.set(key, { ...base });
    const s = adSets.get(key)!;
    for (const k of ["spend", "impressions", "clicks", "reactions", "comments", "shares", "follows", "total_engagements", "leads", "conversions", "video_views", "landing_page_clicks"])
      s[k] = (s[k] ?? 0) + (r as any)[k];
    if (r.reach != null) s.reach = (s.reach ?? 0) + r.reach;
  }

  const days = rows.map(r => r.day).sort();
  const from = days[0]!, to = days.at(-1)!;
  await sql.begin(async tx => {
    await tx`delete from li_ads_daily where day between ${from} and ${to}`;
    await tx`delete from li_ad_sets_daily where day between ${from} and ${to}`;
    for (let i = 0; i < rows.length; i += 200) await tx`insert into li_ads_daily ${tx(rows.slice(i, i + 200))}`;
    const setRows = [...adSets.values()];
    for (let i = 0; i < setRows.length; i += 200) await tx`insert into li_ad_sets_daily ${tx(setRows.slice(i, i + 200))}`;
  });
  return { rows: rows.length, message: `${rows.length} ad rows (${creativeIds.length} ads) from ${ymd(start)} to ${ymd(end)}` };
}
