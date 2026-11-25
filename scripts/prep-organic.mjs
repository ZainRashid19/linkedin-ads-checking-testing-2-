// Tidy a LinkedIn personal-profile analytics workbook (data/raw/linkedin_organic_*.xlsx) into data/clean/ CSVs.
// Usage: node scripts/prep-organic.mjs   (needs: npm i exceljs)
import ExcelJS from "exceljs";
import { readdirSync, writeFileSync } from "node:fs";
const iso = v => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v ?? "")); return m ? `${m[3]}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}` : ""; };
const cell = v => v == null ? "" : typeof v === "object" ? (v.text ?? v.result ?? "") : String(v);
const num = v => cell(v).replace(/[%,]/g, "");
const esc = v => (/[",\n\r]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v);
const save = (name, head, rows) => { writeFileSync(`data/clean/${name}.csv`, [head.join(","), ...rows.map(r => r.map(esc).join(","))].join("\n") + "\n"); console.log(name, rows.length, "rows"); };
const rowsOf = ws => { const o = []; ws.eachRow(r => o.push(r.values.slice(1).map(cell))); return o; };

for (const f of readdirSync("data/raw").filter(f => /^linkedin_organic.*\.xlsx$/.test(f))) {
  const person = "Hassan Mahmood";
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(`data/raw/${f}`);

  const eng = rowsOf(wb.getWorksheet("ENGAGEMENT")); console.log("ENGAGEMENT header:", eng[0]);
  const hi = eng.findIndex(r => iso(r[0]) === "") ; // header row
  const head = eng[0].map(h => h.toLowerCase());
  const col = k => head.findIndex(h => h.includes(k));
  save("li_organic_daily", ["person","day","impressions","engagements"],
    eng.slice(1).filter(r => iso(r[0])).map(r => [person, iso(r[0]), num(r[col("impression") < 0 ? 1 : col("impression")]), num(r[col("engagement") < 0 ? 2 : col("engagement")])]));

  const fol = rowsOf(wb.getWorksheet("FOLLOWERS"));
  save("li_organic_followers", ["person","day","new_followers"], fol.filter(r => iso(r[0])).map(r => [person, iso(r[0]), num(r[1])]));

  const posts = new Map();
  const recent = rowsOf(wb.getWorksheet("MOST RECENT POSTS")); const rh = recent[0];
  for (const r of recent.slice(1)) posts.set(r[0], { url: r[0], date: iso(r[1]), type: r[2], impressions: num(r[3]), members_reached: num(r[6]), reactions: num(r[12]), comments: num(r[13]), reposts: num(r[14]), saves: num(r[15]), followers_gained: num(r[10]) });
  for (const r of rowsOf(wb.getWorksheet("TOP POSTS")).slice(2)) {
    if (r[0] && iso(r[1])) { const p = posts.get(r[0]) ?? { url: r[0], date: iso(r[1]) }; p.engagements = num(r[2]); posts.set(r[0], p); }
    if (r[4] && iso(r[5])) { const p = posts.get(r[4]) ?? { url: r[4], date: iso(r[5]) }; p.impressions = num(r[6]); posts.set(r[4], p); }
  }
  const pc = ["url","date","type","impressions","engagements","members_reached","reactions","comments","reposts","saves","followers_gained"];
  save("li_organic_posts", ["person","post_url","post_date","post_type","impressions","engagements","members_reached","reactions","comments","reposts","saves","followers_gained"],
    [...posts.values()].map(p => [person, ...pc.map(k => p[k] ?? "")]));

  const demo = [];
  for (const [sheet, kind] of [["AUDIENCE DEMOGRAPHICS","followers"],["CONTENT DEMOGRAPHICS","content viewers"]])
    for (const r of rowsOf(wb.getWorksheet(sheet)).slice(1)) { const t = r[2].trim(); demo.push([person, kind, r[0], r[1], t, /^</.test(t) ? "" : t.replace("%","")]); }
  save("li_organic_demographics", ["person","audience","category","value","percent_text","percent"], demo);
}
