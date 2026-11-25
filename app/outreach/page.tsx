import { run } from "../../lib/db";
import { Header } from "../../components/header";
import { Kpi, Th } from "../../components/kit";
import { int, longDay, pct, usd } from "../../lib/format";

export const dynamic = "force-dynamic";

type Li = { campaign: string; invites: number | null; accepted: number | null; messaged: number | null; replied: number; first_day: string; last_day: string };
type Em = { campaign: string; reached: number; opened: number; replied: number; positive_replies: number | null; opportunities_usd: number; first_day: string; last_day: string };
const clean = (s: string) => s.replace(/ \((Dripify|ManyReach)\)/, "");
const sum = <T,>(rows: T[], k: keyof T) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);

export default async function Outreach() {
  const [li, em, sync] = await Promise.all([run<Li>("outreach_linkedin"), run<Em>("outreach_email"), run<{ source: string; ran_at: string }>("sync_status")]);
  const mrSync = sync.find(s => s.source === "manyreach")?.ran_at, dpSync = sync.find(s => s.source === "dripify")?.ran_at;
  const inv = li.filter(o => o.invites != null), msg = li.filter(o => o.invites == null);
  const invites = sum(inv, "invites"), accepted = sum(inv, "accepted"), invReplies = sum(inv, "replied");
  const messaged = sum(msg, "messaged"), msgReplies = sum(msg, "replied");
  const stamp = (t?: string) => (t ? new Date(t).toLocaleString("en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" }) + " ET" : null);
  const reached = sum(em, "reached"), emReplies = sum(em, "replied");
  const counted = em.filter(o => o.positive_replies != null);
  const positive = sum(counted, "positive_replies");
  const positiveKnown = counted.length > 0;

  return (
    <div className="min-h-screen">
      <Header active="/outreach" subtitle="Outreach: LinkedIn connection and messaging campaigns (Dripify) and cold email (ManyReach), shown separately" />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6">
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--navy)]">LinkedIn connection campaigns (Dripify)</h2>
            <p className="kicker">Connection request, then a message once accepted. {dpSync ? `Synced automatically from Dripify, last on ${stamp(dpSync)}.` : ""} Totals per campaign since it started; not date filtered. Dripify does not report messages sent for these campaigns.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Kpi label="Invites sent" value={int(invites)} />
            <Kpi label="Accepted" value={int(accepted)} note={`${pct(invites ? (accepted / invites) * 100 : null, 0)} of invites`} />
            <Kpi label="Replies" value={int(invReplies)} note={`${pct(accepted ? (invReplies / accepted) * 100 : null, 1)} of accepted`} />
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b border-slate-200 text-left text-slate-500"><Th>Campaign</Th><Th right>Invites</Th><Th right>Accepted</Th><Th right>Accept rate</Th><Th right>Replied</Th><Th right>Reply rate (of accepted)</Th></tr></thead>
              <tbody>
                {inv.map(o => (
                  <tr key={o.campaign} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{clean(o.campaign)}<span className="block text-xs text-slate-500">{longDay(o.first_day)} to {longDay(o.last_day)}</span></td>
                    <td className="num py-2 pr-3 text-right">{int(o.invites)}</td>
                    <td className="num py-2 pr-3 text-right">{int(o.accepted)}</td>
                    <td className="num py-2 pr-3 text-right">{o.invites ? pct(((o.accepted ?? 0) / o.invites) * 100, 0) : "–"}</td>
                    <td className="num py-2 pr-3 text-right">{int(o.replied)}</td>
                    <td className="num py-2 pr-3 text-right font-medium">{o.accepted ? pct((o.replied / o.accepted) * 100, 1) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {msg.length > 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--navy)]">LinkedIn messaging campaigns (Dripify)</h2>
              <p className="kicker">Direct messages to people we are already connected with, so there are no invites or acceptances. Totals per campaign since it started.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Kpi label="Messages sent" value={int(messaged)} />
              <Kpi label="Replies" value={int(msgReplies)} note={`${pct(messaged ? (msgReplies / messaged) * 100 : null, 1)} of messages sent`} />
            </div>
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-slate-500"><Th>Campaign</Th><Th right>Messages sent</Th><Th right>Replied</Th><Th right>Reply rate (of messages)</Th></tr></thead>
                <tbody>
                  {msg.map(o => (
                    <tr key={o.campaign} className="border-b border-slate-100">
                      <td className="py-2 pr-3">{clean(o.campaign)}<span className="block text-xs text-slate-500">{longDay(o.first_day)} to {longDay(o.last_day)}</span></td>
                      <td className="num py-2 pr-3 text-right">{int(o.messaged)}</td>
                      <td className="num py-2 pr-3 text-right">{int(o.replied)}</td>
                      <td className="num py-2 pr-3 text-right font-medium">{o.messaged ? pct((o.replied / o.messaged) * 100, 1) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--navy)]">Cold email (ManyReach)</h2>
            <p className="kicker">One campaign per industry. {mrSync ? `Synced automatically from ManyReach, last on ${stamp(mrSync)}.` : "Figures were typed from ManyReach report pages."} Opens read 0 because open tracking is off in ManyReach.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Kpi label="Emails reached" value={int(reached)} />
            <Kpi label="Total replies" value={int(emReplies)} note={`${pct(reached ? (emReplies / reached) * 100 : null, 2)} of emails reached`} />
            <Kpi label="Positive replies" value={positiveKnown ? int(positive) : "–"} note={positiveKnown ? `${pct(emReplies ? (positive / emReplies) * 100 : null, 0)} of replies${counted.length < em.length ? ` · counted for ${counted.length} of ${em.length} campaigns` : ""}` : "Not counted yet"} />
            <Kpi label="Opportunities" value={usd(sum(em, "opportunities_usd"))} note="Value logged in ManyReach" />
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead><tr className="border-b border-slate-200 text-left text-slate-500"><Th>Campaign</Th><Th right>Reached</Th><Th right>Total replies</Th><Th right>Positive replies</Th><Th right>Reply rate</Th></tr></thead>
              <tbody>
                {em.map(o => (
                  <tr key={o.campaign} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{clean(o.campaign)}<span className="block text-xs text-slate-500">{longDay(o.first_day)} to {longDay(o.last_day)}</span></td>
                    <td className="num py-2 pr-3 text-right">{int(o.reached)}</td>
                    <td className="num py-2 pr-3 text-right">{int(o.replied)}</td>
                    <td className="num py-2 pr-3 text-right">{o.positive_replies == null ? "–" : int(o.positive_replies)}</td>
                    <td className="num py-2 pr-3 text-right font-medium">{pct(o.reached ? (o.replied / o.reached) * 100 : null, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="card text-sm text-slate-600">
          <ul className="list-disc space-y-1 pl-5">
            <li>Samples are tiny (a handful of replies per channel). Don't pick a winning campaign yet.</li>
            <li>The two channels start from different places, so compare reply rates only within a channel.</li>
          </ul>
        </footer>
      </main>
    </div>
  );
}
