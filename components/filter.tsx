import { addDays } from "../lib/format";

export function Filter({ path, min, max, from, to, note }: { path: string; min: string; max: string; from: string; to: string; note: string }) {
  const presets = [
    { label: "Last 30 days", from: addDays(max, -29), to: max },
    { label: "Last 60 days", from: addDays(max, -59), to: max },
    { label: "All data", from: min, to: max },
  ];
  return (
    <form method="get" action={path} className="card flex flex-wrap items-end gap-3">
      <div>
        <label className="kicker block" htmlFor="from">From</label>
        <input id="from" name="from" type="date" min={min} max={max} defaultValue={from} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="kicker block" htmlFor="to">To</label>
        <input id="to" name="to" type="date" min={min} max={max} defaultValue={to} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <button className="rounded-lg bg-[var(--navy)] px-4 py-1.5 text-sm font-medium text-white hover:bg-[var(--blue)]">Apply</button>
      <div className="ml-auto flex flex-wrap gap-2 text-sm">
        {presets.map(p => (
          <a key={p.label} href={`${path}?from=${p.from}&to=${p.to}`} className={`rounded-lg border px-3 py-1.5 ${p.from === from && p.to === to ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-slate-300 hover:bg-slate-50"}`}>{p.label}</a>
        ))}
      </div>
      <p className="basis-full text-xs text-slate-500">{note}</p>
    </form>
  );
}
