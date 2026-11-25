// Load data/voiant - mqls.xlsx into the mqls table (replaces everything in it). Usage: node scripts/load-mqls.mjs
// Sheet layout (Channel column for MQLs, Source column for meetings): a title row per section ("MQLs", "Other: ...", "Meeting commitments"), an optional note row, a Date/Name/Title/Company header, then rows.
// A "Status" column after Source is stored for meetings. MQLs and meetings are stored latest first (by the date in the Date column).
import ExcelJS from "exceljs";
import postgres from "postgres";
process.loadEnvFile(".env.local");

const cell = v => (v == null ? "" : v instanceof Date ? v : typeof v === "object" ? String(v.text ?? v.result ?? "") : String(v).trim());
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile("data/voiant - mqls.xlsx");
const ws = wb.worksheets[0];

// Date used only for ordering. Text dates: "Week of Nov 2, 2026", "Dec 7, 2026", "Aug 4-6, 2026" (last day), "Jul-Aug 2026" (end of the last month).
const sortKey = a => {
  if (a instanceof Date) return a.getTime();
  const y = /(\d{4})/.exec(a)?.[1]; if (!y) return 0;
  const months = [...String(a).matchAll(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/g)].map(m => MON.indexOf(m[1]));
  if (!months.length) return 0;
  const days = [...String(a).matchAll(/\b(\d{1,2})(?!\d)/g)].map(m => +m[1]);
  return Date.UTC(+y, months.at(-1), days.length ? days.at(-1) : 28);
};
const rows = []; let section = null, note = null, position = 0, lastCol = "", lastStatus = false;
ws.eachRow(r => {
  const [a, b, c, d, e, f] = [1, 2, 3, 4, 5, 6].map(i => cell(r.getCell(i).value));
  if (a === "Date") { lastCol = e; lastStatus = f === "Status"; return; }
  if (!b && typeof a === "string" && a) {
    if (/^MQLs/i.test(a)) { section = "mql"; note = null; }
    else if (/^Other/i.test(a)) { section = "other"; note = null; }
    else if (/^Meeting/i.test(a)) { section = "meeting"; note = null; }
    else note = a;
    return;
  }
  if (!b || !section) return;
  const isDate = a instanceof Date;
  rows.push({
    position: ++position, section, section_note: note, name: b, title: c || null, company: d || null,
    channel: lastCol === "Channel" ? e || null : null, source: lastCol === "Source" ? e || null : null, status: lastStatus ? f || null : null,
    when_label: isDate ? `${MON[a.getUTCMonth()]} ${a.getUTCFullYear()}` : a || null,
    when_date: isDate ? a.toISOString().slice(0, 10) : null,
    sort: sortKey(a),
  });
});
// Latest first within MQLs and meetings; ties keep their order in the sheet. Other sections keep sheet order.
const sections = ["mql", "other", "meeting"];
rows.sort((x, y) => sections.indexOf(x.section) - sections.indexOf(y.section) || (x.section === "other" ? 0 : y.sort - x.sort) || x.position - y.position);
rows.forEach((r, i) => { r.position = i + 1; delete r.sort; });
// A note row appears after its section title, so give every row of a section the section's note.
const notes = {}; for (const r of rows) if (r.section_note) notes[r.section] = r.section_note;
for (const r of rows) r.section_note = notes[r.section] ?? null;

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
try {
  await sql.begin(async tx => { await tx`delete from mqls`; await tx`insert into mqls ${tx(rows)}`; });
  const by = rows.reduce((m, r) => ((m[r.section] = (m[r.section] ?? 0) + 1), m), {});
  console.log("loaded", rows.length, "rows:", JSON.stringify(by));
} catch (e) { console.error("Load failed:", e.message); process.exitCode = 1; }
finally { await sql.end(); }
