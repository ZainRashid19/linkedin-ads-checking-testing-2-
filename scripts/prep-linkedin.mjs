// Turn LinkedIn Campaign Manager exports in data/raw/ into tidy UTF-8 CSVs in data/clean/.
// Usage: node scripts/prep-linkedin.mjs
// LinkedIn exports are UTF-16, tab-separated, with a few report-info lines above the header.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

const RAW = "data/raw", OUT = "data/clean";
mkdirSync(OUT, { recursive: true });

const iso = v => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v || ""); return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : v; };
const num = v => (v == null ? "" : v.replace(/[%,$]/g, ""));
const txt = v => v ?? "";

function read(file) {
  const text = readFileSync(`${RAW}/${file}`, "utf16le").replace(/^﻿/, "");
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === "\t") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const h = rows.findIndex(r => r.length > 3);
  if (h < 0) return [];
  const head = rows[h];
  return rows.slice(h + 1).filter(r => r.length === head.length)
    .map(c => Object.fromEntries(head.map((k, i) => [k, c[i]])));
}
const esc = v => (/[",\n\r]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v);
function write(name, cols, rows) {
  const out = [cols.map(c => c[0]).join(",")].concat(rows.map(r => cols.map(([, src, f]) => esc(f(r[src]))).join(",")));
  writeFileSync(`${OUT}/${name}.csv`, out.join("\n") + "\n");
  console.log(name, rows.length, "rows");
}

const shared = [
  ["day", "Start Date (in UTC)", iso], ["campaign_id", "Campaign ID", txt], ["campaign_name", "Campaign Name", txt],
  ["campaign_status", "Campaign Status", txt], ["ad_set_id", "Ad Set ID", txt], ["ad_set_name", "Ad Set Name", txt],
  ["objective", "Ad Set Objective", txt],
];
const metrics = [
  ["spend", "Total Spent", num], ["impressions", "Impressions", num], ["clicks", "Clicks", num],
  ["reactions", "Reactions", num], ["comments", "Comments", num], ["shares", "Shares", num], ["follows", "Follows", num],
  ["total_engagements", "Total Engagements", num], ["leads", "Leads", num], ["conversions", "Conversions", num],
  ["reach", "Reach", num], ["video_views", "Video Views", num], ["landing_page_clicks", "Clicks to Landing Page", num],
];

for (const f of readdirSync(RAW)) {
  const rows = read(f);
  if (f.includes("campaign_performance")) write("li_ad_sets_daily", [...shared, ...metrics], rows);
  else if (f.includes("creative_performance"))
    write("li_ads_daily", [...shared, ["ad_id", "Ad ID", txt], ["ad_name", "Ad Name", txt], ["ad_status", "Ad Status", txt],
      ["ad_headline", "Ad Headline", txt], ["ad_text", "Ad Introduction Text", txt], ["post_type", "Sponsored Update Type", txt], ...metrics], rows);
  else if (f.includes("demographics")) writeAudience(f);
  else if (f.includes("conversion_performance")) console.log("conversions: no rows (conversion tracking not set up)");
}

// The demographics export holds several reports stacked together (company, industry, job title ...).
// Each starts with a header row whose first cell ends in "Segment".
function writeAudience(file) {
  const text = readFileSync(`${RAW}/${file}`, "utf16le").replace(/^\uFEFF/, "");
  let dim = null; const out = [];
  for (const line of text.split(/\r?\n/)) {
    const c = line.split("\t");
    if (/Segment$/.test(c[0]) && c[1] === "Impressions") { dim = c[0].replace(/ Segment$/, ""); continue; }
    if (!dim || !c[0].trim()) { if (!c[0].trim()) dim = dim && null; continue; }
    out.push({ dimension: dim, segment: c[0], impressions: num(c[1]), clicks: num(c[3]), conversions: num(c[6]) });
  }
  write("li_audience", [["dimension", "dimension", txt], ["segment", "segment", txt], ["impressions", "impressions", txt],
    ["clicks", "clicks", txt], ["conversions", "conversions", txt]], out);
}
