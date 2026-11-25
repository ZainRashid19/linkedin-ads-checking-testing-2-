// Pulls campaign totals from the Dripify Open API into dripify_stats (current totals) and dripify_snapshots (history).
// Needs DRIPIFY_API_KEY. Read-only calls only. Limits: 60 requests per minute, 5,000 per day. A run makes one request per campaign plus one.
// The API reports totals, not periods: contactedLeads = invites sent, acceptanceRateLeads = accepted, replyRateLeads = replied.
// It does not report messages sent for invite campaigns, so that column is empty for them.
import type { Sql } from "postgres";

const BASE = "https://api.dripify.com/v1/open-api";
// Campaigns that message existing connections instead of sending connection invites. Dripify does not say which are which,
// so they are listed here (lower case, exact name). For these, contacted people count as messages sent, not invites.
const MESSAGE_ONLY = ["dec 3 event"];
type Campaign = { id: number; name: string; status: string; createdAt: string };
type Stats = { totalLeads: number; contactedLeads: number; acceptanceRateLeads: number; replyRateLeads: number };

async function get<T>(path: string, key: string): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(BASE + path, { headers: { "X-Api-Key": key, Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
    if (r.status === 429 && attempt < 2) { await new Promise(res => setTimeout(res, (Number(r.headers.get("retry-after")) || 20) * 1000)); continue; }
    if (!r.ok) throw new Error(`Dripify ${path.split("?")[0]} returned ${r.status}`);
    return (await r.json()) as T;
  }
  throw new Error("Dripify stayed rate limited");
}

export async function syncDripify(sql: Sql): Promise<{ rows: number; message: string }> {
  const key = process.env.DRIPIFY_API_KEY;
  if (!key) throw new Error("DRIPIFY_API_KEY is not set");
  const list = await get<{ items: Campaign[] }>("/campaigns?limit=100", key);
  const today = new Date().toISOString().slice(0, 10);
  const out: { id: number; status: string; campaign: string; start: string; messageOnly: boolean; leads: number; invites: number; accepted: number; replied: number }[] = [];
  for (const c of list.items) {
    await new Promise(res => setTimeout(res, 1200));
    const s = await get<Stats>(`/campaigns/${c.id}/statistics`, key);
    if (!s.contactedLeads) continue; // campaigns nobody has been contacted by are not outreach yet
    out.push({ id: c.id, status: c.status, campaign: `${c.name} (Dripify)`, start: c.createdAt.slice(0, 10), messageOnly: MESSAGE_ONLY.includes(c.name.trim().toLowerCase()), leads: s.totalLeads, invites: s.contactedLeads, accepted: s.acceptanceRateLeads, replied: s.replyRateLeads });
  }
  if (!out.length) throw new Error("Dripify returned no campaigns with outreach; kept existing data");
  await sql.begin(async tx => {
    await tx`delete from dripify_stats`;
    for (const r of out) {
      await tx`insert into dripify_stats (campaign, source_file, period_type, period_start, period_end, invites_sent, invites_accepted, messaged, leads_replied)
        values (${r.campaign}, 'Dripify API', 'total', ${r.start}, ${today}, ${r.messageOnly ? null : r.invites}, ${r.messageOnly ? null : r.accepted}, ${r.messageOnly ? r.invites : null}, ${r.replied})`;
      await tx`insert into dripify_snapshots (campaign_id, campaign, status, total_leads, contacted, accepted, replied)
        values (${r.id}, ${r.campaign}, ${r.status}, ${r.leads}, ${r.invites}, ${r.accepted}, ${r.replied})`;
    }
  });
  return { rows: out.length, message: `${out.length} campaigns` };
}
