import { run } from "../../lib/db";
import { Header } from "../../components/header";
import { Kpi, Th } from "../../components/kit";
import { int } from "../../lib/format";

export const dynamic = "force-dynamic";

type Row = { section: "mql" | "other" | "meeting"; when_label: string | null; name: string; title: string | null; company: string | null; channel: string | null; source: string | null; status: string | null; section_note: string | null; level: string | null };

const LEVEL_STYLE: Record<string, string> = {
  "Very High": "bg-green-100 text-green-800", High: "bg-green-50 text-green-800", Medium: "bg-blue-50 text-blue-800",
  Low: "bg-slate-100 text-slate-700", "Very Low": "bg-slate-100 text-slate-500",
};
const WARM = ["Very High", "High", "Medium"];

function Table({ rows, extra, status }: { rows: Row[]; extra: "channel" | "source"; status?: boolean }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead><tr className="border-b border-slate-200 text-left text-slate-500"><Th>Date</Th><Th>Name</Th><Th>Title</Th><Th>Company</Th><Th>{extra === "channel" ? "Channel" : "Source"}</Th>{status && <Th>Status</Th>}<Th>Company's LinkedIn engagement</Th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 align-top">
              <td className="whitespace-nowrap py-2 pr-3 text-slate-600">{r.when_label ?? "–"}</td>
              <td className="py-2 pr-3 font-medium">{r.name}</td>
              <td className="py-2 pr-3">{r.title ?? "–"}</td>
              <td className="py-2 pr-3">{r.company ?? <span className="text-slate-400">Not recorded</span>}</td>
              <td className="py-2 pr-3">{r[extra] ?? "–"}</td>
              {status && <td className="py-2 pr-3">{r.status ?? "–"}</td>}
              <td className="py-2">{r.level ? <span className={`rounded-full px-2 py-0.5 text-xs ${LEVEL_STYLE[r.level] ?? ""}`}>{r.level}</span> : <span className="text-slate-400">–</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Mqls() {
  const rows = await run<Row>("mqls_list");
  const mqls = rows.filter(r => r.section === "mql"), other = rows.filter(r => r.section === "other"), meets = rows.filter(r => r.section === "meeting");
  const companies = new Set(mqls.map(r => r.company).filter(Boolean));
  const warmCompanies = new Set(mqls.filter(r => r.level && WARM.includes(r.level)).map(r => r.company));
  const matched = mqls.filter(r => r.level).length;

  return (
    <div className="min-h-screen">
      <Header active="/mqls" subtitle="Marketing qualified leads, existing relationships and meeting commitments" />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="MQLs" value={int(mqls.length)} note={`${int(companies.size)} companies`} />
          <Kpi label="Meeting commitments" value={int(meets.length)} note="Agreed to meet; not all on the calendar yet" />
          <Kpi label="Existing relationships" value={int(other.length)} note="Possible expansion conversations" />
          <Kpi label="MQL companies with Medium+ LinkedIn engagement" value={int(warmCompanies.size)} note={`of ${int(matched)} MQLs whose company matched the company export`} />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--navy)]">MQLs</h2>
          <p className="kicker">{mqls[0]?.section_note ?? "All MQLs came from the Revenue by Design book."} Listed latest first. July to August dates are the report period; exact dates were not recorded.</p>
          <Table rows={mqls} extra="channel" />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--navy)]">Other: existing Voiant relationships</h2>
          <p className="kicker">{other[0]?.section_note}</p>
          <Table rows={other} extra="channel" />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--navy)]">Meeting commitments</h2>
          <p className="kicker">{meets[0]?.section_note}</p>
          <Table rows={meets} extra="source" status />
        </section>

        <footer className="card text-sm text-slate-600">
          <ul className="list-disc space-y-1 pl-5">
            <li>The list comes from the voiant - mqls spreadsheet. Update it and reload to refresh this page.</li>
            <li>The LinkedIn engagement level appears only when the company name matches the company export exactly, so a dash does not mean no engagement.</li>
            <li>Channel is how the person came to us: LinkedIn organic posts, LinkedIn ads (Thought Leader ads and the Revenue by Design book), LinkedIn outreach (Dripify), or a person at Voiant such as Hassan Mahmood. Status shows where a meeting commitment stands; a dash means none recorded.</li>
          </ul>
        </footer>
      </main>
    </div>
  );
}
