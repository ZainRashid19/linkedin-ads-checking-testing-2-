// Add a newer LinkedIn export on top of what is already loaded, without wiping history.
// Usage: node scripts/load-update.mjs [--dry]
// Looks in data/ for:
//   account_*_creative_performance_report.csv   Campaign Manager "Ad Performance", broken out by day (UTF-16)
//   AggregateAnalytics_*.xlsx                   LinkedIn personal-profile analytics export (the one with the earliest start date wins)
//   demographics_report.csv                     Campaign Manager Professional demographics (replaces the audience table)
// Each file replaces only the days it covers (ads, organic daily, followers) or the posts it lists, so re-running is safe.
// Ad-set rows are rebuilt from the ad rows (an ad set is the sum of its ads).
import { readdirSync, readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import postgres from "postgres";
process.loadEnvFile(".env.local");
const DRY = process.argv.includes("--dry");

const iso = v => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v ?? "").trim()); return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null; };
const num = v => { const s = String(v ?? "").replace(/[%,$]/g, "").trim(); return s === "" ? null : Number(s); };
const txt = v => (v == null || v === "" ? null : v);

function tsv(file) {
  const text = readFileSync(`data/${file}`, "utf16le").replace(/^﻿/, "");
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
  const head = rows.find(r => r.length > 3);
  return rows.slice(rows.indexOf(head) + 1).filter(r => r.length === head.length).map(c => Object.fromEntries(head.map((k, i) => [k, c[i]])));
}

const METRICS = [["spend", "Total Spent"], ["impressions", "Impressions"], ["clicks", "Clicks"], ["reactions", "Reactions"], ["comments", "Comments"],
  ["shares", "Shares"], ["follows", "Follows"], ["total_engagements", "Total Engagements"], ["leads", "Leads"], ["conversions", "Conversions"],
  ["reach", "Reach"], ["video_views", "Video Views"], ["landing_page_clicks", "Clicks to Landing Page"]];

function adRows(file) {
  return tsv(file).filter(r => iso(r["Start Date (in UTC)"])).map(r => ({
    day: iso(r["Start Date (in UTC)"]), campaign_id: txt(r["Campaign ID"]), campaign_name: txt(r["Campaign Name"]), campaign_status: txt(r["Campaign Status"]),
    ad_set_id: txt(r["Ad Set ID"]), ad_set_name: txt(r["Ad Set Name"]), objective: txt(r["Ad Set Objective"]),
    ad_id: txt(r["Ad ID"]), ad_name: txt(r["Ad Name"]), ad_status: txt(r["Ad Status"]), ad_headline: txt(r["Ad Headline"]),
    ad_text: txt(r["Ad Introduction Text"]), post_type: txt(r["Sponsored Update Type"]),
    ...Object.fromEntries(METRICS.map(([k, src]) => [k, num(r[src])])),
  }));
}
function adSetRows(ads) {
  const m = new Map();
  for (const a of ads) {
    const key = `${a.day}|${a.campaign_id}|${a.ad_set_id}`;
    if (!m.has(key)) {
      const { ad_id, ad_name, ad_status, ad_headline, ad_text, post_type, ...base } = a;
      m.set(key, { ...base, ...Object.fromEntries(METRICS.map(([k]) => [k, null])) });
    }
    const s = m.get(key);
    for (const [k] of METRICS) if (a[k] != null) s[k] = (s[k] ?? 0) + a[k];
  }
  return [...m.values()];
}

const cell = v => (v == null ? "" : typeof v === "object" ? (v.text ?? v.result ?? "") : String(v));
const rowsOf = ws => { const o = []; ws.eachRow(r => o.push(r.values.slice(1).map(cell))); return o; };
async function organic(file) {
  const person = "Hassan Mahmood";
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(`data/${file}`);
  const eng = rowsOf(wb.getWorksheet("ENGAGEMENT"));
  const head = eng[0].map(h => h.toLowerCase());
  const col = (k, d) => (head.findIndex(h => h.includes(k)) < 0 ? d : head.findIndex(h => h.includes(k)));
  const daily = eng.slice(1).filter(r => iso(r[0])).map(r => ({ person, day: iso(r[0]), impressions: num(r[col("impression", 1)]), engagements: num(r[col("engagement", 2)]) }));
  const followers = rowsOf(wb.getWorksheet("FOLLOWERS")).filter(r => iso(r[0])).map(r => ({ person, day: iso(r[0]), new_followers: num(r[1]) }));
  const posts = new Map();
  for (const r of rowsOf(wb.getWorksheet("MOST RECENT POSTS")).slice(1))
    posts.set(r[0], { person, post_url: r[0], post_date: iso(r[1]), post_type: r[2], impressions: num(r[3]), members_reached: num(r[6]), reactions: num(r[12]), comments: num(r[13]), reposts: num(r[14]), saves: num(r[15]), followers_gained: num(r[10]) });
  for (const r of rowsOf(wb.getWorksheet("TOP POSTS")).slice(2)) {
    if (r[0] && iso(r[1])) { const p = posts.get(r[0]) ?? { person, post_url: r[0], post_date: iso(r[1]) }; p.engagements = num(r[2]); posts.set(r[0], p); }
    if (r[4] && iso(r[5])) { const p = posts.get(r[4]) ?? { person, post_url: r[4], post_date: iso(r[5]) }; p.impressions = num(r[6]); posts.set(r[4], p); }
  }
  const demo = [];
  for (const r of rowsOf(wb.getWorksheet("AUDIENCE DEMOGRAPHICS")).slice(1)) { const t = r[2].trim(); demo.push({ person, audience: "followers", category: r[0], value: r[1], percent_text: t, percent: /^</.test(t) ? null : num(t) }); }
  const PC = ["person", "post_url", "post_date", "post_type", "impressions", "engagements", "members_reached", "reactions", "comments", "reposts", "saves", "followers_gained"];
  const full = [...posts.values()].filter(p => p.post_url && p.post_date).map(p => Object.fromEntries(PC.map(k => [k, p[k] ?? null])));
  return { daily, followers, posts: full, demo };
}

