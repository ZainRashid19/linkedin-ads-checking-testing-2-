import { run } from "../../lib/db";
import { Header } from "../../components/header";
import { BarList, Empty } from "../../components/charts";
import { int, longDay } from "../../lib/format";

export const dynamic = "force-dynamic";

type Summary = { level: string; companies: number; organic_impressions: number; organic_engagements: number; paid_impressions: number; paid_clicks: number; snapshot: string; window_days: number | null };
type Top = { company: string; page_url: string | null; level: string; organic_impressions: number; organic_engagements: number; paid_impressions: number; paid_clicks: number; paid_engagements: number };
type Mover = { company: string; page_url: string | null; was: string; now: string; organic_change: number; paid_change: number };

const LEVEL_STYLE: Record<string, string> = {
  "Very High": "bg-green-100 text-green-800", High: "bg-green-50 text-green-800", Medium: "bg-blue-50 text-blue-800",
  Low: "bg-slate-100 text-slate-700", "Very Low": "bg-slate-100 text-slate-500",
};

export default async function Accounts() {
  const [summary, top, reach, movers] = await Promise.all([
    run<Summary>("companies_summary"),
    run<Top>("companies_top"),
    run<{ engaged_organic: number; saw_ads: number; both: number; total: number }>("companies_reach"),
    run<Mover>("companies_movers"),
  ]);
  const r = reach[0];
  const snap = summary[0]?.snapshot, win = summary[0]?.window_days;
  const level = (name: string) => summary.find(s => s.level === name)?.companies ?? 0;
  const warm = level("Very High") + level("High") + level("Medium");

  return (
    <div className="min-h-screen">
      <Header active="/accounts" subtitle={snap ? `Company engagement, ${win ? `last ${win} days, ` : ""}export of ${longDay(snap)}` : "No company data loaded"} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {!snap ? <Empty /> : (<>
          <section className="card">
            <p className="kicker">Companies with at least Medium engagement, out of {int(r.total)} LinkedIn found</p>
            <p className="num text-5xl font-semibold text-[var(--navy)]">{int(warm)}</p>
            <p className="mt-1 text-sm text-slate-600">
              {int(r.engaged_organic)} companies engaged with your posts and {int(r.saw_ads)} saw your ads. {int(r.both)} did both.
              These are the accounts to look at first for outreach.
            </p>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card">
              <h2 className="font-semibold">Companies by engagement level</h2>
              <p className="kicker mb-3">LinkedIn's own rating of how engaged each company is with you</p>
              <BarList rows={summary.map(s => ({ label: s.level, value: s.companies }))} />
            </div>
            <div className="card">
              <h2 className="font-semibold">Which companies are heating up</h2>
              <p className="kicker mb-3">Compares each export with the one before it</p>
              {movers.length ? (
                <ul className="space-y-1 text-sm">
                  {movers.slice(0, 10).map(m => (
                    <li key={m.company} className="flex justify-between gap-3 border-b border-slate-100 py-1">
                      <span>{m.company} <span className="text-slate-500">({m.was} to {m.now})</span></span>
                      <span className="num text-green-700">{m.organic_change > 0 ? `+${m.organic_change} engagements` : `+${int(m.paid_change)} ad impressions`}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  Only one {win ? `${win}-day ` : ""}export is loaded, so there's nothing to compare yet. Export the same report again next week (same {win ? `"Last ${win} days"` : ""} setting), drop it in the data folder, and
                  rising and cooling companies will show here.
                </p>
              )}
            </div>
          </section>

          <section className="card">
            <h2 className="font-semibold">Most engaged companies</h2>
            <p className="kicker mb-3">Ranked by LinkedIn level, then engagements with your posts, then ad impressions. Top 40.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-3 font-medium">Company</th><th className="py-2 pr-3 font-medium">Level</th>
                  <th className="num py-2 pr-3 text-right font-medium">Post impressions</th><th className="num py-2 pr-3 text-right font-medium">Post engagements</th>
                  <th className="num py-2 pr-3 text-right font-medium">Ad impressions</th><th className="num py-2 text-right font-medium">Ad engagements</th>
                </tr></thead>
                <tbody>
                  {top.map(c => (
                    <tr key={c.company + (c.page_url ?? "")} className="border-b border-slate-100">
                      <td className="py-2 pr-3">{c.page_url ? <a href={c.page_url} target="_blank" rel="noreferrer" className="text-[var(--blue)] underline">{c.company}</a> : c.company}</td>
                      <td className="py-2 pr-3"><span className={`rounded-full px-2 py-0.5 text-xs ${LEVEL_STYLE[c.level] ?? ""}`}>{c.level}</span></td>
                      <td className="num py-2 pr-3 text-right">{int(c.organic_impressions)}</td>
                      <td className="num py-2 pr-3 text-right">{int(c.organic_engagements)}</td>
                      <td className="num py-2 pr-3 text-right">{int(c.paid_impressions)}</td>
                      <td className="num py-2 text-right">{int(c.paid_engagements)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="card text-sm text-slate-600">
            <h2 className="mb-2 font-semibold text-slate-800">Read this before acting on it</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>{win ? `Each export covers the last ${win} days, so these are one week's numbers, not totals since launch. Companies that engaged earlier can drop out of the list.` : "The export doesn't state its date range."} The MQLs page shows the highest level a company has reached in any export.</li>
              <li>LinkedIn only lists companies it can identify. Ad impressions here are a small share of all ad impressions.</li>
              <li>Most companies sit at Very Low. Medium and above is where to focus.</li>
              <li>Dripify and ManyReach don't report company, so outreach can't yet be matched to these accounts.</li>
            </ul>
          </footer>
        </>)}
      </main>
    </div>
  );
}
