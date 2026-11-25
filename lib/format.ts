export const int = (n: number | null | undefined) => (n == null ? "–" : Math.round(n).toLocaleString("en-US"));
export const usd = (n: number | null | undefined) => (n == null ? "–" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export const pct = (n: number | null | undefined, d = 1) => (n == null || !isFinite(n) ? "–" : `${n.toFixed(d)}%`);

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function shortDay(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${MON[m - 1]} ${d}`;
}
export function longDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MON[m - 1]} ${d}, ${y}`;
}

const t = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => iso(t(s) + n * 86400000);
export const daysBetween = (a: string, b: string) => Math.round((t(b) - t(a)) / 86400000) + 1;

// The equal-length period right before from..to.
export function previousRange(from: string, to: string) {
  const n = daysBetween(from, to);
  return { from: addDays(from, -n), to: addDays(from, -1) };
}

export function change(now: number, before: number | null) {
  if (before == null || before <= 0) return null;
  return ((now - before) / before) * 100;
}
