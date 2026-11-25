import { change, int } from "../lib/format";

export function Kpi({ label, value, delta, note }: { label: string; value: string; delta?: React.ReactNode; note?: string }) {
  return (
    <div className="card">
      <p className="kicker">{label}</p>
      <p className="num mt-1 text-3xl font-semibold text-[var(--navy)]">{value}</p>
      {delta}
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

export function Delta({ now, before, points }: { now: number; before: number | null; points?: boolean }) {
  if (before == null) return <p className="mt-1 text-xs text-slate-400">No earlier period to compare</p>;
  if (points) {
    const d = now - before;
    return <p className={`mt-1 text-xs ${d >= 0 ? "text-green-700" : "text-red-700"}`}>{d >= 0 ? "▲" : "▼"} {Math.abs(d).toFixed(1)} points vs previous period</p>;
  }
  const c = change(now, before);
  if (c == null) return <p className="mt-1 text-xs text-slate-400">No earlier period to compare</p>;
  return <p className={`mt-1 text-xs ${c >= 0 ? "text-green-700" : "text-red-700"}`}>{c >= 0 ? "▲" : "▼"} {Math.abs(c).toFixed(0)}% vs previous equal period ({int(before)})</p>;
}

export function Section({ title, kicker, children }: { title: string; kicker?: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 className="font-semibold">{title}</h2>
      {kicker && <p className="kicker mb-3">{kicker}</p>}
      {children}
    </div>
  );
}

export function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th className={`py-2 pr-3 font-medium ${right ? "num text-right" : ""}`}>{children}</th>;
}
