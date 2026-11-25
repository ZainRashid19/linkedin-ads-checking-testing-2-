import { run } from "../lib/db";
import { Header } from "../components/header";
import { Filter } from "../components/filter";
import { Delta, Kpi } from "../components/kit";
import { LineChart } from "../components/charts";
import { daysBetween, int, longDay, pct, usd } from "../lib/format";
import { getRange, type Search } from "../lib/range";

export const dynamic = "force-dynamic";

type Camp = { spend: number; impressions: number; clicks: number; leads: number };

export default async function Overview({ searchParams }: { searchParams: Promise<Search> }) {
  const { min, max, from, to, prev, hasPrev } = await getRange(await searchParams);
  const [mqlRows, orgDaily, orgTot, folTot, adsCamp, adsDaily, li, em, lvl, orgPrevRows, folPrevRows, adsPrevRows] = await Promise.all([
    run<{ section: string }>("mqls_list"),
    run<{ day: string; impressions: number }>("organic_daily", from, to),
    run<{ impressions: number; engagements: number }>("organic_totals", from, to),
    run<{ gained: number }>("followers_total", from, to),
    run<Camp>("ads_by_campaign", from, to),
    run<{ day: string; spend: number }>("ads_daily", from, to),
    run<{ invites: number | null; accepted: number | null; messaged: number | null; replied: number }>("outreach_linkedin"),
    run<{ reached: number; replied: number }>("outreach_email"),
    run<{ level: string; companies: number }>("companies_summary"),
    run<{ impressions: number; engagements: number }>("organic_totals", prev.from, prev.to),
    run<{ gained: number }>("followers_total", prev.from, prev.to),
    run<Camp>("ads_by_campaign", prev.from, prev.to),
  ]);
  const orgPrev = hasPrev ? orgPrevRows[0] : null, folPrev = hasPrev ? folPrevRows[0] : null, adsPrev = hasPrev ? adsPrevRows : null;
  const sum = <T,>(rows: T[], k: keyof T) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);

  const orgImp = orgTot[0].impressions, orgEng = orgTot[0].engagements;
  const rate = orgImp ? (orgEng / orgImp) * 100 : null;
  const spend = sum(adsCamp, "spend"), adImp = sum(adsCamp, "impressions"), clicks = sum(adsCamp, "clicks"), leads = sum(adsCamp, "leads");
  const warm = lvl.filter(l => ["Very High", "High", "Medium"].includes(l.level)).reduce((a, l) => a + l.companies, 0);
  const invites = sum(li, "invites"), messaged = sum(li, "messaged"), liReplies = sum(li, "replied"), reached = sum(em, "reached"), emReplies = sum(em, "replied");

  return (
    <div className="min-h-screen">
      <Header active="/" subtitle={`${longDay(from)} to ${longDay(to)} · ${daysBetween(from, to)} days · data through ${longDay(max)}`} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <Filter path="/" min={min} max={max} from={from} to={to} note="Dates apply to organic and ads. Outreach and accounts cover the whole period each tool reported. Open a section for the detail." />

        <section className="space-y-3">
          <div className="flex items-baseline justify-between"><h2 className="text-lg font-semibold text-[var(--navy)]">Organic</h2><a href="/organic" className="text-sm text-[var(--blue)] underline">Organic detail</a></div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <Kpi label="Organic impressions" value={int(orgImp)} delta={<Delta now={orgImp} before={orgPrev?.impressions ?? null} />} />
            <Kpi label="Engagement rate" value={pct(rate)} note={`${int(orgEng)} engagements`} />
            <Kpi label="New followers" value={int(folTot[0].gained)} delta={<Delta now={folTot[0].gained} before={folPrev?.gained ?? null} />} />
            <div className="card"><p className="kicker mb-1">Impressions per day</p><LineChart points={orgDaily.map(r => ({ x: r.day, y: r.impressions }))} height={110} color="#62bb69" /></div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between"><h2 className="text-lg font-semibold text-[var(--navy)]">Ads</h2><a href="/ads" className="text-sm text-[var(--blue)] underline">Ads detail</a></div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <Kpi label="Ad spend" value={usd(spend)} delta={<Delta now={spend} before={adsPrev ? sum(adsPrev, "spend") : null} />} />
            <Kpi label="Ad impressions" value={int(adImp)} note={clicks ? `${int(clicks)} clicks · ${usd(spend / clicks)} per click` : undefined} />
            <Kpi label="Leads" value={int(leads)} note={leads === 0 && spend > 0 ? "No lead tracking set up on the ads" : undefined} />
            <div className="card"><p className="kicker mb-1">Spend per day</p><LineChart points={adsDaily.map(r => ({ x: r.day, y: r.spend }))} height={110} color="#2660a2" /></div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between"><h2 className="text-lg font-semibold text-[var(--navy)]">Outreach</h2><a href="/outreach" className="text-sm text-[var(--blue)] underline">Outreach detail</a></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Kpi label="LinkedIn (Dripify) replies" value={int(liReplies)} note={`${int(invites)} invites and ${int(messaged)} messages sent`} />
            <Kpi label="Cold email (ManyReach) replies" value={int(emReplies)} note={`${int(reached)} emails reached`} />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between"><h2 className="text-lg font-semibold text-[var(--navy)]">Accounts</h2><a href="/accounts" className="text-sm text-[var(--blue)] underline">Accounts detail</a></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Kpi label="Companies at Medium engagement or above" value={int(warm)} note="Last 7 days. Where outreach should look first" />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between"><h2 className="text-lg font-semibold text-[var(--navy)]">MQLs</h2><a href="/mqls" className="text-sm text-[var(--blue)] underline">MQLs detail</a></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Kpi label="MQLs" value={int(mqlRows.filter(r => r.section === "mql").length)} />
            <Kpi label="Meeting commitments" value={int(mqlRows.filter(r => r.section === "meeting").length)} />
            <Kpi label="Existing relationships" value={int(mqlRows.filter(r => r.section === "other").length)} note="Possible expansion conversations" />
          </div>
        </section>

        <footer className="card text-sm text-slate-600">
          <h2 className="mb-2 font-semibold text-slate-800">What this dashboard can't answer yet</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Revenue and pipeline: HubSpot isn't connected yet, so nothing links marketing activity to deals. The MQL list is a spreadsheet, not live HubSpot data.</li>
            <li>Leads from ads: LinkedIn reports 0 leads and no conversion data.</li>
            <li>Email opens: ManyReach shows 0 opens on every campaign, which most likely means open tracking is off.</li>
            <li>Samples are small. Treat differences as early signals.</li>
          </ul>
        </footer>
      </main>
    </div>
  );
}
