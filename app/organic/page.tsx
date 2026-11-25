import { run } from "../../lib/db";
import { Header } from "../../components/header";
import { Filter } from "../../components/filter";
import { Delta, Kpi, Section, Th } from "../../components/kit";
import { BarList, Columns, Empty, LineChart } from "../../components/charts";
import { daysBetween, int, longDay, pct, shortDay } from "../../lib/format";
import { getRange, type Search } from "../../lib/range";

export const dynamic = "force-dynamic";

export default async function Organic({ searchParams }: { searchParams: Promise<Search> }) {
  const { min, max, from, to, prev, hasPrev } = await getRange(await searchParams);
  const [daily, tot, fol, folWeekly, audFol, posts, totPrevRows, folPrevRows] = await Promise.all([
    run<{ day: string; impressions: number; engagements: number }>("organic_daily", from, to),
    run<{ impressions: number; engagements: number }>("organic_totals", from, to),
    run<{ gained: number }>("followers_total", from, to),
    run<{ week: string; new_followers: number }>("followers_weekly", from, to),
    run<{ category: string; value: string; percent: number }>("audience_followers"),
    run<{ post_date: string; post_url: string; impressions: number; engagements: number }>("top_posts", from, to),
    run<{ impressions: number; engagements: number }>("organic_totals", prev.from, prev.to),
    run<{ gained: number }>("followers_total", prev.from, prev.to),
  ]);
  const totPrev = hasPrev ? totPrevRows[0] : null;
  const folPrev = hasPrev ? folPrevRows[0] : null;
  const imp = tot[0].impressions, eng = tot[0].engagements;
  const rate = imp ? (eng / imp) * 100 : null;
  const ratePrev = totPrev && totPrev.impressions ? (totPrev.engagements / totPrev.impressions) * 100 : null;
  const peak = daily.length ? daily.reduce((a, b) => (b.impressions > a.impressions ? b : a)) : null;
  const bestWeek = folWeekly.length ? folWeekly.reduce((a, b) => (b.new_followers > a.new_followers ? b : a)) : null;
  const cats = (name: string) => audFol.filter(a => a.category === name);

  return (
    <div className="min-h-screen">
      <Header active="/organic" subtitle={`Organic: ${longDay(from)} to ${longDay(to)} · ${daysBetween(from, to)} days · data through ${longDay(max)}`} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <Filter path="/organic" min={min} max={max} from={from} to={to} note="Unpaid LinkedIn activity on Hassan Mahmood's profile. The date filter applies to everything except the follower breakdowns." />

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Kpi label="Organic impressions" value={int(imp)} delta={<Delta now={imp} before={totPrev?.impressions ?? null} />} />
          <Kpi label="Engagement rate" value={pct(rate)} delta={<Delta now={rate ?? 0} before={ratePrev} points />} note={`${int(eng)} engagements on ${int(imp)} impressions`} />
          <Kpi label="New followers" value={int(fol[0].gained)} delta={<Delta now={fol[0].gained} before={folPrev?.gained ?? null} />} />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title={peak ? `Organic reach peaked on ${shortDay(peak.day)} at ${int(peak.impressions)} impressions` : "Organic impressions per day"} kicker="Impressions per day">
            <LineChart points={daily.map(r => ({ x: r.day, y: r.impressions }))} />
          </Section>
          <Section title={bestWeek ? `${int(bestWeek.new_followers)} new followers in the best week, starting ${shortDay(bestWeek.week)}` : "New followers per week"} kicker="New followers per week (weeks start Monday; the first and last may be partial)">
            <Columns points={folWeekly.map(r => ({ x: r.week, y: r.new_followers }))} color="#62bb69" />
          </Section>
        </section>

        <section className="card">
          <h2 className="font-semibold">Top organic posts by reach</h2>
          <p className="kicker mb-3">From the top 50 posts LinkedIn lists for Hassan Mahmood's profile, filtered to the dates above.</p>
          {posts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-slate-500"><Th>Posted</Th><Th right>Impressions</Th><Th right>Engagements</Th><Th right>Engagement rate</Th><Th>Post</Th></tr></thead>
                <tbody>
                  {posts.map(p => (
                    <tr key={p.post_url} className="border-b border-slate-100">
                      <td className="py-2 pr-3">{shortDay(p.post_date)}</td>
                      <td className="num py-2 pr-3 text-right">{int(p.impressions)}</td>
                      <td className="num py-2 pr-3 text-right">{int(p.engagements)}</td>
                      <td className="num py-2 pr-3 text-right">{pct(p.impressions ? ((p.engagements ?? 0) / p.impressions) * 100 : null, 2)}</td>
                      <td className="py-2"><a href={p.post_url} target="_blank" rel="noreferrer" className="text-[var(--blue)] underline">Open post</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty />}
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title="Who follows you" kicker="Share of followers by seniority">
            <BarList rows={cats("Seniority").map(r => ({ label: r.value, value: r.percent }))} fmt={n => `${n}%`} color="#62bb69" />
            <p className="kicker mb-3 mt-5">Share of followers by industry</p>
            <BarList rows={cats("Industry").slice(0, 6).map(r => ({ label: r.value, value: r.percent }))} fmt={n => `${n}%`} color="#62bb69" />
          </Section>
          <Section title="Companies following you" kicker="Share of followers (values under 1% are not shown)">
            <BarList rows={cats("Company").map(r => ({ label: r.value, value: r.percent }))} fmt={n => `${n}%`} color="#62bb69" />
          </Section>
        </section>

        <footer className="card text-sm text-slate-600">
          <ul className="list-disc space-y-1 pl-5">
            <li>Only Hassan Mahmood's profile is included, and the post list covers LinkedIn's top 50 posts only.</li>
            <li>The most recent day is often incomplete, so a low final day is not a real drop.</li>
            <li>Company page metrics are not loaded yet.</li>
          </ul>
        </footer>
      </main>
    </div>
  );
}
