import { run } from "../../lib/db";
import { Header } from "../../components/header";
import { Filter } from "../../components/filter";
import { Delta, Kpi, Section, Th } from "../../components/kit";
import { BarList, Empty, LineChart } from "../../components/charts";
import { daysBetween, int, longDay, pct, usd } from "../../lib/format";
import { getRange, type Search } from "../../lib/range";

export const dynamic = "force-dynamic";

type Camp = { campaign_name: string; spend: number; impressions: number; clicks: number; leads: number };

export default async function Ads({ searchParams }: { searchParams: Promise<Search> }) {
  const { min, max, from, to, prev, hasPrev } = await getRange(await searchParams);
  const [camps, daily, creatives, audAds, prevRows, sync] = await Promise.all([
    run<Camp>("ads_by_campaign", from, to),
    run<{ day: string; spend: number; clicks: number; impressions: number }>("ads_daily", from, to),
    run<{ campaign: string; copy: string; spend: number; impressions: number; clicks: number }>("ads_creatives", from, to),
    run<{ dimension: string; segment: string; impressions: number; clicks: number }>("audience_ads"),
    run<Camp>("ads_by_campaign", prev.from, prev.to),
    run<{ source: string; ran_at: string }>("sync_status"),
  ]);
  const liSync = sync.find(s => s.source === "linkedin_ads")?.ran_at;
  const syncStamp = (t?: string) => (t ? new Date(t).toLocaleString("en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" }) + " ET" : null);
  const sum = (rows: Camp[], k: "spend" | "impressions" | "clicks" | "leads") => rows.reduce((a, c) => a + c[k], 0);
  const spend = sum(camps, "spend"), imp = sum(camps, "impressions"), clicks = sum(camps, "clicks"), leads = sum(camps, "leads");
  const p = hasPrev ? prevRows : null;
  const ctr = imp ? (clicks / imp) * 100 : null;
  const top = camps[0];
  const title = top && clicks
    ? `${top.campaign_name} drew ${int(top.clicks)} of ${int(clicks)} clicks on ${pct((top.spend / spend) * 100, 0)} of spend`
    : "No ad activity in this date range";
  const dims = (name: string) => audAds.filter(a => a.dimension === name);

  return (
    <div className="min-h-screen">
      <Header active="/ads" subtitle={`Ads: ${longDay(from)} to ${longDay(to)} · ${daysBetween(from, to)} days · data through ${longDay(max)}`} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <Filter path="/ads" min={min} max={max} from={from} to={to} note={`Paid LinkedIn ads from Campaign Manager (ads started Oct 12). The date filter applies to spend, campaigns and ads, not to the audience breakdowns. ${liSync ? `Synced automatically, last on ${syncStamp(liSync)}.` : "Not yet synced automatically — loaded from a manual CSV export."}`} />

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Ad spend" value={usd(spend)} delta={<Delta now={spend} before={p ? sum(p, "spend") : null} />} />
          <Kpi label="Ad impressions" value={int(imp)} delta={<Delta now={imp} before={p ? sum(p, "impressions") : null} />} />
          <Kpi label="Clicks" value={int(clicks)} delta={<Delta now={clicks} before={p ? sum(p, "clicks") : null} />} note={clicks ? `${usd(spend / clicks)} per click · ${pct(ctr, 2)} click rate` : undefined} />
          <Kpi label="Leads" value={int(leads)} note="From LinkedIn lead forms or conversions" />
        </section>

        {leads === 0 && spend > 0 && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Ads recorded {int(clicks)} clicks and 0 leads. Lead forms or conversion tracking may not be set up on these campaigns, so leads can't be measured yet.
          </p>
        )}

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title={title} kicker="Clicks by ad campaign">
            <BarList rows={camps.map(c => ({ label: c.campaign_name, value: c.clicks, note: `${usd(c.spend)} · ${int(c.impressions)} impr.` }))} />
          </Section>
          <Section title="Ad spend per day" kicker="US dollars">
            <LineChart points={daily.map(r => ({ x: r.day, y: r.spend }))} color="#2660a2" />
          </Section>
        </section>

        <section className="card">
          <h2 className="font-semibold">Ads, one row each</h2>
          <p className="kicker mb-3">Sorted by clicks. All ads are boosted organic posts.</p>
          {creatives.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-slate-500"><Th>Ad copy</Th><Th>Campaign</Th><Th right>Spend</Th><Th right>Impressions</Th><Th right>Clicks</Th><Th right>CTR</Th><Th right>Cost per click</Th></tr></thead>
                <tbody>
                  {creatives.map((c, i) => (
                    <tr key={i} className="border-b border-slate-100 align-top">
                      <td className="max-w-xs py-2 pr-3">{c.copy.replace(/\s+/g, " ")}…</td>
                      <td className="py-2 pr-3 text-slate-600">{c.campaign}</td>
                      <td className="num py-2 pr-3 text-right">{usd(c.spend)}</td>
                      <td className="num py-2 pr-3 text-right">{int(c.impressions)}</td>
                      <td className="num py-2 pr-3 text-right">{int(c.clicks)}</td>
                      <td className="num py-2 pr-3 text-right">{pct(c.impressions ? (c.clicks / c.impressions) * 100 : null, 2)}</td>
                      <td className="num py-2 text-right">{c.clicks ? usd(c.spend / c.clicks) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty />}
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title="Who sees your ads" kicker="Impressions by seniority (top segments LinkedIn reports)">
            <BarList rows={dims("Job Seniority").map(r => ({ label: r.segment.replace(/^"|"$/g, ""), value: r.impressions }))} />
            <p className="kicker mb-3 mt-5">Impressions by industry</p>
            <BarList rows={dims("Company Industry").slice(0, 6).map(r => ({ label: r.segment.replace(/^"|"$/g, ""), value: r.impressions }))} />
          </Section>
          <Section title="Companies seeing your ads" kicker="Top companies by impressions. LinkedIn lists only 25 and hides small ones. The Accounts page has the full list.">
            <BarList rows={dims("Company Name").map(r => ({ label: r.segment.replace(/^"|"$/g, ""), value: r.impressions, note: r.clicks ? `${r.clicks} clicks` : undefined }))} />
          </Section>
        </section>

        <footer className="card text-sm text-slate-600">
          <ul className="list-disc space-y-1 pl-5">
            <li>Samples are small (about three weeks of ads). Treat differences between campaigns as early signals.</li>
            <li>The most recent day is often incomplete.</li>
          </ul>
        </footer>
      </main>
    </div>
  );
}
