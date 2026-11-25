import type { Sql } from "postgres";
import { syncDripify } from "./dripify.ts";
import { syncManyReach } from "./manyreach.ts";
import { syncLinkedInAds } from "./linkedin-ads.ts";

// Each source runs on its own, so one failing API never blocks the others. Every run is logged.
const SOURCES: { name: string; run: (sql: Sql) => Promise<{ rows: number; message: string }> }[] = [
  { name: "manyreach", run: syncManyReach },
  { name: "dripify", run: syncDripify },
  { name: "linkedin_ads", run: syncLinkedInAds },
];

export async function runSync(sql: Sql, only?: string) {
  const results = [];
  for (const s of SOURCES.filter(s => !only || s.name === only)) {
    try {
      const r = await s.run(sql);
      await sql`insert into sync_log (source, ok, rows, message) values (${s.name}, true, ${r.rows}, ${r.message})`;
      results.push({ source: s.name, ok: true, ...r });
    } catch (e) {
      const message = e instanceof Error ? e.message : "failed";
      await sql`insert into sync_log (source, ok, rows, message) values (${s.name}, false, 0, ${message})`;
      results.push({ source: s.name, ok: false, rows: 0, message });
    }
  }
  return results;
}
