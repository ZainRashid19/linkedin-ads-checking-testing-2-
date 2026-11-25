import { run } from "./db";
import { addDays, previousRange } from "./format";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export type Search = { from?: string; to?: string };

// The date range only changes when new data is loaded, so keep it for a few minutes.
let rangeCache: { at: number; v: { min_day: string; max_day: string } } | null = null;
async function dataRange() {
  if (rangeCache && Date.now() - rangeCache.at < 5 * 60_000) return rangeCache.v;
  const [v] = await run<{ min_day: string; max_day: string }>("data_range");
  rangeCache = { at: Date.now(), v };
  return v;
}

// Default is the last 30 days of data. The previous equal period only counts when it falls inside the data we have.
export async function getRange(sp: Search) {
  const { min_day: min, max_day: max } = await dataRange();
  let to = DAY.test(sp.to ?? "") ? sp.to! : max;
  let from = DAY.test(sp.from ?? "") ? sp.from! : addDays(to, -29);
  if (to > max) to = max;
  if (from < min) from = min;
  if (from > to) from = to;
  const prev = previousRange(from, to);
  return { min, max, from, to, prev, hasPrev: prev.from >= min };
}