const span = rows => [rows.map(r => r.day).sort()[0], rows.map(r => r.day).sort().at(-1)];
const adFile = readdirSync("data").find(f => /^account_.*creative_performance_report\.csv$/.test(f));
const startOf = f => (/(\d{4}-\d{2}-\d{2})_\d{4}-\d{2}-\d{2}/.exec(f) ?? [, "9999"])[1];
const orgFile = readdirSync("data").filter(f => /^AggregateAnalytics_.*\.xlsx$/.test(f)).sort((a, b) => startOf(a).localeCompare(startOf(b)))[0];
const demoFile = readdirSync("data").find(f => /^demographics_report\.csv$/.test(f));
// The demographics file stacks several reports; each starts with a header row whose first cell ends in "Segment".
function audience(file) {
  const text = readFileSync(`data/${file}`, "utf16le").replace(/^\uFEFF/, "");
  let dim = null; const out = [];
  for (const line of text.split(/\r?\n/)) {
    const c = line.split("\t");
    if (/Segment$/.test(c[0]) && c[1] === "Impressions") { dim = c[0].replace(/ Segment$/, ""); continue; }
    if (!c[0].trim()) { dim = null; continue; }
    if (dim) out.push({ dimension: dim, segment: c[0], impressions: num(c[1]), clicks: num(c[3]), conversions: num(c[6]) });
  }
  return out;
}
const aud = demoFile ? audience(demoFile) : [];
const ads = adFile ? adRows(adFile) : [], sets = adSetRows(ads), org = orgFile ? await organic(orgFile) : null;

if (ads.length) console.log(`ads: ${ads.length} ad rows, ${sets.length} ad-set rows, ${span(ads).join(" to ")}, spend ${ads.reduce((a, r) => a + (r.spend ?? 0), 0).toFixed(2)}`);
if (org) console.log(`organic: ${org.daily.length} days (${span(org.daily).join(" to ")}), ${org.followers.length} follower days, ${org.posts.length} posts, ${org.demo.length} follower-audience rows`);
if (aud.length) console.log(`audience: ${aud.length} rows from ${demoFile}`);
if (DRY) process.exit(0);

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
const put = async (tx, table, rows) => { for (let i = 0; i < rows.length; i += 200) await tx`insert into ${tx(table)} ${tx(rows.slice(i, i + 200))}`; };
try {
  await sql.begin(async tx => {
    if (ads.length) {
      const [a, b] = span(ads);
      await tx`delete from li_ads_daily where day between ${a} and ${b}`;
      await tx`delete from li_ad_sets_daily where day between ${a} and ${b}`;
      await put(tx, "li_ads_daily", ads); await put(tx, "li_ad_sets_daily", sets);
    }
    if (aud.length) { await tx`delete from li_audience`; await put(tx, "li_audience", aud); }
    if (org) {
      const [a, b] = span(org.daily);
      await tx`delete from li_organic_daily where day between ${a} and ${b}`;
      await tx`delete from li_organic_followers where day between ${a} and ${b}`;
      await put(tx, "li_organic_daily", org.daily); await put(tx, "li_organic_followers", org.followers);
      const urls = org.posts.map(p => p.post_url);
      await tx`delete from li_organic_posts where post_url in ${tx(urls)}`;
      await put(tx, "li_organic_posts", org.posts);
      await tx`delete from li_organic_demographics where audience = 'followers'`;
      await put(tx, "li_organic_demographics", org.demo);
    }
  });
  console.log("Loaded.");
} catch (e) { console.error("Load failed, nothing was changed:", e.message); process.exitCode = 1; }
finally { await sql.end(); }
