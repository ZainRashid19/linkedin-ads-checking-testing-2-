import { int, shortDay } from "../lib/format";

const W = 640;
const PAD = { l: 44, r: 12, t: 10, b: 26 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

type Pt = { x: string; y: number };

function Axes({ max, h, xs, label }: { max: number; h: number; xs: string[]; label: (x: string) => string }) {
  const ih = h - PAD.t - PAD.b;
  const iw = W - PAD.l - PAD.r;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const every = Math.max(1, Math.ceil(xs.length / 6));
  return (
    <g>
      {ticks.map(t => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ih * (1 - t)} y2={PAD.t + ih * (1 - t)} stroke="#e3e8ef" />
          <text x={PAD.l - 6} y={PAD.t + ih * (1 - t) + 4} textAnchor="end" fontSize="11" fill="#5b6678">{int(max * t)}</text>
        </g>
      ))}
      {xs.map((x, i) => i % every === 0 && (
        <text key={x} x={PAD.l + (xs.length === 1 ? iw / 2 : (iw * i) / (xs.length - 1))} y={h - 6} textAnchor="middle" fontSize="11" fill="#5b6678">{label(x)}</text>
      ))}
    </g>
  );
}

export function LineChart({ points, color = "#2660a2", height = 220, unit = "" }: { points: Pt[]; color?: string; height?: number; unit?: string }) {
  if (!points.length) return <Empty />;
  const max = niceMax(Math.max(...points.map(p => p.y)));
  const ih = height - PAD.t - PAD.b, iw = W - PAD.l - PAD.r;
  const px = (i: number) => PAD.l + (points.length === 1 ? iw / 2 : (iw * i) / (points.length - 1));
  const py = (v: number) => PAD.t + ih * (1 - v / max);
  const d = points.map((p, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full h-auto" role="img" aria-label="Line chart">
      <Axes max={max} h={height} xs={points.map(p => p.x)} label={shortDay} />
      <path d={`${d} L${px(points.length - 1)},${py(0)} L${px(0)},${py(0)} Z`} fill={color} opacity="0.08" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {points.length <= 45 && points.map((p, i) => (
        <circle key={p.x} cx={px(i)} cy={py(p.y)} r="2.5" fill={color}><title>{`${shortDay(p.x)}: ${int(p.y)}${unit}`}</title></circle>
      ))}
    </svg>
  );
}

export function Columns({ points, color = "#2660a2", height = 220 }: { points: Pt[]; color?: string; height?: number }) {
  if (!points.length) return <Empty />;
  const max = niceMax(Math.max(...points.map(p => p.y)));
  const ih = height - PAD.t - PAD.b, iw = W - PAD.l - PAD.r;
  const step = iw / points.length, bw = Math.min(40, step * 0.7);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full h-auto" role="img" aria-label="Column chart">
      <Axes max={max} h={height} xs={[]} label={shortDay} />
      {points.map((p, i) => {
        const x = PAD.l + step * i + (step - bw) / 2, hh = (p.y / max) * ih;
        return (
          <g key={p.x}>
            <rect x={x} y={PAD.t + ih - hh} width={bw} height={hh} rx="2" fill={color}><title>{`Week of ${shortDay(p.x)}: ${int(p.y)}`}</title></rect>
            {(points.length <= 14 || i % Math.ceil(points.length / 10) === 0) && (
              <text x={x + bw / 2} y={height - 6} textAnchor="middle" fontSize="11" fill="#5b6678">{shortDay(p.x)}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Sorted horizontal bars. Pass rows already sorted largest first.
export function BarList({ rows, color = "#2660a2", fmt = int }: { rows: { label: string; value: number; note?: string }[]; color?: string; fmt?: (n: number) => string }) {
  if (!rows.length) return <Empty />;
  const max = Math.max(...rows.map(r => r.value), 1);
  return (
    <ul className="space-y-2">
      {rows.map(r => (
        <li key={r.label} className="text-sm">
          <div className="flex justify-between gap-3">
            <span className="truncate" title={r.label}>{r.label}</span>
            <span className="num shrink-0 text-slate-700">{fmt(r.value)}{r.note ? <span className="text-slate-500"> · {r.note}</span> : null}</span>
          </div>
          <div className="mt-1 h-2 rounded bg-slate-100"><div className="h-2 rounded" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function Empty({ text = "No data in this date range." }: { text?: string }) {
  return <p className="py-10 text-center text-sm text-slate-500">{text}</p>;
}
