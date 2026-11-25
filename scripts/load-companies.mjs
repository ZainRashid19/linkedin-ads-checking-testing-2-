// Load a LinkedIn company engagement export into li_companies as one dated snapshot.
// Usage: node scripts/load-companies.mjs "data/<file>.csv" --days 7   (re-running replaces rows for the same export day)
// --days says how many days the export covered (the file doesn't say). Trends only compare snapshots of the same length.
// With no file it loads data/companies-export_*_YYYY-MM-DD_*.csv with the length left unknown.
import { readdirSync, readFileSync } from "node:fs";
import postgres from "postgres";
process.loadEnvFile(".env.local");

function parse(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.length > 1);
}
const n = v => (v === "" || v == null ? null : Math.round(Number(v.replace(/,/g, ""))));

const args = process.argv.slice(2), di = args.indexOf("--days");
const days = di >= 0 ? Number(args[di + 1]) : null;
const given = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--days");
const files = given ? [given.replace(/^data\//, "")] : readdirSync("data").filter(f => /^companies-export_.*\.csv$/.test(f));
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
try {
  for (const f of files) {
    const day = /(\d{4}-\d{2}-\d{2})_\d{2}-\d{2}-\d{2}/.exec(f)[1];
    const [head, ...rows] = parse(readFileSync(`data/${f}`, "utf8").replace(/^﻿/, ""));
    const col = name => head.indexOf(name);
    const recs = rows.map(r => ({
      snapshot_date: day, window_days: days, company: r[col("Company name")], page_url: r[col("Company page URL")] || null,
      engagement_level: r[col("Engagement level")] || null,
      organic_impressions: n(r[col("Organic impressions")]), organic_engagements: n(r[col("Organic engagements")]),
      paid_impressions: n(r[col("Paid impressions")]), paid_clicks: n(r[col("Paid clicks")]),
      paid_engagements: n(r[col("Paid engagements")]), paid_video_views: n(r[col("Paid video views")]),
      paid_conversions: n(r[col("Paid conversions")]), paid_leads: n(r[col("Paid leads")]),
      paid_qualified_leads: n(r[col("Paid qualified leads")]),
    }));
    await sql.begin(async tx => {
      await tx`delete from li_companies where snapshot_date = ${day}`;
      for (let i = 0; i < recs.length; i += 500) await tx`insert into li_companies ${tx(recs.slice(i, i + 500))}`;
    });
    console.log(f, "->", recs.length, "rows for", day);
  }
} catch (e) { console.error("Load failed:", e.message); process.exitCode = 1; }
finally { await sql.end(); }
