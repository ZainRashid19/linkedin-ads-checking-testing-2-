// Pulls campaign totals from the ManyReach API into manyreach_campaigns. Self-contained so the cron route and scripts/sync.mjs can both run it.
// Needs MANYREACH_API_KEY. Rate limit is 60 requests per minute; a run makes one request per campaign plus one.
import type { Sql } from "postgres";

const BASE = "https://api.manyreach.com/api/v2";
type Campaign = { campaignId: number; name: string; createdAt: string; prospectCount: number; sentCount: number; bounceCount: number; openCount: number; replyCount: number; interestedCount: number };
type Stats = { timeline?: string[] };

async function get<T>(path: string, key: string): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(BASE + path, { headers: { "X-API-Key": key, Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
    if (r.status === 429 && attempt < 2) { await new Promise(res => setTimeout(res, 20000)); continue; }
    if (!r.ok) throw new Error(`ManyReach ${path} returned ${r.status}`);
    return (await r.json()) as T;
  }
  throw new Error(`ManyReach ${path} stayed rate limited`);
}
const day = (iso?: string) => (iso ? iso.slice(0, 10) : null);

export async function syncManyReach(sql: Sql): Promise<{ rows: number; message: string }> {
  const key = process.env.MANYREACH_API_KEY;
  if (!key) throw new Error("MANYREACH_API_KEY is not set");
  const list = await get<{ items: Campaign[]; pagination?: { totalItems?: number } }>("/campaigns", key);
  const total = list.pagination?.totalItems ?? list.items.length;
  const out: { campaign: string; first_day: string | null; last_day: string | null; reached: number; opened: number; replied: number; interested: number }[] = [];
  for (const c of list.items) {
    await new Promise(res => setTimeout(res, 1500));
    const stats = await get<Stats>(`/campaigns/${c.campaignId}/stats`, key);
    const days = (stats.timeline ?? []).map(day).filter(Boolean) as string[];
    out.push({
      campaign: `${c.name} (ManyReach)`, first_day: days[0] ?? day(c.createdAt), last_day: days.at(-1) ?? day(c.createdAt),
      // "Reached" in ManyReach's report is people emailed minus bounces.
      reached: c.sentCount - c.bounceCount, opened: c.openCount, replied: c.replyCount, interested: c.interestedCount,
    });
  }
  await sql.begin(async tx => {
    for (const r of out) {
      // positive_replies and opportunities are only overwritten when ManyReach has a value (someone marked replies Interested).
      const updated = await tx`update manyreach_campaigns set first_day = ${r.first_day}, last_day = ${r.last_day}, reached = ${r.reached}, opened = ${r.opened},
        replied = ${r.replied}, positive_replies = case when ${r.interested} > 0 then ${r.interested} else positive_replies end, source = 'ManyReach API'
        where campaign = ${r.campaign}`;
      if (updated.count === 0)
        await tx`insert into manyreach_campaigns (campaign, first_day, last_day, reached, opened, replied, opportunities_usd, source, positive_replies)
          values (${r.campaign}, ${r.first_day}, ${r.last_day}, ${r.reached}, ${r.opened}, ${r.replied}, 0, 'ManyReach API', ${r.interested > 0 ? r.interested : null})`;
    }
  });
  return { rows: out.length, message: total > out.length ? `Loaded ${out.length} of ${total} campaigns (more pages not read)` : `${out.length} campaigns` };
}
